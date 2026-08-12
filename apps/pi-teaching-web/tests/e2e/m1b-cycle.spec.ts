import { expect, test } from '@playwright/test';

test('grows a blank learning set into reusable assets and teacher memory', async ({ page }) => {
  await page.context().addCookies([{
    name: 'studyforge-fixture',
    value: 'm1b',
    domain: '127.0.0.1',
    path: '/',
  }]);
  expect((await page.request.post('/api/__e2e/m1b/reset')).status()).toBe(200);

  await page.goto('/home');
  await expect(page.getByRole('heading', { name: '空白学习集' })).toBeVisible();
  await expect(page.getByRole('link', { name: '课程脉络' })).toHaveCount(0);
  await expect(page.getByText('还没有自由学习记录')).toBeVisible();

  await page.getByRole('button', { name: /问老师/ }).click();
  await expect(page).toHaveURL(/\/learn\/free-session-001$/);
  const composer = page.getByPlaceholder('从一个问题、联想或不确定的想法开始…');
  await composer.fill('我总觉得往 AgCl 的平衡里加 NaCl 会让 Ksp 变小，因为平衡左移了。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText(/你把“当前离子积”和“恒温下的平衡常数”混在了一起/))
    .toBeVisible();

  await composer.fill('温度不变时 Ksp 不变；加入 NaCl 改变的是离子积和各离子浓度。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText(/这次你已经自己把边界说清了/)).toBeVisible();
  await expect(page.locator('.tool-receipt')).toContainText('学习记录已整理');

  await composer.fill('可以，就按你刚才展示的内容保存成笔记和题卡。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText('Note 和题卡都已经保存。', { exact: true })).toBeVisible();
  await expect(page.locator('.tool-receipt').filter({ hasText: '已保存为笔记' })).toBeVisible();
  await expect(page.locator('.tool-receipt').filter({ hasText: '已保存为题卡' })).toBeVisible();

  await page.getByRole('button', { name: '结束这次自由学习' }).click();
  await expect(page).toHaveURL(/\/learn\/free-session-001$/);
  await expect(page.getByText('这个线程已经结束，可以随时开启新的讨论。')).toBeVisible();
  await expect(page.getByPlaceholder('这个线程已经结束')).toBeDisabled();
  await page.goto('/home');
  await expect(page.getByText('已结束', { exact: true })).toBeVisible();
  await expect(page.getByText('我的学习资料 · 1 份笔记 · 1 张题卡')).toBeVisible();

  expect((await page.request.post('/api/__e2e/m1b/restart')).status()).toBe(200);
  await page.reload();
  await expect(page.getByText('已结束', { exact: true })).toBeVisible();
  await expect(page.getByText('我的学习资料 · 1 份笔记 · 1 张题卡')).toBeVisible();

  await page.getByRole('link', { name: '学习资料', exact: true }).click();
  await expect(page.getByRole('heading', { name: '我的学习资料' })).toBeVisible();
  await expect(page.getByText('Ksp 与离子积的边界', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: /恒温下，向 AgCl/ }).click();
  await expect(page.getByText('恒温下 Ksp 不变，变化的是离子积和各离子浓度。'))
    .toHaveCount(0);
  await expect(page.getByText('先区分平衡常数和即时状态。')).toHaveCount(0);

  await page.getByLabel('你的作答').fill('平衡左移，所以 Ksp 会变小。');
  await page.getByRole('button', { name: '提交作答' }).click();
  await page.getByRole('button', { name: '查看标准答案' }).click();
  await expect(page.getByText('恒温下 Ksp 不变，变化的是离子积和各离子浓度。'))
    .toBeVisible();
  await expect(page.getByText('先区分平衡常数和即时状态。')).toHaveCount(0);

  await page.getByRole('button', { name: '带着这次作答问老师' }).click();
  await expect(page).toHaveURL(/\/learn\/free-session-002$/);
  await page.getByPlaceholder('从一个问题、联想或不确定的想法开始…')
    .fill('我为什么又错回去了？');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText(/你最近一次写的是“平衡左移，所以 Ksp 会变小/)).toBeVisible();
  await expect(page.getByText(/答案已经看过/)).toBeVisible();
  await expect(page.getByText(/教师记忆里还保留着你此前能区分离子积与 Ksp/)).toBeVisible();

  const home = await page.request.get('/api/home');
  expect(home.status()).toBe(200);
  expect(await home.json()).toMatchObject({
    hasCourse: false,
    assets: { notes: 1, problemCards: 1 },
    recentFreeLearning: [
      { id: 'free-session-002', status: 'active' },
      { id: 'free-session-001', status: 'ended' },
    ],
  });
});
