import { expect, test } from 'bun:test';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import type { WorkflowSnapshot } from '../../src/workflows/contracts';
import { WorkflowStore } from '../../src/workflows/store';

const snapshot = {
  id: 'wf-1',
  parentSessionKey: 'coach:p1',
  goal: '备课检查',
  mode: 'deep',
  status: 'proposed',
  maxConcurrency: 2,
  tokenLimit: 20_000,
  timeoutMs: 90_000,
  createdAt: '2026-07-22T00:00:00.000Z',
  updatedAt: '2026-07-22T00:00:00.000Z',
  tasks: [],
} satisfies WorkflowSnapshot;

test('restores latest deep-mode and workflow snapshots from Pi custom entries', () => {
  const manager = SessionManager.inMemory('/tmp/study');
  const store = new WorkflowStore(manager);
  store.setDeepMode(true);
  store.save(snapshot);
  store.save({
    ...snapshot,
    status: 'running',
    updatedAt: '2026-07-22T00:01:00.000Z',
  });
  expect(store.deepMode()).toBe(true);
  expect(store.list()).toEqual([{
    ...snapshot,
    status: 'running',
    updatedAt: '2026-07-22T00:01:00.000Z',
  }]);
});
