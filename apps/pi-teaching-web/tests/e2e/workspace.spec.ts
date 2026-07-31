import { expect, test } from '@playwright/test';

const fixtureOrigin = `http://127.0.0.1:${
  process.env.STUDYFORGE_E2E_API_PORT ?? 65000
}`;

test.beforeEach(async ({ request }) => {
  const response = await request.post(
    `${fixtureOrigin}/__test/hierarchical-flow/reset`,
  );
  expect(response.ok()).toBe(true);
});

function courseNode(page: import('@playwright/test').Page, text: string) {
  return page.locator('.course-tree button').filter({ hasText: text }).first();
}

test('leaving the classroom for Knowledge does not pause or recreate it', async ({ page }) => {
  await page.goto('/course/plan/domain-integrity/lesson/lesson-001');
  await expect(page.getByLabel('课堂对话')).toBeVisible();
  const owner = page.getByTestId('session-owner');
  const session = await owner.getAttribute('data-session-key');
  await page.getByRole('link', { name: '知识山河' }).click();
  await page.getByRole('link', { name: '课程脉络' }).click();
  await expect(page).toHaveURL('/course/plan/domain-integrity/lesson/lesson-001');
  await expect(owner).toHaveAttribute('data-session-key', session!);
  await expect(page.getByText('已暂停，可以继续')).toHaveCount(0);
});

