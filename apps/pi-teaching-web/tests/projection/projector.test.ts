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
          blockCount: 5,
          blockKinds: ['dialogue', 'problem', 'reflection'],
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
