import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importMaterial } from '../../src/study/materials';
import { bootstrapPdfBookIndex } from '../../src/study/pdf-book';
import { writeThreePageBook } from './pdf-fixture';

const roots: string[] = [];

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'studyforge-pdf-book-'));
  mkdirSync(value, { recursive: true });
  roots.push(value);
  return value;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('bootstraps labels and nested bookmarks without reading page bodies', async () => {
  const learningSet = root();
  const source = join(learningSet, 'book.pdf');
  writeThreePageBook(source);
  const imported = await importMaterial(learningSet, {
    requestId: 'book-import-001',
    title: '三页教材',
    filename: 'book.pdf',
    mediaType: 'application/pdf',
    source: { kind: 'path', absolutePath: source },
  }, '2026-08-12T20:00:00.000Z');

  const index = await bootstrapPdfBookIndex(
    learningSet,
    imported.id,
    imported.revision,
    '2026-08-12T20:01:00.000Z',
  );

  expect(index.pages).toEqual([
    expect.objectContaining({ physicalPage: 1, pdfLabel: 'Cover', state: 'pending' }),
    expect.objectContaining({ physicalPage: 2, pdfLabel: '1', state: 'pending' }),
    expect.objectContaining({ physicalPage: 3, pdfLabel: '2', state: 'pending' }),
  ]);
  expect(index.outline).toEqual([
    expect.objectContaining({ title: 'Chapter One', level: 1, startPage: 1, endPage: 2 }),
    expect.objectContaining({ title: 'Section One', level: 2, startPage: 2, endPage: 2 }),
    expect.objectContaining({ title: 'Chapter Two', level: 1, startPage: 3, endPage: 3 }),
  ]);
  expect(index.pages.every((page) => page.textPath === null)).toBeTrue();
});

test('repeated bootstrap preserves already processed page states', async () => {
  const learningSet = root();
  const source = join(learningSet, 'book.pdf');
  writeThreePageBook(source);
  const imported = await importMaterial(learningSet, {
    requestId: 'book-import-002', title: '三页教材', filename: 'book.pdf',
    mediaType: 'application/pdf', source: { kind: 'path', absolutePath: source },
  }, '2026-08-12T20:00:00.000Z');
  const first = await bootstrapPdfBookIndex(
    learningSet, imported.id, imported.revision, '2026-08-12T20:01:00.000Z',
  );
  first.pages[0] = {
    ...first.pages[0]!, state: 'native-text', method: 'native',
    textPath: 'materials/material-001/projections/1/pages/page-0001.txt',
    updatedAt: '2026-08-12T20:02:00.000Z',
  };
  const { writeMaterialBookIndex } = await import('../../src/study/material-book-index');
  writeMaterialBookIndex(learningSet, first);

  const repeated = await bootstrapPdfBookIndex(
    learningSet, imported.id, imported.revision, '2026-08-12T20:03:00.000Z',
  );
  expect(repeated.pages[0]).toMatchObject({
    state: 'native-text', method: 'native',
    textPath: 'materials/material-001/projections/1/pages/page-0001.txt',
  });
});
