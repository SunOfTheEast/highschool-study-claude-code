# Pi Teaching Web Liubai Theme Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将现有 Pi 教学前端的首页、Coach、Tutor、Replay 与证据透镜统一为已经确认的“留白新中式”主主题，同时保持全部教学行为和数据契约不变。

**Architecture:** 保留现有 React 组件树和三栏工作区，新增一个只负责语义色板与字体的 `theme-liubai.css`，现有 `styles.css` 继续负责布局和组件状态。`App` 只增加 `data-theme` 与 `data-view` 标识，让同一套组件能对 Coach、Tutor、Replay 做小范围视觉区分；服务端、Pi Session、Lesson、Trace 和题卡协议均不改动。

**Tech Stack:** React 19、TypeScript 7、CSS、Bun test、Playwright

**Design spec:** [`docs/superpowers/specs/2026-07-22-pi-teaching-web-liubai-theme-design.md`](../specs/2026-07-22-pi-teaching-web-liubai-theme-design.md)

## Global Constraints

- 主主题固定为 `liubai-xinzhongshi`，首版不增加主题选择器。
- 不新增 npm 依赖、图片、Web Font、Rive、Lottie 或新的前端状态存储。
- 不改变 Coach/Tutor Session、Lesson 生命周期、课堂节点、题卡、Trace、能力聚合或工作流 DTO。
- 不加入朱印、远山、仿纸颗粒、页面级渐变、玻璃拟态或重阴影。
- Persona 只能改变 `--persona-accent` 与 `--persona-wash`，不得重写结构色和教学状态色。
- 保留现有 `prefers-reduced-motion`、键盘焦点、状态文字和三档响应式断点。
- 只修改本计划列出的文件；现有 `examples/derivative-demo/learning-set/plans/domain-integrity.md` 与 `.superpowers/` 变更不属于本计划。

---

### Task 1: Establish the Liubai theme source of truth

**Files:**

- Create: `apps/pi-teaching-web/src/client/theme-liubai.css`
- Create: `apps/pi-teaching-web/tests/client/liubai-theme.test.ts`
- Modify: `apps/pi-teaching-web/src/client/main.tsx`

**Interfaces:**

- Produces: CSS custom properties `--paper`, `--paper-deep`, `--ink`, `--ink-soft`, `--ink-faint`, `--accent`, `--accent-deep`, `--accent-wash`, `--attention`, `--danger`, `--success`, `--rule`, `--rule-soft`, `--font-ui`, `--font-display`, `--font-reading`, `--persona-accent`, and `--persona-wash`.
- Consumed by: all selectors in `styles.css` and the view-specific styling in Task 3.

- [ ] **Step 1: Write the failing theme contract test**

Create `apps/pi-teaching-web/tests/client/liubai-theme.test.ts`:

```ts
import { describe, expect, test } from 'bun:test';

const theme = await Bun.file(
  new URL('../../src/client/theme-liubai.css', import.meta.url),
).text();
const main = await Bun.file(
  new URL('../../src/client/main.tsx', import.meta.url),
).text();

describe('liubai theme contract', () => {
  test('uses the approved palette as semantic tokens', () => {
    expect(theme).toContain('--paper: #faf7f1;');
    expect(theme).toContain('--paper-deep: #f1ece1;');
    expect(theme).toContain('--ink: #1b1916;');
    expect(theme).toContain('--ink-soft: #4a463d;');
    expect(theme).toContain('--ink-faint: #9a917f;');
    expect(theme).toContain('--accent: #3f5b54;');
    expect(theme).toContain('--accent-deep: #314a44;');
    expect(theme).toContain('--attention: #b6a06a;');
    expect(theme).toContain('--danger: #a8674f;');
    expect(theme).toContain('--rule: rgba(27, 25, 22, .09);');
  });

  test('keeps persona color local and loads the theme before layout styles', () => {
    expect(theme).toContain('.app-root[data-persona="neutral-tutor"]');
    expect(theme).toContain('.app-root[data-persona="calm-senpai"]');
    expect(theme).toContain('.app-root[data-persona="energetic-classmate"]');
    expect(theme).not.toContain('--amber');
    expect(main.indexOf("import './theme-liubai.css';"))
      .toBeLessThan(main.indexOf("import './styles.css';"));
  });
});
```

