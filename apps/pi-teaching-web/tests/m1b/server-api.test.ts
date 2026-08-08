import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import type {
  FreeLearningSessionSummary,
  LearningAssetReference,
  SessionKey,
  StudyEvent,
} from '../../src/shared/contracts';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import {
  planLearningNoteSave,
  planProblemCardSave,
  readLearningNote,
} from '../../src/study/learning-assets';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1b-api-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function summary(id = 'free-session-001'): FreeLearningSessionSummary {
  return {
    id,
    sessionKey: `free:${id}`,
    title: '自由学习',
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    status: 'active',
  };
}

function fakeRegistry(overrides: Record<string, unknown> = {}) {
  return {
    readHistory: async () => [],
    send: async () => {},
    subscribe: async () => () => {},
    open: async () => ({}),
    abort: async () => {},
    release: async () => {},
    createFreeLearning: async () => summary(),
    listFreeLearning: async () => [],
    endFreeLearning: async () => ({ ...summary(), status: 'ended' as const }),
    ...overrides,
  };
}

async function body(response: Response | undefined) {
  return response?.json() as Promise<Record<string, any>>;
}

test('serves a blank home with recent native free-learning threads', async () => {
  const root = copyFixture();
  const handler = createRequestHandler({
    root,
    hub: new EventHub(),
    registry: fakeRegistry({ listFreeLearning: async () => [summary()] }) as never,
  });

  const response = await handler(new Request('http://local/api/home'));
  expect(response?.status).toBe(200);
  expect(await body(response)).toMatchObject({
    guide: { title: '空白学习集' },
    hasCourse: false,
    course: null,
    assets: { notes: 0, problemCards: 0 },
    recentFreeLearning: [{ sessionKey: 'free:free-session-001', status: 'active' }],
  });
});

test('creates, addresses and explicitly ends a free-learning Session', async () => {
  const root = copyFixture();
  const createdWith: LearningAssetReference[][] = [];
  const sent: Array<[SessionKey, string]> = [];
  const ended: SessionKey[] = [];
  const hub = new EventHub();
  const events: StudyEvent[] = [];
  hub.subscribe((event) => events.push(event));
  const handler = createRequestHandler({
    root,
    hub,
    registry: fakeRegistry({
      createFreeLearning: async (assets: LearningAssetReference[]) => {
        createdWith.push(assets);
        return summary();
      },
      send: async (key: SessionKey, text: string) => { sent.push([key, text]); },
      endFreeLearning: async (key: SessionKey) => {
        ended.push(key);
        return { ...summary(), status: 'ended' as const };
      },
    }) as never,
  });

  const create = await handler(new Request('http://local/api/free-learning', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ selectedAssets: [] }),
  }));
  expect(create?.status).toBe(201);
  expect(await body(create)).toMatchObject({
    session: { sessionKey: 'free:free-session-001' },
    route: '/learn/free-session-001',
  });
  expect(createdWith).toEqual([[]]);

  const send = await handler(new Request(
    'http://local/api/sessions/free%3Afree-session-001/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '我想问一个平衡问题。' }),
    },
  ));
  expect(send?.status).toBe(202);
  await Bun.sleep(0);
  expect(sent).toEqual([['free:free-session-001', '我想问一个平衡问题。']]);

  const end = await handler(new Request(
    'http://local/api/free-learning/free-session-001/end',
    { method: 'POST' },
  ));
  expect(end?.status).toBe(200);
  expect(ended).toEqual(['free:free-session-001']);
  expect(events).toContainEqual({ type: 'home-invalidated' });
});

