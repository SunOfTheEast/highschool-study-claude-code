import { existsSync, lstatSync, readFileSync, readdirSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  LearningContextReference,
  ProblemActivityEvent,
  ProblemActivitySnapshot,
  ProblemAnswerRevealEvent,
  ProblemAttemptEvent,
  ProblemAttemptResponse,
} from '../shared/contracts';
import { resolveDocumentPath } from '../runtime/atomic-document';
import { commitDocumentCandidates } from '../runtime/multi-document-transaction';
import { readProblemCard } from './learning-assets';
import { StudyDocumentError } from './markdown';
import { isProblemCardId } from './problem-card-id';

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const eventIdPattern = /^event-([0-9]+)$/;

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

function checkedStableId(value: unknown, label: string): string {
  const text = requiredText(value, label);
  if (!stableIdPattern.test(text)) throw new Error(`${label} is invalid`);
  return text;
}

function checkedProblemCardId(value: unknown): string {
  const text = requiredText(value, 'card id');
  if (!isProblemCardId(text)) throw new Error('card id is invalid');
  return text;
}

function checkedTime(value: unknown): string {
  const text = requiredText(value, 'event time');
  if (Number.isNaN(Date.parse(text))) throw new Error('event time is invalid');
  return text;
}

function checkedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error('card revision must be a positive integer');
  }
  return Number(value);
}

function checkedResponse(value: unknown): ProblemAttemptResponse {
  const response = record(value);
  if (response?.kind === 'cannot') return { kind: 'cannot' };
  if (response?.kind === 'answer') {
    return { kind: 'answer', text: requiredText(response.text, 'student response') };
  }
  throw new Error('attempt response is invalid');
}

function eventFromValue(
  headingId: string,
  value: unknown,
  expectedCardId: string,
): ProblemActivityEvent {
  const event = record(value);
  if (!event || event.schema !== 'studyforge.problem-activity-event.v1') {
    throw new Error('activity event schema is invalid');
  }
  const id = checkedStableId(event.event_id, 'event id');
  if (id !== headingId || !eventIdPattern.test(id)) {
    throw new Error(`activity event heading mismatch: ${headingId}`);
  }
  const cardId = checkedProblemCardId(event.card_id);
  if (cardId !== expectedCardId) throw new Error(`activity card mismatch: ${cardId}`);
  const common = {
    id,
    requestId: checkedStableId(event.request_id, 'request id'),
    at: checkedTime(event.at),
    cardId,
    cardRevision: checkedRevision(event.card_revision),
  };
  if (event.kind === 'attempt') {
    if (typeof event.answer_viewed_before !== 'boolean') {
      throw new Error('answer_viewed_before must be boolean');
    }
    return {
      kind: 'attempt',
      ...common,
      answerViewedBefore: event.answer_viewed_before,
      response: checkedResponse(event.response),
    };
  }
  if (event.kind === 'answer-reveal') {
    const attemptId = checkedStableId(event.attempt_id, 'attempt id');
    if (!eventIdPattern.test(attemptId)) throw new Error('attempt id is invalid');
    return { kind: 'answer-reveal', ...common, attemptId };
  }
  throw new Error('activity event kind is invalid');
}

function activityPath(cardId: string): string {
  if (!isProblemCardId(cardId)) throw new Error(`PROBLEM_CARD_ID_INVALID: ${cardId}`);
  return `activity/problem-attempts/${cardId}.md`;
}

