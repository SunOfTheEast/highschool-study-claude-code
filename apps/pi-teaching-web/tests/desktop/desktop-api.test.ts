import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import type { AuthInteraction, AuthType } from '@earendil-works/pi-ai';
import { resolveStudyForgePaths } from '../../src/desktop/app-config';
import type { DesktopModelSelection } from '../../src/desktop/contracts';
import { createPeerMediaService } from '../../src/desktop/peer-media';
import { createDesktopRequestHandler } from '../../src/server/desktop-app';

const roots: string[] = [];

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function fakeModelService() {
  const available = new Set([
    'openai-codex/gpt-5.6-sol',
    'openai-codex/gpt-5.6-terra',
    'openai-codex/text-only',
  ]);
  return {
    catalog: async () => ({
      providers: [{
        id: 'openai-codex',
        name: 'OpenAI Codex',
        configured: true,
        authLabel: 'OAuth',
        loginMethods: [{ type: 'oauth' as const, label: '使用 ChatGPT 登录' }],
      }],
      models: [
        {
          provider: 'openai-codex',
          id: 'gpt-5.6-sol',
          name: 'GPT-5.6 Sol',
          thinkingLevels: ['off', 'high'] as const,
          input: ['text', 'image'] as const,
        },
        {
          provider: 'openai-codex',
          id: 'gpt-5.6-terra',
          name: 'GPT-5.6 Terra',
          thinkingLevels: ['off', 'high'] as const,
          input: ['text'] as const,
        },
        {
          provider: 'openai-codex',
          id: 'text-only',
          name: 'Text only',
          thinkingLevels: ['off', 'high'] as const,
          input: ['text'] as const,
        },
      ],
    }),
    resolve: async (selection: DesktopModelSelection) => {
      if (!available.has(`${selection.provider}/${selection.model}`)) {
        throw new Error(`STUDYFORGE_MODEL_UNAVAILABLE: ${selection.provider}/${selection.model}`);
      }
      return {
        id: selection.model,
        input: selection.model === 'text-only' ? ['text'] : ['text', 'image'],
      };
    },
    login: async (_provider: string, _type: AuthType, interaction: AuthInteraction) => {
      interaction.notify({ type: 'auth_url', url: 'https://example.test/oauth' });
      const code = await interaction.prompt({ type: 'manual_code', message: '输入授权码' });
      interaction.notify({ type: 'progress', message: `accepted:${code}` });
      return {};
    },
    logout: async () => {},
  };
}

function setup(options: { canChangeLearningSet?: () => boolean | Promise<boolean> } = {}) {
  const root = temporaryRoot('studyforge-desktop-api-');
  const paths = resolveStudyForgePaths({
    appHome: join(root, 'Application Support', 'StudyForge'),
    documentsHome: join(root, 'Documents', 'StudyForge'),
  });
  const handler = createDesktopRequestHandler({
    token: 'launch-token',
    paths,
    resourceRoot: resolve(import.meta.dir, '../../resources'),
    derivativeExampleRoot: resolve(import.meta.dir, '../../../../examples/derivative-m0/learning-set'),
    modelService: fakeModelService() as never,
    peerMedia: createPeerMediaService({
      actorsDir: paths.actorsDir,
      resolveSpeechApiKey: async () => 'mimo-secret',
      fetch: async () => Response.json({
        choices: [{ message: { audio: { data: 'UklGRg==' } } }],
      }),
    }),
    shutdown: () => {},
    ...(options.canChangeLearningSet
      ? { canChangeLearningSet: options.canChangeLearningSet }
      : {}),
  });
  const request = (pathname: string, init: RequestInit = {}) => handler(new Request(
    `http://127.0.0.1${pathname}`,
    {
      ...init,
      headers: {
        authorization: 'Bearer launch-token',
        ...(init.body === undefined ? {} : { 'content-type': 'application/json' }),
        ...Object.fromEntries(new Headers(init.headers)),
      },
    },
  ));
  return { root, paths, handler, request };
}

