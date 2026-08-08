import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
} from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { resolveDocumentPath } from '../runtime/atomic-document';
import type { DocumentCandidate } from '../runtime/multi-document-transaction';
import { appendClosingClassroomLogSource } from './lesson-mutations';
import { parseLessonSource, StudyDocumentError } from './markdown';

export type { DocumentCandidate } from '../runtime/multi-document-transaction';

export type ExistingOrNew =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; key: string; title: string };

export type ObjectLearningHistoryEntry = {
  change: string;
  evidenceBlockIds: string[];
};

export type BucketRef =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; key: string; title: string };

export type RoutingDecision =
  | { kind: 'keep' }
  | { kind: 'assign'; buckets: BucketRef[] }
  | { kind: 'defer'; reason: string };

export type ObjectMutation = {
  target: ExistingOrNew;
  currentJudgment: string;
  evolutionOverview: string;
  boundaries: string[];
  learningHistoryEntry: ObjectLearningHistoryEntry;
  routing: RoutingDecision;
  frontierSummary?: string;
};

export type PreferenceMutation = {
  target: ExistingOrNew;
  currentJudgment: string;
  scope: string[];
  explicitStatements: Array<{ text: string; evidenceBlockId: string }>;
  evolutionEntry: string;
  cue: { kind: 'keep' } | { kind: 'upsert'; summary: string } | { kind: 'remove' };
};

export type LessonMemoryCommitDraft = {
  closingFact?: { blockId: string; note: string };
  objects: ObjectMutation[];
  preferences: PreferenceMutation[];
};

export type FreeLearningObjectMutation = {
  target: ExistingOrNew;
  learningHistoryChange: string;
  currentJudgment?: string;
  evolutionOverview?: string;
  boundaries?: string[];
  routing: RoutingDecision;
  frontierSummary?: string;
};

export type FreeLearningMemoryCommitDraft = {
  objects: FreeLearningObjectMutation[];
};

type SectionSpan = {
  contentStart: number;
  contentEnd: number;
};

type ResolvedObject = {
  mutation: ObjectMutation;
  id: string;
  title: string;
  path: string;
  before: string | null;
};

type ResolvedBucket = {
  id: string;
  title: string;
  path: string;
  before: string | null;
};

type ResolvedPreference = {
  mutation: PreferenceMutation;
  id: string;
  title: string;
  path: string;
  before: string | null;
};

const stableIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const localKeyPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function requireText(value: string, label: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} must be non-empty`);
  return normalized;
}

function requireOneLine(value: string, label: string): string {
  const normalized = requireText(value, label);
  if (/\r|\n/.test(normalized)) throw new Error(`${label} must be one line`);
  return normalized;
}

function requireLocalKey(value: string, label: string): string {
  if (!localKeyPattern.test(value)) throw new Error(`invalid ${label}: ${value}`);
  return value;
}

function requireStableId(value: string, kind: 'object' | 'bucket' | 'preference'): string {
  const prefix = kind === 'object' ? 'obj-' : kind === 'preference' ? 'pref-' : '';
  if (!stableIdPattern.test(value) || (prefix && !value.startsWith(prefix))) {
    throw new Error(`invalid ${kind} id: ${value}`);
  }
  return value;
}

function canonicalPath(root: string, path: string, mustExist: boolean): string {
  const absolute = resolveDocumentPath(root, path);
  const canonical = relative(resolve(root), absolute).split(sep).join('/');
  if (canonical !== path) {
    throw new StudyDocumentError(path, 'path must be canonical learning-set-relative');
  }
  let current = resolve(root);
  for (const segment of canonical.split('/')) {
    current = join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new StudyDocumentError(path, 'path cannot contain a symbolic link');
    }
  }
  if (mustExist && !existsSync(absolute)) {
    throw new StudyDocumentError(path, 'document does not exist');
  }
  return absolute;
}

function readRequired(root: string, path: string): string {
  return readFileSync(canonicalPath(root, path, true), 'utf8');
}

function ensureNewPath(root: string, path: string): void {
  const absolute = canonicalPath(root, path, false);
  if (existsSync(absolute)) throw new StudyDocumentError(path, 'document already exists');
}

function sectionSpan(source: string, heading: string): SectionSpan {
  const matcher = new RegExp(`^## ${escapeRegExp(heading)}[ \\t]*$`, 'gm');
  const matches = [...source.matchAll(matcher)];
  if (matches.length !== 1) {
    throw new Error(`expected exactly one section: ${heading}`);
  }
  const match = matches[0]!;
  const contentStart = match.index! + match[0].length;
  const tail = source.slice(contentStart);
  const next = /^##\s+/m.exec(tail);
  return {
    contentStart,
    contentEnd: next ? contentStart + next.index : source.length,
  };
}

function sectionContent(source: string, heading: string): string {
  const span = sectionSpan(source, heading);
  return source.slice(span.contentStart, span.contentEnd).trim();
}

function replaceRequiredSection(source: string, heading: string, content: string): string {
  const span = sectionSpan(source, heading);
  const suffix = source.slice(span.contentEnd);
  return `${source.slice(0, span.contentStart)}\n\n${content.trim()}${suffix ? '\n\n' : '\n'}${suffix}`;
}

function appendRequiredSection(source: string, heading: string, entry: string): string {
  const current = sectionContent(source, heading);
  const next = current ? `${current}\n${entry.trim()}` : entry.trim();
  return replaceRequiredSection(source, heading, next);
}

