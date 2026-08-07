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

export type TraceDraft = {
  key: string;
  situation: string;
  firstPerformance: string;
  actualHelp: string;
  laterPerformance: string;
  capabilitySignal?: string;
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
  traceEntries: Array<{ traceKey: string; meaning: string }>;
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
  traces: TraceDraft[];
  objects: ObjectMutation[];
  preferences: PreferenceMutation[];
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

function traceDate(recordedAt: string): string {
  displayTime(recordedAt);
  return recordedAt.slice(0, 10);
}

function renderTrace(args: {
  id: string;
  draft: TraceDraft;
  objectIds: string[];
  recordedAt: string;
}): string {
  const evidence = args.draft.evidenceBlockIds.join('、');
  const fields = [
    renderBullet('时间', displayTime(args.recordedAt)),
    renderBullet('情境', args.draft.situation),
    renderBullet('首次表现', args.draft.firstPerformance),
    renderBullet('实际帮助', args.draft.actualHelp),
    renderBullet('后续表现', args.draft.laterPerformance),
    renderBullet('关联对象', args.objectIds.join('、')),
  ];
  if (args.draft.capabilitySignal?.trim()) {
    fields.push(renderBullet('当时的能力信号', args.draft.capabilitySignal));
  }
  fields.push(renderBullet('来源证据', `本课 Classroom Log：${evidence}`));
  return `### ${args.id}\n\n${fields.join('\n')}`;
}

function renderTimelineEntry(args: {
  recordedAt: string;
  traceId: string;
  lessonPath: string;
  meaning: string;
}): string {
  const [first, ...rest] = requireText(args.meaning, 'trace meaning').split(/\r?\n/);
  const target = `../../${args.lessonPath}#${args.traceId}`;
  return `- ${traceDate(args.recordedAt)} [${args.traceId}](${target})\n`
    + `  — ${first}${rest.map((line) => `\n    ${line}`).join('')}`;
}

function renderNewObject(args: {
  id: string;
  title: string;
  mutation: ObjectMutation;
  timeline: string;
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
    '## Trace Timeline',
    '',
    args.timeline,
    '',
    '## Boundaries / Not Yet Demonstrated',
    '',
    renderList(args.mutation.boundaries, 'boundaries'),
    '',
  ].join('\n');
}

function updateExistingObject(source: string, mutation: ObjectMutation, timeline: string): string {
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
  candidate = appendRequiredSection(candidate, 'Trace Timeline', timeline);
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
    'Trace Timeline',
    'Boundaries / Not Yet Demonstrated',
  ]) {
    if (!sectionContent(source, heading)) throw new Error(`object ${id} has empty ${heading}`);
  }
}

function renderNewBucket(bucket: ResolvedBucket): string {
  return `# ${bucket.id}：${bucket.title}\n\n## Objects\n`;
}

function addObjectToBucket(source: string, object: ResolvedObject): string {
  const target = `../objects/${object.id}.md`;
  const rendered = `- [${object.id}：${object.title}](${target})`;
  return replaceRequiredSection(
    source,
    'Objects',
    mutateListEntry(sectionContent(source, 'Objects'), target, rendered),
  );
}

function appendLessonTraces(source: string, traces: string[]): string {
  if (traces.length === 0) return source;
  const rendered = traces.join('\n\n');
  if (/^## Consolidated Learning Traces[ \\t]*$/m.test(source)) {
    return appendRequiredSection(source, 'Consolidated Learning Traces', rendered);
  }
  return `${source.trimEnd()}\n\n## Consolidated Learning Traces\n\n${rendered}\n`;
}