test('keeps global planning available without turning it into the home workspace', async ({ page }) => {
  await page.goto('/course');

  await expect(page.getByLabel('课程脉络')).toBeVisible();
  await expect(courseNode(page, '定义域完整性的系统加固')).toBeVisible();
  await expect(page.locator('.app-root')).toHaveAttribute(
    'data-view',
    'roadmap',
  );
  await expect(page.getByText('这里用于回看整个学习集')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toHaveCount(0);

  await page.reload();
  await expect(page).toHaveURL(/\/course$/);
  await expect(page.getByText('这里用于回看整个学习集')).toBeVisible();
  await expect(courseNode(page, '定义域完整性的系统加固')).toBeVisible();
});

test('restores and submits one Plan memory review without duplicating its chat card', async ({ page }) => {
  await page.goto('/course/plan/domain-integrity');

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
  await page.goto('/course');
  await expect(page.getByLabel('课程脉络')).toBeVisible();
  await page.goto('/course/plan/domain-integrity');
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toContainText('学习顾问');
  const prepared = courseNode(page, '待开始课程');
  await expect(prepared).toContainText('待开始');
  await expect(page.locator('article.problem-card')).toHaveCount(0);
  await prepared.click();
  await expect(page).toHaveURL(
    /\/course\/plan\/domain-integrity\/lesson\/lesson-003$/,
  );
  await expect(page.locator('article.problem-card')).toHaveCount(0);
  await page.getByLabel('课堂节点')
    .getByRole('button', { name: /开始上课/ })
    .click();
  await expect(
    page.locator('.classroom-navigation')
      .locator('article.problem-card')
      .getByText('Q-DOMAIN-EX22', { exact: true }),
  ).toBeVisible();
  await expect(
    page.locator('.classroom-navigation')
      .locator('article.problem-card')
      .getByText('Q-DOMAIN-EX16', { exact: true }),
  ).toHaveCount(0);
  await expect(page.getByText(/D，即/)).toHaveCount(0);
});

test('refetches the Roadmap after returning to the learning-set home', async ({ page }) => {
  await page.goto('/course');
  await expect(courseNode(page, '同构变形')).toHaveCount(0);
  await page.goto('/course/plan/domain-integrity');
  await page.request.post(`${fixtureOrigin}/__test/register-plan`);

  await page.goto('/course');

  await expect(courseNode(page, '同构变形')).toBeVisible();
});

test('keeps the prepared gate and shows actionable admission issues', async ({ page }) => {
  await page.request.post(`${fixtureOrigin}/__test/reject-next-lesson-start`);
  await page.goto('/course/plan/domain-integrity');
  await courseNode(page, '待开始课程').click();
  await page.getByLabel('课堂节点')
    .getByRole('button', { name: /开始上课/ })
    .click();

  await expect(page.getByRole('alert')).toContainText('这节课还没备完整');
  await expect(page.getByRole('alert')).toContainText('Q-MISSING');
  await expect(page.getByRole('alert')).toContainText('请返回学习顾问修正');
  await expect(page).toHaveURL(
    /\/course\/plan\/domain-integrity\/lesson\/lesson-003$/,
  );
  await expect(page.getByLabel('专注课堂')).toHaveAttribute(
    'data-lesson-status',
    'prepared',
  );
});

test('marks the approved theme and current learning surface', async ({ page }) => {
  await page.goto('/course');
  await expect(page.locator('.app-root')).toHaveAttribute(
    'data-theme',
    'liubai-xinzhongshi',
  );

  await page.goto('/course/plan/domain-integrity');
  await expect(page.locator('.app-root')).toHaveAttribute(
    'data-theme',
    'liubai-xinzhongshi',
  );
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');

  await courseNode(page, '待开始课程').click();
  await expect(page.getByLabel('专注课堂')).toHaveAttribute(
    'data-lesson-status',
    'prepared',
  );

  await page.goto('/course/plan/domain-integrity/lesson/lesson-001');
  await expect(page.getByLabel('专注课堂')).toHaveAttribute(
    'data-lesson-status',
    'closed',
  );
});

test('shows the current Plan planning rationale', async ({ page }) => {
  await page.goto('/course/plan/domain-integrity');
  const rationale = page.getByRole('region', { name: '为什么这样安排' });
  await expect(rationale).toBeVisible();
  await expect(rationale).toContainText('定义域遗漏已经成为稳定阻塞点');
  await expect(rationale).not.toContainText('Teacher Control');
});

test('publishes a fact-writing tool result without breaking the live classroom', async ({ page }) => {
  await page.goto('/course/plan/domain-integrity');
  await courseNode(page, '待开始课程').click();
  await expect(page).toHaveURL(/\/course\/plan\/domain-integrity\/lesson\/lesson-003$/);
  await page.getByLabel('课堂节点')
    .getByRole('button', { name: /开始上课/ })
    .click();
  const composer = page.locator('form.composer');
  await page.getByPlaceholder('写下你的想法或解题过程…').fill('我尝试用链式法则。');
  await composer.evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect.poll(async () => {
    const response = await page.request.get(
      `${fixtureOrigin}/api/test/fact-write-count`,
    );
    return (await response.json() as { count: number }).count;
  }).toBe(1);
  await expect(page.getByLabel('专注课堂')).toHaveAttribute(
    'data-lesson-status',
    'active',
  );
  await expect(page.locator('.connection-banner')).toHaveCount(0);
});

test('restores Coach and closed Lesson views from browser routes', async ({ page }) => {
  await page.goto('/course/plan/domain-integrity');
  await expect(page).toHaveURL(/\/course\/plan\/domain-integrity$/);
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');

  await courseNode(page, 'Lesson 001').click();
  await expect(page).toHaveURL(/\/course\/plan\/domain-integrity\/lesson\/lesson-001$/);
  await expect(page.getByLabel('专注课堂')).toHaveAttribute(
    'data-lesson-status',
    'closed',
  );
  await page.reload();
  await expect(page.getByLabel('专注课堂')).toHaveAttribute(
    'data-lesson-status',
    'closed',
  );
  await expect(page.locator('.connection-banner')).toHaveCount(0);

  await page.evaluate(async () => {
    const response = await fetch('/api/lessons/lesson-003/start', { method: 'POST' });
    if (!response.ok) throw new Error(`snapshot trigger failed: ${response.status}`);
  });
  await expect(page).toHaveURL(/\/course\/plan\/domain-integrity\/lesson\/lesson-001$/);
  await expect(page.getByLabel('专注课堂')).toHaveAttribute(
    'data-lesson-status',
    'closed',
  );

  await page.goBack();
  await expect(page).toHaveURL(/\/course\/plan\/domain-integrity$/);
  await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');
  await page.goForward();
  await expect(page).toHaveURL(/\/course\/plan\/domain-integrity\/lesson\/lesson-001$/);
  await expect(page.getByLabel('专注课堂')).toHaveAttribute(
    'data-lesson-status',
    'closed',
  );
});

test('keeps the closed Tutor replay until the student returns to Coach', async ({ page }) => {
  try {
    await page.goto('/course/plan/domain-integrity/lesson/lesson-003');
    const start = page.getByRole('button', { name: /开始上课|继续上课/ });
    const composer = page.locator('form.composer');
    await expect(start.or(composer)).toBeVisible();
    if (await start.isVisible()) {
      await start.click();
    }
    await expect(composer).toBeVisible();
    await expect(page.locator('.connection-banner')).toHaveCount(0);
    await page.request.post(`${fixtureOrigin}/__test/close-lesson`);

    await expect(page).toHaveURL(/\/course\/plan\/domain-integrity\/lesson\/lesson-003$/);
    await expect(page.getByLabel('专注课堂')).toHaveAttribute(
      'data-lesson-status',
      'closed',
    );
    await expect(page.getByText('这节课先停在这里。')).toBeVisible();
    await expect(page.getByText('完成第一项核验；第二项尚未进行。')).toBeVisible();
    await expect(page.locator('form.composer')).toHaveCount(0);

    await page.getByLabel('课堂节点')
      .getByRole('button', { name: /返回学习顾问/ })
      .click();
    await expect(page).toHaveURL(/\/course\/plan\/domain-integrity$/);
    await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');
  } finally {
    await page.request.post(`${fixtureOrigin}/__test/reset-close-lesson`);
  }
});

test('connects the active classroom, persona and remembered route without leaking future content', async ({ page }) => {
  test.setTimeout(40_000);
  await page.request.post(`${fixtureOrigin}/__test/panel-flow/start`);
  try {
    await page.goto('/course');

    await courseNode(page, '定义域完整性的系统加固').click();
    const continuation = courseNode(page, 'Lesson 004');
    await expect(continuation).toBeVisible();
    await continuation.click();
    await expect(page).toHaveURL(/\/course\/plan\/domain-integrity\/lesson\/lesson-004$/);

    const stage = page.getByRole('region', { name: '当前课堂' });
    await expect(stage).toContainText('Q-DOMAIN-EX22');
    await expect(stage).not.toContainText('Q-DOMAIN-EX16');
    await expect(page.locator('.workspace-shell')).not.toContainText(
      'Teacher Control',
    );

    await page.getByRole('button', { name: '打开陪伴风格' }).click();
    const persona = page.getByRole('dialog', { name: '陪伴风格' });
    await expect(persona).toContainText('青黛学伴');
    await expect(persona).not.toContainText('INTERNAL');
    await persona.getByRole('button', { name: /青黛学伴/ }).click();
    await expect(page.locator('.workspace-shell'))
      .toHaveAttribute('data-persona', 'custom-guide');
    await expect.poll(() => page.locator('.workspace-shell').evaluate((element) => (
      getComputedStyle(element).getPropertyValue('--persona-accent').trim()
    ))).toBe('#48636f');

    await page.reload();
    await expect(stage).toContainText('Q-DOMAIN-EX22');
    await expect(page.getByRole('button', { name: '暂停课堂' })).toBeVisible();
    await expect(page.locator('form.composer')).toBeVisible();
    await expect(stage).toContainText('Q-DOMAIN-EX22');

    const saved = await page.evaluate(() => localStorage.getItem('studyforge.lastVisitedRoute'));
    expect(saved).toBe('/course/plan/domain-integrity/lesson/lesson-004');
    await page.goto('/course');
    await courseNode(page, '定义域完整性的系统加固').click();
    await expect(courseNode(page, 'Lesson 004')).toBeVisible();
  } finally {
    await page.request.post(`${fixtureOrigin}/__test/panel-flow/reset`);
  }
});

test('keeps the composer clickable when the current problem is taller than the viewport', async ({ page }) => {
  await page.request.post(`${fixtureOrigin}/__test/panel-flow/start`);
  try {
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.goto('/course/plan/domain-integrity/lesson/lesson-004');

    const stage = page.getByRole('region', { name: '当前课堂' });
    const submit = page.locator('form.composer button[type="submit"]');
    await expect(stage).toBeVisible();
    await expect(submit).toBeVisible();

    await page.locator('.classroom-navigation .problem-card').evaluate((card) => {
      (card as HTMLElement).style.minHeight = '70rem';
    });
    await submit.scrollIntoViewIfNeeded();

    expect(await submit.evaluate((button) => {
      const rect = button.getBoundingClientRect();
      const hit = document.elementFromPoint(
        rect.left + rect.width / 2,
        rect.top + rect.height / 2,
      );
      return hit === button || hit?.closest('button') === button;
    })).toBe(true);
  } finally {
    await page.request.post(`${fixtureOrigin}/__test/panel-flow/reset`);
  }
});

test('returns invalid deep links to the learning-set home', async ({ page }) => {
  await page.goto('/course/plan/does-not-exist');
  await expect(page).toHaveURL(/\/course$/);
  await expect(page.getByLabel('课程脉络')).toBeVisible();
  await expect(page.getByRole('alert')).toContainText('无法恢复');
});

test('renders the liubai palette without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/course');

  const palette = await page.locator('.workspace-shell').evaluate((element) => {
    const styles = getComputedStyle(element);
    return {
      paper: styles.getPropertyValue('--paper').trim(),
      ink: styles.getPropertyValue('--ink').trim(),
      accent: styles.getPropertyValue('--accent').trim(),
    };
  });
  expect(palette).toEqual({ paper: '#faf7f1', ink: '#1b1916', accent: '#3f5b54' });

  await courseNode(page, '定义域完整性的系统加固').click();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toBeVisible();
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    390,
  );
});

