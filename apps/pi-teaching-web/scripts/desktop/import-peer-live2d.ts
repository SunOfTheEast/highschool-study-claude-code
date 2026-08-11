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
import { homedir } from 'node:os';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { normalizeVTubeStudioModel } from '../../src/desktop/peer-live2d-import';
import { readPeerLive2DManifest } from '../../src/desktop/peer-live2d-package';

export function parseImportPeerLive2DArguments(argv: readonly string[]): {
  source: string;
  appHome: string | null;
} {
  let source: string | null = null;
  let appHome: string | null = null;
  for (let index = 0; index < argv.length; index += 1) {
    const name = argv[index];
    if (name === '--') continue;
    if (name !== '--source' && name !== '--app-home') {
      throw new Error('STUDYFORGE_LIVE2D_ARGUMENT_UNKNOWN');
    }
    const value = argv[index + 1];
    if (!value || value.startsWith('--')) {
      throw new Error(`STUDYFORGE_LIVE2D_ARGUMENT_MISSING: ${name}`);
    }
    if (name === '--source') {
      if (source) throw new Error('STUDYFORGE_LIVE2D_ARGUMENT_DUPLICATE');
      source = value;
    } else {
      if (appHome) throw new Error('STUDYFORGE_LIVE2D_ARGUMENT_DUPLICATE');
      appHome = value;
    }
    index += 1;
  }
  if (!source) throw new Error('STUDYFORGE_LIVE2D_ARGUMENT_MISSING: --source');
  return { source, appHome };
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
  return JSON.parse(readFileSync(path, 'utf8')) as unknown;
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

export function importPeerLive2D(input: { source: string; appHome: string }): {
  installed: string;
  backup: string;
  textures: number;
} {
  if (process.platform !== 'darwin') throw new Error('STUDYFORGE_LIVE2D_MACOS_ONLY');
  if (!isAbsolute(input.source) || !isAbsolute(input.appHome)) {
    throw new Error('STUDYFORGE_LIVE2D_PATH_INVALID');
  }
  const source = realpathSync(input.source);
  if (!statSync(source).isDirectory()) throw new Error('LIVE2D_SOURCE_INCOMPLETE');
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

  const actorRoot = join(input.appHome, 'actors', 'peer-axia');
  const installed = join(actorRoot, 'live2d');
  const backup = join(actorRoot, 'live2d.previous');
  const core = join(installed, normalized.manifest.coreFile);
  if (!existsSync(core) || !statSync(core).isFile()) {
    throw new Error('STUDYFORGE_LIVE2D_CORE_MISSING');
  }
  if (existsSync(backup)) throw new Error('STUDYFORGE_LIVE2D_BACKUP_EXISTS');
  mkdirSync(actorRoot, { recursive: true });
  const staging = mkdtempSync(join(actorRoot, '.live2d-staging-'));
  let installedStaging = false;
  try {
    copy(source, staging, normalized.staticCopies);
    copy(source, staging, normalized.expressionCopies);
    copy(source, staging, normalized.motionCopies);
    copy(source, staging, normalized.textureCopies);
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

    renameSync(installed, backup);
    try {
      renameSync(staging, installed);
      installedStaging = true;
    } catch (error) {
      renameSync(backup, installed);
      throw error;
    }
    return { installed, backup, textures: Object.keys(normalized.textureCopies).length };
  } finally {
    if (!installedStaging && existsSync(staging)) {
      const fromActorRoot = relative(realpathSync(actorRoot), realpathSync(staging));
      if (fromActorRoot.startsWith('.live2d-staging-') && !fromActorRoot.includes('/')) {
        rmSync(staging, { recursive: true });
      }
    }
  }
}

if (import.meta.main) {
  const input = parseImportPeerLive2DArguments(process.argv.slice(2));
  const appHome = input.appHome
    ?? join(homedir(), 'Library', 'Application Support', 'StudyForge');
  console.log(JSON.stringify(importPeerLive2D({
    source: resolve(input.source),
    appHome: resolve(appHome),
  })));
}
