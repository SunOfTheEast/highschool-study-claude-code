import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MemoryReviewSnapshot } from '../../src/memory-review/contracts';
import {
  MemoryReviewPanel,
  memoryReviewComplete,
} from '../../src/client/components/MemoryReviewPanel';

const review = {
  id: 'review-1',
  planId: 'p1',
  status: 'proposed',
  items: [{
    id: 'add-1',
    operation: 'add',
    owner: 'student',
    currentText: null,
    proposedText: '先独立尝试。',
    sources: ['lessons/lesson-001.md#trace-event-001'],
    rationale: '多节课重复出现。',
    counterEvidence: '暂无反例。',
    scope: '独立训练。',
  }, {
    id: 'revise-1',
    operation: 'revise',
    owner: 'teaching',
    currentText: '立即给提示。',
    proposedText: '先等待学生表达思路。',
    sources: ['plans/p1.md#plan-summary'],
    rationale: '近期效果更好。',
    counterEvidence: '新概念课例外。',
    scope: '复习课。',
  }, {
    id: 'delete-1',
    operation: 'delete',
    owner: 'student',
    currentText: '每一步都要确认。',
    proposedText: null,
    sources: ['lessons/lesson-002.md#lesson-summary'],
    rationale: '后续课堂不再支持。',
    counterEvidence: '暂无。',
    scope: '本学习周期。',
  }],
  decisions: [],
} satisfies MemoryReviewSnapshot;

test('shows every decision input and every review field without a default selection', () => {
  const html = renderToStaticMarkup(
    <MemoryReviewPanel
      review={review}
      submitting={false}
      onClose={() => {}}
      onSource={() => {}}
      onSubmit={async () => {}}
    />,
  );

  for (const value of [
    '采用',
    '改写后采用',
    '不采用',
    '新增',
    '修订',
    '删除',
    '学习偏好',
    '教学方式',
    '当前记录',
    '建议记录',
    '为什么值得保留',
    '需要留意的反例',
    '适用范围',
    '记录来源',
    '立即给提示。',
    '先等待学生表达思路。',
    'lessons/lesson-001.md#trace-event-001',
  ]) {
    expect(html).toContain(value);
  }
  expect(html).not.toContain('checked=""');
  expect(html).toContain('disabled=""');
});

test('requires one valid decision per item before submission', () => {
  expect(memoryReviewComplete(review.items, {})).toBe(false);
  expect(memoryReviewComplete(review.items, {
    'add-1': { itemId: 'add-1', action: 'accept', text: null },
    'revise-1': { itemId: 'revise-1', action: 'rewrite', text: '   ' },
    'delete-1': { itemId: 'delete-1', action: 'reject', text: null },
  })).toBe(false);
  expect(memoryReviewComplete(review.items, {
    'add-1': { itemId: 'add-1', action: 'accept', text: null },
    'revise-1': {
      itemId: 'revise-1',
      action: 'rewrite',
      text: '先让我完整说出思路。',
    },
    'delete-1': { itemId: 'delete-1', action: 'reject', text: null },
  })).toBe(true);
});

test('renders an applied review as a read-only receipt', () => {
  const html = renderToStaticMarkup(
    <MemoryReviewPanel
      review={{
        ...review,
        status: 'applied',
        decisions: review.items.map((item) => ({
          itemId: item.id,
          action: 'accept',
          text: null,
        })),
        receipt: {
          reviewId: 'review-1',
          appliedItems: review.items.map((item) => item.id),
          unchangedItems: [],
          profilePaths: {
            student: 'memory/student-profile.md',
            teaching: 'memory/teaching-profile.md',
          },
        },
      }}
      submitting={false}
      onClose={() => {}}
      onSource={() => {}}
      onSubmit={async () => {
        throw new Error('applied review must not submit');
      }}
    />,
  );

  expect(html).toContain('已写入长期画像');
  expect(html).toContain('disabled=""');
  expect(html).not.toContain('提交给学习顾问');
});
