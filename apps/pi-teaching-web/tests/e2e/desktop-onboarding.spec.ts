import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

const shots = join(process.cwd(), 'output/playwright');
mkdirSync(shots, { recursive: true });

async function capture(page: import('@playwright/test').Page, name: string) {
  await page.locator('main, .desktop-ready-shift').first().evaluate(async (element) => {
    const animations = element.getAnimations({ subtree: true }).filter((animation) => (
      animation.effect?.getTiming().iterations !== Infinity
    ));
    await Promise.all(animations.map((animation) => animation.finished));
  });
  await page.screenshot({ path: join(shots, name), fullPage: true });
}

async function installDesktopBridge(page: import('@playwright/test').Page) {
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
        if (command === 'choose_peer_skin_folder') return null;
        if (command === 'choose_live2d_core_file') return null;
        if (command === 'open_external_url') return null;
        if (command === 'show_companion_window') return null;
        if (command === 'hide_companion_window') return null;
        if (command === 'reload_companion_window') return null;
        throw new Error(`Unexpected desktop command: ${command}`);
      },
    };
  });
}

test('moves from a blank desktop set through explicit model choice into learning', async ({ page }) => {
  let state: 'needs-learning-set' | 'needs-models' | 'ready' = 'needs-learning-set';
  await installDesktopBridge(page);
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
    if (path === '/api/desktop/peer-skin') {
      await route.fulfill({ json: { state: 'missing', coreInstalled: false } });
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
  await capture(page, 'desktop-first-run-1280.png');
  await page.getByLabel('学习集名称').fill('化学反应原理');
  await page.getByRole('button', { name: '从空白开始' }).click();
  await expect(page.getByRole('heading', { name: '安排两位老师' })).toBeVisible();
  await capture(page, 'desktop-model-settings-1280.png');
  await expect(page.getByLabel('主教师模型')).toHaveValue('openai-codex/gpt-5.6-sol');
  await expect(page.getByLabel('检索 Scout 模型')).toHaveValue('openai-codex/gpt-5.6-terra');
  await page.getByRole('button', { name: '完成设置并开始学习' }).click();
  await expect(page.getByRole('heading', { name: '化学反应原理' })).toBeVisible();
  await capture(page, 'desktop-learning-home-1280.png');

  await page.getByRole('button', { name: '设置' }).click();
  await expect(page.getByRole('heading', { name: '安排两位老师' })).toBeVisible();
  await page.getByRole('button', { name: '完成设置并开始学习' }).click();
  await expect(page.getByRole('heading', { name: '化学反应原理' })).toBeVisible();
});

test('keeps polling while browser OAuth is waiting and observes its asynchronous completion', async ({ page }) => {
  let responded = false;
  let completed = false;
  let readsAfterResponse = 0;
  await installDesktopBridge(page);
  await page.route('http://127.0.0.1:43121/**', async (route) => {
    const request = route.request();
    const path = new URL(request.url()).pathname;
    if (path === '/api/desktop/status') {
      await route.fulfill({ json: {
        state: 'needs-models', onboardingComplete: false,
        currentLearningSet: '/tmp/chemistry/learning-set', recentLearningSets: [],
        teacher: null, scout: null, issue: null,
      } });
      return;
    }
    if (path === '/api/desktop/peer-skin') {
      await route.fulfill({ json: { state: 'missing', coreInstalled: false } });
      return;
    }
    if (path === '/api/desktop/models') {
      await route.fulfill({ json: {
        providers: [{
          id: 'openai-codex', name: 'OpenAI Codex', configured: completed,
          authLabel: completed ? 'OAuth' : null,
          loginMethods: [{ type: 'oauth', label: 'OpenAI (ChatGPT Plus/Pro)' }],
        }],
        models: completed ? [
          { provider: 'openai-codex', id: 'gpt-5.6-sol', name: 'GPT-5.6 Sol', thinkingLevels: ['off', 'high'] },
          { provider: 'openai-codex', id: 'gpt-5.6-terra', name: 'GPT-5.6 Terra', thinkingLevels: ['off', 'high'] },
        ] : [],
      } });
      return;
    }
    if (path === '/api/desktop/auth' && request.method() === 'POST') {
      await route.fulfill({ status: 202, json: { flowId: 'oauth-flow' } });
      return;
    }
    if (path === '/api/desktop/auth/oauth-flow/respond') {
      responded = true;
      await route.fulfill({ status: 204 });
      return;
    }
    if (path === '/api/desktop/auth/oauth-flow') {
      if (!responded) {
        await route.fulfill({ json: {
          flowId: 'oauth-flow', status: 'waiting', events: [], error: null,
          prompt: {
            type: 'select', message: 'Select OpenAI Codex login method:',
            options: [{ id: 'browser', label: 'Browser login (default)' }],
          },
        } });
        return;
      }
      readsAfterResponse += 1;
      completed = readsAfterResponse >= 2;
      await route.fulfill({ json: completed ? {
        flowId: 'oauth-flow', status: 'completed', events: [], prompt: null, error: null,
      } : {
        flowId: 'oauth-flow', status: 'waiting', error: null,
        events: [{ type: 'auth_url', url: 'https://auth.openai.com/test' }],
        prompt: { type: 'manual_code', message: 'Complete login in your browser' },
      } });
      return;
    }
    await route.fulfill({ status: 404, json: { error: 'NOT_FOUND' } });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'OpenAI (ChatGPT Plus/Pro)' }).click();
  await page.getByLabel('Select OpenAI Codex login method:').selectOption('browser');
  await page.getByRole('button', { name: '继续' }).click();
  await expect(page.getByText('已经连接，可以选择模型了。')).toBeVisible({ timeout: 3_000 });
  await expect(page.getByText('OAuth', { exact: true })).toBeVisible();
});

test('returns to the runtime diagnosis when a packaged restart is rejected', async ({ page }) => {
  await page.addInitScript(() => {
    (window as unknown as { __TAURI_INTERNALS__: unknown }).__TAURI_INTERNALS__ = {
      invoke: async (command: string) => {
        if (command === 'runtime_connection') {
          return {
            state: { status: 'crashed', code: null },
            apiBase: null,
            token: null,
            error: 'packaged runtime did not start',
          };
        }
        if (command === 'restart_runtime') throw new Error('restart rejected');
        throw new Error(`Unexpected desktop command: ${command}`);
      },
    };
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: '本地教师没有正常醒来' })).toBeVisible();
  await page.getByRole('button', { name: '重新启动本地教师' }).click();
  await expect(page.getByRole('heading', { name: '本地教师没有正常醒来' })).toBeVisible();
});
