import { appendFileSync, readdirSync, readFileSync } from 'node:fs';
import { extname, relative } from 'node:path';
import { parse } from 'yaml';
import { resolveInsideRoot } from './learning-set';
import { readMarkdownFile } from './markdown';
import { readLessonAliases } from './lesson-aliases';
import {
  resolveTraceMethods,
  type TraceMethodInput,
  type TraceMethods,
} from './method-vocabulary';
import { sourceResolve } from './sources';

export type TraceAssessment = 'correct' | 'partially_correct' | 'incorrect' | 'incomplete';
export type TraceSupport = 'none' | 'tutor' | 'external';

export type TraceRecord = {
  eventId: string;
  lessonPath: string;
  lessonId: string;
  planId: string;
  blockId: string;
  cardPath: string | null;
  cardStepId: string | null;
  materialPath: string | null;
  assessment: TraceAssessment;
  support: TraceSupport;
  methods: TraceMethods | null;
  note: string;
  supersedes: string | null;
  sourceAnchor: string;
  recordedAt: string;
};

export type TraceAppendInput = Omit<
  TraceRecord,
  'eventId' | 'lessonId' | 'planId' | 'cardPath' | 'sourceAnchor' | 'recordedAt' | 'methods'
> & { cardAlias: string | null; methods?: TraceMethodInput | null | undefined };

const assessments = new Set<TraceAssessment>(['correct', 'partially_correct', 'incorrect', 'incomplete']);
const supports = new Set<TraceSupport>(['none', 'tutor', 'external']);
const traceHeading = /^## Trace (event-\d+)[ \t]*$/gm;
const blockHeading = /^## Block ([a-z0-9]+(?:-[a-z0-9]+)*)(?:（[^）]+）)?[ \t]*$/;

function traceError(message: string): never {
  throw new Error(`INVALID_TRACE: ${message}`);
}

function lessons(root: string): string[] {
  const lessonsDirectory = resolveInsideRoot(root, 'lessons');
  return readdirSync(lessonsDirectory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `lessons/${entry.name}`)
    .sort();
}

function headingSections(source: string): Array<{ eventId: string; content: string }> {
  const matches = [...source.matchAll(traceHeading)];
  return matches.map((match, index) => ({
    eventId: match[1]!,
    content: source.slice(match.index! + match[0].length, matches[index + 1]?.index),
  }));
}

function field(content: string, label: string): string | null {
  const match = new RegExp(`^${label}:\\s*(.+?)\\s*$`, 'm').exec(content);
  return match?.[1] ?? null;
}

function optionalField(value: string | null): string | null {
  return value === null || value === '(none)' ? null : value;
}

function linkValue(value: string | null): string | null {
  if (value === null) return null;
  const link = /^\[([^\]]+)\]\([^)]*\)$/.exec(value);
  return link?.[1] ?? value;
}

function noteContent(content: string): string | null {
  const encoded = field(content, 'Note');
  if (encoded === null) return null;
  try {
    const note: unknown = JSON.parse(encoded);
    return typeof note === 'string' ? note : null;
  } catch {
    return null;
  }
}

function methodsContent(content: string): TraceMethods | null {
  const primary = field(content, 'Primary method');
  if (primary === null || !primary.trim()) return null;
  const encoded = field(content, 'Secondary methods');
  if (encoded === null) return { primary: primary.trim(), secondary: [] };
  try {
    const secondary: unknown = JSON.parse(encoded);
    if (!Array.isArray(secondary) || !secondary.every((item) => typeof item === 'string')) return null;
    return {
      primary: primary.trim(),
      secondary: secondary.map((item) => item.trim()).filter((item) => item.length > 0),
    };
  } catch {
    return null;
  }
}

function traceRecord(lessonPath: string, lessonId: string, planId: string, eventId: string, content: string): TraceRecord | null {
  const blockId = linkValue(field(content, 'Block'));
  const recordedAt = field(content, 'Recorded at');
  const assessment = field(content, 'Assessment');
  const support = field(content, 'Support');
  const note = noteContent(content);
  if (
    blockId === null || recordedAt === null || note === null ||
    assessment === null || !assessments.has(assessment as TraceAssessment) ||
    support === null || !supports.has(support as TraceSupport)
  ) return null;

  return {
    eventId,
    lessonPath,
    lessonId,
    planId,
    blockId,
    cardPath: optionalField(field(content, 'Card')),
    cardStepId: optionalField(field(content, 'Card step')),
    materialPath: optionalField(field(content, 'Material')),
    assessment: assessment as TraceAssessment,
    support: support as TraceSupport,
    methods: methodsContent(content),
    note,
    supersedes: linkValue(optionalField(field(content, 'Supersedes'))),
    sourceAnchor: `${lessonPath}#trace-${eventId}`,
    recordedAt,
  };
}

