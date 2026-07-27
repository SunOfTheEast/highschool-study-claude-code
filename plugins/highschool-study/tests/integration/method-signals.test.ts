import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { appendCardAlternative } from '../../server/src/alternatives';
import { aggregateMethodSignals } from '../../server/src/method-signals';
import {
  appendCardAlternativeWithProjection,
  appendTraceWithProjection,
} from '../../server/src/planner-attention';
import { appendTrace, readActiveTraces } from '../../server/src/traces';
import {
  makeLearningSetWithHistory,
  makeLearningSetWithLesson,
} from '../helpers/learning-set';

const packageRoot = join(import.meta.dir, '../..');

test('collapses active step Traces into one card attempt', () => {
  const root = makeLearningSetWithHistory();
  const active = readActiveTraces(root);
  const cardTrace = active.find((trace) => trace.cardPath !== null)!;
  const signals = aggregateMethodSignals(root, [
    ...active,
    { ...cardTrace, cardPath: 'cards/conics/missing.yaml', sourceAnchor: 'lessons/missing.md#trace-event-999' },
  ]);

  expect(signals).toEqual([
    {
      method: '冻结变量法',
      evidenceWeight: 2,
      earnedWeight: 1,
      score: 0.5,
      attemptCount: 1,
      distinctCardCount: 1,
      sourceRefs: [
        'lessons/lesson-001.md#trace-event-001',
        'lessons/lesson-001.md#trace-event-003',
      ],
    },
    {
      method: '参数化与消元',
      evidenceWeight: 1,
      earnedWeight: 0.5,
      score: 0.5,
      attemptCount: 1,
      distinctCardCount: 1,
      sourceRefs: [
        'lessons/lesson-001.md#trace-event-001',
        'lessons/lesson-001.md#trace-event-003',
      ],
    },
  ]);
});

test('averages active step evidence within one card attempt', () => {
  const root = makeLearningSetWithHistory();
  const cardTrace = readActiveTraces(root).find((trace) => trace.cardPath !== null)!;
  const variants = [
    { assessment: 'correct' as const, support: 'none' as const },
    { assessment: 'partially_correct' as const, support: 'tutor' as const },
  ].map((variant, index) => ({
    ...cardTrace,
    ...variant,
    eventId: `event-average-${index}`,
    sourceAnchor: `lessons/lesson-001.md#trace-average-${index}`,
  }));

  expect(aggregateMethodSignals(root, variants)).toEqual([
    expect.objectContaining({
      method: '冻结变量法',
      evidenceWeight: 2,
      earnedWeight: 1.25,
      score: 0.625,
      attemptCount: 1,
      distinctCardCount: 1,
    }),
    expect.objectContaining({
      method: '参数化与消元',
      evidenceWeight: 1,
      earnedWeight: 0.625,
      score: 0.625,
      attemptCount: 1,
      distinctCardCount: 1,
    }),
  ]);
});

test('attributes evidence to actual Trace methods instead of card declarations', () => {
  const root = makeLearningSetWithHistory();
  const cardTrace = readActiveTraces(root).find((trace) => trace.cardPath !== null)!;

  expect(aggregateMethodSignals(root, [{
    ...cardTrace,
    methods: { primary: '参数化与消元', secondary: [] },
  }])).toEqual([expect.objectContaining({
    method: '参数化与消元',
    evidenceWeight: 2,
    earnedWeight: 1,
    attemptCount: 1,
    distinctCardCount: 1,
  })]);
  expect(aggregateMethodSignals(root, [{ ...cardTrace, methods: null }])).toEqual([]);
});

test('promotes a method from secondary to primary within one attempt', () => {
  const root = makeLearningSetWithHistory();
  const cardTrace = readActiveTraces(root).find((trace) => trace.cardPath !== null)!;
  const signals = aggregateMethodSignals(root, [
    {
      ...cardTrace,
      methods: { primary: '冻结变量法', secondary: ['参数化与消元'] },
    },
    {
      ...cardTrace,
      eventId: 'event-promoted',
      sourceAnchor: 'lessons/lesson-001.md#trace-event-promoted',
      methods: { primary: '参数化与消元', secondary: [] },
    },
  ]);

  expect(signals).toEqual([
    expect.objectContaining({ method: '冻结变量法', evidenceWeight: 2, attemptCount: 1 }),
    expect.objectContaining({ method: '参数化与消元', evidenceWeight: 2, attemptCount: 1 }),
  ]);
});

