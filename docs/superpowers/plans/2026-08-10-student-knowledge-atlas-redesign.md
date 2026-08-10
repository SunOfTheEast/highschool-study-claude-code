# Student Knowledge Atlas Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the three-column relation debugger with a two-column student knowledge atlas that makes concept relations legible and keeps related learning assets actionable.

**Architecture:** Keep `/knowledge` as a read-only client projection over existing `SemanticRelation[]`, `LearningAssetLibrarySnapshot`, and `LearningMaterial[]`. Extend the deterministic view model with focus-aware canvas selection, asset-title search, and bounded shared-tag asset neighbors; render one dominant atlas plus one contextual folio without adding durable schema, model calls, or a second mode state.

**Tech Stack:** React 19, TypeScript, Bun test, server-rendered component assertions, CSS/SVG deterministic layout, Playwright desktop E2E.

## Global Constraints

- `/knowledge` remains reachable from Learning Assets rather than primary navigation.
- Do not add persistent schemas, Agent calls, force solvers, graph dependencies, drag/edit state, or coordinate persistence.
- Canvas contains the focus plus at most 8 visible neighbors; canonical associations remain reachable in the folio.
- Co-occurrence means only “appears together in assets”; never call it prerequisite, similarity, causality, or the best next task.
- Derived asset neighbors use only shared tags, show at most 6 items, and use evidence-safe copy.
- Teacher memory, capability judgments, preferences, buckets, and internal IDs remain excluded.
- Do not read problem-card bodies during route entry or focus changes.
- Preserve the existing paper, ink, cinnabar, Songti/WenKai desktop visual grammar.

---

### Task 1: Build the focus-aware semantic atlas projection

**Files:**
- Modify: `apps/pi-teaching-web/src/client/semantic-graph.ts`
- Test: `apps/pi-teaching-web/tests/m1d/semantic-graph.test.tsx`

**Interfaces:**
- Consumes: existing relations, asset summaries, materials, and `focus: string | null`.
- Produces: `buildLocalSemanticGraph(input): LocalSemanticGraph` with deterministic `nodes`, canonical `associations`, and `neighborAssets: SemanticAssetNeighbor[]`.
- Produces: `searchSemanticGraphEntries(relations, assets, query): SemanticSearchEntry[]`.

- [ ] **Step 1: Write failing projection tests**

```ts
test('uses tag neighbors for a tag atlas while retaining direct assets', () => {
  const graph = buildLocalSemanticGraph({ relations, assets, materials, focus: 'tag:沉淀溶解平衡' });
  expect(graph.nodes[0]?.key).toBe('tag:沉淀溶解平衡');
  expect(graph.nodes.slice(1).every((node) => node.kind === 'tag')).toBe(true);
  expect(graph.associations.filter((item) => item.kind === 'asset')).toHaveLength(15);
});

test('derives at most six neighbors from shared tags without claiming similarity', () => {
  const graph = buildLocalSemanticGraph({ relations, assets, materials, focus: 'note:note-ksp' });
  expect(graph.neighborAssets.length).toBeLessThanOrEqual(6);
  expect(graph.neighborAssets[0]).toMatchObject({
    sharedCoreTags: ['沉淀溶解平衡'],
    relationLabel: '核心标签相同',
  });
});

test('searches tags and student asset titles from summaries', () => {
  expect(searchSemanticGraphEntries(relations, assets, 'Ksp').map((item) => item.key))
    .toContain('note:note-ksp');
  expect(searchSemanticGraphEntries(relations, assets, '平衡').some((item) => item.kind === 'tag'))
    .toBe(true);
});
```

- [ ] **Step 2: Run RED**

Run: `cd apps/pi-teaching-web && bun test tests/m1d/semantic-graph.test.tsx`

Expected: FAIL because `neighborAssets` and `searchSemanticGraphEntries` do not exist and tag focus currently fills the canvas with asset cards.

- [ ] **Step 3: Implement the minimal projection**

Add these public read-only shapes:

```ts
export type SemanticAssetNeighbor = {
  key: string;
  asset: LearningAssetHandle;
  label: string;
  detail: string;
  sharedCoreTags: string[];
  sharedTags: string[];
  relationLabel: '核心标签相同' | '核心标签不同';
};

export type SemanticSearchEntry = {
  key: string;
  kind: 'tag' | 'asset';
  label: string;
  detail: string;
};
```

