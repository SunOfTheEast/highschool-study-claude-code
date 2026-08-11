import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { deliverFocusAlert } from '../../src/client/focus-alert';

const appRoot = join(import.meta.dir, '../..');

test('notification failure never prevents the local focus alert', async () => {
  const calls: string[] = [];
  const delivered = await deliverFocusAlert({
    play: () => { calls.push('play'); },
    notify: async () => { calls.push('notify'); throw new Error('permission denied'); },
  }, {
    title: 'StudyForge',
    body: '25 分钟计时已到',
  });

  expect(calls).toEqual(['play', 'notify']);
  expect(delivered).toBeFalse();
});

test('desktop shell declares single-instance and notification support', () => {
  const cargo = readFileSync(join(appRoot, 'src-tauri/Cargo.toml'), 'utf8');
  const rust = readFileSync(join(appRoot, 'src-tauri/src/lib.rs'), 'utf8');
  const capability = readFileSync(
    join(appRoot, 'src-tauri/capabilities/default.json'),
    'utf8',
  );

  expect(cargo).toContain('tauri-plugin-single-instance');
  expect(cargo).toContain('tauri-plugin-notification');
  expect(rust).toContain('tauri_plugin_single_instance::init');
  expect(rust).toContain('show_studyforge_notification');
  expect(capability).toContain('notification:default');
});
