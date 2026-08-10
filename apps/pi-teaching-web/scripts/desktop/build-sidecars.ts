import { chmodSync, mkdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { resourceLayout } from './package-resources';

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

export const subagentRuntimeExternalModules = [
  '@earendil-works/pi-agent-core',
  '@earendil-works/pi-ai/compat',
  '@earendil-works/pi-coding-agent',
  'typebox',
  'typebox/compile',
];

async function bundle(
  appRoot: string,
  entry: string,
  output: string,
  externalModules: string[] = [],
): Promise<void> {
  mkdirSync(dirname(output), { recursive: true });
  const child = Bun.spawn([
    process.execPath,
    'build',
    '--target=bun',
    ...externalModules.flatMap((module) => ['--external', module]),
    entry,
    '--outfile',
    output,
  ], { cwd: appRoot, stdout: 'inherit', stderr: 'inherit' });
  if (await child.exited !== 0) throw new Error(`SIDECAR_RESOURCE_BUILD_FAILED: ${output}`);
}

export async function buildSidecars(appRoot = resolve(import.meta.dir, '../..')): Promise<void> {
  const output = sidecarOutputs(appRoot);
  const resources = resourceLayout(appRoot);
  mkdirSync(join(appRoot, 'src-tauri/binaries'), { recursive: true });
  await bundle(
    appRoot,
    'node_modules/pi-subagents/src/runs/shared/subagent-prompt-runtime.ts',
    resources.subagentPromptRuntime,
    subagentRuntimeExternalModules,
  );
  await compile(appRoot, ['src/server/index.ts'], output.runtime);
  await compile(appRoot, [
    'src/desktop/pi-cli.ts',
    'node_modules/@earendil-works/pi-coding-agent/dist/utils/image-resize-worker.js',
  ], output.pi);
}

if (import.meta.main) await buildSidecars();
