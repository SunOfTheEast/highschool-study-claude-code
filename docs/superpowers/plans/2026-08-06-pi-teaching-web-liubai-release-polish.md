# Pi Teaching Web 留白新中式发布润色 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Kimi 留白新中式母版移植到当前 M0 React 前端，新增稳定学习概览，并让四种常见 LaTeX 分隔符在聊天、课堂与讲义中可靠渲染。

**Architecture:** 现有 API、课程树、Session、生命周期和 Student View 契约保持不变。`/course` 变为纯前端学习概览，`/course/roadmap` 承载原 Roadmap Session；其余工作区继续复用当前 React 组件，只替换为 Kimi 的三纸布局与视觉 token。所有公式在唯一 `MarkdownView` 边界规范化并由 `remark-math + rehype-katex` 渲染。

**Tech Stack:** React 19、TypeScript 7、Vite 8、Bun test、Playwright、react-markdown、remark-math、rehype-katex、KaTeX、LXGW WenKai Screen webfont。

## Global Constraints

- 视觉母版是 Kimi 工作树 `frontend-redesign/apps/pi-teaching-web/preview/`；优先机械迁移其布局、token、纸层、线条和字号，不加载静态 HTML、CDN 脚本或 mock 数据。
- `/course` 是概览，`/course/roadmap` 是 Roadmap Session；Plan、Lesson、Knowledge 与 handout 现有 URL 不变。
- 不修改 M0 后端契约，不新增个人掌握度、Trace 聚合、长期记忆或 Replay 数据模型。
- 课程证据与导航只沿 `CourseSnapshot.tree`；空 Plan Tree 不枚举目录，也不显示孤立 Lesson。
- 现有 Chat 消息、材料检索、Lesson Reviewer、讲义活动、工具事件、生命周期动作和防剧透边界必须保留。
- 公式接受 `$...$`、`$$...$$`、`\(...\)`、`\[...\]`；规范化跳过 fenced code、inline code 和已有 dollar math，只发生在渲染边界。
- KaTeX 字体不得被霞鹜文楷覆盖；窄屏块公式只在公式容器横向滚动；坏公式不得使消息或页面崩溃。
- 核心 token：`--paper #faf7f1`、`--paper-deep #f1ece1`、`--paper-mid #f6f1e7`、`--ink #1b1916`、`--accent #3f5b54`、`--seal #9e4f3d`。
- 教学正文不小于 12px，聊天正文约 16px；弱信息用颜色和位置降级，不使用 8–10px 字号。
- 所有行为改动遵守 TDD：先写失败测试并确认按预期失败，再写生产代码。
- 不改动工作树之外用户已有的 dirty / untracked 文件。

## Frontend Direction

**Visual thesis:** 像一册正在被老师和学生共同书写的暖纸课程簿——墨色克制、黛青定向、朱砂落款，密度高但不嘈杂。

**Content plan:** 学习概览负责定位与继续；Roadmap / Plan / Lesson 负责对话与行动；右纸只给当前层级所需的上下文；Knowledge 展示静态资产；handout 负责现实打印。

**Interaction thesis:** 页面只保留短促的纸面入场、消息进入和后台状态脉冲；树栏与上下文栏在窄屏用已有抽屉过渡；所有动效在 `prefers-reduced-motion` 下归零。

---

### Task 1: 统一数学分隔符与 KaTeX 容错