function nextTraceIds(
  lessonSource: string,
  planId: string,
  lessonId: string,
  drafts: TraceDraft[],
): Record<string, string> {
  const keys = new Set<string>();
  const base = `trace-${planId}-${lessonId}-`;
  const matcher = new RegExp(`^### ${escapeRegExp(base)}(\\d+)[ \\t]*$`, 'gm');
  let maximum = 0;
  for (const match of lessonSource.matchAll(matcher)) {
    maximum = Math.max(maximum, Number.parseInt(match[1]!, 10));
  }
  const result: Record<string, string> = {};
  drafts.forEach((draft, index) => {
    const key = requireLocalKey(draft.key, 'Trace key');
    if (keys.has(key)) throw new Error(`duplicate Trace key: ${key}`);
    keys.add(key);
    result[key] = `${base}${String(maximum + index + 1).padStart(2, '0')}`;
  });
  return result;
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
  traceIds: Record<string, string>;
  objectIds: Record<string, string>;
  preferenceIds: Record<string, string>;
  bucketIds: Record<string, string>;
} {
  displayTime(recordedAt);
  if (draft.preferences.length > 0) {
    throw new Error('preference mutations are not implemented yet');
  }
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

  const traceIds = nextTraceIds(lessonAfter, lesson.parentId, lesson.id, draft.traces);
  for (const trace of draft.traces) {
    requireText(trace.situation, `Trace ${trace.key} situation`);
    requireText(trace.firstPerformance, `Trace ${trace.key} firstPerformance`);
    requireText(trace.actualHelp, `Trace ${trace.key} actualHelp`);
    requireText(trace.laterPerformance, `Trace ${trace.key} laterPerformance`);
    if (trace.evidenceBlockIds.length === 0) {
      throw new Error(`Trace ${trace.key} requires at least one evidence Block`);
    }
    const seen = new Set<string>();
    for (const blockId of trace.evidenceBlockIds) {
      if (!blockIds.has(blockId)) throw new Error(`Trace ${trace.key} references missing Block ${blockId}`);
      if (seen.has(blockId)) throw new Error(`Trace ${trace.key} repeats Block ${blockId}`);
      seen.add(blockId);
    }
  }

  const objectIds: Record<string, string> = {};
  const bucketIds: Record<string, string> = {};
  const objectReserved = new Set<string>();
  const bucketReserved = new Set<string>();
  const objectTargets = new Set<string>();
  const newObjectKeys = new Set<string>();
  const resolvedObjects: ResolvedObject[] = [];

  for (const mutation of draft.objects) {
    requireText(mutation.currentJudgment, 'currentJudgment');
    requireText(mutation.evolutionOverview, 'evolutionOverview');
    renderList(mutation.boundaries, 'boundaries');
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
    if (mutation.traceEntries.length === 0) {
      throw new Error(`object ${id} requires at least one Trace entry`);
    }
    resolvedObjects.push({ mutation, id, title, path, before });
  }

  const traceObjects = new Map<string, string[]>();
  for (const object of resolvedObjects) {
    const seenTraceKeys = new Set<string>();
    for (const entry of object.mutation.traceEntries) {
      const key = requireLocalKey(entry.traceKey, 'Trace reference');
      if (!(key in traceIds)) throw new Error(`object ${object.id} references missing Trace ${key}`);
      if (seenTraceKeys.has(key)) throw new Error(`object ${object.id} repeats Trace ${key}`);
      seenTraceKeys.add(key);
      requireText(entry.meaning, `object ${object.id} Trace meaning`);
      const ids = traceObjects.get(key) ?? [];
      ids.push(object.id);
      traceObjects.set(key, ids);
    }
  }
  for (const trace of draft.traces) {
    if (!traceObjects.has(trace.key)) throw new Error(`Trace ${trace.key} must be referenced by an object`);
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
    const timeline = object.mutation.traceEntries.map((entry) => renderTimelineEntry({
      recordedAt,
      traceId: traceIds[entry.traceKey]!,
      lessonPath,
      meaning: entry.meaning,
    })).join('\n');
    const source = object.before === null
      ? renderNewObject({
          id: object.id,
          title: object.title,
          mutation: object.mutation,
          timeline,
        })
      : updateExistingObject(object.before, object.mutation, timeline);
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

  const renderedTraces = draft.traces.map((trace) => renderTrace({
    id: traceIds[trace.key]!,
    draft: trace,
    objectIds: traceObjects.get(trace.key)!,
    recordedAt,
  }));
  lessonAfter = appendLessonTraces(lessonAfter, renderedTraces);
  parseLessonSource(lessonPath, lessonAfter);

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
    (source) => {
      sectionSpan(source, 'Current Learning Frontier');
      sectionSpan(source, 'Object Buckets');
      sectionSpan(source, 'Active Capability Cues');
      sectionSpan(source, 'Active Preference Cues');
    },
  );
  if (rootCandidate) candidates.push(rootCandidate);
  if (candidates.length === 0) throw new Error('lesson memory commit must change at least one document');

  return {
    candidates,
    traceIds,
    objectIds,
    preferenceIds: {},
    bucketIds,
  };
}
