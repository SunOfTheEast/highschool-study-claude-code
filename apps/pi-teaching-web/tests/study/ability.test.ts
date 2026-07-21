import { expect, test } from 'bun:test';
import { makeLearningSetWithHistory } from '../../../../plugins/highschool-study/tests/helpers/learning-set';
import { readAbilityProjection, readEvidence } from '../../src/study/ability';

const root = makeLearningSetWithHistory();

test('projects weighted method signals into qualitative states', () => {
  const projection = readAbilityProjection(root);
  expect(projection.nodes).toEqual(expect.arrayContaining([
    expect.objectContaining({ method: '冻结变量法', evidenceCount: 2, state: 'unstable' }),
  ]));
});

test('drills one ability source back to its Trace and safe card metadata', () => {
  const evidence = readEvidence(root, 'lessons/lesson-001.md#trace-event-001');
  expect(evidence.trace.lessonId).toBe('lesson-001');
  expect(evidence.card?.methods).toContainEqual({ name: '冻结变量法', role: 'primary' });
  expect(JSON.stringify(evidence)).not.toContain('rubric');
});
