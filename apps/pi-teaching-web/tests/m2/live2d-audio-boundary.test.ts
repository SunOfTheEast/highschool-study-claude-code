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
