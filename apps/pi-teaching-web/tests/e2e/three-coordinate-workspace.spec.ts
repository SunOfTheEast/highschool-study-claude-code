import {
  expect,
  test,
  type Page,
  type TestInfo,
} from '@playwright/test';

const fixtureOrigin = `http://127.0.0.1:${
  process.env.STUDYFORGE_E2E_API_PORT ?? 65000
}`;

const traceSource = 'trace:trace-fixture-001';

test.beforeEach(async ({ request }) => {
  const response = await request.post(
    `${fixtureOrigin}/__test/hierarchical-flow/reset`,
  );
  expect(response.ok()).toBe(true);
});

async function expectNoHorizontalPageOverflow(page: Page) {
  await expect.poll(() => page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))).toMatchObject({
    clientWidth: expect.any(Number),
    scrollWidth: expect.any(Number),
  });
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth
    <= document.documentElement.clientWidth + 1
  ))).toBe(true);
}

test('keeps one Lesson selected through Course, Knowledge, Memory and classroom', async ({
  page,
}) => {
  await page.goto('/course/plan/domain-integrity/lesson/lesson-003');
  await expect(page.getByRole('navigation', { name: '主视图' })).toBeVisible();
  await expect(page.getByLabel('专注课堂')).toBeVisible();
  const sessionKey = await page.getByTestId('session-owner')
    .getAttribute('data-session-key');

  await page.getByRole('link', { name: '知识山河' }).click();
  await expect(page).toHaveURL(/\/knowledge\?.*lesson=lesson-003/);
  await expect(page.getByLabel('知识山河')).toBeVisible();

  await page.getByRole('link', { name: '研习留痕' }).click();
  await expect(page).toHaveURL(/\/memory\?.*lesson=lesson-003/);
  await expect(page.getByLabel('研习留痕')).toBeVisible();

  await page.getByRole('link', { name: '课程脉络' }).click();
  await expect(page).toHaveURL(
    '/course/plan/domain-integrity/lesson/lesson-003',
  );
  await expect(page.getByTestId('session-owner')).toHaveAttribute(
    'data-session-key',
    sessionKey!,
  );

  await page.getByLabel('课堂节点')
    .getByRole('button', { name: /开始上课/ })
    .click();
  await expect(page.getByLabel('专注课堂')).toHaveAttribute(
    'data-lesson-status',
    'active',
  );
  await expect(page.getByTestId('session-owner')).toHaveAttribute(
    'data-session-key',
    sessionKey!,
  );
});

test('routes an objection to Coach with a draft but performs no fact write', async ({
  page,
}) => {
  await page.goto(
    `/memory?plan=domain-integrity&source=${encodeURIComponent(traceSource)}`,
  );
  await expect(page.getByLabel('来源详情')).toContainText('课堂学习记录');
  const writesBefore = await page.request
    .get(`${fixtureOrigin}/api/test/fact-write-count`)
    .then((response) => response.json());

  await page.getByRole('button', { name: '提出异议' }).click();

  await expect(page).toHaveURL('/course/plan/domain-integrity');
  await expect(page.getByRole('textbox')).toHaveValue(
    new RegExp(traceSource),
  );
  const writesAfter = await page.request
    .get(`${fixtureOrigin}/api/test/fact-write-count`)
    .then((response) => response.json());
  expect(writesAfter).toEqual(writesBefore);
});

test('does not leak prepared assessment bindings through Knowledge', async ({
  page,
}) => {
  await page.goto('/knowledge?plan=domain-integrity&lesson=lesson-003');
  await expect(page.getByLabel('知识山河')).toBeVisible();
  await expect(page.getByText('HIDDEN_ASSESSMENT_CARD')).toHaveCount(0);
  await expect(page.getByText('PRIVATE_TEACHING_CLAIM_TEXT')).toHaveCount(0);
  await expect(page.getByText('Teacher Control')).toHaveCount(0);
  await expect(page.getByText('绝密参数边界综合题')).toHaveCount(0);
});

const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'medium', width: 1024, height: 900 },
  { name: 'narrow', width: 390, height: 844 },
] as const;

const pages = [
  {
    name: 'course',
    path: '/course/plan/domain-integrity',
    label: '课程脉络',
  },
  {
    name: 'knowledge',
    path: '/knowledge?plan=domain-integrity&lesson=lesson-003',
    label: '知识山河',
  },
  {
    name: 'memory',
    path: `/memory?plan=domain-integrity&source=${encodeURIComponent(traceSource)}`,
    label: '研习留痕',
  },
  {
    name: 'classroom',
    path: '/course/plan/domain-integrity/lesson/lesson-003',
    label: '专注课堂',
  },
] as const;

for (const viewport of viewports) {
  test.describe(`visual acceptance at ${viewport.name}`, () => {
    test.use({ viewport });

    for (const view of pages) {
      test(`${view.name} keeps its hierarchy and interaction surface`, async ({
        page,
      }, testInfo: TestInfo) => {
        await page.goto(view.path);
        await expect(page.locator('.workspace-shell')).toBeVisible();
        await expect(page.getByLabel(view.label)).toBeVisible();
        await expect(page.getByRole('navigation', { name: '主视图' }))
          .toBeVisible();
        await expectNoHorizontalPageOverflow(page);

        if (view.name === 'course') {
          const selected = page.locator(
            '.course-tree button[aria-current="page"]',
          );
          await expect(selected).toContainText('定义域完整性的系统加固');
          await selected.focus();
          await expect(selected).toBeFocused();
          await expect(page.getByLabel('课程节点详情')).toBeVisible();
        }

        if (view.name === 'knowledge') {
          if (viewport.name === 'narrow') {
            await expect(page.locator('.method-list-fallback')).toBeVisible();
            await expect(page.locator('.method-canvas-scroll')).toBeHidden();
            await expect(page.locator('.method-list-fallback small').first())
              .toContainText(/尚未观察|已有学习记录|在不同题卡上更稳定/);
          } else {
            await expect(page.locator('.method-canvas-scroll')).toBeVisible();
            await expect(page.locator('.method-node small').first())
              .toContainText(/尚未观察|已有学习记录|在不同题卡上更稳定/);
          }
        }

        if (view.name === 'memory') {
          await expect(page.getByLabel('来源详情')).toContainText('当前有效');
          await expect(page.getByRole('button', { name: '提出异议' }))
            .toBeVisible();
        }

        if (view.name === 'classroom') {
          await expect(page.getByLabel('专注课堂')).toHaveAttribute(
            'data-lesson-status',
            'prepared',
          );
          await expect(page.getByLabel('课堂节点')
            .getByRole('button', { name: /开始上课/ }))
            .toBeVisible();
        }

        const coordinatePage = page.locator('.coordinate-page');
        if (await coordinatePage.count()) {
          await coordinatePage.evaluate(async (element) => {
            await Promise.all(
              element.getAnimations().map((animation) => animation.finished),
            );
          });
        }
        await page.screenshot({
          path: testInfo.outputPath(`${view.name}-${viewport.name}.png`),
          fullPage: true,
        });
      });
    }
  });
}

test('reduced motion keeps cross-view navigation usable', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/course/plan/domain-integrity');
  await page.getByRole('link', { name: '知识山河' }).click();
  await expect(page.getByLabel('知识山河')).toBeVisible();
  await page.getByRole('link', { name: '研习留痕' }).click();
  await expect(page.getByLabel('研习留痕')).toBeVisible();
});
