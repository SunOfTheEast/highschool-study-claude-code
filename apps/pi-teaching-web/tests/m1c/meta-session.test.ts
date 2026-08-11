import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import { createMetaTools } from '../../src/runtime/meta-tools';
import { loadStaticMetaResources } from '../../src/runtime/resource-loader';
import type {
  SessionFactoryInput,
  StudySession,
  StudySessionFactory,
} from '../../src/runtime/session-factory';
import type { MetaSessionRecord } from '../../src/runtime/session-scope';
import type { MetaSessionScope } from '../../src/runtime/session-scope';
import {
  appendSessionOwner,
  readSessionOwner,
  sessionOwnerMatches,
} from '../../src/runtime/session-owner';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import { readRoadmap } from '../../src/study/markdown';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1c-meta-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function message(id: string, role: 'user' | 'assistant', text: string): SessionEntry {
  return {
    type: 'message',
    id,
    parentId: null,
    timestamp: '2026-08-09T12:00:00.000Z',
    message: { role, content: [{ type: 'text', text }], timestamp: Date.now() },
  } as SessionEntry;
}

function fakeSession(id: string, entries: SessionEntry[] = [], prompted: string[] = []): StudySession {
  const listeners = new Set<(event: AgentSessionEvent) => void>();
  return {
    sessionId: id,
    sessionFile: `/sessions/${id}.jsonl`,
    messages: [],
    get entries() { return entries; },
    isStreaming: false,
    prompt: async (text) => { prompted.push(text); },
    abort: async () => {},
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sendCustomMessage: async () => {},
    dispose: () => listeners.clear(),
  };
}

function roadmapInput() {
  return {
    title: '化学反应原理学习路线',
    overview: '从真实困惑出发，逐步建立平衡与速率之间的联系。',
    longTermGoal: '能解释关键原理，并在陌生情境中判断模型边界。',
    capabilityStandard: '能比较两种相近模型，说明适用前提并完成迁移题。',
    test: '用一道陌生综合题和一次口头解释检查迁移。',
    currentPosition: '目前只知道部分结论，还不清楚各模型为何成立以及何时失效。',
  };
}

test('creates and restores one root-level Meta Session without teaching documents', async () => {
  const root = copyFixture();
  const inputs: SessionFactoryInput[] = [];
  const factory: StudySessionFactory = async (input) => {
    inputs.push(input);
    return fakeSession('meta-session-001');
  };
  const registry = new WorkspaceRegistry(root, factory);

  const created = await registry.createMeta([]);
  expect(created.sessionKey).toBe('meta:meta-session-001');
  expect(inputs).toEqual([
    expect.objectContaining({ sessionKind: 'meta', selectedAssets: [], sessionFile: null }),
  ]);
  expect(existsSync(join(root, 'ROADMAP.md'))).toBe(false);
  expect(readdirSync(root).some((name) => /plan|lesson|trace|summary/i.test(name))).toBe(false);

  const scope: MetaSessionScope = {
    sessionKind: 'meta',
    title: '长期学习规划',
    createdAt: '2026-08-09T11:00:00.000Z',
    selectedAssets: [],
  };
  const record: MetaSessionRecord = {
    id: 'persisted-meta',
    sessionKey: 'meta:persisted-meta',
    title: '长期学习规划',
    createdAt: '2026-08-09T11:00:00.000Z',
    updatedAt: '2026-08-09T11:10:00.000Z',
    sessionFile: '/sessions/persisted-meta.jsonl',
    scope,
  };
  const ownerEntries: unknown[] = [];
  appendSessionOwner({
    appendCustomEntry: (customType, data) => ownerEntries.push({
      type: 'custom', customType, data,
    }),
  }, scope);
  expect(sessionOwnerMatches(readSessionOwner({ getEntries: () => ownerEntries }), scope)).toBe(true);
  const prompted: string[] = [];
  const restored = new WorkspaceRegistry(
    root,
    async () => fakeSession('persisted-meta', [], prompted),
    undefined,
    async () => [],
    undefined,
    undefined,
    async (_root, id) => id === record.id ? record : null,
    async () => [record],
  );
  await restored.send('meta:persisted-meta', '继续讨论长期方向。');
  expect(prompted).toEqual(['继续讨论长期方向。']);
  expect(await restored.listMeta()).toEqual([
    expect.objectContaining({ id: 'persisted-meta', sessionKey: 'meta:persisted-meta' }),
  ]);
});

test('loads one compact Meta context without course-tree or full-library permissions', () => {
  const root = copyFixture();
  const resources = loadStaticMetaResources(root, {
    sessionKind: 'meta',
    title: '长期学习规划',
    createdAt: '2026-08-09T12:00:00.000Z',
    selectedAssets: [],
  });
  const assembled = resources.agentsFiles.map((entry) => entry.content).join('\n');

  expect(resources.skillPaths.map((path) => basename(dirname(path)))).toEqual(['meta-dialogue']);
  expect(resources.tools).toEqual(['read', 'grep', 'create_roadmap']);
  expect(assembled).toContain('# Teacher Memory Index');
  expect(assembled).toContain('Current session kind: meta');
  expect(assembled).toContain('Semantic asset overview');
  expect(assembled).not.toContain('m0-document-contract');
  expect(assembled).not.toContain('## Plan Tree');
});

test('creates only ROADMAP.md without asking Runtime to interpret the dialogue', async () => {
  const root = copyFixture();
  const tool = createMetaTools(root)[0]!;
  const first = await tool.execute('create-roadmap-1', roadmapInput(), undefined, undefined, {} as never);
  const replay = await tool.execute('create-roadmap-1', roadmapInput(), undefined, undefined, {} as never);

  expect(replay).toEqual(first);
  expect(readRoadmap(root)).toMatchObject({
    id: 'roadmap',
    status: 'active',
    sessionId: null,
    title: '化学反应原理学习路线',
    plans: [],
  });
  expect(existsSync(join(root, 'plans'))).toBe(false);
});

test('rejects a second Roadmap as a mechanical uniqueness violation', async () => {
  const root = copyFixture();
  await createMetaTools(root)[0]!
    .execute('first', roadmapInput(), undefined, undefined, {} as never);
  await expect(createMetaTools(root)[0]!
    .execute('second', roadmapInput(), undefined, undefined, {} as never))
    .rejects.toThrow('ROADMAP_ALREADY_EXISTS');
});
