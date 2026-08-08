import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import type {
  LearningContextReference,
  MetaSessionSummary,
  SessionKey,
  StudyEvent,
} from '../../src/shared/contracts';
import { planLearningNoteSave } from '../../src/study/learning-assets';
import type { OwnedLearningSessionFact } from '../../src/study/learning-footprint';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1c-api-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function metaSummary(id = 'meta-session-001'): MetaSessionSummary {
  return {
    id,
    sessionKey: `meta:${id}`,
    title: '长期学习规划',
    createdAt: '2026-08-09T10:00:00.000Z',
    updatedAt: '2026-08-09T10:00:00.000Z',
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
    createFreeLearning: async () => { throw new Error('not used'); },
    listFreeLearning: async () => [],
    endFreeLearning: async () => { throw new Error('not used'); },
    createMeta: async () => metaSummary(),
    listMeta: async () => [],
    listOwnedSessionFacts: async () => [],
    ...overrides,
  };
}

async function responseBody(response: Response | undefined) {
  return response?.json() as Promise<Record<string, any>>;
}

function materialForm(input: {
  requestId: string;
  title: string;
  text: string;
  type?: string;
  filename?: string;
  targetId?: string;
  expectedRevision?: number;
}) {
  const form = new FormData();
  form.set('requestId', input.requestId);
  form.set('title', input.title);
  form.set('file', new File([input.text], input.filename ?? 'chapter.md', {
    type: input.type ?? 'text/markdown',
  }));
  if (input.targetId) form.set('targetId', input.targetId);
  if (input.expectedRevision !== undefined) {
    form.set('expectedRevision', String(input.expectedRevision));
  }
  return form;
}

test('imports, revises, lists, and reads an exact Material locator', async () => {
  const root = copyFixture();
  const hub = new EventHub();
  const events: StudyEvent[] = [];
  hub.subscribe((event) => events.push(event));
  const handler = createRequestHandler({ root, hub, registry: fakeRegistry() as never });

  const imported = await handler(new Request('http://local/api/materials', {
    method: 'POST',
    body: materialForm({
      requestId: 'material-request-001',
      title: 'Ksp 原文',
      text: '纯固体活度并入常数。\nKsp 只写相关离子浓度。',
    }),
  }));
  expect(imported?.status).toBe(201);
  expect(await responseBody(imported)).toMatchObject({
    id: 'material-001', revision: 1, searchStatus: 'native-text',
  });
  expect(await responseBody(await handler(new Request('http://local/api/materials'))))
    .toHaveLength(1);
  expect(await responseBody(await handler(new Request(
    'http://local/api/materials/material-001',
  )))).toMatchObject({
    current: { title: 'Ksp 原文', revision: 1 },
    suggestedLocator: 'lines-1-2',
  });
  expect(await responseBody(await handler(new Request(
    'http://local/api/materials/material-001/revisions/1/locators/lines-1-1',
  )))).toMatchObject({
    id: 'material-001', revision: 1, locator: 'lines-1-1', text: '纯固体活度并入常数。',
  });

  const revised = await handler(new Request('http://local/api/materials', {
    method: 'POST',
    body: materialForm({
      requestId: 'material-request-002',
      title: 'Ksp 原文（修订）',
      text: '修订后的内容。',
      targetId: 'material-001',
      expectedRevision: 1,
    }),
  }));
  expect(await responseBody(revised)).toMatchObject({ id: 'material-001', revision: 2 });
  expect(events.filter((event) => event.type === 'assets-invalidated')).toHaveLength(2);

  const beforeFailure = events.length;
  const rejected = await handler(new Request('http://local/api/materials', {
    method: 'POST',
    body: materialForm({
      requestId: 'material-request-bad',
      title: '脚本',
      text: '#!/bin/sh',
      type: 'application/x-sh',
      filename: 'script.sh',
    }),
  }));
  expect(rejected?.status).toBe(400);
  expect(events).toHaveLength(beforeFailure);
});

