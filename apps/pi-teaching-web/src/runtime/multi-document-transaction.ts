import { createHash, randomUUID } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmdirSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, relative, resolve, sep } from 'node:path';
import { StudyDocumentError } from '../study/markdown';
import { resolveDocumentPath } from './atomic-document';

export type DocumentCandidate = {
  path: string;
  before: string | null;
  after: string;
  validate?: (source: string) => void;
};

export type TransactionTestHooks = {
  commitId?: string;
  afterReplace?: (path: string, index: number) => void;
  leavePreparedOnError?: boolean;
};

type ManifestItem = {
  path: string;
  beforeExists: boolean;
  beforeHash: string | null;
  afterHash: string;
  beforeFile: string | null;
  afterFile: string;
};

type Manifest = {
  version: 1;
  commitId: string;
  state: 'prepared' | 'committed';
  items: ManifestItem[];
};

const activeRoots = new Set<string>();
const transactionIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function hash(source: string): string {
  return createHash('sha256').update(source).digest('hex');
}

function normalizedRoot(root: string): string {
  return resolve(root);
}

function normalizedCandidatePath(root: string, path: string): {
  absolute: string;
  relative: string;
} {
  const absolute = resolveDocumentPath(root, path);
  const normalized = relative(resolve(root), absolute).split(sep).join('/');
  if (normalized !== path) {
    throw new StudyDocumentError(path, 'path must be canonical learning-set-relative');
  }
  let current = resolve(root);
  for (const segment of normalized.split('/')) {
    current = join(current, segment);
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) {
      throw new StudyDocumentError(path, 'path cannot contain a symbolic link');
    }
  }
  return { absolute, relative: normalized };
}

function transactionRoot(root: string): string {
  const path = join(resolve(root), '.studyforge', 'transactions');
  const studyforge = dirname(path);
  if (existsSync(studyforge) && lstatSync(studyforge).isSymbolicLink()) {
    throw new StudyDocumentError('.studyforge', 'runtime path cannot be a symbolic link');
  }
  if (existsSync(path) && lstatSync(path).isSymbolicLink()) {
    throw new StudyDocumentError('.studyforge/transactions', 'runtime path cannot be a symbolic link');
  }
  return path;
}

function writeAtomicFile(path: string, source: string, mode = 0o644): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = join(dirname(path), `.${basename(path)}.${randomUUID()}.tmp`);
  try {
    writeFileSync(temporary, source, { encoding: 'utf8', flag: 'wx', mode });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) unlinkSync(temporary);
  }
}

function manifestPath(directory: string): string {
  return join(directory, 'manifest.json');
}

function writeManifest(directory: string, manifest: Manifest): void {
  writeAtomicFile(manifestPath(directory), `${JSON.stringify(manifest, null, 2)}\n`);
}

function readManifest(directory: string): Manifest {
  const parsed: unknown = JSON.parse(readFileSync(manifestPath(directory), 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`TRANSACTION_MANIFEST_INVALID:${directory}`);
  }
  const value = parsed as Partial<Manifest>;
  if (
    value.version !== 1
    || typeof value.commitId !== 'string'
    || !transactionIdPattern.test(value.commitId)
    || (value.state !== 'prepared' && value.state !== 'committed')
    || !Array.isArray(value.items)
  ) {
    throw new Error(`TRANSACTION_MANIFEST_INVALID:${directory}`);
  }
  return value as Manifest;
}

function removeTransactionDirectory(directory: string): void {
  for (const name of readdirSync(directory)) {
    const path = join(directory, name);
    const stat = lstatSync(path);
    if (!stat.isFile() || stat.isSymbolicLink()) {
      throw new Error(`TRANSACTION_CLEANUP_UNEXPECTED_ENTRY:${name}`);
    }
    unlinkSync(path);
  }
  rmdirSync(directory);
}

function currentHash(path: string): string | null {
  return existsSync(path) ? hash(readFileSync(path, 'utf8')) : null;
}

function restoreManifest(root: string, directory: string, manifest: Manifest): void {
  for (const item of [...manifest.items].reverse()) {
    const target = normalizedCandidatePath(root, item.path).absolute;
    const current = currentHash(target);
    if (item.beforeExists) {
      if (current === item.beforeHash) continue;
      if (current !== item.afterHash) {
        throw new Error(`TRANSACTION_RECOVERY_CONFLICT:${item.path}`);
      }
      if (item.beforeFile === null) {
        throw new Error(`TRANSACTION_MANIFEST_INVALID:${directory}`);
      }
      const before = readFileSync(join(directory, item.beforeFile), 'utf8');
      writeAtomicFile(target, before, statSync(target).mode);
    } else {
      if (current === null) continue;
      if (current !== item.afterHash) {
        throw new Error(`TRANSACTION_RECOVERY_CONFLICT:${item.path}`);
      }
      unlinkSync(target);
    }
  }
  removeTransactionDirectory(directory);
}

