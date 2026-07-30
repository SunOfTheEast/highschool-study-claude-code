import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { MemoryReviewSnapshot } from '../../src/memory-review/contracts';
import { MemoryReviewCard } from '../../src/client/components/MemoryReviewCard';

const proposed = {
  id: 'review-1',
  planId: 'p1',
  status: 'proposed',
  items: [{
    id: 'student-1',
    operation: 'add',
    owner: 'student',
    currentId: null,
    currentText: null,
    proposedText: '先独立尝试。',
    sources: ['lessons/lesson-001.md#lesson-summary'],
    rationale: '多节课重复出现。',
    counterEvidence: '暂无。',
    scope: '训练课。',
  }, {
    id: 'teaching-1',
    operation: 'revise',
    owner: 'teaching',
    currentId: 'T1',
    currentText: '立即给提示。',
    proposedText: '先等待学生表达思路。',
    sources: ['plans/p1.md#plan-summary'],
    rationale: '近期更有效。',
    counterEvidence: '新概念课例外。',
    scope: '复习课。',
  }],
  decisions: [],
} satisfies MemoryReviewSnapshot;

test('renders a recoverable proposed memory review in the conversation', () => {
  const html = renderToStaticMarkup(
    <MemoryReviewCard review={proposed} onOpen={() => {}} />,
  );

  expect(html).toContain('长期记忆待确认');
  expect(html).toContain('逐条确认');
  expect(html).toContain('稍后处理');
  expect(html).toContain('学习偏好');
  expect(html).toContain('教学方式');
});

test('renders submitted state without claiming profile application', () => {
  const html = renderToStaticMarkup(
    <MemoryReviewCard
      review={{
        ...proposed,
        status: 'submitted',
        decisions: proposed.items.map((item) => ({
          itemId: item.id,
          action: 'accept',
          text: null,
        })),
      }}
      onOpen={() => {}}
    />,
  );

  expect(html).toContain('已确认，待写入');
  expect(html).not.toContain('逐条确认');
  expect(html).not.toContain('已写入长期画像');
});

test('renders the applied receipt without offering another submission', () => {
  const html = renderToStaticMarkup(
    <MemoryReviewCard
      review={{
        ...proposed,
        status: 'applied',
        decisions: proposed.items.map((item, index) => ({
          itemId: item.id,
          action: index === 0 ? 'accept' : 'reject',
          text: null,
        })),
        receipt: {
          reviewId: 'review-1',
          appliedItems: ['student-1'],
          unchangedItems: ['teaching-1'],
          profilePaths: {
            student: 'memory/student-profile.md',
            teaching: 'memory/teaching-profile.md',
          },
        },
      }}
      onOpen={() => {}}
    />,
  );

  expect(html).toContain('已写入长期画像');
  expect(html).toContain('写入 <strong>1</strong>');
  expect(html).toContain('未更改 <strong>1</strong>');
  expect(html).not.toContain('逐条确认');
  expect(html).not.toContain('稍后处理');
});