function appendOptionalSection(source: string, heading: string, content: string): string {
  if (new RegExp(`^## ${escapeRegExp(heading)}[ \\t]*$`, 'm').test(source)) {
    return appendRequiredSection(source, heading, content);
  }
  return `${source.trimEnd()}\n\n## ${heading}\n\n${content.trim()}\n`;
}

function removeOptionalSection(source: string, heading: string): string {
  const matcher = new RegExp(`^## ${escapeRegExp(heading)}[ \\t]*$`, 'gm');
  const matches = [...source.matchAll(matcher)];
  if (matches.length !== 1) throw new Error(`expected exactly one section: ${heading}`);
  const start = matches[0]!.index!;
  const contentStart = start + matches[0]![0].length;
  const next = /^##\s+/m.exec(source.slice(contentStart));
  const end = next ? contentStart + next.index : source.length;
  const prefix = source.slice(0, start).trimEnd();
  const suffix = source.slice(end).trimStart();
  return suffix ? `${prefix}\n\n${suffix}` : `${prefix}\n`;
}

function mutateListEntry(
  content: string,
  target: string,
  rendered: string | null,
  removeEmptyState = false,
): string {
  const lines = content.trim().split(/\r?\n/).filter((line, index, all) => (
    line.length > 0 || (index > 0 && index < all.length - 1)
  ));
  const blocks: string[][] = [];
  for (const line of lines) {
    if (line.startsWith('- ') || blocks.length === 0) blocks.push([line]);
    else blocks.at(-1)!.push(line);
  }
  const kept = blocks.filter((block) => {
    if (removeEmptyState && block[0]?.trim() === '- 尚无已固化课堂记忆。') return false;
    return !block.some((line) => line.includes(`](${target})`));
  });
  if (rendered !== null) kept.push(rendered.trim().split(/\r?\n/));
  return kept.flat().join('\n').trim();
}

function upsertRootLink(
  source: string,
  heading: string,
  target: string,
  rendered: string,
  removeEmptyState = false,
): string {
  const content = sectionContent(source, heading);
  return replaceRequiredSection(
    source,
    heading,
    mutateListEntry(content, target, rendered, removeEmptyState),
  );
}

function removeRootLink(source: string, heading: string, target: string): string {
  return replaceRequiredSection(
    source,
    heading,
    mutateListEntry(sectionContent(source, heading), target, null),
  );
}

function documentTitle(source: string, id: string, kind: string): string {
  const match = new RegExp(`^#\\s+${escapeRegExp(id)}[：:]\\s*(.+?)\\s*$`, 'm').exec(source);
  if (!match) throw new Error(`${kind} ${id} must have a stable ID title`);
  return requireOneLine(match[1]!, `${kind} title`);
}

function nextNumericId(
  root: string,
  directory: string,
  prefix: 'obj' | 'pref' | 'bucket',
  reserved: Set<string>,
): string {
  const absolute = canonicalPath(root, directory, false);
  const matcher = new RegExp(`^${prefix}-(\\d+)\\.md$`);
  let maximum = 0;
  if (existsSync(absolute)) {
    if (!lstatSync(absolute).isDirectory()) {
      throw new StudyDocumentError(directory, 'expected a directory');
    }
    for (const name of readdirSync(absolute)) {
      const match = matcher.exec(name);
      if (match) maximum = Math.max(maximum, Number.parseInt(match[1]!, 10));
    }
  }
  let number = maximum + 1;
  let id = `${prefix}-${String(number).padStart(3, '0')}`;
  while (reserved.has(id)) {
    number += 1;
    id = `${prefix}-${String(number).padStart(3, '0')}`;
  }
  reserved.add(id);
  return id;
}

function renderBullet(label: string, value: string): string {
  const [first, ...rest] = requireText(value, label).split(/\r?\n/);
  return `- ${label}：${first}${rest.map((line) => `\n  ${line}`).join('')}`;
}

function renderList(values: string[], label: string): string {
  if (values.length === 0) throw new Error(`${label} must contain at least one item`);
  return values.map((value, index) => {
    const [first, ...rest] = requireText(value, `${label}[${index}]`).split(/\r?\n/);
    return `- ${first}${rest.map((line) => `\n  ${line}`).join('')}`;
  }).join('\n');
}

function displayTime(recordedAt: string): string {
  const parsed = new Date(recordedAt);
  if (Number.isNaN(parsed.getTime())) throw new Error(`invalid recordedAt: ${recordedAt}`);
  return recordedAt;
}

function recordDate(recordedAt: string): string {
  displayTime(recordedAt);
  return recordedAt.slice(0, 10);
}

function renderLearningHistoryEntry(args: {
  recordedAt: string;
  lessonPath: string;
  lessonId: string;
  entry: ObjectLearningHistoryEntry;
}): string {
  const [first, ...rest] = requireText(args.entry.change, 'learning history change')
    .split(/\r?\n/);
  const change = `- ${displayTime(args.recordedAt)} — ${first}`
    + rest.map((line) => `\n  ${line}`).join('');
  const sources = args.entry.evidenceBlockIds.map((blockId) => (
    `  - 来源：[${args.lessonId}](../../${args.lessonPath}) — Block \`${blockId}\``
  ));
  return [change, ...sources].join('\n');
}

