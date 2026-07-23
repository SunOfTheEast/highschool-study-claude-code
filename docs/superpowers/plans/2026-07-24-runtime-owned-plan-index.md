# Runtime-Owned Plan Index Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent Coach `plan_update` calls from corrupting Lesson Index links and keep Roadmap Plan status aligned with Plan frontmatter.

**Architecture:** Keep pedagogical audit prose model-authored, but derive the Lesson Index from real Lesson Markdown. Preserve existing Lesson order, append unlinked same-Plan Lessons, and synchronize only the managed Plan status token in the existing Roadmap Plan Graph entry.

**Tech Stack:** TypeScript 7, Bun 1.3.14, TypeBox, Markdown files, `bun:test`.

## Global Constraints

- Do not add a tool, database, persistent schema field, compatibility path, or background index.
- Do not change card, Trace, ability, Session, or no-spoiler behavior.
- Do not let model arguments select owner paths or write Lesson Index Markdown.
- Preserve existing Plan and Lesson ordering wherever it is already explicit.
- Follow RED → GREEN for each executable behavior.

---

## File Responsibilities

- `apps/pi-teaching-web/src/runtime/plan-update.ts`: expose only model-authored audit fields.
- `apps/pi-teaching-web/src/study/write-workspace.ts`: derive Lesson Index and synchronize Roadmap status.
- `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`: lock the public Pi tool schema.
- `apps/pi-teaching-web/tests/study/write-workspace.test.ts`: reproduce and prevent structural overwrite.
- `AGENTS.md`: document runtime ownership of Plan structural projections.
- `docs/zh-CN/完整说明书.md`: update the user-facing Plan writeback contract.

### Task 1: Remove Lesson Index From the Model Contract

**Files:**
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-update.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`

**Interfaces:**
- Consumes: current Session-bound `createPlanUpdateTool(root, ownerPath)`.
- Produces:

```ts
export type PlanUpdateInput = {
  decision: 'active' | 'complete' | 'replan';
  currentPosition: string;
  nextLessonCandidate: string;
  planSummary: string;
};
```

- [ ] **Step 1: Write the failing schema test**

Change the expected property list to:

```ts
expect(Object.keys(properties)).toEqual([
  'decision',
  'currentPosition',
  'nextLessonCandidate',
  'planSummary',
]);
expect(JSON.stringify(tool.parameters)).not.toContain('lessonIndex');
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts --test-name-pattern \
  "exposes one flat Coach plan_update contract"
```

Expected: FAIL because `lessonIndex` is still exposed.

- [ ] **Step 3: Remove the field from the TypeBox schema and TypeScript input**

Delete `lessonIndex` from `createPlanUpdateTool().parameters` and
`PlanUpdateInput`. Do not add a replacement model field.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: PASS.

### Task 2: Derive Lesson Index and Synchronize Roadmap Status

**Files:**
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`

**Interfaces:**
- Consumes: `updatePlan(root, planPath, input: PlanUpdateInput)`.
- Produces: a Plan whose `## Lesson Index` is derived from real Lesson Markdown,
  and a Roadmap whose matching Plan Graph entry carries the actual Plan status.

- [ ] **Step 1: Write the failing structural regression test**

Create two real Lesson files for `p1`, leave only the first linked, then call:

```ts
updatePlan(root, 'plans/p1.md', {
  decision: 'complete',
  currentPosition: '能力标准已满足。',
  nextLessonCandidate: '无。',
  planSummary: '决定：完成。',
});
```

Assert that the Plan contains both canonical links in existing-plus-discovered
order, uses each real status, excludes another Plan's Lesson, and that
`ROADMAP.md` contains:

```text
- [测试 Plan](plans/p1.md) — completed；
```

- [ ] **Step 2: Run the focused write-workspace test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts --test-name-pattern \
  "derives the Lesson Index"
```

Expected: FAIL because `updatePlan` still expects model-supplied Lesson Index.

- [ ] **Step 3: Implement the minimal derivation**

Add internal helpers that:

```ts
type LessonIndexEntry = {
  path: string;
  title: string;
  status: string;
};
```

- parse existing Lesson links;
- read linked Lesson files in their current order;
- scan `lessons/*.md` for additional files with matching `plan_id`;
- append only missing matches by sorted path;
- render numbered relative links from real titles and statuses;
- return `（暂无）` when empty.

Add one Plan Graph helper that updates the exact linked Plan's leading status
token while retaining the remaining human suffix. Build both next documents
before the first write.

- [ ] **Step 4: Run the focused test and verify GREEN**

Run the command from Step 2. Expected: PASS.

- [ ] **Step 5: Run all affected unit tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts tests/runtime/study-tools.test.ts
```

Expected: all tests pass.

### Task 3: Update the Current Contract and Verify End to End

**Files:**
- Modify: `AGENTS.md`
- Modify: `docs/zh-CN/完整说明书.md`

**Interfaces:**
- Produces: documentation stating that `lesson_prepare` and the runtime own
  Lesson Index structure while Coach owns audit conclusions.

- [ ] **Step 1: Update documentation**

Document these exact rules:

- `plan_update` has four model fields: `decision`, `currentPosition`,
  `nextLessonCandidate`, and `planSummary`;
- Lesson Index is reconstructed from true Lesson files and cannot be supplied
  by the model;
- Plan status changes synchronize the Roadmap Plan Graph status token.

- [ ] **Step 2: Run complete verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Then:

```bash
cd plugins/highschool-study
bun run release:check
```

Expected: type checking, all tests, production build, bundle, and strict plugin
validation pass.

- [ ] **Step 3: Re-run the retained real workflow on a fresh learning-set copy**

Create a new Plan, prepare its first Lesson, and perform one `plan_update`.
Assert:

- the Plan workspace still returns the prepared Lesson;
- the sidebar shows it without manual Markdown repair;
- Roadmap status matches Plan frontmatter;
- a second prepared Lesson remains visible after the next audit.

- [ ] **Step 4: Commit**

```bash
git add \
  AGENTS.md \
  apps/pi-teaching-web/src/runtime/plan-update.ts \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts \
  docs/zh-CN/完整说明书.md \
  docs/superpowers/specs/2026-07-24-runtime-owned-plan-index-design.md \
  docs/superpowers/plans/2026-07-24-runtime-owned-plan-index.md
git commit -m "fix: derive plan lesson indexes from source"
```
