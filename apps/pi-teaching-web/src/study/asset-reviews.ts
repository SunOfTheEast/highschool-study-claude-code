import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  AssetReviewProjection,
  LearningAssetHandle,
  ReviewEnrollmentTrigger,
  ReviewEvent,
  ReviewEvidence,
  ReviewResult,
} from '../shared/contracts';
import { resolveDocumentPath } from '../runtime/atomic-document';
import {
  commitDocumentCandidates,
  type DocumentCandidate,
} from '../runtime/multi-document-transaction';
import { StudyDocumentError } from './markdown';
import { isProblemCardId } from './problem-card-id';

export const ASSET_REVIEW_POLICY = 'fixed-ladder-v1' as const;
export const ASSET_REVIEW_INTERVAL_DAYS = [1, 3, 7, 14, 30, 60, 120] as const;
export const ASSET_REVIEW_INDEX_PATH = 'activity/asset-reviews/index.tsv';

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const eventIdPattern = /^event-([0-9]+)$/;
const localDatePattern = /^\d{4}-\d{2}-\d{2}$/;

export function localDateAt(value: string | Date): string {
  const date = typeof value === 'string' ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) throw new Error('event time is invalid');
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export type AssetReviewEventDraft =
  | {
    kind: 'enrolled';
    assetRevision: number;
    trigger: ReviewEnrollmentTrigger;
  }
  | {
    kind: 'reviewed';
    assetRevision: number;
    result: ReviewResult;
    evidence: ReviewEvidence;
  }
  | {
    kind: 'corrected';
    targetEventId: string;
    replacementResult: ReviewResult | null;
  }
  | { kind: 'removed' }
  | { kind: 'restarted'; assetRevision: number };

export type AssetReviewRecordInput = {
  requestId: string;
  at: string;
  localDate: string;
  event: AssetReviewEventDraft;
};

export type AssetReviewHistory = {
  asset: LearningAssetHandle;
  events: ReviewEvent[];
  projection: AssetReviewProjection | null;
};

export type PlannedAssetReviewEvent = {
  candidates: DocumentCandidate[];
  event: ReviewEvent;
  projection: AssetReviewProjection;
  replayed: boolean;
};

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label} must be non-empty`);
  }
  return value.trim();
}

function checkedId(value: unknown, label: string): string {
  const text = requiredText(value, label);
  if (!stableIdPattern.test(text)) throw new Error(`${label} is invalid`);
  return text;
}

function checkedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error('asset revision must be a positive integer');
  }
  return Number(value);
}

function checkedTime(value: unknown): string {
  const text = requiredText(value, 'event time');
  if (Number.isNaN(Date.parse(text))) throw new Error('event time is invalid');
  return text;
}

function checkedLocalDate(value: unknown): string {
  const text = requiredText(value, 'local date');
  if (!localDatePattern.test(text)) throw new Error('local date is invalid');
  const parsed = new Date(`${text}T12:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new Error('local date is invalid');
  }
  return text;
}

function checkedResult(value: unknown, nullable = false): ReviewResult | null {
  if (nullable && value === null) return null;
  if (value === 'forgot' || value === 'effortful' || value === 'fluent') return value;
  throw new Error('review result is invalid');
}

function checkedAsset(asset: LearningAssetHandle): LearningAssetHandle {
  if (asset.kind !== 'note' && asset.kind !== 'problem-card') {
    throw new Error('asset kind is invalid');
  }
  const id = requiredText(asset.id, 'asset id');
  const valid = asset.kind === 'problem-card' ? isProblemCardId(id) : stableIdPattern.test(id);
  if (!valid) throw new Error('asset id is invalid');
  return { kind: asset.kind, id };
}

function checkedTrigger(value: unknown, asset: LearningAssetHandle): ReviewEnrollmentTrigger {
  const trigger = record(value);
  if (trigger?.kind === 'asset-saved' || trigger?.kind === 'manual') {
    return { kind: trigger.kind };
  }
  if (trigger?.kind === 'first-attempt' || trigger?.kind === 'historical-attempt') {
    if (asset.kind !== 'problem-card') throw new Error('attempt enrollment requires a problem card');
    return {
      kind: trigger.kind,
      problemAttemptId: checkedId(trigger.problem_attempt_id ?? trigger.problemAttemptId, 'attempt id'),
    };
  }
  throw new Error('review enrollment trigger is invalid');
}

