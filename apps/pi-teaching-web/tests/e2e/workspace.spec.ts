import { expect, test } from '@playwright/test';

test('hides future cards and reveals only the first active problem after start', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '导数学习 Roadmap' })).toBeVisible();
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toContainText('Coach');
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toContainText('Lesson 003');
  await page.getByRole('button', { name: /Lesson 003/ }).click();
  await expect(page.locator('article.problem-card')).toHaveCount(0);
  await page.getByRole('button', { name: /开始上课/ }).click();
  await expect(
    page.locator('article.problem-card').getByText('Q-DOMAIN-EX22', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('article.problem-card').getByText('Q-DOMAIN-EX16', { exact: true }),
  ).toHaveCount(0);
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

  await page.getByRole('button', { name: /Lesson 001/ }).click();
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');
});

test('renders the liubai palette without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const palette = await page.locator('main.home').evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      paper: styles.getPropertyValue('--paper').trim(),
      ink: styles.getPropertyValue('--ink').trim(),
      accent: styles.getPropertyValue('--accent').trim(),
    };
  });
  expect(palette).toEqual({ paper: '#faf7f1', ink: '#1b1916', accent: '#3f5b54' });

  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    390,
  );
});
