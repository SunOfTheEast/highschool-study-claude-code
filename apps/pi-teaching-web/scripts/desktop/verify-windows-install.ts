import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, win32 } from 'node:path';
import { isPrivateLive2DArtifactPath } from './verify-bundle';

export const requiredWindowsInstallFiles = [
  'studyforge-desktop.exe',
  'studyforge-runtime.exe',
  'studyforge-pi.exe',
  'studyforge/agents/roadmap-node.md',
  'studyforge/subagents/study-material-scout.md',
  'studyforge/workers/study-material-vision-reader.md',
  'studyforge/peers/axia.md',
  'studyforge/help/first-learning.md',
  'studyforge/help/feature-guide.md',
  'studyforge/help/macos-installation.md',
  'studyforge/help/windows-installation.md',
  'studyforge/templates/blank-learning-set/LEARNING_GUIDE.md',
  'studyforge/examples/derivative-m0/learning-set/LEARNING_GUIDE.md',
  'studyforge/pi-runtime/package.json',
  'studyforge/pi-runtime/theme/dark.json',
  'studyforge/pi-subagents/subagent-prompt-runtime.js',
  'studyforge/platform/windows/portable-git/bin/bash.exe',
  'studyforge/platform/windows/tools/rg.exe',
  'studyforge/platform/windows/tools/fd.exe',
  'studyforge/platform/windows/canvas/skia.win32-x64-msvc.node',
  'studyforge/platform/windows/canvas/icudtl.dat',
  'studyforge/platform/windows/ARTIFACTS.json',
  'studyforge/platform/windows/THIRD_PARTY_NOTICES.md',
] as const;

export function windowsInstallLayout(root: string) {
  const resourceRoot = win32.join(root, 'studyforge');
  return {
    root,
    app: win32.join(root, 'studyforge-desktop.exe'),
    runtime: win32.join(root, 'studyforge-runtime.exe'),
    pi: win32.join(root, 'studyforge-pi.exe'),
    resourceRoot,
    bash: win32.join(resourceRoot, 'platform/windows/portable-git/bin/bash.exe'),
    rg: win32.join(resourceRoot, 'platform/windows/tools/rg.exe'),
    fd: win32.join(resourceRoot, 'platform/windows/tools/fd.exe'),
    canvasNative: win32.join(
      resourceRoot,
      'platform/windows/canvas/skia.win32-x64-msvc.node',
    ),
    canvasIcu: win32.join(resourceRoot, 'platform/windows/canvas/icudtl.dat'),
  };
}

async function command(
  program: string,
  args: string[],
  environment: Record<string, string | undefined> = process.env,
): Promise<string> {
  const child = Bun.spawn([program, ...args], {
    env: environment,
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`STUDYFORGE_WINDOWS_COMMAND_FAILED: ${stderr || stdout}`);
  return `${stdout}${stderr}`.trim();
}

function findPrivateArtifact(root: string, relative = ''): string | null {
  const directory = join(root, relative);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (isPrivateLive2DArtifactPath(child)) return child;
    if (entry.isDirectory()) {
      const nested = findPrivateArtifact(root, child);
      if (nested) return nested;
    }
  }
  return null;
}

function requireInstalledFiles(root: string): void {
  for (const relative of requiredWindowsInstallFiles) {
    if (!existsSync(win32.join(root, relative))) {
      throw new Error(`STUDYFORGE_WINDOWS_BUNDLE_FILE_MISSING: ${relative}`);
    }
  }
}

function privateRuntimeEnvironment(
  root: string,
  layout: ReturnType<typeof windowsInstallLayout>,
): Record<string, string | undefined> {
  const agent = win32.join(root, 'app/agent');
  return {
    ...process.env,
    PATH: '',
    USERPROFILE: win32.join(root, 'home'),
    LOCALAPPDATA: win32.join(root, 'home/AppData/Local'),
    APPDATA: win32.join(root, 'home/AppData/Roaming'),
    TEMP: win32.join(root, 'tmp'),
    TMP: win32.join(root, 'tmp'),
    PI_CODING_AGENT_DIR: agent,
    PI_CODING_AGENT_SESSION_DIR: win32.join(agent, 'sessions'),
    PI_PACKAGE_DIR: win32.join(layout.resourceRoot, 'pi-runtime'),
    PI_SUBAGENT_PI_BINARY: layout.pi,
    PI_SUBAGENT_PROMPT_RUNTIME_EXTENSION_PATH: win32.join(
      layout.resourceRoot,
      'pi-subagents/subagent-prompt-runtime.js',
    ),
    STUDYFORGE_RESOURCE_ROOT: layout.resourceRoot,
    STUDYFORGE_PACKAGED_BASH: layout.bash,
    STUDYFORGE_PACKAGED_RG: layout.rg,
    STUDYFORGE_PACKAGED_FD: layout.fd,
    NAPI_RS_NATIVE_LIBRARY_PATH: layout.canvasNative,
  };
}

