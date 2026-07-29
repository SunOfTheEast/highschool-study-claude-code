import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { appendTrace } from 'highschool-study-markdown/study-domain';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

type LearningReview = {
  conclusion: string;
  boundary: string;
  nextStep: string;
  keyEvidence: Array<{ claim: string; source: string }>;
  supportingEvidence: Array<{
    claim: string;
    source: string;
    limitation: string;
  }>;
  openQuestions: Array<{ question: string; nextCheck: string }>;
};

type LearningReviewModule = {
  renderLearningReview(review: LearningReview): string;
  parseLearningReview(source: string): LearningReview | null;
  validateLearningReviewSources(
    root: string,
    planPath: string,
    review: LearningReview,
  ): void;
};

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const temporaryRoot of temporaryRoots.splice(0)) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

async function moduleUnderTest(): Promise<LearningReviewModule | null> {
  try {
    return await import('../../src/study/learning-review') as LearningReviewModule;
  } catch {
    return null;
  }
}

function review(
  keySource = 'lessons/lesson-003.md#trace-event-001',
  supportingSource = 'lessons/lesson-003.md#trace-event-002',
): LearningReview {
  return {
    conclusion: '能在限定题型中独立比较两条路线的代价。',
    boundary: '目前只覆盖两类参数函数，关键结论来自一张无提示题卡；迁移尚未验证。',
    nextStep: '回到 Roadmap 讨论跨题型迁移。',
    keyEvidence: [{
      claim: '能独立放弃高代价路线并完成低代价路线。',
      source: keySource,
    }],
    supportingEvidence: [{
      claim: '提示后能识别隐藏同构。',
      source: supportingSource,
      limitation: 'Tutor 给过方向性提示。',
    }],
    openQuestions: [{
      question: '跨章节时是否仍能主动比较路线？',
      nextCheck: '下一 Plan 安排一题非函数综合题。',
    }],
  };
}

function tracedFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'learning-review-'));
  temporaryRoots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  appendTrace(root, {
    lessonPath: 'lessons/lesson-003.md',
    blockId: 'assessment-01',
    cardAlias: 'Q-DOMAIN-EX22',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成第一道评估题。',
    supersedes: null,
  }, () => new Date('2026-07-29T08:00:00Z'));
  appendTrace(root, {
    lessonPath: 'lessons/lesson-003.md',
    blockId: 'assessment-02',
    cardAlias: 'Q-DOMAIN-EX16',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'tutor',
    note: '学生在一个方向性提示后完成第二题。',
    supersedes: null,
  }, () => new Date('2026-07-29T08:05:00Z'));
  return root;
}

test('round-trips one bounded learning review through Plan Summary Markdown', async () => {
  const value = await moduleUnderTest();
  expect(value).not.toBeNull();
  if (!value) return;
  const expected = review();

  const source = value.renderLearningReview(expected);

  expect(source).toContain('### 阶段结论');
  expect(source).toContain('### 适用范围');
  expect(source).toContain('- 来源：lessons/lesson-003.md#trace-event-001');
  expect(value.parseLearningReview(source)).toEqual(expected);
  expect(value.parseLearningReview('普通进行中摘要。')).toBeNull();
  expect(value.parseLearningReview(
    value.renderLearningReview({ ...expected, openQuestions: [] }),
  )).toEqual({ ...expected, openQuestions: [] });
});

test('accepts active independent assessment evidence and supported reference evidence', async () => {
  const value = await moduleUnderTest();
  expect(value).not.toBeNull();
  if (!value) return;
  const root = tracedFixture();

  expect(() => value.validateLearningReviewSources(
    root,
    'plans/domain-integrity.md',
    review(),
  )).not.toThrow();
});

test('rejects stale, cross-Plan, supported, and non-assessment key evidence', async () => {
  const value = await moduleUnderTest();
  expect(value).not.toBeNull();
  if (!value) return;
  const root = tracedFixture();

  expect(() => value.validateLearningReviewSources(
    root,
    'plans/domain-integrity.md',
    {
      ...review(),
      keyEvidence: [{
        claim: '错误地把提示后表现当关键证据。',
        source: 'lessons/lesson-003.md#trace-event-002',
      }],
      supportingEvidence: [],
    },
  )).toThrow('LEARNING_REVIEW_KEY_SUPPORT_REQUIRED_NONE');

  appendTrace(root, {
    lessonPath: 'lessons/lesson-003.md',
    blockId: 'assessment-01',
    cardAlias: 'Q-DOMAIN-EX22',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: '学生更正了第一题的记录。',
    supersedes: 'event-001',
  }, () => new Date('2026-07-29T08:10:00Z'));
  expect(() => value.validateLearningReviewSources(
    root,
    'plans/domain-integrity.md',
    review('lessons/lesson-003.md#trace-event-001'),
  )).toThrow('LEARNING_REVIEW_SOURCE_NOT_ACTIVE');

  const lessonPath = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8').replace(
      '- Primary template: `assessment`',
      '- Primary template: `concept`',
    ),
  );
  expect(() => value.validateLearningReviewSources(
    root,
    'plans/domain-integrity.md',
    {
      ...review('lessons/lesson-003.md#trace-event-003'),
      supportingEvidence: [],
    },
  )).toThrow('LEARNING_REVIEW_KEY_NOT_ASSESSMENT');

  const foreignPath = join(root, 'lessons/lesson-foreign.md');
  writeFileSync(
    foreignPath,
    readFileSync(lessonPath, 'utf8')
      .replace('id: lesson-003', 'id: lesson-foreign')
      .replace('plan_id: domain-integrity', 'plan_id: another-plan'),
  );
  expect(() => value.validateLearningReviewSources(
    root,
    'plans/domain-integrity.md',
    {
      ...review('lessons/lesson-foreign.md#trace-event-003'),
      supportingEvidence: [],
    },
  )).toThrow('LEARNING_REVIEW_SOURCE_OUTSIDE_PLAN');
});

test('rejects the same source in both evidence tiers', async () => {
  const value = await moduleUnderTest();
  expect(value).not.toBeNull();
  if (!value) return;
  const root = tracedFixture();
  const duplicated = review();
  duplicated.supportingEvidence = [{
    claim: '重复分层。',
    source: duplicated.keyEvidence[0]!.source,
    limitation: '不应重复。',
  }];

  expect(() => value.validateLearningReviewSources(
    root,
    'plans/domain-integrity.md',
    duplicated,
  )).toThrow('LEARNING_REVIEW_SOURCE_TIER_DUPLICATE');
});