function renderNewObject(args: {
  id: string;
  title: string;
  mutation: ObjectMutation;
  history: string;
}): string {
  return [
    `# ${args.id}：${args.title}`,
    '',
    '## Current Judgment',
    '',
    requireText(args.mutation.currentJudgment, 'currentJudgment'),
    '',
    '## Evolution Overview',
    '',
    requireText(args.mutation.evolutionOverview, 'evolutionOverview'),
    '',
    '## Learning History',
    '',
    args.history,
    '',
    '## Boundaries / Not Yet Demonstrated',
    '',
    renderList(args.mutation.boundaries, 'boundaries'),
    '',
  ].join('\n');
}

function updateExistingObject(source: string, mutation: ObjectMutation, history: string): string {
  let candidate = replaceRequiredSection(
    source,
    'Current Judgment',
    requireText(mutation.currentJudgment, 'currentJudgment'),
  );
  candidate = replaceRequiredSection(
    candidate,
    'Evolution Overview',
    requireText(mutation.evolutionOverview, 'evolutionOverview'),
  );
  candidate = appendRequiredSection(candidate, 'Learning History', history);
  return replaceRequiredSection(
    candidate,
    'Boundaries / Not Yet Demonstrated',
    renderList(mutation.boundaries, 'boundaries'),
  );
}

function validateObjectSource(source: string, id: string): void {
  documentTitle(source, id, 'object');
  for (const heading of [
    'Current Judgment',
    'Evolution Overview',
    'Learning History',
    'Boundaries / Not Yet Demonstrated',
  ]) {
    if (!sectionContent(source, heading)) throw new Error(`object ${id} has empty ${heading}`);
  }
}

function renderPreferenceStatements(
  mutation: PreferenceMutation,
  recordedAt: string,
): string {
  if (mutation.explicitStatements.length === 0) {
    throw new Error('preference mutation requires at least one explicit statement');
  }
  return mutation.explicitStatements.map((statement, index) => {
    const [first, ...rest] = requireText(
      statement.text,
      `explicitStatements[${index}].text`,
    ).split(/\r?\n/);
    return `- ${displayTime(recordedAt)} — ${first}`
      + rest.map((line) => `\n  ${line}`).join('');
  }).join('\n');
}

function renderPreferenceSources(args: {
  mutation: PreferenceMutation;
  recordedAt: string;
  lessonPath: string;
  lessonId: string;
}): string {
  return args.mutation.explicitStatements.map((statement) => (
    `- ${displayTime(args.recordedAt)} `
    + `[${args.lessonId}](../../${args.lessonPath}) — Block \`${statement.evidenceBlockId}\``
  )).join('\n');
}

function renderEvolutionEntry(recordedAt: string, value: string): string {
  const [first, ...rest] = requireText(value, 'evolutionEntry').split(/\r?\n/);
  return `- ${recordDate(recordedAt)} — ${first}`
    + rest.map((line) => `\n  ${line}`).join('');
}

function renderNewPreference(args: {
  preference: ResolvedPreference;
  recordedAt: string;
  lessonPath: string;
  lessonId: string;
}): string {
  const { mutation } = args.preference;
  return [
    `# ${args.preference.id}：${args.preference.title}`,
    '',
    '## Current Judgment',
    '',
    requireText(mutation.currentJudgment, 'preference currentJudgment'),
    '',
    '## Scope',
    '',
    renderList(mutation.scope, 'preference scope'),
    '',
    '## Explicit Statements',
    '',
    renderPreferenceStatements(mutation, args.recordedAt),
    '',
    '## Evolution History',
    '',
    renderEvolutionEntry(args.recordedAt, mutation.evolutionEntry),
    '',
    '## Source',
    '',
    renderPreferenceSources({
      mutation,
      recordedAt: args.recordedAt,
      lessonPath: args.lessonPath,
      lessonId: args.lessonId,
    }),
    '',
  ].join('\n');
}

function updateExistingPreference(args: {
  source: string;
  mutation: PreferenceMutation;
  recordedAt: string;
  lessonPath: string;
  lessonId: string;
}): string {
  let candidate = replaceRequiredSection(
    args.source,
    'Current Judgment',
    requireText(args.mutation.currentJudgment, 'preference currentJudgment'),
  );
  candidate = replaceRequiredSection(
    candidate,
    'Scope',
    renderList(args.mutation.scope, 'preference scope'),
  );
  candidate = appendRequiredSection(
    candidate,
    'Explicit Statements',
    renderPreferenceStatements(args.mutation, args.recordedAt),
  );
  candidate = appendRequiredSection(
    candidate,
    'Evolution History',
    renderEvolutionEntry(args.recordedAt, args.mutation.evolutionEntry),
  );
  return appendRequiredSection(
    candidate,
    'Source',
    renderPreferenceSources(args),
  );
}

function validatePreferenceSource(source: string, id: string): void {
  documentTitle(source, id, 'preference');
  for (const heading of [
    'Current Judgment',
    'Scope',
    'Explicit Statements',
    'Evolution History',
    'Source',
  ]) {
    if (!sectionContent(source, heading)) throw new Error(`preference ${id} has empty ${heading}`);
  }
}

function validateRootIndex(source: string): void {
  sectionSpan(source, 'Current Learning Frontier');
  sectionSpan(source, 'Object Buckets');
  sectionSpan(source, 'Active Capability Cues');
  sectionSpan(source, 'Active Preference Cues');
}

function renderNewBucket(bucket: ResolvedBucket): string {
  return `# ${bucket.id}：${bucket.title}\n\n## Objects\n`;
}

