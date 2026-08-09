import { expect, test } from 'bun:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  formatReadyReceipt,
  parseReadyReceipt,
  parseRuntimeArguments,
  startStudyForgeServer,
} from '../../src/server/start-server';

test('formats one secret-free machine-readable ready receipt', () => {
  const line = formatReadyReceipt({ port: 43121, workspace: 'setup' });
  expect(line).toBe(
    '{"type":"studyforge-ready","protocol":1,"port":43121,"workspace":"setup"}',
  );
  expect(parseReadyReceipt(line)).toEqual({
    type: 'studyforge-ready',
    protocol: 1,
    port: 43121,
    workspace: 'setup',
  });
  expect(line).not.toContain('launch-token');
  expect(() => parseReadyReceipt('StudyForge M1: http://127.0.0.1:43121'))
    .toThrow('STUDYFORGE_READY_RECEIPT_INVALID');
});

test('parses desktop runtime arguments without inferring private directories', () => {
  expect(parseRuntimeArguments([
    '--port', '0',
    '--app-home', '/private/StudyForge',
    '--documents-home', '/Users/student/Documents/StudyForge',
    '--resource-root', '/Applications/StudyForge.app/Contents/Resources/studyforge',
    '--token', 'launch-token',
  ])).toEqual({
    port: 0,
    appHome: '/private/StudyForge',
    documentsHome: '/Users/student/Documents/StudyForge',
    resourceRoot: '/Applications/StudyForge.app/Contents/Resources/studyforge',
    token: 'launch-token',
    learningSet: null,
    desktop: true,
  });
});

test('serves authenticated setup health with the exact Tauri origin', async () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-runtime-protocol-'));
  const started = await startStudyForgeServer({
    port: 0,
    appHome: join(root, 'Application Support', 'StudyForge'),
    documentsHome: join(root, 'Documents', 'StudyForge'),
    resourceRoot: resolve(import.meta.dir, '../../resources'),
    token: 'launch-token',
    learningSet: null,
    desktop: true,
  });
  try {
    const response = await fetch(`http://127.0.0.1:${started.receipt.port}/api/health`, {
      headers: {
        authorization: 'Bearer launch-token',
        origin: 'tauri://localhost',
      },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('access-control-allow-origin')).toBe('tauri://localhost');
  } finally {
    started.stop();
    rmSync(root, { recursive: true, force: true });
  }
});
