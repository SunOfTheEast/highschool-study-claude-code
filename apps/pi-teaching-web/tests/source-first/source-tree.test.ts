import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import { createMaterialBookIndex, writeMaterialBookIndex } from '../../src/study/material-book-index';
import { planLearningNoteSave, planProblemCardSave } from '../../src/study/learning-assets';
import { importMaterial } from '../../src/study/materials';
import { readSourceTree } from '../../src/study/source-tree';

const roots: string[] = [];

function root() {
  const value = mkdtempSync(join(tmpdir(), 'studyforge-source-tree-'));
  roots.push(value);
  return value;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

async function addBook(rootPath: string, title: string, requestId: string) {
  const imported = await importMaterial(rootPath, {
    requestId, title, filename: `${requestId}.pdf`, mediaType: 'application/pdf',
    source: { kind: 'bytes', bytes: new TextEncoder().encode('%PDF fixture') },
  }, '2026-08-13T00:00:00.000Z');
  writeMaterialBookIndex(rootPath, createMaterialBookIndex({
    materialId: imported.id,
    revision: imported.revision,
    pageCount: 10,
    pageLabels: null,
    outline: [{
      id: 'chapter-1', title: '第一章', level: 1, source: 'curated', printedPage: '1',
      startPage: 1, endPage: 5, provenancePages: [],
    }, {
      id: 'chapter-unresolved', title: '待定位章节', level: 1, source: 'visual-toc',
      printedPage: '8', startPage: null, endPage: null, provenancePages: [1],
    }],
    updatedAt: '2026-08-13T00:01:00.000Z',
  }));
  const pages = join(rootPath, `materials/${imported.id}/projections/${imported.revision}/pages`);
  mkdirSync(pages, { recursive: true });
  for (let page = 1; page <= 10; page += 1) {
    writeFileSync(join(pages, `page-${String(page).padStart(4, '0')}.txt`), `第 ${page} 页`);
  }
  return imported;
}

test('projects canonical assets beneath every intersecting source book without duplicating facts', async () => {
  const learningSet = root();
  const first = await addBook(learningSet, '化学反应原理', 'book-a');
  const second = await addBook(learningSet, '专题精练', 'book-b');
  const notePlan = planLearningNoteSave(learningSet, 'free-source', {
    title: '跨书笔记', blocks: [{ kind: 'markdown', body: '同一个方法在两本书中出现。' }],
    sources: [
      { kind: 'material', id: first.id, revision: 1, locator: 'pages-0002-0003' },
      { kind: 'material', id: second.id, revision: 1, locator: 'page-0004' },
    ],
    tags: { core: ['恒成立'], related: [] },
  }, '2026-08-13T00:02:00.000Z');
  commitDocumentCandidates(learningSet, notePlan.candidates);
  const cardPlan = planProblemCardSave(learningSet, 'free-source', {
    stem: '一道章节题', standardAnswer: '答案', teacherRationale: '检验', studentNote: '',
    sources: [{ kind: 'material', id: first.id, revision: 1, locator: 'page-0005' }],
    tags: { core: ['章节题'], related: [] },
  }, '2026-08-13T00:03:00.000Z');
  commitDocumentCandidates(learningSet, cardPlan.candidates);
  const outside = planLearningNoteSave(learningSet, 'free-source', {
    title: '书外遐想', blocks: [{ kind: 'markdown', body: '从讨论中长出来。' }], sources: [],
    tags: { core: ['遐想'], related: [] },
  }, '2026-08-13T00:04:00.000Z');
  commitDocumentCandidates(learningSet, outside.candidates);

  const tree = readSourceTree(learningSet);
  expect(tree.books).toHaveLength(2);
  expect(tree.books[0]?.chapters[0]?.assets.map((asset) => asset.title)).toEqual([
    '跨书笔记', '一道章节题',
  ]);
  expect(tree.books[1]?.chapters[0]?.assets.map((asset) => asset.title)).toEqual(['跨书笔记']);
  const appearances = tree.books.flatMap((book) => book.chapters)
    .flatMap((chapter) => chapter.assets)
    .filter((asset) => asset.kind === 'note' && asset.id === notePlan.note.id);
  expect(appearances).toHaveLength(2);
  expect(new Set(appearances.map((asset) => `${asset.kind}:${asset.id}@${asset.revision}`)).size).toBe(1);
  expect(tree.outside.map((asset) => asset.title)).toEqual(['书外遐想']);
});

test('keeps old revisions pinned and degrades unresolved chapter mapping without guessing', async () => {
  const learningSet = root();
  const first = await addBook(learningSet, '第一版教材', 'book-old');
  const note = planLearningNoteSave(learningSet, 'free-source', {
    title: '旧版页码笔记', blocks: [{ kind: 'markdown', body: '固定在第一版。' }],
    sources: [{ kind: 'material', id: first.id, revision: 1, locator: 'page-0008' }],
    tags: { core: ['旧版'], related: [] },
  }, '2026-08-13T00:02:00.000Z');
  commitDocumentCandidates(learningSet, note.candidates);
  await importMaterial(learningSet, {
    requestId: 'book-old-revision-2', title: '第二版教材', filename: 'second.pdf',
    mediaType: 'application/pdf', source: { kind: 'bytes', bytes: new TextEncoder().encode('%PDF v2') },
    target: { id: first.id, expectedRevision: 1 },
  }, '2026-08-13T00:03:00.000Z');

  const tree = readSourceTree(learningSet);
  const oldBook = tree.books.find((book) => book.revision === 1)!;
  expect(oldBook.title).toBe('第一版教材');
  expect(oldBook.unresolved.assets[0]).toMatchObject({
    title: '旧版页码笔记', locator: 'page-0008', sourceRevision: 1,
  });
  expect(oldBook.chapters.flatMap((chapter) => chapter.assets)).toHaveLength(0);
});