function parseActivitySource(path: string, source: string, cardId: string): ProblemActivityEvent[] {
  const header = `# Problem Activity: ${cardId}`;
  if (!source.startsWith(`${header}\n`)) {
    throw new StudyDocumentError(path, `expected header ${header}`);
  }
  const tail = source.slice(header.length).trim();
  if (!tail) return [];
  const chunks = tail.split(/\n(?=## event-[0-9]+\n)/);
  const events = chunks.map((chunk) => {
    const match = /^## (event-[0-9]+)\n\n```yaml\n([\s\S]*?)\n```$/.exec(chunk.trim());
    if (!match) throw new StudyDocumentError(path, 'invalid activity event block');
    let value: unknown;
    try {
      value = parseYaml(match[2]!);
    } catch (error) {
      throw new StudyDocumentError(
        path,
        error instanceof Error ? error.message : 'invalid activity event YAML',
      );
    }
    return eventFromValue(match[1]!, value, cardId);
  });
  const requestIds = new Set<string>();
  const attempts = new Set<string>();
  events.forEach((event, index) => {
    const expectedId = `event-${String(index + 1).padStart(3, '0')}`;
    if (event.id !== expectedId) throw new StudyDocumentError(path, `expected event ID ${expectedId}`);
    if (requestIds.has(event.requestId)) {
      throw new StudyDocumentError(path, `duplicate request ID ${event.requestId}`);
    }
    requestIds.add(event.requestId);
    if (event.kind === 'attempt') attempts.add(event.id);
    else if (!attempts.has(event.attemptId)) {
      throw new StudyDocumentError(path, `reveal references missing attempt ${event.attemptId}`);
    }
  });
  return events;
}

function eventValue(event: ProblemActivityEvent): Record<string, unknown> {
  const common = {
    schema: 'studyforge.problem-activity-event.v1',
    kind: event.kind,
    event_id: event.id,
    request_id: event.requestId,
    at: event.at,
    card_id: event.cardId,
    card_revision: event.cardRevision,
  };
  return event.kind === 'attempt'
    ? {
      ...common,
      answer_viewed_before: event.answerViewedBefore,
      response: event.response,
    }
    : { ...common, attempt_id: event.attemptId };
}

function renderEvent(event: ProblemActivityEvent): string {
  return [
    `## ${event.id}`,
    '',
    '```yaml',
    stringifyYaml(eventValue(event), { lineWidth: 0 }).trimEnd(),
    '```',
  ].join('\n');
}

function renderSource(cardId: string, events: readonly ProblemActivityEvent[]): string {
  const header = `# Problem Activity: ${cardId}`;
  return events.length === 0
    ? `${header}\n`
    : `${header}\n\n${events.map(renderEvent).join('\n\n')}\n`;
}

function readActivity(root: string, cardId: string): {
  path: string;
  before: string | null;
  events: ProblemActivityEvent[];
} {
  const path = activityPath(cardId);
  const absolute = resolveDocumentPath(root, path);
  if (!existsSync(absolute)) return { path, before: null, events: [] };
  if (lstatSync(absolute).isSymbolicLink()) {
    throw new StudyDocumentError(path, 'activity path cannot be a symbolic link');
  }
  const before = readFileSync(absolute, 'utf8');
  return { path, before, events: parseActivitySource(path, before, cardId) };
}

function snapshot(cardId: string, events: ProblemActivityEvent[]): ProblemActivitySnapshot {
  const latestAttempt = [...events].reverse().find(
    (event): event is ProblemAttemptEvent => event.kind === 'attempt',
  ) ?? null;
  const answerRevealedForLatestAttempt = latestAttempt !== null && events.some((event) => (
    event.kind === 'answer-reveal' && event.attemptId === latestAttempt.id
  ));
  return { cardId, events, latestAttempt, answerRevealedForLatestAttempt };
}

export function readProblemActivity(root: string, cardId: string): ProblemActivitySnapshot {
  const card = readProblemCard(root, cardId);
  return snapshot(card.id, readActivity(root, card.id).events);
}

export function listProblemActivities(root: string): ProblemActivitySnapshot[] {
  const directoryPath = 'activity/problem-attempts';
  const directory = resolveDocumentPath(root, directoryPath);
  if (!existsSync(directory)) return [];
  if (lstatSync(directory).isSymbolicLink() || !lstatSync(directory).isDirectory()) {
    throw new StudyDocumentError(directoryPath, 'activity directory must be a real directory');
  }
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (entry.isSymbolicLink()) {
      throw new StudyDocumentError(`${directoryPath}/${entry.name}`, 'activity path cannot be a symbolic link');
    }
    if (!entry.isFile() || !entry.name.endsWith('.md')) return [];
    const cardId = entry.name.slice(0, -3);
    if (!isProblemCardId(cardId)) return [];
    const source = readFileSync(resolveDocumentPath(root, `${directoryPath}/${entry.name}`), 'utf8');
    return [snapshot(cardId, parseActivitySource(activityPath(cardId), source, cardId))];
  }).sort((left, right) => left.cardId.localeCompare(right.cardId));
}

function appendEvent(root: string, event: ProblemActivityEvent): void {
  const current = readActivity(root, event.cardId);
  const events = [...current.events, event];
  const after = renderSource(event.cardId, events);
  commitDocumentCandidates(root, [{
    path: current.path,
    before: current.before,
    after,
    validate: (source) => { parseActivitySource(current.path, source, event.cardId); },
  }]);
}

