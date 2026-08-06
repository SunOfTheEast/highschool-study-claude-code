import type { LessonReviewConversationItem } from '../shared/contracts';

type JsonObject = Record<string, unknown>;

const REVIEWER_AGENT = 'lesson-risk-reviewer';

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

function reviewerTaskCount(args: unknown): number {
  const value = object(args);
  if (!value) return 0;
  if (value.agent === REVIEWER_AGENT && !('tasks' in value)) return 1;
  const tasks = records(value.tasks);
  return tasks.length > 0 && tasks.every((task) => task.agent === REVIEWER_AGENT)
    ? tasks.length
    : 0;
}

function reviewerResults(result: unknown): JsonObject[] {
  return records(details(result)?.results).filter((entry) => entry.agent === REVIEWER_AGENT);
}

function elapsedBetween(start: string, end: string): number {
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  return Number.isFinite(startMs) && Number.isFinite(endMs)
    ? Math.max(0, endMs - startMs)
    : 0;
}

function resultDuration(results: JsonObject[]): number {
  return results.reduce((maximum, result) => {
    const progress = object(result.progressSummary);
    return Math.max(maximum, finiteNumber(progress?.durationMs) ?? 0);
  }, 0);
}

function resultFailed(result: JsonObject): boolean {
  const exitCode = finiteNumber(result.exitCode);
  return (exitCode !== null && exitCode !== 0)
    || typeof result.error === 'string'
    || result.timedOut === true
    || result.stopped === true;
}

export function lessonReviewStart(
  id: string,
  args: unknown,
  at: string,
): LessonReviewConversationItem | null {
  if (reviewerTaskCount(args) === 0) return null;
  return {
    id,
    kind: 'lesson-review',
    status: 'running',
    elapsedMs: 0,
    at,
    updatedAt: at,
  };
}

export function lessonReviewEnd(
  id: string,
  result: unknown,
  isError: boolean,
  at: string,
  started?: LessonReviewConversationItem,
): LessonReviewConversationItem | null {
  const results = reviewerResults(result);
  if (!started && results.length === 0) return null;
  return {
    id,
    kind: 'lesson-review',
    status: isError || results.some(resultFailed) ? 'error' : 'done',
    elapsedMs: started
      ? elapsedBetween(started.at, at)
      : resultDuration(results),
    at: started?.at ?? at,
    updatedAt: at,
  };
}

export function mergeLessonReviewItem(
  existing: LessonReviewConversationItem,
  incoming: LessonReviewConversationItem,
): LessonReviewConversationItem {
  return {
    ...incoming,
    elapsedMs: Math.max(
      existing.elapsedMs,
      incoming.elapsedMs,
      elapsedBetween(existing.at, incoming.updatedAt),
    ),
    at: existing.at,
  };
}
