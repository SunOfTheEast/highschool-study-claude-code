import { expect, test } from 'bun:test';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { registerStudyForgeBunRuntime } from '../../src/runtime/bun-runtime';
import {
  applyPackagedShellPath,
  packagedShellPath,
  prepareDesktopManagedTools,
} from '../../src/runtime/desktop-tools';
import {
  FREE_LEARNING_MODEL_TOOLS,
  LESSON_MODEL_TOOLS,
  M0_MODEL_TOOLS,
  META_MODEL_TOOLS,
  PLAN_MODEL_TOOLS,
} from '../../src/runtime/session-scope';
import { loadPdfJs } from '../../src/study/pdf-runtime';
import { SettingsManager } from '@earendil-works/pi-coding-agent';

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

test('seeds packaged Windows search tools into Pi managed bin without touching neighbours', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-packaged-tools-'));
  const packaged = join(root, 'packaged');
  const agentDir = join(root, 'student home', 'agent');
  mkdirSync(packaged, { recursive: true });
  const bash = join(packaged, 'bash.exe');
  const rg = join(packaged, 'rg.exe');
  const fd = join(packaged, 'fd.exe');
  writeFileSync(bash, 'bash-v1');
  writeFileSync(rg, 'rg-v1');
  writeFileSync(fd, 'fd-v1');

  const environment = {
    STUDYFORGE_PACKAGED_BASH: bash,
    STUDYFORGE_PACKAGED_RG: rg,
    STUDYFORGE_PACKAGED_FD: fd,
  };

  try {
    expect(prepareDesktopManagedTools(agentDir, environment)).toEqual({
      bash,
      rg: join(agentDir, 'bin', 'rg.exe'),
      fd: join(agentDir, 'bin', 'fd.exe'),
    });
    writeFileSync(join(agentDir, 'bin', 'student-owned.txt'), 'keep');
    writeFileSync(rg, 'rg-v2');
    expect(prepareDesktopManagedTools(agentDir, environment)).toEqual({
      bash,
      rg: join(agentDir, 'bin', 'rg.exe'),
      fd: join(agentDir, 'bin', 'fd.exe'),
    });
    expect(readFileSync(join(agentDir, 'bin', 'rg.exe'), 'utf8')).toBe('rg-v2');
    expect(readFileSync(join(agentDir, 'bin', 'fd.exe'), 'utf8')).toBe('fd-v1');
    expect(readFileSync(join(agentDir, 'bin', 'student-owned.txt'), 'utf8')).toBe('keep');
    expect(() => prepareDesktopManagedTools(agentDir, {
      ...environment,
      STUDYFORGE_PACKAGED_FD: join(packaged, 'missing-fd.exe'),
    })).toThrow('STUDYFORGE_PACKAGED_TOOL_MISSING');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('overlays packaged Bash in memory without rewriting Pi settings', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-packaged-shell-'));
  const agentDir = join(root, 'agent');
  const bash = join(root, 'portable git', 'bin', 'bash.exe');
  mkdirSync(join(root, 'portable git', 'bin'), { recursive: true });
  mkdirSync(agentDir, { recursive: true });
  writeFileSync(bash, 'bash');
  const settingsPath = join(agentDir, 'settings.json');
  writeFileSync(settingsPath, '{"defaultProvider":"openai-codex"}\n');

  try {
    const manager = SettingsManager.create(root, agentDir);
    expect(packagedShellPath({ STUDYFORGE_PACKAGED_BASH: bash })).toBe(bash);
    applyPackagedShellPath(manager, { STUDYFORGE_PACKAGED_BASH: bash });
    expect(manager.getShellPath()).toBe(bash);
    expect(readFileSync(settingsPath, 'utf8')).toBe('{"defaultProvider":"openai-codex"}\n');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('keeps Bash out of every StudyForge teaching role', () => {
  for (const tools of [
    M0_MODEL_TOOLS,
    PLAN_MODEL_TOOLS,
    LESSON_MODEL_TOOLS,
    FREE_LEARNING_MODEL_TOOLS,
    META_MODEL_TOOLS,
  ]) {
    expect(tools).not.toContain('bash');
  }
});
