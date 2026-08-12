import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { expect, test, type Page } from '@playwright/test';

const shots = join(process.cwd(), 'output/playwright');
mkdirSync(shots, { recursive: true });

type ImportReceipt = { id: string; revision: number };

async function expectNoInternalCodes(page: Page) {
  await expect(page.locator('body')).not.toContainText(
    /API_ERROR|MATERIAL_[A-Z_]+|material-[0-9]+|page-[0-9]{4}|free-session-[0-9]+/,
  );
}

async function captureReader(page: Page, filename: string) {
  await expect(page.locator('.book-page-image')).toBeVisible();
  await page.locator('main').evaluate(async (element) => {
    const animations = element.getAnimations({ subtree: true })
      .filter((animation) => animation.playState !== 'finished');
    await Promise.allSettled(animations.map((animation) => animation.finished));
  });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: join(shots, filename), fullPage: true });
}

async function bootstrap(page: Page, receipt: ImportReceipt) {
  const response = await page.request.post(
    `/api/materials/${receipt.id}/revisions/${receipt.revision}/book-index`,
  );
  expect(response.status()).toBe(201);
  return response.json();
}

test('walks the source-first book, teaching, asset, and cross-book loop', async ({ page }) => {
  test.setTimeout(45_000);
  await page.context().addCookies([{
    name: 'studyforge-fixture',
    value: 'source',
    domain: '127.0.0.1',
    path: '/',
  }]);
  expect((await page.request.post('/api/__e2e/source/reset')).status()).toBe(200);

  const imported = await page.request.post('/api/__e2e/source/import');
  expect(imported.status()).toBe(201);
  const first = await imported.json() as ImportReceipt;
  const index = await bootstrap(page, first) as { pageCount: number; outline: Array<{ title: string }> };
  expect(index.pageCount).toBe(3);
  expect(index.outline.map((node) => node.title)).toContain('Chapter One');

  const stateBeforeLearning = await (await page.request.get('/api/__e2e/source/state')).json() as {
    courseFiles: string[];
    memoryFiles: string[];
    reviewFiles: string[];
  };
  expect(stateBeforeLearning).toEqual({ courseFiles: [], memoryFiles: [], reviewFiles: [] });

  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto(`/assets/books/${first.id}`);
  await expect(page.getByRole('heading', { name: 'E2E Chemistry Book' })).toBeVisible();
  await expect(page.getByText('3 个物理页')).toBeVisible();
  await page.getByRole('button', { name: /Chapter One/ }).first().click();
  await expect(page.locator('.book-page-image')).toBeVisible();
  await expectNoInternalCodes(page);

  await page.goto(`/assets/books/${first.id}/read/${first.revision}/pages-0001-0002`);
  await expect(page.locator('.reader-toolbar')).toContainText('第 1–2 页');
  await page.getByRole('button', { name: /和老师学这里/ }).click();
  await expect(page).toHaveURL(/\/learn\/free-session-001$/);
  await expect(page.getByLabel('本次对话上下文')).toContainText('E2E Chemistry Book');
  await expect(page.getByLabel('本次对话上下文')).toContainText('第 1–2 页');

  const composer = page.getByPlaceholder('从一个问题、联想或不确定的想法开始…');
  await composer.fill('这两页之间的关系是什么？');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText(/保留刚才选中的原文位置/)).toBeVisible();
  await composer.fill('保存吧');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.locator('.tool-receipt').filter({ hasText: '已保存为笔记' })).toBeVisible();

  await page.goto('/assets?view=sources');
  await expect(page.getByText('E2E Chemistry Book', { exact: true })).toBeVisible();
  await expect(page.getByText('Chapter One', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /从原书形成的笔记/ }).click();
  const originalSource = page.getByRole('link', {
    name: '《E2E Chemistry Book》 · Chapter One · 第 1–2 页',
  });
  await expect(originalSource).toBeVisible();
  await originalSource.click();
  await expect(page).toHaveURL(new RegExp(`/assets/books/${first.id}/read/1/pages-0001-0002$`));
  await expectNoInternalCodes(page);

  const secondImport = await page.request.post('/api/__e2e/source/import-second');
  expect(secondImport.status()).toBe(201);
  const second = await secondImport.json() as ImportReceipt;
  await bootstrap(page, second);
  expect((await page.request.post(
    `/api/materials/${second.id}/revisions/${second.revision}/pages/1/read`,
    { data: { mode: 'auto' } },
  )).status()).toBe(200);

  const joined = await page.request.post('/api/free-learning', { data: {
    intent: 'open',
    selectedAssets: [
      { kind: 'material', id: first.id, revision: 1, locator: 'page-0001' },
      { kind: 'material', id: second.id, revision: 1, locator: 'page-0001' },
    ],
  } });
  expect(joined.status()).toBe(201);
  const joinedSession = await joined.json() as { route: string };
  await page.goto(joinedSession.route);
  await composer.fill('把两本书里的这一点连起来。');
  await page.getByRole('button', { name: /发送/ }).click();
  await composer.fill('保存吧');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText('跨书笔记已经保存。')).toBeVisible();

  await page.goto('/assets?view=sources');
  await expect(page.getByRole('button', { name: /两本书里的共同线索/ })).toHaveCount(2);
  await page.getByRole('button', { name: '知识之间' }).click();
  await page.getByPlaceholder('搜索知识点、题卡或笔记').fill('跨书联系');
  await page.getByLabel('搜索结果').getByRole('button', { name: /^跨书联系/ }).click();
  await expect(page.getByLabel('相关学习内容')).toContainText('两本书里的共同线索');
  await expect(page.locator('body')).not.toContainText(/先修关系|多书共识|系统推断/);

  const updated = await page.request.post('/api/__e2e/source/import-revision', {
    data: { id: first.id, expectedRevision: 1 },
  });
  expect(updated.status()).toBe(201);
  const secondRevision = await updated.json() as ImportReceipt;
  expect(secondRevision.revision).toBe(2);
  await bootstrap(page, secondRevision);

  await page.goto('/assets?view=sources');
  await page.getByRole('button', { name: /从原书形成的笔记/ }).click();
  await page.getByRole('link', {
    name: '《E2E Chemistry Book》 · Chapter One · 第 1–2 页',
  }).click();
  await expect(page).toHaveURL(new RegExp(`/assets/books/${first.id}/read/1/pages-0001-0002$`));

  const finalState = await (await page.request.get('/api/__e2e/source/state')).json() as {
    courseFiles: string[];
    memoryFiles: string[];
  };
  expect(finalState.courseFiles).toEqual([]);
  expect(finalState.memoryFiles).toEqual([]);
  await expectNoInternalCodes(page);
  await captureReader(page, 'source-first-reader-1440.png');

  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth <= document.documentElement.clientWidth
  ))).toBe(true);
  await captureReader(page, 'source-first-reader-1280.png');
});
