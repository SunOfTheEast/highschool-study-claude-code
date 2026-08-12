import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { basename, dirname, isAbsolute, join, relative } from 'node:path';
import {
  mergeVTubeExpression,
  normalizeVTubeStudioModel,
} from './peer-live2d-import';
import { readPeerLive2DManifest } from './peer-live2d-package';

export type PeerSkinStatus =
  | { state: 'missing'; coreInstalled: boolean }
  | { state: 'installed'; coreInstalled: true };

export type PeerLive2DInstallInput = {
  appHome: string;
  source: string;
  core?: string | null;
};

export function sharedLive2DCorePath(appHome: string): string {
  return join(appHome, 'runtime', 'live2d', 'live2dcubismcore.min.js');
}

function sourceFiles(root: string, relativeRoot = ''): string[] {
  const directory = join(root, relativeRoot);
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const child = relativeRoot ? `${relativeRoot}/${entry.name}` : entry.name;
    if (entry.isSymbolicLink()) throw new Error('LIVE2D_SOURCE_INCOMPLETE');
    if (entry.isDirectory()) return sourceFiles(root, child);
    if (!entry.isFile()) throw new Error('LIVE2D_SOURCE_INCOMPLETE');
    return [child];
  });
}

function json(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown;
  } catch {
    throw new Error('LIVE2D_SOURCE_INCOMPLETE');
  }
}

function validCore(path: string, requireOfficialName = true): string | null {
  try {
    if (!isAbsolute(path)) return null;
    const resolved = realpathSync(path);
    if ((requireOfficialName && basename(resolved) !== 'live2dcubismcore.min.js')
      || !statSync(resolved).isFile()) return null;
    return readFileSync(resolved, 'utf8').includes('Live2DCubismCore') ? resolved : null;
  } catch {
    return null;
  }
}

function installedRoot(appHome: string): string {
  return join(appHome, 'actors', 'peer-axia', 'live2d');
}

function availableCore(appHome: string): string | null {
  return validCore(sharedLive2DCorePath(appHome))
    ?? validCore(join(installedRoot(appHome), 'runtime', 'live2dcubismcore.min.js'));
}

export function peerSkinStatus(appHome: string): PeerSkinStatus {
  if (readPeerLive2DManifest(installedRoot(appHome))) {
    return { state: 'installed', coreInstalled: true };
  }
  return { state: 'missing', coreInstalled: availableCore(appHome) !== null };
}

function copy(sourceRoot: string, staging: string, copies: Record<string, string>): void {
  for (const [source, target] of Object.entries(copies)) {
    const destination = join(staging, target);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(sourceRoot, source), destination);
  }
}

