import { expect, test } from 'bun:test';
import type { AuthInteraction } from '@earendil-works/pi-ai';
import { createDesktopModelService } from '../../src/desktop/model-service';

function fakeRuntime() {
  const notifications: string[] = [];
  const models = [
    {
      provider: 'openai-codex',
      id: 'gpt-5.6-sol',
      name: 'GPT-5.6 Sol',
      reasoning: true,
      thinkingLevelMap: { minimal: 'minimal', high: 'high', max: null },
    },
    {
      provider: 'openai-codex',
      id: 'gpt-5.6-terra',
      name: 'GPT-5.6 Terra',
      reasoning: true,
    },
  ];
  return {
    notifications,
    getProviders: () => [{
      id: 'openai-codex',
      name: 'OpenAI Codex',
      auth: {
        apiKey: { name: 'API Key', login: async () => ({}) },
        oauth: { name: 'ChatGPT OAuth', loginLabel: '使用 ChatGPT 登录' },
      },
    }],
    getProviderAuthStatus: () => ({ configured: true, source: 'stored', label: 'OAuth' }),
    getAvailable: async () => models,
    getModel: (provider: string, model: string) => (
      models.find((candidate) => candidate.provider === provider && candidate.id === model)
    ),
    login: async (provider: string, type: string, interaction: AuthInteraction) => {
      notifications.push(`${provider}:${type}`);
      interaction.notify({ type: 'progress', message: 'ok' });
      return {};
    },
    logout: async (provider: string) => notifications.push(`logout:${provider}`),
  };
}

test('creates the Pi runtime against StudyForge-owned credential files', async () => {
  const runtime = fakeRuntime();
  let options: unknown;
  const service = await createDesktopModelService({
    authPath: '/private/studyforge/agent/auth.json',
    modelsPath: '/private/studyforge/agent/models.json',
    createRuntime: async (value) => {
      options = value;
      return runtime as never;
    },
  });

  expect(options).toEqual({
    authPath: '/private/studyforge/agent/auth.json',
    modelsPath: '/private/studyforge/agent/models.json',
  });
  const catalog = await service.catalog();
  expect(catalog.providers).toEqual([{
    id: 'openai-codex',
    name: 'OpenAI Codex',
    configured: true,
    authLabel: 'OAuth',
    loginMethods: [
      { type: 'api_key', label: 'API Key' },
      { type: 'oauth', label: '使用 ChatGPT 登录' },
    ],
  }]);
  expect(catalog.models[0]).toMatchObject({
    provider: 'openai-codex',
    id: 'gpt-5.6-sol',
    thinkingLevels: ['off', 'minimal', 'low', 'medium', 'high'],
  });
});

test('resolves only an available configured model and delegates the native auth flow', async () => {
  const runtime = fakeRuntime();
  const service = await createDesktopModelService({
    authPath: '/private/studyforge/agent/auth.json',
    modelsPath: '/private/studyforge/agent/models.json',
    createRuntime: async () => runtime as never,
  });

  expect((await service.resolve({
    provider: 'openai-codex',
    model: 'gpt-5.6-sol',
    thinking: 'high',
  }) as { id: string }).id).toBe('gpt-5.6-sol');
  await expect(service.resolve({
    provider: 'openai-codex',
    model: 'missing',
    thinking: 'high',
  })).rejects.toThrow('STUDYFORGE_MODEL_UNAVAILABLE: openai-codex/missing');

  const events: string[] = [];
  await service.login('openai-codex', 'oauth', {
    prompt: async () => 'value',
    notify: (event) => events.push(event.type),
  });
  await service.logout('openai-codex');
  expect(runtime.notifications).toEqual(['openai-codex:oauth', 'logout:openai-codex']);
  expect(events).toEqual(['progress']);
});
