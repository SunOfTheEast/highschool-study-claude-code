import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import type {
  AgentSessionEvent,
  SessionEntry,
} from '@earendil-works/pi-coding-agent';
import {
  loadStaticFreeLearningResources,
} from '../../src/runtime/resource-loader';
import type {
  SessionFactoryInput,
  StudySession,
  StudySessionFactory,
} from '../../src/runtime/session-factory';
import {
  FREE_LEARNING_ENDED_TYPE,
  isFreeLearningEnded,
} from '../../src/runtime/session-owner';
import type { FreeLearningSessionRecord } from '../../src/runtime/session-scope';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import { planLearningNoteSave, planProblemCardSave } from '../../src/study/learning-assets';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1b-free-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function fakeSession(
  id: string,
  entries: SessionEntry[] = [],
  prompted: string[] = [],
): StudySession {
  const listeners = new Set<(event: AgentSessionEvent) => void>();
  return {
    sessionId: id,
    sessionFile: `/sessions/${id}.jsonl`,
    messages: [],
    get entries() {
      return entries;
    },
    isStreaming: false,
    prompt: async (text) => { prompted.push(text); },
    abort: async () => {},
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    sendCustomMessage: async () => {},
    appendCustomEntry: (customType, data) => {
      entries.push({
        type: 'custom',
        id: `${customType}-${entries.length + 1}`,
        parentId: entries.at(-1)?.id ?? null,
        timestamp: '2026-08-08T10:00:00.000Z',
        customType,
        data,
      });
    },
    dispose: () => listeners.clear(),
  };
}

test('creates independent root sessions without creating teaching documents', async () => {
  const root = copyFixture();
  const inputs: SessionFactoryInput[] = [];
  let sequence = 0;
  const factory: StudySessionFactory = async (input) => {
    inputs.push(input);
    sequence += 1;
    return fakeSession(`free-session-${sequence}`);
  };
  const registry = new WorkspaceRegistry(root, factory, undefined, undefined, async () => null, async () => []);

  const note = planLearningNoteSave(root, 'seed-session', {
    title: '真实笔记', blocks: [{ kind: 'markdown', body: '正文。' }], sources: [],
    tags: { core: ['笔记'], related: [] },
  }, '2026-08-08T08:00:00.000Z');
  commitDocumentCandidates(root, note.candidates);
  const card = planProblemCardSave(root, 'seed-session', {
    stem: '真实题卡', standardAnswer: '答案', teacherRationale: '依据', studentNote: '',
    sources: [], tags: { core: ['题卡'], related: [] },
  }, '2026-08-08T08:10:00.000Z');
  commitDocumentCandidates(root, card.candidates);

  const first = await registry.createFreeLearning([]);
  const second = await registry.createFreeLearning([
    { kind: 'problem-card', id: card.card.id },
    { kind: 'note', id: note.note.id },
  ]);

  const tooMany = Array.from({ length: 13 }, (_, index) => ({
    kind: 'note' as const,
    id: index === 0 ? 'note-001' : `note-${String(index + 1).padStart(3, '0')}`,
  }));
  await expect(registry.createFreeLearning(tooMany, 'open'))
    .rejects.toThrow('SELECTED_CONTEXT_LIMIT_EXCEEDED');

  expect(first.sessionKey).toBe('free:free-session-1');
  expect(second.sessionKey).toBe('free:free-session-2');
  expect(inputs).toEqual([
    expect.objectContaining({ sessionKind: 'free-learning', selectedAssets: [], sessionFile: null }),
    expect.objectContaining({
      sessionKind: 'free-learning',
      selectedAssets: [
        { kind: 'problem-card', id: card.card.id },
        { kind: 'note', id: note.note.id },
      ],
      sessionFile: null,
    }),
  ]);
  expect(Bun.file(join(root, 'ROADMAP.md')).size).toBe(0);
  expect(Array.from(new Bun.Glob('**/*').scanSync(root)).some((path) => (
    /lesson|trace|classroom|summary/i.test(path)
  ))).toBe(false);
});

test('restores one owned Pi session and makes explicit end idempotent', async () => {
  const root = copyFixture();
  const scope = {
    sessionKind: 'free-learning',
    title: '自由学习',
    createdAt: '2026-08-08T09:00:00.000Z',
    selectedAssets: [],
  } as const;
  const persistedEntries: SessionEntry[] = [];
  const prompted: string[] = [];
  const opened: SessionFactoryInput[] = [];
  const record: FreeLearningSessionRecord = {
    id: 'persisted-1',
    sessionKey: 'free:persisted-1',
    title: '自由学习',
    createdAt: scope.createdAt,
    updatedAt: '2026-08-08T09:10:00.000Z',
    status: 'active',
    selectedAssets: [],
    sessionFile: '/sessions/persisted-1.jsonl',
    scope,
  };
  const registry = new WorkspaceRegistry(
    root,
    async (input) => {
      opened.push(input);
      return fakeSession('persisted-1', persistedEntries, prompted);
    },
    undefined,
    async () => persistedEntries,
    async (_root, id) => id === record.id ? record : null,
    async () => [record],
  );

  await registry.send('free:persisted-1', '继续刚才的问题。');
  expect(opened).toEqual([{ ...scope, sessionFile: record.sessionFile }]);
  expect(prompted).toEqual(['继续刚才的问题。']);

  await registry.endFreeLearning('free:persisted-1');
  await registry.endFreeLearning('free:persisted-1');
  expect(persistedEntries.filter((entry) => (
    entry.type === 'custom' && entry.customType === FREE_LEARNING_ENDED_TYPE
  ))).toHaveLength(1);
  expect(isFreeLearningEnded(persistedEntries)).toBe(true);
  expect(await registry.readHistory('free:persisted-1')).toBe(persistedEntries);
  expect(registry.send('free:persisted-1', '结束后不应继续')).rejects.toThrow(
    'FREE_LEARNING_SESSION_ENDED',
  );
});

test('loads only the free-learning root contract, memory index and selected asset handles', () => {
  const root = copyFixture();
  const resources = loadStaticFreeLearningResources(root, {
    sessionKind: 'free-learning',
    title: '自由学习',
    createdAt: '2026-08-08T09:00:00.000Z',
    selectedAssets: [],
  });
  const assembled = resources.agentsFiles.map((entry) => entry.content).join('\n');

  expect(resources.skillPaths.map((path) => basename(dirname(path)))).toEqual(['free-learning']);
  expect(resources.tools).toEqual([
    'read', 'grep', 'find', 'ls', 'propose_note', 'propose_problem_card',
    'save_note', 'save_problem_card',
    'free_learning_memory_commit',
  ]);
  expect(assembled).toContain('自由学习');
  expect(resources.agentsFiles).toContainEqual(expect.objectContaining({
    path: '/virtual/studyforge-teaching-core.md',
  }));
  expect(assembled).toContain('# Teaching Core');
  expect(assembled).not.toContain('# High-School Mathematics Teaching Core');
  expect(assembled).toContain('Selected asset handles:\n- none');
  expect(assembled).toContain('# Teacher Memory Index');
  expect(assembled).not.toContain('## Stage Goal');
  expect(assembled).not.toContain('ROADMAP.md');
  expect(resources.agentsFiles.some((entry) => (
    entry.path.endsWith('m0-document-contract.md')
  ))).toBe(false);
});
