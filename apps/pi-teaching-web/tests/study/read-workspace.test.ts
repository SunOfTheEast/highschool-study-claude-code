import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { readLearningSet, readPlanWorkspace } from '../../src/study/read-workspace';

const root = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');

test('reads the derivative Roadmap and Plan lesson index', () => {
  const learningSet = readLearningSet(root);
  expect(learningSet.title).toBe('导数学习 Roadmap');
  expect(learningSet.overview).toContain('把定义域、同构变形和参数分离');
  expect(learningSet.plans.map((plan) => plan.id)).toEqual(['domain-integrity']);

  const workspace = readPlanWorkspace(root, 'domain-integrity');
  expect(workspace.coach.sessionKey).toBe('coach:domain-integrity');
  expect(workspace.lessons.map((lesson) => [lesson.id, lesson.status])).toEqual([
    ['lesson-001', 'closed'],
    ['lesson-002', 'closed'],
    ['lesson-003', 'prepared'],
  ]);
  expect(workspace.lessons[2]?.blocks.map((block) => block.id)).toEqual([
    'orientation', 'assessment-01', 'repair-optional', 'assessment-02', 'reflection',
  ]);
  expect(workspace.lessons[2]?.blocks[1]?.studentView).toContain('Q-DOMAIN-EX22');
});
