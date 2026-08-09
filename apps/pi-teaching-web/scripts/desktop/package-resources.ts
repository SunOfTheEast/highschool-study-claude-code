import { cpSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve } from 'node:path';

export function resourceLayout(appRoot: string) {
  const stagingRoot = join(appRoot, 'src-tauri/resources/studyforge');
  return {
    appRoot,
    stagingRoot,
    teachingSource: join(appRoot, 'resources'),
    exampleSource: join(appRoot, '../../examples/derivative-m0'),
    piSource: join(appRoot, 'node_modules/@earendil-works/pi-coding-agent'),
    piRuntimeRoot: join(stagingRoot, 'pi-runtime'),
  };
}

export function packageResources(appRoot = resolve(import.meta.dir, '../..')): void {
  const layout = resourceLayout(appRoot);
  rmSync(layout.stagingRoot, { recursive: true, force: true });
  mkdirSync(layout.stagingRoot, { recursive: true });
  cpSync(layout.teachingSource, layout.stagingRoot, { recursive: true });
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
}

if (import.meta.main) packageResources();
