import { afterEach, expect, test } from 'bun:test';
import {
  closeSync,
  existsSync,
  ftruncateSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
  writeSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { importMaterial, readMaterial } from '../../src/study/materials';

const roots: string[] = [];

function temporary(prefix: string): string {
  const value = mkdtempSync(join(tmpdir(), prefix));
  roots.push(value);
  return value;
}

function blankRoot(): string {
  const root = temporary('studyforge-path-import-root-');
  writeFileSync(join(root, 'LEARNING_GUIDE.md'), '# Test\n');
  mkdirSync(join(root, 'memory'), { recursive: true });
  writeFileSync(join(root, 'memory/INDEX.md'), '# Teacher Memory Index\n');
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('copies and hashes a desktop PDF larger than the browser limit without eager extraction', async () => {
  const root = blankRoot();
  const sourceDirectory = temporary('studyforge-path-import-source-');
  const source = join(sourceDirectory, 'chemistry.pdf');
  const descriptor = openSync(source, 'w');
  writeSync(descriptor, '%PDF-1.7\n');
  ftruncateSync(descriptor, 33 * 1024 * 1024 + 17);
  closeSync(descriptor);

  const receipt = await importMaterial(root, {
    requestId: 'request-large-pdf',
    title: '化学反应原理',
    filename: 'chemistry.pdf',
    mediaType: 'application/pdf',
    source: { kind: 'path', absolutePath: source },
  }, '2026-08-12T20:00:00.000Z');

  expect(receipt).toMatchObject({
    id: 'material-001',
    revision: 1,
    searchStatus: 'unavailable',
  });
  const original = join(root, receipt.originalPath);
  expect(statSync(original).size).toBe(33 * 1024 * 1024 + 17);
  expect(readFileSync(original).subarray(0, 8).toString()).toBe('%PDF-1.7');
  expect(readMaterial(root, receipt.id).revisions[0]?.sha256).toMatch(/^[a-f0-9]{64}$/);
  expect(existsSync(join(root, 'materials/material-001/projections/1'))).toBeFalse();

  rmSync(source);
  expect(statSync(original).size).toBe(33 * 1024 * 1024 + 17);
});

test('rejects a symbolic-link source before creating a material revision', async () => {
  const root = blankRoot();
  const sourceDirectory = temporary('studyforge-path-import-source-');
  const target = join(sourceDirectory, 'real.pdf');
  const link = join(sourceDirectory, 'linked.pdf');
  writeFileSync(target, '%PDF-1.7\n');
  symlinkSync(target, link);

  await expect(importMaterial(root, {
    requestId: 'request-linked-pdf',
    title: '链接资料',
    filename: 'linked.pdf',
    mediaType: 'application/pdf',
    source: { kind: 'path', absolutePath: link },
  }, '2026-08-12T20:00:00.000Z')).rejects.toThrow('MATERIAL_SOURCE_INVALID');
  expect(existsSync(join(root, 'materials/material-001/manifest.yaml'))).toBeFalse();
  expect(existsSync(join(root, 'materials/material-001/revisions/1'))).toBeFalse();
});
