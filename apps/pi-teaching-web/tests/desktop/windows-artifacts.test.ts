import { createHash } from 'node:crypto';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { expect, test } from 'bun:test';
import {
  prepareWindowsArtifacts,
  readWindowsArtifactManifest,
  verifyArtifactDigest,
} from '../../scripts/desktop/windows-artifacts';

const appRoot = resolve(import.meta.dir, '../..');
const manifestPath = join(appRoot, 'scripts/desktop/windows-artifacts.manifest.json');

function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

test('pins the three Windows command artifacts to immutable HTTPS releases', () => {
  const manifest = readWindowsArtifactManifest(manifestPath);
  expect(manifest.schema).toBe('studyforge.windows-artifacts.v1');
  expect(manifest.artifacts.map(({ id, version, sha256 }) => ({ id, version, sha256 })))
    .toEqual([
      {
        id: 'portable-git',
        version: '2.55.0.4',
        sha256: '016e84230a3767f0c6b3788e79ba0c58a17377086801719d46700fca4f7b36b5',
      },
      {
        id: 'ripgrep',
        version: '15.2.0',
        sha256: '71b2fef860abe467217a538ff31de02f5258807c0129f771846f87bd029aafc5',
      },
      {
        id: 'fd',
        version: '10.4.2',
        sha256: 'b2816e506390a89941c63c9187d58a3cc10e9a55f2ef0685f9ea0eccaf7c98c8',
      },
    ]);
  for (const artifact of manifest.artifacts) {
    expect(artifact.url).toStartWith('https://github.com/');
    expect(artifact.url).not.toContain('/latest/');
    expect(artifact.archive.length).toBeGreaterThan(10);
    expect(artifact.license.length).toBeGreaterThan(3);
  }
});

test('rejects mutable, duplicate, or malformed Windows artifact manifests', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-artifact-manifest-'));
  const path = join(root, 'manifest.json');
  const base = JSON.parse(readFileSync(manifestPath, 'utf8'));
  try {
    writeFileSync(path, JSON.stringify({ ...base, schema: 'unknown' }));
    expect(() => readWindowsArtifactManifest(path)).toThrow('STUDYFORGE_WINDOWS_ARTIFACT_MANIFEST_INVALID');
    writeFileSync(path, JSON.stringify({
      ...base,
      artifacts: [base.artifacts[0], base.artifacts[0]],
    }));
    expect(() => readWindowsArtifactManifest(path)).toThrow('STUDYFORGE_WINDOWS_ARTIFACT_MANIFEST_INVALID');
    writeFileSync(path, JSON.stringify({
      ...base,
      artifacts: [{ ...base.artifacts[0], url: 'https://example.com/releases/latest/tool.exe' }],
    }));
    expect(() => readWindowsArtifactManifest(path)).toThrow('STUDYFORGE_WINDOWS_ARTIFACT_MANIFEST_INVALID');
    writeFileSync(path, JSON.stringify({
      ...base,
      artifacts: [{ ...base.artifacts[0], sha256: 'abcd' }],
    }));
    expect(() => readWindowsArtifactManifest(path)).toThrow('STUDYFORGE_WINDOWS_ARTIFACT_MANIFEST_INVALID');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('verifies downloaded bytes before staging them', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-artifact-digest-'));
  const path = join(root, 'archive');
  writeFileSync(path, 'verified archive');
  try {
    expect(verifyArtifactDigest(path, sha256('verified archive'))).toBeUndefined();
    expect(() => verifyArtifactDigest(path, '0'.repeat(64)))
      .toThrow('STUDYFORGE_WINDOWS_ARTIFACT_DIGEST_MISMATCH');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('stages a complete deterministic Windows payload through injected archive operations', async () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-artifact-stage-'));
  const testApp = join(root, 'app');
  const manifest = {
    schema: 'studyforge.windows-artifacts.v1',
    artifacts: [
      {
        id: 'portable-git', version: '1', archive: 'portable.exe',
        url: 'https://github.com/example/releases/download/v1/portable.exe',
        sha256: sha256('portable'), license: 'GPL-2.0-only', kind: 'portable-git-sfx',
      },
      {
        id: 'ripgrep', version: '1', archive: 'rg.zip',
        url: 'https://github.com/example/releases/download/v1/rg.zip',
        sha256: sha256('rg'), license: 'MIT', kind: 'zip-binary', binary: 'rg.exe',
      },
      {
        id: 'fd', version: '1', archive: 'fd.zip',
        url: 'https://github.com/example/releases/download/v1/fd.zip',
        sha256: sha256('fd'), license: 'MIT', kind: 'zip-binary', binary: 'fd.exe',
      },
    ],
  };
  const testManifest = join(root, 'manifest.json');
  mkdirSync(testApp, { recursive: true });
  writeFileSync(testManifest, JSON.stringify(manifest));

  try {
    const staged = await prepareWindowsArtifacts(testApp, {
      manifestPath: testManifest,
      download: async (artifact, destination) => writeFileSync(destination, artifact.id === 'portable-git' ? 'portable' : artifact.id === 'ripgrep' ? 'rg' : 'fd'),
      extractPortableGit: async (_archive, destination) => {
        mkdirSync(join(destination, 'bin'), { recursive: true });
        writeFileSync(join(destination, 'bin/bash.exe'), 'bash');
      },
      extractZip: async (_archive, destination, artifact) => {
        const nested = join(destination, artifact.id);
        mkdirSync(nested, { recursive: true });
        writeFileSync(join(nested, artifact.binary!), artifact.id);
      },
    });
    expect(readFileSync(join(staged, 'portable-git/bin/bash.exe'), 'utf8')).toBe('bash');
    expect(readFileSync(join(staged, 'tools/rg.exe'), 'utf8')).toBe('ripgrep');
    expect(readFileSync(join(staged, 'tools/fd.exe'), 'utf8')).toBe('fd');
    expect(JSON.parse(readFileSync(join(staged, 'ARTIFACTS.json'), 'utf8')).schema)
      .toBe('studyforge.windows-artifacts.v1');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
