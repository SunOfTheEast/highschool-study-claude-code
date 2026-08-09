import { afterEach, expect, test } from 'bun:test';
import {
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
        },
        {
          provider: 'openai-codex',
          id: 'gpt-5.6-terra',
          name: 'GPT-5.6 Terra',
          thinkingLevels: ['off', 'high'] as const,
        },
      ],
    }),
    resolve: async (selection: DesktopModelSelection) => {
      if (!available.has(`${selection.provider}/${selection.model}`)) {
        throw new Error(`STUDYFORGE_MODEL_UNAVAILABLE: ${selection.provider}/${selection.model}`);
      }
      return { id: selection.model };
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

function setup() {
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
    shutdown: () => {},
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
