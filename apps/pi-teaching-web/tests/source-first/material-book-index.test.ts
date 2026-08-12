import { afterEach, expect, test } from 'bun:test';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseYaml } from 'yaml';
import {
  createMaterialBookIndex,
  materialBookIndexPath,
  readMaterialBookIndex,
  writeMaterialBookIndex,
} from '../../src/study/material-book-index';

const roots: string[] = [];

function root() {
  const value = join('/tmp', `studyforge-book-index-${crypto.randomUUID()}`);
  mkdirSync(value, { recursive: true });
  roots.push(value);
  return value;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('creates a complete physical page ledger at one deterministic revision path', () => {
  const learningSet = root();
  const index = createMaterialBookIndex({
    materialId: 'material-001',
    revision: 2,
    pageCount: 3,
    pageLabels: ['封面', '1', '2'],
    outline: [{
      id: 'outline-001',
      title: '第一章',
      level: 1,
      source: 'pdf-bookmark',
      printedPage: '1',
      startPage: 2,
      endPage: 3,
      provenancePages: [],
    }],
    updatedAt: '2026-08-12T20:00:00.000Z',
  });

  expect(materialBookIndexPath('material-001', 2))
    .toBe('materials/material-001/projections/2/book-index.yaml');
  expect(index.pages).toEqual([
    expect.objectContaining({ physicalPage: 1, pdfLabel: '封面', state: 'pending' }),
    expect.objectContaining({ physicalPage: 2, pdfLabel: '1', state: 'pending' }),
    expect.objectContaining({ physicalPage: 3, pdfLabel: '2', state: 'pending' }),
  ]);

  writeMaterialBookIndex(learningSet, index);
  expect(readMaterialBookIndex(learningSet, 'material-001', 2)).toEqual(index);
  expect(parseYaml(readFileSync(join(learningSet, materialBookIndexPath('material-001', 2)), 'utf8')))
    .toMatchObject({ schema: 'studyforge.material-book-index.v1', material_id: 'material-001', revision: 2 });
});

test('atomically replaces page state and rejects a projection with the wrong identity', () => {
  const learningSet = root();
  const index = createMaterialBookIndex({
    materialId: 'material-001', revision: 1, pageCount: 1, pageLabels: null, outline: [],
    updatedAt: '2026-08-12T20:00:00.000Z',
  });
  writeMaterialBookIndex(learningSet, index);
  writeMaterialBookIndex(learningSet, {
    ...index,
    pages: [{
      physicalPage: 1,
      pdfLabel: null,
      state: 'native-text',
      textPath: 'materials/material-001/projections/1/pages/page-0001.txt',
      method: 'native',
      model: null,
      updatedAt: '2026-08-12T20:01:00.000Z',
      error: null,
    }],
    updatedAt: '2026-08-12T20:01:00.000Z',
  });
  expect(readMaterialBookIndex(learningSet, 'material-001', 1)?.pages[0]?.state)
    .toBe('native-text');
  expect(readMaterialBookIndex(learningSet, 'material-002', 1)).toBeNull();

  const path = join(learningSet, materialBookIndexPath('material-001', 1));
  const source = readFileSync(path, 'utf8').replace('material_id: material-001', 'material_id: material-002');
  writeFileSync(path, source);
  expect(() => readMaterialBookIndex(learningSet, 'material-001', 1))
    .toThrow('MATERIAL_BOOK_INDEX_IDENTITY_INVALID');
  expect(existsSync(path)).toBeTrue();
});
