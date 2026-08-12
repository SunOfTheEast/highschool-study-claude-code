import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { bootstrapPdfBookIndex } from '../../src/study/pdf-book';
import {
  readMaterialBookIndex,
  writeMaterialBookIndex,
} from '../../src/study/material-book-index';
import {
  locateMaterialOutlineNode,
  readMaterialPage,
  scanMaterialVisualOutline,
} from '../../src/study/material-page-reader';
import { importMaterial } from '../../src/study/materials';
import { writeThreePageBook } from './pdf-fixture';

const roots: string[] = [];

async function book() {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-visual-toc-'));
  roots.push(root);
  const path = join(root, 'source.pdf');
  writeThreePageBook(path);
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

test('adds bounded visual outline candidates without replacing PDF bookmarks', async () => {
  const { root, material } = await book();
  let requestPrompt = '';
  const index = await scanMaterialVisualOutline(
    root,
    material.id,
    material.revision,
    { startPage: 1, endPage: 2 },
    {
      read: async (input) => {
        requestPrompt = input.prompt;
        return {
          text: '', model: 'test/vision',
          outline: [{ title: '视觉目录章', level: 1, printedPage: '2' }],
          printedPageOffset: 4,
        };
      },
    },
    '2026-08-13T00:02:00.000Z',
  );
  expect(index.outline.some((node) => node.source === 'pdf-bookmark')).toBeTrue();
  expect(index.outline).toContainEqual(expect.objectContaining({
    title: '视觉目录章', source: 'visual-toc', startPage: null, endPage: null,
    provenancePages: [1, 2],
  }));
  expect(requestPrompt).toContain('编/章/节');
  expect(requestPrompt).toContain('printedPageOffset');

  const rebuilt = await scanMaterialVisualOutline(
    root,
    material.id,
    material.revision,
    { startPage: 2, endPage: 3 },
    {
      read: async () => ({
        text: '', model: 'test/vision',
        outline: [{ title: '重建后的目录章', level: 1, printedPage: '2' }],
      }),
    },
    '2026-08-13T00:02:30.000Z',
  );
  expect(rebuilt.outline.some((node) => node.source === 'pdf-bookmark')).toBeTrue();
  expect(rebuilt.outline.filter((node) => node.source === 'visual-toc').map((node) => node.title))
    .toEqual(['重建后的目录章']);
  expect(rebuilt.printedPageOffsetHint).toBeNull();

  await expect(scanMaterialVisualOutline(
    root, material.id, material.revision, { startPage: 1, endPage: 13 },
    { read: async () => ({ text: '', model: 'test/vision', outline: [] }) },
    '2026-08-13T00:03:00.000Z',
  )).rejects.toThrow('MATERIAL_OUTLINE_RANGE_INVALID');
});

test('locates a visual node only after its title appears in a bounded candidate page', async () => {
  const { root, material } = await book();
  const scanned = await scanMaterialVisualOutline(
    root, material.id, material.revision, { startPage: 1, endPage: 2 },
    {
      read: async () => ({
        text: '', model: 'test/vision',
        outline: [{ title: 'PAGE THREE', level: 1, printedPage: '1' }],
        printedPageOffset: 2,
      }),
    },
    '2026-08-13T00:02:00.000Z',
  );
  const node = scanned.outline.find((candidate) => candidate.source === 'visual-toc')!;
  const withoutPdfLabels = readMaterialBookIndex(root, material.id, material.revision)!;
  writeMaterialBookIndex(root, {
    ...withoutPdfLabels,
    pages: withoutPdfLabels.pages.map((page) => ({ ...page, pdfLabel: null })),
  });
  const checked: number[] = [];
  const located = await locateMaterialOutlineNode(
    root,
    material.id,
    material.revision,
    node.id,
    async (page) => {
      checked.push(page);
      return (await readMaterialPage(root, material.id, material.revision, page, {
        mode: 'auto', updatedAt: '2026-08-13T00:02:30.000Z',
      })).text;
    },
    '2026-08-13T00:03:00.000Z',
  );
  expect(located.node).toMatchObject({ startPage: 3, endPage: 3 });
  expect(located.index.printedPageOffsetHint).toBe(2);
  expect(located.candidatePages[0]).toBe(3);
  expect(checked).toEqual([3]);
  expect(readMaterialBookIndex(root, material.id, material.revision)?.pages[2]).toMatchObject({
    state: 'native-text', method: 'native',
  });
});

test('merges an outline scan with a page completed while the visual model is running', async () => {
  const { root, material } = await book();
  const started = Promise.withResolvers<void>();
  const finish = Promise.withResolvers<void>();
  const scanning = scanMaterialVisualOutline(
    root, material.id, material.revision, { startPage: 1, endPage: 2 },
    {
      read: async () => {
        started.resolve();
        await finish.promise;
        return {
          text: '', model: 'test/vision',
          outline: [{ title: '视觉目录章', level: 1, printedPage: '2' }],
        };
      },
    },
    '2026-08-13T00:02:00.000Z',
  );
  await started.promise;
  await readMaterialPage(root, material.id, material.revision, 3, {
    mode: 'auto', updatedAt: '2026-08-13T00:02:30.000Z',
  });
  finish.resolve();
  const scanned = await scanning;

  expect(scanned.outline).toContainEqual(expect.objectContaining({ title: '视觉目录章' }));
  expect(scanned.pages[2]).toMatchObject({ state: 'native-text', method: 'native' });
});
