import {
  existsSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { basename, join, resolve } from 'node:path';

async function command(
  program: string,
  args: string[],
  options: {
    env?: Record<string, string | undefined>;
    output?: 'combined' | 'stdout';
  } = {},
): Promise<string> {
  const child = Bun.spawn([program, ...args], {
    stdout: 'pipe',
    stderr: 'pipe',
    ...(options.env ? { env: options.env } : {}),
  });
  const [stdout, stderr, code] = await Promise.all([
    new Response(child.stdout).text(),
    new Response(child.stderr).text(),
    child.exited,
  ]);
  if (code !== 0) throw new Error(`${program} ${args.join(' ')}\n${stderr || stdout}`);
  return (options.output === 'stdout' ? stdout : `${stdout}${stderr}`).trim();
}

function newestDmg(directory: string): string {
  const candidates = readdirSync(directory)
    .filter((name) => name.endsWith('.dmg'))
    .map((name) => join(directory, name))
    .sort((a, b) => statSync(b).mtimeMs - statSync(a).mtimeMs);
  if (!candidates[0]) throw new Error('STUDYFORGE_DMG_NOT_FOUND');
  return candidates[0];
}

function requireFiles(root: string, paths: string[]): void {
  for (const path of paths) {
    if (!existsSync(join(root, path))) throw new Error(`STUDYFORGE_BUNDLE_FILE_MISSING: ${path}`);
  }
}

export function isPrivateLive2DArtifactPath(path: string): boolean {
  const normalized = `/${path.replaceAll('\\', '/').toLowerCase()}`;
  return normalized.includes('/peer-axia/live2d/')
    || normalized.endsWith('/peer-axia/live2d')
    || /\.(?:moc3|cmo3|psd)$/.test(normalized)
    || /\.(?:physics3|exp3)\.json$/.test(normalized)
    || normalized.endsWith('/live2dcubismcore.min.js');
}

function findPrivateLive2DArtifact(root: string, relative = ''): string | null {
  const directory = join(root, relative);
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const child = relative ? `${relative}/${entry.name}` : entry.name;
    if (isPrivateLive2DArtifactPath(child)) return child;
    if (entry.isDirectory()) {
      const nested = findPrivateLive2DArtifact(root, child);
      if (nested) return nested;
    }
  }
  return null;
}

async function requireArm64(path: string): Promise<void> {
  const description = await command('/usr/bin/file', [path]);
  if (!description.includes('arm64')) throw new Error(`STUDYFORGE_NOT_ARM64: ${description}`);
}

async function requireSystemLibrariesOnly(path: string): Promise<void> {
  const libraries = (await command('/usr/bin/otool', ['-L', path]))
    .split('\n')
    .slice(1)
    .map((line) => line.trim().split(' ')[0])
    .filter(Boolean);
  const external = libraries.filter((library) => (
    !library!.startsWith('/usr/lib/') && !library!.startsWith('/System/Library/')
  ));
  if (external.length > 0) throw new Error(`STUDYFORGE_EXTERNAL_LIBRARY: ${external.join(', ')}`);
}

async function requireEntitlement(path: string, entitlement: string): Promise<void> {
  const value = await command('/usr/bin/codesign', ['-d', '--entitlements', ':-', path]);
  if (!value.includes(entitlement) || !value.includes('<true/>')) {
    throw new Error(`STUDYFORGE_ENTITLEMENT_MISSING: ${entitlement}`);
  }
}

