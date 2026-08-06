import { expect, test } from 'bun:test';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import { createLoopbackOriginPolicy } from '../../src/server/origin-policy';

const policy = createLoopbackOriginPolicy(65000, 'http://127.0.0.1:65001');

function createHandler(calls: string[] = []) {
  return createRequestHandler({
    root: '/unused',
    hub: new EventHub(),
    originPolicy: policy,
    registry: {
      readHistory: async () => [],
      send: async () => {},
      subscribe: async () => () => {},
    } as never,
    lifecycle: {
      startPlan: async () => {
        calls.push('start');
        return { route: '/course', sessionKey: 'plan:p' as never };
      },
      completePlan: async () => ({ route: '/course' }),
      startLesson: async () => ({ route: '/course', sessionKey: 'lesson:p:l' as never }),
      closeLesson: async () => ({ route: '/course' }),
    },
  });
}

test('rejects a foreign browser before a lifecycle action or websocket upgrade', async () => {
  const calls: string[] = [];
  const handler = createHandler(calls);
  let upgraded = false;
  const server = { upgrade: () => { upgraded = true; return true; } } as never;
  const headers = { origin: 'https://attacker.example' };

  const action = await handler(new Request('http://127.0.0.1:65000/api/plans/p/start', {
    method: 'POST',
    headers,
  }));
  const events = await handler(
    new Request('http://127.0.0.1:65000/events', { headers }),
    server,
  );

  expect(action?.status).toBe(403);
  expect(await action?.json()).toEqual({ error: 'ORIGIN_NOT_ALLOWED' });
  expect(events?.status).toBe(403);
  expect(calls).toEqual([]);
  expect(upgraded).toBe(false);
});

test('allows the production loopback browser origins', async () => {
  for (const origin of ['http://127.0.0.1:65000', 'http://localhost:65000']) {
    const calls: string[] = [];
    const response = await createHandler(calls)(new Request(
      'http://127.0.0.1:65000/api/plans/p/start',
      { method: 'POST', headers: { origin } },
    ));

    expect(response?.status).toBe(200);
    expect(calls).toEqual(['start']);
  }
});

test('allows the explicit loopback development origin to post and upgrade', async () => {
  const calls: string[] = [];
  const handler = createHandler(calls);
  const headers = { origin: 'http://127.0.0.1:65001' };
  let upgraded = false;
  const server = { upgrade: () => { upgraded = true; return true; } } as never;

  const action = await handler(new Request('http://127.0.0.1:65000/api/plans/p/start', {
    method: 'POST',
    headers,
  }));
  const events = await handler(
    new Request('http://127.0.0.1:65000/events', { headers }),
    server,
  );

  expect(action?.status).toBe(200);
  expect(calls).toEqual(['start']);
  expect(events).toBeUndefined();
  expect(upgraded).toBe(true);
});

test('allows requests without Origin for local CLI and tests', async () => {
  const calls: string[] = [];
  const response = await createHandler(calls)(new Request(
    'http://127.0.0.1:65000/api/plans/p/start',
    { method: 'POST' },
  ));

  expect(response?.status).toBe(200);
  expect(calls).toEqual(['start']);
});

test('rejects unsafe development origins', () => {
  for (const origin of [
    'https://127.0.0.1:65001',
    'http://example.com:65001',
    'http://user:pass@127.0.0.1:65001',
    'http://127.0.0.1:65001/path',
    'http://127.0.0.1:65001/?query=1',
    'http://127.0.0.1:65001/#fragment',
  ]) {
    expect(() => createLoopbackOriginPolicy(65000, origin)).toThrow(
      `STUDYFORGE_DEV_ORIGIN_INVALID: ${origin}`,
    );
  }
});
