import { createHash } from 'node:crypto';
import {
  createReadStream,
  createWriteStream,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, extname, isAbsolute, join } from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
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
import { parseMaterialLocator } from './material-locators';

export type MaterialImportSource =
  | { kind: 'bytes'; bytes: Uint8Array }
  | { kind: 'path'; absolutePath: string };

export type MaterialImportInput = {
  requestId: string;
  target?: { id: string; expectedRevision: number };
  title: string;
  filename: string;
  mediaType: string;
  source: MaterialImportSource;
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
};

function projectionFor(
  mediaType: string,
  originalPath: string,
): ProjectionDraft {
  if (textMediaTypes.has(mediaType) || mediaType.startsWith('text/')) {
    return {
      status: 'native-text',
      searchablePath: originalPath,
      locatorKind: 'lines',
    };
  }
  if (mediaType === 'application/pdf') {
    return { status: 'unavailable', searchablePath: null, locatorKind: 'page' };
  }
  if (mediaType.startsWith('image/')) {
    return {
      status: 'image-readable',
      searchablePath: originalPath,
      locatorKind: null,
    };
  }
  return { status: 'unavailable', searchablePath: null, locatorKind: null };
}

function checkedPathSource(source: Extract<MaterialImportSource, { kind: 'path' }>): string {
  const path = source.absolutePath;
  if (!isAbsolute(path) || !existsSync(path)) throw new Error('MATERIAL_SOURCE_INVALID');
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) throw new Error('MATERIAL_SOURCE_INVALID');
  return path;
}

async function digestPath(path: string): Promise<string> {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(path)) hash.update(chunk as Buffer);
  return hash.digest('hex');
}

async function digestSource(source: MaterialImportSource): Promise<string> {
  return source.kind === 'bytes'
    ? sha256(source.bytes)
    : digestPath(checkedPathSource(source));
}

async function writeOriginal(path: string, source: MaterialImportSource): Promise<string> {
  if (source.kind === 'bytes') {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, source.bytes, { flag: 'wx' });
    return sha256(source.bytes);
  }
  const sourcePath = checkedPathSource(source);
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${crypto.randomUUID()}.tmp`;
  const hash = createHash('sha256');
  const hashing = new Transform({
    transform(chunk, _encoding, callback) {
      hash.update(chunk as Buffer);
      callback(null, chunk);
    },
  });
  try {
    await pipeline(
      createReadStream(sourcePath),
      hashing,
      createWriteStream(temporary, { flags: 'wx' }),
    );
    renameSync(temporary, path);
    return hash.digest('hex');
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
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
  for (const material of listMaterials(root)) {
    const existing = material.revisions.find((revision) => revision.requestId === requestId);
    if (!existing) continue;
    const digest = await digestSource(input.source);
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
  const path = manifestPath(id);
  const before = current ? readFileSync(resolveDocumentPath(root, path), 'utf8') : null;
  const writtenRoots = new Set<string>();
  try {
    const original = resolveDocumentPath(root, originalPath);
    writtenRoots.add(join(root, `materials/${id}/revisions/${revisionNumber}`));
    const digest = await writeOriginal(original, input.source);
    const projection = projectionFor(mediaType, originalPath);
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
    const material: MaterialManifest = {
      schema: 'studyforge.material.v1',
      id,
      path,
      currentRevision: revisionNumber,
      revisions: [...(current?.revisions ?? []), revision],
    };
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
  let locator;
  try {
    locator = parseMaterialLocator(source.locator);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (message === 'MATERIAL_LOCATOR_INVALID') {
      throw new Error(`MATERIAL_LOCATOR_NOT_FOUND: ${source.locator}`);
    }
    throw error;
  }
  if (revision.locatorKind === 'lines') {
    const lines = readFileSync(resolveDocumentPath(root, revision.originalPath), 'utf8')
      .split(/\r?\n/);
    if (locator.kind !== 'lines' || locator.end > lines.length) {
      throw new Error(`MATERIAL_LOCATOR_NOT_FOUND: ${source.locator}`);
    }
    return {
      id: source.id,
      revision: revision.revision,
      locator: source.locator,
      path: revision.originalPath,
      text: lines.slice(locator.start - 1, locator.end).join('\n'),
    };
  }
  if (revision.locatorKind === 'page' && locator.kind === 'pages') {
    const directory = `materials/${source.id}/projections/${revision.revision}/pages`;
    const texts: string[] = [];
    for (let page = locator.start; page <= locator.end; page += 1) {
      const name = `page-${String(page).padStart(4, '0')}.txt`;
      const path = `${directory}/${name}`;
      const absolute = resolveDocumentPath(root, path);
      if (!existsSync(absolute)) {
        if (revision.searchStatus === 'unavailable' || revision.searchStatus === 'image-readable') {
          throw new Error(`MATERIAL_LOCATOR_UNAVAILABLE: ${source.locator}`);
        }
        throw new Error(`MATERIAL_LOCATOR_NOT_FOUND: ${source.locator}`);
      }
      texts.push(readFileSync(absolute, 'utf8').trimEnd());
    }
    if (texts.length > 0) {
      return {
        id: source.id,
        revision: revision.revision,
        locator: source.locator,
        path: locator.start === locator.end
          ? `${directory}/page-${String(locator.start).padStart(4, '0')}.txt`
          : directory,
        text: texts.join('\n\n'),
      };
    }
  }
  if (revision.searchStatus === 'unavailable' || revision.searchStatus === 'image-readable') {
    throw new Error(`MATERIAL_LOCATOR_UNAVAILABLE: ${source.locator}`);
  }
  throw new Error(`MATERIAL_LOCATOR_NOT_FOUND: ${source.locator}`);
}
