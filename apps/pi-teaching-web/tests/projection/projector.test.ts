import { expect, test } from 'bun:test';
import {
  createLiveSessionEventProjector,
  projectSessionEvent,
} from '../../src/projection/projector';

test('keeps text deltas only in explicit raw-stream mode', () => {
  expect(projectSessionEvent('coach:plan', {
    type: 'message_update',
    message: { role: 'assistant', timestamp: 123 },
    assistantMessageEvent: { type: 'text_delta', delta: '下一课' },
  } as never, 'safe')).toEqual([]);

  expect(projectSessionEvent('coach:plan', {
    type: 'message_update',
    message: { role: 'assistant', timestamp: 123 },
    assistantMessageEvent: { type: 'text_delta', delta: '下一课' },
  } as never, 'raw-stream')).toEqual([{
    type: 'message-delta',
    sessionKey: 'coach:plan',
    messageId: 'coach:plan:123',
    delta: '下一课',
  }]);

  expect(projectSessionEvent('coach:plan', {
    type: 'message_update',
    message: { role: 'assistant', timestamp: 123 },
    assistantMessageEvent: { type: 'thinking_delta', delta: 'private reasoning' },
  } as never)).toEqual([]);
});

test('hides mixed tool-call messages in safe mode but keeps text for raw-stream', () => {
  const event = {
    type: 'message_end',
    message: {
      role: 'assistant',
      timestamp: 124,
      content: [
        { type: 'text', text: '内部矩阵' },
        { type: 'toolCall', id: 'call-1', name: 'plan_update', arguments: { answer: 'D' } },
      ],
    },
  } as never;
  expect(projectSessionEvent('coach:plan', event)).toEqual([]);
  expect(projectSessionEvent('coach:plan', event, 'raw-stream')).toEqual([{
    type: 'message',
    sessionKey: 'coach:plan',
    message: {
      id: 'coach:plan:124',
      role: 'coach',
      text: '内部矩阵',
      complete: true,
    },
  }]);
});

test('projects pure text and labels without tool arguments', () => {
  expect(projectSessionEvent('coach:plan', {
    type: 'message_end',
    message: {
      role: 'assistant',
      timestamp: 125,
      content: [{ type: 'text', text: '给学生的结论。' }],
    },
  } as never)).toEqual([expect.objectContaining({ type: 'message' })]);
  const events = projectSessionEvent('coach:plan', {
    type: 'tool_execution_start',
    toolName: 'plan_update',
    toolCallId: 'tool-1',
    args: { answer: 'D' },
  } as never);
  expect(events).toEqual([expect.objectContaining({
    type: 'work-status',
    label: '正在写回学习计划',
  })]);
  expect(JSON.stringify(events)).not.toContain('answer');
});

test('projects tool names as status without raw arguments or answers', () => {
  const events = projectSessionEvent('tutor:lesson', {
    type: 'tool_execution_start',
    toolName: 'card_search',
    toolCallId: 'tool-1',
    args: { query: 'answer' },
  } as never);
  expect(events).toEqual([{
    type: 'work-status',
    sessionKey: 'tutor:lesson',
    tool: 'card_search',
    status: 'running',
    label: '正在查找真实题卡',
  }]);
  expect(JSON.stringify(events)).not.toContain('answer');

  expect(projectSessionEvent('coach:@roadmap', {
    type: 'tool_execution_start',
    toolName: 'card_search',
    toolCallId: 'roadmap-search',
    args: { query: 'private diagnostic' },
  } as never)).toEqual([expect.objectContaining({
    type: 'work-status',
    label: '正在核对课程素材',
  })]);
});

test('projects lesson preparation without leaking the Blueprint', () => {
  const events = projectSessionEvent('coach:domain-integrity', {
    type: 'tool_execution_start',
    toolName: 'lesson_prepare',
    toolCallId: 'prepare-1',
    args: {
      teacherControl: '隐藏内容',
      cards: [{ cardPath: 'cards/private.card.yaml' }],
    },
  } as never);

  expect(events).toEqual([expect.objectContaining({
    type: 'work-status',
    tool: 'lesson_prepare',
    label: '正在整理课堂结构',
  })]);
  expect(JSON.stringify(events)).not.toContain('隐藏内容');
  expect(JSON.stringify(events)).not.toContain('private.card.yaml');
});