function checkedEvidence(value: unknown, asset: LearningAssetHandle): ReviewEvidence {
  const evidence = record(value);
  if (evidence?.kind === 'self-report') {
    const attempt = Object.prototype.hasOwnProperty.call(evidence, 'problem_attempt_id')
      ? evidence.problem_attempt_id
      : evidence.problemAttemptId;
    if (asset.kind === 'problem-card' && attempt === null) {
      throw new Error('problem-card self-report requires an attempt');
    }
    if (asset.kind === 'note' && attempt !== null) {
      throw new Error('note self-report cannot reference a problem attempt');
    }
    return {
      kind: 'self-report',
      problemAttemptId: attempt === null ? null : checkedId(attempt, 'attempt id'),
    };
  }
  if (evidence?.kind === 'session') {
    const sessionKey = requiredText(evidence.session_key ?? evidence.sessionKey, 'session key');
    if (!sessionKey.startsWith('free:') && !sessionKey.startsWith('lesson:')) {
      throw new Error('review session key is invalid');
    }
    return {
      kind: 'session',
      sessionKey: sessionKey as `free:${string}` | `lesson:${string}`,
    };
  }
  throw new Error('review evidence is invalid');
}

function eventPath(asset: LearningAssetHandle): string {
  const checked = checkedAsset(asset);
  const directory = checked.kind === 'note' ? 'notes' : 'problem-cards';
  return `activity/asset-reviews/${directory}/${checked.id}.md`;
}

function header(asset: LearningAssetHandle): string {
  return `# Asset Review: ${asset.kind}:${asset.id}`;
}

function eventFromValue(
  headingId: string,
  value: unknown,
  asset: LearningAssetHandle,
): ReviewEvent {
  const item = record(value);
  if (!item || item.schema !== 'studyforge.asset-review-event.v1') {
    throw new Error('asset review event schema is invalid');
  }
  const eventId = checkedId(item.event_id, 'event id');
  if (eventId !== headingId || !eventIdPattern.test(eventId)) {
    throw new Error(`asset review event heading mismatch: ${headingId}`);
  }
  const common = {
    eventId,
    requestId: checkedId(item.request_id, 'request id'),
    at: checkedTime(item.at),
    localDate: checkedLocalDate(item.local_date),
  };
  if (item.kind === 'enrolled') {
    if (item.policy !== ASSET_REVIEW_POLICY) throw new Error('ASSET_REVIEW_POLICY_UNSUPPORTED');
    return {
      ...common,
      kind: 'enrolled',
      assetRevision: checkedRevision(item.asset_revision),
      trigger: checkedTrigger(item.trigger, asset),
      policy: ASSET_REVIEW_POLICY,
    };
  }
  if (item.kind === 'reviewed') {
    return {
      ...common,
      kind: 'reviewed',
      assetRevision: checkedRevision(item.asset_revision),
      result: checkedResult(item.result)!,
      evidence: checkedEvidence(item.evidence, asset),
    };
  }
  if (item.kind === 'corrected') {
    return {
      ...common,
      kind: 'corrected',
      targetEventId: checkedId(item.target_event_id, 'target event id'),
      replacementResult: checkedResult(item.replacement_result, true),
    };
  }
  if (item.kind === 'removed') return { ...common, kind: 'removed' };
  if (item.kind === 'restarted') {
    if (item.policy !== ASSET_REVIEW_POLICY) throw new Error('ASSET_REVIEW_POLICY_UNSUPPORTED');
    return {
      ...common,
      kind: 'restarted',
      assetRevision: checkedRevision(item.asset_revision),
      policy: ASSET_REVIEW_POLICY,
    };
  }
  throw new Error('asset review event kind is invalid');
}

function eventValue(event: ReviewEvent): Record<string, unknown> {
  const common = {
    schema: 'studyforge.asset-review-event.v1',
    kind: event.kind,
    event_id: event.eventId,
    request_id: event.requestId,
    at: event.at,
    local_date: event.localDate,
  };
  if (event.kind === 'enrolled') {
    return {
      ...common,
      asset_revision: event.assetRevision,
      trigger: event.trigger.kind === 'first-attempt' || event.trigger.kind === 'historical-attempt'
        ? { kind: event.trigger.kind, problem_attempt_id: event.trigger.problemAttemptId }
        : { kind: event.trigger.kind },
      policy: event.policy,
    };
  }
  if (event.kind === 'reviewed') {
    return {
      ...common,
      asset_revision: event.assetRevision,
      result: event.result,
      evidence: event.evidence.kind === 'self-report'
        ? { kind: 'self-report', problem_attempt_id: event.evidence.problemAttemptId }
        : { kind: 'session', session_key: event.evidence.sessionKey },
    };
  }
  if (event.kind === 'corrected') {
    return {
      ...common,
      target_event_id: event.targetEventId,
      replacement_result: event.replacementResult,
    };
  }
  if (event.kind === 'restarted') {
    return { ...common, asset_revision: event.assetRevision, policy: event.policy };
  }
  return common;
}

