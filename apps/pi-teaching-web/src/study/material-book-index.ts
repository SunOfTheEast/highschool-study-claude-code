import { existsSync, readFileSync } from 'node:fs';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  MaterialBookIndex,
  MaterialBookOutlineNode,
  MaterialBookPage,
} from '../shared/contracts';
import { resolveDocumentPath } from '../runtime/atomic-document';
import {
  commitDocumentCandidates,
  type DocumentCandidate,
} from '../runtime/multi-document-transaction';
import { StudyDocumentError } from './markdown';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
type RecordValue = Record<string, unknown>;

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function checkedId(value: unknown): string {
  if (typeof value !== 'string' || !idPattern.test(value)) {
    throw new Error('MATERIAL_BOOK_INDEX_IDENTITY_INVALID');
  }
  return value;
}

function positive(value: unknown, code = 'MATERIAL_BOOK_INDEX_INVALID'): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) throw new Error(code);
  return Number(value);
}

function nullableText(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== 'string' || /[\r\n]/.test(value)) {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  return value;
}

function timestamp(value: unknown): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  return value;
}

function pageFromValue(value: unknown, pageCount: number): MaterialBookPage {
  const item = record(value);
  if (!item) throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  const physicalPage = positive(item.physical_page);
  if (physicalPage > pageCount) throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  if (!['pending', 'native-text', 'visual-text', 'failed'].includes(String(item.state))) {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  if (item.method !== null && item.method !== 'native' && item.method !== 'vision') {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  return {
    physicalPage,
    pdfLabel: nullableText(item.pdf_label),
    state: item.state as MaterialBookPage['state'],
    textPath: nullableText(item.text_path),
    method: item.method as MaterialBookPage['method'],
    model: nullableText(item.model),
    updatedAt: item.updated_at === null ? null : timestamp(item.updated_at),
    error: nullableText(item.error),
  };
}

function outlineFromValue(value: unknown, pageCount: number): MaterialBookOutlineNode {
  const item = record(value);
  if (!item || typeof item.title !== 'string' || item.title.trim().length === 0) {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  if (!['pdf-bookmark', 'visual-toc', 'curated'].includes(String(item.source))) {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  const nullablePage = (page: unknown) => {
    if (page === null) return null;
    const result = positive(page);
    if (result > pageCount) throw new Error('MATERIAL_BOOK_INDEX_INVALID');
    return result;
  };
  const startPage = nullablePage(item.start_page);
  const endPage = nullablePage(item.end_page);
  if ((startPage === null) !== (endPage === null) || (startPage !== null && startPage > endPage!)) {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  if (!Array.isArray(item.provenance_pages)) throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  return {
    id: checkedId(item.id),
    title: item.title.trim(),
    level: positive(item.level),
    source: item.source as MaterialBookOutlineNode['source'],
    printedPage: nullableText(item.printed_page),
    startPage,
    endPage,
    provenancePages: item.provenance_pages.map((page) => {
      const result = positive(page);
      if (result > pageCount) throw new Error('MATERIAL_BOOK_INDEX_INVALID');
      return result;
    }),
  };
}

export function materialBookIndexPath(materialId: string, revision: number): string {
  return `materials/${checkedId(materialId)}/projections/${positive(revision)}/book-index.yaml`;
}

export function materialBookPageTextPath(
  materialId: string,
  revision: number,
  physicalPage: number,
): string {
  return `materials/${checkedId(materialId)}/projections/${positive(revision)}/pages/page-${
    String(positive(physicalPage)).padStart(4, '0')
  }.txt`;
}

function indexFromValue(path: string, value: unknown): MaterialBookIndex {
  const root = record(value);
  if (!root || root.schema !== 'studyforge.material-book-index.v1') {
    throw new StudyDocumentError(path, 'expected studyforge.material-book-index.v1');
  }
  const materialId = checkedId(root.material_id);
  const revision = positive(root.revision);
  if (path !== materialBookIndexPath(materialId, revision)) {
    throw new Error('MATERIAL_BOOK_INDEX_IDENTITY_INVALID');
  }
  const pageCount = positive(root.page_count);
  if (root.state !== 'ready' && root.state !== 'partial') {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  if (!Array.isArray(root.pages) || root.pages.length !== pageCount || !Array.isArray(root.outline)) {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  const pages = root.pages.map((page) => pageFromValue(page, pageCount));
  if (pages.some((page, index) => page.physicalPage !== index + 1)) {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  return {
    schema: 'studyforge.material-book-index.v1',
    materialId,
    revision,
    pageCount,
    state: root.state,
    pages,
    outline: root.outline.map((node) => outlineFromValue(node, pageCount)),
    updatedAt: timestamp(root.updated_at),
  };
}

function indexValue(index: MaterialBookIndex): RecordValue {
  return {
    schema: index.schema,
    material_id: index.materialId,
    revision: index.revision,
    page_count: index.pageCount,
    state: index.state,
    pages: index.pages.map((page) => ({
      physical_page: page.physicalPage,
      pdf_label: page.pdfLabel,
      state: page.state,
      text_path: page.textPath,
      method: page.method,
      model: page.model,
      updated_at: page.updatedAt,
      error: page.error,
    })),
    outline: index.outline.map((node) => ({
      id: node.id,
      title: node.title,
      level: node.level,
      source: node.source,
      printed_page: node.printedPage,
      start_page: node.startPage,
      end_page: node.endPage,
      provenance_pages: node.provenancePages,
    })),
    updated_at: index.updatedAt,
  };
}

export function createMaterialBookIndex(input: {
  materialId: string;
  revision: number;
  pageCount: number;
  pageLabels: string[] | null;
  outline: MaterialBookOutlineNode[];
  updatedAt: string;
}): MaterialBookIndex {
  const materialId = checkedId(input.materialId);
  const revision = positive(input.revision);
  const pageCount = positive(input.pageCount);
  timestamp(input.updatedAt);
  if (input.pageLabels !== null && input.pageLabels.length !== pageCount) {
    throw new Error('MATERIAL_BOOK_INDEX_INVALID');
  }
  const draft: MaterialBookIndex = {
    schema: 'studyforge.material-book-index.v1',
    materialId,
    revision,
    pageCount,
    state: 'ready',
    pages: Array.from({ length: pageCount }, (_, index) => ({
      physicalPage: index + 1,
      pdfLabel: input.pageLabels?.[index] ?? null,
      state: 'pending',
      textPath: null,
      method: null,
      model: null,
      updatedAt: null,
      error: null,
    })),
    outline: input.outline,
    updatedAt: input.updatedAt,
  };
  return indexFromValue(materialBookIndexPath(materialId, revision), indexValue(draft));
}

export function readMaterialBookIndex(
  root: string,
  materialId: string,
  revision: number,
): MaterialBookIndex | null {
  const path = materialBookIndexPath(materialId, revision);
  const absolute = resolveDocumentPath(root, path);
  if (!existsSync(absolute)) return null;
  const parsed = indexFromValue(path, parseYaml(readFileSync(absolute, 'utf8')));
  if (parsed.materialId !== materialId || parsed.revision !== revision) {
    throw new Error('MATERIAL_BOOK_INDEX_IDENTITY_INVALID');
  }
  return parsed;
}

function indexCandidate(root: string, index: MaterialBookIndex): DocumentCandidate {
  const path = materialBookIndexPath(index.materialId, index.revision);
  const normalized = indexFromValue(path, indexValue(index));
  const absolute = resolveDocumentPath(root, path);
  const before = existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
  const after = stringifyYaml(indexValue(normalized), { lineWidth: 0 });
  return {
    path,
    before,
    after,
    validate: (source) => {
      const parsed = indexFromValue(path, parseYaml(source));
      if (parsed.materialId !== normalized.materialId || parsed.revision !== normalized.revision) {
        throw new Error('MATERIAL_BOOK_INDEX_IDENTITY_INVALID');
      }
    },
  };
}

export function writeMaterialBookIndex(root: string, index: MaterialBookIndex): void {
  commitDocumentCandidates(root, [indexCandidate(root, index)]);
}

export function writeMaterialBookPageProjection(
  root: string,
  index: MaterialBookIndex,
  pageText: { physicalPage: number; text: string } | null,
): void {
  const candidates = [indexCandidate(root, index)];
  if (pageText) {
    const path = materialBookPageTextPath(
      index.materialId,
      index.revision,
      pageText.physicalPage,
    );
    const absolute = resolveDocumentPath(root, path);
    candidates.unshift({
      path,
      before: existsSync(absolute) ? readFileSync(absolute, 'utf8') : null,
      after: pageText.text,
      validate: () => {},
    });
  }
  commitDocumentCandidates(root, candidates);
}
