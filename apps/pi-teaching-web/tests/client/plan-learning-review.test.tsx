import { expect, test } from 'bun:test';
import {
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { LearningReview } from '../../src/shared/contracts';
import { PlanLearningReview } from '../../src/client/components/PlanLearningReview';

const review: LearningReview = {
  conclusion: '你已经能在限定题型中独立比较两条路线的代价。',
  boundary: '两类参数函数；跨章节迁移还没有验证。',
  nextStep: '下一周期检查陌生题型中的选路。',
  keyEvidence: [{
    claim: '无提示放弃了代价更高的路线。',
    source: 'lessons/lesson-006.md#trace-event-001',
  }],
  supportingEvidence: [{
    claim: '提示后识别了隐藏同构。',
    source: 'lessons/lesson-004.md#trace-event-002',
    limitation: '课堂导师给过方向性提示。',
  }],
  openQuestions: [{
    question: '跨章节时是否仍会主动比较路线？',
    nextCheck: '下一周期安排一题非函数综合题。',
  }],
};

function buttons(node: ReactNode): ReactElement<Record<string, unknown>>[] {
  if (Array.isArray(node)) return node.flatMap(buttons);
  if (!isValidElement(node)) return [];
  const element = node as ReactElement<Record<string, unknown> & { children?: ReactNode }>;
  if (typeof element.type === 'function') {
    const component = element.type as (props: typeof element.props) => ReactNode;
    return buttons(component(element.props));
  }
  return [
    ...(element.type === 'button' ? [element] : []),
    ...buttons(element.props.children),
  ];
}

function buttonText(
  element: ReactElement<Record<string, unknown> & { children?: ReactNode }>,
): string {
  return Array.isArray(element.props.children)
    ? element.props.children.join('')
    : String(element.props.children ?? '');
}

test('shows a calm summary first and keeps source detail in a closed disclosure', () => {
  const html = renderToStaticMarkup(
    <PlanLearningReview
      value={review}
      onEvidence={() => {}}
      onDisputePrefill={() => {}}
    />,
  );

  expect(html).toContain(review.conclusion);
  expect(html).toContain(`这项判断目前适用于：${review.boundary}`);
  expect(html).toContain(review.nextStep);
  expect(html).toContain('<summary>为什么这样判断</summary>');
  expect(html).not.toContain('<details open="">');
  expect(html).toContain('最能说明这一点');
  expect(html).toContain('可以作为参考');
  expect(html).toContain('还需要再看看');
  expect(html).not.toMatch(/PASS|FAIL|contaminated|evidence count|tier/i);
});

test('opens existing evidence and only prefills a student dispute', () => {
  const evidence: string[] = [];
  const prefills: string[] = [];
  const tree = PlanLearningReview({
    value: review,
    onEvidence: (source) => evidence.push(source),
    onDisputePrefill: (text) => prefills.push(text),
  });
  const actions = buttons(tree);

  const evidenceButton = actions.find((item) => buttonText(item) === '查看这次表现');
  const disputeButton = actions.find((item) => buttonText(item) === '这和我的实际情况不一样');
  expect(evidenceButton).toBeDefined();
  expect(disputeButton).toBeDefined();

  (evidenceButton!.props as { onClick(): void }).onClick();
  (disputeButton!.props as { onClick(): void }).onClick();

  expect(evidence).toEqual(['lessons/lesson-006.md#trace-event-001']);
  expect(prefills).toEqual([
    '我对这条学习回顾有不同看法。\n'
      + '来源：lessons/lesson-006.md#trace-event-001\n'
      + '当前判断：无提示放弃了代价更高的路线。\n'
      + '我的补充：',
  ]);
});
