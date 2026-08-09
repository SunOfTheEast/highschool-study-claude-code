import { chmodSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

export const targetTriple = 'aarch64-apple-darwin';
const bunTarget = 'bun-darwin-arm64';

export function sidecarOutputs(appRoot: string) {
  const root = join(appRoot, 'src-tauri/binaries');
  return {
    runtime: join(root, `studyforge-runtime-${targetTriple}`),
    pi: join(root, `studyforge-pi-${targetTriple}`),
  };
}

async function compile(appRoot: string, entries: string[], output: string): Promise<void> {
  const child = Bun.spawn([
    process.execPath,
    'build',
    '--compile',
    `--target=${bunTarget}`,
    ...entries,
    '--outfile',
    output,
  ], { cwd: appRoot, stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error(`SIDECAR_BUILD_FAILED: ${output}`);
  chmodSync(output, 0o755);
}

export async function buildSidecars(appRoot = resolve(import.meta.dir, '../..')): Promise<void> {
  const output = sidecarOutputs(appRoot);
  mkdirSync(join(appRoot, 'src-tauri/binaries'), { recursive: true });
  await compile(appRoot, ['src/server/index.ts'], output.runtime);
  await compile(appRoot, [
    'src/desktop/pi-cli.ts',
    'node_modules/@earendil-works/pi-coding-agent/dist/utils/image-resize-worker.js',
  ], output.pi);
}

if (import.meta.main) await buildSidecars();
