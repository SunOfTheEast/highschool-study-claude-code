import { expect, test } from 'bun:test';
import {
  copyFileSync,
  existsSync,
  readFileSync,
  readdirSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { makeLearningSetWithLesson } from '../helpers/learning-set';
import {
  appendTrace,
  readActiveTraces,
  readTraceRecords,
} from '../../server/src/traces';

const input = {
  lessonPath: 'lessons/lesson-001.md',
  blockId: 'step-02',
  cardAlias: 'Q-FREEZE-01',
  cardStepId: 'identify-freeze',
  materialPath: null,
  assessment: 'partially_correct' as const,
  support: 'tutor' as const,
  note: 'Selected the frozen quantity but missed the domain.',
  supersedes: null,
};

function uuid(index: number): string {
  return `${String(index).padStart(8, '0')}-1111-4111-8111-111111111111`;
}

function traceFiles(root: string): string[] {
  const directory = join(root, 'traces');
  return existsSync(directory)
    ? readdirSync(directory).filter((entry) => entry.endsWith('.md')).sort()
    : [];
}

function addSecondProblemBlock(root: string): void {
  copyFileSync(
    join(
      import.meta.dir,
      '../../subject-packs/highschool-math/cards/conics/freeze-variable-transfer-02.yaml',
    ),
    join(root, 'cards/conics/freeze-variable-transfer-02.yaml'),
  );
  const lessonPath = join(root, 'lessons/lesson-001.md');
  const source = readFileSync(lessonPath, 'utf8')
    .replace(
      '- Q-FREEZE-01: ../cards/conics/freeze-variable-01.yaml',
      [
        '- Q-FREEZE-01: ../cards/conics/freeze-variable-01.yaml',
        '- Q-FREEZE-02: ../cards/conics/freeze-variable-transfer-02.yaml',
      ].join('\n'),
    )
    .replace(
      '## Aliases',
      `## Block step-03

### Node State

- Kind: problem
- Required: true
- Status: pending
- Depends on: step-02
- Uses: Q-FREEZE-02

### Student View

Complete the transfer problem.

### Teacher Control

Observe transfer.

## Aliases`,
    );
  writeFileSync(lessonPath, source);
}

test('writes one immutable global Trace file without modifying the Lesson', () => {
  const root = makeLearningSetWithLesson();
  const lessonPath = join(root, 'lessons/lesson-001.md');
  const lessonBefore = readFileSync(lessonPath, 'utf8');
  const id = uuid(1);

  const trace = appendTrace(
    root,
    input,
    () => new Date('2026-07-30T12:00:00.000Z'),
    () => id,
  );

  expect(trace.traceId).toBe(`trace-${id}`);
  expect(trace.sourceRef).toBe(`trace:trace-${id}`);
  expect(trace.tracePath).toBe(`traces/trace-${id}.md`);
  expect(existsSync(join(root, trace.tracePath))).toBe(true);
  expect(readFileSync(lessonPath, 'utf8')).toBe(lessonBefore);
  expect(readTraceRecords(root)).toEqual([expect.objectContaining({
    traceId: `trace-${id}`,
    planId: 'max-value',
    planPath: 'plans/max-value.md',
    lessonId: 'lesson-001',
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardPath: 'cards/conics/freeze-variable-01.yaml',
    cardStepId: 'identify-freeze',
    occurredAt: '2026-07-30T12:00:00.000Z',
  })]);
});

test('reads only the global pool and ignores legacy Lesson Trace sections', () => {
  const root = makeLearningSetWithLesson();
  const lessonPath = join(root, 'lessons/lesson-001.md');
  writeFileSync(
    lessonPath,
    `${readFileSync(lessonPath, 'utf8')}

## Trace event-001

Recorded at: 2026-07-20T00:00:00.000Z
Assessment: correct
`,
  );
  expect(readTraceRecords(root)).toEqual([]);
});

test('supersedes only the current active Trace from the same Lesson, Block and card', () => {
  const root = makeLearningSetWithLesson();
  const original = appendTrace(
    root,
    input,
    () => new Date('2026-07-30T00:00:00Z'),
    () => uuid(1),
  );
  const correction = appendTrace(root, {
    ...input,
    assessment: 'correct',
    support: 'none',
    note: 'Rechecked the domain and equality condition.',
    supersedes: original.traceId,
  }, () => new Date('2026-07-30T00:05:00Z'), () => uuid(2));

  expect(readTraceRecords(root)).toHaveLength(2);
  expect(readActiveTraces(root)).toEqual([expect.objectContaining({
    traceId: correction.traceId,
    supersedes: original.traceId,
  })]);

  expect(() => appendTrace(root, {
    ...input,
    supersedes: original.traceId,
  }, () => new Date('2026-07-30T00:10:00Z'), () => uuid(3)))
    .toThrow(/INVALID_TRACE.*active/);
  expect(readTraceRecords(root)).toHaveLength(2);
});

test('rejects cross-Block and changed-card corrections', () => {
  const root = makeLearningSetWithLesson();
  addSecondProblemBlock(root);
  const original = appendTrace(
    root,
    input,
    () => new Date('2026-07-30T00:00:00Z'),
    () => uuid(1),
  );

  expect(() => appendTrace(root, {
    ...input,
    blockId: 'step-03',
    cardAlias: 'Q-FREEZE-02',
    cardStepId: null,
    supersedes: original.traceId,
  }, () => new Date('2026-07-30T00:05:00Z'), () => uuid(2)))
    .toThrow(/INVALID_TRACE.*same Lesson and Block/);

  expect(() => appendTrace(root, {
    ...input,
    cardAlias: 'Q-FREEZE-02',
    cardStepId: null,
    supersedes: original.traceId,
  }, () => new Date('2026-07-30T00:05:00Z'), () => uuid(3)))
    .toThrow(/INVALID_TRACE.*same card binding/);
  expect(readTraceRecords(root)).toHaveLength(1);
});

test('stores canonical actual methods without changing assessment', () => {
  const root = makeLearningSetWithLesson();
  writeFileSync(join(root, 'graph/vocabulary.yaml'), `schema: highschool-study.taxonomy.v1
taxonomy_revision_id: taxonomy-conics-v1
nodes:
  - node_id: method.freeze-variable
    facet: method_cluster
    canonical_name: 冻结变量法
    aliases: [冻元法]
`);

  const result = appendTrace(root, {
    ...input,
    assessment: 'incorrect',
    methods: { primary: '冻元法', secondary: ['冻结变量法'] },
  }, () => new Date('2026-07-21T02:00:00Z'), () => uuid(1));

  expect(result).toMatchObject({
    methods: { primary: '冻结变量法', secondary: [] },
    unresolvedMethods: [],
  });
  expect(readActiveTraces(root)[0]).toMatchObject({
    assessment: 'incorrect',
    methods: { primary: '冻结变量法', secondary: [] },
  });
});

test('keeps a Trace when actual method resolution fails', () => {
  const root = makeLearningSetWithLesson();
  const result = appendTrace(root, {
    ...input,
    methods: { primary: '不存在的方法' },
  }, () => new Date('2026-07-21T02:00:00Z'), () => uuid(1));

  expect(result).toMatchObject({
    methods: null,
    unresolvedMethods: ['不存在的方法'],
  });
  expect(readActiveTraces(root)[0]?.methods).toBeNull();
});

test('preserves multiline observations and cardless material evidence', () => {
  const root = makeLearningSetWithLesson();
  const note = [
    'Reviewed a worked example.',
    '',
    '## This remains observation content',
    'Card step: not-a-machine-field',
  ].join('\n');
  appendTrace(root, {
    ...input,
    cardAlias: null,
    cardStepId: null,
    materialPath: 'materials/conics-notes.md',
    assessment: 'incomplete',
    support: 'external',
    note,
  }, () => new Date('2026-07-21T02:00:00Z'), () => uuid(1));

  expect(readActiveTraces(root)[0]).toMatchObject({
    cardPath: null,
    cardStepId: null,
    materialPath: 'materials/conics-notes.md',
    note,
  });
});

test('validates every binding before creating a Trace file', () => {
  const root = makeLearningSetWithLesson();
  const lessonPath = join(root, 'lessons/lesson-001.md');
  const lessonBefore = readFileSync(lessonPath, 'utf8');

  expect(() => appendTrace(
    root,
    { ...input, cardStepId: 'missing-step' },
    () => new Date(),
    () => uuid(1),
  )).toThrow();
  expect(traceFiles(root)).toEqual([]);
  expect(readFileSync(lessonPath, 'utf8')).toBe(lessonBefore);
});

test('uses exclusive creation and never overwrites an existing Trace ID', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(
    root,
    input,
    () => new Date('2026-07-21T02:00:00Z'),
    () => uuid(1),
  );
  const before = readFileSync(
    join(root, 'traces', `trace-${uuid(1)}.md`),
    'utf8',
  );
  expect(() => appendTrace(
    root,
    input,
    () => new Date('2026-07-21T02:05:00Z'),
    () => uuid(1),
  )).toThrow();
  expect(readFileSync(
    join(root, 'traces', `trace-${uuid(1)}.md`),
    'utf8',
  )).toBe(before);
});