**Files:**
- Create: `apps/pi-teaching-web/src/client/math-markdown.ts`
- Modify: `apps/pi-teaching-web/src/client/components/MarkdownView.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/src/client/styles/handout.css`
- Modify: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/plans/plan-001/lessons/lesson-001.md`
- Modify: `apps/pi-teaching-web/tests/m0/course-ui.test.tsx`
- Create: `apps/pi-teaching-web/tests/m0/math-markdown.test.tsx`

**Interfaces:**
- Produces: `normalizeMathDelimiters(markdown: string): string`
- Produces: one `MarkdownView` pipeline shared by Chat, Student View and handout.

- [ ] **Step 1: Write failing normalizer tests**

Create `tests/m0/math-markdown.test.tsx` with focused cases:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownView } from '../../src/client/components/MarkdownView';
import { normalizeMathDelimiters } from '../../src/client/math-markdown';

test('normalizes TeX math delimiters outside code spans and fences', () => {
  const source = [
    '行内 \\(te^t\\) 与块级：',
    '\\[\\frac{x^2-1}{x-1}=x+1\\]',
    '`\\(literal\\)`',
    '```tex',
    '\\[literal\\]',
    '```',
  ].join('\n');

  expect(normalizeMathDelimiters(source)).toBe([
    '行内 $te^t$ 与块级：',
    '$$\\frac{x^2-1}{x-1}=x+1$$',
    '`\\(literal\\)`',
    '```tex',
    '\\[literal\\]',
    '```',
  ].join('\n'));
});

test('preserves existing dollar math and unmatched TeX delimiters', () => {
  expect(normalizeMathDelimiters('$f(x)$ 与 $$x^2$$ 与 \\(未闭合'))
    .toBe('$f(x)$ 与 $$x^2$$ 与 \\(未闭合');
});