- [ ] **Step 2: Run the focused test and verify that it fails**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/liubai-theme.test.ts
```

Expected: FAIL because `theme-liubai.css` and its import do not exist.

- [ ] **Step 3: Create the theme file**

Create `apps/pi-teaching-web/src/client/theme-liubai.css` with exactly this baseline:

```css
:root {
  color: #1b1916;
  background: #faf7f1;
  color-scheme: light;
  font-family: Inter, "Noto Sans SC", "PingFang SC", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;

  --paper: #faf7f1;
  --paper-deep: #f1ece1;
  --ink: #1b1916;
  --ink-soft: #4a463d;
  --ink-faint: #9a917f;
  --accent: #3f5b54;
  --accent-deep: #314a44;
  --accent-wash: rgba(63, 91, 84, .07);
  --attention: #b6a06a;
  --danger: #a8674f;
  --success: #3f5b54;
  --rule: rgba(27, 25, 22, .09);
  --rule-soft: rgba(27, 25, 22, .06);
  --overlay: rgba(27, 25, 22, .28);

  --font-ui: Inter, "Noto Sans SC", "PingFang SC", sans-serif;
  --font-display: "LXGW WenKai", "Kaiti SC", "STKaiti", "KaiTi", ui-serif, serif;
  --font-reading: "Noto Serif SC", "Songti SC", ui-serif, serif;
  --persona-accent: #3f5b54;
  --persona-wash: rgba(63, 91, 84, .07);
}

.app-root[data-persona="neutral-tutor"] {
  --persona-accent: #6f675b;
  --persona-wash: rgba(111, 103, 91, .08);
}

.app-root[data-persona="calm-senpai"] {
  --persona-accent: #76647a;
  --persona-wash: rgba(118, 100, 122, .09);
}

.app-root[data-persona="energetic-classmate"] {
  --persona-accent: #95644a;
  --persona-wash: rgba(149, 100, 74, .09);
}
```

- [ ] **Step 4: Load the theme before component layout styles**

Change the imports in `apps/pi-teaching-web/src/client/main.tsx` to:

```ts
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './theme-liubai.css';
import './styles.css';
```

Leave the existing `createRoot(...).render(...)` block unchanged.

- [ ] **Step 5: Run the theme contract and typecheck**

Run:

```bash
bun test tests/client/liubai-theme.test.ts
bun run typecheck
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pi-teaching-web/src/client/theme-liubai.css \
  apps/pi-teaching-web/src/client/main.tsx \
  apps/pi-teaching-web/tests/client/liubai-theme.test.ts
git commit -m "style: establish liubai theme tokens"
```

---

### Task 2: Mark the active Coach, Tutor, or Replay surface

**Files:**

- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`

**Interfaces:**

- Produces: `data-theme="liubai-xinzhongshi"` on the home and workspace roots.
- Produces: `data-view="coach" | "tutor" | "replay"` on `.app-root`.
- Consumed by: Task 3 CSS selectors and Playwright smoke tests.

- [ ] **Step 1: Add a failing Playwright test for theme and view markers**

Append to `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`:

```ts
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
```

- [ ] **Step 2: Run the test and verify that it fails**

Run:

```bash
bunx playwright test tests/e2e/workspace.spec.ts --grep "marks the approved theme"
```

Expected: FAIL because no root currently carries `data-theme` or `data-view`.

- [ ] **Step 3: Mark the learning-set home**

Change the opening element in `LearningSetHome.tsx` from:

```tsx
<main className="home">
```

to:

```tsx
<main className="home" data-theme="liubai-xinzhongshi">
```

- [ ] **Step 4: Derive the current workspace view without adding state**

Immediately after the existing `isCoach` declaration in `App.tsx`, add:

```ts
  const isReplay = selectedLesson?.status === 'closed'
    || selectedLesson?.status === 'abandoned';
  const view = isCoach ? 'coach' : isReplay ? 'replay' : 'tutor';
```

Change the workspace root from:

```tsx
<div className="app-root" data-persona={persona?.id ?? 'neutral-tutor'}>
```

to:

```tsx
<div
  className="app-root"
  data-theme="liubai-xinzhongshi"
  data-view={view}
  data-persona={persona?.id ?? 'neutral-tutor'}
>
```

Do not create a new React state value: `view` is a pure projection of the already selected Session and Lesson status.

- [ ] **Step 5: Run the focused E2E and typecheck**

Run:

```bash
bunx playwright test tests/e2e/workspace.spec.ts --grep "marks the approved theme"
bun run typecheck
```

Expected: both commands PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/components/LearningSetHome.tsx \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts
git commit -m "style: expose teaching surface theme markers"
```

---

### Task 3: Migrate the existing interface to Liubai semantics

**Files:**

- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/client/liubai-theme.test.ts`

**Interfaces:**

- Consumes: semantic tokens from `theme-liubai.css` and `data-view` from `App.tsx`.
- Produces: the approved flat paper surfaces, hairline hierarchy, display typography, state colors, Persona-local avatar color, and Coach/Tutor/Replay visual distinctions.

- [ ] **Step 1: Extend the theme contract to reject the old global palette**

Add this file load beside the existing `theme` and `main` constants in `liubai-theme.test.ts`:

```ts
const styles = await Bun.file(
  new URL('../../src/client/styles.css', import.meta.url),
).text();
```

Add this test inside the existing `describe` block:

```ts
test('layout styles consume semantic tokens instead of the old amber palette', () => {
  expect(styles).not.toContain('--amber');
  expect(styles).not.toContain('#b86c28');
  expect(styles).not.toContain('#f3efe5');
  expect(styles).not.toContain('radial-gradient');
  expect(styles).toContain('var(--accent)');
  expect(styles).toContain('var(--attention)');
  expect(styles).toContain('var(--danger)');
  expect(styles).toContain('[data-view="coach"]');
  expect(styles).toContain('[data-view="tutor"]');
  expect(styles).toContain('[data-view="replay"]');
});
```

- [ ] **Step 2: Run the focused test and verify that it fails**

Run:

```bash
bun test tests/client/liubai-theme.test.ts
```

Expected: FAIL because `styles.css` still contains the old amber palette, radial background and no view-specific selectors.

- [ ] **Step 3: Remove token ownership and Persona recoloring from `styles.css`**

Delete the old declarations at the top of `styles.css` that define `color`, `background`, font configuration, `--paper`, `--paper-deep`, `--ink`, `--muted`, `--line`, `--amber`, `--amber-pale`, `--green`, and the three `.app-root[data-persona=...]` rules.

Keep the reset, but make it consume the new source of truth:

```css
* { box-sizing: border-box; }

html { background: var(--paper); }

body {
  margin: 0;
  min-width: 320px;
  min-height: 100vh;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
}

button, textarea, input, select { font: inherit; }
button { color: inherit; }

button:focus-visible,
textarea:focus-visible,
input:focus-visible,
select:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 3px;
}
```

- [ ] **Step 4: Apply this exact semantic replacement map throughout `styles.css`**

Use `apply_patch` so each old semantic use is replaced, not aliased:

```text
var(--amber-pale)  -> var(--accent-wash)
var(--amber)       -> var(--accent)
var(--green)       -> var(--success)
var(--muted)       -> var(--ink-faint)
var(--line)        -> var(--rule)
#a43f2e            -> var(--danger)
#9d3d2c            -> var(--danger)
```

Then assign the two meanings that should not use the main accent:

```css
.activity-row em { color: var(--attention); }
.lesson-node-copy small[data-status="paused"] { color: var(--attention); }
.lesson-node-copy small[data-status="abandoned"] { color: var(--danger); }
.workflow-task[data-status="failed"] > i,
.workflow-task[data-status="failed"] em { color: var(--danger); }
.session-error { color: var(--danger); }
.page-alert { background: var(--danger); }
```

- [ ] **Step 5: Replace hard-coded surfaces, typography, and shadows**

Use the following values for the named selectors; keep their existing layout properties that are not listed here:

