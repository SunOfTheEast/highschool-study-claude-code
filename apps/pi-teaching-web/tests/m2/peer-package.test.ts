import { expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { isPrivateLive2DArtifactPath } from '../../scripts/desktop/verify-bundle';

const appRoot = join(import.meta.dir, '../..');

function files(root: string): string[] {
  return readdirSync(root).flatMap((name) => {
    const path = join(root, name);
    if (statSync(path).isDirectory()) {
      return ['node_modules', 'target', 'dist'].includes(name) ? [] : files(path);
    }
    return [path];
  });
}

test('packages only the public Axia persona, never private embodiment assets', () => {
  const peerRoot = join(appRoot, 'resources/peers');
  expect(readdirSync(peerRoot).sort()).toEqual(['axia.md']);
  const persona = readFileSync(join(peerRoot, 'axia.md'), 'utf8');
  expect(persona).toContain('# 阿夏');
  expect(persona).not.toContain('阿澄');

  const resourceFiles = files(join(appRoot, 'resources'));
  const privateMedia = resourceFiles.filter((path) => (
    /(?:actors|voices|models)[/\\]/i.test(path)
    || /\.(?:safetensors|gguf|ckpt|wav|m4a|mp4)$/i.test(path)
  ));
  expect(privateMedia).toEqual([]);
  expect(resourceFiles.some((path) => /voice\.(?:mp3|wav)$/i.test(path))).toBe(false);

  const verifier = readFileSync(join(appRoot, 'scripts/desktop/verify-bundle.ts'), 'utf8');
  expect(verifier).toContain('Contents/Resources/studyforge/peers/axia.md');
  expect(verifier).not.toContain('acheng.md');

  expect(files(join(appRoot, 'scripts')).filter((path) => /(?:mlx|local-peer-voice)/i.test(path))).toEqual([]);
  const packageJson = readFileSync(join(appRoot, 'package.json'), 'utf8');
  expect(packageJson).not.toContain('peer:voice:install');
  expect(packageJson).not.toContain('peer:voice:run');
  expect(packageJson).toContain('"desktop:peer-live2d"');
});

test('keeps private source paths out of the tracked application surface', () => {
  const listed = Bun.spawnSync(['git', '-C', appRoot, 'ls-files', '-z', '.']);
  expect(listed.exitCode).toBe(0);
  const trackedText = new TextDecoder().decode(listed.stdout)
    .split('\0')
    .filter((path) => /\.(?:ts|tsx|md|json|toml|rs|sh|ya?ml|css|html)$/i.test(path))
    .map((path) => readFileSync(join(appRoot, path), 'utf8'))
    .join('\n');
  const privateWechatPath = ['/Library/Containers/', 'com.tencent.xinWeChat/'].join('');
  const privateActorPath = ['/StudyForge/actors/', 'peer-axia/neutral.png'].join('');
  expect(trackedText).not.toContain(privateWechatPath);
  expect(trackedText).not.toContain(privateActorPath);
});

test('allows the packaged WebView to play the private speech blob', () => {
  const config = JSON.parse(
    readFileSync(join(appRoot, 'src-tauri/tauri.conf.json'), 'utf8'),
  ) as { app: { security: { csp: string } } };
  expect(config.app.security.csp).toContain("media-src 'self' blob:");
});

test('permits only the local Core blob and rejects private Live2D files from a release', () => {
  const config = JSON.parse(
    readFileSync(join(appRoot, 'src-tauri/tauri.conf.json'), 'utf8'),
  ) as { app: { security: { csp: string } } };
  expect(config.app.security.csp).toContain("script-src 'self' blob:");
  expect(config.app.security.csp).not.toContain('unsafe-eval');

  for (const path of [
    'Contents/Resources/axia.moc3',
    'Contents/Resources/source/axia.cmo3',
    'Contents/Resources/source/axia-master.psd',
    'Contents/Resources/runtime/axia.physics3.json',
    'Contents/Resources/runtime/curious.exp3.json',
    'Contents/Resources/runtime/live2dcubismcore.min.js',
    'Contents/Resources/actors/peer-axia/live2d/manifest.json',
  ]) {
    expect(isPrivateLive2DArtifactPath(path), path).toBe(true);
  }
  expect(isPrivateLive2DArtifactPath('Contents/Resources/studyforge/peers/axia.md')).toBe(false);
});
