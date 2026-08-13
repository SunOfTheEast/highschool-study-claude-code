import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { type DesktopTarget, resolveDesktopTarget } from './platform';

export function resourceLayout(appRoot: string) {
  const stagingRoot = join(appRoot, 'src-tauri/resources/studyforge');
  const subagentRuntimeRoot = join(stagingRoot, 'pi-subagents');
  return {
    appRoot,
    stagingRoot,
    teachingSource: join(appRoot, 'resources'),
    exampleSource: join(appRoot, '../../examples/derivative-m0'),
    piSource: join(appRoot, 'node_modules/@earendil-works/pi-coding-agent'),
    piRuntimeRoot: join(stagingRoot, 'pi-runtime'),
    subagentRuntimeRoot,
    subagentPromptRuntime: join(subagentRuntimeRoot, 'subagent-prompt-runtime.js'),
    windowsPlatformSource: join(appRoot, 'src-tauri/generated/platform/windows'),
    windowsPlatformRuntime: join(stagingRoot, 'platform/windows'),
    windowsCanvasSource: join(appRoot, 'node_modules/@napi-rs/canvas-win32-x64-msvc'),
    windowsCanvasRuntime: join(stagingRoot, 'platform/windows/canvas'),
  };
}

export function packagePlatformResources(
  appRoot: string,
  target: DesktopTarget,
): boolean {
  if (target.triple !== 'x86_64-pc-windows-msvc') return false;
  const layout = resourceLayout(appRoot);
  mkdirSync(layout.windowsPlatformRuntime, { recursive: true });
  cpSync(
    join(appRoot, 'resources/platform/windows'),
    layout.windowsPlatformRuntime,
    { recursive: true, force: true },
  );
  cpSync(layout.windowsPlatformSource, layout.windowsPlatformRuntime, {
    recursive: true,
    force: true,
  });
  mkdirSync(layout.windowsCanvasRuntime, { recursive: true });
  for (const name of ['skia.win32-x64-msvc.node', 'icudtl.dat']) {
    cpSync(
      join(layout.windowsCanvasSource, name),
      join(layout.windowsCanvasRuntime, name),
      { force: true },
    );
  }
  return true;
}

export function packageResources(
  appRoot = resolve(import.meta.dir, '../..'),
  target = resolveDesktopTarget(),
): void {
  const layout = resourceLayout(appRoot);
  rmSync(layout.stagingRoot, { recursive: true, force: true });
  mkdirSync(layout.stagingRoot, { recursive: true });
  cpSync(layout.teachingSource, layout.stagingRoot, { recursive: true });
  rmSync(layout.windowsPlatformRuntime, { recursive: true, force: true });
  cpSync(layout.exampleSource, join(layout.stagingRoot, 'examples/derivative-m0'), { recursive: true });

  mkdirSync(layout.piRuntimeRoot, { recursive: true });
  for (const name of ['package.json', 'README.md', 'CHANGELOG.md', 'docs', 'examples']) {
    cpSync(join(layout.piSource, name), join(layout.piRuntimeRoot, name), { recursive: true });
  }
  cpSync(
    join(layout.piSource, 'dist/modes/interactive/theme'),
    join(layout.piRuntimeRoot, 'theme'),
    { recursive: true },
  );
  cpSync(
    join(layout.piSource, 'dist/modes/interactive/assets'),
    join(layout.piRuntimeRoot, 'assets'),
    { recursive: true },
  );
  cpSync(
    join(layout.piSource, 'dist/core/export-html'),
    join(layout.piRuntimeRoot, 'export-html'),
    { recursive: true },
  );
  cpSync(
    join(appRoot, 'node_modules/@silvia-odwyer/photon-node/photon_rs_bg.wasm'),
    join(layout.piRuntimeRoot, 'photon_rs_bg.wasm'),
  );
  packagePlatformResources(appRoot, target);
}

if (import.meta.main) packageResources();
