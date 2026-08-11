import { afterEach, expect, test } from 'bun:test';
import { api } from '../../src/client/api';
import { configureTransport, resetTransport } from '../../src/client/transport';
import type { PeerLive2DManifest } from '../../src/shared/contracts';

const originalFetch = globalThis.fetch;

type Live2DApi = {
  peerLive2DManifest(actorId: 'peer-axia'): Promise<PeerLive2DManifest | null>;
  peerLive2DFile(
    actorId: 'peer-axia',
    relativePath: string,
    signal?: AbortSignal,
  ): Promise<Blob | null>;
};

afterEach(() => {
  globalThis.fetch = originalFetch;
  resetTransport();
});

test('loads optional Live2D files only through authenticated desktop requests', async () => {
  configureTransport({ apiBase: 'http://127.0.0.1:43121', token: 'launch-token' });
  const requests: Array<{ input: string; init: Parameters<typeof fetch>[1] }> = [];
  const manifest: PeerLive2DManifest = {
    version: 1,
    modelFile: 'runtime/axia.model3.json',
    coreFile: 'runtime/live2dcubismcore.min.js',
    modelFiles: ['runtime/axia.model3.json', 'runtime/axia.moc3'],
  };
  globalThis.fetch = (async (input, init) => {
    requests.push({ input: String(input), init });
    return String(input).endsWith('/manifest')
      ? Response.json(manifest)
      : new Response(new Uint8Array([77, 79, 67, 51]), {
        headers: { 'content-type': 'application/octet-stream' },
      });
  }) as typeof fetch;
  const live2d = api as typeof api & Live2DApi;
  const controller = new AbortController();

  expect(await live2d.peerLive2DManifest('peer-axia')).toEqual(manifest);
  const file = await live2d.peerLive2DFile(
    'peer-axia',
    'runtime/expressions/curious.exp3.json',
    controller.signal,
  );
  expect(new Uint8Array(await file!.arrayBuffer())).toEqual(new Uint8Array([77, 79, 67, 51]));
  expect(requests.map((request) => request.input)).toEqual([
    'http://127.0.0.1:43121/api/desktop/actors/peer-axia/live2d/manifest',
    'http://127.0.0.1:43121/api/desktop/actors/peer-axia/live2d/file?path=runtime%2Fexpressions%2Fcurious.exp3.json',
  ]);
  expect(requests.every((request) => (
    new Headers(request.init?.headers).get('authorization') === 'Bearer launch-token'
  ))).toBe(true);
  expect(requests[1]?.init?.signal).toBe(controller.signal);
});

test('treats an unavailable optional Live2D package as a quiet null', async () => {
  globalThis.fetch = (async () => (
    Response.json({ error: 'NOT_FOUND' }, { status: 404 })
  )) as unknown as typeof fetch;
  const live2d = api as typeof api & Live2DApi;

  expect(await live2d.peerLive2DManifest('peer-axia')).toBeNull();
  expect(await live2d.peerLive2DFile('peer-axia', 'runtime/axia.moc3')).toBeNull();
});
