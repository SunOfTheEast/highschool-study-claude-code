import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readLearningSet, readPlanWorkspace } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

test('keeps the old domain-integrity state in an isolated regression fixture', () => {
  const learningSet = readLearningSet(domainIntegrityFixtureRoot);
  expect(learningSet.plans.map((plan) => plan.id)).toEqual(['domain-integrity']);

  const workspace = readPlanWorkspace(domainIntegrityFixtureRoot, 'domain-integrity');
  expect(workspace.lessons.map((lesson) => [lesson.id, lesson.status])).toEqual([
    ['lesson-001', 'closed'],
    ['lesson-002', 'closed'],
    ['lesson-003', 'prepared'],
  ]);

  expect(readdirSync(join(domainIntegrityFixtureRoot, 'cards/derivative')).sort()).toEqual([
    'mst_p0017_ex05.card.yaml',
    'mst_p0019_ex11.card.yaml',
    'mst_p0030_ex16.card.yaml',
    'mst_p0032_ex22.card.yaml',
  ]);

  for (const path of [
    'plans/domain-integrity.md',
    'lessons/lesson-001.md',
    'lessons/lesson-002.md',
    'lessons/lesson-003.md',
  ]) {
    expect(readFileSync(join(domainIntegrityFixtureRoot, path), 'utf8'))
      .not.toMatch(/^(coach_session|tutor_session):/m);
  }
});
