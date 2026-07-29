import { expect, test } from '@playwright/test';

const fixtureOrigin = `http://127.0.0.1:${
  process.env.STUDYFORGE_E2E_API_PORT ?? 65000
}`;

test('keeps global planning available without turning it into the home workspace', async ({ page }) => {
  await page.goto('/');

  const entry = page.getByRole('button', { name: /学习总览/ });
  await expect(entry).toBeVisible();
  await expect(entry).toHaveClass(/quiet/);
  await expect(page.getByRole('button', { name: /定义域完整性的系统加固/ }))
    .toBeVisible();

  await entry.click();
  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'roadmap');
  await expect(page.getByText('这里用于回看整个学习集')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(/\/roadmap$/);
  await expect(page.getByText('这里用于回看整个学习集')).toBeVisible();

  await page.getByRole('button', { name: /返回学习集/ }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('button', { name: /定义域完整性的系统加固/ }))
    .toBeVisible();
});

test('restores and submits one Plan memory review without duplicating its chat card', async ({ page }) => {
  await page.goto('/plan/domain-integrity');

  const card = page.locator('article.memory-review-card');
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('长期记忆待确认');
  await expect(page.getByText('这个学习周期已经结束。')).toBeVisible();

  await card.getByRole('button', { name: '稍后处理' }).click();
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('button', { name: /逐条确认/ })).toBeVisible();

  await page.reload();
  await expect(card).toHaveCount(1);
  await card.getByRole('button', { name: /逐条确认/ }).click();

  const items = page.locator('.memory-review-items > li');
  await expect(items).toHaveCount(3);
  await items.nth(0).getByText('采用', { exact: true }).click();
  await items.nth(1).getByText('改写后采用', { exact: true }).click();
  await items.nth(1).getByRole('textbox').fill('先让我完整说出判断依据，再决定是否提示。');
  await items.nth(2).getByText('不采用', { exact: true }).click();

  await page.getByRole('button', { name: '提交给学习顾问' }).click();
  await expect(page.getByRole('dialog', { name: '确认长期记忆' })).toHaveCount(0);
  await expect(card).toHaveCount(1);
  await expect(card).toContainText('已确认，待写入');
  await expect(card).not.toContainText('已写入长期画像');
});

test('hides future cards and reveals only the first active problem after start', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: '导数学习 Roadmap' })).toBeVisible();
  await page.goto('/plan/domain-integrity');
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toContainText('学习顾问');
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toContainText('待开始课程');
  await page.getByRole('button', { name: /待开始课程/ }).click();
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
  await page.goto('/plan/domain-integrity');
  await page.request.post(`${fixtureOrigin}/__test/register-plan`);

  await page.getByRole('button', { name: /返回学习集/ }).click();

  await expect(page.getByRole('button', { name: /同构变形/ })).toBeVisible();
});

test('keeps the prepared gate and shows actionable admission issues', async ({ page }) => {
  await page.request.post(`${fixtureOrigin}/__test/reject-next-lesson-start`);
  await page.goto('/plan/domain-integrity');
  await page.getByRole('button', { name: /待开始课程/ }).click();

  await page.getByRole('button', { name: /开始上课/ }).click();

  await expect(page.getByRole('alert')).toContainText('这节课还没备完整');
  await expect(page.getByRole('alert')).toContainText('Q-MISSING');
  await expect(page.getByRole('alert')).toContainText('请返回学习顾问修正');
  await expect(page.getByRole('button', { name: /开始上课/ })).toBeVisible();
});

test('marks the approved theme and current learning surface', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main.home')).toHaveAttribute(
    'data-theme',
    'liubai-xinzhongshi',
  );

  await page.goto('/plan/domain-integrity');
  await expect(page.locator('.app-root')).toHaveAttribute(
    'data-theme',
    'liubai-xinzhongshi',
  );
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');

  await page.getByRole('button', { name: /待开始课程/ }).click();
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
  await page.goto('/plan/domain-integrity');
  await page.getByRole('button', { name: /待开始课程/ }).click();
  await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-003$/);
  const start = page.getByRole('button', { name: /开始上课|继续上课/ });
  if (await start.count()) await start.click();
  const composer = page.locator('form.composer');
  await page.getByPlaceholder('写下你的想法或解题过程…').fill('我尝试用链式法则。');
  await composer.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await page.getByRole('button', { name: /学习顾问/ }).click();
  await expect(page.locator('.ability-nodes')).toContainText('链式求导');
  await expect(page.locator('.ability-nodes')).toContainText('2 条记录');
});

