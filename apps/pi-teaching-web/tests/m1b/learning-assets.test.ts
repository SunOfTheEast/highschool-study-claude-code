import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  planLearningNoteSave,
  planProblemCardSave,
  readLearningNote,
  readProblemCard,
  readStudentProblemCard,
  renderSelectedAssetContext,
} from '../../src/study/learning-assets';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';

const blankFixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const oldFixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

function copyFixture(source = blankFixture): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1b-assets-'));
  cpSync(source, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('round-trips one mixed Note with runtime-owned identity and revision', () => {
  const root = copyFixture();
  const planned = planLearningNoteSave(root, 'session-001', {
    title: 'Ksp 中固体的位置',
    blocks: [
      { kind: 'markdown', body: '固体不进入浓度商，但会影响平衡能否建立。' },
      {
        kind: 'recall',
        prompt: '为什么 Ksp 表达式里没有纯固体？',
        answer: '纯固体活度视为常数，已并入平衡常数。',
      },
    ],
    sources: [],
  }, '2026-08-08T10:00:00.000Z');
  commitDocumentCandidates(root, planned.candidates);

  expect(planned.receipt).toEqual({
    kind: 'note',
    id: 'note-001',
    revision: 1,
    path: 'notes/note-001.note.yaml',
  });
  expect(readLearningNote(root, 'note-001')).toMatchObject({
    id: 'note-001',
    revision: 1,
    title: 'Ksp 中固体的位置',
    createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z',
    createdSessionId: 'session-001',
    sources: [],
    blocks: [
      { kind: 'markdown', body: '固体不进入浓度商，但会影响平衡能否建立。' },
      {
        kind: 'recall',
        prompt: '为什么 Ksp 表达式里没有纯固体？',
        answer: '纯固体活度视为常数，已并入平衡常数。',
      },
    ],
  });
});

test('keeps one canonical problem card while projecting different readers', () => {
  const root = copyFixture();
  const planned = planProblemCardSave(root, 'session-002', {
    stem: '向饱和 AgCl 溶液中加入少量 NaCl，说明平衡变化。',
    standardAnswer: '氯离子浓度升高，离子积暂时增大，随后析出 AgCl。',
    teacherRationale: '先区分 Ksp 不变与离子积变化，再讨论固体的地位。',
    studentNote: '不能说成 Ksp 变小。',
    sources: [],
  }, '2026-08-08T10:10:00.000Z');
  commitDocumentCandidates(root, planned.candidates);

  const tutor = readProblemCard(root, 'problem-001');
  const student = readStudentProblemCard(root, 'problem-001', false);
  expect(tutor).toMatchObject({
    id: 'problem-001',
    revision: 1,
    teacherRationale: '先区分 Ksp 不变与离子积变化，再讨论固体的地位。',
    studentNote: '不能说成 Ksp 变小。',
  });
  expect(student).toEqual({
    kind: 'problem-card',
    id: 'problem-001',
    revision: 1,
    title: '向饱和 AgCl 溶液中加入少量 NaCl，说明平衡变化。',
    stem: '向饱和 AgCl 溶液中加入少量 NaCl，说明平衡变化。',
    studentNote: '不能说成 Ksp 变小。',
    standardAnswer: null,
    sources: [],
  });
  expect(JSON.stringify(student)).not.toContain('teacherRationale');
  expect(readStudentProblemCard(root, 'problem-001', true).standardAnswer)
    .toContain('离子积暂时增大');
});

test('supports old complete cards and rejects stale asset revisions', () => {
  const oldRoot = copyFixture(oldFixture);
  expect(readProblemCard(oldRoot, 'sample-card')).toMatchObject({
    id: 'sample-card',
    revision: 1,
    stem: '设函数 $f(x)=e^x-ax$，讨论其最小值。',
  });

  const root = copyFixture();
  const first = planLearningNoteSave(root, 'session-001', {
    title: '初稿',
    blocks: [{ kind: 'markdown', body: '第一版。' }],
    sources: [],
  }, '2026-08-08T10:00:00.000Z');
  commitDocumentCandidates(root, first.candidates);
  const update = planLearningNoteSave(root, 'session-002', {
    target: { id: 'note-001', expectedRevision: 1 },
    title: '修订稿',
    blocks: [{ kind: 'markdown', body: '第二版。' }],
    sources: [],
  }, '2026-08-08T11:00:00.000Z');
  commitDocumentCandidates(root, update.candidates);

  expect(readLearningNote(root, 'note-001')).toMatchObject({ revision: 2, title: '修订稿' });
  expect(() => planLearningNoteSave(root, 'session-003', {
    target: { id: 'note-001', expectedRevision: 1 },
    title: '过期覆盖',
    blocks: [{ kind: 'markdown', body: '不应写入。' }],
    sources: [],
  }, '2026-08-08T12:00:00.000Z')).toThrow('ASSET_REVISION_STALE');
});

test('injects only explicitly selected full Tutor projections with stable aliases', () => {
  const root = copyFixture();
  commitDocumentCandidates(root, planProblemCardSave(root, 'session-001', {
    stem: '一张被选中的题。',
    standardAnswer: '标准答案。',
    teacherRationale: '教师依据。',
    studentNote: '',
    sources: [],
  }, '2026-08-08T10:00:00.000Z').candidates);
  const context = renderSelectedAssetContext(root, [
    { kind: 'problem-card', id: 'problem-001' },
  ]);

  expect(context).toContain('source-1');
  expect(context).toContain('一张被选中的题。');
  expect(context).toContain('教师依据。');
  expect(context).not.toContain('sample-card');
});

