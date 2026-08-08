import { expect, test } from '@playwright/test';

test('joins source-grounded free learning, assets, Meta, Roadmap, and the footprint', async ({ page }) => {
  await page.context().addCookies([{
    name: 'studyforge-fixture',
    value: 'm1c',
    domain: '127.0.0.1',
    path: '/',
  }]);
  expect((await page.request.post('/api/__e2e/m1c/reset')).status()).toBe(200);

  await page.goto('/home');
  await expect(page.getByRole('heading', { name: '空白学习集' })).toBeVisible();
  await expect(page.getByRole('button', { name: /规划长期学习/ })).toBeVisible();

  await page.getByRole('link', { name: '学习资料', exact: true }).click();
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
  await expect(page.getByText('化学反应原理摘录', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: /化学反应原理摘录/ }).click();
  await expect(page.getByRole('heading', { name: '化学反应原理摘录' })).toBeVisible();
  await expect(page.getByLabel('来源位置')).toHaveValue('lines-1-3');
  await page.getByRole('button', { name: '读取来源' }).click();
  await expect(page.getByText(/纯固体的活度在给定状态下视为常量/)).toBeVisible();
  await page.getByRole('button', { name: '带着这一段问老师' }).click();

  await expect(page).toHaveURL(/\/learn\/free-session-001$/);
  const freeComposer = page.getByPlaceholder('从一个问题、联想或不确定的想法开始…');
  await freeComposer.fill('为什么溶度积里固体不见了？');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText(/纯固体的活度.*并入平衡常数/)).toBeVisible();
  await expect(page.getByText(/你确认后我再保存/)).toBeVisible();
  await freeComposer.fill('保存吧');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText('这份有原文出处的笔记已经保存。')).toBeVisible();
  await expect(page.locator('details.tool-activity').filter({ hasText: 'save_note' })).toBeVisible();

  await page.getByRole('link', { name: '学习资料', exact: true }).click();
  await expect(page.getByText('Ksp 中为什么不写纯固体', { exact: true })).toBeVisible();
  await expect(page.getByText('沉淀溶解平衡', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /Ksp 中为什么不写纯固体/ }).click();
  await expect(page.getByText(/来源：资料 material-001 · 第 1 版/)).toBeVisible();

  await page.goto('/home');
  await page.getByRole('button', { name: /规划长期学习/ }).click();
  await expect(page).toHaveURL(/\/meta\/meta-session-001$/);
  const metaComposer = page.getByPlaceholder('写下你的想法或解题过程…');
  await metaComposer.fill('我确实不知道化学反应原理该怎么长期学。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText(/长期学习路线.*能力标准/)).toBeVisible();
  await metaComposer.fill('可以');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.locator('details.tool-activity').filter({ hasText: 'create_roadmap' }))
    .toBeVisible();
  await expect(page.getByRole('button', { name: '进入 Roadmap' })).toBeVisible();

  const courseResponse = await page.request.get('/api/course');
  expect(courseResponse.status()).toBe(200);
  const course = await courseResponse.json() as { tree: { children: unknown[] } };
  expect(course.tree.children).toEqual([]);

  await page.goto('/footprint');
  await expect(page.getByRole('heading', { name: '学习足迹' })).toBeVisible();
  await expect(page.getByText('化学反应原理摘录', { exact: true })).toBeVisible();
  await expect(page.getByText('Ksp 中为什么不写纯固体', { exact: true })).toBeVisible();
  await expect(page.getByText('长期学习规划', { exact: true }).first()).toBeVisible();
  await expect(page.locator('body')).not.toContainText('metadata revision');

  await page.goto('/meta/meta-session-001');
  await page.getByRole('button', { name: '进入 Roadmap' }).click();
  await expect(page).toHaveURL(/\/course$/);
  await expect(page.getByRole('heading', { name: '化学反应原理长期学习路线' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '尚未形成学习阶段' })).toBeVisible();
});
