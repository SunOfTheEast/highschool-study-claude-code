import { expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readLearningSet,
  readPlanWorkspace,
  readRoadmapWorkspace,
} from '../../src/study/read-workspace';
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
  expect(workspace.plan.planningBasis)
    .toContain('定义域遗漏已经成为稳定阻塞点');
  expect(workspace.plan.currentPosition).toContain('阶段 `1a` 已通过');
  expect(workspace.plan.nextLessonCandidate).toContain('mst_p0032_ex22');
  expect(workspace.plan.planSummary).toContain('定义域意识');
  expect(learningSet.plans[0]?.planningBasis)
    .toBe(workspace.plan.planningBasis);
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

test('reads the optional Roadmap Coach Session without inventing one', () => {
  expect(readRoadmapWorkspace(root)).toEqual({
    learningSet: readLearningSet(root),
    coach: {
      sessionKey: 'coach:@roadmap',
      sessionId: null,
    },
  });
});

test('reads a persisted Roadmap Coach Session ID', () => {
  const copy = mkdtempSync(join(tmpdir(), 'study-roadmap-workspace-'));
  try {
    cpSync(root, copy, { recursive: true });
    const path = join(copy, 'ROADMAP.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        'status: active',
        'status: active\nroadmap_coach_session: roadmap-session-001',
      ),
    );

    expect(readRoadmapWorkspace(copy).coach).toEqual({
      sessionKey: 'coach:@roadmap',
      sessionId: 'roadmap-session-001',
    });
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});

test('rejects a linked legacy Plan instead of projecting an empty rationale', () => {
  const copy = mkdtempSync(join(tmpdir(), 'study-strict-read-'));
  try {
    cpSync(root, copy, { recursive: true });
    const path = join(copy, 'plans/domain-integrity.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8')
        .replace(/\n## Planning Basis[\s\S]*?(?=\n## Lesson Index)/, ''),
    );
    expect(() => readLearningSet(copy)).toThrow(
      'PLAN_SECTION_REQUIRED: plans/domain-integrity.md#planning-basis',
    );
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