test('restores Coach and closed Lesson views from browser routes', async ({ page }) => {
  await page.goto('/plan/domain-integrity');
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
    await page.request.post(`${fixtureOrigin}/__test/close-lesson`);

    await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-003$/);
    await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');
    await expect(page.getByText('这节课先停在这里。')).toBeVisible();
    await expect(page.getByText('完成第一项核验；第二项尚未进行。')).toBeVisible();
    await expect(page.locator('.context-section').first()).toHaveAttribute('open', '');
    await expect(page.locator('form.composer')).toHaveCount(0);

    await page.getByRole('button', { name: /返回学习顾问/ }).click();
    await expect(page).toHaveURL(/\/plan\/domain-integrity$/);
    await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');
  } finally {
    await page.request.post(`${fixtureOrigin}/__test/reset-close-lesson`);
  }
});

test('connects the four product panels without leaking pending classroom content', async ({ page }) => {
  test.setTimeout(40_000);
  await page.request.post(`${fixtureOrigin}/__test/panel-flow/start`);
  try {
    await page.goto('/');

    const continuation = page.locator('.continue-entry');
    await expect(continuation).toHaveCount(1);
    await expect(continuation).toContainText('Lesson 004');
    await continuation.click();
    await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-004$/);

    const stage = page.getByRole('region', { name: '当前课堂' });
    await expect(stage).toContainText('Q-DOMAIN-EX22');
    await expect(stage).not.toContainText('Q-DOMAIN-EX16');
    await expect(page.locator('.app-root')).not.toContainText('Teacher Control');

    const contextSections = page.locator('.context-stack > .context-section');
    await expect(contextSections.first()).toHaveAttribute('open', '');
    await expect(contextSections.nth(1)).not.toHaveAttribute('open', '');
    await contextSections.filter({ hasText: '近期学习记录' }).locator('summary').click();
    await expect(page.locator('.recent-records')).toContainText('unique-active-term');

    await page.getByRole('button', { name: /研习资料/ }).click();
    const explorer = page.getByRole('dialog', { name: '研习资料' });
    await expect(explorer).toBeVisible();
    await explorer.getByRole('searchbox', { name: '搜索研习资料' }).fill('unique-active-term');
    await explorer.getByRole('button', { name: '查找', exact: true }).click();
    await expect(explorer.locator('.content-detail')).toContainText(
      'cards/derivative/mst_p0032_ex22.card.yaml',
    );
    await expect(explorer.locator('.content-traces > ol > li')).toHaveCount(1);
    await expect(explorer).toContainText('unique-active-term');
    await expect(explorer).not.toContainText('unique-superseded-term');
    await expect(explorer).not.toContainText('Q-DOMAIN-EX16');

    await explorer.locator('.content-traces button').click();
    const source = page.getByRole('dialog', { name: '记录来源' });
    await expect(source).toContainText('lesson-004 · assessment-01');
    await source.getByRole('button', { name: '关闭', exact: true }).click();
    await expect(explorer).toBeVisible();
    await expect(explorer.getByRole('searchbox')).toHaveValue('unique-active-term');
    await explorer.locator(':scope > header').getByRole('button', { name: '关闭' }).click();

    await page.getByRole('button', { name: '打开陪伴风格' }).click();
    const persona = page.getByRole('dialog', { name: '陪伴风格' });
    await expect(persona).toContainText('青黛学伴');
    await expect(persona).not.toContainText('INTERNAL');
    await persona.getByRole('button', { name: /青黛学伴/ }).click();
    await expect(page.locator('.app-root')).toHaveAttribute('data-persona', 'custom-guide');
    await expect.poll(() => page.locator('.app-root').evaluate((element) => (
      getComputedStyle(element).getPropertyValue('--persona-accent').trim()
    ))).toBe('#48636f');

    await page.reload();
    await expect(page.locator('.app-root')).toHaveAttribute('data-persona', 'custom-guide');
    await expect(stage).toContainText('Q-DOMAIN-EX22');

    await page.getByRole('navigation', { name: 'Plan sessions' })
      .getByRole('button', { name: /学习顾问/ })
      .click();
    await expect(page).toHaveURL(/\/plan\/domain-integrity$/);
    await page.getByRole('button', { name: /Lesson 004/ }).click();
    await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-004$/);
    await expect(page.getByRole('button', { name: '继续上课' })).toBeVisible();
    await expect(stage).toContainText('Q-DOMAIN-EX22');
    await page.getByRole('button', { name: '继续上课' }).click();
    await expect(page.locator('form.composer')).toBeVisible();
    await expect(stage).toContainText('Q-DOMAIN-EX22');

    const saved = await page.evaluate(() => localStorage.getItem('studyforge.lastVisitedRoute'));
    expect(saved).toBe('/plan/domain-integrity/lesson/lesson-004');
    await page.getByRole('button', { name: /Lesson 001/ }).click();
    await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');
    await page.reload();
    await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');
    await expect.poll(() => page.evaluate(
      () => localStorage.getItem('studyforge.lastVisitedRoute'),
    )).toBe('/plan/domain-integrity/lesson/lesson-004');

    await page.getByRole('button', { name: /返回学习集/ }).click();
    await expect(page.locator('.continue-entry')).toContainText('Lesson 004');
  } finally {
    await page.request.post(`${fixtureOrigin}/__test/panel-flow/reset`);
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
  await page.request.post(`${fixtureOrigin}/__test/register-plan`);
  await page.request.post(`${fixtureOrigin}/__test/complete-isomorphic-plan`);
  await page.goto('/plan/isomorphic-transformation');

  await expect(page).toHaveURL(/\/plan\/isomorphic-transformation$/);
  await expect(page.getByText('继续其他 Plan', { exact: true })).toBeVisible();
  const nextPlan = page.getByRole('button', {
    name: /定义域完整性的系统加固.*打开学习顾问/,
  });
  await expect(nextPlan).toBeVisible();

  await nextPlan.click();

  await expect(page).toHaveURL(/\/plan\/domain-integrity$/);
  await expect(page.getByRole('navigation', { name: 'Plan sessions' }))
    .toContainText('定义域完整性的系统加固');
});

