import { expect, test } from 'bun:test';
import {
  parseLearningReview,
  renderLearningReview,
} from '../../src/study/learning-review';
import type { LearningReview } from '../../src/shared/contracts';

function review(): LearningReview {
  return {
    conclusion: '能在限定题型中独立比较两条路线的代价。',
    boundary: '目前只覆盖两类参数函数；迁移尚未验证。',
    nextStep: '回到 Roadmap 讨论跨题型迁移。',
    keyEvidence: [{
      claim: '能独立放弃高代价路线并完成低代价路线。',
      source: 'trace:trace-fixture-001',
    }],
    supportingEvidence: [{
      claim: '提示后能识别隐藏同构。',
      source: 'claim:lesson-002/handoff#learner-c1',
      limitation: 'Tutor 给过方向性提示。',
    }],
    openQuestions: [{
      question: '跨章节时是否仍能主动比较路线？',
      nextCheck: '下一 Plan 安排一题非函数综合题。',
    }],
  };
}

test('round-trips one bounded learning review with current evidence handles', () => {
  const expected = review();
  const source = renderLearningReview(expected);

  expect(source).toContain('### 阶段结论');
  expect(source).toContain('### 适用范围');
  expect(source).toContain('- 来源：trace:trace-fixture-001');
  expect(source).toContain('- 来源：claim:lesson-002/handoff#learner-c1');
  expect(parseLearningReview(source)).toEqual(expected);
  expect(parseLearningReview('普通进行中摘要。')).toBeNull();
  expect(parseLearningReview(
    renderLearningReview({ ...expected, openQuestions: [] }),
  )).toEqual({ ...expected, openQuestions: [] });
});
