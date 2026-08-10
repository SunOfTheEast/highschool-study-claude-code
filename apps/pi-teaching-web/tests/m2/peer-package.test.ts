import { expect, test } from 'bun:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

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
