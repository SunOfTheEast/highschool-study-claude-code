import { expect, test } from 'bun:test';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import type { FocusCycleSnapshot } from '../../src/time/focus-cycle';
import type { StudyEvent } from '../../src/shared/contracts';

const snapshot: FocusCycleSnapshot = {
  cycleId: 'private-cycle-id',
  sessionKey: 'free:free-001',
  sessionId: 'private-native-session-id',
  targetSeconds: 1500,
  startedAt: '2026-08-12T08:00:00.000Z',
  status: 'running',
  runningSince: '2026-08-12T08:00:00.000Z',
  accumulatedSeconds: 0,
  elapsedSeconds: 300,
  remainingSeconds: 1200,
  expiresAt: '2026-08-12T08:25:00.000Z',
  expired: false,
};

function registry(overrides: Record<string, unknown> = {}) {
  return {
    readHistory: async () => [],
    send: async () => {},
    subscribe: async () => () => {},
    open: async () => ({}),
    abort: async () => {},
    release: async () => {},
    createFreeLearning: async () => { throw new Error('not used'); },
    listFreeLearning: async () => [],
    endFreeLearning: async () => { throw new Error('not used'); },
    createMeta: async () => { throw new Error('not used'); },
    listMeta: async () => [],
    listOwnedSessionFacts: async () => [],
    focusSessionKey: () => snapshot.sessionKey,
    readFocus: async () => snapshot,
    startFocus: async () => snapshot,
    pauseFocus: () => ({ ...snapshot, status: 'paused' as const, expiresAt: null }),
    resumeFocus: () => snapshot,
    endFocus: async () => ({
      cycleId: snapshot.cycleId,
      sessionKey: snapshot.sessionKey,
      sessionId: snapshot.sessionId,
      targetSeconds: snapshot.targetSeconds,
      elapsedSeconds: 300,
      endedAt: '2026-08-12T08:05:00.000Z',
      reason: 'manual' as const,
    }),
    endFocusForSession: async () => null,
    ...overrides,
  };
}

async function json(response: Response | undefined): Promise<Record<string, any>> {
  return response?.json() as Promise<Record<string, any>>;
}

test('serves a student-safe focus snapshot without native identifiers', async () => {
  const handler = createRequestHandler({
    root: '/tmp/unused-focus-http',
    registry: registry() as never,
    hub: new EventHub(),
  });
  const response = await handler(new Request('http://local/api/focus'));
  const value = await json(response);

  expect(response?.status).toBe(200);
  expect(value).toMatchObject({
    sessionKey: 'free:free-001',
    targetSeconds: 1500,
    status: 'running',
    remainingSeconds: 1200,
  });
  expect(JSON.stringify(value)).not.toMatch(/private-cycle-id|private-native-session-id|cycleId|sessionId/);
});

test('routes mechanical focus actions and publishes one invalidation', async () => {
  const calls: unknown[][] = [];
  const hub = new EventHub();
  const events: StudyEvent[] = [];
  hub.subscribe((event) => events.push(event));
  const handler = createRequestHandler({
    root: '/tmp/unused-focus-http',
    registry: registry({
      startFocus: async (...args: unknown[]) => { calls.push(['start', ...args]); return snapshot; },
      pauseFocus: () => { calls.push(['pause']); return { ...snapshot, status: 'paused' }; },
      resumeFocus: () => { calls.push(['resume']); return snapshot; },
      endFocus: async (...args: unknown[]) => {
        calls.push(['end', ...args]);
        return { targetSeconds: 1500, elapsedSeconds: 300, reason: 'manual' };
      },
    }) as never,
    hub,
  });

  const start = await handler(new Request('http://local/api/focus/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionKey: 'free:free-001', targetSeconds: 1500 }),
  }));
  expect(start?.status).toBe(200);
  for (const action of ['pause', 'resume', 'end']) {
    expect((await handler(new Request(`http://local/api/focus/${action}`, {
      method: 'POST',
    })))?.status).toBe(200);
  }

  expect(calls).toEqual([
    ['start', 'free:free-001', 1500],
    ['pause'],
    ['resume'],
    ['end', 'manual'],
  ]);
  expect(events.filter((event) => event.type === 'focus-invalidated')).toHaveLength(4);
});

test('binds the focus owner before an ending cycle starts its teacher turn', async () => {
  const order: string[] = [];
  const handler = createRequestHandler({
    root: '/tmp/unused-focus-http',
    registry: registry({
      subscribe: async (key: string) => {
        order.push(`bind:${key}`);
        return () => {};
      },
      endFocus: async () => {
        order.push('end');
        return {
          cycleId: snapshot.cycleId,
          sessionKey: snapshot.sessionKey,
          sessionId: snapshot.sessionId,
          targetSeconds: snapshot.targetSeconds,
          elapsedSeconds: 300,
          endedAt: '2026-08-12T08:05:00.000Z',
          reason: 'manual' as const,
        };
      },
    }) as never,
    hub: new EventHub(),
  });

  const response = await handler(new Request('http://local/api/focus/end', { method: 'POST' }));

  expect(response?.status).toBe(200);
  expect(order).toEqual(['bind:free:free-001', 'end']);
});

test('rejects arbitrary durations before the runtime is called', async () => {
  let called = false;
  const handler = createRequestHandler({
    root: '/tmp/unused-focus-http',
    registry: registry({ startFocus: async () => { called = true; return snapshot; } }) as never,
    hub: new EventHub(),
  });
  const response = await handler(new Request('http://local/api/focus/start', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionKey: 'free:free-001', targetSeconds: 60 }),
  }));

  expect(response?.status).toBe(400);
  expect(called).toBeFalse();
});
