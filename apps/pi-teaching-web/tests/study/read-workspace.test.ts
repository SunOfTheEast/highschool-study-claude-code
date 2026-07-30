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
import type { LearningReview } from '../../src/shared/contracts';
import { renderLearningReview } from '../../src/study/learning-review';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const root = domainIntegrityFixtureRoot;

test('reads the derivative Roadmap and hierarchical Plan/Lesson trees', () => {
  const learningSet = readLearningSet(root);
  expect(learningSet.title).toBe('导数学习 Roadmap');
  expect(learningSet.overview).toContain('把定义域、同构变形和参数分离');
  expect(learningSet.learningPrinciples).toContain('PUBLIC LEARNING PRINCIPLE');
  expect(learningSet.learningPrinciples).not.toContain('PRIVATE TEACHING NOTE');
  expect(learningSet.plans.map((plan) => plan.id)).toEqual(['domain-integrity']);
  expect(learningSet.planTree).toEqual([
    expect.objectContaining({
      handle: 'plan-candidate-001',
      nodeId: 'domain-integrity',
      status: 'active',
      publicPurpose: '让定义域从附加检查变成解题导航。',
    }),
  ]);

  const workspace = readPlanWorkspace(root, 'domain-integrity');
  expect(workspace.coach.sessionKey).toBe('coach:domain-integrity');
  expect(workspace.plan.planningBasis)
    .toContain('定义域遗漏已经成为稳定阻塞点');
  expect(workspace.plan.currentPosition).toContain('阶段 `1a` 已通过');
  expect(workspace.plan.planSummary).toContain('定义域意识');
  expect(workspace.plan.learningReview).toBeNull();
  expect(learningSet.plans[0]?.planningBasis)
    .toBe(workspace.plan.planningBasis);
  expect(workspace.lessons.map((lesson) => [lesson.id, lesson.status])).toEqual([
    ['lesson-001', 'closed'],
    ['lesson-002', 'closed'],
    ['lesson-003', 'prepared'],
  ]);
  expect(workspace.lessonTree.map(({ handle, nodeId, status }) => ({
    handle,
    nodeId,
    status,
  }))).toEqual([
    { handle: 'lesson-candidate-001', nodeId: 'lesson-001', status: 'closed' },
    { handle: 'lesson-candidate-002', nodeId: 'lesson-002', status: 'closed' },
    { handle: 'lesson-candidate-003', nodeId: 'lesson-003', status: 'prepared' },
  ]);
  expect(workspace.lessons[2]?.blocks.map((block) => block.id)).toEqual([
    'block-001', 'block-002', 'block-003', 'block-004', 'block-005',
  ]);
  expect(workspace.lessons[2]?.blocks.map((block) => block.studentView))
    .toEqual(['', '', '', '', '']);
  expect(workspace.lessons[2]?.blocks.map(({ id, kind, required, dependsOn, uses }) => ({
    id, kind, required, dependsOn, uses,
  }))).toEqual([
    { id: 'block-001', kind: 'dialogue', required: true, dependsOn: [], uses: [] },
    { id: 'block-002', kind: 'problem', required: true, dependsOn: ['block-001'], uses: ['Q-DOMAIN-EX22'] },
    { id: 'block-003', kind: 'problem', required: false, dependsOn: ['block-002'], uses: ['Q-DOMAIN-EX05'] },
    { id: 'block-004', kind: 'problem', required: true, dependsOn: ['block-002'], uses: ['Q-DOMAIN-EX16'] },
    { id: 'block-005', kind: 'reflection', required: true, dependsOn: ['block-004'], uses: [] },
  ]);
});

test('projects a structured completed Learning Review without hiding its Markdown', () => {
  const copy = mkdtempSync(join(tmpdir(), 'study-learning-review-read-'));
  const review: LearningReview = {
    conclusion: '能独立比较两条路线。',
    boundary: '只在当前题型中验证。',
    nextStep: '检查跨题型迁移。',
    keyEvidence: [{
      claim: '无提示完成评估。',
      source: 'lessons/lesson-003.md#trace-event-001',
    }],
    supportingEvidence: [],
    openQuestions: [],
  };
  try {
    cpSync(root, copy, { recursive: true });
    const path = join(copy, 'plans/domain-integrity.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        /(^## Plan Summary\s*$\n)([\s\S]*?)(?=^## |$(?![\s\S]))/m,
        `$1\n${renderLearningReview(review)}`,
      ),
    );

    const plan = readPlanWorkspace(copy, 'domain-integrity').plan;
    expect(plan.learningReview).toEqual(review);
    expect(plan.planSummary).toContain('### 阶段结论');
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
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

test('rejects a linked Plan missing one canonical tree-era section', () => {
  const copy = mkdtempSync(join(tmpdir(), 'study-strict-read-'));
  try {
    cpSync(root, copy, { recursive: true });
    const path = join(copy, 'plans/domain-integrity.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8')
        .replace(/\n## Planning Basis[\s\S]*?(?=\n## Activation Snapshot)/, ''),
    );
    expect(() => readLearningSet(copy)).toThrow(
      'PLAN_SECTION_REQUIRED: plans/domain-integrity.md#planning-basis',
    );
  } finally {
    rmSync(copy, { recursive: true, force: true });
  }
});
