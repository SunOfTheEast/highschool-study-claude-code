import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  makeLearningSetWithHistory,
  makeLearningSetWithLesson,
} from '../../../../plugins/highschool-study/tests/helpers/learning-set';
import {
  appendCardAlternative,
  appendTrace,
} from 'highschool-study-markdown/study-domain';
import { readAbilityProjection, readEvidence } from '../../src/study/ability';

test('projects weighted method signals into qualitative states', () => {
  const root = makeLearningSetWithHistory();
  const projection = readAbilityProjection(root);
  expect(projection.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ method: '冻结变量法', evidenceCount: 1, state: 'unstable' }),
  ]));
});

test('requires evidence from two different cards before a method is steady', () => {
  const root = makeLearningSetWithHistory();
  const lessonPath = join(root, 'lessons/lesson-001.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8').replace(
      '\n## Trace event-001',
      '\n- Q-TRANSFER-02: ../cards/conics/freeze-variable-transfer-02.yaml\n\n## Trace event-001',
    ),
  );
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-01',
    cardAlias: 'Q-TRANSFER-02',
    cardStepId: 'identify-freeze',
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: 'Completed an independent transfer attempt.',
    supersedes: null,
    methods: { primary: '冻结变量法', secondary: ['参数化与消元'] },
  }, () => new Date('2026-07-22T01:00:00Z'));

  const projection = readAbilityProjection(root);
  expect(projection.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({
      method: '冻结变量法',
      evidenceCount: 2,
      score: 0.75,
      state: 'steady',
    }),
  ]));
});

test('drills one ability source back to its Trace and safe card metadata', () => {
  const root = makeLearningSetWithHistory();
  const evidence = readEvidence(root, 'lessons/lesson-001.md#trace-event-001');
  expect(evidence.trace.lessonId).toBe('lesson-001');
  expect(evidence.card?.methods).toContainEqual({ name: '冻结变量法', role: 'primary' });
  expect(JSON.stringify(evidence)).not.toContain('rubric');
});

test('projects a confirmed alternative method into the ability map', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-FREEZE-01',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: 'Completed an alternative route.',
    supersedes: null,
    methods: null,
  }, () => new Date('2026-07-22T01:00:00Z'));
  appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '参数化与消元的完整路线。',
    method: '参数化与消元',
    support: 'none',
  }, () => new Date('2026-07-22T01:01:00Z'));

  expect(readAbilityProjection(root).nodes).toEqual([
    expect.objectContaining({
      method: '参数化与消元',
      evidenceCount: 1,
      score: 1,
      state: 'unstable',
    }),
  ]);
});

test('drills a durable alternative source after its Trace is superseded', () => {
  const root = makeLearningSetWithLesson();
  const traceInput = {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-FREEZE-01',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct' as const,
    support: 'none' as const,
    note: 'Completed an alternative route.',
    supersedes: null,
    methods: null,
  };
  appendTrace(root, traceInput, () => new Date('2026-07-22T01:00:00Z'));
  const alternative = appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '参数化与消元的完整路线。',
    method: '参数化与消元',
    support: 'none',
  }, () => new Date('2026-07-22T01:01:00Z'));
  appendTrace(root, {
    ...traceInput,
    note: 'Corrected the classroom observation.',
    supersedes: 'event-001',
  }, () => new Date('2026-07-22T01:02:00Z'));

  expect(readEvidence(root, alternative.sourceTrace).trace.blockId).toBe('step-02');
});
