import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrapPdfBookIndex } from '../../src/study/pdf-book';
import { readMaterialBookIndex } from '../../src/study/material-book-index';
import { readMaterialPage } from '../../src/study/material-page-reader';
import { importMaterial, readMaterialLocator } from '../../src/study/materials';
import { writeThreePageBook } from './pdf-fixture';

const roots: string[] = [];

async function book(emptyPages: number[] = []) {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-page-reader-'));
  roots.push(root);
  const path = join(root, 'source.pdf');
  writeThreePageBook(path, { emptyPages });
  const material = await importMaterial(root, {
    requestId: crypto.randomUUID(), title: '三页教材', filename: 'source.pdf',
    mediaType: 'application/pdf', source: { kind: 'path', absolutePath: path },
  }, '2026-08-13T00:00:00.000Z');
  await bootstrapPdfBookIndex(root, material.id, material.revision, '2026-08-13T00:01:00.000Z');
  return { root, material };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function vision(text = '视觉读取正文') {
  const prompts: string[] = [];
  return {
    prompts,
    read: async (input: { prompt: string }) => {
      prompts.push(input.prompt);
      return { text, model: 'test/vision' };
    },
  };
}

test('persists sane native text without calling vision and reuses the successful page', async () => {
  const { root, material } = await book();
  const visual = vision();
  const first = await readMaterialPage(root, material.id, material.revision, 1, {
    mode: 'auto', vision: visual, updatedAt: '2026-08-13T00:02:00.000Z',
  });
  expect(first).toMatchObject({ state: 'native-text', method: 'native', cached: false });
  expect(first.text).toContain('PAGE ONE');
  expect(visual.prompts).toHaveLength(0);

  const repeated = await readMaterialPage(root, material.id, material.revision, 1, {
    mode: 'auto', vision: visual, updatedAt: '2026-08-13T00:03:00.000Z',
  });
  expect(repeated).toMatchObject({ state: 'native-text', cached: true });
  expect(visual.prompts).toHaveLength(0);
  expect(readMaterialLocator(root, {
    id: material.id, revision: material.revision, locator: 'page-0001',
  }).text).toContain('PAGE ONE');
});

test('routes an empty scanned page to vision and supports an explicit visual reread', async () => {
  const { root, material } = await book([2]);
  const visual = vision('扫描页里的表格');
  const scanned = await readMaterialPage(root, material.id, material.revision, 2, {
    mode: 'auto', vision: visual, updatedAt: '2026-08-13T00:02:00.000Z',
  });
  expect(scanned).toMatchObject({ state: 'visual-text', method: 'vision', model: 'test/vision' });
  expect(scanned.text).toBe('扫描页里的表格');

  const reread = await readMaterialPage(root, material.id, material.revision, 1, {
    mode: 'visual', vision: visual, updatedAt: '2026-08-13T00:03:00.000Z',
  });
  expect(reread).toMatchObject({ state: 'visual-text', method: 'vision', cached: false });
  expect(visual.prompts).toHaveLength(2);
});

test('persists a failed pending page and permits a later explicit retry', async () => {
  const { root, material } = await book([2]);
  const failedVision = { read: async () => { throw new Error('provider detail'); } };
  await expect(readMaterialPage(root, material.id, material.revision, 2, {
    mode: 'auto', vision: failedVision, updatedAt: '2026-08-13T00:02:00.000Z',
  })).rejects.toThrow('MATERIAL_PAGE_READ_FAILED');
  expect(readMaterialBookIndex(root, material.id, material.revision)?.pages[1])
    .toMatchObject({ state: 'failed', error: 'MATERIAL_PAGE_READ_FAILED' });

  const recovered = await readMaterialPage(root, material.id, material.revision, 2, {
    mode: 'visual', vision: vision('重试成功'), updatedAt: '2026-08-13T00:03:00.000Z',
  });
  expect(recovered).toMatchObject({ state: 'visual-text', text: '重试成功' });
});
