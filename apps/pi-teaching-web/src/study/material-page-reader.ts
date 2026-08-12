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
    printedPageOffset?: number;
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

function persistPage(
  root: string,
  materialId: string,
  revision: number,
  physicalPage: number,
  update: Omit<MaterialBookIndex['pages'][number], 'physicalPage' | 'pdfLabel'>,
  text: string | null,
): MaterialBookIndex['pages'][number] {
  const latest = currentIndex(root, materialId, revision);
  const previous = pageAt(latest, physicalPage);
  const page = { ...previous, ...update };
  const next = {
    ...latest,
    state: page.state === 'failed' ? 'partial' as const : latest.state,
    pages: latest.pages.with(physicalPage - 1, page),
    updatedAt: update.updatedAt ?? latest.updatedAt,
  };
  writeMaterialBookPageProjection(
    root,
    next,
    text === null ? null : { physicalPage, text },
  );
  return page;
}

function publicFailure(error: unknown): string {
  const code = error instanceof Error ? error.message : '';
  return code === 'MATERIAL_VISION_UNAVAILABLE'
    ? code
    : 'MATERIAL_PAGE_READ_FAILED';
}

export function nativePageTextIsSane(value: string): boolean {
  const text = value.trim();
  const meaningful = text.match(/[\p{L}\p{N}]/gu)?.length ?? 0;
  if (meaningful < 12) return false;
  const corrupt = text.match(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFD]/gu)?.length ?? 0;
  if (corrupt / Math.max(1, [...text].length) > 0.1) return false;
  if (/^[\p{Script=Latin}\p{N}\s\p{P}\p{S}]+$/u.test(text)) {
    const words = text.match(/\p{Script=Latin}+/gu)?.length ?? 0;
    if (words < 3 || meaningful < 15) return false;
  }
  return true;
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
      if (nativePageTextIsSane(nativeText)) {
        const textPath = materialBookPageTextPath(materialId, revision, physicalPage);
        const page = persistPage(root, materialId, revision, physicalPage, {
          state: 'native-text' as const,
          textPath,
          method: 'native' as const,
          model: null,
          updatedAt: options.updatedAt,
          error: null,
        }, nativeText);
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
    const page = persistPage(root, materialId, revision, physicalPage, {
      state: 'visual-text' as const,
      textPath,
      method: 'vision' as const,
      model: result.model,
      updatedAt: options.updatedAt,
      error: null,
    }, result.text);
    return { ...page, text: result.text, cached: false };
  } catch (error) {
    const code = publicFailure(error);
    const latest = currentIndex(root, materialId, revision);
    const latestPage = pageAt(latest, physicalPage);
    if (latestPage.state === 'pending' || latestPage.state === 'failed') {
      persistPage(root, materialId, revision, physicalPage, {
        state: 'failed' as const,
        textPath: null,
        method: null,
        model: null,
        updatedAt: options.updatedAt,
        error: code,
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
    prompt: [
      `这些图片依次是物理页 ${range.startPage}–${range.endPage}。只提取目录层级和印刷页码。`,
      'outline 只保留相当于“编/章/节”的导航骨架，最多三级；跳过考点、例题、编号小项和节内条目。',
      '扫描书常因封面与前言产生稳定页码偏移。只有这些图片同时包含目录末页和带可见印刷页码的首张正文时，',
      '才按“物理页 = 印刷页 + printedPageOffset”计算候选；这不是已核验位置，不确定就省略。',
    ].join(''),
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
  const latest = currentIndex(root, materialId, revision);
  const next = {
    ...latest,
    printedPageOffsetHint: result.printedPageOffset ?? null,
    outline: [...latest.outline.filter((node) => node.source !== 'visual-toc'), ...visual],
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
      const center = guessed + (node.source === 'visual-toc'
        ? index.printedPageOffsetHint ?? 0
        : 0);
      return [0, -1, 1, -2, 2]
        .map((offset) => center + offset)
        .filter((page) => page >= 1 && page <= index.pageCount);
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
  const initial = currentIndex(root, materialId, revision);
  const position = initial.outline.findIndex((candidate) => candidate.id === nodeId);
  if (position < 0) throw new Error('MATERIAL_OUTLINE_NODE_NOT_FOUND');
  const current = initial.outline[position]!;
  const candidates = candidatePages(initial, current).slice(0, 5);
  let matched: number | null = null;
  const title = comparable(current.title);
  for (const page of candidates) {
    if (comparable(await readPage(page)).includes(title)) {
      matched = page;
      break;
    }
  }
  if (matched === null) return { index: initial, node: current, candidatePages: candidates };
  const latest = currentIndex(root, materialId, revision);
  const latestPosition = latest.outline.findIndex((candidate) => candidate.id === nodeId);
  if (latestPosition < 0) throw new Error('MATERIAL_OUTLINE_NODE_NOT_FOUND');
  const resolved = { ...latest.outline[latestPosition]!, startPage: matched, endPage: matched };
  const outline = withResolvedVisualRanges(
    latest.outline.with(latestPosition, resolved),
    latest.pageCount,
  );
  const next = { ...latest, outline, updatedAt };
  writeMaterialBookIndex(root, next);
  return { index: next, node: next.outline[latestPosition]!, candidatePages: candidates };
}
