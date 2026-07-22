import { expect, test } from 'bun:test';
import {
  parseMessageProjectionMode,
  projectStoredMessage,
  visibleAssistantText,
} from '../../src/projection/message-policy';

const mixed = [
  { type: 'text', text: '现在构建内部矩阵。' },
  { type: 'toolCall', id: 'call-1', name: 'plan_update', arguments: { answer: 'D' } },
];

test('defaults to safe and accepts only the two configured modes', () => {
  expect(parseMessageProjectionMode(undefined)).toBe('safe');
  expect(parseMessageProjectionMode('safe')).toBe('safe');
  expect(parseMessageProjectionMode('raw-stream')).toBe('raw-stream');
  expect(() => parseMessageProjectionMode('raw')).toThrow('INVALID_MESSAGE_PROJECTION');
});

test('hides all text from a mixed tool message only in safe mode', () => {
  expect(visibleAssistantText(mixed, 'safe')).toBeNull();
  expect(visibleAssistantText(mixed, 'raw-stream')).toBe('现在构建内部矩阵。');
  expect(visibleAssistantText([{ type: 'text', text: '给学生的结论。' }], 'safe'))
    .toBe('给学生的结论。');
});

test('projects stored messages with the same policy and never exposes tool arguments', () => {
  expect(projectStoredMessage('tutor:lesson', {
    role: 'assistant',
    content: mixed,
  }, 0, 'safe')).toBeNull();

  const raw = projectStoredMessage('tutor:lesson', {
    role: 'assistant',
    content: mixed,
  }, 0, 'raw-stream');
  expect(raw).toMatchObject({ role: 'tutor', text: '现在构建内部矩阵。' });
  expect(JSON.stringify(raw)).not.toContain('answer');
  expect(projectStoredMessage('tutor:lesson', {
    role: 'toolResult',
    content: '内部工具结果',
  }, 1, 'raw-stream')).toBeNull();
});
