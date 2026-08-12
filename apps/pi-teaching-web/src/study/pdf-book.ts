import { existsSync } from 'node:fs';
import { createCanvas } from '@napi-rs/canvas';
import type {
  MaterialBookIndex,
  MaterialBookOutlineNode,
  MaterialRevision,
} from '../shared/contracts';
import { resolveDocumentPath } from '../runtime/atomic-document';
import {
  createMaterialBookIndex,
  readMaterialBookIndex,
  writeMaterialBookIndex,
} from './material-book-index';
import { listMaterials } from './materials';
import { openPdfPath } from './pdf-runtime';

type PdfOutlineItem = {
  title: string;
  dest: string | unknown[] | null;
  items: PdfOutlineItem[];
};

function pdfRevision(root: string, materialId: string, revision: number): MaterialRevision {
  const material = listMaterials(root).find((candidate) => candidate.id === materialId);
  const selected = material?.revisions.find((candidate) => candidate.revision === revision);
  if (!selected) throw new Error('MATERIAL_REVISION_NOT_FOUND');
  if (selected.mediaType !== 'application/pdf') throw new Error('MATERIAL_BOOK_PDF_REQUIRED');
  const original = resolveDocumentPath(root, selected.originalPath);
  if (!existsSync(original)) throw new Error('MATERIAL_REVISION_NOT_FOUND');
  return selected;
}

async function destinationPage(document: Awaited<ReturnType<typeof openPdfPath>>, item: PdfOutlineItem) {
  const destination = typeof item.dest === 'string'
    ? await document.getDestination(item.dest)
    : item.dest;
  if (!destination || !Array.isArray(destination) || destination.length === 0) return null;
  const reference = destination[0];
  if (typeof reference === 'number') return reference + 1;
  if (!reference || typeof reference !== 'object') return null;
  try {
    return (await document.getPageIndex(reference as never)) + 1;
  } catch {
    return null;
  }
}

async function bookmarkOutline(
  document: Awaited<ReturnType<typeof openPdfPath>>,
  pageLabels: string[] | null,
): Promise<MaterialBookOutlineNode[]> {
  const source = await document.getOutline() as PdfOutlineItem[] | null;
  const flat: Array<{ item: PdfOutlineItem; level: number }> = [];
  const visit = (items: PdfOutlineItem[], level: number) => {
    for (const item of items) {
      flat.push({ item, level });
      visit(item.items ?? [], level + 1);
    }
  };
  visit(source ?? [], 1);
  const starts = await Promise.all(flat.map(({ item }) => destinationPage(document, item)));
  return flat.map(({ item, level }, index) => {
    const startPage = starts[index] ?? null;
    let endPage: number | null = null;
    if (startPage !== null) {
      const nextBoundary = flat.findIndex((candidate, candidateIndex) => (
        candidateIndex > index
        && candidate.level <= level
        && starts[candidateIndex] !== null
      ));
      endPage = nextBoundary < 0
        ? document.numPages
        : Math.max(startPage, starts[nextBoundary]! - 1);
    }
    return {
      id: `bookmark-${String(index + 1).padStart(4, '0')}`,
      title: item.title.trim(),
      level,
      source: 'pdf-bookmark' as const,
      printedPage: startPage === null ? null : pageLabels?.[startPage - 1] ?? null,
      startPage,
      endPage,
      provenancePages: [],
    };
  }).filter((node) => node.title.length > 0);
}