function addObjectToBucket(
  source: string,
  object: Pick<ResolvedObject, 'id' | 'title'>,
): string {
  const target = `../objects/${object.id}.md`;
  const rendered = `- [${object.id}：${object.title}](${target})`;
  return replaceRequiredSection(
    source,
    'Objects',
    mutateListEntry(sectionContent(source, 'Objects'), target, rendered),
  );
}

function changedCandidate(
  path: string,
  before: string | null,
  after: string,
  validate: (source: string) => void,
): DocumentCandidate | null {
  validate(after);
  return before === after ? null : { path, before, after, validate };
}

export function planLessonMemoryCommit(
  root: string,
  lessonPath: string,
  draft: LessonMemoryCommitDraft,
  recordedAt: string,
): {
  candidates: DocumentCandidate[];
  objectIds: Record<string, string>;
  preferenceIds: Record<string, string>;
  bucketIds: Record<string, string>;
} {
  displayTime(recordedAt);
  const lessonBefore = readRequired(root, lessonPath);
  const initialLesson = parseLessonSource(lessonPath, lessonBefore);
  if (initialLesson.status !== 'active') {
    throw new StudyDocumentError(lessonPath, `Lesson must be active, found ${initialLesson.status}`);
  }
  const expectedPath = `plans/${initialLesson.parentId}/lessons/${initialLesson.id}.md`;
  if (lessonPath !== expectedPath) {
    throw new StudyDocumentError(lessonPath, `Lesson path must be ${expectedPath}`);
  }
  let lessonAfter = draft.closingFact
    ? appendClosingClassroomLogSource(
        lessonPath,
        lessonBefore,
        draft.closingFact.blockId,
        draft.closingFact.note,
      )
    : lessonBefore;
  const lesson = parseLessonSource(lessonPath, lessonAfter);
  const blockIds = new Set(lesson.blocks.map((block) => block.id));

  const objectIds: Record<string, string> = {};
  const preferenceIds: Record<string, string> = {};
  const bucketIds: Record<string, string> = {};
  const objectReserved = new Set<string>();
  const preferenceReserved = new Set<string>();
  const bucketReserved = new Set<string>();
  const objectTargets = new Set<string>();
  const newObjectKeys = new Set<string>();
  const resolvedObjects: ResolvedObject[] = [];

  for (const mutation of draft.objects) {
    requireText(mutation.currentJudgment, 'currentJudgment');
    requireText(mutation.evolutionOverview, 'evolutionOverview');
    renderList(mutation.boundaries, 'boundaries');
    requireText(mutation.learningHistoryEntry.change, 'learning history change');
    if (mutation.learningHistoryEntry.evidenceBlockIds.length === 0) {
      throw new Error('object learning history requires at least one evidence Block');
    }
    const seenEvidence = new Set<string>();
    for (const blockId of mutation.learningHistoryEntry.evidenceBlockIds) {
      if (!blockIds.has(blockId)) {
        throw new Error(`object learning history references missing Block ${blockId}`);
      }
      if (seenEvidence.has(blockId)) {
        throw new Error(`object learning history repeats Block ${blockId}`);
      }
      seenEvidence.add(blockId);
    }
    let id: string;
    let title: string;
    let path: string;
    let before: string | null;
    if (mutation.target.kind === 'existing') {
      id = requireStableId(mutation.target.id, 'object');
      path = `memory/objects/${id}.md`;
      before = readRequired(root, path);
      title = documentTitle(before, id, 'object');
      if (mutation.routing.kind === 'defer') {
        throw new Error('existing object cannot defer routing');
      }
    } else {
      const key = requireLocalKey(mutation.target.key, 'object key');
      if (newObjectKeys.has(key)) throw new Error(`duplicate object key: ${key}`);
      newObjectKeys.add(key);
      id = nextNumericId(root, 'memory/objects', 'obj', objectReserved);
      objectIds[key] = id;
      title = requireOneLine(mutation.target.title, 'object title');
      path = `memory/objects/${id}.md`;
      ensureNewPath(root, path);
      before = null;
      if (mutation.routing.kind === 'keep') throw new Error('new object cannot keep routing');
    }
    if (objectTargets.has(id)) throw new Error(`duplicate object target: ${id}`);
    objectTargets.add(id);
    resolvedObjects.push({ mutation, id, title, path, before });
  }

  const preferenceTargets = new Set<string>();
  const preferenceKeys = new Set<string>();
  const resolvedPreferences: ResolvedPreference[] = [];
  for (const mutation of draft.preferences) {
    requireText(mutation.currentJudgment, 'preference currentJudgment');
    renderList(mutation.scope, 'preference scope');
    requireText(mutation.evolutionEntry, 'evolutionEntry');
    if (mutation.explicitStatements.length === 0) {
      throw new Error('preference mutation requires at least one explicit statement');
    }
    for (const [index, statement] of mutation.explicitStatements.entries()) {
      requireText(statement.text, `explicitStatements[${index}].text`);
      if (!blockIds.has(statement.evidenceBlockId)) {
        throw new Error(`preference statement references missing Block ${statement.evidenceBlockId}`);
      }
    }
    let id: string;
    let title: string;
    let path: string;
    let before: string | null;
    if (mutation.target.kind === 'existing') {
      id = requireStableId(mutation.target.id, 'preference');
      path = `memory/preferences/${id}.md`;
      before = readRequired(root, path);
      title = documentTitle(before, id, 'preference');
    } else {
      const key = requireLocalKey(mutation.target.key, 'preference key');
      if (preferenceKeys.has(key)) throw new Error(`duplicate preference key: ${key}`);
      if (mutation.cue.kind !== 'upsert') {
        throw new Error('new preference requires an upsert cue');
      }
      preferenceKeys.add(key);
      id = nextNumericId(root, 'memory/preferences', 'pref', preferenceReserved);
      preferenceIds[key] = id;
      title = requireOneLine(mutation.target.title, 'preference title');
      path = `memory/preferences/${id}.md`;
      ensureNewPath(root, path);
      before = null;
    }
    if (preferenceTargets.has(id)) throw new Error(`duplicate preference target: ${id}`);
    preferenceTargets.add(id);
    resolvedPreferences.push({ mutation, id, title, path, before });
  }

  const resolvedNewBuckets = new Map<string, ResolvedBucket>();
  const resolvedExistingBuckets = new Map<string, ResolvedBucket>();
  const resolveBucket = (ref: BucketRef): ResolvedBucket => {
    if (ref.kind === 'existing') {
      const id = requireStableId(ref.id, 'bucket');
      const cached = resolvedExistingBuckets.get(id);
      if (cached) return cached;
      const path = `memory/indexes/${id}.md`;
      const before = readRequired(root, path);
      const bucket = { id, title: documentTitle(before, id, 'bucket'), path, before };
      resolvedExistingBuckets.set(id, bucket);
      return bucket;
    }
    const key = requireLocalKey(ref.key, 'bucket key');
    const title = requireOneLine(ref.title, 'bucket title');
    const cached = resolvedNewBuckets.get(key);
    if (cached) {
      if (cached.title !== title) throw new Error(`bucket key ${key} has conflicting titles`);
      return cached;
    }
    const id = nextNumericId(root, 'memory/indexes', 'bucket', bucketReserved);
    const path = `memory/indexes/${id}.md`;
    ensureNewPath(root, path);
    const bucket = { id, title, path, before: null };
    resolvedNewBuckets.set(key, bucket);
    bucketIds[key] = id;
    return bucket;
  };

  const rootPath = 'memory/INDEX.md';
  const rootBefore = readRequired(root, rootPath);
  let rootAfter = rootBefore;
  const bucketAfter = new Map<string, { bucket: ResolvedBucket; source: string }>();

  const ensureBucketRootLink = (bucket: ResolvedBucket): void => {
    const target = `indexes/${bucket.id}.md`;
    rootAfter = upsertRootLink(
      rootAfter,
      'Object Buckets',
      target,
      `- [${bucket.id}：${bucket.title}](${target})`,
    );
  };

  const objectSources = new Map<string, string>();
  for (const object of resolvedObjects) {
    const history = renderLearningHistoryEntry({
      recordedAt,
      lessonPath,
      lessonId: lesson.id,
      entry: object.mutation.learningHistoryEntry,
    });
    const source = object.before === null
      ? renderNewObject({
          id: object.id,
          title: object.title,
          mutation: object.mutation,
          history,
        })
      : updateExistingObject(object.before, object.mutation, history);
    validateObjectSource(source, object.id);
    objectSources.set(object.path, source);

    if (object.mutation.frontierSummary?.trim()) {
      const target = `objects/${object.id}.md`;
      const summary = requireText(object.mutation.frontierSummary, 'frontierSummary');
      rootAfter = upsertRootLink(
        rootAfter,
        'Current Learning Frontier',
        target,
        `- [${object.id}：${object.title}](${target}) — ${summary}`,
        true,
      );
    }

    if (object.mutation.routing.kind === 'assign') {
      if (object.mutation.routing.buckets.length === 0) {
        throw new Error('assign requires at least one bucket');
      }
      const seenBuckets = new Set<string>();
      for (const ref of object.mutation.routing.buckets) {
        const bucket = resolveBucket(ref);
        if (seenBuckets.has(bucket.id)) throw new Error(`object ${object.id} repeats bucket ${bucket.id}`);
        seenBuckets.add(bucket.id);
        const current = bucketAfter.get(bucket.path)?.source
          ?? (bucket.before === null ? renderNewBucket(bucket) : bucket.before);
        bucketAfter.set(bucket.path, { bucket, source: addObjectToBucket(current, object) });
        ensureBucketRootLink(bucket);
      }
    } else if (object.mutation.routing.kind === 'defer') {
      const reason = requireText(object.mutation.routing.reason, 'defer reason');
      const target = `objects/${object.id}.md`;
      const rendered = `- [${object.id}：${object.title}](${target})\n  — ${reason}`;
      if (/^## Deferred Object Routing[ \\t]*$/m.test(rootAfter)) {
        rootAfter = upsertRootLink(rootAfter, 'Deferred Object Routing', target, rendered);
      } else {
        rootAfter = appendOptionalSection(rootAfter, 'Deferred Object Routing', rendered);
      }
    }
  }

  const preferenceSources = new Map<string, string>();
  for (const preference of resolvedPreferences) {
    const source = preference.before === null
      ? renderNewPreference({ preference, recordedAt, lessonPath, lessonId: lesson.id })
      : updateExistingPreference({
          source: preference.before,
          mutation: preference.mutation,
          recordedAt,
          lessonPath,
          lessonId: lesson.id,
        });
    validatePreferenceSource(source, preference.id);
    preferenceSources.set(preference.path, source);

    const target = `preferences/${preference.id}.md`;
    if (preference.mutation.cue.kind === 'upsert') {
      const summary = requireText(preference.mutation.cue.summary, 'preference cue summary');
      rootAfter = upsertRootLink(
        rootAfter,
        'Active Preference Cues',
        target,
        `- [${preference.id}：${preference.title}](${target}) — ${summary}`,
      );
    } else if (preference.mutation.cue.kind === 'remove') {
      rootAfter = removeRootLink(rootAfter, 'Active Preference Cues', target);
    }
  }

  const candidates: DocumentCandidate[] = [];
  const lessonCandidate = changedCandidate(
    lessonPath,
    lessonBefore,
    lessonAfter,
    (source) => { parseLessonSource(lessonPath, source); },
  );
  if (lessonCandidate) candidates.push(lessonCandidate);
  for (const object of [...resolvedObjects].sort((a, b) => a.path.localeCompare(b.path))) {
    const candidate = changedCandidate(
      object.path,
      object.before,
      objectSources.get(object.path)!,
      (source) => { validateObjectSource(source, object.id); },
    );
    if (candidate) candidates.push(candidate);
  }
  for (const preference of [...resolvedPreferences].sort((a, b) => a.path.localeCompare(b.path))) {
    const candidate = changedCandidate(
      preference.path,
      preference.before,
      preferenceSources.get(preference.path)!,
      (source) => { validatePreferenceSource(source, preference.id); },
    );
    if (candidate) candidates.push(candidate);
  }
  for (const { bucket, source } of [...bucketAfter.values()]
    .sort((a, b) => a.bucket.path.localeCompare(b.bucket.path))) {
    const candidate = changedCandidate(
      bucket.path,
      bucket.before,
      source,
      (value) => {
        documentTitle(value, bucket.id, 'bucket');
        sectionSpan(value, 'Objects');
      },
    );
    if (candidate) candidates.push(candidate);
  }
  const rootCandidate = changedCandidate(
    rootPath,
    rootBefore,
    rootAfter,
    validateRootIndex,
  );
  if (rootCandidate) candidates.push(rootCandidate);
  if (candidates.length === 0) throw new Error('lesson memory commit must change at least one document');

  return {
    candidates,
    objectIds,
    preferenceIds,
    bucketIds,
  };
}