async function firstLine(stream: ReadableStream<Uint8Array>): Promise<string> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let value = '';
  for (;;) {
    const next = await reader.read();
    if (next.done) throw new Error('STUDYFORGE_WINDOWS_READY_RECEIPT_MISSING');
    value += decoder.decode(next.value, { stream: true });
    const newline = value.indexOf('\n');
    if (newline >= 0) return value.slice(0, newline).trim();
  }
}

async function requireRuntimeStartup(
  layout: ReturnType<typeof windowsInstallLayout>,
  environment: Record<string, string | undefined>,
): Promise<void> {
  const token = 'windows-installed-runtime-smoke';
  const child = Bun.spawn([
    layout.runtime,
    '--port', '0',
    '--app-home', environment.LOCALAPPDATA!,
    '--documents-home', win32.join(environment.USERPROFILE!, 'Documents/StudyForge'),
    '--resource-root', layout.resourceRoot,
    '--token', token,
  ], { env: environment, stdout: 'pipe', stderr: 'pipe' });
  try {
    const line = await Promise.race([
      firstLine(child.stdout),
      Bun.sleep(30_000).then(() => {
        throw new Error('STUDYFORGE_WINDOWS_RUNTIME_START_TIMEOUT');
      }),
    ]);
    const receipt = JSON.parse(line) as { type?: string; protocol?: number; port?: number };
    if (receipt.type !== 'studyforge-ready' || receipt.protocol !== 1 || !receipt.port) {
      throw new Error('STUDYFORGE_WINDOWS_READY_RECEIPT_INVALID');
    }
    const status = await fetch(`http://127.0.0.1:${receipt.port}/api/desktop/status`, {
      headers: { authorization: `Bearer ${token}` },
    });
    if (!status.ok) throw new Error('STUDYFORGE_WINDOWS_RUNTIME_STATUS_FAILED');
    await fetch(`http://127.0.0.1:${receipt.port}/api/desktop/shutdown`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}` },
    });
    if (await child.exited !== 0) throw new Error('STUDYFORGE_WINDOWS_RUNTIME_SHUTDOWN_FAILED');
  } finally {
    child.kill();
  }
}

export async function verifyWindowsInstall(root: string): Promise<void> {
  if (process.platform !== 'win32') throw new Error('STUDYFORGE_WINDOWS_HOST_REQUIRED');
  const layout = windowsInstallLayout(root);
  requireInstalledFiles(root);
  const privateArtifact = findPrivateArtifact(root);
  if (privateArtifact) throw new Error(`STUDYFORGE_PRIVATE_LIVE2D_ARTIFACT: ${privateArtifact}`);
  const artifacts = JSON.parse(readFileSync(
    win32.join(layout.resourceRoot, 'platform/windows/ARTIFACTS.json'),
    'utf8',
  )) as { schema?: string };
  if (artifacts.schema !== 'studyforge.windows-artifacts.v1') {
    throw new Error('STUDYFORGE_WINDOWS_ARTIFACT_MANIFEST_INVALID');
  }

  const temporaryRoot = mkdtempSync(join(tmpdir(), 'studyforge-windows-installed-'));
  try {
    const environment = privateRuntimeEnvironment(temporaryRoot, layout);
    const selfTest = JSON.parse(await command(layout.runtime, [
      '--runtime-self-test',
      '--resource-root', layout.resourceRoot,
    ], environment)) as Record<string, string>;
    for (const check of ['planSubagent', 'subagentChildRuntime', 'pdfImport', 'bedrock']) {
      if (selfTest[check] !== 'passed') {
        throw new Error(`STUDYFORGE_WINDOWS_RUNTIME_SELF_TEST_FAILED: ${check}`);
      }
    }
    if (!(await command(layout.pi, ['--version'], environment)).includes('0.81.0')) {
      throw new Error('STUDYFORGE_WINDOWS_PI_VERSION_INVALID');
    }
    if (!(await command(layout.bash, ['--version'])).includes('GNU bash')) {
      throw new Error('STUDYFORGE_WINDOWS_BASH_INVALID');
    }
    if (!(await command(layout.rg, ['--version'])).includes('ripgrep 15.2.0')) {
      throw new Error('STUDYFORGE_WINDOWS_RG_INVALID');
    }
    if (!(await command(layout.fd, ['--version'])).includes('fd 10.4.2')) {
      throw new Error('STUDYFORGE_WINDOWS_FD_INVALID');
    }
    await requireRuntimeStartup(layout, environment);
  } finally {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }

  console.log(JSON.stringify({
    platform: 'windows-x64',
    installRoot: root,
    runtime: 'passed',
    pi: 'passed',
    privateBash: 'passed',
    searchTools: 'passed',
    resources: 'present',
  }));
}

if (import.meta.main) {
  const root = process.argv.slice(2).find((argument) => argument !== '--');
  if (!root) throw new Error('STUDYFORGE_WINDOWS_INSTALL_ROOT_REQUIRED');
  await verifyWindowsInstall(root);
}
