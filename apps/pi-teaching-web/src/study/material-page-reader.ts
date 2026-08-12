import { readFileSync } from 'node:fs';
import type { ImageContent } from '@earendil-works/pi-ai';
import type {
  MaterialBookIndex,
  MaterialBookOutlineNode,
  MaterialPageReadReceipt,
} from '../shared/contracts';
import { resolveDocumentPath } from '../runtime/atomic-document';
import {
  materialBookPageTextPath,
  readMaterialBookIndex,
  writeMaterialBookIndex,
  writeMaterialBookPageProjection,
} from './material-book-index';
import {
  extractPdfBookPageText,
  renderPdfBookPage,
} from './pdf-book';

export type MaterialVisionReader = {
  read(input: { prompt: string; images: ImageContent[] }): Promise<{
    text: string;
    outline?: Array<{ title: string; level: number; printedPage: string | null }>;
    model: string;
  }>;
};

function currentIndex(root: string, materialId: string, revision: number): MaterialBookIndex {
  const index = readMaterialBookIndex(root, materialId, revision);
  if (!index) throw new Error('MATERIAL_BOOK_INDEX_NOT_FOUND');
  return index;
}

function pageAt(index: MaterialBookIndex, physicalPage: number) {
  if (!Number.isSafeInteger(physicalPage) || physicalPage < 1 || physicalPage > index.pageCount) {
    throw new Error('MATERIAL_BOOK_PAGE_INVALID');
  }
  return index.pages[physicalPage - 1]!;
}

function receipt(
  root: string,
  page: MaterialBookIndex['pages'][number],
  cached: boolean,
): MaterialPageReadReceipt {
  return {
    ...page,
    text: page.textPath ? readFileSync(resolveDocumentPath(root, page.textPath), 'utf8') : '',
    cached,
  };
}

function publicFailure(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return code === 'MATERIAL_VISION_UNAVAILABLE'
    ? code
    : 'MATERIAL_PAGE_READ_FAILED';
}

export async function readMaterialPage(
  root: string,
  materialId: string,
  revision: number,
  physicalPage: number,
  options: {
    mode: 'auto' | 'visual';
    vision?: MaterialVisionReader;
    updatedAt: string;
  },
): Promise<MaterialPageReadReceipt> {
  const index = currentIndex(root, materialId, revision);
  const current = pageAt(index, physicalPage);
  if (options.mode === 'auto' && (current.state === 'native-text' || current.state === 'visual-text')) {
    return receipt(root, current, true);
  }
  try {
    if (options.mode === 'auto') {
      const nativeText = await extractPdfBookPageText(root, materialId, revision, physicalPage);
      if (nativeText.trim()) {
        const textPath = materialBookPageTextPath(materialId, revision, physicalPage);
        const page = {
          ...current,
          state: 'native-text' as const,
          textPath,
          method: 'native' as const,
          model: null,
          updatedAt: options.updatedAt,
          error: null,
        };
        const next = { ...index, pages: index.pages.with(physicalPage - 1, page), updatedAt: options.updatedAt };
        writeMaterialBookPageProjection(root, next, { physicalPage, text: nativeText });
        return { ...page, text: nativeText, cached: false };
      }
    }
    if (!options.vision) throw new Error('MATERIAL_VISION_UNAVAILABLE');
    const rendered = await renderPdfBookPage(root, materialId, revision, physicalPage);
    const result = await options.vision.read({
      prompt: `忠实读取这本资料的物理第 ${physicalPage} 页。保留公式、表格与标题层次。`,
      images: [{ type: 'image', data: rendered.bytes.toString('base64'), mimeType: 'image/png' }],
    });
    const textPath = materialBookPageTextPath(materialId, revision, physicalPage);
    const page = {
      ...current,
      state: 'visual-text' as const,
      textPath,
      method: 'vision' as const,
      model: result.model,
      updatedAt: options.updatedAt,
      error: null,
    };
    const next = { ...index, pages: index.pages.with(physicalPage - 1, page), updatedAt: options.updatedAt };
    writeMaterialBookPageProjection(root, next, { physicalPage, text: result.text });
    return { ...page, text: result.text, cached: false };
  } catch (error) {
    const code = publicFailure(error);
    if (current.state === 'pending' || current.state === 'failed') {
      const failed = {
        ...current,
        state: 'failed' as const,
        textPath: null,
        method: null,
        model: null,
        updatedAt: options.updatedAt,
        error: code,
      };
      writeMaterialBookPageProjection(root, {
        ...index,
        state: 'partial',
        pages: index.pages.with(physicalPage - 1, failed),
        updatedAt: options.updatedAt,
      }, null);
    }
    throw new Error(code, { cause: error });
  }
}