type ResolvedFreeObject = {
  mutation: FreeLearningObjectMutation;
  id: string;
  title: string;
  path: string;
  before: string | null;
};

function renderFreeLearningHistoryEntry(args: {
  recordedAt: string;
  sessionId: string;
  change: string;
}): string {
  const [first, ...rest] = requireText(args.change, 'learning history change')
    .split(/\r?\n/);
  return [
    `- ${displayTime(args.recordedAt)} — ${first}`
      + rest.map((line) => `\n  ${line}`).join(''),
    `  - 来源：原生自由学习 Session \`${args.sessionId}\``,
  ].join('\n');
}

function updateExistingObjectFromFreeLearning(
  source: string,
  mutation: FreeLearningObjectMutation,
  history: string,
): string {
  let candidate = source;
  if (mutation.currentJudgment !== undefined) {
    candidate = replaceRequiredSection(
      candidate,
      'Current Judgment',
      requireText(mutation.currentJudgment, 'currentJudgment'),
    );
  }
  if (mutation.evolutionOverview !== undefined) {
    candidate = replaceRequiredSection(
      candidate,
      'Evolution Overview',
      requireText(mutation.evolutionOverview, 'evolutionOverview'),
    );
  }
  candidate = appendRequiredSection(candidate, 'Learning History', history);
  if (mutation.boundaries !== undefined) {
    candidate = replaceRequiredSection(
      candidate,
      'Boundaries / Not Yet Demonstrated',
      renderList(mutation.boundaries, 'boundaries'),
    );
  }
  return candidate;
}

