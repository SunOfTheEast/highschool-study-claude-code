import { expect, test } from 'bun:test';
import type { ConversationItem } from '../../src/shared/contracts';
import {
  presentConversation,
  waitingForTeacherCopy,
} from '../../src/client/conversation-presentation';
import {
  publicErrorText,
  publicSessionErrorText,
} from '../../src/client/public-errors';
import { initialClientState, reduceClientState } from '../../src/client/state';

function tool(
  id: string,
  name: string,
  status: 'running' | 'done' | 'error',
): ConversationItem {
  return {
    id,
    kind: 'tool',
    name,
    status,
    detail: { path: '/private/tmp/internal' },
    at: '2026-08-10T00:00:00.000Z',
  };
}

test('collapses discovery activity and omits recoverable generic tool failures', () => {
  const visible = presentConversation([
    tool('read-1', 'read', 'done'),
    tool('read-2', 'read', 'error'),
    tool('grep-1', 'grep', 'running'),
  ]);

  expect(visible).toHaveLength(1);
  expect(visible[0]).toMatchObject({
    kind: 'tool',
    name: 'discovery',
    status: 'running',
    detail: null,
  });
});

test('uses the real Session scope for waiting copy without exposing its identifier', () => {
  expect(waitingForTeacherCopy('meta:meta-session-001')).toContain('长期学习方向');
  expect(waitingForTeacherCopy('roadmap:roadmap')).toContain('下一阶段');
  expect(waitingForTeacherCopy('plan:plan-001')).toContain('准备这一阶段');
  expect(waitingForTeacherCopy('lesson:plan-001:lesson-001')).toContain('学习表现');
  expect(waitingForTeacherCopy('free:free-session-001')).toContain('刚才的问题');
});

test('maps private failures to stable student-facing copy', () => {
  const raw = publicErrorText(new Error('ResolveMessage: /private/tmp/private.jsonl'));
  expect(raw).not.toMatch(/ResolveMessage|private\/tmp|jsonl/);
  expect(publicErrorText({ status: 404 })).toContain('找不到');
  expect(publicErrorText({ status: 409 })).toContain('发生变化');
  expect(publicSessionErrorText()).not.toMatch(/API_ERROR|SESSION|ResolveMessage/);
});

test('sanitizes Session failures and clears them when the student retries', () => {
  const failed = reduceClientState(initialClientState, {
    type: 'session-error',
    sessionKey: 'free:free-session-001',
    message: 'API_ERROR: 500 /private/tmp/runtime.jsonl',
  });
  expect(failed.errors['free:free-session-001']).toBe(publicSessionErrorText());

  const retried = reduceClientState(failed, {
    type: 'session-run',
    sessionKey: 'free:free-session-001',
    status: 'running',
  });
  expect(retried.errors['free:free-session-001']).toBeUndefined();
});
