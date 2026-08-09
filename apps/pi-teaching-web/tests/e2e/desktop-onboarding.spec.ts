import { expect, test } from '@playwright/test';

test('moves from a blank desktop set through explicit model choice into learning', async ({ page }) => {
  let state: 'needs-learning-set' | 'needs-models' | 'ready' = 'needs-learning-set';
  await page.addInitScript(() => {
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
      invoke: async (command: string) => {
        if (command === 'runtime_connection') {
          return {
            state: { status: 'ready', port: 43121, workspace: 'setup' },
            apiBase: 'http://127.0.0.1:43121',
            token: 'launch-token',
            error: null,
          };
        }
        if (command === 'restart_runtime') return null;
        if (command === 'choose_learning_set_folder') return null;
        throw new Error(`Unexpected desktop command: ${command}`);
      },
    };
  });
  await page.route('http://127.0.0.1:43121/**', async (route) => {
    const request = route.request();
    expect(request.headers().authorization).toBe('Bearer launch-token');
    const path = new URL(request.url()).pathname;
    if (path === '/api/desktop/status') {
      await route.fulfill({
        json: {
          state,
          onboardingComplete: state === 'ready',
          currentLearningSet: state === 'needs-learning-set' ? null : '/tmp/chemistry/learning-set',
          recentLearningSets: [],
          teacher: null,
          scout: null,
          issue: null,
        },
      });
      return;
    }
    if (path === '/api/desktop/learning-sets/blank') {
      state = 'needs-models';
      await route.fulfill({ status: 201, json: {
        learningSet: '/tmp/chemistry/learning-set', restartRequired: true,
      } });
      return;
    }
    if (path === '/api/desktop/models' && request.method() === 'GET') {
      await route.fulfill({ json: {
        providers: [{
          id: 'openai-codex', name: 'OpenAI Codex', configured: true,
          authLabel: 'OAuth', loginMethods: [{ type: 'oauth', label: '使用 ChatGPT 登录' }],
        }],
        models: [
          { provider: 'openai-codex', id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', thinkingLevels: ['off', 'high'] },
          { provider: 'openai-codex', id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', thinkingLevels: ['off', 'high'] },
        ],
      } });
      return;
    }
    if (path === '/api/desktop/models' && request.method() === 'PUT') {
      state = 'ready';
      await route.fulfill({ json: { onboardingComplete: true, restartRequired: true } });
      return;
    }
    if (path === '/api/home') {
      await route.fulfill({ json: {
        guide: { title: '化学反应原理', body: '从一个真实问题开始。', raw: '' },
        hasCourse: false,
        course: null,
        assets: { notes: 0, problemCards: 0, materials: 0 },
        recentFreeLearning: [],
        recentMeta: [],
      } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: 'NOT_FOUND' } });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '先从哪里开始？' })).toBeVisible();
  await page.getByLabel('学习集名称').fill('化学反应原理');
  await page.getByRole('button', { name: '从空白开始' }).click();
  await expect(page.getByRole('heading', { name: '安排两位老师' })).toBeVisible();
  await expect(page.getByLabel('主教师模型')).toHaveValue('openai-codex/gpt-5.6-sol');
  await expect(page.getByLabel('检索 Scout 模型')).toHaveValue('openai-codex/gpt-5.6-terra');
  await page.getByRole('button', { name: '完成设置并开始学习' }).click();
  await expect(page.getByRole('heading', { name: '化学反应原理' })).toBeVisible();
});