test('round-trips Note and gated problem-card activity without private leakage', async () => {
  const root = copyFixture();
  commitDocumentCandidates(root, planLearningNoteSave(root, 'seed-session', {
    title: '平衡常数',
    blocks: [{ kind: 'markdown', body: '温度不变时，平衡常数不随加料改变。' }],
    sources: [],
  }, '2026-08-08T09:00:00.000Z').candidates);
  commitDocumentCandidates(root, planProblemCardSave(root, 'seed-session', {
    stem: '加入 NaCl 后，AgCl 的 Ksp 是否改变？',
    standardAnswer: '恒温下 Ksp 不变，变化的是离子积。',
    teacherRationale: '先区分常数和即时状态。',
    studentNote: '别把平衡移动说成常数改变。',
    sources: [],
  }, '2026-08-08T09:00:00.000Z').candidates);
  const selected: LearningAssetReference[][] = [];
  const handler = createRequestHandler({
    root,
    hub: new EventHub(),
    registry: fakeRegistry({
      createFreeLearning: async (assets: LearningAssetReference[]) => {
        selected.push(assets);
        return summary('free-session-ask');
      },
    }) as never,
  });

  const assets = await body(await handler(new Request('http://local/api/assets')));
  expect(assets.notes).toContainEqual(expect.objectContaining({ id: 'note-001' }));
  expect(assets.problemCards).toContainEqual(expect.objectContaining({ id: 'problem-001' }));

  const hidden = await body(await handler(new Request(
    'http://local/api/assets/problem-cards/problem-001',
  )));
  expect(hidden.standardAnswer).toBeNull();
  expect(JSON.stringify(hidden)).not.toContain('teacherRationale');
  expect(JSON.stringify(hidden)).not.toContain('先区分常数');

  const attempt = await handler(new Request(
    'http://local/api/problem-cards/problem-001/attempts',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        requestId: 'attempt-request-1',
        response: { kind: 'answer', text: 'Ksp 变小。' },
      }),
    },
  ));
  expect(attempt?.status).toBe(201);
  expect(await body(attempt)).toMatchObject({ event: { answerViewedBefore: false } });

  const reveal = await handler(new Request(
    'http://local/api/problem-cards/problem-001/reveal',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ requestId: 'reveal-request-1' }),
    },
  ));
  expect(reveal?.status).toBe(200);
  expect((await body(reveal)).standardAnswer).toContain('离子积');
  expect((await body(await handler(new Request(
    'http://local/api/assets/problem-cards/problem-001',
  )))).standardAnswer).toContain('离子积');

  const ask = await handler(new Request(
    'http://local/api/problem-cards/problem-001/ask-teacher',
    { method: 'POST' },
  ));
  expect(await body(ask)).toMatchObject({ route: '/learn/free-session-ask' });
  expect(selected).toEqual([[{ kind: 'problem-card', id: 'problem-001' }]]);
});

test('edits student-owned asset fields with stale revision protection', async () => {
  const root = copyFixture();
  commitDocumentCandidates(root, planLearningNoteSave(root, 'seed-session', {
    title: '初稿',
    blocks: [{ kind: 'markdown', body: '第一版。' }],
    sources: [],
  }, '2026-08-08T09:00:00.000Z').candidates);
  const handler = createRequestHandler({
    root,
    hub: new EventHub(),
    registry: fakeRegistry() as never,
  });
  const edit = await handler(new Request('http://local/api/assets/notes/note-001', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: 1,
      title: '修订稿',
      blocks: [{ kind: 'markdown', body: '第二版。' }],
    }),
  }));
  expect(edit?.status).toBe(200);
  expect(readLearningNote(root, 'note-001')).toMatchObject({ revision: 2, title: '修订稿' });

  const stale = await handler(new Request('http://local/api/assets/notes/note-001', {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      expectedRevision: 1,
      title: '过期编辑',
      blocks: [{ kind: 'markdown', body: '不应覆盖。' }],
    }),
  }));
  expect(stale?.status).toBe(409);
  expect(readLearningNote(root, 'note-001').title).toBe('修订稿');
});

test('publishes asset invalidation only after successful free-learning writes', async () => {
  const root = copyFixture();
  const hub = new EventHub();
  const events: StudyEvent[] = [];
  hub.subscribe((event) => events.push(event));
  let listener: ((event: AgentSessionEvent) => void) | null = null;
  const handler = createRequestHandler({
    root,
    hub,
    registry: fakeRegistry({
      subscribe: async (_key: SessionKey, callback: (event: AgentSessionEvent) => void) => {
        listener = callback;
        return () => {};
      },
      send: async () => {
        listener?.({
          type: 'tool_execution_end',
          toolCallId: 'save-1',
          toolName: 'save_note',
          result: { details: { kind: 'learning-asset-save' } },
          isError: false,
        });
        listener?.({
          type: 'tool_execution_end',
          toolCallId: 'save-failed',
          toolName: 'save_problem_card',
          result: { details: { kind: 'learning-asset-save' } },
          isError: true,
        });
        listener?.({ type: 'agent_end', messages: [], willRetry: false });
      },
    }) as never,
  });

  await handler(new Request('http://local/api/sessions/free%3Afree-session-001/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '保存吧。' }),
  }));
  await Bun.sleep(0);

  expect(events.filter((event) => event.type === 'assets-invalidated')).toHaveLength(1);
  expect(events.filter((event) => event.type === 'knowledge-invalidated')).toHaveLength(1);
  expect(events.filter((event) => event.type === 'home-invalidated')).toHaveLength(1);
});

