import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Check } from 'typebox/value';
import { createFreeLearningMemoryTool } from '../../src/runtime/memory-tools';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import {
  planFreeLearningMemoryCommit,
  type FreeLearningMemoryCommitDraft,
} from '../../src/study/memory-mutations';

const fixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1b-memory-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function newObject(): FreeLearningMemoryCommitDraft {
  return {
    objects: [{
      target: { kind: 'new', key: 'ksp-boundary', title: '溶度积与固体边界' },
      learningHistoryChange: '学生在比较离子积与 Ksp 后，独立纠正了“加入盐会让 Ksp 变小”的说法。',
      currentJudgment: '能区分离子积随操作变化，而恒温下 Ksp 不变。',
      evolutionOverview: '从把平衡移动误说成常数改变，发展到能区分状态量与常数。',
      boundaries: ['尚未检验能否迁移到气相平衡常数。'],
      routing: {
        kind: 'defer',
        reason: '需由阶段视角判断归入平衡常数还是沉淀溶解对象。',
      },
      frontierSummary: '已纠正 Ksp 随加盐改变的误解，迁移边界待检验。',
    }],
  };
}

async function execute(
  tool: NonNullable<ReturnType<typeof createFreeLearningMemoryTool>>,
  id: string,
  input: unknown,
) {
  const result = await tool.execute(id, input as never, undefined, undefined, {} as never);
  return JSON.parse((result.content[0] as { text: string }).text) as Record<string, unknown>;
}

test('creates object memory directly from one whole native Session', () => {
  const root = copyFixture();
  const planned = planFreeLearningMemoryCommit(
    root,
    'free-session-001',
    newObject(),
    '2026-08-08T10:00:00.000Z',
  );
  commitDocumentCandidates(root, planned.candidates);

  expect(planned.objectIds).toEqual({ 'ksp-boundary': 'obj-001' });
  const object = readFileSync(join(root, 'memory/objects/obj-001.md'), 'utf8');
  expect(object).toContain('学生在比较离子积与 Ksp 后');
  expect(object).toContain('原生自由学习 Session `free-session-001`');
  expect(object).toContain('2026-08-08T10:00:00.000Z');
  for (const forbidden of ['Block `', 'Classroom Log', 'Trace', 'message ID', 'turn']) {
    expect(object).not.toContain(forbidden);
  }
});

test('appends history while patching only the existing snapshot fields that changed', () => {
  const root = copyFixture();
  commitDocumentCandidates(root, planFreeLearningMemoryCommit(
    root,
    'free-session-001',
    newObject(),
    '2026-08-08T10:00:00.000Z',
  ).candidates);
  const before = readFileSync(join(root, 'memory/objects/obj-001.md'), 'utf8');
  const evolution = /## Evolution Overview\n\n([\s\S]*?)\n\n## Learning History/.exec(before)![1];
  const boundaries = /## Boundaries \/ Not Yet Demonstrated\n\n([\s\S]*)$/.exec(before)![1];
  const update: FreeLearningMemoryCommitDraft = {
    objects: [{
      target: { kind: 'existing', id: 'obj-001' },
      learningHistoryChange: '换成硫酸钡情境后，学生仍能独立说明恒温下 Ksp 不变。',
      currentJudgment: '能在氯化银与硫酸钡两个情境中区分离子积变化与 Ksp 不变。',
      routing: { kind: 'keep' },
    }],
  };
  commitDocumentCandidates(root, planFreeLearningMemoryCommit(
    root,
    'free-session-002',
    update,
    '2026-08-08T11:00:00.000Z',
  ).candidates);
  const after = readFileSync(join(root, 'memory/objects/obj-001.md'), 'utf8');

  expect(after).toContain('free-session-001');
  expect(after).toContain('free-session-002');
  expect(after).toContain('氯化银与硫酸钡两个情境');
  expect(after).toContain(`## Evolution Overview\n\n${evolution}`);
  expect(after).toContain(`## Boundaries / Not Yet Demonstrated\n\n${boundaries}`);
});

test('requires a complete snapshot only for a genuinely new object', () => {
  const root = copyFixture();
  const incomplete: FreeLearningMemoryCommitDraft = {
    objects: [{
      target: { kind: 'new', key: 'incomplete', title: '不完整对象' },
      learningHistoryChange: '只写了一条历史。',
      routing: { kind: 'defer', reason: '归属未知。' },
    }],
  };

  expect(() => planFreeLearningMemoryCommit(
    root,
    'free-session-001',
    incomplete,
    '2026-08-08T10:00:00.000Z',
  )).toThrow('NEW_OBJECT_SNAPSHOT_REQUIRED');
  expect(() => planFreeLearningMemoryCommit(
    root,
    'free-session-001',
    { objects: [] },
    '2026-08-08T10:00:00.000Z',
  )).toThrow('FREE_LEARNING_MEMORY_CHANGE_REQUIRED');
});

test('keeps runtime provenance and authorization fields out of the tool schema', () => {
  const root = copyFixture();
  const tool = createFreeLearningMemoryTool(root, 'free-session-001')!;

  expect(Check(tool.parameters, newObject())).toBeTrue();
  for (const extra of [
    { sessionId: 'free-session-001' },
    { timestamp: '2026-08-08' },
    { path: 'memory/objects/obj-001.md' },
    { messageId: 'message-1' },
    { turnRange: '1-4' },
    { confirmed: true },
  ]) {
    expect(Check(tool.parameters, { ...newObject(), ...extra })).toBeFalse();
  }
});

test('commits mid-session and replays one successful native tool call', async () => {
  const root = copyFixture();
  const tool = createFreeLearningMemoryTool(root, 'free-session-001')!;
  const first = await execute(tool, 'memory-call-1', newObject());
  const replay = await execute(tool, 'memory-call-1', newObject());

  expect(first).toEqual(replay);
  expect(first).toMatchObject({
    ok: true,
    objectIds: { 'ksp-boundary': 'obj-001' },
    changedPaths: ['memory/objects/obj-001.md', 'memory/INDEX.md'],
  });
  expect(readFileSync(join(root, 'memory/objects/obj-001.md'), 'utf8'))
    .toContain('free-session-001');
});