export async function bootstrapPdfBookIndex(
  root: string,
  materialId: string,
  revision: number,
  updatedAt: string,
): Promise<MaterialBookIndex> {
  const selected = pdfRevision(root, materialId, revision);
  const original = resolveDocumentPath(root, selected.originalPath);
  let document: Awaited<ReturnType<typeof openPdfPath>> | null = null;
  try {
    document = await openPdfPath(original);
    const pageLabels = await document.getPageLabels();
    const outline = await bookmarkOutline(document, pageLabels);
    const fresh = createMaterialBookIndex({
      materialId,
      revision,
      pageCount: document.numPages,
      pageLabels,
      outline,
      updatedAt,
    });
    const current = readMaterialBookIndex(root, materialId, revision);
    const next = current?.pageCount === fresh.pageCount
      ? {
          ...fresh,
          pages: fresh.pages.map((page, index) => ({
            ...current.pages[index]!,
            physicalPage: page.physicalPage,
            pdfLabel: page.pdfLabel,
          })),
          printedPageOffsetHint: current.printedPageOffsetHint,
          outline: [
            ...fresh.outline,
            ...current.outline.filter((node) => node.source !== 'pdf-bookmark'),
          ],
        }
      : fresh;
    writeMaterialBookIndex(root, next);
    return next;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('MATERIAL_')) throw error;
    throw new Error('MATERIAL_BOOK_PDF_INVALID', { cause: error });
  } finally {
    await document?.destroy();
  }
}

export type RenderedPdfPage = {
  bytes: Buffer;
  width: number;
  height: number;
};

export async function extractPdfBookPageText(
  root: string,
  materialId: string,
  revision: number,
  physicalPage: number,
): Promise<string> {
  const index = readMaterialBookIndex(root, materialId, revision);
  if (!index) throw new Error('MATERIAL_BOOK_INDEX_NOT_FOUND');
  if (!Number.isSafeInteger(physicalPage) || physicalPage < 1 || physicalPage > index.pageCount) {
    throw new Error('MATERIAL_BOOK_PAGE_INVALID');
  }
  const selected = pdfRevision(root, materialId, revision);
  let document: Awaited<ReturnType<typeof openPdfPath>> | null = null;
  try {
    document = await openPdfPath(resolveDocumentPath(root, selected.originalPath));
    const page = await document.getPage(physicalPage);
    const content = await page.getTextContent();
    return content.items.flatMap((item) => (
      'str' in item && typeof item.str === 'string'
        ? [`${item.str}${'hasEOL' in item && item.hasEOL ? '\n' : ' '}`]
        : []
    )).join('').replace(/[ \t]+\n/g, '\n').trim();
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('MATERIAL_')) throw error;
    throw new Error('MATERIAL_BOOK_PAGE_READ_FAILED', { cause: error });
  } finally {
    await document?.destroy();
  }
}

export async function renderPdfBookPage(
  root: string,
  materialId: string,
  revision: number,
  physicalPage: number,
  limits: { maxDimension?: number; maxPixels?: number; maxScale?: number } = {},
): Promise<RenderedPdfPage> {
  const index = readMaterialBookIndex(root, materialId, revision);
  if (!index) throw new Error('MATERIAL_BOOK_INDEX_NOT_FOUND');
  if (!Number.isSafeInteger(physicalPage) || physicalPage < 1 || physicalPage > index.pageCount) {
    throw new Error('MATERIAL_BOOK_PAGE_INVALID');
  }
  const selected = pdfRevision(root, materialId, revision);
  const original = resolveDocumentPath(root, selected.originalPath);
  let document: Awaited<ReturnType<typeof openPdfPath>> | null = null;
  try {
    document = await openPdfPath(original);
    const page = await document.getPage(physicalPage);
    const natural = page.getViewport({ scale: 1 });
    const scale = Math.min(
      limits.maxScale ?? 2,
      (limits.maxDimension ?? 2_400) / natural.width,
      (limits.maxDimension ?? 2_400) / natural.height,
      Math.sqrt((limits.maxPixels ?? 4_000_000) / (natural.width * natural.height)),
    );
    const viewport = page.getViewport({ scale });
    const width = Math.max(1, Math.ceil(viewport.width));
    const height = Math.max(1, Math.ceil(viewport.height));
    const canvas = createCanvas(width, height);
    await page.render({
      canvas: canvas as never,
      viewport,
      background: '#ffffff',
    }).promise;
    page.cleanup();
    return { bytes: canvas.toBuffer('image/png'), width, height };
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('MATERIAL_')) throw error;
    throw new Error('MATERIAL_BOOK_RENDER_FAILED', { cause: error });
  } finally {
    await document?.destroy();
  }
}