test('renders all four supported delimiter forms through KaTeX', () => {
  const markup = renderToStaticMarkup(
    <MarkdownView>{'$a$ \\(b\\) $$c$$ \\[d\\]'}</MarkdownView>,
  );
  expect(markup.match(/class="katex/g)).toHaveLength(4);
});

test('keeps malformed formulas visible without throwing', () => {
  const render = () => renderToStaticMarkup(
    <MarkdownView>{'前文 $\\notARealCommand{x}$ 后文'}</MarkdownView>,
  );
  expect(render).not.toThrow();
  expect(render()).toContain('前文');
  expect(render()).toContain('后文');
});
```

Append this display formula to the active Block's test-only Student View fixture:

```markdown
\[
\frac{x^2-1}{x-1}=x+1
\]
```

Extend the existing CoursePage and handout render tests to assert that this fixture produces
`katex-display`. This makes the regression cover a real classroom projection in addition to the
isolated component.

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/math-markdown.test.tsx
```

Expected: FAIL because `math-markdown.ts` does not exist and `MarkdownView` does not parse `\(...\)` / `\[...\]`.

- [ ] **Step 3: Implement the stateful delimiter normalizer**

Implement `normalizeMathDelimiters` as a single left-to-right scanner with these exact states:

- normal text;
- inline backtick code, remembering the opening backtick run length;
- fenced code at line start, remembering backtick or tilde fence and run length;
- inline dollar math (`$`);
- display dollar math (`$$`).

In normal text only, convert a matched `\(...\)` pair to `$...$` and a matched `\[...\]` pair to `$$...$$`. Search the closing delimiter before emitting a conversion; if it does not exist, copy the opener unchanged. While inside code or dollar math, copy bytes verbatim. Preserve newlines and fence info strings.

Update `MarkdownView.tsx`:

```tsx
import 'katex/dist/katex.min.css';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import remarkMath from 'remark-math';
import { normalizeMathDelimiters } from '../math-markdown';

const katexOptions = { throwOnError: false, strict: 'warn' } as const;

export function MarkdownView({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[[rehypeKatex, katexOptions]]}
    >
      {normalizeMathDelimiters(children)}
    </ReactMarkdown>
  );
}
```

Add CSS without changing KaTeX child font families:

```css
.katex-display {
  max-width: 100%;
  margin: var(--space-3, .75rem) 0;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-inline: contain;
}

@media print {
  .katex-display { overflow: visible; font-size: .92em; }
}
```

- [ ] **Step 4: Run Task 1 tests and regression test**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/math-markdown.test.tsx tests/m0/course-ui.test.tsx
```

Expected: PASS with all four delimiter cases and the existing handout KaTeX assertion green.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/pi-teaching-web/src/client/math-markdown.ts \
  apps/pi-teaching-web/src/client/components/MarkdownView.tsx \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/src/client/styles/handout.css \
  apps/pi-teaching-web/tests/fixtures/m0-learning-set/plans/plan-001/lessons/lesson-001.md \
  apps/pi-teaching-web/tests/m0/course-ui.test.tsx \
  apps/pi-teaching-web/tests/m0/math-markdown.test.tsx
git commit -m "fix(web): normalize teaching math delimiters"
```

---

### Task 2: 拆分学习概览与 Roadmap Session

**Files:**
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Create: `apps/pi-teaching-web/src/client/course-navigation.ts`
- Create: `apps/pi-teaching-web/src/client/pages/CourseOverviewPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Create: `apps/pi-teaching-web/tests/m0/course-overview.test.tsx`
- Modify: `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`

**Interfaces:**
- Produces: route kind `{ kind: 'course-roadmap' }` for `/course/roadmap`.
- Produces: `resolveContinueTarget(root: CourseTreeNode): CourseContinueTarget`.
- Produces: `planProgress(plan: CourseTreeNode): { settled: number; total: number }`.
- Produces: `CourseOverviewPage({ value, onNavigate })`.

- [ ] **Step 1: Write failing route and continue-target tests**

Create `course-overview.test.tsx`. Use small explicit `CourseTreeNode` fixtures and assert:

```tsx
expect(parseBrowserRoute('/course/roadmap')).toEqual({ kind: 'course-roadmap' });
expect(formatBrowserRoute({ kind: 'course-roadmap' })).toBe('/course/roadmap');

expect(resolveContinueTarget(treeWithActiveLesson).route).toEqual({
  kind: 'course-lesson', planId: 'plan-001', lessonId: 'lesson-002',
});
expect(resolveContinueTarget(treeWithPreparedLesson).route).toEqual({
  kind: 'course-lesson', planId: 'plan-001', lessonId: 'lesson-001',
});
expect(resolveContinueTarget(emptyRoadmap).route).toEqual({ kind: 'course-roadmap' });
expect(planProgress(planWithOneClosedOfTwo)).toEqual({ settled: 1, total: 2 });
```

Render `CourseOverviewPage` with `readWorkspace(fixture)` and assert it contains the Roadmap title, long-term goal, `继续学习`, Plan title and `与老师讨论路线`, but no textarea. Render an empty-tree copy and assert it contains `尚未形成学习阶段` and does not contain `lessons/`.

- [ ] **Step 2: Run the test and verify RED**

```bash
cd apps/pi-teaching-web
bun test tests/m0/course-overview.test.tsx
```

Expected: FAIL because the route, helper and page do not exist.

- [ ] **Step 3: Implement route and pure navigation helpers**

Extend `BrowserRoute`, parser and formatter with `course-roadmap`. Implement continuation priority exactly:

1. first active Lesson under any Plan;
2. first prepared Lesson under the active Plan;
3. active Plan;
4. first prepared Plan;
5. Roadmap Session.

`planProgress` counts direct Lesson children whose status is `closed` as `settled`; it never recursively scans files or grandchildren.

- [ ] **Step 4: Implement `CourseOverviewPage` from Kimi home composition**

Use these stable class names:

```tsx
<main className="course-overview">
  <section className="overview-hero">...</section>
  <section className="overview-cycle" aria-label="学习周期">...</section>
</main>
```

The Hero renders `roadmap.title`, `roadmap.longTermGoal` and `roadmap.overview` through `MarkdownView`. The strong CTA is a real anchor whose `href` comes from `formatBrowserRoute(target.route)` and whose click calls `onNavigate(target.route)`. The secondary Roadmap anchor always targets `/course/roadmap`. Plan rows render only `value.tree.children` with `kind === 'plan'`; empty rows render the approved real empty state.

- [ ] **Step 5: Wire App loading without fetching Roadmap history on overview**

In `loadRoute`:

- `/course` loads `api.course()`, stores the snapshot and stops before `api.history`;
- `/course/roadmap` uses `ROADMAP.md`, loads `roadmap:<id>` history and shows `CoursePage`;
- Plan, Lesson, Knowledge and handout behavior stays unchanged.

In `content`, render `CourseOverviewPage` only for route kind `course`; all other course routes render `CoursePage`.

- [ ] **Step 6: Update the browser cycle test**

After `page.goto('/course')`, assert `继续学习` and click `与老师讨论路线` before sending the first Roadmap message. Update the final `/memory` fallback assertion to remain `/course` and confirm the overview heading.

- [ ] **Step 7: Run Task 2 tests**

```bash
cd apps/pi-teaching-web
bun test tests/m0/course-overview.test.tsx tests/m0/course-ui.test.tsx
bun run typecheck
```

Expected: all tests PASS and TypeScript exits 0.

- [ ] **Step 8: Commit Task 2**

```bash
git add apps/pi-teaching-web/src/client/routes.ts \
  apps/pi-teaching-web/src/client/course-navigation.ts \
  apps/pi-teaching-web/src/client/pages/CourseOverviewPage.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/tests/m0/course-overview.test.tsx \
  apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts
git commit -m "feat(web): add stable course overview"
```

---

### Task 3: 移植 Kimi 设计基础与全局框架

**Files:**
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/bun.lock`
- Modify: `apps/pi-teaching-web/src/client/main.tsx`
- Modify: `apps/pi-teaching-web/src/client/theme-liubai.css`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/src/client/styles/workspace-shell.css`
- Modify: `apps/pi-teaching-web/src/client/components/AppShell.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/CourseOverviewPage.tsx`
- Create: `apps/pi-teaching-web/tests/m0/liubai-theme.test.ts`

**Interfaces:**
- Adds self-hosted `lxgw-wenkai-screen-webfont` CSS before local theme CSS.
- Stabilizes Kimi token names for all later CSS tasks.

- [ ] **Step 1: Write the failing token and font tests**

Read `theme-liubai.css`, `main.tsx`, `workspace-shell.css` and `CourseOverviewPage.tsx`; assert:

```ts
expect(theme).toContain('--paper-mid: #f6f1e7');
expect(theme).toContain('--seal: #9e4f3d');
expect(theme).toContain('--text-body: 16px');
expect(theme).toContain('--font-ui: "LXGW WenKai Screen"');
expect(main.indexOf('lxgwwenkaiscreen.css')).toBeLessThan(main.indexOf('./theme-liubai.css'));
expect(shell).toContain('.brand-seal');
expect(overview).toContain('overview-continue');
```

- [ ] **Step 2: Run and verify RED**

```bash
cd apps/pi-teaching-web
bun test tests/m0/liubai-theme.test.ts
```

Expected: FAIL on missing tokens, dependency import and Kimi shell selectors.

- [ ] **Step 3: Install and import the self-hosted font**

```bash
cd apps/pi-teaching-web
bun add lxgw-wenkai-screen-webfont
```

Add before local CSS in `main.tsx`:

```ts
import 'lxgw-wenkai-screen-webfont/lxgwwenkaiscreen.css';
```

- [ ] **Step 4: Mechanically migrate the Kimi token block**

Copy the matching token values from `preview/styles/liubai-preview.css` into `theme-liubai.css`, including:

- three paper colors, ink colors, accent, seal and semantic colors;
- `--font-ui`, `--font-display`, `--font-reading`, `--font-mono`;
- text scale 11/12/13/14/16/18/20/24/32px;
- spacing scale 4/8/12/16/24/32/48/64/96px;
- `font-synthesis: none` and the existing persona overrides.

Do not copy the preview's global KaTeX font rules or CDN assumptions.

- [ ] **Step 5: Port the brand bar and overview composition**

Update `AppShell` to render a `.brand-seal` containing `学`, the StudyForge wordmark and learning-set title. Preserve `PrimaryViewNav`, connection text, notice semantics and click interception. Port Kimi's paper, line, spacing and hover rules for:

- `.workspace-header`, `.workspace-brand`, `.brand-seal`;
- `.course-overview`, `.overview-hero`, `.overview-cycle`;
- `.overview-continue`, `.overview-plan-list`, `.overview-plan-row`;
- empty Plan state and responsive collapse.

Do not add ability cards or mock mastery data.

- [ ] **Step 6: Run theme and overview tests**

```bash
cd apps/pi-teaching-web
bun test tests/m0/liubai-theme.test.ts tests/m0/course-overview.test.tsx
bun run build
```

Expected: tests PASS and Vite build exits 0 with the font assets emitted locally.

- [ ] **Step 7: Commit Task 3**

```bash
git add apps/pi-teaching-web/package.json apps/pi-teaching-web/bun.lock \
  apps/pi-teaching-web/src/client/main.tsx \
  apps/pi-teaching-web/src/client/theme-liubai.css \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/src/client/styles/workspace-shell.css \
  apps/pi-teaching-web/src/client/components/AppShell.tsx \
  apps/pi-teaching-web/src/client/pages/CourseOverviewPage.tsx \
  apps/pi-teaching-web/tests/m0/liubai-theme.test.ts
git commit -m "style(web): port liubai visual foundation"
```

---

### Task 4: 移植 Roadmap / Plan / Lesson 三纸工作区

**Files:**
- Create: `apps/pi-teaching-web/src/client/components/ProgressLine.tsx`
- Create: `apps/pi-teaching-web/src/client/components/WorkspaceBreadcrumbs.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/CoursePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/CourseTree.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ActivityDrawer.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/course.css`
- Modify: `apps/pi-teaching-web/src/client/styles/classroom.css`
- Modify: `apps/pi-teaching-web/tests/m0/course-ui.test.tsx`

**Interfaces:**
- Produces: `ProgressLine({ value, max, label })` with an accessible text label.
- Produces: `WorkspaceBreadcrumbs({ value, selectedNode })` using canonical hrefs.
- Keeps `CoursePage` external behavior and lifecycle callbacks unchanged.

- [ ] **Step 1: Extend Course UI tests and verify RED**

Add assertions for a selected Lesson:

```tsx
expect(markup).toContain('class="workspace-breadcrumbs"');
expect(markup).toContain('href="/course"');
expect(markup).toContain('href="/course/plan/plan-001"');
expect(markup).toContain('class="progress-line"');
expect(markup).toContain('必做进度');
expect(markup).toContain('data-node-kind="lesson"');
```

Render a copy with `selected.status = 'closed'` and assert `已结束 · 只读` is present, the transcript remains, and the composer is disabled. Run the test and confirm these assertions fail because the components/classes do not exist.

- [ ] **Step 2: Implement shared progress and breadcrumb components**

`ProgressLine` clamps `value` into `[0, max]`, uses width `0%` when `max === 0`, renders a 2px fill and visible `value / max` text.

`WorkspaceBreadcrumbs` derives parent Plan only from `value.tree.children` and its direct Lesson children. It renders real anchors:

- `学习概览` → `/course`;
- Roadmap → `/course/roadmap`;
- Plan → `/course/plan/:planId`;
- current Lesson as plain text.

Its right side renders lifecycle status text; for closed Lesson use exactly `已结束 · 只读`.

- [ ] **Step 3: Port the three-paper workspace**

Adapt Kimi's `.workspace`, `.col-tree`, `.col-main`, `.col-aside`, breadcrumb, progress, status dot and message rules to existing class names:

- `.course-rail` uses `--paper-deep`;
- `.dialogue-workspace` uses `--paper`;
- `.context-rail` uses `--paper-mid`;
- desktop grid is approximately `264px minmax(0, 1fr) 308px` while preserving rail collapsed states;
- messages use 16px / 1.8 reading text;
- tool and background activities remain inline and readable at 12–14px;
- no tool detail or Teacher Control becomes public.

- [ ] **Step 4: Add Plan and Block progress without new data**

In `CourseTree`, each Plan row computes direct `closed / total` Lesson progress. In `ActivityDrawer`, required Block progress counts required Blocks with status `completed` or `skipped` as settled. Render all existing Block statuses and the `可选` marker.

- [ ] **Step 5: Run Course UI tests**

```bash
cd apps/pi-teaching-web
bun test tests/m0/course-ui.test.tsx tests/m0/course-overview.test.tsx
bun run typecheck
```

Expected: PASS; current material/reviewer/handout visibility tests remain green.

- [ ] **Step 6: Commit Task 4**

```bash
git add apps/pi-teaching-web/src/client/components/ProgressLine.tsx \
  apps/pi-teaching-web/src/client/components/WorkspaceBreadcrumbs.tsx \
  apps/pi-teaching-web/src/client/pages/CoursePage.tsx \
  apps/pi-teaching-web/src/client/components/CourseTree.tsx \
  apps/pi-teaching-web/src/client/components/ActivityDrawer.tsx \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/src/client/styles/course.css \
  apps/pi-teaching-web/src/client/styles/classroom.css \
  apps/pi-teaching-web/tests/m0/course-ui.test.tsx
git commit -m "style(web): port three-paper teaching workspace"
```

---

### Task 5: 统一 Knowledge、讲义与可读字号

**Files:**
- Modify: `apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/LessonHandoutPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/knowledge.css`
- Modify: `apps/pi-teaching-web/src/client/styles/handout.css`
- Modify: `apps/pi-teaching-web/src/client/styles/course.css`
- Modify: `apps/pi-teaching-web/src/client/styles/workspace-shell.css`
- Modify: `apps/pi-teaching-web/tests/m0/knowledge-ui.test.tsx`
- Modify: `apps/pi-teaching-web/tests/m0/course-ui.test.tsx`
- Modify: `apps/pi-teaching-web/tests/m0/liubai-theme.test.ts`

**Interfaces:**
- No contract changes; both pages keep their existing props and data sources.

- [ ] **Step 1: Add a failing CSS readability guard**

In `liubai-theme.test.ts`, read every CSS file under `src/client`. Extract `font-size: Npx`, `font-size: Nrem`, and the size portion of `font: ... Nrem/line-height ...`. Assert every literal font size is at least 11px (`0.6875rem`). Ignore `clamp()` and CSS variables because their minimums are defined in the token block.

Run the test and verify it fails on the current `.52rem`–`.67rem` values.

- [ ] **Step 2: Tighten semantic markup tests**

Keep the current no-personal-overlays assertion. Add:

```tsx
expect(knowledgeMarkup).toContain('class="knowledge-workspace"');
expect(knowledgeMarkup).toContain('aria-label="题卡资产"');
expect(handoutMarkup).toContain('class="handout-paper"');
expect(handoutMarkup).toContain('StudyForge · Lesson Handout');
```

- [ ] **Step 3: Port Kimi Knowledge and handout styling**

Knowledge keeps the current method / card / material columns and filter behavior. Mechanically apply the Kimi paper colors, header rhythm, selected left rule, readable metadata and cardless divider lists.

Handout keeps A4 dimensions and public projection. Apply Kimi typography, sequence numbers, answer lines and restrained screen shadow. In print:

- hide `.handout-actions`;
- remove shadow and screen padding;
- keep headings with following content;
- preserve KaTeX font and allow representative display formulas to fit page width.

- [ ] **Step 4: Replace every sub-11px font literal**

Use the Kimi scale:

- 11px only for monospace IDs and timestamps;
- 12px for labels and statuses;
- 13px for secondary tree/message metadata;
- 14px for buttons and activity rows;
- 16px for teaching body text.

Do not enlarge widths, dots, borders or spacing values mistaken for font sizes.

- [ ] **Step 5: Run focused tests and build**

```bash
cd apps/pi-teaching-web
bun test tests/m0/liubai-theme.test.ts tests/m0/knowledge-ui.test.tsx tests/m0/course-ui.test.tsx
bun run build
```

Expected: PASS with no sub-11px font literal failures and a successful production build.

- [ ] **Step 6: Commit Task 5**

```bash
git add apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx \
  apps/pi-teaching-web/src/client/pages/LessonHandoutPage.tsx \
  apps/pi-teaching-web/src/client/styles/knowledge.css \
  apps/pi-teaching-web/src/client/styles/handout.css \
  apps/pi-teaching-web/src/client/styles/course.css \
  apps/pi-teaching-web/src/client/styles/workspace-shell.css \
  apps/pi-teaching-web/tests/m0/knowledge-ui.test.tsx \
  apps/pi-teaching-web/tests/m0/course-ui.test.tsx \
  apps/pi-teaching-web/tests/m0/liubai-theme.test.ts
git commit -m "style(web): finish liubai content surfaces"
```

---

### Task 6: 响应式、真实浏览器与发布验收

**Files:**
- Modify: `apps/pi-teaching-web/src/client/styles/responsive.css`
- Modify: `apps/pi-teaching-web/src/client/styles/handout.css`
- Modify: `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`
- Modify: `apps/pi-teaching-web/tests/m0/math-markdown.test.tsx`

**Interfaces:**
- No new runtime interfaces; this task closes cross-surface behavior and visual acceptance.

- [ ] **Step 1: Add the final browser assertions before CSS changes**

Extend Playwright coverage to assert:

- `/course` has the overview and no chat textarea;
- `/course/roadmap` has the Roadmap chat;
- Plan and Lesson direct URLs still restore;
- closed Lesson input is disabled;
- Knowledge and handout remain reachable;
- viewport 375×812 has no document-level horizontal overflow;
- the test fixture's real display formula renders as `.katex-display`; after setting viewport
  375×812, its scroll width may exceed its own client width while `document.documentElement.scrollWidth`
  remains equal to `document.documentElement.clientWidth`.

Run the relevant test and confirm new assertions fail where responsive behavior is not yet implemented.

- [ ] **Step 2: Port responsive rules from the Kimi mother template**

At approximately 1100px, keep the center paper and make both rails fixed drawers when opened. At approximately 720px:

- stack overview sections;
- reduce header to two rows without hiding navigation or connection state;
- preserve at least 320px document support;
- keep message text at readable size;
- ensure only `.katex-display` may scroll horizontally.

Retain the existing `prefers-reduced-motion` override for every animation and transition.

- [ ] **Step 3: Run the complete automated gate**

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e
```

Expected: typecheck, all non-E2E tests, production build and all Playwright tests PASS.

- [ ] **Step 4: Run visual comparison on real local data**

Start the app, then capture desktop screenshots of:

- `/course`;
- `/course/roadmap`;
- `/course/plan/plan-001`;
- `/course/plan/plan-001/lesson/lesson-001`;
- `/knowledge`;
- one handout URL.

Compare Course / Plan / Lesson / closed Lesson against the Kimi mother screens. Verify three paper tones, typography, hierarchy, inline background activities, empty state, 375px layout, long formula scrolling and print preview. Fix visible regressions and rerun the covering tests after each fix.

- [ ] **Step 5: Commit Task 6**

```bash
git add apps/pi-teaching-web/src/client/styles/responsive.css \
  apps/pi-teaching-web/src/client/styles/handout.css \
  apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts \
  apps/pi-teaching-web/tests/m0/math-markdown.test.tsx
git commit -m "test(web): close liubai release acceptance"
```

- [ ] **Step 6: Fresh final verification**

Run again after the final commit:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e
git status --short
```

Expected: both commands exit 0; worktree is clean except explicitly documented visual artifacts, if any.
