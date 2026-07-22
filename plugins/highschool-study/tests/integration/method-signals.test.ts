import { expect, test } from 'bun:test';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { aggregateMethodSignals } from '../../server/src/method-signals';
import { readActiveTraces } from '../../server/src/traces';
import { makeLearningSetWithHistory } from '../helpers/learning-set';

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
