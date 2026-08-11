import {
  existsSync,
  readFileSync,
  realpathSync,
  statSync,
} from 'node:fs';
import {
  isAbsolute,
  join,
  posix,
  relative,
} from 'node:path';
import type { PeerLive2DManifest } from '../shared/contracts';

const manifestKeys = ['coreFile', 'modelFile', 'modelFiles', 'version'];

export function live2dContentType(path: string): string | null {
  if (path.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (path.endsWith('.json')) return 'application/json; charset=utf-8';
  if (path.endsWith('.moc3')) return 'application/octet-stream';
  if (path.endsWith('.png')) return 'image/png';
  return null;
}

function relativeFile(path: unknown): path is string {
  return typeof path === 'string'
    && path.length > 0
    && !isAbsolute(path)
    && !path.includes('\\')
    && !path.includes('\0')
    && posix.normalize(path) === path
    && path !== '.'
    && !path.startsWith('../')
    && live2dContentType(path) !== null;
}

function containedFile(root: string, path: string): boolean {
  const candidate = join(root, path);
  if (!existsSync(candidate) || !statSync(candidate).isFile()) return false;
  const fromRoot = relative(realpathSync(root), realpathSync(candidate));
  return fromRoot.length > 0 && !fromRoot.startsWith('..') && !isAbsolute(fromRoot);
}

function manifestValue(value: unknown): PeerLive2DManifest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Record<string, unknown>;
  if (Object.keys(candidate).sort().join('\0') !== manifestKeys.join('\0')) return null;
  if (candidate.version !== 1) return null;
  if (!relativeFile(candidate.modelFile) || !candidate.modelFile.endsWith('.model3.json')) {
    return null;
  }
  if (!relativeFile(candidate.coreFile) || !candidate.coreFile.endsWith('.js')) return null;
  if (!Array.isArray(candidate.modelFiles) || candidate.modelFiles.length === 0) return null;
  if (!candidate.modelFiles.every(relativeFile)) return null;
  const modelFiles = candidate.modelFiles as string[];
  if (new Set(modelFiles).size !== modelFiles.length) return null;
  if (!modelFiles.includes(candidate.modelFile)) return null;
  return {
    version: 1,
    modelFile: candidate.modelFile,
    coreFile: candidate.coreFile,
    modelFiles: [...modelFiles],
  };
}

export function readPeerLive2DManifest(root: string): PeerLive2DManifest | null {
  try {
    const manifest = manifestValue(JSON.parse(readFileSync(join(root, 'manifest.json'), 'utf8')));
    if (!manifest) return null;
    if (![manifest.coreFile, ...manifest.modelFiles].every((path) => containedFile(root, path))) {
      return null;
    }
    return manifest;
  } catch {
    return null;
  }
}