async function requireRuntimeSelfTest(app: string): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-bundle-runtime-'));
  const resourceRoot = join(app, 'Contents/Resources/studyforge');
  const runtime = join(app, 'Contents/MacOS/studyforge-runtime');
  try {
    const output = await command(runtime, [
      '--runtime-self-test',
      '--resource-root', resourceRoot,
    ], {
      env: {
        ...process.env,
        PI_CODING_AGENT_DIR: join(root, 'agent'),
        PI_CODING_AGENT_SESSION_DIR: join(root, 'agent/sessions'),
        PI_PACKAGE_DIR: join(resourceRoot, 'pi-runtime'),
        PI_SUBAGENT_PI_BINARY: join(app, 'Contents/MacOS/studyforge-pi'),
        PI_SUBAGENT_PROMPT_RUNTIME_EXTENSION_PATH: join(
          resourceRoot,
          'pi-subagents/subagent-prompt-runtime.js',
        ),
        STUDYFORGE_RESOURCE_ROOT: resourceRoot,
      },
      output: 'stdout',
    });
    const receipt = JSON.parse(output) as { pdfImport?: string };
    if (receipt.pdfImport !== 'passed') throw new Error('STUDYFORGE_RUNTIME_SELF_TEST_FAILED');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

export async function verifyBundle(appRoot = resolve(import.meta.dir, '../..')): Promise<void> {
  const dmg = newestDmg(join(appRoot, 'src-tauri/target/release/bundle/dmg'));
  const mount = mkdtempSync(join(tmpdir(), 'studyforge-dmg-'));
  try {
    await command('/usr/bin/hdiutil', ['attach', '-nobrowse', '-readonly', '-mountpoint', mount, dmg]);
    const app = join(mount, 'StudyForge.app');
    const privateLive2DArtifact = findPrivateLive2DArtifact(app);
    if (privateLive2DArtifact) {
      throw new Error(`STUDYFORGE_PRIVATE_LIVE2D_ARTIFACT: ${privateLive2DArtifact}`);
    }
    requireFiles(app, [
      'Contents/MacOS/studyforge-desktop',
      'Contents/MacOS/studyforge-runtime',
      'Contents/MacOS/studyforge-pi',
      'Contents/Resources/studyforge/agents/roadmap-node.md',
      'Contents/Resources/studyforge/subagents/study-material-scout.md',
      'Contents/Resources/studyforge/workers/study-material-vision-reader.md',
      'Contents/Resources/studyforge/peers/axia.md',
      'Contents/Resources/studyforge/help/first-learning.md',
      'Contents/Resources/studyforge/help/feature-guide.md',
      'Contents/Resources/studyforge/help/macos-installation.md',
      'Contents/Resources/studyforge/templates/blank-learning-set/LEARNING_GUIDE.md',
      'Contents/Resources/studyforge/examples/derivative-m0/learning-set/LEARNING_GUIDE.md',
      'Contents/Resources/studyforge/pi-runtime/package.json',
      'Contents/Resources/studyforge/pi-runtime/theme/dark.json',
      'Contents/Resources/studyforge/pi-subagents/subagent-prompt-runtime.js',
    ]);

    const executables = [
      join(app, 'Contents/MacOS/studyforge-desktop'),
      join(app, 'Contents/MacOS/studyforge-runtime'),
      join(app, 'Contents/MacOS/studyforge-pi'),
    ];
    for (const executable of executables) await requireArm64(executable);
    for (const sidecar of executables.slice(1)) await requireSystemLibrariesOnly(sidecar);
    await requireEntitlement(
      executables[1]!,
      'com.apple.security.cs.disable-library-validation',
    );
    await command('/usr/bin/codesign', ['--verify', '--deep', '--strict', app]);
    const identity = await command('/usr/bin/codesign', ['-dv', '--verbose=4', app]);
    if (!identity.includes('Signature=adhoc')) throw new Error('STUDYFORGE_SIGNATURE_NOT_ADHOC');
    await requireRuntimeSelfTest(app);

    console.log(JSON.stringify({
      dmg: basename(dmg),
      app: 'StudyForge.app',
      architecture: 'arm64',
      sidecars: ['studyforge-runtime', 'studyforge-pi'],
      signature: 'adhoc-valid',
      resources: 'present',
    }));
  } finally {
    await command('/usr/bin/hdiutil', ['detach', mount]).catch(() => undefined);
    rmSync(mount, { recursive: true, force: true });
  }
}

if (import.meta.main) await verifyBundle();
