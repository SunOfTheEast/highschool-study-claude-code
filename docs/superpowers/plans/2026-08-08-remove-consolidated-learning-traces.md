# Remove Consolidated Learning Traces Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Delete the standalone Lesson Trace layer while preserving immutable Classroom Logs and timestamped object learning history that points directly to supporting Blocks.

**Architecture:** `lesson_memory_commit` remains the sole atomic Lesson-memory transaction. Each object mutation carries one object-specific history change plus current-Lesson Block IDs; Runtime validates those IDs and appends a dated `Learning History` entry directly to the object file. Lessons no longer parse, render, or accept a Trace section, and readers route `INDEX → L1 object/preference → exact Block only when needed`.

**Tech Stack:** TypeScript, Bun test runner, TypeBox, Markdown resource contracts, Pi native tools.

## Global Constraints

- Do not add a compatibility reader, migration layer, double write, Trace alias, database, or background process.
- Keep Classroom Log facts append-only and keep object `Learning History` entries append-only.
- Preserve atomic multi-document commit, successful tool-call replay, Runtime-owned timestamps, bound Lesson paths, and model-declared routing.
- Current Sessions do not reread the memory they just committed.
- Preserve unrelated work and leave dated historical specs/audits as historical records.

---

### Task 1: Retire Trace from the Lesson document contract

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/markdown-domain.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/lesson-mutations.test.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/markdown.ts`
- Modify: `apps/pi-teaching-web/resources/contracts/m0-document-contract.md`

**Interfaces:**
- Produces: `LessonDocument` without `consolidatedLearningTraces`.
- Produces: strict Lesson parsing that accepts only `Lesson Goal` and `Block *` level-two sections.

- [ ] **Step 1: Write failing parser tests**

Replace the acceptance tests for `Consolidated Learning Traces` with one rejection test:

```ts
test('rejects the retired consolidated learning trace section', () => {
  const root = copyFixture();
  const relative = 'plans/plan-001/lessons/lesson-001.md';
  const path = join(root, relative);
  writeFileSync(path, `${readFileSync(path, 'utf8').trimEnd()}\n\n## Consolidated Learning Traces\n\n### trace-old\n\n- 情境：旧格式。\n`);

  expect(() => readLesson(root, relative)).toThrow('unsupported Lesson section');
});
```

Remove assertions that expose `lesson.consolidatedLearningTraces`; update the mutation regression to assert Classroom Log append preserves all other Lesson bytes without naming Trace.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test tests/m0/markdown-domain.test.ts tests/m0/lesson-mutations.test.ts
```

Expected: the retired section is still accepted and the removed TypeScript field is still present.

- [ ] **Step 3: Remove the parser and type surface**

Delete `consolidatedLearningTraces` from `LessonDocument`, delete `validateConsolidatedLearningTraces`, and simplify the Lesson section guard to:

```ts
if (section.heading !== 'Lesson Goal' && !section.heading.startsWith('Block ')) {
  throw new StudyDocumentError(source.path, `unsupported Lesson section "${section.heading}"`);
}
```

Return only the canonical Lesson fields. Delete the Trace section example and rules from `m0-document-contract.md`.

- [ ] **Step 4: Run GREEN**

Run:

```bash
bun test tests/m0/markdown-domain.test.ts tests/m0/lesson-mutations.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/tests/m0/markdown-domain.test.ts apps/pi-teaching-web/tests/m0/lesson-mutations.test.ts apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/src/study/markdown.ts apps/pi-teaching-web/resources/contracts/m0-document-contract.md
git commit -m "refactor: retire lesson trace sections"
```

### Task 2: Write object learning history directly from Block evidence

**Files:**
- Modify: `apps/pi-teaching-web/tests/m1/memory-mutations.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1/memory-tools.test.ts`
- Modify: `apps/pi-teaching-web/src/study/memory-mutations.ts`
- Modify: `apps/pi-teaching-web/src/runtime/memory-tools.ts`

**Interfaces:**
- Consumes: active Lesson `blocks[].id` from Task 1.
- Produces: `ObjectMutation.learningHistoryEntry: { change: string; evidenceBlockIds: string[] }`.
- Produces: `planLessonMemoryCommit(...)` without `traceIds` and without a Lesson candidate unless `closingFact` changes the Lesson.

- [ ] **Step 1: Rewrite domain tests for the desired contract**

