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

test('requests one pinned MiMo speech response and returns only decoded audio', async () => {
  const calls: Array<{ url: string; init: RequestInit | undefined }> = [];
  const service = createPeerMediaService({
    actorsDir: actorsDir(),
    resolveSpeechApiKey: async () => 'mimo-secret',
    fetch: async (input, init) => {
      calls.push({ url: String(input), init });
      return Response.json({
        choices: [{ message: { audio: { data: 'UklGRg==' } } }],
      });
    },
  });

  const response = await service.speech('peer-axia', '先比较反应商。');
  expect(response.status).toBe(200);
  expect(response.headers.get('content-type')).toBe('audio/wav');
  expect(calls).toHaveLength(1);
  expect(calls[0]?.url).toBe('https://api.xiaomimimo.com/v1/chat/completions');
  expect(new Headers(calls[0]?.init?.headers).get('api-key')).toBe('mimo-secret');
  expect(JSON.parse(String(calls[0]?.init?.body))).toEqual({
    model: 'mimo-v2.5-tts',
    messages: [
      {
        role: 'user',
        content: '年轻自然的中国女声，像熟悉的同班同学在认真交流；清晰、松弛，不过度表演。',
      },
      { role: 'assistant', content: '先比较反应商。' },
    ],
    audio: { format: 'wav', voice: '冰糖' },
  });
  expect(new Uint8Array(await response.arrayBuffer())).toEqual(new Uint8Array([82, 73, 70, 70]));
});

test('uses the fixed private voice slot when an authorized sample exists', async () => {
  const actors = actorsDir();
  writeFileSync(join(actors, 'peer-axia', 'voice.mp3'), new Uint8Array([1, 2, 3]));
  let requestBody = '';
  const service = createPeerMediaService({
    actorsDir: actors,
    resolveSpeechApiKey: async () => 'mimo-secret',
    fetch: async (_input, init) => {
      requestBody = String(init?.body);
      return Response.json({ choices: [{ message: { audio: { data: 'UklGRg==' } } }] });
    },
  });

  expect((await service.speech('peer-axia', '我先问一个小问题。')).status).toBe(200);
  const parsedRequestBody = JSON.parse(requestBody) as Record<string, unknown>;
  const messages = parsedRequestBody.messages as Array<{ role: string; content: string }> | undefined;
  expect(messages?.[0]?.content).toContain('声音甜软、明亮而亲近');
  expect(messages?.[0]?.content).toContain('不要纠正成标准普通话');
  expect(parsedRequestBody).toMatchObject({
    model: 'mimo-v2.5-tts-voiceclone',
    messages: [
      { role: 'user' },
      { role: 'assistant', content: '我先问一个小问题。' },
    ],
    audio: { format: 'wav', voice: 'data:audio/mpeg;base64,AQID' },
  });
});

test('fails closed for missing credentials, unknown actors, or provider bodies', async () => {
  let calls = 0;
  const service = createPeerMediaService({
    actorsDir: actorsDir(),
    resolveSpeechApiKey: async () => undefined,
    fetch: async () => {
      calls += 1;
      return Response.json({ private: 'provider detail' }, { status: 500 });
    },
  });
  expect((await service.speech('peer-other', '你好')).status).toBe(400);
  const missing = await service.speech('peer-axia', '你好');
  expect(missing.status).toBe(503);
  expect(calls).toBe(0);

  const failed = await createPeerMediaService({
    actorsDir: actorsDir(),
    resolveSpeechApiKey: async () => 'mimo-secret',
    fetch: async () => Response.json({ private: 'provider detail' }, { status: 500 }),
  }).speech('peer-axia', '你好');
  expect(failed.status).toBe(503);
  expect(await failed.json()).toEqual({ error: 'PEER_SPEECH_UNAVAILABLE' });
});
