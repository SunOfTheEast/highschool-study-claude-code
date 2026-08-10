import { expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { registerStudyForgeBunRuntime } from '../../src/runtime/bun-runtime';
import { loadPdfJs } from '../../src/study/pdf-runtime';

const appRoot = resolve(import.meta.dir, '../..');

test('registers the statically bundled Bedrock implementation for Bun entrypoints', () => {
  expect(registerStudyForgeBunRuntime()).toEqual({ bedrock: 'registered' });
});

test('loads PDF.js with a pure JavaScript DOMMatrix and worker implementation', async () => {
  const pdf = await loadPdfJs();
  const runtime = globalThis as typeof globalThis & {
    pdfjsWorker?: { WorkerMessageHandler?: unknown };
  };

  expect(typeof pdf.getDocument).toBe('function');
  expect(typeof runtime.DOMMatrix).toBe('function');
  expect(runtime.pdfjsWorker?.WorkerMessageHandler).toBeDefined();
});

test('does not probe git when the bundled subagent watchdog is disabled', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-watchdog-off-'));
  const bin = join(root, 'bin');
  const sentinel = join(root, 'git-called');
  mkdirSync(bin);
  writeFileSync(join(bin, 'git'), '#!/bin/sh\nprintf called > "$WATCHDOG_SENTINEL"\nexit 1\n');
  chmodSync(join(bin, 'git'), 0o755);

  try {
    const script = `
      const { MainWatchdogRuntime } = await import('./node_modules/pi-subagents/src/watchdog/runtime.ts');
      const { DEFAULT_WATCHDOG_CONFIG } = await import('./node_modules/pi-subagents/src/watchdog/settings.ts');
      const runtime = new MainWatchdogRuntime({
        cwd: ${JSON.stringify(root)},
        reviewChangesOnly: true,
        resolveConfig: () => ({ ok: true, config: DEFAULT_WATCHDOG_CONFIG, errors: [], sources: [] }),
      });
      runtime.dispose();
    `;
    const result = Bun.spawnSync([process.execPath, '-e', script], {
      cwd: appRoot,
      env: { ...process.env, PATH: bin, WATCHDOG_SENTINEL: sentinel },
      stdout: 'pipe',
      stderr: 'pipe',
    });

    expect(result.exitCode).toBe(0);
    expect(existsSync(sentinel)).toBe(false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
