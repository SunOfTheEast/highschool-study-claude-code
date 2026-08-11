import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appRoot = join(import.meta.dir, '../..');

test('keeps the existing TTS player as the only Live2D audio path', () => {
  const vite = readFileSync(join(appRoot, 'vite.config.ts'), 'utf8');
  const renderer = readFileSync(join(appRoot, 'src/client/live2d/pixi-renderer.ts'), 'utf8');
  const noSound = readFileSync(join(appRoot, 'src/client/live2d/no-sound.ts'), 'utf8');

  expect(vite).toContain("'@pixi/sound'");
  expect(vite).toContain("./src/client/live2d/no-sound.ts");
  expect(renderer).toContain('config.sound = false');
  expect(noSound).toContain('export const sound = null');
});

test('pins the texture parser when private textures become blob URLs', () => {
  const packageJson = JSON.parse(readFileSync(join(appRoot, 'package.json'), 'utf8')) as {
    patchedDependencies?: Record<string, string>;
  };
  const patchPath = packageJson.patchedDependencies?.['untitled-pixi-live2d-engine@1.3.5'];

  expect(patchPath).toBe('patches/untitled-pixi-live2d-engine@1.3.5.patch');
  const patch = readFileSync(join(appRoot, patchPath!), 'utf8');
  expect(patch).toContain('parser: "texture"');
});

test('accepts the Cubism 6 draw-order name exported by Editor 5.3', () => {
  const patch = readFileSync(
    join(appRoot, 'patches/untitled-pixi-live2d-engine@1.3.5.patch'),
    'utf8',
  );

  expect(patch).toContain('renderOrders ?? this._model.drawables.drawOrders');
});
