import { expect, test } from '@playwright/test';

test('completes the M0 Roadmap, Plan, Lesson and Knowledge browser cycle', async ({ page }) => {
  await page.goto('/course');

  await expect(page.getByRole('heading', { name: '导数结构学习路线' })).toBeVisible();
  await page.getByPlaceholder('写下你的想法或解题过程…').fill('我觉得恒成立问题比较棘手。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText('我觉得恒成立问题比较棘手。', { exact: true })).toBeVisible();
  await expect(page.getByText(
    '我听见你说恒成立问题比较棘手。具体是哪一种结构最容易让你停下来？',
    { exact: true },
  )).toBeVisible();
  await expect(page.locator('details.tool-activity')).toContainText('read');

  await page.getByRole('button', { name: '展开课程树' }).click();
  await page.getByRole('button', { name: /恒成立问题选路/ }).click();
  await expect(page).toHaveURL(/\/course\/plan\/plan-001$/);
  await page.getByRole('button', { name: '开始这一阶段' }).click();
  await expect(page.getByRole('button', { name: '完成这一阶段' })).toBeVisible();

  await page.getByRole('button', { name: /真实停点问诊/ }).click();
  await expect(page).toHaveURL(/\/course\/plan\/plan-001\/lesson\/lesson-001$/);
  await page.getByRole('button', { name: '开始本课' }).click();
  await expect(page.getByRole('button', { name: '结束本课' })).toBeVisible();
  await page.getByRole('button', { name: '展开节点原文' }).click();
  await expect(page.getByRole('complementary', { name: '课堂节点' })).toContainText('具体问诊');
  await expect(page.getByRole('complementary', { name: '课堂节点' })).toContainText('入口练习');

  await page.getByRole('button', { name: '结束本课' }).click();
  await expect(page).toHaveURL(/\/course\/plan\/plan-001$/);
  await page.reload();
  await expect(page).toHaveURL(/\/course\/plan\/plan-001$/);
  await expect(page.getByRole('heading', { name: 'Plan 001：恒成立问题选路' })).toBeVisible();

  await page.getByRole('button', { name: '完成这一阶段' }).click();
  await expect(page).toHaveURL(/\/course$/);
  await page.getByRole('link', { name: '知识山河' }).click();
  await expect(page.getByRole('heading', { name: '知识山河' })).toBeVisible();
  await page.getByPlaceholder('方法、题卡编号或材料名').fill('参变量分离');
  await expect(page.getByRole('region', { name: '题卡资产' })).not.toContainText('没有匹配的题卡');

  expect((await page.request.get('/api/views/memory')).status()).toBe(404);
  await page.goto('/memory');
  await expect(page).toHaveURL(/\/course$/);
  await expect(page.getByRole('link', { name: '记忆' })).toHaveCount(0);
});
