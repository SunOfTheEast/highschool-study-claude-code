import type {
  MaterialSearchConversationItem,
  MaterialSearchPhase,
} from '../shared/contracts';

type JsonObject = Record<string, unknown>;

const SCOUT_AGENT = 'study-material-scout';
const RETURNED_STATUSES = new Set(['completed', 'failed', 'detached']);

function object(value: unknown): JsonObject | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function records(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.map(object).filter((entry): entry is JsonObject => entry !== null)
    : [];
}

function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function details(value: unknown): JsonObject | null {
  const outer = object(value);
  return object(outer?.details) ?? outer;
}

function scoutEntries(value: unknown, field: 'progress' | 'results'): JsonObject[] {
  return records(details(value)?.[field]).filter((entry) => entry.agent === SCOUT_AGENT);
}

function taskCount(args: unknown): number {
  const value = object(args);
  if (!value) return 0;
  const tasks = records(value.tasks).filter((task) => task.agent === SCOUT_AGENT);
  if (tasks.length > 0) return tasks.length;
  return value.agent === SCOUT_AGENT ? 1 : 0;
}

function totalSteps(value: unknown): number {
  const count = finiteNumber(details(value)?.totalSteps);
  return count === null ? 0 : Math.max(0, Math.floor(count));
}

function sum(entries: JsonObject[], field: string): number {
  return entries.reduce((total, entry) => total + (finiteNumber(entry[field]) ?? 0), 0);
}

function maximum(entries: JsonObject[], field: string): number {
  return entries.reduce((current, entry) => (
    Math.max(current, finiteNumber(entry[field]) ?? 0)
  ), 0);
}

function phaseFor(progress: JsonObject[]): MaterialSearchPhase {
  const tools = progress.flatMap((entry) => (
    typeof entry.currentTool === 'string' ? [entry.currentTool] : []
  ));
  if (tools.includes('read')) return 'inspecting';
  if (tools.some((tool) => tool === 'grep' || tool === 'find' || tool === 'ls')) {
    return 'filtering';
  }
  return progress.length > 0 ? 'comparing' : 'starting';
}

function elapsedBetween(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  return Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, endMs - startMs)
    : 0;
}

function resultFailed(result: JsonObject): boolean {
  const exitCode = finiteNumber(result.exitCode);
  return (exitCode !== null && exitCode !== 0)
    || typeof result.error === 'string'
    || result.timedOut === true
    || result.stopped === true;
}

export function materialSearchStart(
  id: string,
  args: unknown,
  at: string,
): MaterialSearchConversationItem | null {
  const total = taskCount(args);
  if (total === 0) return null;
  return {
    id,
    kind: 'material-search',
    status: 'running',
    phase: 'starting',
    completed: 0,
    total,
    toolCount: 0,
    elapsedMs: 0,
    at,
    updatedAt: at,
  };
}

export function materialSearchUpdate(
  id: string,
  args: unknown,
  partialResult: unknown,
  at: string,
): MaterialSearchConversationItem | null {
  const progress = scoutEntries(partialResult, 'progress');
  const total = taskCount(args) || totalSteps(partialResult) || progress.length;
  if (total === 0) return null;
  return {
    id,
    kind: 'material-search',
    status: 'running',
    phase: phaseFor(progress),
    completed: progress.filter((entry) => (
      typeof entry.status === 'string' && RETURNED_STATUSES.has(entry.status)
    )).length,
    total,
    toolCount: sum(progress, 'toolCount'),
    elapsedMs: maximum(progress, 'durationMs'),
    at,
    updatedAt: at,
  };
}

export function materialSearchEnd(
  id: string,
  result: unknown,
  isError: boolean,
  at: string,
  started?: MaterialSearchConversationItem,
): MaterialSearchConversationItem | null {
  const results = scoutEntries(result, 'results');
  if (!started && results.length === 0) return null;
  const failed = isError || results.some(resultFailed);
  const progressSummaries = results.flatMap((entry) => {
    const summary = object(entry.progressSummary);
    return summary ? [summary] : [];
  });
  const total = started?.total ?? results.length;
  return {
    id,
    kind: 'material-search',
    status: failed ? 'error' : 'done',
    phase: failed ? 'adjusting' : 'done',
    completed: results.length > 0 ? results.length : (started?.completed ?? 0),
    total,
    toolCount: progressSummaries.length > 0
      ? sum(progressSummaries, 'toolCount')
      : (started?.toolCount ?? 0),
    elapsedMs: started
      ? elapsedBetween(started.at, at)
      : maximum(progressSummaries, 'durationMs'),
    at: started?.at ?? at,
    updatedAt: at,
  };
}

export function mergeMaterialSearchItem(
  existing: MaterialSearchConversationItem,
  incoming: MaterialSearchConversationItem,
): MaterialSearchConversationItem {
  return {
    ...incoming,
    completed: Math.max(existing.completed, incoming.completed),
    total: incoming.total || existing.total,
    toolCount: Math.max(existing.toolCount, incoming.toolCount),
    elapsedMs: Math.max(
      existing.elapsedMs,
      incoming.elapsedMs,
      elapsedBetween(existing.at, incoming.updatedAt),
    ),
    at: existing.at,
  };
}
