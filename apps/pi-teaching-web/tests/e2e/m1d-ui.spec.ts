import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test } from '@playwright/test';

const shots = join(process.cwd(), 'output/playwright');
mkdirSync(shots, { recursive: true });

async function expectNoHorizontalOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
}

async function capture(page: import('@playwright/test').Page, name: string) {
  await page.locator('main').evaluate(async (element) => {
    const finite = element.getAnimations({ subtree: true }).filter((animation) => (
      animation.effect?.getTiming().iterations !== Infinity
    ));
    await Promise.all(finite.map((animation) => animation.finished));
    window.scrollTo(0, 0);
  });
  await page.screenshot({ path: join(shots, name), fullPage: true });
}

test('opens a target route without waiting for the Home projection', async ({ page }) => {
  await page.context().addCookies([{
    name: 'studyforge-fixture',
    value: 'm1c',
    domain: '127.0.0.1',
    path: '/',
  }]);
  expect((await page.request.post('/api/__e2e/m1c/reset')).status()).toBe(200);

  let releaseHome!: () => void;
  const homeGate = new Promise<void>((resolve) => { releaseHome = resolve; });
  let finishHome!: () => void;
  const homeFinished = new Promise<void>((resolve) => { finishHome = resolve; });
  await page.route('**/api/home', async (route) => {
    await homeGate;
    await route.continue();
    finishHome();
  });
  try {
    await page.goto('/assets');
    await expect(page.getByRole('heading', { name: '我的学习资料' })).toBeVisible();
  } finally {
    releaseHome();
    await homeFinished;
    await page.unroute('**/api/home');
  }
});

