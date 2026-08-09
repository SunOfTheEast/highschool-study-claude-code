# StudyForge Display Math Spacing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让复杂行间公式拥有教材式的字号和垂直留白，同时保持行内公式与横向溢出行为不变。

**Architecture:** 只调整共享 `.katex-display` 的视觉规则，不改变 Markdown、KaTeX 渲染链或组件结构。用现有 CSS 回归测试锁定行间公式专属字号、内边距和段间距。

**Tech Stack:** CSS、KaTeX、Bun Test、Playwright

## Global Constraints

- 行间公式放大 `8%`，上下内边距 `.5em`，段间距 `var(--space-4, 1rem)`。
- 行内公式不得改变。
- 保留 `overflow-x: auto` 和页面宽度约束。
- 不新增视觉容器或组件。

---

### Task 1: 校准行间公式的阅读尺度

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/math-markdown.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`

**Interfaces:**
- Consumes: 现有 `.katex-display` 规则与 `MarkdownView` 渲染链。
- Produces: 仅作用于行间公式的字号和垂直间距。

- [ ] **Step 1: 写失败测试**

在现有 CSS 回归测试中断言 `.katex-display` 使用 `font-size: 1.08em`、`padding-block: .5em` 和 `margin: var(--space-4, 1rem) 0`，并继续包含 `overflow-x: auto`。

- [ ] **Step 2: 验证 RED**

Run: `cd apps/pi-teaching-web && bun test tests/m0/math-markdown.test.tsx`

Expected: 行间公式排版测试因当前字号、内边距和段间距不足而失败。

- [ ] **Step 3: 最小实现**

将共享规则调整为：

```css
.katex-display {
  max-width: 100%;
  margin: var(--space-4, 1rem) 0;
  padding-block: .5em;
  overflow-x: auto;
  overflow-y: hidden;
  overscroll-behavior-inline: contain;
  font-size: 1.08em;
}
```

- [ ] **Step 4: 验证 GREEN 与视觉结果**

Run: `cd apps/pi-teaching-web && bun test tests/m0/math-markdown.test.tsx && bun run typecheck`

Expected: 全部通过。

用相同的惰性气体回复重新截图，确认复杂分式舒展、顶部不裁切、行内公式未改变。

- [ ] **Step 5: 完整验证并提交**

Run: `cd apps/pi-teaching-web && bun run check && bun run test:e2e -- tests/e2e/m0-cycle.spec.ts`

Expected: 完整检查与三条关键 E2E 全部通过。

```bash
git add apps/pi-teaching-web/src/client/styles.css apps/pi-teaching-web/tests/m0/math-markdown.test.tsx
git commit -m "fix: give display math room to breathe"
```
