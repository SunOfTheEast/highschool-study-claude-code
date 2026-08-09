# Formal Lesson Incremental Object Memory Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Plan-bound Lessons append object Learning History while patching only snapshot fields that actually changed, without weakening first-time object creation or Lesson Block provenance.

**Architecture:** Represent Lesson object writes as two schema and TypeScript variants keyed by `target.kind`. Existing objects require one new history entry and accept optional snapshot patches; new objects require the complete snapshot. The Markdown mutation keeps omitted sections byte-identical and still binds every Lesson history entry to verified Blocks in the current Lesson.

**Tech Stack:** TypeScript 7, Bun test, TypeBox, Markdown document mutations.

## Global Constraints

- Original Classroom Logs and object Learning History entries remain append-only.
- Runtime continues to bind time, Lesson path, stable IDs, and source links.
- Existing objects cannot use deferred routing; new objects cannot use keep routing.
- Preferences, capabilities, course lifecycle, and free-learning behavior remain unchanged.
- No new memory layer, evolution stage enum, or generic memory tool is introduced.

---

### Task 1: Make the Lesson object contract incremental

**Files:**
- Modify: `apps/pi-teaching-web/tests/m1/memory-mutations.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1/memory-tools.test.ts`
- Modify: `apps/pi-teaching-web/src/study/memory-mutations.ts`
- Modify: `apps/pi-teaching-web/src/runtime/memory-tools.ts`

**Interfaces:**
- Consumes: `planLessonMemoryCommit(root, lessonPath, draft, recordedAt)` and `createLessonMemoryTool(root, lessonPath)`.
- Produces: a discriminated `ObjectMutation` contract where `target.kind === 'existing'` permits optional `currentJudgment`, `evolutionOverview`, and `boundaries`, while `target.kind === 'new'` requires all three.

- [ ] **Step 1: Write failing mutation tests for an existing-object patch and incomplete new object**

Add a test that submits an existing object with only `learningHistoryEntry`, `routing`, and one changed snapshot field. Assert that Learning History is appended, the supplied field changes, and omitted `Evolution Overview` and boundaries remain byte-identical. Add a planner-level test that casts an incomplete new-object draft across the public boundary and expects `NEW_OBJECT_SNAPSHOT_REQUIRED`.

- [ ] **Step 2: Run the focused mutation tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/memory-mutations.test.ts
```

Expected: FAIL because existing Lesson objects still require and rewrite every snapshot field.

- [ ] **Step 3: Write failing schema tests for the two variants**

Use `Check(tool.parameters, input)` to assert that an existing-object history-only update is accepted, a complete new object remains accepted, and a new object missing any snapshot field is rejected.

- [ ] **Step 4: Run the focused tool tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/memory-tools.test.ts
```

Expected: FAIL because `lessonMemoryCommitParameters` currently requires all snapshot fields for every target.

- [ ] **Step 5: Implement the discriminated TypeScript and TypeBox contracts**

Split the Lesson mutation into existing and new target variants. Validate complete snapshots only in the new-object branch. For an existing object, validate only snapshot fields that were supplied. Keep the history entry and routing required in both variants.

```ts
type ExistingLessonObjectMutation = {
  target: { kind: 'existing'; id: string };
  currentJudgment?: string;
  evolutionOverview?: string;
  boundaries?: string[];
  learningHistoryEntry: ObjectLearningHistoryEntry;
  routing: RoutingDecision;
  frontierSummary?: string;
};

type NewLessonObjectMutation = {
  target: { kind: 'new'; key: string; title: string };
  currentJudgment: string;
  evolutionOverview: string;
  boundaries: string[];
  learningHistoryEntry: ObjectLearningHistoryEntry;
  routing: RoutingDecision;
  frontierSummary?: string;
};

export type ObjectMutation = ExistingLessonObjectMutation | NewLessonObjectMutation;
```

- [ ] **Step 6: Patch only supplied Markdown snapshot sections**

Change the existing-object updater so it starts from the current source, replaces `Current Judgment`, `Evolution Overview`, or `Boundaries / Not Yet Demonstrated` only when the corresponding property is present, and always appends the new Learning History entry. Reuse this same helper for free learning; its existing schema and observable behavior remain unchanged.

- [ ] **Step 7: Run focused tests and typecheck for GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/memory-mutations.test.ts tests/m1/memory-tools.test.ts tests/m1b/free-learning-memory.test.ts
bun run typecheck
```

Expected: all tests pass and TypeScript reports no errors.

- [ ] **Step 8: Commit the runtime change**

```bash
git add apps/pi-teaching-web/src/study/memory-mutations.ts apps/pi-teaching-web/src/runtime/memory-tools.ts apps/pi-teaching-web/tests/m1/memory-mutations.test.ts apps/pi-teaching-web/tests/m1/memory-tools.test.ts
git commit -m "feat: make lesson object memory incremental"
```

### Task 2: Align the Tutor-facing contract with the runtime

**Files:**
- Modify: `apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts`
- Modify: `apps/pi-teaching-web/resources/contracts/m1-memory-contract.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md`

**Interfaces:**
- Consumes: the Task 1 `lesson_memory_commit` schema.
- Produces: one Tutor instruction: append the current Lesson change, patch only changed snapshots for existing objects, and provide a complete snapshot for new objects.

- [ ] **Step 1: Write a failing skill-contract test**

Assert that both the shared memory contract and Lesson consolidation reference state that existing objects preserve omitted snapshot fields, that new objects require a complete snapshot, and that Evolution Overview changes only when the longitudinal interpretation changes.

- [ ] **Step 2: Run the skill test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/memory-skill-tree.test.ts
```

Expected: FAIL because the Lesson reference currently says to rewrite every snapshot field.

- [ ] **Step 3: Replace the full-rewrite instruction with the incremental bright line**

Update the contract and Tutor reference with concise Chinese wording. Preserve exact Lesson Block evidence, correction-as-append, one semantic tool call, and no post-write reread. Do not add a stage model or mandatory rewrite cadence.

- [ ] **Step 4: Run the skill and memory regressions for GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/memory-skill-tree.test.ts tests/m1/memory-mutations.test.ts tests/m1/memory-tools.test.ts tests/m1b/free-learning-memory.test.ts
```

Expected: all tests pass.

- [ ] **Step 5: Commit the teaching-contract change**

```bash
git add apps/pi-teaching-web/resources/contracts/m1-memory-contract.md apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts
git commit -m "docs: teach incremental lesson memory updates"
```

### Task 3: Verify the integrated application

**Files:**
- Verify only; no planned production changes.

**Interfaces:**
- Consumes: Tasks 1 and 2.
- Produces: evidence that the complete Pi teaching app remains type-safe, tested, and buildable.

- [ ] **Step 1: Run the complete application check**

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: typecheck, non-E2E tests, and Vite build all pass.

- [ ] **Step 2: Inspect the final diff and repository state**

```bash
git diff --check
git status --short --branch
git log -4 --oneline
```

Expected: no whitespace errors, no uncommitted implementation files, and the design plus two implementation commits are visible.