export function planFreeLearningMemoryCommit(
  root: string,
  sessionId: string,
  draft: FreeLearningMemoryCommitDraft,
  recordedAt: string,
): {
  candidates: DocumentCandidate[];
  objectIds: Record<string, string>;
  bucketIds: Record<string, string>;
} {
  displayTime(recordedAt);
  requireLocalKey(sessionId, 'session id');
  if (draft.objects.length === 0) throw new Error('FREE_LEARNING_MEMORY_CHANGE_REQUIRED');

  const objectIds: Record<string, string> = {};
  const bucketIds: Record<string, string> = {};
  const objectReserved = new Set<string>();
  const bucketReserved = new Set<string>();
  const objectTargets = new Set<string>();
  const newObjectKeys = new Set<string>();
  const resolvedObjects: ResolvedFreeObject[] = [];

  for (const mutation of draft.objects) {
    requireText(mutation.learningHistoryChange, 'learning history change');
    let id: string;
    let title: string;
    let path: string;
    let before: string | null;
    if (mutation.target.kind === 'existing') {
      id = requireStableId(mutation.target.id, 'object');
      path = `memory/objects/${id}.md`;
      before = readRequired(root, path);
      title = documentTitle(before, id, 'object');
      if (mutation.routing.kind === 'defer') {
        throw new Error('existing object cannot defer routing');
      }
      if (mutation.currentJudgment !== undefined) {
        requireText(mutation.currentJudgment, 'currentJudgment');
      }
      if (mutation.evolutionOverview !== undefined) {
        requireText(mutation.evolutionOverview, 'evolutionOverview');
      }
      if (mutation.boundaries !== undefined) renderList(mutation.boundaries, 'boundaries');
    } else {
      const key = requireLocalKey(mutation.target.key, 'object key');
      if (newObjectKeys.has(key)) throw new Error(`duplicate object key: ${key}`);
      newObjectKeys.add(key);
      if (
        mutation.currentJudgment === undefined
        || mutation.evolutionOverview === undefined
        || mutation.boundaries === undefined
      ) {
        throw new Error('NEW_OBJECT_SNAPSHOT_REQUIRED');
      }
      requireText(mutation.currentJudgment, 'currentJudgment');
      requireText(mutation.evolutionOverview, 'evolutionOverview');
      renderList(mutation.boundaries, 'boundaries');
      id = nextNumericId(root, 'memory/objects', 'obj', objectReserved);
      objectIds[key] = id;
      title = requireOneLine(mutation.target.title, 'object title');
      path = `memory/objects/${id}.md`;
      ensureNewPath(root, path);
      before = null;
      if (mutation.routing.kind === 'keep') throw new Error('new object cannot keep routing');
    }
    if (objectTargets.has(id)) throw new Error(`duplicate object target: ${id}`);
    objectTargets.add(id);
    resolvedObjects.push({ mutation, id, title, path, before });
  }

  const resolvedNewBuckets = new Map<string, ResolvedBucket>();
  const resolvedExistingBuckets = new Map<string, ResolvedBucket>();
  const resolveBucket = (ref: BucketRef): ResolvedBucket => {
    if (ref.kind === 'existing') {
      const id = requireStableId(ref.id, 'bucket');
      const cached = resolvedExistingBuckets.get(id);
      if (cached) return cached;
      const path = `memory/indexes/${id}.md`;
      const before = readRequired(root, path);
      const bucket = { id, title: documentTitle(before, id, 'bucket'), path, before };
      resolvedExistingBuckets.set(id, bucket);
      return bucket;
    }
    const key = requireLocalKey(ref.key, 'bucket key');
    const title = requireOneLine(ref.title, 'bucket title');
    const cached = resolvedNewBuckets.get(key);
    if (cached) {
      if (cached.title !== title) throw new Error(`bucket key ${key} has conflicting titles`);
      return cached;
    }
    const id = nextNumericId(root, 'memory/indexes', 'bucket', bucketReserved);
    const path = `memory/indexes/${id}.md`;
    ensureNewPath(root, path);
    const bucket = { id, title, path, before: null };
    resolvedNewBuckets.set(key, bucket);
    bucketIds[key] = id;
    return bucket;
  };

  const rootPath = 'memory/INDEX.md';
  const rootBefore = readRequired(root, rootPath);
  let rootAfter = rootBefore;
  const bucketAfter = new Map<string, { bucket: ResolvedBucket; source: string }>();
  const ensureBucketRootLink = (bucket: ResolvedBucket): void => {
    const target = `indexes/${bucket.id}.md`;
    rootAfter = upsertRootLink(
      rootAfter,
      'Object Buckets',
      target,
      `- [${bucket.id}：${bucket.title}](${target})`,
    );
  };

  const objectSources = new Map<string, string>();
  for (const object of resolvedObjects) {
    const history = renderFreeLearningHistoryEntry({
      recordedAt,
      sessionId,
      change: object.mutation.learningHistoryChange,
    });
    const source = object.before === null
      ? renderNewObject({
          id: object.id,
          title: object.title,
          mutation: {
            target: object.mutation.target,
            currentJudgment: object.mutation.currentJudgment!,
            evolutionOverview: object.mutation.evolutionOverview!,
            boundaries: object.mutation.boundaries!,
            learningHistoryEntry: { change: object.mutation.learningHistoryChange, evidenceBlockIds: [] },
            routing: object.mutation.routing,
            ...(object.mutation.frontierSummary
              ? { frontierSummary: object.mutation.frontierSummary }
              : {}),
          },
          history,
        })
      : updateExistingObjectFromFreeLearning(object.before, object.mutation, history);
    validateObjectSource(source, object.id);
    objectSources.set(object.path, source);

    if (object.mutation.frontierSummary?.trim()) {
      const target = `objects/${object.id}.md`;
      const summary = requireText(object.mutation.frontierSummary, 'frontierSummary');
      rootAfter = upsertRootLink(
        rootAfter,
        'Current Learning Frontier',
        target,
        `- [${object.id}：${object.title}](${target}) — ${summary}`,
        true,
      );
    }

    if (object.mutation.routing.kind === 'assign') {
      if (object.mutation.routing.buckets.length === 0) {
        throw new Error('assign requires at least one bucket');
      }
      const seenBuckets = new Set<string>();
      for (const ref of object.mutation.routing.buckets) {
        const bucket = resolveBucket(ref);
        if (seenBuckets.has(bucket.id)) {
          throw new Error(`object ${object.id} repeats bucket ${bucket.id}`);
        }
        seenBuckets.add(bucket.id);
        const current = bucketAfter.get(bucket.path)?.source
          ?? (bucket.before === null ? renderNewBucket(bucket) : bucket.before);
        bucketAfter.set(bucket.path, { bucket, source: addObjectToBucket(current, object) });
        ensureBucketRootLink(bucket);
      }
    } else if (object.mutation.routing.kind === 'defer') {
      const reason = requireText(object.mutation.routing.reason, 'defer reason');
      const target = `objects/${object.id}.md`;
      const rendered = `- [${object.id}：${object.title}](${target})\n  — ${reason}`;
      if (/^## Deferred Object Routing[ \t]*$/m.test(rootAfter)) {
        rootAfter = upsertRootLink(rootAfter, 'Deferred Object Routing', target, rendered);
      } else {
        rootAfter = appendOptionalSection(rootAfter, 'Deferred Object Routing', rendered);
      }
    }
  }

  const candidates: DocumentCandidate[] = [];
  for (const object of [...resolvedObjects].sort((a, b) => a.path.localeCompare(b.path))) {
    const candidate = changedCandidate(
      object.path,
      object.before,
      objectSources.get(object.path)!,
      (source) => { validateObjectSource(source, object.id); },
    );
    if (candidate) candidates.push(candidate);
  }
  for (const { bucket, source } of [...bucketAfter.values()]
    .sort((a, b) => a.bucket.path.localeCompare(b.bucket.path))) {
    const candidate = changedCandidate(
      bucket.path,
      bucket.before,
      source,
      (value) => {
        documentTitle(value, bucket.id, 'bucket');
        sectionSpan(value, 'Objects');
      },
    );
    if (candidate) candidates.push(candidate);
  }
  const rootCandidate = changedCandidate(rootPath, rootBefore, rootAfter, validateRootIndex);
  if (rootCandidate) candidates.push(rootCandidate);
  if (candidates.length === 0) throw new Error('FREE_LEARNING_MEMORY_CHANGE_REQUIRED');
  return { candidates, objectIds, bucketIds };
}

