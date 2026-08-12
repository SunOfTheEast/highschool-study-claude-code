import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  sidecarOutputs,
  subagentRuntimeExternalModules,
  targetTriple,
} from '../../scripts/desktop/build-sidecars';
import { resourceLayout } from '../../scripts/desktop/package-resources';

const appRoot = join(import.meta.dir, '../..');

test('uses the two target-suffixed Apple Silicon sidecars expected by Tauri', () => {
  expect(targetTriple).toBe('aarch64-apple-darwin');
  expect(sidecarOutputs(appRoot)).toEqual({
    runtime: join(appRoot, 'src-tauri/binaries/studyforge-runtime-aarch64-apple-darwin'),
    pi: join(appRoot, 'src-tauri/binaries/studyforge-pi-aarch64-apple-darwin'),
  });
  const config = JSON.parse(readFileSync(join(appRoot, 'src-tauri/tauri.conf.json'), 'utf8'));
  expect(config.mainBinaryName).toBe('studyforge-desktop');
  expect(config.bundle.externalBin).toEqual([
    'binaries/studyforge-runtime',
    'binaries/studyforge-pi',
  ]);
  expect(config.bundle.macOS.entitlements).toBe('entitlements.plist');
  expect(readFileSync(
    join(appRoot, 'src-tauri/entitlements.plist'),
    'utf8',
  )).toContain('com.apple.security.cs.disable-library-validation');
});

test('stages canonical teaching resources, example, and Pi runtime assets only', () => {
  const layout = resourceLayout(appRoot);
  expect(layout.stagingRoot).toBe(join(appRoot, 'src-tauri/resources/studyforge'));
  expect(layout.exampleSource).toBe(join(appRoot, '../../examples/derivative-m0'));
  expect(layout.piRuntimeRoot).toBe(join(layout.stagingRoot, 'pi-runtime'));
  expect(layout.subagentPromptRuntime).toBe(join(
    layout.stagingRoot,
    'pi-subagents/subagent-prompt-runtime.js',
  ));
  const config = JSON.parse(readFileSync(join(appRoot, 'src-tauri/tauri.conf.json'), 'utf8'));
  expect(config.bundle.resources).toEqual({
    'resources/studyforge/': 'studyforge/',
  });
  expect(existsSync(join(appRoot, 'resources/templates/blank-learning-set/LEARNING_GUIDE.md'))).toBe(true);
  expect(existsSync(join(
    appRoot,
    'resources/workers/study-material-vision-reader.md',
  ))).toBe(true);
});

test('keeps host-provided Pi modules external to the child prompt runtime bundle', () => {
  expect(subagentRuntimeExternalModules).toEqual([
    '@earendil-works/pi-agent-core',
    '@earendil-works/pi-ai/compat',
    '@earendil-works/pi-coding-agent',
    'typebox',
    'typebox/compile',
  ]);
});
