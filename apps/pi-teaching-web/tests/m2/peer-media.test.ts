import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createPeerMediaService } from '../../src/desktop/peer-media';

const roots: string[] = [];

const live2dManifest = {
  version: 1,
  modelFile: 'runtime/axia.model3.json',
  coreFile: 'runtime/live2dcubismcore.min.js',
  modelFiles: [
    'runtime/axia.model3.json',
    'runtime/axia.moc3',
    'runtime/axia.physics3.json',
    'runtime/expressions/neutral.exp3.json',
    'runtime/expressions/curious.exp3.json',
    'runtime/expressions/skeptical.exp3.json',
    'runtime/textures/texture_00.png',
  ],
} as const;

type Live2DMedia = {
  live2dManifest(actorId: string): Response;
  live2dFile(actorId: string, relativePath: string): Response;
};

function actorsDir(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-peer-media-'));
  roots.push(root);
  const actors = join(root, 'actors');
  mkdirSync(join(actors, 'peer-axia'), { recursive: true });
  writeFileSync(join(actors, 'peer-axia', 'neutral.png'), new Uint8Array([1, 2, 3]));
  return actors;
}

function writeLive2DPackage(
  actors: string,
  manifest: Record<string, unknown> = live2dManifest,
  omit: string[] = [],
): void {
  const root = join(actors, 'peer-axia', 'live2d');
  mkdirSync(root, { recursive: true });
  writeFileSync(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  const files = new Map<string, Uint8Array | string>([
    ['runtime/live2dcubismcore.min.js', 'window.Live2DCubismCore = {};'],
    ['runtime/axia.model3.json', '{"Version":3}'],
    ['runtime/axia.moc3', new Uint8Array([77, 79, 67, 51])],
    ['runtime/axia.physics3.json', '{}'],
    ['runtime/expressions/neutral.exp3.json', '{}'],
    ['runtime/expressions/curious.exp3.json', '{}'],
    ['runtime/expressions/skeptical.exp3.json', '{}'],
    ['runtime/textures/texture_00.png', new Uint8Array([137, 80, 78, 71])],
  ]);
  for (const [relativePath, content] of files) {
    if (omit.includes(relativePath)) continue;
    const path = join(root, relativePath);
    mkdirSync(join(path, '..'), { recursive: true });
    writeFileSync(path, content);
  }
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

test('serves one complete Live2D package only through its manifest allowlist', async () => {
  const actors = actorsDir();
  writeLive2DPackage(actors);
  const service = createPeerMediaService({ actorsDir: actors }) as ReturnType<
    typeof createPeerMediaService
  > & Live2DMedia;

  const manifest = service.live2dManifest('peer-axia');
  expect(manifest.status).toBe(200);
  expect(manifest.headers.get('cache-control')).toBe('no-store');
  expect(await manifest.json()).toEqual(live2dManifest);

  const core = service.live2dFile('peer-axia', live2dManifest.coreFile);
  expect(core.status).toBe(200);
  expect(core.headers.get('content-type')).toContain('text/javascript');
  expect(await core.text()).toContain('Live2DCubismCore');

  const moc = service.live2dFile('peer-axia', 'runtime/axia.moc3');
  expect(moc.status).toBe(200);
  expect(moc.headers.get('content-type')).toBe('application/octet-stream');
  expect(new Uint8Array(await moc.arrayBuffer())).toEqual(new Uint8Array([77, 79, 67, 51]));

  for (const [actorId, path] of [
    ['peer-other', 'runtime/axia.moc3'],
    ['peer-axia', '../voice.mp3'],
    ['peer-axia', 'source/axia.cmo3'],
    ['peer-axia', 'runtime/not-declared.png'],
  ]) {
    expect(service.live2dFile(actorId!, path!).status).toBe(404);
  }
});

test('makes the whole Live2D package unavailable when its manifest is not exact', () => {
  const cases: Array<{
    name: string;
    manifest: Record<string, unknown>;
    omit?: string[];
  }> = [
    {
      name: 'missing declared model file',
      manifest: live2dManifest,
      omit: ['runtime/axia.moc3'],
    },
    {
      name: 'missing core',
      manifest: live2dManifest,
      omit: ['runtime/live2dcubismcore.min.js'],
    },
    {
      name: 'duplicate model file',
      manifest: {
        ...live2dManifest,
        modelFiles: [...live2dManifest.modelFiles, 'runtime/axia.moc3'],
      },
    },
    {
      name: 'absolute path',
      manifest: { ...live2dManifest, coreFile: '/tmp/live2dcubismcore.min.js' },
    },
    {
      name: 'parent traversal',
      manifest: { ...live2dManifest, coreFile: '../live2dcubismcore.min.js' },
    },
    {
      name: 'wrong version',
      manifest: { ...live2dManifest, version: 2 },
    },
    {
      name: 'model absent from package list',
      manifest: {
        ...live2dManifest,
        modelFiles: live2dManifest.modelFiles.filter((path) => path !== live2dManifest.modelFile),
      },
    },
  ];

  for (const fixture of cases) {
    const actors = actorsDir();
    writeLive2DPackage(actors, fixture.manifest, fixture.omit);
    const service = createPeerMediaService({ actorsDir: actors }) as ReturnType<
      typeof createPeerMediaService
    > & Live2DMedia;
    expect(service.live2dManifest('peer-axia').status, fixture.name).toBe(404);
    expect(service.live2dFile('peer-axia', 'runtime/axia.moc3').status, fixture.name).toBe(404);
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