Use nine fixed canvas slots with focus at `(50, 52)`. For tag focus select up to eight `tag-neighbor` associations by descending weight, falling back to direct assets only when there are no tag neighbors. For asset focus select core tags, related tags, then direct source. Derive neighbor assets by intersecting summary tags, exclude the focus, sort by shared-core count, shared-tag count, Chinese label, then stable key, and slice to six. Search only tag names and asset summary titles.

- [ ] **Step 4: Run GREEN**

Run: `bun test tests/m1d/semantic-graph.test.tsx`

Expected: all semantic graph tests PASS with deterministic positions and no teacher-memory text.

- [ ] **Step 5: Commit Task 1**

```bash
git add apps/pi-teaching-web/src/client/semantic-graph.ts apps/pi-teaching-web/tests/m1d/semantic-graph.test.tsx
git commit -m "feat: project focus-aware knowledge atlas"
```

---

### Task 2: Render the atlas and contextual folio

**Files:**
- Modify: `apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/tests/m0/knowledge-ui.test.tsx`
- Modify: `apps/pi-teaching-web/tests/m1d/semantic-graph.test.tsx`
- Modify: `apps/pi-teaching-web/tests/m1d/entry-and-dialogue-ui.test.tsx`

**Interfaces:**
- Consumes: Task 1 graph, neighbor, and search interfaces.
- Produces: `.knowledge-page-head` plus `.knowledge-atlas-layout` containing `.semantic-stage` and `.knowledge-folio`.
- Preserves: all existing navigation and asset action callbacks.

- [ ] **Step 1: Write failing component tests**

```ts
expect(markup).toContain('知识之间，怎么连起来');
expect(markup).toContain('搜索知识点、题卡或笔记');
expect(markup).toContain('class="knowledge-atlas-layout"');
expect(markup).toContain('class="knowledge-folio"');
expect(markup).not.toContain('关系检查器');
expect(markup).not.toContain('标签入口');
expect(markup).not.toContain('knowledge-entry');
expect(markup).not.toMatch(/最佳下一题|相似题|路线对照/);
```

Update Assets entry and loading copy expectations from “知识关系” to “知识图谱”, while asserting it does not appear as a primary AppShell link.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test tests/m0/knowledge-ui.test.tsx tests/m1d/semantic-graph.test.tsx tests/m1d/entry-and-dialogue-ui.test.tsx
```

Expected: FAIL on the old heading, three-column markup, tag-only search, and missing folio copy.

- [ ] **Step 3: Implement the two-focus React view**

Use this top-level structure:

```tsx
<header className="knowledge-page-head">
  <div><small>Knowledge atlas</small><h1>知识之间，怎么连起来</h1></div>
  <label className="knowledge-search">
    <span className="sr-only">搜索知识点、题卡或笔记</span>
    <input placeholder="搜索知识点、题卡或笔记" />
  </label>
</header>
<div className="knowledge-atlas-layout">
  <section className="semantic-stage" aria-label="知识地图">...</section>
  <aside className="knowledge-folio" aria-label="相关学习内容">...</aside>
