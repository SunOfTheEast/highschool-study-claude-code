import { expect, test, type Page } from '@playwright/test';

const fixtureOrigin = `http://127.0.0.1:${
  process.env.STUDYFORGE_E2E_API_PORT ?? 65000
}`;

type FlowState = {
  planId: string | null;
  firstLessonId: string | null;
  secondLessonId: string | null;
  firstClaim: string | null;
  firstTrace: string | null;
  replacementTrace: string | null;
  memoryReviewId: string | null;
  sourceOnlyClosed: boolean;
  parallelPlansObserved: boolean;
  checkpointId: string | null;
};

let state: FlowState;

async function post<T>(
  page: Page,
  path: string,
  expectedStatus = 200,
): Promise<T> {
  const response = await page.request.post(`${fixtureOrigin}${path}`);
  expect(response.status()).toBe(expectedStatus);
  return await response.json() as T;
}

async function readState(page: Page): Promise<FlowState> {
  const response = await page.request.get(
    `${fixtureOrigin}/__test/hierarchical-flow/state`,
  );
  expect(response.ok()).toBe(true);
  return await response.json() as FlowState;
}

test.describe.serial('hierarchical learning runtime', () => {
  test.beforeAll(async ({ request }) => {
    const response = await request.post(
      `${fixtureOrigin}/__test/hierarchical-flow/reset`,
    );
    expect(response.ok()).toBe(true);
  });

  test.afterAll(async ({ request }) => {
    await request.post(`${fixtureOrigin}/__test/hierarchical-flow/reset`);
  });

  test('moves a Roadmap candidate into one student-started Plan and keeps the next Lesson private', async ({ page }) => {
    await post(page, '/__test/hierarchical-flow/add-plan-candidate');
    await page.goto('/course');

    const planCandidate = page.locator(
      '.course-tree li[data-status="candidate"]',
    ).filter({ hasText: '训练跨结构判断' });
    await expect(planCandidate).toContainText('训练跨结构判断');
    await planCandidate.getByRole('button').click();
    await expect(page).toHaveURL(/\/course$/);
    await expect(page.getByLabel('课程节点详情')).toContainText(
      '这一分支还在讨论中',
    );

    state = await post<FlowState>(
      page,
      '/__test/hierarchical-flow/prepare-plan',
    );
    expect(state.planId).not.toBeNull();
    await page.reload();

    await page.getByRole('button', { name: /跨结构判断周期/ }).click();
    await expect(page).toHaveURL(new RegExp(`/course/plan/${state.planId}$`));
    await expect(page.locator('.app-root')).toHaveAttribute(
      'data-view',
      'coach',
    );

    await post(page, '/__test/hierarchical-flow/add-lesson-candidates');
    state = await post<FlowState>(
      page,
      '/__test/hierarchical-flow/prepare-first-lesson',
    );
    await page.reload();

    const prepared = page.locator(
      '.course-tree li[data-status="prepared"]',
    ).filter({ hasText: '待开始课程' });
    await expect(prepared).toContainText('待开始课程');
    await expect(prepared).not.toContainText('HIERARCHICAL_FIRST_TRUE_TITLE');
    const candidate = page.locator(
      '.course-tree li[data-status="candidate"]',
    ).filter({ hasText: '根据第一课表现继续迁移' });
    await expect(candidate).toContainText('根据第一课表现继续迁移');
    await candidate.getByRole('button').click();
    await expect(page).toHaveURL(
      new RegExp(`/course/plan/${state.planId}$`),
    );
    await expect(page.getByLabel('课程节点详情')).toContainText(
      '这一分支还在讨论中',
    );
    await expect(page.locator('.app-root')).not.toContainText(
      'PRIVATE_BRANCH_ONLY',
    );
    await expect(page.locator('.app-root')).not.toContainText(
      'SECRET_METHOD_ROUTE',
    );
    await expect(page.locator('.app-root')).not.toContainText(
      'Teacher Control',
    );
  });

  test('enforces child ownership, closes two Lessons, and invalidates an old Claim after correction', async ({ page }) => {
    state = await readState(page);
    await page.goto(`/course/plan/${state.planId}`);
    await page.locator('.course-tree li[data-status="prepared"] button')
      .click();
    await expect(page).toHaveURL(
      new RegExp(
        `/course/plan/${state.planId}/lesson/${state.firstLessonId}$`,
      ),
    );
    await expect(page.getByTestId('session-owner')).toContainText(
      'HIERARCHICAL_FIRST_TRUE_TITLE',
    );
    await page.getByLabel('课堂节点')
      .getByRole('button', { name: /开始上课/ })
      .click();
    await expect(page.getByLabel('专注课堂')).toHaveAttribute(
      'data-lesson-status',
      'active',
    );

    state = await post<FlowState>(
      page,
      '/__test/hierarchical-flow/prepare-second-lesson',
    );
    const blocked = await page.request.post(
      `${fixtureOrigin}/api/lessons/${state.secondLessonId}/start`,
    );
    expect(blocked.ok()).toBe(false);

    const authority = await post<{
      roadmap: string;
      plan: string;
    }>(page, '/__test/hierarchical-flow/check-parent-authority');
    expect(authority.roadmap).toContain('MATERIALIZED_IMMUTABLE');
    expect(authority.plan).toContain('MATERIALIZED_IMMUTABLE');

    await expect(page.locator('.workspace-shell')).not.toContainText(
      'PRIVATE_BRANCH_ONLY',
    );
    await expect(page.locator('.workspace-shell')).not.toContainText(
      'HIERARCHICAL_SECOND_TRUE_TITLE',
    );

    state = await post<FlowState>(
      page,
      '/__test/hierarchical-flow/complete-first-lesson',
    );
    await page.reload();
    await expect(page.getByLabel('专注课堂')).toHaveAttribute(
      'data-lesson-status',
      'closed',
    );
    await expect(page.locator('form.composer')).toHaveCount(0);

    let evidence = await page.request.get(
      `${fixtureOrigin}/api/evidence?source=${encodeURIComponent(
        state.firstClaim!,
      )}`,
    );
    expect(evidence.ok()).toBe(true);
    expect((await evidence.json()).state).toBe('active');

    state = await post<FlowState>(
      page,
      '/__test/hierarchical-flow/supersede-first-trace',
    );
    evidence = await page.request.get(
      `${fixtureOrigin}/api/evidence?source=${encodeURIComponent(
        state.firstClaim!,
      )}`,
    );
    expect((await evidence.json()).state).toBe('invalidated');

    const secondStart = await page.request.post(
      `${fixtureOrigin}/api/lessons/${state.secondLessonId}/start`,
    );
    expect(secondStart.ok()).toBe(true);
    state = await post<FlowState>(
      page,
      '/__test/hierarchical-flow/close-second-source-only',
    );
    expect(state.sourceOnlyClosed).toBe(true);

    state = await post<FlowState>(
      page,
      '/__test/hierarchical-flow/complete-plan-and-propose-memory',
    );
    await page.goto(`/course/plan/${state.planId}`);
    await expect(
      page.getByRole('region', { name: '阶段学习回顾' }),
    ).toBeVisible();
    await expect(
      page.locator('article.memory-review-card'),
    ).toHaveCount(1);
  });

  test('applies confirmed memory, drills through the evidence tree, and restores terminal routes', async ({ page }) => {
    state = await readState(page);
    await page.goto(`/course/plan/${state.planId}`);

    const card = page.locator('article.memory-review-card');
    await card.getByRole('button', { name: /逐条确认/ }).click();
    await page.getByRole('dialog', { name: '确认长期记忆' })
      .getByText('采用', { exact: true })
      .click();
    await page.getByRole('button', { name: '提交给学习顾问' }).click();
    await expect(card).toContainText('已写入长期画像');

    state = await post<FlowState>(
      page,
      '/__test/hierarchical-flow/write-roadmap-checkpoint',
    );
    expect(state.checkpointId).toBe('checkpoint-001');

    const review = page.getByRole('region', { name: '阶段学习回顾' });
    await review.getByText('为什么这样判断').click();
    await review.getByRole('button', { name: '查看这次表现' }).nth(1).click();
    await expect(page.getByLabel('研习留痕')).toBeVisible();
    await expect(page.getByLabel('来源详情')).toContainText(
      '来源后来被修正',
    );
    await page.goto(`/course/plan/${state.planId}`);

    await page.locator('.course-tree button')
      .filter({ hasText: 'HIERARCHICAL_FIRST_TRUE_TITLE' })
      .click();
    await expect(page.getByLabel('专注课堂')).toHaveAttribute(
      'data-lesson-status',
      'closed',
    );
    await page.reload();
    await expect(page.getByLabel('专注课堂')).toHaveAttribute(
      'data-lesson-status',
      'closed',
    );
    await expect(page.locator('form.composer')).toHaveCount(0);

    await page.goto('/course');
    await expect(page).toHaveURL(/\/course$/);
    await page.reload();
    await expect(page).toHaveURL(/\/course$/);

    state = await readState(page);
    expect(state.parallelPlansObserved).toBe(true);
    expect(state.sourceOnlyClosed).toBe(true);
    expect(state.checkpointId).toBe('checkpoint-001');
  });
});
