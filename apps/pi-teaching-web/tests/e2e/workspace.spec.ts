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

test('refetches the Roadmap after returning to the learning-set home', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('button', { name: /同构变形/ })).toHaveCount(0);
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await page.request.post('http://127.0.0.1:65000/__test/register-plan');

  await page.getByRole('button', { name: /返回学习集/ }).click();

  await expect(page.getByRole('button', { name: /同构变形/ })).toBeVisible();
});

test('keeps the prepared gate and shows actionable admission issues', async ({ page }) => {
  await page.goto('/');
  await page.request.post('http://127.0.0.1:65000/__test/reject-next-lesson-start');
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await page.getByRole('button', { name: /Lesson 003/ }).click();

  await page.getByRole('button', { name: /开始上课/ }).click();

  await expect(page.getByRole('alert')).toContainText('这节课还没备完整');
  await expect(page.getByRole('alert')).toContainText('Q-MISSING');
  await expect(page.getByRole('alert')).toContainText('请返回 Coach 修正');
  await expect(page.getByRole('button', { name: /开始上课/ })).toBeVisible();
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

test('shows the current Plan planning rationale', async ({ page }) => {
  await page.goto('/plan/domain-integrity');
  const rationale = page.getByRole('region', { name: '为什么这样安排' });
  await expect(rationale).toBeVisible();
  await expect(rationale).toContainText('定义域遗漏已经成为稳定阻塞点');
  await expect(rationale).not.toContainText('Teacher Control');
});

test('refreshes the full ability map after a Tutor trace without reloading', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await page.getByRole('button', { name: /Lesson 003/ }).click();
  await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-003$/);
  const start = page.getByRole('button', { name: /开始上课|继续上课/ });
  if (await start.count()) await start.click();
  const composer = page.locator('form.composer');
  await page.getByPlaceholder('写下你的想法或解题过程…').fill('我尝试用链式法则。');
  await composer.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.getByRole('button', { name: /Coach/ }).click();
  await expect(page.locator('.ability-nodes')).toContainText('链式求导');
  await expect(page.locator('.ability-nodes')).toContainText('2 条证据');
});

test('restores Coach and closed Lesson views from browser routes', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await expect(page).toHaveURL(/\/plan\/domain-integrity$/);
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');

  await page.getByRole('button', { name: /Lesson 001/ }).click();
  await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-001$/);
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');
  await page.reload();
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');
  await expect(page.locator('.connection-banner')).toHaveCount(0);

  await page.evaluate(async () => {
    const response = await fetch('/api/lessons/lesson-003/start', { method: 'POST' });
    if (!response.ok) throw new Error(`snapshot trigger failed: ${response.status}`);
  });
  await expect(
    page.getByRole('button', { name: /Lesson 003/ }).getByText('上课中'),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-001$/);
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');

  await page.goBack();
  await expect(page).toHaveURL(/\/plan\/domain-integrity$/);
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');
  await page.goForward();
  await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-001$/);
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');
});

test('keeps the closed Tutor replay until the student returns to Coach', async ({ page }) => {
  try {
    await page.goto('/plan/domain-integrity/lesson/lesson-003');
    const start = page.getByRole('button', { name: /开始上课|继续上课/ });
    const composer = page.locator('form.composer');
    await expect(start.or(composer)).toBeVisible();
    if (await start.isVisible()) {
      await start.click();
    }
    await expect(composer).toBeVisible();
    await expect(page.locator('.connection-banner')).toHaveCount(0);
    await page.request.post('http://127.0.0.1:65000/__test/close-lesson');

    await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-003$/);
    await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');
    await expect(page.getByText('这节课先停在这里。')).toBeVisible();
    await expect(page.getByText('完成第一项核验；第二项尚未进行。')).toBeVisible();
    await expect(page.getByText('结束时所在节点')).toBeVisible();
    await expect(page.locator('form.composer')).toHaveCount(0);

    await page.getByRole('button', { name: /返回 Coach/ }).click();
    await expect(page).toHaveURL(/\/plan\/domain-integrity$/);
    await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');
  } finally {
    await page.request.post('http://127.0.0.1:65000/__test/reset-close-lesson');
  }
});

test('returns invalid deep links to the learning-set home', async ({ page }) => {
  await page.goto('/plan/does-not-exist');
  await expect(page).toHaveURL(/\/$/);
  await expect(page.locator('main.home')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('无法恢复');
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

test('switches Plans only after the student clicks another Plan', async ({ page }) => {
  await page.request.post('http://127.0.0.1:65000/__test/register-plan');
  await page.request.post('http://127.0.0.1:65000/__test/complete-isomorphic-plan');
  await page.goto('/plan/isomorphic-transformation');

  await expect(page).toHaveURL(/\/plan\/isomorphic-transformation$/);
  await expect(page.getByText('继续其他 Plan', { exact: true })).toBeVisible();
  const nextPlan = page.getByRole('button', {
    name: /定义域完整性的系统加固.*打开 Coach/,
  });
  await expect(nextPlan).toBeVisible();

  await nextPlan.click();

  await expect(page).toHaveURL(/\/plan\/domain-integrity$/);
  await expect(page.getByRole('navigation', { name: 'Plan sessions' }))
    .toContainText('定义域完整性的系统加固');
});
