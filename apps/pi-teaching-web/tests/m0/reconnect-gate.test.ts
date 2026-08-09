import { expect, test } from 'bun:test';
import { createReconnectGate } from '../../src/client/reconnect-gate';

test('reloads only after the first WebSocket open', () => {
  const gate = createReconnectGate();

  expect(gate.opened()).toBeFalse();
  expect(gate.opened()).toBeTrue();
  expect(gate.opened()).toBeTrue();
});
