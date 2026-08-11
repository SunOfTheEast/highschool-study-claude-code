import { expect, test } from 'bun:test';
import {
  loadPeerLive2DPackage,
  type PeerLive2DPackageApi,
} from '../../src/client/live2d/private-package';
import type { PeerLive2DManifest } from '../../src/shared/contracts';

const manifest: PeerLive2DManifest = {
  version: 1,
  modelFile: 'runtime/axia.model3.json',
  coreFile: 'runtime/live2dcubismcore.min.js',
  modelFiles: [
    'runtime/axia.model3.json',
    'runtime/axia.moc3',
    'runtime/expressions/curious.exp3.json',
    'runtime/textures/texture_00.png',
  ],
};

function packageApi(
  file: PeerLive2DPackageApi['peerLive2DFile'] = async (_actorId, path) => (
    path === manifest.coreFile
      ? new Blob(['globalThis.Live2DCubismCore = {};'], { type: 'text/javascript' })
      : new Blob([`bytes:${path}`], { type: path.endsWith('.png') ? 'image/png' : 'application/octet-stream' })
  ),
): PeerLive2DPackageApi {
  return {
    peerLive2DManifest: async () => manifest,
    peerLive2DFile: file,
  };
}

test('reconstructs the authenticated Cubism package as browser Files', async () => {
  const result = await loadPeerLive2DPackage('peer-axia', undefined, packageApi());

  expect(result?.manifest).toEqual(manifest);
  expect(result?.coreSource).toContain('Live2DCubismCore');
  expect(result?.modelFiles.map((file) => file.name)).toEqual([
    'axia.model3.json',
    'axia.moc3',
    'curious.exp3.json',
    'texture_00.png',
  ]);
  expect(result?.modelFiles.map((file) => file.webkitRelativePath)).toEqual(manifest.modelFiles);
});

test('returns null when any declared file is unavailable without creating object URLs', async () => {
  let createdObjectUrls = 0;
  const originalCreateObjectURL = URL.createObjectURL;
  URL.createObjectURL = (() => {
    createdObjectUrls += 1;
    return 'blob:unexpected';
  }) as typeof URL.createObjectURL;

  try {
    const result = await loadPeerLive2DPackage(
      'peer-axia',
      undefined,
      packageApi(async (_actorId, path) => (
        path === 'runtime/axia.moc3' ? null : new Blob([path])
      )),
    );

    expect(result).toBeNull();
    expect(createdObjectUrls).toBe(0);
  } finally {
    URL.createObjectURL = originalCreateObjectURL;
  }
});

test('returns null for an empty Core source or an aborted load', async () => {
  const emptyCore = await loadPeerLive2DPackage(
    'peer-axia',
    undefined,
    packageApi(async (_actorId, path) => (
      path === manifest.coreFile ? new Blob(['  ']) : new Blob([path])
    )),
  );
  expect(emptyCore).toBeNull();

  const controller = new AbortController();
  controller.abort();
  const aborted = await loadPeerLive2DPackage(
    'peer-axia',
    controller.signal,
    packageApi(async () => {
      throw new DOMException('Aborted', 'AbortError');
    }),
  );
  expect(aborted).toBeNull();
});