test('keeps the preparation handoff safe and the completed review source-linked', async ({ page }) => {
  test.setTimeout(40_000);
  const fixture = await page.request.post(
    `${fixtureOrigin}/__test/student-safe-flow/start`,
  );
  expect(fixture.ok()).toBe(true);
  let sentMessages = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST'
      && /\/api\/sessions\/[^/]+\/messages$/.test(new URL(request.url()).pathname)
    ) {
      sentMessages += 1;
    }
  });

  try {
    await page.goto('/plan/domain-integrity');
    const secretTitle = '绝密参数边界综合题';
    const ready = page.locator('article.lesson-ready-card');
    await expect(ready).toBeVisible();
    await expect(ready).toContainText('这一节已经准备好');
    await expect(ready).toContainText('完成一次独立能力检验');
    await expect(ready).toContainText('5 个课堂环节');
    await expect(ready).toContainText('mst_p0032_ex22');
    await expect(page.locator('.app-root')).not.toContainText(secretTitle);
    await expect(page.getByRole('navigation', { name: 'Plan sessions' }))
      .toContainText('待开始课程');

    await page.reload();
    await expect(ready).toBeVisible();
    await expect(page.locator('.app-root')).not.toContainText(secretTitle);
    await ready.getByRole('button', { name: '开始上课' }).click();
    await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-003$/);
    await expect(page.getByRole('navigation', { name: 'Plan sessions' }))
      .toContainText(secretTitle);

    const completed = await page.request.post(
      `${fixtureOrigin}/__test/student-safe-flow/complete`,
    );
    expect(completed.ok()).toBe(true);
    await expect(
      page.getByRole('button', { name: new RegExp(secretTitle) }).getByText('已完成'),
    ).toBeVisible();
    await page.getByRole('navigation', { name: 'Plan sessions' })
      .getByRole('button', { name: /学习顾问/ })
      .click();

    const review = page.getByRole('region', { name: '阶段学习回顾' });
    await expect(review).toContainText('已经能独立把定义域用于参数边界判断');
    await expect(review).toContainText('两道本周期导数题');
    await expect(review).toContainText('下一周期再检查陌生嵌套结构');
    await review.getByText('为什么这样判断').click();
    await expect(review).toContainText('最能说明这一点');
    await expect(review).toContainText('可以作为参考');
    await expect(review).toContainText('还需要再看看');

    await review.getByRole('button', { name: '查看这次表现' }).first().click();
    const source = page.getByRole('dialog', { name: '记录来源' });
    await expect(source).toContainText('独立完成定义域与参数边界判断');
    await source.getByRole('button', { name: '关闭', exact: true }).click();

    const beforeDispute = sentMessages;
    await review.getByRole('button', {
      name: '这和我的实际情况不一样',
    }).first().click();
    await expect(page.getByPlaceholder('写下你的想法或解题过程…')).toHaveValue(
      /我对这条学习回顾有不同看法[\s\S]+我的补充：/,
    );
    expect(sentMessages).toBe(beforeDispute);

    const memory = page.locator('article.memory-review-card');
    await expect(memory).toHaveCount(1);
    await expect(memory).toContainText('已写入长期画像');
    await expect(memory).toContainText('写入 2');
    await expect(memory).toContainText('未更改 1');

    const raw = await page.request.get(
      `${fixtureOrigin}/__test/student-safe-flow/raw-history`,
    );
    expect(raw.ok()).toBe(true);
    expect(JSON.stringify(await raw.json())).toContain(
      '绝密参数边界综合题使用冻结变量法',
    );
  } finally {
    await page.request.post(
      `${fixtureOrigin}/__test/student-safe-flow/reset`,
    );
  }
});
