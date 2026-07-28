import { expect, test } from 'bun:test';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import type {
  MemoryReviewDecision,
  MemoryReviewSnapshot,
} from '../../src/memory-review/contracts';
import {
  MemoryReviewStore,
  submittedMemoryReview,
} from '../../src/memory-review/store';

const proposed = {
  id: 'review-1',
  planId: 'domain-integrity',
  status: 'proposed',
  items: [
    {
      id: 'add-1',
      operation: 'add',
      owner: 'student',
      currentText: null,
      proposedText: '先独立尝试，再请求提示。',
      sources: ['lessons/lesson-001.md#trace-event-001'],
      rationale: '在多节课中重复出现。',
      counterEvidence: '目前没有相反记录。',
      scope: '独立练习题。',
    },
    {
      id: 'revise-1',
      operation: 'revise',
      owner: 'teaching',
      currentText: '先给完整讲解。',
      proposedText: '先等待学生完成第一轮尝试。',
      sources: ['lessons/lesson-001.md#lesson-summary'],
      rationale: '等待后作答更完整。',
      counterEvidence: '新概念示例课不适用。',
      scope: '训练和测评。',
    },
    {
      id: 'delete-1',
      operation: 'delete',
      owner: 'student',
      currentText: '喜欢每一步都确认。',
      proposedText: null,
      sources: ['plans/domain-integrity.md#plan-summary'],
      rationale: '本阶段记录已不再支持。',
      counterEvidence: '暂无。',
      scope: '导数专题。',
    },
  ],
  decisions: [],
} satisfies MemoryReviewSnapshot;

test('restores only the latest review snapshot from the active Pi Session branch', () => {
  const manager = SessionManager.inMemory('/tmp/study');
  const store = new MemoryReviewStore(manager);
  const decisions: MemoryReviewDecision[] = proposed.items.map((item) => ({
    itemId: item.id,
    action: 'accept',
    text: null,
  }));

  store.save(proposed);
  store.save({ ...proposed, status: 'submitted', decisions });

  expect(store.latest()).toEqual({ ...proposed, status: 'submitted', decisions });
});

test('requires one valid explicit decision for every candidate', () => {
  expect(() => submittedMemoryReview(proposed, 'review-1', []))
    .toThrow('MEMORY_REVIEW_DECISIONS_INCOMPLETE');

  expect(() => submittedMemoryReview(proposed, 'review-1', [
    { itemId: 'add-1', action: 'rewrite', text: '   ' },
    { itemId: 'revise-1', action: 'reject', text: null },
    { itemId: 'delete-1', action: 'accept', text: null },
  ])).toThrow('MEMORY_REVIEW_REWRITE_REQUIRED: add-1');

  expect(() => submittedMemoryReview(proposed, 'review-1', [
    { itemId: 'add-1', action: 'accept', text: 'unexpected' },
    { itemId: 'revise-1', action: 'reject', text: null },
    { itemId: 'delete-1', action: 'accept', text: null },
  ])).toThrow('MEMORY_REVIEW_DECISION_TEXT_INVALID: add-1');
});

test('trims rewrite text and produces one submitted snapshot', () => {
  const submitted = submittedMemoryReview(proposed, 'review-1', [
    { itemId: 'add-1', action: 'rewrite', text: '  先自己想三分钟。  ' },
    { itemId: 'revise-1', action: 'reject', text: null },
    { itemId: 'delete-1', action: 'accept', text: null },
  ]);

  expect(submitted).toMatchObject({
    id: 'review-1',
    status: 'submitted',
    decisions: [
      { itemId: 'add-1', action: 'rewrite', text: '先自己想三分钟。' },
      { itemId: 'revise-1', action: 'reject', text: null },
      { itemId: 'delete-1', action: 'accept', text: null },
    ],
  });
});
