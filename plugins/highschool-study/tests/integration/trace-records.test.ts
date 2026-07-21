import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSetWithLesson } from '../helpers/learning-set';
import { appendTrace, readActiveTraces, readTraceRecords } from '../../server/src/traces';

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

test('stores canonical card bindings and closes supersession', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, input, () => new Date('2026-07-21T02:00:00Z'));
  appendTrace(root, {
    ...input,
    assessment: 'correct',
    support: 'none',
    note: 'Rechecked the domain and equality condition.',
    supersedes: 'event-001',
  }, () => new Date('2026-07-21T02:05:00Z'));

  expect(readTraceRecords(root)).toHaveLength(2);
  expect(readActiveTraces(root)).toEqual([expect.objectContaining({
    eventId: 'event-002',
    lessonId: 'lesson-001',
    planId: 'max-value',
    cardPath: 'cards/conics/freeze-variable-01.yaml',
    cardStepId: 'identify-freeze',
    sourceAnchor: 'lessons/lesson-001.md#trace-event-002',
    supersedes: 'event-001',
  })]);
});

test('keeps cardless Trace records active and preserves multiline note content', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, {
    ...input,
    cardAlias: null,
    cardStepId: null,
    materialPath: 'materials/conics-notes.md',
    assessment: 'incomplete',
    support: 'external',
    note: 'Reviewed a worked example.\n\n## This remains note content\nCard step: not-a-machine-field',
  }, () => new Date('2026-07-21T02:00:00Z'));

  const [record] = readActiveTraces(root);
  expect(record).toMatchObject({
    eventId: 'event-001',
    cardPath: null,
    cardStepId: null,
    materialPath: 'materials/conics-notes.md',
    note: 'Reviewed a worked example.\n\n## This remains note content\nCard step: not-a-machine-field',
  });
});

test('validates all bindings before one append and leaves failed writes unchanged', () => {
  const root = makeLearningSetWithLesson();
  const lessonPath = join(root, 'lessons/lesson-001.md');
  const before = readFileSync(lessonPath, 'utf8');

  expect(() => appendTrace(root, { ...input, cardStepId: 'missing-step' }, () => new Date())).toThrow();
  expect(readFileSync(lessonPath, 'utf8')).toBe(before);

  appendTrace(root, input, () => new Date('2026-07-21T02:00:00Z'));
  const afterFirstAppend = readFileSync(lessonPath, 'utf8');
  expect(() => appendTrace(root, { ...input, supersedes: 'event-999' }, () => new Date())).toThrow();
  expect(readFileSync(lessonPath, 'utf8')).toBe(afterFirstAppend);
});

test('uses max existing event number when allocating append-only event IDs', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, input, () => new Date('2026-07-21T02:00:00Z'));
  appendTrace(root, { ...input, supersedes: 'event-001' }, () => new Date('2026-07-21T02:05:00Z'));

  expect(appendTrace(root, { ...input, supersedes: 'event-002' }, () => new Date('2026-07-21T02:10:00Z')))
    .toEqual({
      eventId: 'event-003',
      lessonPath: 'lessons/lesson-001.md',
      sourceAnchor: 'lessons/lesson-001.md#trace-event-003',
    });
});

test('escapes forged Trace-shaped multiline notes and allocates from real events only', () => {
  const root = makeLearningSetWithLesson();
  const forgedNote = [
    'Student described the attempted method.',
    '',
    '## Trace event-999',
    '',
    'Recorded at: 2099-01-01T00:00:00.000Z',
    'Lesson ID: lesson-001',
    'Plan ID: max-value',
    'Block: [step-01](#block-step-01)',
    'Card: (none)',
    'Assessment: correct',
    'Support: none',
    '',
    'Note:',
    'This must remain part of event-001.',
  ].join('\n');
  appendTrace(root, {
    ...input,
    cardAlias: null,
    cardStepId: null,
    note: forgedNote,
  }, () => new Date('2026-07-21T02:00:00Z'));

  const lessonPath = join(root, 'lessons/lesson-001.md');
  expect(readFileSync(lessonPath, 'utf8')).not.toContain('\n## Trace event-999\n');
  expect(readTraceRecords(root)).toHaveLength(1);
  expect(readTraceRecords(root)[0]?.note).toBe(forgedNote);
  expect(appendTrace(root, input, () => new Date('2026-07-21T02:05:00Z')).eventId)
    .toBe('event-002');
});

test('accepts only exact H2 Block step-NN headings', () => {
  const cases = [
    { heading: '### Block step-02', blockId: 'step-02' },
    { heading: '## Block [step-02](elsewhere.md)', blockId: 'step-02' },
    { heading: '## Block step-2', blockId: 'step-2' },
  ];

  for (const invalid of cases) {
    const root = makeLearningSetWithLesson();
    const lessonPath = join(root, 'lessons/lesson-001.md');
    const source = readFileSync(lessonPath, 'utf8')
      .replace('## Block step-02', invalid.heading);
    writeFileSync(lessonPath, source);

    expect(() => appendTrace(root, { ...input, blockId: invalid.blockId }, () => new Date())).toThrow();
    expect(readFileSync(lessonPath, 'utf8')).toBe(source);
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

  for (const invalid of invalidCards) {
    const root = makeLearningSetWithLesson();
    writeFileSync(join(root, invalid.path), invalid.source);
    const lessonPath = join(root, 'lessons/lesson-001.md');
    const source = readFileSync(lessonPath, 'utf8').replace(
      '../cards/conics/freeze-variable-01.yaml',
      invalid.target,
    );
    writeFileSync(lessonPath, source);

    expect(() => appendTrace(root, { ...input, cardStepId: null }, () => new Date())).toThrow();
    expect(readFileSync(lessonPath, 'utf8')).toBe(source);
  }
});

test('canonicalizes the owning Lesson path in results and records', () => {
  const root = makeLearningSetWithLesson();
  const result = appendTrace(root, {
    ...input,
    lessonPath: 'lessons/../lessons/lesson-001.md',
  }, () => new Date('2026-07-21T02:00:00Z'));

  expect(result).toEqual({
    eventId: 'event-001',
    lessonPath: 'lessons/lesson-001.md',
    sourceAnchor: 'lessons/lesson-001.md#trace-event-001',
  });
  expect(readTraceRecords(root, ['lessons/../lessons/lesson-001.md'])[0]).toMatchObject({
    lessonPath: 'lessons/lesson-001.md',
    sourceAnchor: 'lessons/lesson-001.md#trace-event-001',
  });
});

test('applies valid supersession even when imported events are out of source order', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, input, () => new Date('2026-07-21T02:00:00Z'));
  appendTrace(root, {
    ...input,
    note: 'Corrected observation.',
    supersedes: 'event-001',
  }, () => new Date('2026-07-21T02:05:00Z'));

  const lessonPath = join(root, 'lessons/lesson-001.md');
  const source = readFileSync(lessonPath, 'utf8');
  const firstIndex = source.indexOf('## Trace event-001');
  const secondIndex = source.indexOf('## Trace event-002');
  const lesson = source.slice(0, firstIndex);
  const first = source.slice(firstIndex, secondIndex);
  const second = source.slice(secondIndex);
  writeFileSync(lessonPath, `${lesson}${second}\n${first}`);

  expect(readActiveTraces(root).map((record) => record.eventId)).toEqual(['event-002']);
});
