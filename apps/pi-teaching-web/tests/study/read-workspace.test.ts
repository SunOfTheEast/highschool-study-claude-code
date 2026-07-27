import { expect, test } from 'bun:test';
import { readLearningSet, readPlanWorkspace } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const root = domainIntegrityFixtureRoot;

test('reads the derivative Roadmap and Plan lesson index', () => {
  const learningSet = readLearningSet(root);
  expect(learningSet.title).toBe('导数学习 Roadmap');
  expect(learningSet.overview).toContain('把定义域、同构变形和参数分离');
  expect(learningSet.learningPrinciples).toContain('PUBLIC LEARNING PRINCIPLE');
  expect(learningSet.learningPrinciples).not.toContain('PRIVATE TEACHING NOTE');
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
  expect(workspace.lessons[2]?.blocks.map((block) => block.studentView))
    .toEqual(['', '', '', '', '']);
  expect(workspace.lessons[2]?.blocks.map(({ id, kind, required, dependsOn, uses }) => ({
    id, kind, required, dependsOn, uses,
  }))).toEqual([
    { id: 'orientation', kind: 'dialogue', required: true, dependsOn: [], uses: [] },
    { id: 'assessment-01', kind: 'problem', required: true, dependsOn: ['orientation'], uses: ['Q-DOMAIN-EX22'] },
    { id: 'repair-optional', kind: 'problem', required: false, dependsOn: ['assessment-01'], uses: ['Q-DOMAIN-EX05'] },
    { id: 'assessment-02', kind: 'problem', required: true, dependsOn: ['assessment-01'], uses: ['Q-DOMAIN-EX16'] },
    { id: 'reflection', kind: 'reflection', required: true, dependsOn: ['assessment-02'], uses: [] },
  ]);
});