function lessonMetadata(root: string, requestedPath: string): {
  lessonPath: string;
  lessonId: string;
  planId: string;
  source: string;
} {
  const document = readMarkdownFile(root, requestedPath);
  const lessonPath = relative(resolveInsideRoot(root, '.'), document.path).replaceAll('\\', '/');
  if (document.frontmatter.kind !== 'lesson' || !document.id) traceError('Lesson frontmatter is invalid');
  const planId = document.frontmatter.plan_id;
  if (typeof planId !== 'string' || !planId) traceError('Lesson plan_id is invalid');
  return {
    lessonPath,
    lessonId: document.id,
    planId,
    source: readFileSync(resolveInsideRoot(root, lessonPath), 'utf8'),
  };
}

function hasExactBlock(source: string, blockId: string): boolean {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(blockId)) return false;
  const lines = source.split(/\r?\n/);
  let fence: { marker: '`' | '~'; length: number } | null = null;
  for (const line of lines) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence !== null) {
      if (fenceMatch?.[1]?.startsWith(fence.marker)
        && fenceMatch[1].length >= fence.length
        && /^[ \t]*$/.test(fenceMatch[2] ?? '')) fence = null;
      continue;
    }
    if (fenceMatch?.[1]) {
      fence = { marker: fenceMatch[1][0] as '`' | '~', length: fenceMatch[1].length };
      continue;
    }
    if (blockHeading.exec(line)?.[1] === blockId) return true;
  }
  return false;
}

function isProblemCard(root: string, cardPath: string): boolean {
  if (!cardPath.startsWith('cards/') || !['.yaml', '.yml'].includes(extname(cardPath).toLowerCase())) return false;
  try {
    const card: unknown = parse(readFileSync(resolveInsideRoot(root, cardPath), 'utf8'));
    return card !== null
      && typeof card === 'object'
      && !Array.isArray(card)
      && (card as Record<string, unknown>).schema === 'highschool-study.problem-card.v1';
  } catch {
    return false;
  }
}

function encodeNote(note: string): string {
  return JSON.stringify(note)
    .replaceAll('\u2028', '\\u2028')
    .replaceAll('\u2029', '\\u2029');
}

function renderTrace(record: TraceRecord): string {
  const lines = [
    '',
    `## Trace ${record.eventId}`,
    '',
    `Recorded at: ${record.recordedAt}`,
    `Lesson ID: ${record.lessonId}`,
    `Plan ID: ${record.planId}`,
    `Block: [${record.blockId}](#block-${record.blockId})`,
    `Card: ${record.cardPath ?? '(none)'}`,
  ];
  if (record.cardStepId !== null) lines.push(`Card step: ${record.cardStepId}`);
  if (record.materialPath !== null) lines.push(`Material: ${record.materialPath}`);
  lines.push(
    `Assessment: ${record.assessment}`,
    `Support: ${record.support}`,
  );
  if (record.methods !== null) {
    lines.push(`Primary method: ${record.methods.primary}`);
    lines.push(`Secondary methods: ${JSON.stringify(record.methods.secondary)}`);
  }
  if (record.supersedes !== null) lines.push(`Supersedes: [${record.supersedes}](#trace-${record.supersedes})`);
  lines.push(`Note: ${encodeNote(record.note)}`, '');
  return lines.join('\n');
}

export function readTraceRecords(root: string, lessonPaths: string[] = lessons(root)): TraceRecord[] {
  const records: TraceRecord[] = [];
  for (const requestedPath of lessonPaths) {
    const { lessonPath, lessonId, planId, source } = lessonMetadata(root, requestedPath);
    for (const section of headingSections(source)) {
      const record = traceRecord(lessonPath, lessonId, planId, section.eventId, section.content);
      if (record !== null) records.push(record);
    }
  }
  return records;
}

