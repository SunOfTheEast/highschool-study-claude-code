import { expect, test } from '@playwright/test';

test('toggles deep mode and confirms a workflow without adding sidebar agents', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await page.getByRole('button', { name: /深度模式/ }).click();
  await expect(page.getByText('深度模式已允许')).toBeVisible();
  const workflow = page.locator('.workflow').filter({ hasText: '备课多视角检查' });
  await expect(workflow).toBeVisible();
  await expect(workflow.getByText('20,000 Token')).toBeVisible();
  await workflow.getByRole('button', { name: '确认运行' }).click();
  await expect(workflow.getByText('3/3 已完成')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' }))
    .not.toContainText('证据分析员');
  await expect(page.locator('.timeline')).not.toContainText('子 Session');
});

test('cancels unfinished work and keeps a completed branch visible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  const workflow = page.locator('.workflow').filter({ hasText: '可取消会诊' });
  await expect(workflow.getByText('分析完成')).toBeVisible();
  await workflow.getByRole('button', { name: '取消' }).click();
  await expect(workflow.getByText('已取消')).toBeVisible();
  await expect(workflow.getByText('分析完成')).toBeVisible();
});