Use object inputs shaped as:

```ts
{
  target: { kind: 'existing', id: 'obj-001' },
  currentJudgment: '能在明确提示后完成；自主识别尚未证明。',
  evolutionOverview: '从首次停顿到提示后完成。',
  boundaries: ['外观改变后的独立识别尚未证明。'],
  learningHistoryEntry: {
    change: '提示比较共同结构后完成；自主识别仍待检验。',
    evidenceBlockIds: ['block-001'],
  },
  routing: { kind: 'keep' },
}
```

Assert:

```ts
expect(objectAfter).toContain('## Learning History');
expect(objectAfter).toContain('2026-08-07 20:15');
expect(objectAfter).toContain('[lesson-001](../../plans/plan-001/lessons/lesson-001.md)');
expect(objectAfter).toContain('Block `block-001`');
expect(planned.candidates.some((item) => item.path === lessonPath)).toBeFalse();
expect(planned).not.toHaveProperty('traceIds');
```

Keep tests for: two objects interpreting the same Block differently; missing/repeated Block IDs; old history preservation after a correction; preferences-only commits; routing; path confinement; atomic candidate sets.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test tests/m1/memory-mutations.test.ts tests/m1/memory-tools.test.ts
```

Expected: inputs fail because Runtime still requires `traces` and `traceEntries`, objects still render `Trace Timeline`, and outputs still contain `traceIds`.

- [ ] **Step 3: Replace the domain model and renderer**

Replace the Trace types with:

```ts
export type ObjectLearningHistoryEntry = {
  change: string;
  evidenceBlockIds: string[];
};

export type ObjectMutation = {
  target: ExistingOrNew;
  currentJudgment: string;
  evolutionOverview: string;
  boundaries: string[];
  learningHistoryEntry: ObjectLearningHistoryEntry;
  routing: RoutingDecision;
  frontierSummary?: string;
};
```

Render each entry as a date/time line followed by one source line per unique Block. Use the existing stable Lesson path and display the exact Block ID; do not invent Markdown heading fragments. Rename the required object section from `Trace Timeline` to `Learning History`. Delete Trace ID generation, Trace topology validation, Lesson Trace rendering, capability signal, and `traceIds` from the return value.

Validate every history change as non-empty, require at least one evidence Block, reject repeated Block IDs, and reject IDs absent from the bound Lesson.

- [ ] **Step 4: Replace the native tool schema and receipt**

Delete `traces` from `lessonMemoryCommitParameters`, replace `traceEntries` with:

```ts
learningHistoryEntry: Type.Object({
  change: Type.String({ minLength: 1 }),
  evidenceBlockIds: Type.Array(stableId, { minItems: 1, uniqueItems: true }),
}, { additionalProperties: false }),
```

Delete `traceIds` from the successful receipt and change the tool description to commit “the current Lesson closing fact, object learning history and judgments, explicit preferences, and model-declared routing.”

- [ ] **Step 5: Run GREEN**

Run:

```bash
bun test tests/m1/memory-mutations.test.ts tests/m1/memory-tools.test.ts
```

Expected: all selected tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/pi-teaching-web/tests/m1/memory-mutations.test.ts apps/pi-teaching-web/tests/m1/memory-tools.test.ts apps/pi-teaching-web/src/study/memory-mutations.ts apps/pi-teaching-web/src/runtime/memory-tools.ts
git commit -m "refactor: write object history from lesson blocks"
```

### Task 3: Remove Trace from active teaching behavior

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/tests/m1/lesson-memory-guard.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1/retired-plugin-surface.test.ts`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/resources/contracts/m1-memory-contract.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-dialogue/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-dialogue/references/post-lesson-review.md`
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-dialogue/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-dialogue/references/next-plan.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-recall.md`

**Interfaces:**
- Consumes: `Learning History` and direct Block evidence from Task 2.
- Produces: one active reading route: `INDEX → relevant L1 → exact Block only for missing/conflicting/high-impact detail`.

- [ ] **Step 1: Write failing resource-contract tests**

Change the Skill tests to require, in order:

```ts
expectInOrder(recall, ['memory/INDEX.md', '对象记忆', 'Classroom Log']);
expectInOrder(review, ['memory/INDEX.md', '对象记忆', '能力假设', '偏好', 'Classroom Log']);
```

Require `Learning History`, exact Block IDs, current-evidence priority, the missing/conflicting/high-impact drill-down gate, and the no-reread-after-commit rule. Add a retired-surface scan across active resources and source files that rejects:

```ts
/Consolidated Learning Traces|TraceDraft|traceEntries|traceIds|Trace Timeline|Lesson Trace/
```

Replace guard tests for native Trace appends with a test proving any native Lesson body edit is rejected and directed to `classroom_log_append`, `classroom_update`, or `lesson_memory_commit` as appropriate.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test tests/m1/lesson-memory-guard.test.ts tests/m1/memory-skill-tree.test.ts tests/m1/retired-plugin-surface.test.ts
```