function renderEvent(event: ReviewEvent): string {
  return [
    `## ${event.eventId}`,
    '',
    '```yaml',
    stringifyYaml(eventValue(event), { lineWidth: 0 }).trimEnd(),
    '```',
  ].join('\n');
}

function renderSource(asset: LearningAssetHandle, events: readonly ReviewEvent[]): string {
  return events.length === 0
    ? `${header(asset)}\n`
    : `${header(asset)}\n\n${events.map(renderEvent).join('\n\n')}\n`;
}

export function parseAssetReviewSource(
  path: string,
  source: string,
  asset: LearningAssetHandle,
): ReviewEvent[] {
  const checked = checkedAsset(asset);
  if (!source.startsWith(`${header(checked)}\n`)) {
    throw new StudyDocumentError(path, `expected header ${header(checked)}`);
  }
  const tail = source.slice(header(checked).length).trim();
  if (!tail) return [];
  const chunks = tail.split(/\n(?=## event-[0-9]+\n)/);
  const events = chunks.map((chunk) => {
    const match = /^## (event-[0-9]+)\n\n```yaml\n([\s\S]*?)\n```$/.exec(chunk.trim());
    if (!match) throw new StudyDocumentError(path, 'invalid asset review event block');
    try {
      return eventFromValue(match[1]!, parseYaml(match[2]!), checked);
    } catch (error) {
      throw new StudyDocumentError(
        path,
        error instanceof Error ? error.message : 'invalid asset review event',
      );
    }
  });
  const requestIds = new Set<string>();
  const reviewed = new Set<string>();
  events.forEach((event, index) => {
    const expected = `event-${String(index + 1).padStart(3, '0')}`;
    if (event.eventId !== expected) throw new StudyDocumentError(path, `expected event ID ${expected}`);
    if (requestIds.has(event.requestId)) {
      throw new StudyDocumentError(path, `duplicate request ID ${event.requestId}`);
    }
    requestIds.add(event.requestId);
    if (event.kind === 'reviewed') reviewed.add(event.eventId);
    if (event.kind === 'corrected' && !reviewed.has(event.targetEventId)) {
      throw new StudyDocumentError(path, `correction references missing review ${event.targetEventId}`);
    }
  });
  replayAssetReview(checked, events);
  return events;
}

function addDays(localDate: string, days: number): string {
  const value = new Date(`${localDate}T12:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

export function replayAssetReview(
  asset: LearningAssetHandle,
  events: readonly ReviewEvent[],
): AssetReviewProjection | null {
  const checked = checkedAsset(asset);
  if (events.length === 0) return null;
  const corrections = new Map<string, ReviewResult | null>();
  for (const event of events) {
    if (event.kind === 'corrected') corrections.set(event.targetEventId, event.replacementResult);
  }
  let projection: AssetReviewProjection | null = null;
  const effectiveDates = new Set<string>();
  for (const event of events) {
    if (event.kind === 'enrolled') {
      if (event.policy !== ASSET_REVIEW_POLICY) throw new Error('ASSET_REVIEW_POLICY_UNSUPPORTED');
      if (projection?.active) throw new Error('ASSET_REVIEW_ALREADY_ACTIVE');
      projection = {
        asset: checked, active: true, stage: 0,
        dueOn: addDays(event.localDate, ASSET_REVIEW_INTERVAL_DAYS[0]), lastResult: null,
      };
      continue;
    }
    if (!projection) throw new Error('ASSET_REVIEW_NOT_ENROLLED');
    if (event.kind === 'reviewed') {
      if (!projection.active) throw new Error('ASSET_REVIEW_NOT_ACTIVE');
      const result = corrections.has(event.eventId)
        ? corrections.get(event.eventId)!
        : event.result;
      if (result === null) continue;
      if (effectiveDates.has(event.localDate)) {
        throw new Error('ASSET_REVIEW_ALREADY_RECORDED_TODAY');
      }
      effectiveDates.add(event.localDate);
      const stage: number = result === 'fluent'
        ? Math.min(6, projection.stage + 1)
        : result === 'effortful'
          ? Math.max(0, projection.stage - 1)
          : 0;
      projection = {
        ...projection,
        stage: stage as AssetReviewProjection['stage'],
        dueOn: addDays(event.localDate, ASSET_REVIEW_INTERVAL_DAYS[stage]!),
        lastResult: result,
      };
      continue;
    }
    if (event.kind === 'removed') {
      if (!projection.active) throw new Error('ASSET_REVIEW_NOT_ACTIVE');
      projection = { ...projection, active: false, dueOn: null };
      continue;
    }
    if (event.kind === 'restarted') {
      if (event.policy !== ASSET_REVIEW_POLICY) throw new Error('ASSET_REVIEW_POLICY_UNSUPPORTED');
      if (!projection.active) throw new Error('ASSET_REVIEW_NOT_ACTIVE');
      projection = {
        ...projection, active: true, stage: 0,
        dueOn: addDays(event.localDate, ASSET_REVIEW_INTERVAL_DAYS[0]), lastResult: null,
      };
    }
  }
  return projection;
}

function readHistoryFile(root: string, asset: LearningAssetHandle): {
  path: string;
  before: string | null;
  events: ReviewEvent[];
} {
  const path = eventPath(asset);
  const absolute = resolveDocumentPath(root, path);
  if (!existsSync(absolute)) return { path, before: null, events: [] };
  if (lstatSync(absolute).isSymbolicLink()) {
    throw new StudyDocumentError(path, 'asset review path cannot be a symbolic link');
  }
  const before = readFileSync(absolute, 'utf8');
  return { path, before, events: parseAssetReviewSource(path, before, asset) };
}

export function readAssetReviewHistory(
  root: string,
  asset: LearningAssetHandle,
): AssetReviewHistory {
  const checked = checkedAsset(asset);
  const events = readHistoryFile(root, checked).events;
  return { asset: checked, events, projection: replayAssetReview(checked, events) };
}

export function listAssetReviewHistories(root: string): AssetReviewHistory[] {
  const histories: AssetReviewHistory[] = [];
  for (const [kind, name] of [['note', 'notes'], ['problem-card', 'problem-cards']] as const) {
    const directoryPath = `activity/asset-reviews/${name}`;
    const directory = resolveDocumentPath(root, directoryPath);
    if (!existsSync(directory)) continue;
    if (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory()) {
      throw new StudyDocumentError(directoryPath, 'asset review directory must be a real directory');
    }
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = `${directoryPath}/${entry.name}`;
      if (entry.isSymbolicLink()) throw new StudyDocumentError(path, 'asset review path cannot be a symbolic link');
      if (!entry.isFile() || !entry.name.endsWith('.md')) continue;
      const asset = checkedAsset({ kind, id: entry.name.slice(0, -3) });
      histories.push(readAssetReviewHistory(root, asset));
    }
  }
  return histories.sort((left, right) => (
    left.asset.kind.localeCompare(right.asset.kind) || left.asset.id.localeCompare(right.asset.id)
  ));
}

export function canonicalAssetReviewIndex(projections: readonly AssetReviewProjection[]): string {
  const rows = [...projections].sort((left, right) => (
    left.asset.kind.localeCompare(right.asset.kind) || left.asset.id.localeCompare(right.asset.id)
  )).map((projection) => [
    projection.asset.kind,
    projection.asset.id,
    String(projection.active),
    String(projection.stage),
    projection.dueOn ?? '-',
    projection.lastResult ?? '-',
  ].join('\t'));
  return ['kind\tid\tactive\tstage\tdue_on\tlast_result', ...rows, ''].join('\n');
}

function plannedIndexCandidate(
  root: string,
  projections: readonly AssetReviewProjection[],
): DocumentCandidate | null {
  const absolute = resolveDocumentPath(root, ASSET_REVIEW_INDEX_PATH);
  const before = existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
  const after = canonicalAssetReviewIndex(projections);
  if (before === after) return null;
  return {
    path: ASSET_REVIEW_INDEX_PATH,
    before,
    after,
    validate: (source) => {
      if (source !== after) throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'index changed');
    },
  };
}

function sameEventDraft(event: ReviewEvent, draft: AssetReviewEventDraft): boolean {
  if (event.kind !== draft.kind) return false;
  if (event.kind === 'enrolled' && draft.kind === 'enrolled') {
    return event.assetRevision === draft.assetRevision
      && JSON.stringify(event.trigger) === JSON.stringify(draft.trigger);
  }
  if (event.kind === 'reviewed' && draft.kind === 'reviewed') {
    return event.assetRevision === draft.assetRevision
      && event.result === draft.result
      && JSON.stringify(event.evidence) === JSON.stringify(draft.evidence);
  }
  if (event.kind === 'corrected' && draft.kind === 'corrected') {
    return event.targetEventId === draft.targetEventId
      && event.replacementResult === draft.replacementResult;
  }
  if (event.kind === 'restarted' && draft.kind === 'restarted') {
    return event.assetRevision === draft.assetRevision;
  }
  return event.kind === 'removed' && draft.kind === 'removed';
}

function checkedDraft(asset: LearningAssetHandle, draft: AssetReviewEventDraft): AssetReviewEventDraft {
  if (draft.kind === 'enrolled') {
    return {
      kind: 'enrolled', assetRevision: checkedRevision(draft.assetRevision),
      trigger: checkedTrigger(draft.trigger, asset),
    };
  }
  if (draft.kind === 'reviewed') {
    return {
      kind: 'reviewed', assetRevision: checkedRevision(draft.assetRevision),
      result: checkedResult(draft.result)!, evidence: checkedEvidence(draft.evidence, asset),
    };
  }
  if (draft.kind === 'corrected') {
    return {
      kind: 'corrected', targetEventId: checkedId(draft.targetEventId, 'target event id'),
      replacementResult: checkedResult(draft.replacementResult, true),
    };
  }
  if (draft.kind === 'restarted') {
    return { kind: 'restarted', assetRevision: checkedRevision(draft.assetRevision) };
  }
  return { kind: 'removed' };
}

function makeEvent(
  eventId: string,
  input: Omit<AssetReviewRecordInput, 'event'>,
  draft: AssetReviewEventDraft,
): ReviewEvent {
  const common = {
    eventId,
    requestId: checkedId(input.requestId, 'request id'),
    at: checkedTime(input.at),
    localDate: checkedLocalDate(input.localDate),
  };
  if (draft.kind === 'enrolled') return { ...common, ...draft, policy: ASSET_REVIEW_POLICY };
  if (draft.kind === 'restarted') return { ...common, ...draft, policy: ASSET_REVIEW_POLICY };
  return { ...common, ...draft };
}

export function planAssetReviewEvent(
  root: string,
  asset: LearningAssetHandle,
  input: AssetReviewRecordInput,
): PlannedAssetReviewEvent {
  const checked = checkedAsset(asset);
  const current = readHistoryFile(root, checked);
  const draft = checkedDraft(checked, input.event);
  const prior = current.events.find((event) => event.requestId === checkedId(input.requestId, 'request id'));
  let event: ReviewEvent;
  let replayed = false;
  let events = current.events;
  let logCandidate: DocumentCandidate | null = null;
  if (prior) {
    if (!sameEventDraft(prior, draft)) throw new Error(`REQUEST_ID_CONFLICT: ${input.requestId}`);
    event = prior;
    replayed = true;
  } else {
    event = makeEvent(
      `event-${String(current.events.length + 1).padStart(3, '0')}`,
      input,
      draft,
    );
    events = [...current.events, event];
    replayAssetReview(checked, events);
    const after = renderSource(checked, events);
    logCandidate = {
      path: current.path,
      before: current.before,
      after,
      validate: (source) => { parseAssetReviewSource(current.path, source, checked); },
    };
  }
  const projection = replayAssetReview(checked, events);
  if (!projection) throw new Error('ASSET_REVIEW_NOT_ENROLLED');
  const projections = listAssetReviewHistories(root).flatMap((history) => (
    history.projection && (
      history.asset.kind !== checked.kind || history.asset.id !== checked.id
    ) ? [history.projection] : []
  ));
  projections.push(projection);
  const indexCandidate = plannedIndexCandidate(root, projections);
  return {
    candidates: [...(logCandidate ? [logCandidate] : []), ...(indexCandidate ? [indexCandidate] : [])],
    event,
    projection,
    replayed,
  };
}

export function recordAssetReviewEvent(
  root: string,
  asset: LearningAssetHandle,
  input: AssetReviewRecordInput,
): Omit<PlannedAssetReviewEvent, 'candidates'> {
  const planned = planAssetReviewEvent(root, asset, input);
  if (planned.candidates.length > 0) commitDocumentCandidates(root, planned.candidates);
  return {
    event: planned.event,
    projection: planned.projection,
    replayed: planned.replayed,
  };
}