test('suppresses only the safe post-prepare final within the current turn', () => {
  const safe = createLiveSessionEventProjector('coach:plan', 'safe');
  const receipt = {
    type: 'tool_execution_end',
    toolName: 'lesson_prepare',
    toolCallId: 'prepare-1',
    isError: false,
    result: {
      details: {
        kind: 'lesson-prepare',
        value: {
          ok: true,
          factId: 'lesson-007',
          lessonPath: 'lessons/lesson-007.md',
          publicTitle: '下一节课堂',
          publicPurpose: '完成一次独立能力检验',
          blockCount: 5,
          blockKinds: ['dialogue', 'problem', 'reflection'],
          sourceNumbers: ['source-17'],
        },
      },
    },
  } as never;
  const final = {
    type: 'message_end',
    message: {
      role: 'assistant',
      timestamp: 126,
      content: [{ type: 'text', text: '绝密题名和冻结变量法。' }],
    },
  } as never;

  expect(safe(receipt)).toEqual([expect.objectContaining({ type: 'work-status' })]);
  expect(safe(final)).toEqual([]);
  safe({ type: 'agent_end', messages: [], willRetry: false } as never);
  expect(safe(final)).toEqual([expect.objectContaining({ type: 'message' })]);

  const raw = createLiveSessionEventProjector('coach:plan', 'raw-stream');
  raw(receipt);
  expect(raw(final)).toEqual([expect.objectContaining({ type: 'message' })]);
});

test('replaces a live Roadmap post-search final with a fixed recovery message', () => {
  const safe = createLiveSessionEventProjector('coach:@roadmap', 'safe');
  const receipt = {
    type: 'tool_execution_end',
    toolName: 'card_search',
    toolCallId: 'search-1',
    isError: false,
    result: {
      details: {
        kind: 'card-search',
        value: { cards: [{ stem: '绝密题面', answer: '绝密答案' }] },
      },
    },
  } as never;
  const final = {
    type: 'message_end',
    message: {
      role: 'assistant',
      timestamp: 127,
      content: [{ type: 'text', text: '绝密题面的关键是冻结变量法。' }],
    },
  } as never;

  expect(safe(receipt)).toEqual([expect.objectContaining({ type: 'work-status' })]);
  const visible = safe(final);
  expect(visible).toEqual([expect.objectContaining({
    type: 'message',
    message: expect.objectContaining({
      text: '课程素材已经核对，但学习周期尚未建立。可以继续完成当前计划。',
    }),
  })]);
  expect(JSON.stringify(visible)).not.toContain('绝密');
  expect(JSON.stringify(visible)).not.toContain('冻结变量法');
});

test('emits one ordinary ready message after live Roadmap preparation', () => {
  const safe = createLiveSessionEventProjector('coach:@roadmap', 'safe');
  const search = {
    type: 'tool_execution_end',
    toolName: 'card_search',
    toolCallId: 'search-1',
    isError: false,
    result: { details: { kind: 'card-search', value: { cards: [] } } },
  } as never;
  const prepare = {
    type: 'tool_execution_end',
    toolName: 'plan_prepare',
    toolCallId: 'prepare-1',
    isError: false,
    result: {
      details: {
        kind: 'plan-prepare',
        value: { ok: true, factId: 'route-choice' },
      },
    },
  } as never;
  const final = {
    type: 'message_end',
    message: {
      role: 'assistant',
      timestamp: 128,
      content: [{ type: 'text', text: '绝密题面和方法。' }],
    },
  } as never;

  safe(search);
  const prepared = safe(prepare);
  expect(prepared.filter((event) => event.type === 'message')).toEqual([
    expect.objectContaining({
      type: 'message',
      message: expect.objectContaining({
        text: '学习周期已建立。具体素材会由学习顾问在备课时重新核对。',
      }),
    }),
  ]);
  expect(safe(final)).toEqual([]);
});

test('keeps live Roadmap card-search privacy scoped to safe Roadmap projection', () => {
  const search = {
    type: 'tool_execution_end',
    toolName: 'card_search',
    toolCallId: 'search-1',
    isError: false,
    result: { details: { kind: 'card-search', value: { cards: [] } } },
  } as never;
  const final = {
    type: 'message_end',
    message: {
      role: 'assistant',
      timestamp: 129,
      content: [{ type: 'text', text: '普通检索说明。' }],
    },
  } as never;

  const plan = createLiveSessionEventProjector('coach:plan', 'safe');
  plan(search);
  expect(plan(final)).toEqual([expect.objectContaining({ type: 'message' })]);

  const raw = createLiveSessionEventProjector('coach:@roadmap', 'raw-stream');
  raw(search);
  expect(raw(final)).toEqual([expect.objectContaining({
    type: 'message',
    message: expect.objectContaining({ text: '普通检索说明。' }),
  })]);
});
