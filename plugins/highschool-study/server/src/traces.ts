import { randomUUID } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { basename, extname, relative } from 'node:path';
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

export type TraceAssessment =
  | 'correct'
  | 'partially_correct'
  | 'incorrect'
  | 'incomplete';
export type TraceSupport = 'none' | 'tutor' | 'external';

export type TraceRecord = {
  traceId: string;
  tracePath: string;
  sourceRef: `trace:${string}`;
  planId: string;
  planPath: string;
  lessonId: string;
  lessonPath: string;
  blockId: string;
  cardPath: string | null;
  cardStepId: string | null;
  materialPath: string | null;
  assessment: TraceAssessment;
  support: TraceSupport;
  methods: TraceMethods | null;
  note: string;
  supersedes: string | null;
  occurredAt: string;
};

export type TraceAppendInput = {
  lessonPath: string;
  blockId: string;
  cardAlias: string | null;
  cardStepId: string | null;
  materialPath: string | null;
  assessment: TraceAssessment;
  support: TraceSupport;
  methods?: TraceMethodInput | null | undefined;
  note: string;
  supersedes: string | null;
};

export type TraceAppendResult = TraceRecord & {
  unresolvedMethods: string[];
};

const assessments = new Set<TraceAssessment>([
  'correct',
  'partially_correct',
  'incorrect',
  'incomplete',
]);
const supports = new Set<TraceSupport>(['none', 'tutor', 'external']);
const blockHeading =
  /^## Block ([a-z0-9]+(?:-[a-z0-9]+)*)(?:（[^）]+）)?[ \t]*$/;
const traceIdPattern =
  /^trace-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function traceError(message: string): never {
  throw new Error(`INVALID_TRACE: ${message}`);
}

function canonicalPath(root: string, requestedPath: string): string {
  return relative(
    resolveInsideRoot(root, '.'),
    resolveInsideRoot(root, requestedPath),
  ).replaceAll('\\', '/');
}

function tracePaths(root: string): string[] {
  const directory = resolveInsideRoot(root, 'traces');
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith('.md'))
    .map((entry) => `traces/${entry.name}`)
    .sort();
}

function requiredString(
  frontmatter: Record<string, unknown>,
  key: string,
): string {
  const value = frontmatter[key];
  if (typeof value !== 'string' || !value.trim()) {
    traceError(`Trace ${key} is invalid`);
  }
  return value.trim();
}

function nullableString(
  frontmatter: Record<string, unknown>,
  key: string,
): string | null {
  const value = frontmatter[key];
  if (value === null) return null;
  if (typeof value !== 'string' || !value.trim()) {
    traceError(`Trace ${key} is invalid`);
  }
  return value.trim();
}

