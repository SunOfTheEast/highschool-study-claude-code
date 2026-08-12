import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import { createMaterialBookIndex, writeMaterialBookIndex } from '../../src/study/material-book-index';
import { importMaterial } from '../../src/study/materials';
import { writeThreePageBook } from './pdf-fixture';

const roots: string[] = [];

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'studyforge-book-api-'));
  mkdirSync(value, { recursive: true });
  roots.push(value);
  return value;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function fakeRegistry() {
  return {
    readHistory: async () => [], send: async () => {}, subscribe: async () => () => {},
    open: async () => ({}), abort: async () => {}, release: async () => {},
    createFreeLearning: async () => { throw new Error('not used'); },
    listFreeLearning: async () => [], endFreeLearning: async () => { throw new Error('not used'); },
    createMeta: async () => { throw new Error('not used'); }, listMeta: async () => [],
    listOwnedSessionFacts: async () => [],
  };
}

async function body(response: Response | undefined): Promise<Record<string, any>> {
  return response?.json() as Promise<Record<string, any>>;
}

test('explicitly bootstraps a book and renders one immutable source page', async () => {
  const learningSet = root();
  const source = join(learningSet, 'book.pdf');
  writeThreePageBook(source);
  const imported = await importMaterial(learningSet, {
    requestId: 'book-api-001', title: '三页教材', filename: 'book.pdf',
    mediaType: 'application/pdf', source: { kind: 'path', absolutePath: source },
  }, '2026-08-12T20:00:00.000Z');
  const handler = createRequestHandler({
    root: learningSet, hub: new EventHub(), registry: fakeRegistry() as never,
  });
  const endpoint = `http://local/api/materials/${imported.id}/revisions/${imported.revision}`;

  expect((await handler(new Request(`${endpoint}/book-index`)))?.status).toBe(404);
  const created = await handler(new Request(`${endpoint}/book-index`, { method: 'POST' }));
  expect(created?.status).toBe(201);
  const createdBody = await body(created);
  expect(createdBody.pageCount).toBe(3);
  expect(createdBody.pages[0]).toMatchObject({ physicalPage: 1 });
  expect(await body(await handler(new Request(`${endpoint}/book-index`))))
    .toMatchObject({ pageCount: 3 });

  const rendered = await handler(new Request(`${endpoint}/page/2.png`));
  expect(rendered?.status).toBe(200);
  expect(rendered?.headers.get('content-type')).toBe('image/png');
  const bytes = Buffer.from(await rendered!.arrayBuffer());
  const image = await loadImage(bytes);
  expect(image.width).toBeGreaterThan(300);
  expect(image.height).toBeGreaterThan(200);
  expect(bytes.byteLength).toBeGreaterThan(1_000);
  const canvas = createCanvas(image.width, image.height);
  const context = canvas.getContext('2d');
  context.drawImage(image, 0, 0);
  const pixels = context.getImageData(0, 0, image.width, image.height).data;
  expect(Array.from(pixels).some((channel, index) => index % 4 !== 3 && channel < 245)).toBeTrue();
});

test('returns bounded public errors for wrong material type and page range', async () => {
  const learningSet = root();
  const text = await importMaterial(learningSet, {
    requestId: 'book-api-text', title: '文本', filename: 'note.txt', mediaType: 'text/plain',
    source: { kind: 'bytes', bytes: new TextEncoder().encode('hello') },
  }, '2026-08-12T20:00:00.000Z');
  const source = join(learningSet, 'book.pdf');
  writeThreePageBook(source);
  const book = await importMaterial(learningSet, {
    requestId: 'book-api-pdf', title: '三页教材', filename: 'book.pdf',
    mediaType: 'application/pdf', source: { kind: 'path', absolutePath: source },
  }, '2026-08-12T20:00:00.000Z');
  const handler = createRequestHandler({
    root: learningSet, hub: new EventHub(), registry: fakeRegistry() as never,
  });

  const wrongType = await handler(new Request(
    `http://local/api/materials/${text.id}/revisions/${text.revision}/book-index`,
    { method: 'POST' },
  ));
  expect(wrongType?.status).toBe(400);
  expect(await body(wrongType)).toEqual({ error: 'MATERIAL_BOOK_PDF_REQUIRED' });
  await handler(new Request(
    `http://local/api/materials/${book.id}/revisions/${book.revision}/book-index`,
    { method: 'POST' },
  ));
  const outside = await handler(new Request(
    `http://local/api/materials/${book.id}/revisions/${book.revision}/page/4.png`,
  ));
  expect(outside?.status).toBe(400);
  expect(await body(outside)).toEqual({ error: 'MATERIAL_BOOK_PAGE_INVALID' });
});