function resizeTexture(path: string): void {
  const result = Bun.spawnSync(['/usr/bin/sips', '--resampleHeightWidthMax', '2048', path], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  if (result.exitCode !== 0) throw new Error('STUDYFORGE_LIVE2D_TEXTURE_RESIZE_FAILED');
}

function removeTransactionDirectory(actorRoot: string, path: string, prefix: string): void {
  if (!existsSync(path)) return;
  const fromRoot = relative(realpathSync(actorRoot), realpathSync(path));
  if (!fromRoot.startsWith(prefix) || fromRoot.includes('/')) {
    throw new Error('STUDYFORGE_LIVE2D_TRANSACTION_INVALID');
  }
  rmSync(path, { recursive: true });
}

function installSharedCore(appHome: string, source: string): void {
  const target = sharedLive2DCorePath(appHome);
  const directory = dirname(target);
  mkdirSync(directory, { recursive: true });
  const temporary = join(directory, `.live2dcubismcore-${randomUUID()}.tmp`);
  try {
    copyFileSync(source, temporary);
    if (!validCore(temporary, false)) throw new Error('STUDYFORGE_LIVE2D_CORE_INVALID');
    renameSync(temporary, target);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
}

export function installPeerLive2D(input: PeerLive2DInstallInput): {
  installed: string;
  textures: number;
  status: PeerSkinStatus;
} {
  if (process.platform !== 'darwin') throw new Error('STUDYFORGE_LIVE2D_MACOS_ONLY');
  if (!isAbsolute(input.source) || !isAbsolute(input.appHome)) {
    throw new Error('STUDYFORGE_LIVE2D_PATH_INVALID');
  }
  let source: string;
  try {
    source = realpathSync(input.source);
    if (!statSync(source).isDirectory()) throw new Error('LIVE2D_SOURCE_INCOMPLETE');
  } catch (error) {
    if (error instanceof Error && error.message === 'LIVE2D_SOURCE_INCOMPLETE') throw error;
    throw new Error('LIVE2D_SOURCE_INCOMPLETE');
  }
  const files = sourceFiles(source);
  const vtubeFile = files.filter((path) => path.endsWith('.vtube.json'));
  if (vtubeFile.length !== 1) throw new Error('LIVE2D_SOURCE_INCOMPLETE');
  const vtube = json(join(source, vtubeFile[0]!));
  const vtubeReferences = (vtube as { FileReferences?: { Model?: unknown } }).FileReferences;
  const modelFile = typeof vtubeReferences?.Model === 'string' ? vtubeReferences.Model : '';
  if (!files.includes(modelFile)) throw new Error('LIVE2D_SOURCE_INCOMPLETE');
  const model = json(join(source, modelFile));
  const modelReferences = (model as { FileReferences?: { DisplayInfo?: unknown } }).FileReferences;
  const displayFile = typeof modelReferences?.DisplayInfo === 'string'
    ? modelReferences.DisplayInfo
    : '';
  if (!files.includes(displayFile)) throw new Error('LIVE2D_SOURCE_INCOMPLETE');
  const normalized = normalizeVTubeStudioModel({
    modelFile,
    model,
    vtube,
    displayInfo: json(join(source, displayFile)),
    files,
  });

  const selectedCore = input.core ? validCore(input.core) : null;
  if (input.core && !selectedCore) throw new Error('STUDYFORGE_LIVE2D_CORE_INVALID');
  const core = selectedCore ?? availableCore(input.appHome);
  if (!core) throw new Error('STUDYFORGE_LIVE2D_CORE_MISSING');

  const actorRoot = join(input.appHome, 'actors', 'peer-axia');
  const installed = join(actorRoot, 'live2d');
  mkdirSync(actorRoot, { recursive: true });
  const staging = mkdtempSync(join(actorRoot, '.live2d-staging-'));
  const rollback = join(actorRoot, `.live2d-rollback-${randomUUID()}`);
  let installedStaging = false;
  let movedCurrent = false;
  try {
    copy(source, staging, normalized.staticCopies);
    copy(source, staging, normalized.expressionCopies);
    copy(source, staging, normalized.motionCopies);
    copy(source, staging, normalized.textureCopies);
    const neutralExpression = json(join(staging, 'runtime/expressions/neutral.exp3.json'));
    for (const name of ['curious', 'skeptical']) {
      const path = join(staging, `runtime/expressions/${name}.exp3.json`);
      writeFileSync(path, `${JSON.stringify(
        mergeVTubeExpression(neutralExpression, json(path)),
        null,
        2,
      )}\n`);
    }
    for (const target of Object.values(normalized.textureCopies)) resizeTexture(join(staging, target));
    const stagedCore = join(staging, normalized.manifest.coreFile);
    mkdirSync(dirname(stagedCore), { recursive: true });
    copyFileSync(core, stagedCore);
    for (const [target, value] of Object.entries(normalized.generatedFiles)) {
      const path = join(staging, target);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
    }
    writeFileSync(join(staging, 'manifest.json'), `${JSON.stringify(normalized.manifest, null, 2)}\n`);
    if (!readPeerLive2DManifest(staging)) throw new Error('STUDYFORGE_LIVE2D_STAGE_INVALID');

    installSharedCore(input.appHome, stagedCore);
    if (existsSync(installed)) {
      renameSync(installed, rollback);
      movedCurrent = true;
    }
    try {
      renameSync(staging, installed);
      installedStaging = true;
    } catch (error) {
      if (movedCurrent) renameSync(rollback, installed);
      movedCurrent = false;
      throw error;
    }
    if (movedCurrent) {
      removeTransactionDirectory(actorRoot, rollback, '.live2d-rollback-');
      movedCurrent = false;
    }
    return {
      installed,
      textures: Object.keys(normalized.textureCopies).length,
      status: { state: 'installed', coreInstalled: true },
    };
  } finally {
    if (!installedStaging) {
      removeTransactionDirectory(actorRoot, staging, '.live2d-staging-');
    }
    if (movedCurrent && existsSync(rollback) && !existsSync(installed)) {
      renameSync(rollback, installed);
    }
  }
}
