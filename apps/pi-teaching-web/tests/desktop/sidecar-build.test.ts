import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  sidecarOutputs,
  subagentRuntimeExternalModules,
} from '../../scripts/desktop/build-sidecars';
import {
  packagePlatformResources,
  resourceLayout,
} from '../../scripts/desktop/package-resources';
import { sidecarSmokeEnvironment } from '../../scripts/desktop/smoke-sidecars';
import {
  desktopTargets,
  executableName,
  resolveDesktopTarget,
} from '../../scripts/desktop/platform';

const appRoot = join(import.meta.dir, '../..');

test('maps the supported desktop release targets without guessing', () => {
  expect(desktopTargets['aarch64-apple-darwin']).toEqual({
    triple: 'aarch64-apple-darwin',
    bunTarget: 'bun-darwin-arm64',
    executableSuffix: '',
    bundleKind: 'dmg',
  });
  expect(desktopTargets['x86_64-pc-windows-msvc']).toEqual({
    triple: 'x86_64-pc-windows-msvc',
    bunTarget: 'bun-windows-x64-baseline',
    executableSuffix: '.exe',
    bundleKind: 'nsis',
  });
  expect(resolveDesktopTarget({}, 'darwin', 'arm64'))
    .toBe(desktopTargets['aarch64-apple-darwin']);
  expect(resolveDesktopTarget({}, 'win32', 'x64'))
    .toBe(desktopTargets['x86_64-pc-windows-msvc']);
  expect(() => resolveDesktopTarget({
    STUDYFORGE_DESKTOP_TARGET: 'aarch64-unknown-windows-msvc',
  }, 'win32', 'arm64')).toThrow('STUDYFORGE_DESKTOP_TARGET_UNSUPPORTED');
  expect(executableName('studyforge-pi', desktopTargets['x86_64-pc-windows-msvc']))
    .toBe('studyforge-pi.exe');
});

test('uses the target-suffixed sidecars expected by Tauri on both release platforms', () => {
  expect(sidecarOutputs(appRoot, desktopTargets['aarch64-apple-darwin'])).toEqual({
    runtime: join(appRoot, 'src-tauri/binaries/studyforge-runtime-aarch64-apple-darwin'),
    pi: join(appRoot, 'src-tauri/binaries/studyforge-pi-aarch64-apple-darwin'),
  });
  expect(sidecarOutputs(appRoot, desktopTargets['x86_64-pc-windows-msvc'])).toEqual({
    runtime: join(
      appRoot,
      'src-tauri/binaries/studyforge-runtime-x86_64-pc-windows-msvc.exe',
    ),
    pi: join(appRoot, 'src-tauri/binaries/studyforge-pi-x86_64-pc-windows-msvc.exe'),
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
  expect(layout.windowsPlatformSource).toBe(join(
    appRoot,
    'src-tauri/generated/platform/windows',
  ));
  expect(layout.windowsPlatformRuntime).toBe(join(
    layout.stagingRoot,
    'platform/windows',
  ));
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

test('adds the private command payload only to Windows resource bundles', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-platform-resources-'));
  const generated = join(root, 'src-tauri/generated/platform/windows');
  try {
    mkdirSync(join(root, 'resources/platform/windows'), { recursive: true });
    writeFileSync(join(
      root,
      'resources/platform/windows/THIRD_PARTY_NOTICES.md',
    ), 'notices');
    mkdirSync(join(generated, 'portable-git/bin'), { recursive: true });
    mkdirSync(join(generated, 'tools'), { recursive: true });
    writeFileSync(join(generated, 'portable-git/bin/bash.exe'), 'bash');
    writeFileSync(join(generated, 'tools/rg.exe'), 'rg');

    expect(packagePlatformResources(
      root,
      desktopTargets['aarch64-apple-darwin'],
    )).toBe(false);
    expect(existsSync(join(
      root,
      'src-tauri/resources/studyforge/platform/windows/portable-git/bin/bash.exe',
    ))).toBe(false);

    expect(packagePlatformResources(
      root,
      desktopTargets['x86_64-pc-windows-msvc'],
    )).toBe(true);
    expect(readFileSync(join(
      root,
      'src-tauri/resources/studyforge/platform/windows/portable-git/bin/bash.exe',
    ), 'utf8')).toBe('bash');
    expect(readFileSync(join(
      root,
      'src-tauri/resources/studyforge/platform/windows/tools/rg.exe',
    ), 'utf8')).toBe('rg');
    expect(readFileSync(join(
      root,
      'src-tauri/resources/studyforge/platform/windows/THIRD_PARTY_NOTICES.md',
    ), 'utf8')).toBe('notices');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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

test('gives sidecar smoke explicit private homes on Windows without inheriting PATH', () => {
  const root = join(appRoot, 'tmp/student name');
  const resources = resourceLayout(appRoot);
  const environment = sidecarSmokeEnvironment(root, resources, 'win32', {
    SystemRoot: 'C:\\Windows',
    ComSpec: 'C:\\Windows\\System32\\cmd.exe',
    PATH: 'C:\\host-tools',
  });

  expect(environment).toMatchObject({
    SystemRoot: 'C:\\Windows',
    ComSpec: 'C:\\Windows\\System32\\cmd.exe',
    PATH: '',
    USERPROFILE: join(root, 'home'),
    LOCALAPPDATA: join(root, 'home/AppData/Local'),
    APPDATA: join(root, 'home/AppData/Roaming'),
    TEMP: join(root, 'tmp'),
    TMP: join(root, 'tmp'),
    PI_CODING_AGENT_DIR: join(root, 'app/agent'),
    PI_PACKAGE_DIR: resources.piRuntimeRoot,
  });
  expect(environment.HOME).toBeUndefined();
  expect(environment.TMPDIR).toBeUndefined();
});
