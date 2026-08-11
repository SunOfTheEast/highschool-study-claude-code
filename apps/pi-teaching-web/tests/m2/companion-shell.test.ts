import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const appRoot = join(import.meta.dir, '../..');

test('declares one app-scoped companion beside the existing main window', () => {
  const config = JSON.parse(
    readFileSync(join(appRoot, 'src-tauri/tauri.conf.json'), 'utf8'),
  ) as {
    app: {
      macOSPrivateApi?: boolean;
      windows: Array<Record<string, unknown>>;
    };
  };
  const capability = JSON.parse(
    readFileSync(join(appRoot, 'src-tauri/capabilities/default.json'), 'utf8'),
  ) as { windows: string[]; permissions: string[] };

  expect(config.app.macOSPrivateApi).toBe(true);
  expect(config.app.windows.map((window) => window.label)).toEqual(['main', 'companion']);
  expect(config.app.windows[1]).toMatchObject({
    label: 'companion',
    url: '/?window=companion',
    width: 340,
    height: 560,
    transparent: true,
    decorations: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    shadow: false,
    resizable: false,
  });
  expect(capability.windows).toEqual(['main', 'companion']);

  for (const permission of [
    'core:window:allow-available-monitors',
    'core:window:allow-cursor-position',
    'core:window:allow-inner-position',
    'core:window:allow-primary-monitor',
    'core:window:allow-scale-factor',
    'core:window:allow-set-ignore-cursor-events',
    'core:window:allow-set-position',
    'core:window:allow-start-dragging',
    'core:window:allow-show',
    'core:window:allow-hide',
    'core:window:allow-set-focus',
  ]) {
    expect(capability.permissions).toContain(permission);
  }
});
