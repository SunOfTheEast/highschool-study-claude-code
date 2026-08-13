import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, join, resolve } from 'node:path';

export type PortableGitArtifact = {
  id: 'portable-git';
  version: string;
  archive: string;
  url: string;
  sha256: string;
  license: string;
  kind: 'portable-git-sfx';
};

export type ZipBinaryArtifact = {
  id: 'ripgrep' | 'fd';
  version: string;
  archive: string;
  url: string;
  sha256: string;
  license: string;
  kind: 'zip-binary';
  binary: 'rg.exe' | 'fd.exe';
};

export type WindowsArtifact = PortableGitArtifact | ZipBinaryArtifact;

export type WindowsArtifactManifest = {
  schema: 'studyforge.windows-artifacts.v1';
  artifacts: WindowsArtifact[];
};

export type WindowsArtifactOperations = {
  manifestPath?: string;
  download?: (artifact: WindowsArtifact, destination: string) => Promise<void>;
  extractPortableGit?: (archive: string, destination: string) => Promise<void>;
  extractZip?: (
    archive: string,
    destination: string,
    artifact: ZipBinaryArtifact,
  ) => Promise<void>;
};

function invalidManifest(): never {
  throw new Error('STUDYFORGE_WINDOWS_ARTIFACT_MANIFEST_INVALID');
}

export function readWindowsArtifactManifest(path: string): WindowsArtifactManifest {
  let value: unknown;
  try {
    value = JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    invalidManifest();
  }
  if (!value || typeof value !== 'object') invalidManifest();
  const candidate = value as { schema?: unknown; artifacts?: unknown };
  if (
    candidate.schema !== 'studyforge.windows-artifacts.v1'
    || !Array.isArray(candidate.artifacts)
    || candidate.artifacts.length !== 3
  ) invalidManifest();

  const ids = new Set<string>();
  for (const raw of candidate.artifacts) {
    if (!raw || typeof raw !== 'object') invalidManifest();
    const artifact = raw as Record<string, unknown>;
    if (
      typeof artifact.id !== 'string'
      || !['portable-git', 'ripgrep', 'fd'].includes(artifact.id)
      || ids.has(artifact.id)
      || typeof artifact.version !== 'string'
      || artifact.version.length === 0
      || typeof artifact.archive !== 'string'
      || basename(artifact.archive) !== artifact.archive
      || typeof artifact.url !== 'string'
      || artifact.url.includes('/latest/')
      || typeof artifact.sha256 !== 'string'
      || !/^[a-f0-9]{64}$/.test(artifact.sha256)
      || typeof artifact.license !== 'string'
      || artifact.license.length < 3
    ) invalidManifest();
    let url: URL;
    try {
      url = new URL(artifact.url);
    } catch {
      invalidManifest();
    }
    if (url.protocol !== 'https:' || url.hostname !== 'github.com') invalidManifest();
    if (artifact.id === 'portable-git') {
      if (artifact.kind !== 'portable-git-sfx' || 'binary' in artifact) invalidManifest();
    } else if (
      artifact.kind !== 'zip-binary'
      || artifact.binary !== (artifact.id === 'ripgrep' ? 'rg.exe' : 'fd.exe')
    ) invalidManifest();
    ids.add(artifact.id);
  }
  if (!['portable-git', 'ripgrep', 'fd'].every((id) => ids.has(id))) invalidManifest();
  return value as WindowsArtifactManifest;
}