function outlineRange(input: { startPage: number; endPage: number }, pageCount: number): number[] {
  if (
    !Number.isSafeInteger(input.startPage)
    || !Number.isSafeInteger(input.endPage)
    || input.startPage < 1
    || input.startPage > input.endPage
    || input.endPage > pageCount
    || input.endPage - input.startPage + 1 > 12
  ) throw new Error('MATERIAL_OUTLINE_RANGE_INVALID');
  return Array.from(
    { length: input.endPage - input.startPage + 1 },
    (_, index) => input.startPage + index,
  );
}

export async function scanMaterialVisualOutline(
  root: string,
  materialId: string,
  revision: number,
  range: { startPage: number; endPage: number },
  vision: MaterialVisionReader,
  updatedAt: string,
): Promise<MaterialBookIndex> {
  const index = currentIndex(root, materialId, revision);
  const pages = outlineRange(range, index.pageCount);
  const images: ImageContent[] = [];
  for (const page of pages) {
    const rendered = await renderPdfBookPage(root, materialId, revision, page, {
      maxDimension: 1_400,
      maxPixels: 1_500_000,
    });
    images.push({ type: 'image', data: rendered.bytes.toString('base64'), mimeType: 'image/png' });
  }
  const result = await vision.read({
    prompt: `这些图片依次是物理页 ${range.startPage}–${range.endPage}。只提取目录层级和印刷页码。`,
    images,
  });
  const visual = (result.outline ?? []).map((node, offset): MaterialBookOutlineNode => ({
    id: `visual-${String(range.startPage).padStart(4, '0')}-${String(range.endPage).padStart(4, '0')}-${String(offset + 1).padStart(3, '0')}`,
    title: node.title,
    level: node.level,
    source: 'visual-toc',
    printedPage: node.printedPage,
    startPage: null,
    endPage: null,
    provenancePages: pages,
  }));
  const rangePrefix = `visual-${String(range.startPage).padStart(4, '0')}-${
    String(range.endPage).padStart(4, '0')
  }-`;
  const next = {
    ...index,
    outline: [...index.outline.filter((node) => !node.id.startsWith(rangePrefix)), ...visual],
    updatedAt,
  };
  writeMaterialBookIndex(root, next);
  return next;
}

function comparable(value: string): string {
  return value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu, '');
}

function candidatePages(index: MaterialBookIndex, node: MaterialBookOutlineNode): number[] {
  if (node.printedPage) {
    const exact = index.pages.find((page) => page.pdfLabel === node.printedPage)?.physicalPage;
    if (exact) return [exact];
    const guessed = Number(node.printedPage);
    if (Number.isSafeInteger(guessed) && guessed > 0) {
      const start = Math.max(1, guessed - 2);
      const end = Math.min(index.pageCount, guessed + 2);
      return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
    }
  }
  return [];
}

function withResolvedVisualRanges(
  outline: MaterialBookOutlineNode[],
  pageCount: number,
): MaterialBookOutlineNode[] {
  return outline.map((node, index) => {
    if (node.source !== 'visual-toc' || node.startPage === null) return node;
    const next = outline.slice(index + 1).find((candidate) => (
      candidate.source === 'visual-toc'
      && candidate.level <= node.level
      && candidate.startPage !== null
    ));
    return {
      ...node,
      endPage: next?.startPage
        ? Math.max(node.startPage, next.startPage - 1)
        : pageCount,
    };
  });
}

export async function locateMaterialOutlineNode(
  root: string,
  materialId: string,
  revision: number,
  nodeId: string,
  readPage: (physicalPage: number) => Promise<string>,
  updatedAt: string,
): Promise<{ index: MaterialBookIndex; node: MaterialBookOutlineNode; candidatePages: number[] }> {
  const index = currentIndex(root, materialId, revision);
  const position = index.outline.findIndex((candidate) => candidate.id === nodeId);
  if (position < 0) throw new Error('MATERIAL_OUTLINE_NODE_NOT_FOUND');
  const current = index.outline[position]!;
  const candidates = candidatePages(index, current).slice(0, 5);
  let matched: number | null = null;
  const title = comparable(current.title);
  for (const page of candidates) {
    if (comparable(await readPage(page)).includes(title)) {
      matched = page;
      break;
    }
  }
  if (matched === null) return { index, node: current, candidatePages: candidates };
  const resolved = { ...current, startPage: matched, endPage: matched };
  const outline = withResolvedVisualRanges(
    index.outline.with(position, resolved),
    index.pageCount,
  );
  const next = { ...index, outline, updatedAt };
  writeMaterialBookIndex(root, next);
  return { index: next, node: next.outline[position]!, candidatePages: candidates };
}
