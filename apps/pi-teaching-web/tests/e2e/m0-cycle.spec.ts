import { expect, test } from '@playwright/test';

test('publishes and restores a printable handout only after the student asks for it', async ({ page }) => {
  await page.goto('/course/plan/plan-001');
  await expect(page.getByText('本地已连接')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Plan 001：恒成立问题选路' })).toBeVisible();
  await expect(page.getByRole('link', { name: '查看并打印讲义' })).toHaveCount(0);

  const response = await page.request.post(
    '/api/sessions/plan%3Aplan-001/messages',
    { data: { text: '要讲义' } },
  );
  expect(response.status()).toBe(202);
  const handoutLink = page.getByRole('link', { name: '查看并打印讲义' });
  await expect(handoutLink).toBeVisible();

  await page.reload();
  await expect(page.getByRole('link', { name: '查看并打印讲义' })).toBeVisible();
  await page.getByRole('link', { name: '查看并打印讲义' }).click();
  await expect(page).toHaveURL(
    /\/course\/plan\/plan-001\/lesson\/lesson-001\/handout\/block-002,block-001$/,
  );
  await expect(page.getByText('先观察这道题的参数位置')).toBeVisible();
  await expect(page.getByText('追问具体结构')).toHaveCount(0);

  await page.evaluate(() => {
    window.print = () => document.body.setAttribute('data-print-called', 'true');
  });
  await page.getByRole('button', { name: '打印 / 另存为 PDF' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-print-called', 'true');

  await page.getByRole('link', { name: '返回本课' }).click();
  await expect(page.getByRole('button', { name: '开始本课' })).toBeVisible();
});

test('completes the M0 Roadmap, Plan, Lesson and Knowledge browser cycle', async ({ page }) => {
  let delayClosedLessonReload = false;
  await page.route('**/api/course?selected=*', async (route) => {
    const selected = new URL(route.request().url()).searchParams.get('selected');
    if (
      delayClosedLessonReload
      && selected === 'plans/plan-001/lessons/lesson-001.md'
    ) {
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    await route.continue();
  });

  await page.goto('/course');

  await expect(page.getByRole('heading', { name: '导数结构学习路线' })).toBeVisible();
  await expect(page.getByText('继续学习', { exact: true })).toBeVisible();
  await expect(page.getByPlaceholder('写下你的想法或解题过程…')).toHaveCount(0);
  await page.getByRole('link', { name: /与老师讨论路线/ }).click();
  await expect(page).toHaveURL(/\/course\/roadmap$/);
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
  await page.getByPlaceholder('写下你的想法或解题过程…').fill('我先观察参数出现的位置。');
  await page.getByRole('button', { name: /发送/ }).click();
  await expect(page.getByText('我先观察参数出现的位置。', { exact: true })).toBeVisible();
  const displayFormula = page.locator('.katex-display').first();
  await expect(displayFormula).toBeVisible();
  await page.setViewportSize({ width: 375, height: 812 });
  await displayFormula.locator('.katex').evaluate((element) => {
    (element as HTMLElement).style.display = 'inline-block';
    (element as HTMLElement).style.minWidth = '720px';
  });
  const overflow = await page.evaluate(() => {
    const formula = document.querySelector('.katex-display') as HTMLElement;
    return {
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: document.documentElement.clientWidth,
      formulaWidth: formula.scrollWidth,
      formulaViewport: formula.clientWidth,
    };
  });
  expect(overflow.documentWidth).toBe(overflow.viewportWidth);
  expect(overflow.formulaWidth).toBeGreaterThan(overflow.formulaViewport);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.getByRole('button', { name: '展开节点原文' }).click();
  await expect(page.getByRole('complementary', { name: '课堂节点' })).toContainText('具体问诊');
  await expect(page.getByRole('complementary', { name: '课堂节点' })).toContainText('入口练习');

  delayClosedLessonReload = true;
  await page.getByRole('button', { name: '结束本课' }).click();
  await expect(page).toHaveURL(/\/course\/plan\/plan-001$/);
  await page.waitForTimeout(400);
  await expect(page.getByRole('heading', { name: 'Plan 001：恒成立问题选路' })).toBeVisible();
  await page.goto('/course/plan/plan-001/lesson/lesson-001');
  await expect(page.getByText('已结束 · 只读')).toBeVisible();
  await expect(page.getByPlaceholder('开始这个节点后即可对话')).toBeDisabled();
  await expect(page.getByText('我先观察参数出现的位置。', { exact: true })).toBeVisible();
  await page.goto('/course/plan/plan-001');
  await page.reload();
  await expect(page).toHaveURL(/\/course\/plan\/plan-001$/);
  await expect(page.getByRole('heading', { name: 'Plan 001：恒成立问题选路' })).toBeVisible();

  await page.getByRole('button', { name: '完成这一阶段' }).click();
  await expect(page).toHaveURL(/\/course$/);
  await page.goto('/knowledge');
  await expect(page.getByRole('heading', { name: '知识山河' })).toBeVisible();
  await page.getByPlaceholder('方法、题卡编号或材料名').fill('参变量分离');
  await expect(page.getByRole('region', { name: '题卡资产' })).not.toContainText('没有匹配的题卡');

  expect((await page.request.get('/api/views/memory')).status()).toBe(404);
  await page.goto('/memory');
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { name: '导数结构学习集' })).toBeVisible();
  await expect(page.getByRole('link', { name: '记忆' })).toHaveCount(0);
});

test('opens a standalone printable Lesson handout from its canonical URL', async ({ page }) => {
  await page.goto(
    '/course/plan/plan-001/lesson/lesson-001/handout/block-002,block-001',
  );

  await expect(page.getByRole('heading', { name: 'Lesson 001：真实停点问诊' }))
    .toBeVisible();
  await expect(page.getByRole('button', { name: '打印 / 另存为 PDF' })).toBeVisible();
  await expect(page.getByText('先观察这道题的参数位置')).toBeVisible();
  await expect(page.getByText('最近遇到哪一种恒成立问题')).toBeVisible();
  await expect(page.getByLabel('课程组织')).toHaveCount(0);
  await expect(page.getByLabel('课堂对话')).toHaveCount(0);
  await expect(page.getByText('Teacher Control')).toHaveCount(0);
  await expect(page.getByText('追问具体结构')).toHaveCount(0);
});