function methodsFromBody(body: string): {
  methods: TraceMethods | null;
  note: string;
} {
  if (!/^# Classroom Trace[ \t]*$/m.test(body)) {
    traceError('Classroom Trace title is required');
  }
  const methodMatches = [...body.matchAll(/^## Method Binding[ \t]*$/gm)];
  const observationMatches = [...body.matchAll(/^## Observation[ \t]*$/gm)];
  if (methodMatches.length !== 1 || observationMatches.length !== 1) {
    traceError('Trace sections are invalid');
  }
  const methodMatch = methodMatches[0]!;
  const observationMatch = observationMatches[0]!;
  if (methodMatch.index! >= observationMatch.index!) {
    traceError('Trace sections are invalid');
  }
  const methodBody = body.slice(
    methodMatch.index! + methodMatch[0].length,
    observationMatch.index,
  );
  const primarySource = /^-\s+Primary:\s*(.+?)\s*$/m.exec(methodBody)?.[1];
  const secondarySource = /^-\s+Secondary:\s*(.+?)\s*$/m.exec(methodBody)?.[1];
  if (primarySource === undefined || secondarySource === undefined) {
    traceError('Method Binding is invalid');
  }
  let primary: unknown;
  let secondary: unknown;
  try {
    primary = parse(primarySource);
    secondary = parse(secondarySource);
  } catch {
    traceError('Method Binding is invalid');
  }
  if (
    (primary !== null && (typeof primary !== 'string' || !primary.trim()))
    || !Array.isArray(secondary)
    || !secondary.every((value) => typeof value === 'string' && value.trim())
  ) {
    traceError('Method Binding is invalid');
  }
  const secondaryMethods = (secondary as string[]).map((value) => value.trim());
  if (
    new Set(secondaryMethods).size !== secondaryMethods.length
    || (typeof primary === 'string' && secondaryMethods.includes(primary.trim()))
    || (primary === null && secondaryMethods.length > 0)
  ) {
    traceError('Method Binding is invalid');
  }
  const note = body.slice(
    observationMatch.index! + observationMatch[0].length,
  ).trim();
  if (!note) traceError('Observation is required');
  return {
    methods: typeof primary === 'string'
      ? { primary: primary.trim(), secondary: secondaryMethods }
      : null,
    note,
  };
}

function readTraceFile(root: string, tracePath: string): TraceRecord {
  const document = readMarkdownFile(root, tracePath);
  const frontmatter = document.frontmatter;
  const expectedKeys = [
    'assessment',
    'block_id',
    'card_path',
    'card_step_id',
    'id',
    'kind',
    'lesson_id',
    'lesson_path',
    'material_path',
    'occurred_at',
    'plan_id',
    'plan_path',
    'supersedes',
    'support',
  ];
  if (
    Object.keys(frontmatter).sort().join('\0') !== expectedKeys.sort().join('\0')
    || frontmatter.kind !== 'classroom-trace'
  ) {
    traceError('Trace frontmatter is invalid');
  }
  const traceId = requiredString(frontmatter, 'id');
  const normalizedTracePath = canonicalPath(root, tracePath);
  if (
    !traceIdPattern.test(traceId)
    || basename(normalizedTracePath, '.md') !== traceId
    || normalizedTracePath !== `traces/${traceId}.md`
  ) {
    traceError('Trace identity is invalid');
  }
  const planId = requiredString(frontmatter, 'plan_id');
  const planPath = requiredString(frontmatter, 'plan_path');
  const lessonId = requiredString(frontmatter, 'lesson_id');
  const lessonPath = requiredString(frontmatter, 'lesson_path');
  const blockId = requiredString(frontmatter, 'block_id');
  const occurredAt = requiredString(frontmatter, 'occurred_at');
  const assessment = requiredString(frontmatter, 'assessment');
  const support = requiredString(frontmatter, 'support');
  if (
    planPath !== `plans/${planId}.md`
    || lessonPath !== `lessons/${lessonId}.md`
    || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(blockId)
    || !Number.isFinite(Date.parse(occurredAt))
    || !assessments.has(assessment as TraceAssessment)
    || !supports.has(support as TraceSupport)
  ) {
    traceError('Trace provenance is invalid');
  }
  const { methods, note } = methodsFromBody(document.body);
  return {
    traceId,
    tracePath: normalizedTracePath,
    sourceRef: `trace:${traceId}`,
    planId,
    planPath,
    lessonId,
    lessonPath,
    blockId,
    cardPath: nullableString(frontmatter, 'card_path'),
    cardStepId: nullableString(frontmatter, 'card_step_id'),
    materialPath: nullableString(frontmatter, 'material_path'),
    assessment: assessment as TraceAssessment,
    support: support as TraceSupport,
    methods,
    note,
    supersedes: nullableString(frontmatter, 'supersedes'),
    occurredAt,
  };
}

function compareTrace(left: TraceRecord, right: TraceRecord): number {
  return left.occurredAt < right.occurredAt ? -1
    : left.occurredAt > right.occurredAt ? 1
      : left.traceId < right.traceId ? -1
        : left.traceId > right.traceId ? 1
          : 0;
}

export function readTraceRecords(
  root: string,
  lessonPaths?: string[],
): TraceRecord[] {
  const requestedLessons = lessonPaths === undefined
    ? null
    : new Set(lessonPaths.map((path) => canonicalPath(root, path)));
  return tracePaths(root)
    .map((path) => readTraceFile(root, path))
    .filter((record) => (
      requestedLessons === null || requestedLessons.has(record.lessonPath)
    ))
    .sort(compareTrace);
}

export function readActiveTraces(
  root: string,
  lessonPaths?: string[],
): TraceRecord[] {
  const records = readTraceRecords(root, lessonPaths);
  const ids = new Set(records.map((record) => record.traceId));
  const superseded = new Set(records.flatMap((record) => (
    record.supersedes !== null
      && record.supersedes !== record.traceId
      && ids.has(record.supersedes)
      ? [record.supersedes]
      : []
  )));
  return records.filter((record) => !superseded.has(record.traceId));
}

function lessonMetadata(root: string, requestedPath: string): {
  lessonPath: string;
  lessonId: string;
  planId: string;
  planPath: string;
  source: string;
} {
  const document = readMarkdownFile(root, requestedPath);
  const lessonPath = canonicalPath(root, requestedPath);
  if (
    document.frontmatter.kind !== 'lesson'
    || !document.id
    || lessonPath !== `lessons/${document.id}.md`
  ) {
    traceError('Lesson frontmatter is invalid');
  }
  const planId = document.frontmatter.parent_id;
  const planPath = document.frontmatter.parent_path;
  if (
    typeof planId !== 'string'
    || !planId
    || typeof planPath !== 'string'
    || planPath !== `plans/${planId}.md`
  ) {
    traceError('Lesson parent is invalid');
  }
  return {
    lessonPath,
    lessonId: document.id,
    planId,
    planPath,
    source: readFileSync(document.path, 'utf8'),
  };
}

function hasExactBlock(source: string, blockId: string): boolean {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(blockId)) return false;
  const lines = source.split(/\r?\n/);
  let fence: { marker: '`' | '~'; length: number } | null = null;
  for (const line of lines) {
    const fenceMatch = /^ {0,3}(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence !== null) {
      if (
        fenceMatch?.[1]?.startsWith(fence.marker)
        && fenceMatch[1].length >= fence.length
        && /^[ \t]*$/.test(fenceMatch[2] ?? '')
      ) {
        fence = null;
      }
      continue;
    }
    if (fenceMatch?.[1]) {
      fence = {
        marker: fenceMatch[1][0] as '`' | '~',
        length: fenceMatch[1].length,
      };
      continue;
    }
    if (blockHeading.exec(line)?.[1] === blockId) return true;
  }
  return false;
}

function isProblemCard(root: string, cardPath: string): boolean {
  if (
    !cardPath.startsWith('cards/')
    || !['.yaml', '.yml'].includes(extname(cardPath).toLowerCase())
  ) {
    return false;
  }
  try {
    const card: unknown = parse(
      readFileSync(resolveInsideRoot(root, cardPath), 'utf8'),
    );
    return card !== null
      && typeof card === 'object'
      && !Array.isArray(card)
      && (card as Record<string, unknown>).schema
        === 'highschool-study.problem-card.v1';
  } catch {
    return false;
  }
}

function validateSupersedes(
  records: TraceRecord[],
  input: Pick<TraceAppendInput, 'blockId' | 'supersedes'>,
  lessonId: string,
  cardPath: string | null,
): void {
  if (input.supersedes === null) return;
  const target = records.find((record) => record.traceId === input.supersedes);
  if (!target) traceError('Superseded Trace does not exist');
  const activeIds = new Set(
    readActiveFromRecords(records).map((record) => record.traceId),
  );
  if (!activeIds.has(target.traceId)) {
    traceError(`Superseded Trace must be active: ${target.traceId}`);
  }
  if (target.lessonId !== lessonId || target.blockId !== input.blockId) {
    traceError(
      `Superseded Trace must belong to the same Lesson and Block: `
      + `requested=${lessonId}/${input.blockId}; `
      + `target=${target.lessonId}/${target.blockId}`,
    );
  }
  if (target.cardPath !== cardPath) {
    traceError(
      `Superseded Trace must keep the same card binding: `
      + `requested=${cardPath ?? '(none)'}; `
      + `target=${target.cardPath ?? '(none)'}`,
    );
  }
}

function readActiveFromRecords(records: TraceRecord[]): TraceRecord[] {
  const ids = new Set(records.map((record) => record.traceId));
  const superseded = new Set(records.flatMap((record) => (
    record.supersedes !== null
      && record.supersedes !== record.traceId
      && ids.has(record.supersedes)
      ? [record.supersedes]
      : []
  )));
  return records.filter((record) => !superseded.has(record.traceId));
}

function yamlValue(value: string | null): string {
  return value === null ? 'null' : JSON.stringify(value);
}

function renderTrace(record: TraceRecord): string {
  return [
    '---',
    `id: ${record.traceId}`,
    'kind: classroom-trace',
    `plan_id: ${record.planId}`,
    `plan_path: ${record.planPath}`,
    `lesson_id: ${record.lessonId}`,
    `lesson_path: ${record.lessonPath}`,
    `block_id: ${record.blockId}`,
    `card_path: ${yamlValue(record.cardPath)}`,
    `card_step_id: ${yamlValue(record.cardStepId)}`,
    `material_path: ${yamlValue(record.materialPath)}`,
    `occurred_at: ${record.occurredAt}`,
    `assessment: ${record.assessment}`,
    `support: ${record.support}`,
    `supersedes: ${yamlValue(record.supersedes)}`,
    '---',
    '# Classroom Trace',
    '',
    '## Method Binding',
    '',
    `- Primary: ${
      record.methods === null ? 'null' : JSON.stringify(record.methods.primary)
    }`,
    `- Secondary: ${JSON.stringify(record.methods?.secondary ?? [])}`,
    '',
    '## Observation',
    '',
    record.note,
    '',
  ].join('\n');
}

export function appendTrace(
  root: string,
  input: TraceAppendInput,
  now: () => Date,
  idFactory: () => string = randomUUID,
): TraceAppendResult {
  const lesson = lessonMetadata(root, input.lessonPath);
  if (!hasExactBlock(lesson.source, input.blockId)) {
    traceError('Block does not exist in Lesson');
  }
  if (!assessments.has(input.assessment)) traceError('Assessment is invalid');
  if (!supports.has(input.support)) traceError('Support is invalid');
  if (!input.note.trim()) traceError('Observation is required');

  let cardPath: string | null = null;
  let cardStepId: string | null = null;
  if (input.cardAlias === null) {
    if (input.cardStepId !== null) {
      traceError('Card step requires a card alias');
    }
  } else {
    const lessonAliases = readLessonAliases(lesson.source);
    const target = lessonAliases.get(input.cardAlias);
    if (target === undefined) {
      const allowed = [...lessonAliases.keys()].sort().join(', ') || '(none)';
      throw new Error(
        `LESSON_ALIAS_MISSING: requested=${input.cardAlias}; `
        + `allowed=${allowed}; `
        + '这是 Lesson 结构错误，不要搜索、猜测或重试，请返回 Coach 修正源文件',
      );
    }
    const card = sourceResolve(root, {
      fromPath: lesson.lessonPath,
      target,
    });
    if (!card.valid || card.path === null || !isProblemCard(root, card.path)) {
      throw new Error(
        `LESSON_ALIAS_INVALID: alias=${input.cardAlias}; target=${target}; `
        + '这是 Lesson 结构错误，不要搜索、猜测或重试，请返回 Coach 修正源文件',
      );
    }
    cardPath = card.path;
    if (input.cardStepId !== null) {
      const step = sourceResolve(root, {
        fromPath: lesson.lessonPath,
        target: `${target}#step=${input.cardStepId}`,
      });
      if (!step.valid || step.path !== cardPath) {
        traceError('Card step cannot be resolved');
      }
      cardStepId = input.cardStepId;
    }
  }

  const records = readTraceRecords(root);
  validateSupersedes(
    records,
    input,
    lesson.lessonId,
    cardPath,
  );
  const methodResolution = resolveTraceMethods(root, input.methods);
  const traceId = `trace-${idFactory()}`;
  if (!traceIdPattern.test(traceId)) traceError('Generated Trace ID is invalid');
  const tracePath = `traces/${traceId}.md`;
  const record: TraceRecord = {
    traceId,
    tracePath,
    sourceRef: `trace:${traceId}`,
    planId: lesson.planId,
    planPath: lesson.planPath,
    lessonId: lesson.lessonId,
    lessonPath: lesson.lessonPath,
    blockId: input.blockId,
    cardPath,
    cardStepId,
    materialPath: input.materialPath,
    assessment: input.assessment,
    support: input.support,
    methods: methodResolution.methods,
    note: input.note.trim(),
    supersedes: input.supersedes,
    occurredAt: now().toISOString(),
  };
  mkdirSync(resolveInsideRoot(root, 'traces'), { recursive: true });
  writeFileSync(
    resolveInsideRoot(root, tracePath),
    renderTrace(record),
    { encoding: 'utf8', flag: 'wx' },
  );
  return {
    ...record,
    unresolvedMethods: methodResolution.unresolved,
  };
}