test('updates semantic tags and exposes bounded recall and derived relations', async () => {
  const root = copyFixture();
  commitDocumentCandidates(root, planLearningNoteSave(root, 'seed-session', {
    title: 'Ksp 中的纯固体',
    blocks: [{ kind: 'markdown', body: '纯固体的活度并入平衡常数。' }],
    sources: [],
    tags: { core: ['沉淀溶解平衡'], related: ['纯固体'] },
  }, '2026-08-09T09:00:00.000Z').candidates);
  const hub = new EventHub();
  const events: StudyEvent[] = [];
  hub.subscribe((event) => events.push(event));
  const handler = createRequestHandler({ root, hub, registry: fakeRegistry() as never });

  expect(await responseBody(await handler(new Request(
    'http://local/api/semantics/assets/note/note-001',
  )))).toMatchObject({
    subject: { kind: 'note', id: 'note-001' },
    revision: 1,
    core: ['沉淀溶解平衡'],
  });
  const updated = await handler(new Request(
    'http://local/api/semantics/assets/note/note-001',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        expectedRevision: 1,
        core: ['沉淀溶解平衡', '平衡常数'],
        related: ['纯固体'],
      }),
    },
  ));
  expect(await responseBody(updated)).toMatchObject({ revision: 2, core: ['沉淀溶解平衡', '平衡常数'] });

  const recalled = await responseBody(await handler(new Request('http://local/api/semantics/query', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ terms: ['平衡常数'], limit: 2, allowRelatedExpansion: false }),
  })));
  expect(recalled).toMatchObject({ matched: 1, candidates: [{ id: 'note-001' }] });
  const relations = await responseBody(await handler(new Request(
    'http://local/api/semantics/relations',
  )));
  expect(relations).toContainEqual(expect.objectContaining({
    kind: 'asset-tag', asset: { kind: 'note', id: 'note-001' }, tag: '平衡常数',
  }));

  const beforeFailure = events.length;
  const stale = await handler(new Request(
    'http://local/api/semantics/assets/note/note-001',
    {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 1, core: ['错误覆盖'], related: [] }),
    },
  ));
  expect(stale?.status).toBe(409);
  expect(events).toHaveLength(beforeFailure);
});

test('creates and addresses Meta sessions and projects the current learning footprint', async () => {
  const root = copyFixture();
  const selected: LearningContextReference[][] = [];
  const sent: Array<[SessionKey, string]> = [];
  const meta = metaSummary();
  const facts: OwnedLearningSessionFact[] = [{
    id: meta.id,
    title: meta.title,
    createdAt: meta.createdAt,
    entryTimes: [meta.createdAt, '2026-08-09T10:03:00.000Z'],
    owner: {
      sessionKind: 'meta',
      title: meta.title,
      createdAt: meta.createdAt,
      selectedAssets: [],
    },
    status: 'active',
  }];
  const handler = createRequestHandler({
    root,
    hub: new EventHub(),
    registry: fakeRegistry({
      createMeta: async (assets: LearningContextReference[]) => {
        selected.push(assets);
        return meta;
      },
      listMeta: async () => [meta],
      listOwnedSessionFacts: async () => facts,
      send: async (key: SessionKey, text: string) => { sent.push([key, text]); },
    }) as never,
  });

  expect(await responseBody(await handler(new Request('http://local/api/home'))))
    .toMatchObject({ recentMeta: [{ sessionKey: 'meta:meta-session-001' }] });
  const created = await handler(new Request('http://local/api/meta', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ selectedAssets: [] }),
  }));
  expect(created?.status).toBe(201);
  expect(await responseBody(created)).toMatchObject({
    session: { sessionKey: 'meta:meta-session-001' },
    route: '/meta/meta-session-001',
  });
  expect(selected).toEqual([[]]);
  expect(await responseBody(await handler(new Request('http://local/api/meta'))))
    .toEqual([meta]);

  const sentResponse = await handler(new Request(
    'http://local/api/sessions/meta%3Ameta-session-001/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '我确实不知道该怎么长期学。' }),
    },
  ));
  expect(sentResponse?.status).toBe(202);
  await Bun.sleep(0);
  expect(sent).toEqual([['meta:meta-session-001', '我确实不知道该怎么长期学。']]);

  expect(await responseBody(await handler(new Request('http://local/api/footprint'))))
    .toMatchObject({ entries: [
      expect.objectContaining({ activity: 'session-continue', route: '/meta/meta-session-001' }),
      expect.objectContaining({ activity: 'session-start', route: '/meta/meta-session-001' }),
    ] });
});