Expected: active resources still teach the old Trace route and the retired-surface scan reports matches.

- [ ] **Step 3: Rewrite the active contract and Skill bright lines**

Make the durable model explicit:

```text
Classroom Log = raw classroom fact
Object Learning History = object-specific compressed change with direct Block sources
Capability = Plan/Roadmap cross-object hypothesis
Preference = explicit or repeatedly confirmed interaction need
INDEX/buckets = routing only
```

Tutor consolidation submits only object history/judgments, preferences, routing, and optional closing fact. Plan and Roadmap start from L0/L1 and drill to an exact Block only when the compressed memory is missing, conflicting, or supports a high-impact decision. Remove instructions to read a just-closed Lesson first, to generate capability signals in Tutor, or to preserve/correct old Trace entries.

Keep all existing approval gates, Session ownership, route ownership, append-only correction semantics, and the rule that current classroom evidence outranks memory.

- [ ] **Step 4: Run GREEN**

Run:

```bash
bun test tests/m1/lesson-memory-guard.test.ts tests/m1/memory-skill-tree.test.ts tests/m1/retired-plugin-surface.test.ts
```

Expected: all selected tests pass and the active surface contains no retired Trace term.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md apps/pi-teaching-web/tests/m1/lesson-memory-guard.test.ts apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts apps/pi-teaching-web/tests/m1/retired-plugin-surface.test.ts apps/pi-teaching-web/resources/agents/plan-node.md apps/pi-teaching-web/resources/contracts/m1-memory-contract.md apps/pi-teaching-web/resources/skills/plan-dialogue/SKILL.md apps/pi-teaching-web/resources/skills/plan-dialogue/references/post-lesson-review.md apps/pi-teaching-web/resources/skills/roadmap-dialogue/SKILL.md apps/pi-teaching-web/resources/skills/roadmap-dialogue/references/next-plan.md apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-recall.md
git commit -m "docs: remove trace from teaching memory flow"
```

### Task 4: Verify the deletion and product flow

**Files:**
- Modify if needed: `apps/pi-teaching-web/tests/m1/m1a-validation-protocol.test.ts`
- Modify if needed: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Modify: `docs/superpowers/specs/2026-08-08-remove-consolidated-learning-traces-design.md`

**Interfaces:**
- Consumes: Tasks 1–3.
- Produces: passing repository checks and an implemented design record.

- [ ] **Step 1: Run the retired-surface search**

Run:

```bash
rg -n 'Consolidated Learning Traces|TraceDraft|traceEntries|traceIds|Trace Timeline|Lesson Trace' AGENTS.md apps/pi-teaching-web/src apps/pi-teaching-web/resources apps/pi-teaching-web/tests
```

Expected: no matches except an intentionally quoted rejection fixture inside the parser test and the retired-surface test's own pattern. Remove or rename any other active match.

- [ ] **Step 2: Run all deterministic checks**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: typecheck, all non-E2E tests, and production build pass.

- [ ] **Step 3: Run the course E2E**

Run:

```bash
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: the Roadmap → Plan → Lesson browser cycle passes.

- [ ] **Step 4: Mark the design implemented and inspect the diff**

Change the design status to `已实施并通过确定性验收`, run `git diff --check`, and inspect `git diff --stat` plus `git status --short`. Confirm only the Trace-removal branch files changed.

- [ ] **Step 5: Commit**

```bash
git add docs/superpowers/specs/2026-08-08-remove-consolidated-learning-traces-design.md apps/pi-teaching-web/tests/m1/m1a-validation-protocol.test.ts apps/pi-teaching-web/tests/m0/native-session.test.ts
git commit -m "test: verify direct object memory flow"
```
