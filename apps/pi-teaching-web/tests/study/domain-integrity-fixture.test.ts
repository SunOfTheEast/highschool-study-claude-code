import { expect, test } from 'bun:test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { listCanonicalMethodNames } from 'highschool-study-markdown/study-domain';
import { readLearningSet, readPlanWorkspace } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

test('keeps a canonical hierarchical domain-integrity regression fixture', () => {
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

  expect(listCanonicalMethodNames(domainIntegrityFixtureRoot)).toEqual(
    expect.arrayContaining([
      '切线放缩与凹凸性',
      '参变量分离',
      '同构变形与换元法',
    ]),
  );

  const plan = readFileSync(
    join(domainIntegrityFixtureRoot, 'plans/domain-integrity.md'),
    'utf8',
  );
  expect(plan).toContain('## Lesson Tree');
  expect(plan).not.toContain('## Lesson Index');
  expect(plan).not.toContain('## Next Lesson Candidate');

  for (const id of ['001', '002', '003']) {
    const lesson = readFileSync(
      join(domainIntegrityFixtureRoot, `lessons/lesson-${id}.md`),
      'utf8',
    );
    expect(lesson).toContain('parent_id: domain-integrity');
    expect(lesson).toContain('parent_path: plans/domain-integrity.md');
    expect(lesson).toContain('## Handoff');
    expect(lesson).not.toContain('## Traces');
  }
  expect(readdirSync(join(domainIntegrityFixtureRoot, 'traces')).sort()).toEqual([
    'trace-fixture-001.md',
    'trace-fixture-002.md',
  ]);
});
