import { expect, test } from '@playwright/test';

test('moves from learning-set overview to Coach and a prepared Lesson preview', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '导数学习 Roadmap' })).toBeVisible();
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toContainText('Coach');
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toContainText('Lesson 003');
  await page.getByRole('button', { name: /Lesson 003/ }).click();
  await expect(
    page.locator('article.problem-card').getByText('Q-DOMAIN-EX22', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText(/D，即/)).toHaveCount(0);
});

test('marks the approved theme and current learning surface', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main.home')).toHaveAttribute(
    'data-theme',
    'liubai-xinzhongshi',
  );

  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await expect(page.locator('.app-root')).toHaveAttribute(
    'data-theme',
    'liubai-xinzhongshi',
  );
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');

  await page.getByRole('button', { name: /Lesson 003/ }).click();
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'tutor');
});
