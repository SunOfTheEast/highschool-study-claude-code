import { expect, test } from 'bun:test';
import { initialClientState, reduceClientState } from '../../src/client/state';

test('keeps messages separated by Session key', () => {
  let state = initialClientState;
  state = reduceClientState(state, {
    type: 'message-delta',
    sessionKey: 'coach:p1',
    messageId: 'streaming',
    delta: '复盘',
  });
  state = reduceClientState(state, {
    type: 'message-delta',
    sessionKey: 'tutor:l1',
    messageId: 'streaming',
    delta: '题目',
  });
  expect(state.messages['coach:p1']?.[0]?.text).toBe('复盘');
  expect(state.messages['tutor:l1']?.[0]?.text).toBe('题目');
});

test('keeps workflow updates separated by parent Session key', () => {
  const workflow = {
    id: 'wf-1',
    goal: '会诊',
    mode: 'quick' as const,
    status: 'running' as const,
    maxConcurrency: 2,
    tokenLimit: 12_000,
    timeoutMs: 45_000,
    tasks: [],
  };
  let state = reduceClientState(initialClientState, {
    type: 'workflow',
    sessionKey: 'coach:p1',
    workflow,
  });
  state = reduceClientState(state, {
    type: 'workflow',
    sessionKey: 'tutor:l1',
    workflow: { ...workflow, id: 'wf-2', goal: '提示检查' },
  });
  state = reduceClientState(state, {
    type: 'workflow',
    sessionKey: 'coach:p1',
    workflow: { ...workflow, status: 'completed' },
  });
  expect(state.workflows['coach:p1']).toEqual([{ ...workflow, status: 'completed' }]);
  expect(state.workflows['tutor:l1']?.[0]?.id).toBe('wf-2');
});