test('walks the M1d asset, source, footprint, and local-relation surfaces', async ({ page }) => {
  await page.context().addCookies([{
    name: 'studyforge-fixture',
    value: 'm1c',
    domain: '127.0.0.1',
    path: '/',
  }]);
  expect((await page.request.post('/api/__e2e/m1c/reset')).status()).toBe(200);
  await page.setViewportSize({ width: 1440, height: 900 });

  await page.goto('/home');
  await expect(page.locator('.home-primary')).toHaveCount(1);
  await expect(page.getByRole('button', { name: /问老师/ })).toBeVisible();
  await capture(page, 'm1d-blank-home-1440.png');

  await page.getByRole('button', { name: /问老师/ }).click();
  const composer = page.getByPlaceholder('从一个问题、联想或不确定的想法开始…');
  await composer.fill('我觉得 $K_{sp}$ 会随着加入 NaCl 变小。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.locator('.message.user .katex')).toBeVisible();
  await expect(page.getByText(/当前离子积.*平衡常数/)).toBeVisible();

  await composer.fill('温度不变时 Ksp 不变；加入 NaCl 改变的是离子积和各离子浓度。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText(/这次你已经自己把边界说清了/)).toBeVisible();
  await composer.fill('可以，就按你刚才展示的内容保存成笔记和题卡。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.locator('.tool-receipt').filter({ hasText: '笔记已保存' })).toBeVisible();
  await expect(page.locator('.tool-receipt').filter({ hasText: '题卡已保存' })).toBeVisible();

  await page.getByRole('link', { name: '学习资料', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的学习资料' })).toBeVisible();
  await page.getByLabel('选择 Ksp 与离子积的边界').check();
  await expect(page.getByRole('button', { name: '带着所选问老师 · 1' })).toBeEnabled();
  await capture(page, 'm1d-assets-selected-1440.png');
  await page.getByRole('button', { name: '带着所选问老师 · 1' }).click();
  await expect(page.getByLabel('本次对话上下文')).toContainText('Ksp 与离子积的边界');
  await page.getByPlaceholder('从一个问题、联想或不确定的想法开始…')
    .fill('把 $K_{sp}$ 和离子积的边界再讲清楚。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.locator('.message.user .katex')).toBeVisible();

  await page.goto('/assets');
  await page.getByRole('button', { name: /Ksp 与离子积的边界/ }).click();
  await expect(page.getByText('形成于', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: '编辑笔记' }).click();
  await page.getByLabel('标题').fill('Ksp 与离子积的边界（我的版本）');
  await page.getByRole('button', { name: '保存修改' }).click();
  await expect(page.getByRole('heading', { name: 'Ksp 与离子积的边界（我的版本）' }))
    .toBeVisible();

  await page.goto('/assets');
  await page.getByRole('button', { name: /恒温下，向 AgCl/ }).click();
  await expect(page.getByRole('button', { name: '带着这道题问老师' })).toBeVisible();
  await expect(page.getByText('恒温下 Ksp 不变，变化的是离子积和各离子浓度。'))
    .toHaveCount(0);
  await page.getByLabel('你的作答').fill('平衡左移，所以 Ksp 变小。');
  await page.getByRole('button', { name: '提交作答' }).click();
  await expect(page.getByRole('button', { name: '带着这次作答问老师' })).toBeVisible();
  await page.getByRole('button', { name: '查看标准答案' }).click();
  await expect(page.getByText('恒温下 Ksp 不变，变化的是离子积和各离子浓度。'))
    .toBeVisible();
  await capture(page, 'm1d-problem-revealed-1440.png');

  await page.goto('/assets');
  await page.getByLabel('资料标题').fill('化学反应原理摘录');
  await page.getByLabel('选择文件').setInputFiles({
    name: 'ksp-notes.md',
    mimeType: 'text/markdown',
    buffer: Buffer.from([
      '# 溶度积',
      '纯固体的活度在给定状态下视为常量，并入平衡常数。',
      '因此 Ksp 只显式写溶液中会变化的离子项。',
    ].join('\n')),
  });
  await page.getByRole('button', { name: '上传资料' }).click();
  await page.getByRole('button', { name: /化学反应原理摘录/ }).click();
  await expect(page.getByText(/纯固体的活度在给定状态下视为常量/)).toBeVisible();
  await expect(page.getByLabel('资料位置')).toContainText('第 1–3 行');
  await page.getByRole('button', { name: '高级定位' }).click();
  await page.getByLabel('Canonical locator').fill('lines-99-120');
  await page.getByRole('button', { name: '读取这个位置' }).click();
  await expect(page.getByRole('alert')).toContainText('仍保留上一次成功显示的内容');
  await expect(page.getByText(/纯固体的活度在给定状态下视为常量/)).toBeVisible();

  await page.goto('/assets');
  await page.getByRole('button', { name: '知识关系' }).click();
  await expect(page.getByRole('heading', { name: '知识关系' })).toBeVisible();
  await page.getByPlaceholder('例如：沉淀溶解平衡').fill('沉淀溶解平衡');
  await page.getByRole('button', { name: '沉淀溶解平衡', exact: true }).click();
  await expect(page.getByLabel('局部关系图')).toContainText(/显示 \d+ \/ 共 \d+/);
  await expect(page.locator('body')).not.toContainText('对象记忆');
  await expect(page.locator('body')).not.toContainText('能力假设');
  await capture(page, 'm1d-knowledge-local-1440.png');
  await expectNoHorizontalOverflow(page);

  await page.goto('/footprint');
  await expect(page.getByRole('heading', { name: '学习足迹' })).toBeVisible();
  await expect(page.locator('.footprint-ledger li')).not.toHaveCount(0);
  await expect(page.locator('body')).not.toContainText('metadata revision');
});

test('shows the exact active Lesson and the three-paper course workspace at desktop sizes', async ({ page }) => {
  expect((await page.request.post('/api/__e2e/m0/reset')).status()).toBe(200);
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/course/plan/plan-001');
  await page.getByRole('button', { name: '开始这一阶段' }).click();
  await page.goto('/course/plan/plan-001/lesson/lesson-001');
  await page.getByRole('button', { name: '开始本课' }).click();

  await page.goto('/home');
  await expect(page.locator('.home-primary')).toHaveCount(1);
  await expect(page.getByRole('link', { name: /继续上课 · 真实停点问诊/ }))
    .toHaveAttribute('href', '/course/plan/plan-001/lesson/lesson-001');
  await expect(page.locator('.home-primary .seal-mark')).toHaveText('继');
  await capture(page, 'm1d-active-home-1440.png');

  await page.route('**/api/sessions/*/history', async (route) => {
    if (!decodeURIComponent(new URL(route.request().url()).pathname).includes('lesson:plan-001:lesson-001')) {
      await route.continue();
      return;
    }
    await route.fulfill({
      json: [
        {
          id: 'scout-visible', kind: 'material-search', status: 'running', phase: 'inspecting',
          completed: 1, total: 2, toolCount: 12, elapsedMs: 64_000,
          at: '2026-08-09T10:00:00.000Z', updatedAt: '2026-08-09T10:01:04.000Z',
        },
        {
          id: 'review-visible', kind: 'lesson-review', status: 'running', elapsedMs: 18_000,
          at: '2026-08-09T10:01:05.000Z', updatedAt: '2026-08-09T10:01:23.000Z',
        },
        {
          id: 'handout-visible', kind: 'lesson-handout', status: 'running', title: null, url: null,
          at: '2026-08-09T10:01:24.000Z',
        },
      ],
    });
  });
  await page.getByRole('link', { name: /继续上课 · 真实停点问诊/ }).click();
  await expect(page.getByRole('heading', { name: 'Lesson 001：真实停点问诊' })).toBeVisible();
  await page.getByRole('button', { name: '展开课程树' }).click();
  await expect(page.getByRole('heading', { name: '课程脉络' })).toBeVisible();
  await page.getByRole('button', { name: '展开本课提纲' }).click();
  await expect(page.getByRole('complementary', { name: '本课提纲' })).toBeVisible();
  await expect(page.getByText('正在查看候选材料')).toBeVisible();
  await expect(page.getByText('正在核验题目')).toBeVisible();
  await expect(page.getByText('正在整理讲义')).toBeVisible();
  await expect(page.locator('.katex-display')).toBeVisible();

  await page.getByPlaceholder('写下你的想法或解题过程…').fill('我先观察参数出现的位置。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.locator('.tool-receipt')).toContainText('老师查看了相关内容');
  await expect(page.locator('body')).not.toContainText('plans/plan-001/PLAN.md');
  await expectNoHorizontalOverflow(page);
  await capture(page, 'm1d-course-1440.png');

  await page.setViewportSize({ width: 1280, height: 800 });
  await expectNoHorizontalOverflow(page);
  await capture(page, 'm1d-course-1280.png');
});