test('combines assessment and support factors across distinct attempts', () => {
  const root = makeLearningSetWithHistory();
  const cardTrace = readActiveTraces(root).find((trace) => trace.cardPath !== null)!;
  const variants = [
    { assessment: 'correct' as const, support: 'none' as const },
    { assessment: 'partially_correct' as const, support: 'tutor' as const },
    { assessment: 'correct' as const, support: 'external' as const },
    { assessment: 'incorrect' as const, support: 'none' as const },
    { assessment: 'incomplete' as const, support: 'none' as const },
  ].map((variant, index) => ({
    ...cardTrace,
    ...variant,
    eventId: `event-factor-${index}`,
    blockId: `step-factor-${index}`,
    sourceAnchor: `lessons/lesson-001.md#trace-factor-${index}`,
  }));

  expect(aggregateMethodSignals(root, variants)).toEqual([
    expect.objectContaining({
      method: '冻结变量法',
      evidenceWeight: 10,
      earnedWeight: 4,
      score: 0.4,
      attemptCount: 5,
      distinctCardCount: 1,
    }),
    expect.objectContaining({
      method: '参数化与消元',
      evidenceWeight: 5,
      earnedWeight: 2,
      score: 0.4,
      attemptCount: 5,
      distinctCardCount: 1,
    }),
  ]);
});

test('counts distinct card paths independently from attempts', () => {
  const root = makeLearningSetWithHistory();
  const cardTrace = readActiveTraces(root).find((trace) => trace.cardPath !== null)!;
  const signals = aggregateMethodSignals(root, [
    { ...cardTrace, assessment: 'correct', sourceAnchor: 'lessons/lesson-001.md#trace-card-1' },
    {
      ...cardTrace,
      assessment: 'correct',
      cardPath: 'cards/conics/freeze-variable-transfer-02.yaml',
      sourceAnchor: 'lessons/lesson-001.md#trace-card-2',
    },
  ]);

  expect(signals).toEqual([
    expect.objectContaining({ method: '冻结变量法', attemptCount: 2, distinctCardCount: 2 }),
    expect.objectContaining({ method: '参数化与消元', attemptCount: 2, distinctCardCount: 2 }),
  ]);
});

test('projects an alternative own method and ignores an unmapped alternative', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-FREEZE-01',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'tutor',
    note: 'Completed the reference route with Tutor support.',
    supersedes: null,
    methods: { primary: '冻结变量法', secondary: [] },
  }, () => new Date('2026-07-21T02:00:00Z'));
  appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '独立完成参数化与消元路线。',
    method: '参数化与消元',
    support: 'none',
  }, () => new Date('2026-07-21T02:01:00Z'));
  appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '另一条暂未归类的路线。',
    method: null,
    support: 'none',
  }, () => new Date('2026-07-21T02:02:00Z'));

  const signals = aggregateMethodSignals(root, readActiveTraces(root));
  expect(signals).toHaveLength(2);
  expect(signals).toEqual(expect.arrayContaining([
    expect.objectContaining({
      method: '参数化与消元',
      evidenceWeight: 2,
      earnedWeight: 2,
      score: 1,
      attemptCount: 1,
      distinctCardCount: 1,
    }),
    expect.objectContaining({
      method: '冻结变量法',
      evidenceWeight: 2,
      earnedWeight: 1,
      score: 0.5,
      attemptCount: 1,
      distinctCardCount: 1,
    }),
  ]));
});

test('keeps one strongest method contribution per card attempt', () => {
  const root = makeLearningSetWithLesson();
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-FREEZE-01',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'tutor',
    note: 'Completed one supported route.',
    supersedes: null,
    methods: { primary: '冻结变量法', secondary: [] },
  }, () => new Date('2026-07-21T02:00:00Z'));
  appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: 'Tutor 支持下的另一路线。',
    method: '冻结变量法',
    support: 'tutor',
  }, () => new Date('2026-07-21T02:01:00Z'));
  appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '无提示完成的另一条路线。',
    method: '冻结变量法',
    support: 'none',
  }, () => new Date('2026-07-21T02:02:00Z'));

  expect(aggregateMethodSignals(root, readActiveTraces(root))).toEqual([
    expect.objectContaining({
      method: '冻结变量法',
      evidenceWeight: 2,
      earnedWeight: 2,
      score: 1,
      attemptCount: 1,
      distinctCardCount: 1,
    }),
  ]);
});