function digest(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

export function verifyArtifactDigest(path: string, expected: string): void {
  if (digest(path) !== expected) {
    throw new Error('STUDYFORGE_WINDOWS_ARTIFACT_DIGEST_MISMATCH');
  }
}

async function run(program: string, arguments_: string[]): Promise<void> {
  const child = Bun.spawn([program, ...arguments_], { stdout: 'pipe', stderr: 'pipe' });
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (exitCode !== 0) {
    throw new Error(`STUDYFORGE_WINDOWS_ARTIFACT_EXTRACTION_FAILED: ${stderr || stdout}`);
  }
}

async function download(artifact: WindowsArtifact, destination: string): Promise<void> {
  const response = await fetch(artifact.url);
  if (!response.ok) throw new Error(`STUDYFORGE_WINDOWS_ARTIFACT_DOWNLOAD_FAILED: ${artifact.id}`);
  writeFileSync(destination, Buffer.from(await response.arrayBuffer()));
}

async function extractPortableGit(archive: string, destination: string): Promise<void> {
  if (process.platform !== 'win32') {
    throw new Error('STUDYFORGE_WINDOWS_ARTIFACT_HOST_REQUIRED');
  }
  await run(archive, ['-y', `-o${destination}`]);
}

async function extractZip(
  archive: string,
  destination: string,
  _artifact: ZipBinaryArtifact,
): Promise<void> {
  if (process.platform === 'win32') {
    await run('tar.exe', ['-xf', archive, '-C', destination]);
    return;
  }
  await run('unzip', ['-q', archive, '-d', destination]);
}

function findExactFile(root: string, filename: string): string {
  const matches: string[] = [];
  const stack = [root];
  while (stack.length > 0) {
    const directory = stack.pop()!;
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) stack.push(path);
      else if (entry.isFile() && entry.name === filename) matches.push(path);
    }
  }
  if (matches.length !== 1) {
    throw new Error(`STUDYFORGE_WINDOWS_ARTIFACT_BINARY_INVALID: ${filename}`);
  }
  return matches[0]!;
}

export async function prepareWindowsArtifacts(
  appRoot: string,
  operations: WindowsArtifactOperations = {},
): Promise<string> {
  const manifestPath = operations.manifestPath
    ?? join(appRoot, 'scripts/desktop/windows-artifacts.manifest.json');
  const manifest = readWindowsArtifactManifest(manifestPath);
  const generatedRoot = resolve(appRoot, 'src-tauri/generated');
  const downloadsRoot = join(generatedRoot, 'downloads');
  const extractionRoot = join(generatedRoot, 'extraction');
  const stagingRoot = join(generatedRoot, 'platform/windows');
  rmSync(extractionRoot, { recursive: true, force: true });
  rmSync(stagingRoot, { recursive: true, force: true });
  mkdirSync(downloadsRoot, { recursive: true });
  mkdirSync(extractionRoot, { recursive: true });
  mkdirSync(join(stagingRoot, 'tools'), { recursive: true });

  const downloadArtifact = operations.download ?? download;
  const unpackPortableGit = operations.extractPortableGit ?? extractPortableGit;
  const unpackZip = operations.extractZip ?? extractZip;
  for (const artifact of manifest.artifacts) {
    const archive = join(downloadsRoot, artifact.archive);
    if (!existsSync(archive)) {
      const partial = `${archive}.partial`;
      rmSync(partial, { force: true });
      await downloadArtifact(artifact, partial);
      verifyArtifactDigest(partial, artifact.sha256);
      renameSync(partial, archive);
    } else {
      verifyArtifactDigest(archive, artifact.sha256);
    }

    if (artifact.kind === 'portable-git-sfx') {
      const destination = join(stagingRoot, 'portable-git');
      mkdirSync(destination, { recursive: true });
      await unpackPortableGit(archive, destination);
      if (!existsSync(join(destination, 'bin/bash.exe'))) {
        throw new Error('STUDYFORGE_WINDOWS_ARTIFACT_BINARY_INVALID: bash.exe');
      }
      continue;
    }

    const extracted = join(extractionRoot, artifact.id);
    mkdirSync(extracted, { recursive: true });
    await unpackZip(archive, extracted, artifact);
    copyFileSync(findExactFile(extracted, artifact.binary), join(stagingRoot, 'tools', artifact.binary));
  }

  writeFileSync(join(stagingRoot, 'ARTIFACTS.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  return stagingRoot;
}