```css
.session-tree { background: var(--paper-deep); }
.chat { background: var(--paper); }
.chat-header { background: rgba(250, 247, 241, .94); }
.activities { background: #f5f1e9; }

.home h1,
.tree-context h2,
.activities header h2,
.lesson-gate h2,
.ability-copy b,
.evidence-lens h2,
.evidence-card-meta h3 {
  font-family: var(--font-display);
}

.home-overview,
.message > div,
.empty-conversation p,
.lesson-gate p,
.student-view,
.problem-card,
.replay-timeline li p,
.evidence-lens blockquote,
.coach-note {
  font-family: var(--font-reading);
}

.message > div { color: var(--ink-soft); }
.message.student > div {
  border-left: 2px solid var(--accent);
  background: var(--accent-wash);
}

.composer {
  border: 1px solid var(--rule);
  border-bottom-color: var(--ink);
  background: var(--paper);
  box-shadow: none;
}

.evidence-lens > article {
  background: var(--paper);
  box-shadow: -12px 0 34px rgba(27, 25, 22, .12);
}

.lens-scrim { background: var(--overlay); }
```

Remove the ruled-paper `linear-gradient` from `.chat`. Do not replace it with another pattern.

- [ ] **Step 6: Keep Persona color local to the avatar**

Replace `.persona-avatar` with the same geometry it currently has, but use only these color declarations:

```css
.persona-avatar {
  border-color: var(--persona-accent);
  color: var(--persona-accent);
  background: var(--persona-wash);
  font-family: var(--font-display);
}
```

No other selector in `styles.css` may consume `--persona-accent` or `--persona-wash`.

- [ ] **Step 7: Add the restrained Coach/Tutor/Replay distinctions**

Append these selectors before the keyframes:

```css
.workspace-shell { border-top: 3px solid var(--ink); }

.app-root[data-view="coach"] .chat-header strong,
.app-root[data-view="coach"] .activities header span {
  color: var(--accent-deep);
}

.app-root[data-view="tutor"] .chat-header {
  border-bottom-color: var(--ink);
}

.app-root[data-view="tutor"] .activity-row[data-status="active"] {
  border-left: 2px solid var(--accent);
  background: var(--accent-wash);
}

.app-root[data-view="replay"] .route-map,
.app-root[data-view="replay"] .replay-timeline {
  border-top-color: var(--ink);
}

.app-root[data-view="replay"] .replay-timeline li[data-kind="trace"]::before,
.app-root[data-view="replay"] .replay-timeline li[data-kind="route"]::before {
  background: var(--accent);
}
```

These selectors must not hide, reorder or invent content. They only adjust hierarchy already present in the DOM.

- [ ] **Step 8: Run focused tests and inspect the remaining literal colors**

Run:

```bash
bun test tests/client/liubai-theme.test.ts
rg -n -- '--amber|#b86c28|#f3efe5|radial-gradient' src/client/styles.css
bun run typecheck
```

Expected:

- theme test PASS;
- `rg` exits with status 1 and no matches;
- typecheck PASS.

- [ ] **Step 9: Commit**

```bash
git add apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/tests/client/liubai-theme.test.ts
git commit -m "style: apply liubai teaching surfaces"
```

---

### Task 4: Verify responsive behavior and document the selected theme

**Files:**

- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `docs/zh-CN/Pi教学前端设计说明.md`

**Interfaces:**

- Consumes: final theme CSS and data markers.
- Produces: responsive smoke coverage and user-facing documentation of the fixed main theme.

- [ ] **Step 1: Add a failing responsive and computed-style smoke test**

Append to `workspace.spec.ts`:

```ts
test('renders the liubai palette without horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');

  const tokens = await page.locator('main.home').evaluate((element) => {
    const style = getComputedStyle(element);
    return {
      paper: style.getPropertyValue('--paper').trim(),
      ink: style.getPropertyValue('--ink').trim(),
      accent: style.getPropertyValue('--accent').trim(),
    };
  });
  expect(tokens).toEqual({
    paper: '#faf7f1',
    ink: '#1b1916',
    accent: '#3f5b54',
  });

  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  const overflow = await page.evaluate(() => ({
    viewport: window.innerWidth,
    document: document.documentElement.scrollWidth,
  }));
  expect(overflow.document).toBeLessThanOrEqual(overflow.viewport);
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).toBeVisible();
});
```