function recoverDocumentTransactionsUnlocked(root: string): string[] {
  const base = transactionRoot(root);
  if (!existsSync(base)) return [];
  const recovered: string[] = [];
  for (const name of readdirSync(base).sort()) {
    if (!transactionIdPattern.test(name)) continue;
    const directory = join(base, name);
    const stat = lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      throw new Error(`TRANSACTION_DIRECTORY_INVALID:${name}`);
    }
    const manifest = readManifest(directory);
    if (manifest.commitId !== name) {
      throw new Error(`TRANSACTION_MANIFEST_INVALID:${directory}`);
    }
    if (manifest.state === 'prepared') {
      restoreManifest(root, directory, manifest);
      recovered.push(manifest.commitId);
    } else {
      removeTransactionDirectory(directory);
    }
  }
  return recovered;
}

export function recoverDocumentTransactions(root: string): string[] {
  const key = normalizedRoot(root);
  if (activeRoots.has(key)) throw new Error('DOCUMENT_TRANSACTION_BUSY');
  activeRoots.add(key);
  try {
    return recoverDocumentTransactionsUnlocked(root);
  } finally {
    activeRoots.delete(key);
  }
}

export function commitDocumentCandidates(
  root: string,
  candidates: readonly DocumentCandidate[],
  hooks: TransactionTestHooks = {},
): { commitId: string; changedPaths: string[] } {
  if (candidates.length === 0) throw new Error('CANDIDATES_REQUIRED');
  const commitId = hooks.commitId ?? randomUUID();
  if (!transactionIdPattern.test(commitId)) throw new Error('COMMIT_ID_INVALID');
  const key = normalizedRoot(root);
  if (activeRoots.has(key)) throw new Error('DOCUMENT_TRANSACTION_BUSY');
  activeRoots.add(key);

  let directory: string | null = null;
  try {
    recoverDocumentTransactionsUnlocked(root);
    const resolved = candidates.map((candidate) => ({
      candidate,
      ...normalizedCandidatePath(root, candidate.path),
    }));
    const paths = new Set<string>();
    for (const item of resolved) {
      if (paths.has(item.relative)) {
        throw new Error(`DUPLICATE_CANDIDATE_PATH:${item.relative}`);
      }
      paths.add(item.relative);
      item.candidate.validate?.(item.candidate.after);
      const exists = existsSync(item.absolute);
      if (item.candidate.before === null) {
        if (exists) throw new StudyDocumentError(item.relative, 'SOURCE_STALE');
      } else {
        if (!exists || readFileSync(item.absolute, 'utf8') !== item.candidate.before) {
          throw new StudyDocumentError(item.relative, 'SOURCE_STALE');
        }
      }
    }

    const base = transactionRoot(root);
    mkdirSync(base, { recursive: true });
    directory = join(base, commitId);
    mkdirSync(directory, { recursive: false });
    const items: ManifestItem[] = [];
    resolved.forEach((item, index) => {
      const beforeFile = item.candidate.before === null ? null : `before-${index}.md`;
      const afterFile = `after-${index}.md`;
      if (beforeFile !== null) {
        writeFileSync(join(directory!, beforeFile), item.candidate.before!, {
          encoding: 'utf8',
          flag: 'wx',
        });
      }
      writeFileSync(join(directory!, afterFile), item.candidate.after, {
        encoding: 'utf8',
        flag: 'wx',
      });
      items.push({
        path: item.relative,
        beforeExists: item.candidate.before !== null,
        beforeHash: item.candidate.before === null ? null : hash(item.candidate.before),
        afterHash: hash(item.candidate.after),
        beforeFile,
        afterFile,
      });
    });
    const manifest: Manifest = {
      version: 1,
      commitId,
      state: 'prepared',
      items,
    };
    writeManifest(directory, manifest);

    for (const item of resolved) {
      const current = existsSync(item.absolute)
        ? readFileSync(item.absolute, 'utf8')
        : null;
      if (current !== item.candidate.before) {
        throw new StudyDocumentError(item.relative, 'SOURCE_STALE');
      }
    }

    try {
      resolved.forEach((item, index) => {
        const mode = existsSync(item.absolute) ? statSync(item.absolute).mode : 0o644;
        writeAtomicFile(item.absolute, item.candidate.after, mode);
        hooks.afterReplace?.(item.relative, index);
      });
    } catch (error) {
      if (!hooks.leavePreparedOnError) {
        restoreManifest(root, directory, manifest);
        directory = null;
      }
      throw error;
    }

    manifest.state = 'committed';
    writeManifest(directory, manifest);
    removeTransactionDirectory(directory);
    directory = null;
    return { commitId, changedPaths: resolved.map((item) => item.relative) };
  } finally {
    activeRoots.delete(key);
  }
}