test('keeps a superseded-source alternative in its sidecar but removes its projection', () => {
  const root = makeLearningSetWithLesson();
  const lessonPath = join(root, 'lessons/lesson-001.md');
  writeFileSync(
    lessonPath,
    `${readFileSync(lessonPath, 'utf8').trimEnd()}\n\n## Lesson Summary\n\n关课快照不变。\n`,
  );
  const planPath = join(root, 'plans/max-value.md');
  writeFileSync(planPath, `---
id: max-value
kind: plan
status: active
---
# Plan：最值

## Goal

完成当前测试 Plan。

## Observable Capability Standard

满足本测试声明的可观察行为。

## Test

完成一次与该能力标准对应的验证。

## Planning Basis

当前测试需要一份完整 Plan。来源：[Roadmap](../ROADMAP.md#plan-graph)。

## Lesson Index

尚未创建 Lesson。

## Current Position

Coach 上次确认的位置。

## Next Lesson Candidate

保持原候选。

## Plan Summary

Coach 上次确认的决定。
`);
  const input = {
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
  appendTraceWithProjection(root, input, () => new Date('2026-07-21T02:00:00Z'));
  appendCardAlternativeWithProjection(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '参数化与消元的完整路线。',
    method: '参数化与消元',
    support: 'none',
  }, () => new Date('2026-07-21T02:01:00Z'));

  const sidecarPath = join(root, 'cards/conics/freeze-variable-01.alternatives.md');
  const studentPath = join(root, 'memory/student-profile.md');
  const teachingPath = join(root, 'memory/teaching-profile.md');
  const sidecarBefore = readFileSync(sidecarPath);
  const planBefore = readFileSync(planPath);
  const studentBefore = readFileSync(studentPath);
  const teachingBefore = readFileSync(teachingPath);
  expect(readFileSync(join(root, 'memory/planner-attention.md'), 'utf8'))
    .toContain('参数化与消元');

  appendTraceWithProjection(root, {
    ...input,
    note: 'Corrected the same attempt and withdrew the recorded route.',
    supersedes: 'event-001',
  }, () => new Date('2026-07-21T02:02:00Z'));

  const lesson = readFileSync(lessonPath, 'utf8');
  expect(aggregateMethodSignals(root, readActiveTraces(root))).toEqual([]);
  expect(readFileSync(join(root, 'memory/planner-attention.md'), 'utf8'))
    .not.toContain('参数化与消元');
  expect(readFileSync(sidecarPath)).toEqual(sidecarBefore);
  expect(readFileSync(planPath)).toEqual(planBefore);
  expect(readFileSync(studentPath)).toEqual(studentBefore);
  expect(readFileSync(teachingPath)).toEqual(teachingBefore);
  expect(lesson).toContain('## Lesson Summary\n\n关课快照不变。');
});

test('rebuild script rewrites only planner attention with source links', () => {
  const root = makeLearningSetWithHistory();
  const studentPath = join(root, 'memory/student-profile.md');
  const teachingPath = join(root, 'memory/teaching-profile.md');
  const studentBefore = readFileSync(studentPath);
  const teachingBefore = readFileSync(teachingPath);

  const run = spawnSync(process.execPath, ['run', 'scripts/rebuild-planner-attention.ts'], {
    cwd: packageRoot,
    env: { ...process.env, STUDY_LEARNING_SET: root },
    encoding: 'utf8',
  });
  expect(run.status, run.stderr).toBe(0);

  const planner = readFileSync(join(root, 'memory/planner-attention.md'), 'utf8');
  expect(planner).toContain('Uncalibrated preparation signal; not a mastery claim.');
  expect(planner).toContain('冻结变量法');
  expect(planner).toContain('参数化与消元');
  expect(planner).toContain('attempts 1; cards 1');
  expect(planner).toContain('../lessons/lesson-001.md#trace-event-001');
  expect(planner).toContain('../lessons/lesson-001.md#trace-event-003');
  expect(planner).not.toContain('trace-event-002');
  expect(readFileSync(studentPath)).toEqual(studentBefore);
  expect(readFileSync(teachingPath)).toEqual(teachingBefore);
});
