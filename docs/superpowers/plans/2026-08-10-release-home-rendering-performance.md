# StudyForge Release Home, Rendering, and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the packaged StudyForge home page student-facing and fast on the 519-card derivative learning set, while removing stray blockquote markers from display math.

**Architecture:** Project only the guide introduction and exact `Student Learning Principles` section into Home, and derive course CTA copy only from tree titles and status. Replace Home's full card parse with file-level counting, let target routes load without awaiting Home, and normalize only the outer Markdown quote prefix captured inside multiline display math.

**Tech Stack:** TypeScript 7, Bun 1.3, React 19, React Markdown/remark, KaTeX, Playwright, Tauri 2.

## Global Constraints

- Do not add a generated student summary or a second `Current Position`.
- Do not expose `Internal Teaching Notes`, Roadmap diagnosis, or capability judgments in Home.
- Do not add a database, durable cache, cache service, or new card-index format.
- Do not weaken strict card parsing on Assets, Knowledge, Footprint, or card-detail paths.
- Do not globally remove `>` from Markdown or TeX.
- Preserve unrelated user changes and commit only the files listed by each task.

---

## File Map

- `src/shared/contracts.ts`: student-only Home snapshot shape.
- `src/study/learning-set-home.ts`: public guide projection and lightweight Home assembly.
- `src/study/learning-assets.ts`: current-card file counter.
- `src/study/knowledge.ts`: material-only count.
- `src/client/pages/HomePage.tsx`: student hierarchy without teacher judgments.
- `src/client/styles/m1b.css`: lower student-principles section.
- `src/client/App.tsx`: route-specific, non-serial loading.
- `src/client/math-markdown.ts`: quoted display-math normalization.
- `examples/derivative-m0/learning-set/LEARNING_GUIDE.md`: canonical student/internal sections.

---

### Task 1: Project and render only student-facing Home content

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts:205-209,278-292`
- Modify: `apps/pi-teaching-web/src/study/learning-set-home.ts:13-39`
- Modify: `apps/pi-teaching-web/src/client/pages/HomePage.tsx:23-104`
- Modify: `apps/pi-teaching-web/src/client/styles/m1b.css:15-136`
- Modify: `examples/derivative-m0/learning-set/LEARNING_GUIDE.md`
- Modify: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/LEARNING_GUIDE.md`
- Test: `apps/pi-teaching-web/tests/m1b/learning-set-home.test.ts`
- Test: `apps/pi-teaching-web/tests/m1b/m1b-ui.test.tsx`
- Test: `apps/pi-teaching-web/tests/m1c/m1c-ui.test.tsx`
- Test: `apps/pi-teaching-web/tests/m1d/entry-and-dialogue-ui.test.tsx`

**Interfaces:**
- Consumes: `readLearningSetGuide(root): LearningSetGuide` and `projectActiveLesson(tree)`.
- Produces: `LearningSetHomeSnapshot.guide: { title; introduction; principles }` and a Home course summary without `currentPosition`.

- [ ] **Step 1: Write failing domain and UI tests for the public projection**

Update the M0 fixture guide so its private marker is unambiguous:

```markdown
# 导数结构学习集

这个学习集帮助你识别导数综合题的结构，并逐步学会选择路线。

## Student Learning Principles

- 碰到新题时，先说清自己在哪一步犹豫。

## Internal Teaching Notes

这句教师诊断绝不能出现在首页。
```

Add this assertion to `learning-set-home.test.ts`:

```ts
test('projects only student-facing guide content and structural course facts', () => {
  const home = readLearningSetHome(course);
  expect(home.guide).toEqual({
    title: '导数结构学习集',
    introduction: '这个学习集帮助你识别导数综合题的结构，并逐步学会选择路线。',
    principles: '- 碰到新题时，先说清自己在哪一步犹豫。',
  });
  expect(JSON.stringify(home)).not.toContain('这句教师诊断绝不能出现在首页');
  expect(home.course).not.toHaveProperty('currentPosition');
});
```

Change every `LearningSetHomeSnapshot` test fixture from `body/raw` to `introduction/principles`, remove `currentPosition` from Home course objects, and assert:

```ts
expect(markup).toContain('这个学习集怎么学');
expect(markup).not.toContain('教师诊断');
expect(markup).not.toContain('正在学习沉淀溶解平衡');
```

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1b/learning-set-home.test.ts tests/m1b/m1b-ui.test.tsx tests/m1c/m1c-ui.test.tsx tests/m1d/entry-and-dialogue-ui.test.tsx
```

Expected: FAIL because Home still returns `body/raw/currentPosition` and has no student-principles section.

- [ ] **Step 3: Add the student-only Home contract and extractor**

Keep `LearningSetGuide` unchanged for Course and Agent readers. Add:

```ts
export type StudentLearningSetGuide = {
  title: string;
  introduction: string;
  principles: string;
};
```

Use it in `LearningSetHomeSnapshot.guide`, and delete `currentPosition` only from the Home course summary. In `learning-set-home.ts`, add:

```ts
function studentGuide(guide: LearningSetGuide): StudentLearningSetGuide {
  const lines = guide.body.split(/\r?\n/);
  const h1 = lines.findIndex((line) => /^#\s+/.test(line));
  const firstH2 = lines.findIndex((line) => /^##\s+/.test(line));
  const publicH2 = lines.findIndex((line) => line.trim() === '## Student Learning Principles');
  const nextH2 = publicH2 < 0
    ? -1
    : lines.findIndex((line, index) => index > publicH2 && /^##\s+/.test(line));
  return {
    title: guide.title,
    introduction: lines.slice(h1 < 0 ? 0 : h1 + 1, firstH2 < 0 ? lines.length : firstH2)
      .join('\n').trim(),
    principles: publicH2 < 0
      ? ''
      : lines.slice(publicH2 + 1, nextH2 < 0 ? lines.length : nextH2).join('\n').trim(),
  };
}
```

Return `guide: studentGuide(guide)` and omit `course.currentPosition`.

- [ ] **Step 4: Recompose Home around one action and lower student principles**

Render `value.guide.introduction` under the title. Remove both `currentPosition` render sites and reduce the course link to:

```tsx
<a href="/course" onClick={link({ kind: 'course' })}>
  进入正式课程 · {value.course.title}
</a>
```

After `.home-action-stage`, add:

```tsx
{value.guide.principles && (
  <section className="home-learning-principles">
    <header><small>How to learn</small><h2>这个学习集怎么学</h2></header>
    <div className="home-guide-copy">
      <MarkdownView>{value.guide.principles}</MarkdownView>
    </div>
  </section>
)}
```

Give the section the same calm divider/header grammar as `.m1b-recent`, with `margin-bottom: var(--space-9)`. Add no card, shadow, gradient, or accent.

- [ ] **Step 5: Rewrite the derivative guide without deleting teacher information**

Use this public section:

```markdown
# 高阶导数结构学习集

这里陪你练习导数综合题里的结构判断和方法选择。遇到没见过的题时，先看清它为什么
适合某条路线，再把路线完整走通。

## Student Learning Principles

- 碰到一道新题时，先说说自己在哪一步犹豫，不用急着报方法名。
- 选定路线前，先找出题目里真正起作用的结构；算完以后再检查定义域、取等和边界。
- 同一种方法换个题目外壳再试一次，看看自己是否真的会选、也会做。
- 如果你想到另一条路，可以直接提出来，和老师一起比较哪条更稳。

## Internal Teaching Notes

### Learning logic
```

Move every existing `Learning Principles` bullet and the full existing `Teaching Notes` paragraph below `Internal Teaching Notes`; do not discard them.

- [ ] **Step 6: Run focused tests and typecheck**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1b/learning-set-home.test.ts tests/m1b/m1b-ui.test.tsx tests/m1c/m1c-ui.test.tsx tests/m1d/entry-and-dialogue-ui.test.tsx
bun run typecheck
```

Expected: selected tests pass and TypeScript reports no errors.

- [ ] **Step 7: Commit the student projection**

Run:

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/src/study/learning-set-home.ts apps/pi-teaching-web/src/client/pages/HomePage.tsx apps/pi-teaching-web/src/client/styles/m1b.css apps/pi-teaching-web/tests/fixtures/m0-learning-set/LEARNING_GUIDE.md apps/pi-teaching-web/tests/m1b/learning-set-home.test.ts apps/pi-teaching-web/tests/m1b/m1b-ui.test.tsx apps/pi-teaching-web/tests/m1c/m1c-ui.test.tsx apps/pi-teaching-web/tests/m1d/entry-and-dialogue-ui.test.tsx examples/derivative-m0/learning-set/LEARNING_GUIDE.md
git commit -m "fix: project a student-facing learning home"
```

---

### Task 2: Remove full-card parsing and serial Home waits from navigation

**Files:**
- Modify: `apps/pi-teaching-web/src/study/learning-assets.ts:197-215,516-529`
- Modify: `apps/pi-teaching-web/src/study/knowledge.ts:130-166`
- Modify: `apps/pi-teaching-web/src/study/learning-set-home.ts:1-40`
- Modify: `apps/pi-teaching-web/src/client/App.tsx:125-286,347-359`
- Test: `apps/pi-teaching-web/tests/m1b/learning-set-home.test.ts`
- Test: `apps/pi-teaching-web/tests/e2e/m1d-ui.spec.ts`

**Interfaces:**
- Consumes: current card files under `cards/`, excluding `.revisions`.
- Produces: `countCurrentProblemCardFiles(root): number`, `countKnowledgeMaterials(root): number`, and target routes that do not await Home before their own data.

- [ ] **Step 1: Write a failing test proving Home does not parse card YAML**

In `learning-set-home.test.ts`, create a disposable blank set with a syntactically broken current card:

```ts
test('counts current card files without parsing the card corpus for Home', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-light-home-'));
  roots.push(root);
  mkdirSync(join(root, 'cards'), { recursive: true });
  writeFileSync(join(root, 'LEARNING_GUIDE.md'), [
    '---', 'id: light-home', 'title: 轻量首页', '---', '',
    '# 轻量首页', '', '先打开再说。', '',
  ].join('\n'));
  writeFileSync(join(root, 'cards', 'broken.card.yaml'), 'not: [valid yaml');

  expect(readLearningSetHome(root).assets.problemCards).toBe(1);
});
```

Add `mkdtempSync`, `mkdirSync`, `rmSync`, `writeFileSync`, `tmpdir`, and `afterEach`; remove every temporary root after each test.

- [ ] **Step 2: Run the domain test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1b/learning-set-home.test.ts
```

Expected: FAIL with a YAML parse error from `readKnowledge()`.

- [ ] **Step 3: Add lightweight counters and remove `readKnowledge()` from Home**

In `learning-assets.ts`, reuse the existing safe recursive enumerator:

```ts
export function countCurrentProblemCardFiles(root: string): number {
  return filesBelow(root, 'cards').filter((path) => /\.card\.ya?ml$/i.test(path)).length;
}
```

In `knowledge.ts`, expose material-only counting without touching `readCards()`:

```ts
export function countKnowledgeMaterials(root: string): number {
  return readMaterials(root).length;
}
```

Assemble Home assets with:

```ts
assets: {
  notes: listLearningNotes(root).length,
  problemCards: countCurrentProblemCardFiles(root),
  materials: countKnowledgeMaterials(root),
},
```

Delete the `readKnowledge` import from `learning-set-home.ts`.

- [ ] **Step 4: Write an E2E regression for route independence**

Add this focused test to `m1d-ui.spec.ts`:

```ts
test('opens a target route without waiting for the Home projection', async ({ page }) => {
  await page.context().addCookies([{
    name: 'studyforge-fixture', value: 'm1c', domain: '127.0.0.1', path: '/',
  }]);
  expect((await page.request.post('/api/__e2e/m1c/reset')).status()).toBe(200);

  let releaseHome!: () => void;
  const homeGate = new Promise<void>((resolve) => { releaseHome = resolve; });
  await page.route('**/api/home', async (route) => {
    await homeGate;
    await route.continue();
  });
  try {
    await page.goto('/assets');
    await expect(page.getByRole('heading', { name: '我的学习资料' })).toBeVisible();
  } finally {
    releaseHome();
    await page.unroute('**/api/home');
  }
});
```

- [ ] **Step 5: Run the E2E regression and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun run test:e2e -- tests/e2e/m1d-ui.spec.ts --grep "without waiting for the Home projection"
```

Expected: FAIL or time out because `loadRoute()` awaits Home before calling `api.assets()`.

- [ ] **Step 6: Make Home concurrent and non-blocking for target routes**

At the start of normal `loadRoute`, create the now-lightweight request. Await it for Home, and let other target routes proceed first:

```ts
const homeRequest = api.home();

if (next.kind === 'home') {
  const homeValue = await homeRequest;
  if (revision !== routeLoadRevision.current) return;
  setHome(homeValue);
  setRoute(next);
  setNotice(null);
  return;
}

if (next.kind !== 'free-learning') {
  void homeRequest.then((homeValue) => {
    if (revision === routeLoadRevision.current) setHome(homeValue);
  }, () => {});
}
```

Move `assets`, `material`, `footprint`, `note`, `problem-card`, `meta`, `knowledge`, and Course branches before any Home await. In free learning, request Home together with the actual route data:

```ts
const [homeValue, history, assetLibrary, materialValues] = await Promise.all([
  homeRequest,
  api.history(key),
  api.assets(),
  api.materials(),
]);
setHome(homeValue);
const session = homeValue.recentFreeLearning.find((candidate) => (
  candidate.id === next.sessionId
));
```

Keep all route revision guards. Do not change Session history, carried context, or course selection. `home-invalidated` may refresh cached Home in the background because the endpoint is lightweight; it must not route-reload a non-Home page.

- [ ] **Step 7: Run focused tests and E2E**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1b/learning-set-home.test.ts
bun run test:e2e -- tests/e2e/m1d-ui.spec.ts --grep "without waiting for the Home projection"
bun run typecheck
```

Expected: domain test, route-independence E2E, and typecheck pass.

- [ ] **Step 8: Commit the performance fix**

Run:

```bash
git add apps/pi-teaching-web/src/study/learning-assets.ts apps/pi-teaching-web/src/study/knowledge.ts apps/pi-teaching-web/src/study/learning-set-home.ts apps/pi-teaching-web/src/client/App.tsx apps/pi-teaching-web/tests/m1b/learning-set-home.test.ts apps/pi-teaching-web/tests/e2e/m1d-ui.spec.ts
git commit -m "perf: keep card parsing off the learning home"
```

---

### Task 3: Remove blockquote container markers from multiline display math

**Files:**
- Modify: `apps/pi-teaching-web/src/client/math-markdown.ts:99-112,176-190`
- Test: `apps/pi-teaching-web/tests/m0/math-markdown.test.tsx:46-60`

**Interfaces:**
- Consumes: raw Markdown with TeX `\[...\]` inside one or more `>` quote levels.
- Produces: a TeX-only display token while retaining the outer prefix for remark to create `<blockquote>`.

- [ ] **Step 1: Add the exact failing quoted-display regression**

Extend `math-markdown.test.tsx`:

```tsx
test('removes only multiline blockquote prefixes captured inside display math', () => {
  const source = [
    '> 题干：',
    '>',
    '> \\[',
    '> \\ln x \\le ax^2,\\qquad x>0',
    '> \\]',
    '> 后文。',
  ].join('\n');
  const prepared = prepareMathMarkdown(source);
  expect(prepared.tokens).toHaveLength(1);
  expect(prepared.tokens[0]!.value).toBe('\\ln x \\le ax^2,\\qquad x>0');

  const markup = renderToStaticMarkup(<MarkdownView>{source}</MarkdownView>);
  expect(markup).toContain('<blockquote>');
  expect(markup.indexOf('katex-display')).toBeLessThan(markup.indexOf('</blockquote>'));
  expect(markup.match(/class="mrel">&gt;<\/span>/g)).toHaveLength(1);
});

test('preserves a real leading greater-than relation inside a quoted display', () => {
  const prepared = prepareMathMarkdown(['> \\[', '> >0', '> \\]'].join('\n'));
  expect(prepared.tokens[0]!.value).toBe('>0');
});
```

- [ ] **Step 2: Run the math test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/math-markdown.test.tsx
```

Expected: FAIL because token values contain `> ` on formula and closing-delimiter lines.

- [ ] **Step 3: Normalize only the detected outer quote depth**

Add helpers next to `displayContent`:

```ts
function blockquoteDepthBefore(source: string, index: number): number {
  const lineStart = source.lastIndexOf('\n', index - 1) + 1;
  const prefix = source.slice(lineStart, index);
  if (!/^(?: {0,3}>[ \t]?)+$/.test(prefix)) return 0;
  return [...prefix].filter((character) => character === '>').length;
}

function stripBlockquoteDepth(line: string, depth: number): string | null {
  let value = line;
  for (let level = 0; level < depth; level += 1) {
    const match = /^ {0,3}>[ \t]?/.exec(value);
    if (!match) return null;
    value = value.slice(match[0].length);
  }
  return value;
}

function displayContentAt(source: string, opener: number, content: string): string {
  const depth = blockquoteDepthBefore(source, opener);
  if (depth === 0 || !content.includes('\n')) return displayContent(content);
  const lines = content.split(/\r?\n/);
  const normalized: string[] = [];
  for (const [index, line] of lines.entries()) {
    const stripped = index === 0 ? line : stripBlockquoteDepth(line, depth);
    if (stripped === null) return displayContent(content);
    normalized.push(stripped);
  }
  return displayContent(normalized.join('\n'));
}
```

Use `displayContentAt(markdown, cursor, value)` only for `\[` tokens. Leave inline `\(...)`, `$...$`, and `$$...$$` behavior unchanged.

- [ ] **Step 4: Run math tests and typecheck**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/math-markdown.test.tsx
bun run typecheck
```

Expected: all math tests pass, the legitimate `x>0` remains, and TypeScript reports no errors.

- [ ] **Step 5: Commit the renderer fix**

Run:

```bash
git add apps/pi-teaching-web/src/client/math-markdown.ts apps/pi-teaching-web/tests/m0/math-markdown.test.tsx
git commit -m "fix: normalize quoted display math containers"
```

---

### Task 4: Full verification and packaged-app acceptance

**Files:**
- Verify only; do not add fallback code for unrelated historical artifacts.

**Interfaces:**
- Consumes: the three independently committed fixes.
- Produces: one verified arm64 DMG and release evidence.

- [ ] **Step 1: Run the complete repository gate**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: typecheck, all non-E2E tests, and Vite build pass.

- [ ] **Step 2: Run the complete deterministic browser suite**

Run:

```bash
cd apps/pi-teaching-web
bun run test:e2e
```

Expected: every Playwright scenario passes without overflow or internal-text regressions.

- [ ] **Step 3: Measure the production Home projection**

Start the production server against the derivative learning set and measure `/api/home` separately from `/api/assets`. Never print the runtime authorization token.

Expected:

- `/api/home` no longer scales with the 5.8 MB card bodies;
- Course navigation does not wait for `/api/home`;
- `/api/assets` remains the one strict full-library read when the shelf is opened.

- [ ] **Step 4: Rebuild and verify the arm64 DMG**

Run:

```bash
cd apps/pi-teaching-web
bun run desktop:prepare
bun run desktop:sidecars
bun run desktop:build
bun run desktop:verify
bun run desktop:smoke
```

Expected: both sidecars and resources are present, ad-hoc signature is valid, packaged smoke passes, and `src-tauri/target/release/bundle/dmg/StudyForge_0.1.0_aarch64.dmg` exists.

- [ ] **Step 5: Inspect the real DMG**

Verify in the packaged derivative learning set:

1. Home shows the title, short student introduction, one primary action, and quiet links.
2. `Current Position`, teacher diagnosis, `Learning logic`, and `Internal Teaching Notes` are absent.
3. “这个学习集怎么学” appears below actions in the existing restrained paper style.
4. Course entry is not delayed by the 519-card corpus.
5. The quoted custom-card formula has no leading or trailing container `>`.
6. A genuine `x>0` relation still renders.

- [ ] **Step 6: Record the final artifact identity**

Run:

```bash
shasum -a 256 src-tauri/target/release/bundle/dmg/StudyForge_0.1.0_aarch64.dmg
stat -f '%z bytes' src-tauri/target/release/bundle/dmg/StudyForge_0.1.0_aarch64.dmg
git status --short
```

Expected: report checksum and size; only pre-existing unrelated user changes may remain uncommitted.
