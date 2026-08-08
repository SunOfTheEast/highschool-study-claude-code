import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { Check } from 'typebox/value';
import { createFreeLearningTools } from '../../src/runtime/free-learning-tools';
import {
  planProblemCardSave,
  readLearningNote,
  readProblemCard,
} from '../../src/study/learning-assets';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1b-tools-'));
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
    timestamp: '2026-08-08T10:00:00.000Z',
    message: { role, content: [{ type: 'text', text }], timestamp: Date.now() },
  } as SessionEntry;
}

function manager(entries: SessionEntry[]) {
  return {
    getSessionId: () => 'free-session-001',
    getBranch: () => entries,
  };
}

async function execute(
  tool: ReturnType<typeof createFreeLearningTools>[number],
  id: string,
  input: unknown,
) {
  const result = await tool.execute(id, input as never, undefined, undefined, {} as never);
  return JSON.parse((result.content[0] as { text: string }).text) as Record<string, unknown>;
}

test('keeps runtime authority fields and confirmation flags out of both schemas', () => {
  const root = copyFixture();
  const scope = {
    sessionKind: 'free-learning' as const,
    title: '自由学习',
    createdAt: '2026-08-08T10:00:00.000Z',
    selectedAssets: [],
  };
  const [note, card] = createFreeLearningTools(root, scope, manager([]));
  const noteInput = {
    title: '一个笔记',
    blocks: [{ kind: 'markdown', body: '正文。' }],
    sourceAliases: [],
  };
  const cardInput = {
    stem: '一道题。',
    standardAnswer: '答案。',
    teacherRationale: '教师依据。',
    studentNote: '',
    sourceAliases: [],
  };
  expect(Check(note!.parameters, noteInput)).toBeTrue();
  expect(Check(card!.parameters, cardInput)).toBeTrue();
  for (const extra of [
    { id: 'note-001' },
    { path: 'notes/note-001.note.yaml' },
    { revision: 1 },
    { createdAt: 'now' },
    { sessionId: 'free-session-001' },
    { confirmed: true },
  ]) {
    expect(Check(note!.parameters, { ...noteInput, ...extra })).toBeFalse();
  }
});

test('rejects a save before the latest student message explicitly approves it', async () => {
  const root = copyFixture();
  const entries = [
    message('u1', 'user', '继续讲讲这个区别。'),
    message('a1', 'assistant', '这段可以整理成一份笔记。'),
    message('u2', 'user', '先把例子讲完。'),
  ];
  const [tool] = createFreeLearningTools(root, {
    sessionKind: 'free-learning',
    title: '自由学习',
    createdAt: '2026-08-08T10:00:00.000Z',
    selectedAssets: [],
  }, manager(entries));

  expect(execute(tool!, 'save-without-approval', {
    title: '不应保存',
    blocks: [{ kind: 'markdown', body: '没有得到批准。' }],
    sourceAliases: [],
  })).rejects.toThrow('ASSET_SAVE_NOT_CONFIRMED');
  expect(() => readLearningNote(root, 'note-001')).toThrow();
});

test('saves after explicit approval, resolves selected aliases, and replays one call', async () => {
  const root = copyFixture();
  commitDocumentCandidates(root, planProblemCardSave(root, 'seed-session', {
    stem: '来源题。',
    standardAnswer: '来源答案。',
    teacherRationale: '来源教师依据。',
    studentNote: '',
    sources: [],
  }, '2026-08-08T09:00:00.000Z').candidates);
  const directApproval = [message('u1', 'user', '可以，保存为笔记。')];
  const scope = {
    sessionKind: 'free-learning' as const,
    title: '自由学习',
    createdAt: '2026-08-08T10:00:00.000Z',
    selectedAssets: [{ kind: 'problem-card' as const, id: 'problem-001' }],
  };
  const [note] = createFreeLearningTools(root, scope, manager(directApproval));
  const input = {
    title: '参数不改变平衡常数',
    blocks: [{ kind: 'markdown', body: '温度不变时，加入反应物不改变平衡常数。' }],
    sourceAliases: ['source-1'],
  };
  const first = await execute(note!, 'save-note-1', input);
  const replay = await execute(note!, 'save-note-1', input);

  expect(first).toEqual(replay);
  expect(first).toMatchObject({
    ok: true,
    asset: { kind: 'note', id: 'note-001', revision: 1 },
  });
  expect(readLearningNote(root, 'note-001').sources).toEqual([
    { kind: 'problem-card', id: 'problem-001' },
  ]);
});

test('accepts a short acknowledgement only when it follows a visible card proposal', async () => {
  const root = copyFixture();
  const entries = [
    message('a1', 'assistant', '要不要把刚才这道自编题保存成题卡？题干和答案如下……'),
    message('u1', 'user', '嗯'),
  ];
  const [, card] = createFreeLearningTools(root, {
    sessionKind: 'free-learning',
    title: '自由学习',
    createdAt: '2026-08-08T10:00:00.000Z',
    selectedAssets: [],
  }, manager(entries));

  await execute(card!, 'save-card-1', {
    stem: '判断加入固体后平衡常数是否改变。',
    standardAnswer: '温度不变时不改变。',
    teacherRationale: '区分反应进度与平衡常数。',
    studentNote: '',
    sourceAliases: [],
  });
  expect(readProblemCard(root, 'problem-001').teacherRationale)
    .toBe('区分反应进度与平衡常数。');
});
