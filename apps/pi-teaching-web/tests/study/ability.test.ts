import { expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSetWithHistory } from '../../../../plugins/highschool-study/tests/helpers/learning-set';
import { appendTrace } from 'highschool-study-markdown/study-domain';
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