test('accepts only exact safe H2 Block headings', () => {
  const cases = [
    { heading: '### Block step-02', blockId: 'step-02' },
    { heading: '## Block [step-02](elsewhere.md)', blockId: 'step-02' },
    { heading: '## Block assessment 01', blockId: 'assessment 01' },
  ];

  for (const [index, invalid] of cases.entries()) {
    const root = makeLearningSetWithLesson();
    const lessonPath = join(root, 'lessons/lesson-001.md');
    const source = readFileSync(lessonPath, 'utf8')
      .replace('## Block step-02', invalid.heading);
    writeFileSync(lessonPath, source);

    expect(() => appendTrace(
      root,
      { ...input, blockId: invalid.blockId },
      () => new Date(),
      () => uuid(index + 1),
    )).toThrow();
    expect(traceFiles(root)).toEqual([]);
  }
});

test('rejects aliases outside cards and files without the problem-card schema', () => {
  const invalidCards = [
    {
      path: 'materials/card-shaped.yaml',
      target: '../materials/card-shaped.yaml',
      source: 'schema: highschool-study.problem-card.v1\n',
    },
    {
      path: 'cards/conics/not-a-card.md',
      target: '../cards/conics/not-a-card.md',
      source: '# Not a problem card\n',
    },
    {
      path: 'cards/conics/not-a-card.yaml',
      target: '../cards/conics/not-a-card.yaml',
      source: 'schema: something-else\n',
    },
  ];

  for (const [index, invalid] of invalidCards.entries()) {
    const root = makeLearningSetWithLesson();
    writeFileSync(join(root, invalid.path), invalid.source);
    const lessonPath = join(root, 'lessons/lesson-001.md');
    const source = readFileSync(lessonPath, 'utf8').replace(
      '../cards/conics/freeze-variable-01.yaml',
      invalid.target,
    );
    writeFileSync(lessonPath, source);

    expect(() => appendTrace(
      root,
      { ...input, cardStepId: null },
      () => new Date(),
      () => uuid(index + 1),
    )).toThrow();
    expect(traceFiles(root)).toEqual([]);
  }
});