- [ ] **Step 2: Run the test before final responsive adjustment**

Run:

```bash
bunx playwright test tests/e2e/workspace.spec.ts --grep "liubai palette"
```

Expected: the token assertions pass; if the current mobile layout overflows, the overflow assertion fails and identifies the remaining selector to adjust.

- [ ] **Step 3: Keep mobile layout within the existing breakpoint model**

Retain the existing `1100px` and `760px` breakpoints. If Step 2 reports overflow, make only these bounded adjustments in the existing `@media (max-width: 760px)` block:

```css
.workspace-shell,
.chat,
.activities { min-width: 0; }

.lesson-nodes {
  grid-template-columns: repeat(3, minmax(150px, 1fr));
  max-width: 100%;
  overflow-x: auto;
}

.chat-header,
.timeline,
.task-rail,
.composer { max-width: 100%; }
```

Do not add another breakpoint.

- [ ] **Step 4: Document the theme in the application README**

Insert this section after “学生使用流程” in `apps/pi-teaching-web/README.md`:

```markdown
## 主视觉主题

前端默认使用“留白新中式”：暖白纸面、暖墨正文、黛青结构色，以及只用于提醒的弱金和砖红。Coach 像计划簿，Tutor 像当前答题纸，Replay 像带来源的批注档案；三者共用同一页面骨架。

人设可以改变头像和局部表现，但不会重染能力状态、Trace、错误提示或主要导航。首版不提供主题切换器。
```

- [ ] **Step 5: Record the decision in the Chinese design guide**

Append this paragraph to the existing “二次元课堂皮肤” subsection in `docs/zh-CN/Pi教学前端设计说明.md`:

```markdown
主界面已经确定使用“留白新中式”：暖白纸面、近黑暖墨、黛青结构色、弱金与砖红状态色，以及由发丝线和负空间构成的层级。Coach、Tutor 和 Replay 共用该主题；人设只改变头像和极小范围的局部表现，不重染教学状态。完整视觉规范见 [Pi 教学前端「留白新中式」视觉设计](../superpowers/specs/2026-07-22-pi-teaching-web-liubai-theme-design.md)。
```

- [ ] **Step 6: Run the complete verification suite**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bunx playwright test
```

Expected:

- TypeScript exits 0;
- all non-E2E Bun tests pass;
- Vite production build succeeds;
- all Playwright tests pass.

- [ ] **Step 7: Perform a browser visual smoke**

Start the fixture lane:

```bash
cd apps/pi-teaching-web
bun run tests/e2e/fixture-server.ts
```

In another terminal run:

```bash
cd apps/pi-teaching-web
bunx vite --host 127.0.0.1 --port 65001
```

Open `http://127.0.0.1:65001/` and inspect:

- home at 1440×900 and 390×844;
- Coach root Session;
- prepared Lesson Tutor preview;
- method evidence panel;
- task rail expanded and collapsed.

Expected: no orange global accent, no page gradient, no heavy floating card shadow, no horizontal page overflow, and all existing controls remain visible.

- [ ] **Step 8: Commit**

```bash
git add apps/pi-teaching-web/tests/e2e/workspace.spec.ts \
  apps/pi-teaching-web/README.md \
  docs/zh-CN/Pi教学前端设计说明.md
git commit -m "docs: verify and describe liubai frontend theme"
```

---

## Final self-review

- Spec coverage: Tasks 1–3 cover the fixed palette, typography, flat surfaces, Persona boundary and three view variants; Task 4 covers responsive, accessibility-preserving smoke checks and documentation.
- Scope control: no task changes runtime/session/projection contracts or adds a theme picker, animation dependency or second UI architecture.
- Type consistency: `data-view` values are exactly `coach | tutor | replay`; CSS and Playwright use the same strings. Theme token names are defined once in Task 1 and consumed with the same spelling thereafter.
- Placeholder scan: every implementation step contains an exact file, command or code change. The only conditional adjustment is tied to a concrete overflow assertion and supplies the exact bounded CSS.
