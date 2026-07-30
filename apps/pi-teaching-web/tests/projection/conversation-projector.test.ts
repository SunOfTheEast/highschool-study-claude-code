import { expect, test } from 'bun:test';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type { MemoryReviewSnapshot } from '../../src/memory-review/contracts';
import {
  lessonReadyNoticeFromToolResult,
  projectConversationEntries,
} from '../../src/projection/conversation-projector';

const proposed = {
  id: 'review-1',
  planId: 'p1',
  status: 'proposed',
  items: [{
    id: 'item-1',
    operation: 'add',
    owner: 'student',
    currentId: null,
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

const applied = {
  ...submitted,
  status: 'applied',
  receipt: {
    reviewId: 'review-1',
    appliedItems: ['item-1'],
    unchangedItems: [],
    profilePaths: {
      student: 'memory/student-profile.md',
      teaching: 'memory/teaching-profile.md',
    },
  },
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

function lessonPrepareResult(isError = false): SessionEntry {
  return entry('prepare-result', {
    type: 'message',
    message: {
      role: 'toolResult',
      toolName: 'lesson_prepare',
      isError,
      content: [{ type: 'text', text: '{"ok":true}' }],
      details: isError ? undefined : {
        kind: 'lesson-prepare',
        value: {
          ok: true,
          factId: 'lesson-007',
          lessonPath: 'lessons/lesson-007.md',
          publicTitle: '下一节课堂',
          publicPurpose: '完成一次独立能力检验',
          blockCount: 5,
          blockKinds: ['dialogue', 'problem', 'reflection'],
          sourceNumbers: ['source-17', 'source-32'],
        },
      },
    },
  });
}

function toolResult(
  id: string,
  toolName: 'card_search' | 'plan_prepare',
  kind: 'card-search' | 'plan-prepare',
  value: object,
  isError = false,
): SessionEntry {
  return entry(id, {
    type: 'message',
    message: {
      role: 'toolResult',
      toolName,
      isError,
      content: [{ type: 'text', text: JSON.stringify(value) }],
      details: isError ? undefined : { kind, value },
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

test('projects only the latest applied state for one memory review', () => {
  const items = projectConversationEntries('coach:p1', [
    entry('proposed', {
      type: 'custom',
      customType: 'studyforge.memory-review.v1',
      data: proposed,
    }),
    entry('submitted', {
      type: 'custom',
      customType: 'studyforge.memory-review.v1',
      data: submitted,
    }),
    entry('applied', {
      type: 'custom',
      customType: 'studyforge.memory-review.v1',
      data: applied,
    }),
  ], 'safe');

  expect(items).toEqual([{
    kind: 'memory-review',
    review: applied,
  }]);
});

test('replaces the post-prepare Coach final with one spoiler-safe Lesson notice', () => {
  const entries = [
    entry('prepare-call', {
      type: 'message',
      message: {
        role: 'assistant',
        content: [
          { type: 'text', text: '内部选卡理由：使用冻结变量法。' },
          {
            type: 'toolCall',
            id: 'prepare-1',
            name: 'lesson_prepare',
            arguments: { title: '绝密题名' },
          },
        ],
      },
    }),
    lessonPrepareResult(),
    message('coach-final', 'assistant', '课已备好：绝密题名，核心方法是冻结变量法。'),
  ];

  expect(projectConversationEntries('coach:p1', entries, 'safe')).toEqual([{
    kind: 'lesson-ready',
    lesson: {
      lessonId: 'lesson-007',
      lessonPath: 'lessons/lesson-007.md',
      publicTitle: '下一节课堂',
      publicPurpose: '完成一次独立能力检验',
      blockCount: 5,
      blockKinds: ['dialogue', 'problem', 'reflection'],
      sourceNumbers: ['source-17', 'source-32'],
    },
  }]);
  const raw = projectConversationEntries('coach:p1', entries, 'raw-stream');
  expect(raw.some((item) => item.kind === 'message')).toBe(true);
  expect(JSON.stringify(raw)).toContain('冻结变量法');
});

test('rejects a Lesson readiness receipt missing its safe projection fields', () => {
  expect(lessonReadyNoticeFromToolResult({
    role: 'toolResult',
    toolName: 'lesson_prepare',
    isError: false,
    details: {
      kind: 'lesson-prepare',
      value: {
        ok: true,
        factId: 'lesson-007',
        lessonPath: 'lessons/lesson-007.md',
        blockCount: 5,
        blockKinds: ['problem'],
      },
    },
  })).toBeNull();
});

test('does not suppress a Coach final after a failed Lesson preparation', () => {
  const items = projectConversationEntries('coach:p1', [
    lessonPrepareResult(true),
    message('coach-final', 'assistant', '这次没有写成，请继续讨论。'),
  ], 'safe');

  expect(items).toEqual([
    expect.objectContaining({
      kind: 'message',
      message: expect.objectContaining({ text: '这次没有写成，请继续讨论。' }),
    }),
  ]);
});

test('replaces a Roadmap post-search final with a fixed recovery message', () => {
  const items = projectConversationEntries('coach:@roadmap', [
    toolResult('search', 'card_search', 'card-search', {
      cards: [{ stem: '绝密题面', answer: '绝密答案' }],
    }),
    message('coach-final', 'assistant', '绝密题面的关键是冻结变量法。'),
  ], 'safe');

  expect(items).toEqual([expect.objectContaining({
    kind: 'message',
    message: expect.objectContaining({
      role: 'coach',
      text: '课程素材已经核对，但学习周期尚未建立。可以继续完成当前计划。',
    }),
  })]);
  expect(JSON.stringify(items)).not.toContain('绝密');
  expect(JSON.stringify(items)).not.toContain('冻结变量法');
});

test('replaces a prepared Roadmap post-search final with one ordinary ready message', () => {
  const items = projectConversationEntries('coach:@roadmap', [
    toolResult('search', 'card_search', 'card-search', { cards: [] }),
    toolResult('prepare', 'plan_prepare', 'plan-prepare', {
      ok: true,
      factId: 'route-choice',
    }),
    message('coach-final', 'assistant', '这题的决定性因式是秘密。'),
  ], 'safe');

  expect(items).toEqual([expect.objectContaining({
    kind: 'message',
    message: expect.objectContaining({
      role: 'coach',
      text: '学习周期已建立。具体素材会由学习顾问在备课时重新核对。',
    }),
  })]);
  expect(JSON.stringify(items)).not.toContain('秘密');
});

test('keeps card-search finals outside a successful safe Roadmap search unchanged', () => {
  const successfulSearch = toolResult(
    'search',
    'card_search',
    'card-search',
    { cards: [] },
  );
  const final = message('coach-final', 'assistant', '普通备课讨论。');

  expect(projectConversationEntries('coach:p1', [
    successfulSearch,
    final,
  ], 'safe')).toEqual([expect.objectContaining({
    kind: 'message',
    message: expect.objectContaining({ text: '普通备课讨论。' }),
  })]);

  expect(projectConversationEntries('coach:@roadmap', [
    toolResult('failed-search', 'card_search', 'card-search', {}, true),
    final,
  ], 'safe')).toEqual([expect.objectContaining({
    kind: 'message',
    message: expect.objectContaining({ text: '普通备课讨论。' }),
  })]);
});

test('keeps the original Roadmap post-search final in raw-stream history', () => {
  const items = projectConversationEntries('coach:@roadmap', [
    toolResult('search', 'card_search', 'card-search', {
      cards: [{ stem: '原始题面' }],
    }),
    message('coach-final', 'assistant', '原始题面和原始方法。'),
  ], 'raw-stream');

  expect(JSON.stringify(items)).toContain('原始题面和原始方法。');
});
