import { expect, test } from 'bun:test';
import { projectSessionEvent } from '../../src/projection/projector';

test('projects text deltas and hides thinking deltas', () => {
  expect(projectSessionEvent('coach:plan', {
    type: 'message_update',
    message: { role: 'assistant', timestamp: 123 },
    assistantMessageEvent: { type: 'text_delta', delta: '下一课' },
  } as never)).toEqual([{
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
