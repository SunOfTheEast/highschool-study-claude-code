import { expect, test } from 'bun:test';
import type { PeerVisualDriver, PeerVisualState } from '../../src/client/live2d/contracts';
import { createPeerVisualController, mouthTarget } from '../../src/client/live2d/state';

function state(input: Partial<PeerVisualState> = {}): PeerVisualState {
  return {
    phase: 'calm',
    expression: 'neutral',
    mouth: 'closed',
    ...input,
  };
}

function fakeDriver() {
  const calls: string[] = [];
  const driver: PeerVisualDriver = {
    setAttention: (phase) => calls.push(`attention:${phase}`),
    setExpression: (expression) => calls.push(`expression:${expression}`),
    setMouthTarget: (value) => calls.push(`mouth:${value}`),
    setPaused: (paused) => calls.push(`paused:${paused}`),
    destroy: () => calls.push('destroy'),
  };
  return { calls, driver };
}

test('maps the existing three mouth states to restrained Cubism targets', () => {
  expect(mouthTarget('closed')).toBe(0);
  expect(mouthTarget('half')).toBe(0.45);
  expect(mouthTarget('open')).toBe(1);
});

test('applies only changed visual fields and keeps Peer expressions unchanged', () => {
  const { calls, driver } = fakeDriver();
  const controller = createPeerVisualController(driver, state());

  controller.setState(state());
  controller.setState(state({ phase: 'thinking', expression: 'curious' }));
  controller.setState(state({ phase: 'speaking', expression: 'skeptical', mouth: 'half' }));

  expect(calls).toEqual([
    'attention:calm',
    'expression:neutral',
    'mouth:0',
    'attention:thinking',
    'expression:curious',
    'attention:speaking',
    'expression:skeptical',
    'mouth:0.45',
  ]);
});

test('deduplicates pause transitions and destroys the driver once', () => {
  const { calls, driver } = fakeDriver();
  const controller = createPeerVisualController(driver, state());
  calls.length = 0;

  controller.setPaused(true);
  controller.setPaused(true);
  controller.setPaused(false);
  controller.setPaused(false);
  controller.destroy();
  controller.destroy();
  controller.setState(state({ phase: 'speaking', mouth: 'open' }));

  expect(calls).toEqual(['paused:true', 'paused:false', 'destroy']);
});