export function planDeferredRouteResolution(
  root: string,
  objectId: string,
  buckets: BucketRef[],
): {
  candidates: DocumentCandidate[];
  bucketIds: Record<string, string>;
} {
  const id = requireStableId(objectId, 'object');
  if (buckets.length === 0) throw new Error('deferred route resolution requires at least one bucket');
  const objectPath = `memory/objects/${id}.md`;
  const objectSource = readRequired(root, objectPath);
  const object = { id, title: documentTitle(objectSource, id, 'object') };

  const rootPath = 'memory/INDEX.md';
  const rootBefore = readRequired(root, rootPath);
  validateRootIndex(rootBefore);
  if (!/^## Deferred Object Routing[ \\t]*$/m.test(rootBefore)) {
    throw new Error(`object ${id} is not deferred`);
  }
  const deferredTarget = `objects/${id}.md`;
  const deferred = sectionContent(rootBefore, 'Deferred Object Routing');
  if (!deferred.includes(`](${deferredTarget})`)) {
    throw new Error(`object ${id} is not deferred`);
  }
  const remainingDeferred = mutateListEntry(deferred, deferredTarget, null);
  let rootAfter = remainingDeferred
    ? replaceRequiredSection(rootBefore, 'Deferred Object Routing', remainingDeferred)
    : removeOptionalSection(rootBefore, 'Deferred Object Routing');

  const bucketIds: Record<string, string> = {};
  const bucketReserved = new Set<string>();
  const newBuckets = new Map<string, ResolvedBucket>();
  const existingBuckets = new Map<string, ResolvedBucket>();
  const resolvedBuckets: ResolvedBucket[] = [];
  const seenBucketIds = new Set<string>();

  for (const ref of buckets) {
    let bucket: ResolvedBucket;
    if (ref.kind === 'existing') {
      const bucketId = requireStableId(ref.id, 'bucket');
      const cached = existingBuckets.get(bucketId);
      if (cached) bucket = cached;
      else {
        const path = `memory/indexes/${bucketId}.md`;
        const before = readRequired(root, path);
        bucket = {
          id: bucketId,
          title: documentTitle(before, bucketId, 'bucket'),
          path,
          before,
        };
        existingBuckets.set(bucketId, bucket);
      }
    } else {
      const key = requireLocalKey(ref.key, 'bucket key');
      const title = requireOneLine(ref.title, 'bucket title');
      const cached = newBuckets.get(key);
      if (cached) {
        if (cached.title !== title) throw new Error(`bucket key ${key} has conflicting titles`);
        bucket = cached;
      } else {
        const bucketId = nextNumericId(root, 'memory/indexes', 'bucket', bucketReserved);
        const path = `memory/indexes/${bucketId}.md`;
        ensureNewPath(root, path);
        bucket = { id: bucketId, title, path, before: null };
        newBuckets.set(key, bucket);
        bucketIds[key] = bucketId;
      }
    }
    if (seenBucketIds.has(bucket.id)) throw new Error(`duplicate bucket target: ${bucket.id}`);
    seenBucketIds.add(bucket.id);
    resolvedBuckets.push(bucket);
  }

  const candidates: DocumentCandidate[] = [];
  for (const bucket of resolvedBuckets.sort((a, b) => a.path.localeCompare(b.path))) {
    const before = bucket.before;
    const initial = before === null ? renderNewBucket(bucket) : before;
    const after = addObjectToBucket(initial, object);
    const candidate = changedCandidate(bucket.path, before, after, (source) => {
      documentTitle(source, bucket.id, 'bucket');
      sectionSpan(source, 'Objects');
    });
    if (candidate) candidates.push(candidate);
    const target = `indexes/${bucket.id}.md`;
    rootAfter = upsertRootLink(
      rootAfter,
      'Object Buckets',
      target,
      `- [${bucket.id}：${bucket.title}](${target})`,
    );
  }
  const rootCandidate = changedCandidate(rootPath, rootBefore, rootAfter, validateRootIndex);
  if (rootCandidate) candidates.push(rootCandidate);
  if (candidates.length === 0) throw new Error('deferred route resolution changed no documents');
  return { candidates, bucketIds };
}