test('switches Plans only after the student clicks another Plan', async ({ page }) => {
  const registered = await page.request.post(`${fixtureOrigin}/__test/register-plan`);
  const { planId } = await registered.json() as { planId: string };
  await page.request.post(`${fixtureOrigin}/__test/complete-isomorphic-plan`);
  await page.goto(`/course/plan/${planId}`);

  await expect(page).toHaveURL(new RegExp(`/course/plan/${planId}$`));
  await expect(page.getByText('继续其他 Plan', { exact: true })).toBeVisible();
  const nextPlan = page.getByRole('button', {
    name: /定义域完整性的系统加固.*打开学习顾问/,
  });
  await expect(nextPlan).toBeVisible();

  await nextPlan.click();

  await expect(page).toHaveURL(/\/course\/plan\/domain-integrity$/);
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
    await page.goto('/course/plan/domain-integrity');
    const secretTitle = '绝密参数边界综合题';
    const ready = page.locator('article.lesson-ready-card');
    await expect(ready).toBeVisible();
    await expect(ready).toContainText('这一节已经准备好');
    await expect(ready).toContainText('完成一次独立能力检验');
    await expect(ready).toContainText('5 个课堂环节');
    await expect(ready).toContainText('mst_p0032_ex22');
    await expect(page.locator('.app-root')).not.toContainText(secretTitle);
    await expect(courseNode(page, '待开始课程')).toBeVisible();

    await page.reload();
    await expect(ready).toBeVisible();
    await expect(page.locator('.app-root')).not.toContainText(secretTitle);
    await ready.getByRole('button', { name: '开始上课' }).click();
    await expect(page).toHaveURL(/\/course\/plan\/domain-integrity\/lesson\/lesson-003$/);
    await expect(page.getByTestId('session-owner')).toContainText(secretTitle);

    const completed = await page.request.post(
      `${fixtureOrigin}/__test/student-safe-flow/complete`,
    );
    expect(completed.ok()).toBe(true);
    await expect(page.getByLabel('专注课堂')).toHaveAttribute(
      'data-lesson-status',
      'closed',
    );
    await page.getByLabel('课堂节点')
      .getByRole('button', { name: /返回学习顾问/ })
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
    await expect(page.getByLabel('研习留痕')).toBeVisible();
    await expect(page.getByLabel('来源详情')).toContainText(
      '独立完成定义域与参数边界判断',
    );
    await page.goto('/course/plan/domain-integrity');
    await expect(review).toBeVisible();
    await review.getByText('为什么这样判断').click();

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
