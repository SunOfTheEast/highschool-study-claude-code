# Knowledge Atlas Contrast Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the left knowledge map and right contextual folio immediately distinguishable without changing layout, content, or interaction.

**Architecture:** Repair the missing strong-rule theme token, then use that token for both paper boundaries. Keep the map as gridded `--paper-mid`; make the folio a bounded `--paper-deep` sheet with its existing cinnabar top edge.

**Tech Stack:** CSS custom properties, React client styles, Bun tests, Playwright screenshots.

## Global Constraints

- Keep the existing 7:3 desktop layout and the 980px stacking breakpoint.
- Do not change graph semantics, copy, actions, spacing, or node rendering.
- Do not turn the folio into a floating card or apply stronger rules across unrelated pages.
- Verify both 1024px and 1440px desktop output.

---

### Task 1: Give the atlas and folio explicit paper boundaries

**Files:**
- Modify: `apps/pi-teaching-web/src/client/theme-liubai.css`
- Modify: `apps/pi-teaching-web/src/client/styles/knowledge.css`
- Test: `apps/pi-teaching-web/tests/m1d/visual-grammar.test.tsx`
- Test: `apps/pi-teaching-web/tests/e2e/m1d-ui.spec.ts`

**Interfaces:**
- Consumes: existing `--paper-mid`, `--paper-deep`, `--ink`, and `--cinnabar` theme tokens.
- Produces: `--rule-strong` and explicit static boundaries for `.semantic-canvas` and `.knowledge-folio`.

- [ ] **Step 1: Write the failing visual grammar test**

Add this test to `tests/m1d/visual-grammar.test.tsx`:

```ts
test('separates the atlas canvas from its contextual folio with explicit paper boundaries', () => {
  const theme = readFileSync(join(import.meta.dir, '../../src/client/theme-liubai.css'), 'utf8');
  const styles = readFileSync(join(import.meta.dir, '../../src/client/styles/knowledge.css'), 'utf8');

  expect(theme).toContain('--rule-strong: rgba(27, 25, 22, .20)');
  expect(styles).toMatch(
    /\.semantic-canvas\s*\{[^}]*border:\s*1px solid var\(--rule-strong\)/s,
  );
  expect(styles).toMatch(
    /\.knowledge-folio\s*\{[^}]*border:\s*1px solid var\(--rule-strong\)[^}]*border-top:\s*3px solid var\(--cinnabar\)[^}]*background:\s*var\(--paper-deep\)/s,
  );
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1d/visual-grammar.test.tsx
```

Expected: FAIL because `--rule-strong` is undefined and `.knowledge-folio` has no complete border.

- [ ] **Step 3: Implement the minimal style correction**

In `theme-liubai.css`, add beside the existing rule tokens:

```css
--rule-strong: rgba(27, 25, 22, .20);
```

In `.knowledge-folio`, replace the surface declarations with:

```css
border: 1px solid var(--rule-strong);
border-top: 3px solid var(--cinnabar);
background: var(--paper-deep);
```

Leave `.semantic-canvas` using its existing `1px solid var(--rule-strong)` declaration so defining the token restores the intended frame.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
bun test tests/m1d/visual-grammar.test.tsx tests/m1d/semantic-graph.test.tsx
bun run typecheck
```

Expected: all focused tests pass and TypeScript reports no errors.

- [ ] **Step 5: Recreate and inspect desktop screenshots**

Run:

```bash
bun run test:e2e -- tests/e2e/m1d-ui.spec.ts
```

Inspect:

- `output/playwright/m1d-knowledge-tag-1024.png`
- `output/playwright/m1d-knowledge-tag-1440.png`
- `output/playwright/m1d-knowledge-asset-1440.png`

Expected: map and folio are distinct at a glance, the folio still reads as paper rather than a generic card, and no horizontal overflow appears.

- [ ] **Step 6: Run complete verification**

Run:

```bash
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts tests/e2e/m1c-cycle.spec.ts tests/e2e/m1d-ui.spec.ts
git diff --check
```

Expected: 0 failures, production build succeeds, all eight cycle E2E tests pass, and no whitespace errors remain.

- [ ] **Step 7: Commit the implementation**

```bash
git add apps/pi-teaching-web/src/client/theme-liubai.css \
  apps/pi-teaching-web/src/client/styles/knowledge.css \
  apps/pi-teaching-web/tests/m1d/visual-grammar.test.tsx
git commit -m "fix: separate knowledge atlas from folio"
```