</div>
```

Show grouped results only for a non-empty query; selecting one calls `selectFocus` and clears the query. Render asset titles through `MarkdownView inline`. Tag focus folio lists all direct assets core-first and remaining tag relations. Asset focus puts open/ask actions first, then every direct tag/source relation, then up to six truthful shared-tag neighbors. Rename only the Assets-page entry, page labels, and loading copy to “知识图谱”.

- [ ] **Step 4: Run GREEN**

Run:

```bash
bun test tests/m0/knowledge-ui.test.tsx tests/m1d/semantic-graph.test.tsx tests/m1d/entry-and-dialogue-ui.test.tsx
```

Expected: PASS with both focus states and unchanged callback boundaries.

- [ ] **Step 5: Commit Task 2**

```bash
git add apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx apps/pi-teaching-web/src/client/pages/AssetsPage.tsx apps/pi-teaching-web/src/client/App.tsx apps/pi-teaching-web/tests/m0/knowledge-ui.test.tsx apps/pi-teaching-web/tests/m1d/semantic-graph.test.tsx apps/pi-teaching-web/tests/m1d/entry-and-dialogue-ui.test.tsx
git commit -m "feat: render the student knowledge atlas"
```

---

### Task 3: Apply the approved paper-atlas visual grammar

**Files:**
- Modify: `apps/pi-teaching-web/src/client/styles/knowledge.css`
- Modify: `apps/pi-teaching-web/tests/m1d/visual-grammar.test.tsx`
- Modify: `apps/pi-teaching-web/tests/e2e/m1d-ui.spec.ts`

**Interfaces:**
- Consumes: Task 2 class names and existing Liubai theme tokens.
- Produces: a desktop 7:3 atlas/folio layout, typographic fixed-slot nodes, grid-paper canvas, centered paper-slip focus, and a cinnabar-topped folio.

- [ ] **Step 1: Write failing visual and E2E expectations**

```ts
const css = readFileSync(join(root, 'src/client/styles/knowledge.css'), 'utf8');
expect(css).toContain('.knowledge-atlas-layout');
expect(css).toMatch(/grid-template-columns:\s*minmax\(0,\s*7fr\)\s+minmax\(18rem,\s*3fr\)/);
expect(css).toContain('.knowledge-folio');
expect(css).toContain('.semantic-focus-slip');
expect(css).not.toContain('.knowledge-entry');
```

Update M1d E2E to click “知识图谱”, assert the new heading, search through the new placeholder, confirm the two visible regions, change from tag to displayed asset focus, and capture `m1d-knowledge-tag-1440.png` and `m1d-knowledge-asset-1440.png`.

- [ ] **Step 2: Run RED**

Run: `bun test tests/m1d/visual-grammar.test.tsx`

Expected: FAIL because approved atlas selectors and the two-column rule are absent.

- [ ] **Step 3: Replace the old CSS**

Delete `.knowledge-entry` and the three-column workspace. Implement the exact structural rules below, filling visual details only with existing theme tokens:

```css
.knowledge-workspace { min-height: calc(100dvh - var(--workspace-header-height)); padding: var(--space-5); }
.knowledge-atlas-layout { display: grid; grid-template-columns: minmax(0, 7fr) minmax(18rem, 3fr); gap: var(--space-5); }
.semantic-stage { min-width: 0; }
.semantic-canvas { position: relative; min-height: 32rem; }
.semantic-node { border: 0; background: transparent; box-shadow: none; }
.knowledge-folio { border-top: 3px solid var(--accent); background: var(--paper-mid); }
```

Keep long labels to one or two readable lines, prevent marker/text overlap, and stack the folio only for narrow desktop windows.

- [ ] **Step 4: Run GREEN and browser acceptance**

```bash
bun test tests/m1d/visual-grammar.test.tsx
bun run test:e2e -- tests/e2e/m1d-ui.spec.ts
```

Expected: both commands PASS; screenshots show tag and asset focus without horizontal overflow at 1440×900.

- [ ] **Step 5: Inspect screenshots and correct only requirement failures**

Inspect `output/playwright/m1d-knowledge-tag-1440.png` and `output/playwright/m1d-knowledge-asset-1440.png`. Correct only overlap, wrapping, hierarchy, or divergence from the approved paper-atlas direction; do not add decorative panels, animations, filters, or graph semantics.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/pi-teaching-web/src/client/styles/knowledge.css apps/pi-teaching-web/tests/m1d/visual-grammar.test.tsx apps/pi-teaching-web/tests/e2e/m1d-ui.spec.ts
git commit -m "style: reshape knowledge relations as an atlas"
```

---

### Task 4: Full regression verification

**Files:** Verify only; do not add broad defensive tests or unrelated refactors.

- [ ] **Step 1: Run the complete application check**

Run: `cd apps/pi-teaching-web && bun run check`

Expected: typecheck, 375+ non-E2E tests, and Vite production build all exit 0.

- [ ] **Step 2: Run the M1d E2E acceptance again**

Run: `bun run test:e2e -- tests/e2e/m1d-ui.spec.ts`

Expected: all M1d UI tests pass with fresh atlas screenshots.

- [ ] **Step 3: Review the exact diff**

```bash
git diff --check HEAD~3..HEAD
git diff --stat HEAD~3..HEAD
git status --short
```

Expected: no whitespace errors; only specified client, test, design, and plan files changed; no credentials, local Sessions, or fixture outputs tracked.

- [ ] **Step 4: Commit screenshot-driven source corrections only if present**

```bash
git add apps/pi-teaching-web/src/client/styles/knowledge.css apps/pi-teaching-web/tests/e2e/m1d-ui.spec.ts
git commit -m "fix: finish knowledge atlas visual acceptance"
```
