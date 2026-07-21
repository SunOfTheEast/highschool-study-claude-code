import { expect, test } from 'bun:test';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';

const learningSet = { title: 'Demo', overview: 'Overview', goal: 'Goal', plans: [] };
const workspace = {
  learningSet,
  plan: {
    id: 'p1',
    title: 'Plan',
    path: 'plans/p1.md',
    status: 'active',
    goal: 'Goal',
    capabilityStandard: 'Can do',
  },
  coach: { sessionKey: 'coach:p1', sessionId: null },
  lessons: [],
} as const;

test('returns learning-set and Plan snapshots', async () => {
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
      snapshot: () => workspace,
      send: async () => {},
      startLesson: async () => ({}),
      pauseLesson: async () => {},
      abandonForReprepare: async () => {},
      history: () => [],
      subscribe: () => () => {},
    } as never,
  });
  expect(await (await handler(new Request('http://local/api/learning-set')))!.json())
    .toEqual(learningSet);
  expect(await (await handler(new Request('http://local/api/workspaces/p1')))!.json())
    .toEqual(workspace);
});

test('routes a message to the selected Session key', async () => {
  const sent: unknown[] = [];
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
      snapshot: () => workspace,
      send: async (...args: unknown[]) => {
        sent.push(args);
      },
      startLesson: async () => ({}),
      pauseLesson: async () => {},
      abandonForReprepare: async () => {},
      openCoach: async () => ({ sessionId: 'coach-p1' }),
      openTutor: async () => ({ sessionId: 'tutor-l1' }),
      history: () => [],
      subscribe: () => () => {},
    } as never,
  });
  const response = await handler(new Request('http://local/api/sessions/coach%3Ap1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '继续学习' }),
  }));
  expect(response!.status).toBe(202);
  expect(sent).toEqual([['coach:p1', '继续学习', []]]);
});
