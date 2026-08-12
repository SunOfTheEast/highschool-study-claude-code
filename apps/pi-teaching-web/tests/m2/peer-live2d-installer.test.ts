import { expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  installPeerLive2D,
  peerSkinStatus,
  sharedLive2DCorePath,
} from '../../src/desktop/peer-live2d-installer';
import { readPeerLive2DManifest } from '../../src/desktop/peer-live2d-package';

const png = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X8ioWQAAAABJRU5ErkJggg==',
  'base64',
);

function writeJson(path: string, value: unknown): void {
  writeFileSync(path, `${JSON.stringify(value)}\n`);
}

function skinFixture(root: string, marker = 'first'): string {
  const source = join(root, `skin-${marker}`);
  mkdirSync(join(source, 'textures'), { recursive: true });
  writeJson(join(source, 'skin.vtube.json'), {
    FileReferences: { Model: 'skin.model3.json', IdleAnimation: 'idle.motion3.json' },
    Hotkeys: [
      { Name: '', Action: 'ToggleExpression', File: 'neutral.exp3.json', Triggers: { Trigger1: 'X' } },
      { Name: 'lianhong', Action: 'ToggleExpression', File: 'curious.exp3.json' },
      { Name: 'shengqi', Action: 'ToggleExpression', File: 'skeptical.exp3.json' },
    ],
  });
  writeJson(join(source, 'skin.model3.json'), {
    Version: 3,
    FileReferences: {
      Moc: 'skin.moc3',
      Textures: ['textures/texture.png'],
      Physics: 'skin.physics3.json',
      DisplayInfo: 'skin.cdi3.json',
    },
    Groups: [],
  });
  writeFileSync(join(source, 'skin.moc3'), marker);
  writeFileSync(join(source, 'textures/texture.png'), png);
  writeJson(join(source, 'skin.physics3.json'), { Version: 3, Meta: {}, PhysicsSettings: [] });
  writeJson(join(source, 'skin.cdi3.json'), {
    Version: 3,
    Parameters: [{ Id: 'ParamMouthOpenY', GroupId: '', Name: '嘴巴开合' }],
  });
  writeJson(join(source, 'idle.motion3.json'), { Version: 3, Meta: {}, Curves: [] });
  writeJson(join(source, 'neutral.exp3.json'), {
    Type: 'Live2D Expression', Parameters: [{ Id: 'ParamVisibility', Value: 30 }],
  });
  writeJson(join(source, 'curious.exp3.json'), {
    Type: 'Live2D Expression', Parameters: [{ Id: 'ParamEmotion', Value: 1 }],
  });
  writeJson(join(source, 'skeptical.exp3.json'), {
    Type: 'Live2D Expression', Parameters: [{ Id: 'ParamEmotion', Value: -1 }],
  });
  return source;
}

function workspace(): { root: string; appHome: string; core: string } {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-peer-skin-'));
  const core = join(root, 'live2dcubismcore.min.js');
  writeFileSync(core, 'globalThis.Live2DCubismCore = {};\n');
  return { root, appHome: join(root, 'app-home'), core };
}

test('installs the first skin and a separately selected Core into a clean App Home', () => {
  const fixture = workspace();
  try {
    expect(peerSkinStatus(fixture.appHome)).toEqual({ state: 'missing', coreInstalled: false });

    const result = installPeerLive2D({
      appHome: fixture.appHome,
      source: skinFixture(fixture.root),
      core: fixture.core,
    });

    expect(result.status).toEqual({ state: 'installed', coreInstalled: true });
    expect(peerSkinStatus(fixture.appHome)).toEqual(result.status);
    expect(existsSync(sharedLive2DCorePath(fixture.appHome))).toBe(true);
    expect(readPeerLive2DManifest(result.installed)).not.toBeNull();
  } finally {
    rmSync(fixture.root, { recursive: true });
  }
});
test('reuses the shared Core and keeps the current skin when a later source is invalid', () => {
  const fixture = workspace();
  try {
    const first = installPeerLive2D({
      appHome: fixture.appHome,
      source: skinFixture(fixture.root, 'first'),
      core: fixture.core,
    });
    const firstMoc = join(first.installed, 'runtime/axia.moc3');
    expect(readFileSync(firstMoc, 'utf8')).toBe('first');

    installPeerLive2D({
      appHome: fixture.appHome,
      source: skinFixture(fixture.root, 'second'),
    });
    expect(readFileSync(firstMoc, 'utf8')).toBe('second');

    const invalid = join(fixture.root, 'invalid');
    mkdirSync(invalid);
    expect(() => installPeerLive2D({ appHome: fixture.appHome, source: invalid }))
      .toThrow('LIVE2D_SOURCE_INCOMPLETE');
    expect(readFileSync(firstMoc, 'utf8')).toBe('second');
  } finally {
    rmSync(fixture.root, { recursive: true });
  }
});