function existingRequest(
  events: readonly ProblemActivityEvent[],
  requestId: string,
): ProblemActivityEvent | null {
  return events.find((event) => event.requestId === requestId) ?? null;
}

function sameResponse(left: ProblemAttemptResponse, right: ProblemAttemptResponse): boolean {
  return left.kind === right.kind
    && (left.kind === 'cannot' || (right.kind === 'answer' && left.text === right.text));
}

export function recordProblemAttempt(
  root: string,
  cardId: string,
  response: ProblemAttemptResponse,
  requestId: string,
  recordedAt = new Date().toISOString(),
): ProblemAttemptEvent {
  const card = readProblemCard(root, cardId);
  const checkedRequestId = checkedStableId(requestId, 'request id');
  const checkedRecordedAt = checkedTime(recordedAt);
  const checked = checkedResponse(response);
  const current = readActivity(root, card.id);
  const prior = existingRequest(current.events, checkedRequestId);
  if (prior) {
    if (
      prior.kind === 'attempt'
      && prior.cardRevision === card.revision
      && sameResponse(prior.response, checked)
    ) return prior;
    throw new Error(`REQUEST_ID_CONFLICT: ${checkedRequestId}`);
  }
  const answerViewedBefore = current.events.some((event) => (
    event.kind === 'answer-reveal' && event.cardRevision === card.revision
  ));
  const event: ProblemAttemptEvent = {
    kind: 'attempt',
    id: `event-${String(current.events.length + 1).padStart(3, '0')}`,
    requestId: checkedRequestId,
    at: checkedRecordedAt,
    cardId: card.id,
    cardRevision: card.revision,
    answerViewedBefore,
    response: checked,
  };
  appendEvent(root, event);
  return event;
}

export function revealProblemAnswer(
  root: string,
  cardId: string,
  requestId: string,
  recordedAt = new Date().toISOString(),
): { event: ProblemAnswerRevealEvent; standardAnswer: string } {
  const card = readProblemCard(root, cardId);
  const checkedRequestId = checkedStableId(requestId, 'request id');
  const checkedRecordedAt = checkedTime(recordedAt);
  const current = readActivity(root, card.id);
  const prior = existingRequest(current.events, checkedRequestId);
  if (prior) {
    if (prior.kind === 'answer-reveal' && prior.cardRevision === card.revision) {
      return { event: prior, standardAnswer: card.standardAnswer };
    }
    throw new Error(`REQUEST_ID_CONFLICT: ${checkedRequestId}`);
  }
  const latestAttempt = [...current.events].reverse().find(
    (event): event is ProblemAttemptEvent => event.kind === 'attempt',
  );
  if (!latestAttempt) throw new Error(`ANSWER_REVEAL_REQUIRES_ATTEMPT: ${card.id}`);
  if (latestAttempt.cardRevision !== card.revision) {
    throw new Error(`CARD_REVISION_CHANGED_SINCE_ATTEMPT: ${card.id}`);
  }
  const event: ProblemAnswerRevealEvent = {
    kind: 'answer-reveal',
    id: `event-${String(current.events.length + 1).padStart(3, '0')}`,
    requestId: checkedRequestId,
    at: checkedRecordedAt,
    cardId: card.id,
    cardRevision: card.revision,
    attemptId: latestAttempt.id,
  };
  appendEvent(root, event);
  return { event, standardAnswer: card.standardAnswer };
}

export function renderSelectedProblemActivityContext(
  root: string,
  references: readonly LearningContextReference[],
): string {
  const sections = references.flatMap((reference, index) => {
    if (reference.kind !== 'problem-card') return [];
    const activity = readProblemActivity(root, reference.id);
    if (!activity.latestAttempt) return [];
    return [[
      `## source-${index + 1} · recent problem activity`,
      '',
      stringifyYaml({
        card_id: reference.id,
        card_revision: activity.latestAttempt.cardRevision,
        latest_attempt: activity.latestAttempt.response,
        attempted_at: activity.latestAttempt.at,
        answer_revealed_for_latest_attempt: activity.answerRevealedForLatestAttempt,
      }, { lineWidth: 0 }).trim(),
    ].join('\n')];
  });
  return sections.length === 0
    ? ''
    : ['# Selected Problem Activity', '', ...sections].join('\n\n');
}
