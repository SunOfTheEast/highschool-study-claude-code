import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { createFreeLearningTools } from '../../src/runtime/free-learning-tools';
import { createLessonTools } from '../../src/runtime/lesson-tools';
import { loadStaticFreeLearningResources } from '../../src/runtime/resource-loader';
import { readLearningNote } from '../../src/study/learning-assets';
import { importMaterial } from '../../src/study/materials';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1c-session-assets-'));
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
    timestamp: '2026-08-09T10:00:00.000Z',
    message: { role, content: [{ type: 'text', text }], timestamp: Date.now() },
  } as SessionEntry;
}

function manager(entries: SessionEntry[]) {
  return {
    getSessionId: () => 'lesson-session-001',
    getBranch: () => entries,
  };
}

function noteInput(sourceAliases: string[]) {
  return {
    title: '参数位置与入口',
    blocks: [{ kind: 'markdown' as const, body: '先辨认参数落在哪个结构里，再决定入口。' }],
    sourceAliases,
    tags: { core: ['参数位置'], related: ['入口选择'] },
  };
}

async function execute(
  tool: { execute(...args: any[]): Promise<any> },
  id: string,
  input: unknown,
) {
  const result = await tool.execute(id, input as never, undefined, undefined, {} as never);
  return JSON.parse((result.content[0] as { text: string }).text) as Record<string, unknown>;
}

test('Lesson exposes the same narrow asset tools without restoring native writes', () => {
  const root = copyFixture();
  const tools = createLessonTools(root, lessonPath, manager([]));

  expect(tools.map((tool) => tool.name)).toEqual([
    'classroom_log_append',
    'classroom_update',
    'save_note',
    'save_problem_card',
    'propose_note',
    'propose_problem_card',
    'lesson_memory_commit',
    'record_asset_review',
    'finish_lesson',
  ]);
});

test('Lesson leaves approval semantics to Tutor but still binds only its exact Uses', async () => {
  const root = copyFixture();
  writeFileSync(join(root, 'cards/unlinked.card.yaml'), [
    'schema: highschool-study.problem-card.v1',
    'content_item_id: unlinked-card',
    'storage_uri: cards/unlinked.card.yaml',
    'stem: 不应成为当前课堂来源。',
    '',
  ].join('\n'));

  const save = createLessonTools(root, lessonPath, manager([
    message('a1', 'assistant', '你已经抓住参数位置了。'),
    message('u1', 'user', '我懂了，继续吧。'),
  ])).find((tool) => tool.name === 'save_note')!;
  const receipt = await execute(save, 'save-note', noteInput(['source-1']));

  expect(receipt).toMatchObject({
    ok: true,
    asset: { kind: 'note', id: 'note-001', revision: 1 },
  });
  expect(readLearningNote(root, 'note-001').sources).toEqual([
    { kind: 'problem-card', id: 'sample-card', revision: 1 },
  ]);
  expect(readFileSync(join(root, 'cards/unlinked.card.yaml'), 'utf8'))
    .toContain('unlinked-card');

  const unknown = createLessonTools(root, lessonPath, manager([
    message('a2', 'assistant', '要把这段保存为笔记吗？'),
    message('u2', 'user', '保存吧'),
  ])).find((tool) => tool.name === 'save_note')!;
  await expect(execute(unknown, 'unknown-source', noteInput(['source-2'])))
    .rejects.toThrow('ASSET_SOURCE_ALIAS_UNKNOWN');
});

test('Free Learning binds one selected Material locator to the same source alias', async () => {
  const root = copyFixture();
  const material = await importMaterial(root, {
    requestId: 'selected-material',
    title: 'Ksp 原文',
    filename: 'ksp.md',
    mediaType: 'text/markdown',
    source: { kind: 'bytes', bytes: new TextEncoder().encode('纯固体活度并入平衡常数。\n第二行。') },
  }, '2026-08-09T09:00:00.000Z');
  const scope = {
    sessionKind: 'free-learning' as const,
    title: '自由学习',
    createdAt: '2026-08-09T10:00:00.000Z',
    selectedAssets: [{
      kind: 'material' as const,
      id: material.id,
      revision: material.revision,
      locator: 'lines-1-1',
    }],
  };
  const context = loadStaticFreeLearningResources(root, scope)
    .agentsFiles.map((entry) => entry.content).join('\n');
  expect(context).toContain('source-1 · material:material-001@1');
  expect(context).toContain('纯固体活度并入平衡常数');

  const save = createFreeLearningTools(root, scope, {
    getSessionId: () => 'free-session-001',
    getBranch: () => [
      message('a1', 'assistant', '要把刚才形成的解释保存为笔记吗？'),
      message('u1', 'user', '保存吧'),
    ],
  }).find((tool) => tool.name === 'save_note')!;
  await execute(save, 'save-material-note', noteInput(['source-1']));

  expect(readLearningNote(root, 'note-001').sources).toEqual([{
    kind: 'material',
    id: 'material-001',
    revision: 1,
    locator: 'lines-1-1',
  }]);
});
