import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPeerMediaService } from '../../src/desktop/peer-media';

const roots: string[] = [];

function actorsDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-peer-media-'));
  roots.push(root);
  const actors = join(root, 'actors');
  mkdirSync(join(actors, 'peer-axia'), { recursive: true });
  writeFileSync(join(actors, 'peer-axia', 'neutral.png'), new Uint8Array([1, 2, 3]));
  return actors;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('serves only exact private actor slots', async () => {
  const service = createPeerMediaService({ actorsDir: actorsDir() });
  const found = service.portrait('peer-axia', 'neutral');
  expect(found.status).toBe(200);
  expect(found.headers.get('content-type')).toBe('image/png');
  expect(new Uint8Array(await found.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

  for (const [actorId, expression] of [
    ['peer-axia', 'curious'],
    ['peer-other', 'neutral'],
    ['../peer-axia', 'neutral'],
    ['peer-axia', '../neutral'],
    ['peer-axia', 'neutral.png'],
    ['peer-axia\n', 'neutral'],
  ]) {
    expect(service.portrait(actorId!, expression!).status).toBe(404);
  }
});

test('proxies one pinned localhost MLX speech request and returns only audio', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const service = createPeerMediaService({
    actorsDir: actorsDir(),
    speechEndpoint: 'http://127.0.0.1:8123/v1/audio/speech',
    fetch: async (input, init) => {
      calls.push({ url: String(input), init });
      return new Response(new Uint8Array([82, 73, 70, 70]), {
        headers: { 'content-type': 'audio/wav' },
      });
    },
  });

  const response = await service.speech('peer-axia', '先比较反应商。');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('audio/wav');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe('http://127.0.0.1:8123/v1/audio/speech');
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
    model: 'mlx-community/Qwen3-TTS-12Hz-0.6B-CustomVoice-8bit',
    input: '先比较反应商。',
    voice: 'vivian',
    response_format: 'wav',
  });
});

test('fails closed for remote endpoints, unknown actors, or provider bodies', async () => {
  expect(() => createPeerMediaService({
    actorsDir: actorsDir(),
    speechEndpoint: 'https://voice.example.test/v1/audio/speech',
  })).toThrow('PEER_SPEECH_ENDPOINT_INVALID');

  const service = createPeerMediaService({
    actorsDir: actorsDir(),
    fetch: async () => Response.json({ private: 'provider detail' }, { status: 500 }),
  });
  expect((await service.speech('peer-other', '你好')).status).toBe(400);
  const failed = await service.speech('peer-axia', '你好');
  expect(failed.status).toBe(503);
  expect(await failed.json()).toEqual({ error: 'PEER_SPEECH_UNAVAILABLE' });
});