test('rejects a corrupt PDF without exposing parser details', async () => {
  const learningSet = root();
  const corrupt = await importMaterial(learningSet, {
    requestId: 'book-api-corrupt', title: '损坏资料', filename: 'broken.pdf',
    mediaType: 'application/pdf', source: {
      kind: 'bytes', bytes: new TextEncoder().encode('not a pdf'),
    },
  }, '2026-08-12T20:00:00.000Z');
  const handler = createRequestHandler({
    root: learningSet, hub: new EventHub(), registry: fakeRegistry() as never,
  });
  const response = await handler(new Request(
    `http://local/api/materials/${corrupt.id}/revisions/${corrupt.revision}/book-index`,
    { method: 'POST' },
  ));
  expect(response?.status).toBe(400);
  expect(await body(response)).toEqual({ error: 'MATERIAL_BOOK_PDF_INVALID' });
});

test('processes only an explicitly requested page and keeps the result addressable', async () => {
  const learningSet = root();
  const source = join(learningSet, 'scanned.pdf');
  writeThreePageBook(source, { emptyPages: [2] });
  const imported = await importMaterial(learningSet, {
    requestId: 'book-api-read', title: '扫描教材', filename: 'scanned.pdf',
    mediaType: 'application/pdf', source: { kind: 'path', absolutePath: source },
  }, '2026-08-13T00:00:00.000Z');
  const seen: number[] = [];
  const handler = createRequestHandler({
    root: learningSet,
    hub: new EventHub(),
    registry: fakeRegistry() as never,
    materialVision: {
      read: async ({ prompt }) => {
        const page = Number(/第 (\d+) 页/.exec(prompt)?.[1]);
        seen.push(page);
        return { text: '视觉识别出的第二页', model: 'test/vision' };
      },
    },
  });
  const endpoint = `http://local/api/materials/${imported.id}/revisions/${imported.revision}`;
  await handler(new Request(`${endpoint}/book-index`, { method: 'POST' }));

  const read = await handler(new Request(`${endpoint}/pages/2/read`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ mode: 'auto' }),
  }));
  expect(read?.status).toBe(200);
  expect(await body(read)).toMatchObject({
    physicalPage: 2, state: 'visual-text', text: '视觉识别出的第二页', cached: false,
  });
  expect(seen).toEqual([2]);
  expect(await body(await handler(new Request(
    `${endpoint}/locators/page-0002`,
  )))).toMatchObject({ text: '视觉识别出的第二页' });
});

test('rejects an oversized material range before creating a learning session', async () => {
  const learningSet = root();
  const imported = await importMaterial(learningSet, {
    requestId: 'book-api-range', title: '十二页教材', filename: 'book.pdf',
    mediaType: 'application/pdf', source: {
      kind: 'bytes', bytes: new TextEncoder().encode('%PDF range boundary'),
    },
  }, '2026-08-13T00:00:00.000Z');
  writeMaterialBookIndex(learningSet, createMaterialBookIndex({
    materialId: imported.id, revision: imported.revision, pageCount: 12,
    pageLabels: null, outline: [], updatedAt: '2026-08-13T00:01:00.000Z',
  }));
  let created = false;
  const handler = createRequestHandler({
    root: learningSet,
    hub: new EventHub(),
    registry: {
      ...fakeRegistry(),
      createFreeLearning: async () => {
        created = true;
        throw new Error('must not create');
      },
    } as never,
  });

  const response = await handler(new Request('http://local/api/free-learning', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      selectedAssets: [{
        kind: 'material', id: imported.id, revision: imported.revision,
        locator: 'pages-0001-0009',
      }],
    }),
  }));
  expect(response?.status).toBe(400);
  expect(await body(response)).toEqual({ error: 'SELECTED_MATERIAL_RANGE_LIMIT_EXCEEDED' });
  expect(created).toBeFalse();
});
