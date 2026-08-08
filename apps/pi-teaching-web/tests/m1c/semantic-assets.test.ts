import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import {
  listLearningNotes,
  listProblemCards,
  planLearningNoteSave,
  planProblemCardSave,
  readLearningNote,
  readLearningNoteRevision,
  readProblemCardRevision,
} from '../../src/study/learning-assets';
import {
  planSemanticTagsSave,
  readSemanticTags,
} from '../../src/study/semantic-tags';
import { buildCardRecallIndex } from '../../scripts/build-card-recall-index';

const blankFixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function copyFixture(source = blankFixture): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1c-assets-'));
  cpSync(source, root, { recursive: true });
  roots.push(root);
  return root;
}

function tags(core = ['平衡常数'], related: string[] = []) {
  return { core, related };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('creates canonical content and an independently revisioned semantic sidecar together', () => {
  const root = copyFixture();
  const planned = planLearningNoteSave(root, 'session-001', {
    title: 'Ksp 中固体的位置',
    blocks: [{ kind: 'markdown', body: '纯固体活度并入平衡常数。' }],
    sources: [],
    tags: tags(
      ['沉淀溶解平衡', '平衡常数', '平衡常数'],
      ['固体活度', '平衡常数', '固体活度'],
    ),
  }, '2026-08-09T10:00:00.000Z');

  expect(planned.candidates.map((candidate) => candidate.path)).toEqual([
    'notes/note-001.note.yaml',
    'semantics/assets/note/note-001.tags.yaml',
  ]);
  commitDocumentCandidates(root, planned.candidates);

  expect(readSemanticTags(root, { kind: 'note', id: 'note-001' })).toEqual({
    schema: 'studyforge.semantic-tags.v1',
    subject: { kind: 'note', id: 'note-001' },
    revision: 1,
    core: ['沉淀溶解平衡', '平衡常数'],
    related: ['固体活度'],
    updatedAt: '2026-08-09T10:00:00.000Z',
  });
});

test('rejects missing core tags, multiline tags, and blank words', () => {
  const root = copyFixture();
  const draft = {
    title: '非法标签',
    blocks: [{ kind: 'markdown' as const, body: '正文。' }],
    sources: [],
  };

  for (const invalid of [
    tags([], []),
    tags(['第一行\n第二行']),
    tags(['   ']),
  ]) {
    expect(() => planLearningNoteSave(root, 'session-001', {
      ...draft,
      tags: invalid,
    }, '2026-08-09T10:00:00.000Z')).toThrow('SEMANTIC_TAG');
  }
});

test('updates tag metadata without changing the asset revision', () => {
  const root = copyFixture();
  const created = planProblemCardSave(root, 'session-001', {
    stem: '判断温度不变时 Ksp 是否改变。',
    standardAnswer: '不改变。',
    teacherRationale: '区分状态与常数。',
    studentNote: '',
    sources: [],
    tags: tags(),
  }, '2026-08-09T10:00:00.000Z');
  commitDocumentCandidates(root, created.candidates);

  const metadata = planSemanticTagsSave(root, {
    kind: 'problem-card',
    id: 'problem-001',
  }, {
    expectedRevision: 1,
    tags: tags(['化学平衡'], ['平衡常数']),
  }, '2026-08-09T11:00:00.000Z');
  commitDocumentCandidates(root, [metadata.candidate]);

  expect(readProblemCardRevision(root, 'problem-001', 1).revision).toBe(1);
  expect(readSemanticTags(root, { kind: 'problem-card', id: 'problem-001' }))
    .toMatchObject({ revision: 2, core: ['化学平衡'], related: ['平衡常数'] });
  expect(() => planSemanticTagsSave(root, {
    kind: 'problem-card', id: 'problem-001',
  }, {
    expectedRevision: 1,
    tags: tags(['过期写入']),
  }, '2026-08-09T12:00:00.000Z')).toThrow('SEMANTIC_TAG_REVISION_STALE');
});

test('archives exact canonical bytes on revision and reads current or historical revisions precisely', () => {
  const root = copyFixture();
  const first = planLearningNoteSave(root, 'session-001', {
    title: '第一版',
    blocks: [{ kind: 'markdown', body: '旧正文。' }],
    sources: [],
    tags: tags(),
  }, '2026-08-09T10:00:00.000Z');
  commitDocumentCandidates(root, first.candidates);
  const oldBytes = readFileSync(join(root, 'notes/note-001.note.yaml'), 'utf8');

  const second = planLearningNoteSave(root, 'session-002', {
    target: { id: 'note-001', expectedRevision: 1 },
    expectedTagRevision: 1,
    title: '第二版',
    blocks: [{ kind: 'markdown', body: '新正文。' }],
    sources: [],
    tags: tags(['化学平衡']),
  }, '2026-08-09T11:00:00.000Z');
  expect(second.candidates.map((candidate) => candidate.path)).toContain(
    'notes/.revisions/note-001/1.note.yaml',
  );
  commitDocumentCandidates(root, second.candidates);

  expect(readFileSync(join(root, 'notes/.revisions/note-001/1.note.yaml'), 'utf8'))
    .toBe(oldBytes);
  expect(readLearningNoteRevision(root, 'note-001', 1)).toMatchObject({
    revision: 1,
    title: '第一版',
  });
  expect(readLearningNoteRevision(root, 'note-001', 2)).toMatchObject({
    revision: 2,
    title: '第二版',
  });
  expect(() => readLearningNoteRevision(root, 'note-001', 3))
    .toThrow('ASSET_REVISION_UNRESOLVED');
  expect(listLearningNotes(root).map((note) => note.id)).toEqual(['note-001']);
});

test('archives problem cards without making historical revisions ordinary cards', () => {
  const root = copyFixture();
  const first = planProblemCardSave(root, 'session-001', {
    stem: '第一版题干。',
    standardAnswer: '第一版答案。',
    teacherRationale: '第一版依据。',
    studentNote: '',
    sources: [],
    tags: tags(['题卡']),
  }, '2026-08-09T10:00:00.000Z');
  commitDocumentCandidates(root, first.candidates);
  const second = planProblemCardSave(root, 'session-002', {
    target: { id: 'problem-001', expectedRevision: 1 },
    expectedTagRevision: 1,
    stem: '第二版题干。',
    standardAnswer: '第二版答案。',
    teacherRationale: '第二版依据。',
    studentNote: '',
    sources: [],
    tags: tags(['题卡修订']),
  }, '2026-08-09T11:00:00.000Z');
  commitDocumentCandidates(root, second.candidates);

  expect(readProblemCardRevision(root, 'problem-001', 1).stem).toBe('第一版题干。');
  expect(readProblemCardRevision(root, 'problem-001', 2).stem).toBe('第二版题干。');
  expect(listProblemCards(root).map((card) => card.id)).toEqual(['problem-001']);
});

test('reads legacy unpinned sources visibly but refuses to save them as pinned current revisions', () => {
  const root = copyFixture();
  mkdirSync(join(root, 'notes'), { recursive: true });
  writeFileSync(join(root, 'notes/legacy.note.yaml'), stringifyYaml({
    schema: 'studyforge.note.v1',
    id: 'legacy',
    revision: 1,
    title: '旧笔记',
    created_at: '2026-08-08T10:00:00.000Z',
    updated_at: '2026-08-08T10:00:00.000Z',
    created_session_id: 'legacy-session',
    sources: [{ kind: 'problem-card', id: 'missing-card' }],
    blocks: [{ kind: 'markdown', body: '旧正文。' }],
  }));

  expect(readLearningNote(root, 'legacy').sources).toEqual([{
    kind: 'legacy-unpinned',
    assetKind: 'problem-card',
    id: 'missing-card',
  }]);
  expect(() => planLearningNoteSave(root, 'session-001', {
    title: '不能伪装固定',
    blocks: [{ kind: 'markdown', body: '正文。' }],
    sources: [{ kind: 'problem-card', id: 'missing-card' }] as never,
    tags: tags(),
  }, '2026-08-09T10:00:00.000Z')).toThrow('LEGACY_UNPINNED_SOURCE');
});

test('keeps a legacy asset without a sidecar tag-free during a content-only edit', () => {
  const root = copyFixture();
  mkdirSync(join(root, 'notes'), { recursive: true });
  writeFileSync(join(root, 'notes/legacy.note.yaml'), stringifyYaml({
    schema: 'studyforge.note.v1',
    id: 'legacy',
    revision: 1,
    title: '旧标题',
    created_at: '2026-08-08T10:00:00.000Z',
    updated_at: '2026-08-08T10:00:00.000Z',
    created_session_id: 'legacy-session',
    sources: [],
    blocks: [{ kind: 'markdown', body: '旧正文。' }],
  }));
  const current = readLearningNote(root, 'legacy');
  const edit = planLearningNoteSave(root, 'student-editor', {
    target: { id: 'legacy', expectedRevision: 1 },
    title: '新标题',
    blocks: current.blocks,
    sources: current.sources,
  }, '2026-08-09T10:00:00.000Z');
  commitDocumentCandidates(root, edit.candidates);

  expect(readLearningNote(root, 'legacy')).toMatchObject({ revision: 2, title: '新标题' });
  expect(() => readSemanticTags(root, { kind: 'note', id: 'legacy' })).toThrow(
    'semantic tags do not exist',
  );
});

test('pins source revisions and rejects duplicates, unresolved revisions, and self references', () => {
  const root = copyFixture();
  const card = planProblemCardSave(root, 'session-001', {
    stem: '来源题。',
    standardAnswer: '答案。',
    teacherRationale: '依据。',
    studentNote: '',
    sources: [],
    tags: tags(['来源']),
  }, '2026-08-09T10:00:00.000Z');
  commitDocumentCandidates(root, card.candidates);
  const source = { kind: 'problem-card' as const, id: 'problem-001', revision: 1 };
  const base = {
    title: '派生笔记',
    blocks: [{ kind: 'markdown' as const, body: '正文。' }],
    tags: tags(['派生']),
  };

  const note = planLearningNoteSave(root, 'session-002', {
    ...base,
    sources: [source],
  }, '2026-08-09T11:00:00.000Z');
  commitDocumentCandidates(root, note.candidates);
  expect(readLearningNote(root, 'note-001').sources).toEqual([source]);

  expect(() => planLearningNoteSave(root, 'session-002', {
    ...base,
    sources: [source, source],
  }, '2026-08-09T11:00:00.000Z')).toThrow('DUPLICATE_ASSET_SOURCE');
  expect(() => planLearningNoteSave(root, 'session-002', {
    ...base,
    sources: [{ ...source, revision: 2 }],
  }, '2026-08-09T11:00:00.000Z')).toThrow('ASSET_REVISION_UNRESOLVED');
  expect(() => planLearningNoteSave(root, 'session-002', {
    ...base,
    sources: [{ kind: 'note', id: 'missing-note', revision: 1 }],
  }, '2026-08-09T11:00:00.000Z')).toThrow('ASSET_REVISION_UNRESOLVED');
  expect(() => planLearningNoteSave(root, 'session-002', {
    target: { id: 'note-001', expectedRevision: 1 },
    expectedTagRevision: 1,
    ...base,
    sources: [{ kind: 'note', id: 'note-001', revision: 1 }],
  }, '2026-08-09T11:00:00.000Z')).toThrow('ASSET_SOURCE_SELF_REFERENCE');
  expect(() => planLearningNoteSave(root, 'session-002', {
    ...base,
    sources: [{ kind: 'material', id: 'book-001', revision: 1 }] as never,
  }, '2026-08-09T11:00:00.000Z')).toThrow('locator must be non-empty');
  expect(() => planLearningNoteSave(root, 'session-002', {
    ...base,
    sources: [{
      kind: 'material', id: 'book-001', revision: 1, locator: 'page-0001',
    }],
  }, '2026-08-09T11:00:00.000Z')).toThrow('ASSET_REVISION_UNRESOLVED');
});

test('rejects a revision-level cycle already present in a pinned source chain', () => {
  const root = copyFixture();
  for (const title of ['A', 'B']) {
    const planned = planLearningNoteSave(root, 'session-001', {
      title,
      blocks: [{ kind: 'markdown', body: `${title} 正文。` }],
      sources: [],
      tags: tags([title]),
    }, '2026-08-09T10:00:00.000Z');
    commitDocumentCandidates(root, planned.candidates);
  }
  const aPath = join(root, 'notes/note-001.note.yaml');
  const bPath = join(root, 'notes/note-002.note.yaml');
  const a = parseYaml(readFileSync(aPath, 'utf8')) as Record<string, unknown>;
  const b = parseYaml(readFileSync(bPath, 'utf8')) as Record<string, unknown>;
  a.sources = [{ kind: 'note', id: 'note-002', revision: 1 }];
  b.sources = [{ kind: 'note', id: 'note-001', revision: 1 }];
  writeFileSync(aPath, stringifyYaml(a));
  writeFileSync(bPath, stringifyYaml(b));

  expect(() => planLearningNoteSave(root, 'session-002', {
    title: 'C',
    blocks: [{ kind: 'markdown', body: 'C 正文。' }],
    sources: [{ kind: 'note', id: 'note-001', revision: 1 }],
    tags: tags(['C']),
  }, '2026-08-09T11:00:00.000Z')).toThrow('ASSET_SOURCE_CYCLE');
});

test('excludes revision archives from ordinary card enumeration and legacy recall scans', async () => {
  const root = copyFixture();
  const original = join(root, 'cards/legacy/sample.card.yaml');
  mkdirSync(join(root, 'cards/legacy'), { recursive: true });
  writeFileSync(original, stringifyYaml({
    schema: 'highschool-study.problem-card.v1',
    content_item_id: 'sample-card',
    storage_uri: 'cards/legacy/sample.card.yaml',
    stem: '一张旧题卡。',
    graph: {
      goal: { primary: '理解概念' },
      method: { primary: '定义判断' },
      structure: { primary: '单问' },
    },
  }));
  const before = await buildCardRecallIndex(root);
  const archiveDirectory = join(root, 'cards/.revisions/sample-card');
  mkdirSync(archiveDirectory, { recursive: true });
  cpSync(original, join(archiveDirectory, '1.card.yaml'));

  expect(listProblemCards(root).map((card) => card.id)).toEqual(['sample-card']);
  expect(await buildCardRecallIndex(root)).toBe(before);
});
