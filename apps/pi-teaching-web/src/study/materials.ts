import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, join } from 'node:path';
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml';
import type {
  LearningMaterial,
  LearningMaterialView,
  MaterialImportReceipt,
  MaterialLocatorSnapshot,
  MaterialRevision,
  MaterialSearchStatus,
} from '../shared/contracts';
import { resolveDocumentPath } from '../runtime/atomic-document';
import {
  commitDocumentCandidates,
  type DocumentCandidate,
} from '../runtime/multi-document-transaction';
import { StudyDocumentError } from './markdown';
import { loadPdfJs } from './pdf-runtime';

export type MaterialImportInput = {
  requestId: string;
  target?: { id: string; expectedRevision: number };
  title: string;
  filename: string;
  mediaType: string;
  bytes: Uint8Array;
};

type MaterialManifest = LearningMaterial & {
  schema: 'studyforge.material.v1';
};

type RecordValue = Record<string, unknown>;

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const textMediaTypes = new Set([
  'text/plain',
  'text/markdown',
  'text/html',
  'application/json',
  'application/xml',
]);

function record(value: unknown): RecordValue | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as RecordValue
    : null;
}

function requiredText(value: unknown, label: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${label.toUpperCase()}_REQUIRED`);
  }
  return value.trim();
}

function checkedId(value: unknown, label = 'material id'): string {
  const id = requiredText(value, label);
  if (!idPattern.test(id)) throw new Error(`${label.toUpperCase()}_INVALID: ${id}`);
  return id;
}

function checkedRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error('MATERIAL_REVISION_INVALID');
  }
  return Number(value);
}

function checkedTime(value: unknown): string {
  const at = requiredText(value, 'material imported_at');
  if (Number.isNaN(Date.parse(at))) throw new Error('MATERIAL_TIME_INVALID');
  return at;
}

function checkedSearchStatus(value: unknown): MaterialSearchStatus {
  if (
    value !== 'native-text'
    && value !== 'pdf-text'
    && value !== 'image-readable'
    && value !== 'unavailable'
  ) {
    throw new Error('MATERIAL_SEARCH_STATUS_INVALID');
  }
  return value;
}

function checkedRevisionEntry(value: unknown): MaterialRevision {
  const item = record(value);
  if (!item) throw new Error('MATERIAL_REVISION_INVALID');
  const locatorKind = item.locator_kind;
  if (locatorKind !== null && locatorKind !== 'lines' && locatorKind !== 'page') {
    throw new Error('MATERIAL_LOCATOR_KIND_INVALID');
  }
  const searchablePath = item.searchable_path;
  if (searchablePath !== null && typeof searchablePath !== 'string') {
    throw new Error('MATERIAL_SEARCHABLE_PATH_INVALID');
  }
  return {
    revision: checkedRevision(item.revision),
    title: requiredText(item.title, 'material title'),
    originalFilename: requiredText(item.original_filename, 'material original filename'),
    mediaType: requiredText(item.media_type, 'material media type'),
    sha256: requiredText(item.sha256, 'material sha256'),
    importedAt: checkedTime(item.imported_at),
    originalPath: requiredText(item.original_path, 'material original path'),
    searchStatus: checkedSearchStatus(item.search_status),
    searchablePath,
    locatorKind,
    requestId: checkedId(item.request_id, 'material request id'),
  };
}

function manifestPath(id: string): string {
  return `materials/${checkedId(id)}/manifest.yaml`;
}

function manifestFromValue(path: string, value: unknown): MaterialManifest {
  const root = record(value);
  if (!root || root.schema !== 'studyforge.material.v1') {
    throw new StudyDocumentError(path, 'expected studyforge.material.v1');
  }
  const id = checkedId(root.id);
  if (path !== manifestPath(id)) {
    throw new StudyDocumentError(path, `Material path must be ${manifestPath(id)}`);
  }
  const revisions = Array.isArray(root.revisions)
    ? root.revisions.map(checkedRevisionEntry)
    : [];
  const currentRevision = checkedRevision(root.current_revision);
  if (revisions.length === 0 || !revisions.some((item) => item.revision === currentRevision)) {
    throw new StudyDocumentError(path, 'current material revision does not exist');
  }
  return {
    schema: 'studyforge.material.v1',
    id,
    path,
    currentRevision,
    revisions,
  };
}

function manifestValue(material: MaterialManifest): RecordValue {
  return {
    schema: material.schema,
    id: material.id,
    current_revision: material.currentRevision,
    revisions: material.revisions.map((revision) => ({
      revision: revision.revision,
      title: revision.title,
      original_filename: revision.originalFilename,
      media_type: revision.mediaType,
      sha256: revision.sha256,
      imported_at: revision.importedAt,
      original_path: revision.originalPath,
      search_status: revision.searchStatus,
      searchable_path: revision.searchablePath,
      locator_kind: revision.locatorKind,
      request_id: revision.requestId,
    })),
  };
}

function readManifestAt(root: string, path: string): MaterialManifest {
  const absolute = resolveDocumentPath(root, path);
  if (!existsSync(absolute)) throw new StudyDocumentError(path, 'Material does not exist');
  return manifestFromValue(path, parseYaml(readFileSync(absolute, 'utf8')));
}

export function readMaterial(root: string, id: string): LearningMaterial {
  return readManifestAt(root, manifestPath(id));
}

export function listMaterials(root: string): LearningMaterial[] {
  const directory = join(root, 'materials');
  if (!existsSync(directory)) return [];
  return readdirSync(directory, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && existsSync(join(directory, entry.name, 'manifest.yaml')))
    .map((entry) => readMaterial(root, entry.name))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function nextMaterialId(root: string): string {
  const directory = join(root, 'materials');
  let maximum = 0;
  if (existsSync(directory)) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const match = entry.isDirectory() ? /^material-(\d+)$/.exec(entry.name) : null;
      if (match) maximum = Math.max(maximum, Number.parseInt(match[1]!, 10));
    }
  }
  return `material-${String(maximum + 1).padStart(3, '0')}`;
}

function safeExtension(filename: string): string {
  const extension = extname(basename(filename)).toLowerCase();
  return /^\.[a-z0-9]{1,10}$/.test(extension) ? extension : '.bin';
}

function sha256(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

type ProjectionDraft = {
  status: MaterialSearchStatus;
  searchablePath: string | null;
  locatorKind: 'lines' | 'page' | null;
  files: Array<{ path: string; text: string }>;
};

async function pdfProjection(
  id: string,
  revision: number,
  bytes: Uint8Array,
): Promise<ProjectionDraft> {
  try {
    const { getDocument, VerbosityLevel } = await loadPdfJs();
    const document = await getDocument({
      data: Uint8Array.from(bytes),
      verbosity: VerbosityLevel.ERRORS,
    }).promise;
    const files: Array<{ path: string; text: string }> = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items.flatMap((item) => (
        'str' in item && typeof item.str === 'string' ? [item.str] : []
      )).join(' ');
      files.push({
        path: `materials/${id}/projections/${revision}/pages/page-${String(pageNumber).padStart(4, '0')}.txt`,
        text: `${text}\n`,
      });
    }
    await document.destroy();
    return {
      status: 'pdf-text',
      searchablePath: `materials/${id}/projections/${revision}/pages`,
      locatorKind: 'page',
      files,
    };
  } catch {
    return { status: 'unavailable', searchablePath: null, locatorKind: null, files: [] };
  }
}

async function projectionFor(
  id: string,
  revision: number,
  mediaType: string,
  originalPath: string,
  bytes: Uint8Array,
): Promise<ProjectionDraft> {
  if (textMediaTypes.has(mediaType) || mediaType.startsWith('text/')) {
    return {
      status: 'native-text',
      searchablePath: originalPath,
      locatorKind: 'lines',
      files: [],
    };
  }
  if (mediaType === 'application/pdf') return pdfProjection(id, revision, bytes);
  if (mediaType.startsWith('image/')) {
    return {
      status: 'image-readable',
      searchablePath: originalPath,
      locatorKind: null,
      files: [],
    };
  }
  return { status: 'unavailable', searchablePath: null, locatorKind: null, files: [] };
}

function receipt(material: LearningMaterial, revision: MaterialRevision): MaterialImportReceipt {
  return {
    id: material.id,
    revision: revision.revision,
    path: material.path,
    originalPath: revision.originalPath,
    searchStatus: revision.searchStatus,
  };
}

function manifestCandidate(
  material: MaterialManifest,
  before: string | null,
): DocumentCandidate {
  const after = stringifyYaml(manifestValue(material), { lineWidth: 0 });
  return {
    path: material.path,
    before,
    after,
    validate: (source) => {
      const parsed = manifestFromValue(material.path, parseYaml(source));
      if (parsed.id !== material.id || parsed.currentRevision !== material.currentRevision) {
        throw new StudyDocumentError(material.path, 'Material candidate identity changed');
      }
    },
  };
}

export async function importMaterial(
  root: string,
  input: MaterialImportInput,
  importedAt: string,
): Promise<MaterialImportReceipt> {
  const requestId = checkedId(input.requestId, 'material request id');
  const title = requiredText(input.title, 'material title');
  const filename = basename(requiredText(input.filename, 'material filename'));
  const mediaType = requiredText(input.mediaType, 'material media type').toLowerCase();
  const at = checkedTime(importedAt);
  const digest = sha256(input.bytes);
  for (const material of listMaterials(root)) {
    const existing = material.revisions.find((revision) => revision.requestId === requestId);
    if (!existing) continue;
    if (existing.sha256 !== digest) throw new Error('MATERIAL_REQUEST_CONFLICT');
    return receipt(material, existing);
  }

  const current = input.target ? readMaterial(root, input.target.id) : null;
  if (current && current.currentRevision !== input.target!.expectedRevision) {
    throw new Error(`MATERIAL_REVISION_STALE: ${current.id}`);
  }
  const id = current?.id ?? nextMaterialId(root);
  const revisionNumber = (current?.currentRevision ?? 0) + 1;
  const originalPath = `materials/${id}/revisions/${revisionNumber}/original${safeExtension(filename)}`;
  const projection = await projectionFor(id, revisionNumber, mediaType, originalPath, input.bytes);
  const revision: MaterialRevision = {
    revision: revisionNumber,
    title,
    originalFilename: filename,
    mediaType,
    sha256: digest,
    importedAt: at,
    originalPath,
    searchStatus: projection.status,
    searchablePath: projection.searchablePath,
    locatorKind: projection.locatorKind,
    requestId,
  };
  const path = manifestPath(id);
  const before = current ? readFileSync(resolveDocumentPath(root, path), 'utf8') : null;
  const material: MaterialManifest = {
    schema: 'studyforge.material.v1',
    id,
    path,
    currentRevision: revisionNumber,
    revisions: [...(current?.revisions ?? []), revision],
  };
  const writtenRoots = new Set<string>();
  try {
    const original = resolveDocumentPath(root, originalPath);
    mkdirSync(dirname(original), { recursive: true });
    writeFileSync(original, input.bytes, { flag: 'wx' });
    writtenRoots.add(join(root, `materials/${id}/revisions/${revisionNumber}`));
    for (const file of projection.files) {
      const absolute = resolveDocumentPath(root, file.path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, file.text, { flag: 'wx' });
      writtenRoots.add(join(root, `materials/${id}/projections/${revisionNumber}`));
    }
    commitDocumentCandidates(root, [manifestCandidate(material, before)]);
    return receipt(material, revision);
  } catch (error) {
    for (const directory of writtenRoots) {
      if (existsSync(directory)) rmSync(directory, { recursive: true, force: true });
    }
    throw error;
  }
}

export function readMaterialRevision(
  root: string,
  id: string,
  revision: number,
): MaterialRevision {
  const material = readMaterial(root, id);
  const found = material.revisions.find((item) => item.revision === checkedRevision(revision));
  if (!found) throw new Error(`MATERIAL_REVISION_NOT_FOUND: ${id}@${revision}`);
  return found;
}

export function readMaterialView(root: string, id: string): LearningMaterialView {
  const material = readMaterial(root, id);
  const current = readMaterialRevision(root, id, material.currentRevision);
  let suggestedLocator: string | null = null;
  if (current.locatorKind === 'lines') {
    const lines = readFileSync(resolveDocumentPath(root, current.originalPath), 'utf8')
      .split(/\r?\n/);
    suggestedLocator = `lines-1-${Math.min(lines.length, 80)}`;
  } else if (current.locatorKind === 'page') {
    const firstPage = `materials/${id}/projections/${current.revision}/pages/page-0001.txt`;
    if (existsSync(resolveDocumentPath(root, firstPage))) suggestedLocator = 'page-0001';
  }
  return { material, current, suggestedLocator };
}

export function readMaterialLocator(
  root: string,
  source: { id: string; revision: number; locator: string | null },
): MaterialLocatorSnapshot {
  const revision = readMaterialRevision(root, source.id, source.revision);
  if (source.locator === null) {
    return {
      id: source.id,
      revision: revision.revision,
      locator: null,
      path: revision.originalPath,
      text: null,
    };
  }
  if (revision.locatorKind === 'lines') {
    const match = /^lines-([1-9][0-9]*)-([1-9][0-9]*)$/.exec(source.locator);
    const lines = readFileSync(resolveDocumentPath(root, revision.originalPath), 'utf8')
      .split(/\r?\n/);
    const start = match ? Number.parseInt(match[1]!, 10) : 0;
    const end = match ? Number.parseInt(match[2]!, 10) : 0;
    if (!match || start > end || end > lines.length) {
      throw new Error(`MATERIAL_LOCATOR_NOT_FOUND: ${source.locator}`);
    }
    return {
      id: source.id,
      revision: revision.revision,
      locator: source.locator,
      path: revision.originalPath,
      text: lines.slice(start - 1, end).join('\n'),
    };
  }
  if (revision.locatorKind === 'page' && /^page-[0-9]{4}$/.test(source.locator)) {
    const path = `materials/${source.id}/projections/${revision.revision}/pages/${source.locator}.txt`;
    const absolute = resolveDocumentPath(root, path);
    if (existsSync(absolute)) {
      return {
        id: source.id,
        revision: revision.revision,
        locator: source.locator,
        path,
        text: readFileSync(absolute, 'utf8').trimEnd(),
      };
    }
  }
  if (revision.searchStatus === 'unavailable' || revision.searchStatus === 'image-readable') {
    throw new Error(`MATERIAL_LOCATOR_UNAVAILABLE: ${source.locator}`);
  }
  throw new Error(`MATERIAL_LOCATOR_NOT_FOUND: ${source.locator}`);
}
