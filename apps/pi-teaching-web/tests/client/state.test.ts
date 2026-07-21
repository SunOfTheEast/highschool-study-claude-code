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
