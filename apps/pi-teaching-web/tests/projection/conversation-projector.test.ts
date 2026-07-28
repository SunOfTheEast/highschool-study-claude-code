import { expect, test } from 'bun:test';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type { MemoryReviewSnapshot } from '../../src/memory-review/contracts';
import { projectConversationEntries } from '../../src/projection/conversation-projector';

const proposed = {
  id: 'review-1',
  planId: 'p1',
  status: 'proposed',
  items: [{
    id: 'item-1',
    operation: 'add',
    owner: 'student',
    currentText: null,
    proposedText: '先独立尝试。',
    sources: ['lessons/lesson-001.md#lesson-summary'],
    rationale: '多次出现。',
    counterEvidence: '暂无。',
    scope: '训练课。',
  }],
  decisions: [],
} satisfies MemoryReviewSnapshot;

const submitted = {
  ...proposed,
  status: 'submitted',
  decisions: [{ itemId: 'item-1', action: 'accept', text: null }],
} satisfies MemoryReviewSnapshot;

function entry(
  id: string,
  value:
    | { type: 'message'; message: unknown }
    | { type: 'custom'; customType: string; data: unknown }
    | {
      type: 'custom_message';
      customType: string;
      content: string;
      display: boolean;
    },
): SessionEntry {
  return {
    id,
    parentId: null,
    timestamp: '2026-07-28T00:00:00Z',
    ...value,
  } as SessionEntry;
}

function message(
  id: string,
  role: 'user' | 'assistant' | 'toolResult',
  text: string,
): SessionEntry {
  return entry(id, {
    type: 'message',
    message: {
      role,
      content: [{ type: 'text', text }],
    },
  });
}

test('places one latest review card after the Coach explanation that follows its proposal', () => {
  const entries = [
    message('student-1', 'user', '开始复盘'),
    message('coach-1', 'assistant', '我们先看本周期的记录。'),
    entry('proposed', {
      type: 'custom',
      customType: 'studyforge.memory-review.v1',
      data: proposed,
    }),
    message('tool-1', 'toolResult', 'internal tool result'),
    message('coach-2', 'assistant', '我整理出了几条需要你确认的长期记忆。'),
    message('student-2', 'user', '我来看看。'),
    entry('submitted', {
      type: 'custom',
      customType: 'studyforge.memory-review.v1',
      data: submitted,
    }),
    entry('hidden-decisions', {
      type: 'custom_message',
      customType: 'studyforge.memory-review-decisions.v1',
      content: '{"reviewId":"review-1"}',
      display: false,
    }),
    message('coach-3', 'assistant', '已经按你的选择更新并重新读取。'),
  ];

  const items = projectConversationEntries('coach:p1', entries, 'safe');

  expect(items.map((item) => item.kind)).toEqual([
    'message',
    'message',
    'message',
    'memory-review',
    'message',
    'message',
  ]);
  expect(items[2]).toMatchObject({
    kind: 'message',
    message: { role: 'coach', text: '我整理出了几条需要你确认的长期记忆。' },
  });
  expect(items[3]).toMatchObject({
    kind: 'memory-review',
    review: { id: 'review-1', status: 'submitted' },
  });
  expect(JSON.stringify(items)).not.toContain('hidden-decisions');
  expect(JSON.stringify(items)).not.toContain('internal tool result');
});

test('places a proposal at the history end when no visible Coach explanation follows', () => {
  const items = projectConversationEntries('coach:p1', [
    message('student-1', 'user', '总结一下'),
    entry('proposed', {
      type: 'custom',
      customType: 'studyforge.memory-review.v1',
      data: proposed,
    }),
    message('tool-1', 'toolResult', 'internal tool result'),
  ], 'safe');

  expect(items.map((item) => item.kind)).toEqual(['message', 'memory-review']);
  expect(items.at(-1)).toMatchObject({
    kind: 'memory-review',
    review: { id: 'review-1', status: 'proposed' },
  });
});