test('canonicalizes the owning Lesson path and supports Lesson filters', () => {
  const root = makeLearningSetWithLesson();
  const result = appendTrace(root, {
    ...input,
    lessonPath: 'lessons/../lessons/lesson-001.md',
  }, () => new Date('2026-07-21T02:00:00Z'), () => uuid(1));

  expect(result.lessonPath).toBe('lessons/lesson-001.md');
  expect(readTraceRecords(
    root,
    ['lessons/../lessons/lesson-001.md'],
  )[0]).toMatchObject({
    traceId: `trace-${uuid(1)}`,
    lessonPath: 'lessons/lesson-001.md',
  });
  expect(readTraceRecords(root, ['lessons/missing.md'])).toEqual([]);
});

test('applies supersession independently of timestamp and file order', () => {
  const root = makeLearningSetWithLesson();
  const original = appendTrace(
    root,
    input,
    () => new Date('2026-07-21T02:05:00Z'),
    () => uuid(9),
  );
  const correction = appendTrace(root, {
    ...input,
    note: 'Corrected observation.',
    supersedes: original.traceId,
  }, () => new Date('2026-07-21T02:00:00Z'), () => uuid(1));

  expect(readActiveTraces(root).map((record) => record.traceId))
    .toEqual([correction.traceId]);
});