export function readActiveTraces(root: string, lessonPaths?: string[]): TraceRecord[] {
  const records = readTraceRecords(root, lessonPaths);
  const closed = new Set<string>();
  const eventIdsByLesson = new Map<string, Set<string>>();
  for (const record of records) {
    const eventIds = eventIdsByLesson.get(record.lessonPath) ?? new Set<string>();
    eventIds.add(record.eventId);
    eventIdsByLesson.set(record.lessonPath, eventIds);
  }
  for (const record of records) {
    if (record.supersedes !== null
      && record.supersedes !== record.eventId
      && eventIdsByLesson.get(record.lessonPath)?.has(record.supersedes)) {
      closed.add(`${record.lessonPath}:${record.supersedes}`);
    }
  }
  return records.filter((record) => !closed.has(`${record.lessonPath}:${record.eventId}`));
}

export function appendTrace(
  root: string,
  input: TraceAppendInput,
  now: () => Date,
): {
  eventId: string;
  lessonPath: string;
  sourceAnchor: string;
  methods: TraceMethods | null;
  unresolvedMethods: string[];
} {
  const lesson = lessonMetadata(root, input.lessonPath);
  const { lessonPath, lessonId, planId, source } = lesson;
  if (!lessonPath.startsWith('lessons/')) traceError('Trace must belong to a Lesson');
  if (!hasExactBlock(source, input.blockId)) traceError('Block does not exist in Lesson');
  if (!assessments.has(input.assessment)) traceError('Assessment is invalid');
  if (!supports.has(input.support)) traceError('Support is invalid');

  let cardPath: string | null = null;
  let cardStepId: string | null = null;
  if (input.cardAlias === null) {
    if (input.cardStepId !== null) traceError('Card step requires a card alias');
  } else {
    const lessonAliases = readLessonAliases(source);
    const target = lessonAliases.get(input.cardAlias);
    if (target === undefined) {
      const allowed = [...lessonAliases.keys()].sort().join(', ') || '(none)';
      throw new Error(
        `LESSON_ALIAS_MISSING: requested=${input.cardAlias}; allowed=${allowed}; `
        + '这是 Lesson 结构错误，不要搜索、猜测或重试，请返回 Coach 修正源文件',
      );
    }
    const card = sourceResolve(root, { fromPath: lessonPath, target });
    if (!card.valid || card.path === null || !isProblemCard(root, card.path)) {
      throw new Error(
        `LESSON_ALIAS_INVALID: alias=${input.cardAlias}; target=${target}; `
        + '这是 Lesson 结构错误，不要搜索、猜测或重试，请返回 Coach 修正源文件',
      );
    }
    cardPath = card.path;
    if (input.cardStepId !== null) {
      const step = sourceResolve(root, {
        fromPath: lessonPath,
        target: `${target}#step=${input.cardStepId}`,
      });
      if (!step.valid || step.path !== cardPath) traceError('Card step cannot be resolved');
      cardStepId = input.cardStepId;
    }
  }

  const currentRecords = readTraceRecords(root, [lessonPath]);
  if (input.supersedes !== null && !currentRecords.some((record) => record.eventId === input.supersedes)) {
    traceError('Superseded event does not exist in this Lesson');
  }

  const methodResolution = resolveTraceMethods(root, input.methods);

  let maximumEventNumber = 0;
  for (const match of source.matchAll(/^## Trace event-(\d+)[ \t]*$/gm)) {
    maximumEventNumber = Math.max(maximumEventNumber, Number(match[1]));
  }
  const eventId = `event-${String(maximumEventNumber + 1).padStart(3, '0')}`;
  const sourceAnchor = `${lessonPath}#trace-${eventId}`;
  const record: TraceRecord = {
    eventId,
    lessonPath,
    lessonId,
    planId,
    blockId: input.blockId,
    cardPath,
    cardStepId,
    materialPath: input.materialPath,
    assessment: input.assessment,
    support: input.support,
    methods: methodResolution.methods,
    note: input.note,
    supersedes: input.supersedes,
    sourceAnchor,
    recordedAt: now().toISOString(),
  };

  appendFileSync(resolveInsideRoot(root, lessonPath), renderTrace(record), 'utf8');
  return {
    eventId,
    lessonPath,
    sourceAnchor,
    methods: methodResolution.methods,
    unresolvedMethods: methodResolution.unresolved,
  };
}