function writeLive2DPackage(actorsDir: string): void {
  const root = join(actorsDir, 'peer-axia', 'live2d');
  const manifest = {
    version: 1,
    modelFile: 'runtime/axia.model3.json',
    coreFile: 'runtime/live2dcubismcore.min.js',
    modelFiles: ['runtime/axia.model3.json', 'runtime/axia.moc3'],
  };
  mkdirSync(join(root, 'runtime'), { recursive: true });
  writeFileSync(join(root, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  writeFileSync(join(root, 'runtime/live2dcubismcore.min.js'), 'window.Live2DCubismCore = {};');
  writeFileSync(join(root, 'runtime/axia.model3.json'), '{"Version":3}');
  writeFileSync(join(root, 'runtime/axia.moc3'), new Uint8Array([77, 79, 67, 51]));
}

function writeImportableLive2DSource(root: string): { source: string; core: string } {
  const source = join(root, 'importable-live2d');
  mkdirSync(join(source, 'textures'), { recursive: true });
  const write = (name: string, value: unknown) => writeFileSync(
    join(source, name), `${JSON.stringify(value)}\n`,
  );
  write('skin.vtube.json', {
    FileReferences: { Model: 'skin.model3.json', IdleAnimation: 'idle.motion3.json' },
    Hotkeys: [
      { Name: '', Action: 'ToggleExpression', File: 'neutral.exp3.json', Triggers: { Trigger1: 'X' } },
      { Name: 'lianhong', Action: 'ToggleExpression', File: 'curious.exp3.json' },
      { Name: 'shengqi', Action: 'ToggleExpression', File: 'skeptical.exp3.json' },
    ],
  });
  write('skin.model3.json', {
    Version: 3,
    FileReferences: {
      Moc: 'skin.moc3', Textures: ['textures/texture.png'],
      Physics: 'skin.physics3.json', DisplayInfo: 'skin.cdi3.json',
    },
    Groups: [],
  });
  writeFileSync(join(source, 'skin.moc3'), 'moc');
  writeFileSync(join(source, 'textures/texture.png'), Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+X8ioWQAAAABJRU5ErkJggg==',
    'base64',
  ));
  write('skin.physics3.json', { Version: 3, Meta: {}, PhysicsSettings: [] });
  write('skin.cdi3.json', {
    Version: 3, Parameters: [{ Id: 'ParamMouthOpenY', GroupId: '', Name: '嘴巴开合' }],
  });
  write('idle.motion3.json', { Version: 3, Meta: {}, Curves: [] });
  write('neutral.exp3.json', { Type: 'Live2D Expression', Parameters: [] });
  write('curious.exp3.json', { Type: 'Live2D Expression', Parameters: [] });
  write('skeptical.exp3.json', { Type: 'Live2D Expression', Parameters: [] });
  const core = join(root, 'live2dcubismcore.min.js');
  writeFileSync(core, 'globalThis.Live2DCubismCore = {};\n');
  return { source, core };
}

test('protects every desktop and teaching route with the launch token', async () => {
  const { handler } = setup();
  const unauthorized = await handler(new Request('http://127.0.0.1/api/desktop/status'));
  expect(unauthorized?.status).toBe(401);
  expect(await unauthorized?.json()).toEqual({ error: 'DESKTOP_UNAUTHORIZED' });

  const websocket = await handler(new Request('http://127.0.0.1/events', {
    headers: { 'sec-websocket-protocol': 'studyforge, studyforge-token.launch-token' },
  }));
  expect(websocket).toBeNull();

  const preflight = await handler(new Request('http://127.0.0.1/api/desktop/status', {
    method: 'OPTIONS',
    headers: { origin: 'tauri://localhost' },
  }));
  expect(preflight?.status).toBe(204);
  expect(preflight?.headers.get('access-control-allow-origin')).toBe('tauri://localhost');
});

test('creates a blank set, persists explicit models and reports restart readiness', async () => {
  const { paths, request } = setup();
  const initial = await request('/api/desktop/status');
  expect(await initial?.json()).toMatchObject({
    state: 'needs-learning-set',
    onboardingComplete: false,
    currentLearningSet: null,
  });

  const created = await request('/api/desktop/learning-sets/blank', {
    method: 'POST',
    body: JSON.stringify({ name: '化学反应原理' }),
  });
  expect(created?.status).toBe(201);
  const createdBody = await created?.json() as { learningSet: string; restartRequired: boolean };
  expect(createdBody).toEqual({
    learningSet: join(paths.documentsHome, '化学反应原理', 'learning-set'),
    restartRequired: true,
  });

  const configured = await request('/api/desktop/models', {
    method: 'PUT',
    body: JSON.stringify({
      teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
      scout: { provider: 'openai-codex', model: 'gpt-5.6-terra', thinking: 'high' },
    }),
  });
  expect(configured?.status).toBe(200);
  expect(await configured?.json()).toEqual({ onboardingComplete: true, restartRequired: true });
  expect(JSON.parse(readFileSync(paths.appConfigPath, 'utf8'))).toMatchObject({
    onboardingComplete: true,
    currentLearningSet: createdBody.learningSet,
  });
  expect(JSON.parse(readFileSync(paths.settingsPath, 'utf8'))).toMatchObject({
    defaultProvider: 'openai-codex',
    defaultModel: 'gpt-5.6-sol',
  });
});

test('imports a selected desktop PDF path into only the configured learning set', async () => {
  const { root, paths, request } = setup();
  const created = await request('/api/desktop/learning-sets/blank', {
    method: 'POST',
    body: JSON.stringify({ name: '跟书学习' }),
  });
  const { learningSet } = await created?.json() as { learningSet: string };
  const source = join(root, 'outside-learning-set.pdf');
  writeFileSync(source, '%PDF-1.7\n');

  const response = await request('/api/desktop/materials/import-path', {
    method: 'POST',
    body: JSON.stringify({
      requestId: 'desktop-book-import-001',
      title: '化学反应原理',
      absolutePath: source,
    }),
  });

  expect(response?.status).toBe(201);
  expect(await response?.json()).toMatchObject({
    id: 'material-001', revision: 1, searchStatus: 'unavailable',
  });
  expect(readFileSync(join(learningSet, 'materials/material-001/revisions/1/original.pdf'), 'utf8'))
    .toBe('%PDF-1.7\n');
  expect(paths.documentsHome.startsWith(root)).toBeTrue();
  expect(existsSync(join(root, 'materials/material-001/manifest.yaml'))).toBeFalse();
});

test('keeps invalid learning sets and unavailable models as distinct failures', async () => {
  const { root, request } = setup();
  const notASet = join(root, 'not-a-set');
  mkdirSync(notASet);
  writeFileSync(join(notASet, 'random.txt'), 'not a learning set');

  const invalid = await request('/api/desktop/learning-sets/select', {
    method: 'POST',
    body: JSON.stringify({ path: notASet }),
  });
  expect(invalid?.status).toBe(422);
  expect(await invalid?.json()).toEqual({ error: 'LEARNING_SET_GUIDE_NOT_FOUND' });

  const unavailable = await request('/api/desktop/models', {
    method: 'PUT',
    body: JSON.stringify({
      teacher: { provider: 'openai-codex', model: 'missing', thinking: 'high' },
      scout: { provider: 'openai-codex', model: 'gpt-5.6-terra', thinking: 'high' },
    }),
  });
  expect(unavailable?.status).toBe(409);
  expect(await unavailable?.json()).toEqual({
    error: 'STUDYFORGE_MODEL_UNAVAILABLE',
    detail: 'openai-codex/missing',
  });
});

test('rejects an explicit text-only visual reader even when the model exists', async () => {
  const { request } = setup();
  const response = await request('/api/desktop/models', {
    method: 'PUT',
    body: JSON.stringify({
      teacher: { provider: 'openai-codex', model: 'gpt-5.6-sol', thinking: 'high' },
      scout: { provider: 'openai-codex', model: 'gpt-5.6-terra', thinking: 'high' },
      vision: {
        mode: 'model',
        selection: { provider: 'openai-codex', model: 'text-only', thinking: 'high' },
      },
    }),
  });
  expect(response?.status).toBe(409);
  expect(await response?.json()).toEqual({ error: 'STUDYFORGE_VISION_MODEL_UNAVAILABLE' });
});

test('refuses to replace the learning set while a focus cycle is active', async () => {
  const { request } = setup({ canChangeLearningSet: () => false });
  const response = await request('/api/desktop/learning-sets/blank', {
    method: 'POST',
    body: JSON.stringify({ name: '不能切换' }),
  });

  expect(response?.status).toBe(409);
  expect(await response?.json()).toEqual({ error: 'FOCUS_CYCLE_ACTIVE' });
});

test('bridges Pi auth prompts without retaining the submitted secret or code', async () => {
  const { request } = setup();
  const started = await request('/api/desktop/auth', {
    method: 'POST',
    body: JSON.stringify({ provider: 'openai-codex', type: 'oauth' }),
  });
  expect(started?.status).toBe(202);
  const { flowId } = await started?.json() as { flowId: string };

  await Bun.sleep(0);
  const pending = await request(`/api/desktop/auth/${flowId}`);
  expect(await pending?.json()).toMatchObject({
    status: 'waiting',
    prompt: { type: 'manual_code', message: '输入授权码' },
    events: [{ type: 'auth_url', url: 'https://example.test/oauth' }],
  });

  const responded = await request(`/api/desktop/auth/${flowId}/respond`, {
    method: 'POST',
    body: JSON.stringify({ value: 'one-time-code' }),
  });
  expect(responded?.status).toBe(204);
  await Bun.sleep(0);
  const completed = await request(`/api/desktop/auth/${flowId}`);
  const completedBody = await completed?.json();
  expect(completedBody).toMatchObject({ status: 'completed', prompt: null });
  expect(JSON.stringify(completedBody)).not.toContain('one-time-code');
});

test('serves only the four canonical offline help documents', async () => {
  const { request } = setup();
  const guide = await request('/api/desktop/help/first-learning');
  expect(guide?.status).toBe(200);
  const guideBody = await guide?.text();
  expect(guideBody).toContain('# 快速开始');
  expect(guideBody).not.toContain('](images/');

  const features = await request('/api/desktop/help/feature-guide');
  expect(features?.status).toBe(200);
  expect(await features?.text()).toContain('# 功能手册');

  const windows = await request('/api/desktop/help/windows-installation');
  expect(windows?.status).toBe(200);
  expect(await windows?.text()).toContain('# Windows 安装与模型设置');

  const unknown = await request('/api/desktop/help/anything-else');
  expect(unknown?.status).toBe(404);
});

test('serves only whitelisted actor media and validates speech input', async () => {
  const { paths, request } = setup();
  mkdirSync(join(paths.actorsDir, 'peer-axia'), { recursive: true });
  writeFileSync(join(paths.actorsDir, 'peer-axia', 'neutral.png'), new Uint8Array([1, 2, 3]));

  expect((await request('/api/desktop/actors/peer-axia/live2d/manifest'))?.status).toBe(404);

  const portrait = await request('/api/desktop/actors/peer-axia/neutral');
  expect(portrait?.status).toBe(200);
  expect(portrait?.headers.get('content-type')).toBe('image/png');
  expect(new Uint8Array(await portrait!.arrayBuffer())).toEqual(new Uint8Array([1, 2, 3]));

  for (const path of [
    '/api/desktop/actors/peer-other/neutral',
    '/api/desktop/actors/peer-axia/neutral.png',
    '/api/desktop/actors/peer-axia/%2e%2e%2fneutral',
  ]) {
    expect((await request(path))?.status).toBe(404);
  }

  writeLive2DPackage(paths.actorsDir);
  const manifest = await request('/api/desktop/actors/peer-axia/live2d/manifest');
  expect(manifest?.status).toBe(200);
  expect(await manifest?.json()).toEqual({
    version: 1,
    modelFile: 'runtime/axia.model3.json',
    coreFile: 'runtime/live2dcubismcore.min.js',
    modelFiles: ['runtime/axia.model3.json', 'runtime/axia.moc3'],
  });

  const model = await request(
    '/api/desktop/actors/peer-axia/live2d/file?path=runtime%2Faxia.moc3',
  );
  expect(model?.status).toBe(200);
  expect(new Uint8Array(await model!.arrayBuffer())).toEqual(new Uint8Array([77, 79, 67, 51]));

  for (const path of [
    '/api/desktop/actors/peer-other/live2d/manifest',
    '/api/desktop/actors/peer-axia/live2d/file?path=..%2Fvoice.mp3',
    '/api/desktop/actors/peer-axia/live2d/file?path=source%2Faxia.cmo3',
    '/api/desktop/actors/peer-axia/live2d/file?path=runtime%2Fmissing.png',
  ]) {
    expect((await request(path))?.status).toBe(404);
  }

  const speech = await request('/api/desktop/peer-speech', {
    method: 'POST',
    body: JSON.stringify({ actorId: 'peer-axia', text: '先比较反应商。' }),
  });
  expect(speech?.status).toBe(200);
  expect(speech?.headers.get('content-type')).toBe('audio/wav');

  for (const body of [
    { actorId: 'peer-other', text: '你好' },
    { actorId: 'peer-axia', text: '' },
    { actorId: 'peer-axia', text: '你好', model: 'other' },
    { actorId: 'peer-axia', text: 'x'.repeat(12_001) },
  ]) {
    const invalid = await request('/api/desktop/peer-speech', {
      method: 'POST',
      body: JSON.stringify(body),
    });
    expect(invalid?.status).toBe(400);
  }
});

test('reports and installs the private desktop peer skin without exposing local paths', async () => {
  const { root, request } = setup();
  const initial = await request('/api/desktop/peer-skin');
  expect(initial?.status).toBe(200);
  expect(await initial?.json()).toEqual({ state: 'missing', coreInstalled: false });

  const fixture = writeImportableLive2DSource(root);
  const installed = await request('/api/desktop/peer-skin/import', {
    method: 'POST',
    body: JSON.stringify(fixture),
  });
  expect(installed?.status).toBe(200);
  const installedBody = await installed?.json();
  expect(installedBody).toEqual({ state: 'installed', coreInstalled: true });
  expect(JSON.stringify(installedBody)).not.toContain(root);

  const invalid = join(root, 'not-a-skin');
  mkdirSync(invalid);
  const failed = await request('/api/desktop/peer-skin/import', {
    method: 'POST',
    body: JSON.stringify({ source: invalid }),
  });
  expect(failed?.status).toBe(422);
  expect(await failed?.json()).toEqual({ error: 'PEER_SKIN_SOURCE_INVALID' });
  expect(await (await request('/api/desktop/peer-skin'))?.json())
    .toEqual({ state: 'installed', coreInstalled: true });
});
