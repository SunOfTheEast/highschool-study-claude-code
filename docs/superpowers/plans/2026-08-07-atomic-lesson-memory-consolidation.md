# Atomic Lesson Memory Consolidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Tutor's repeated native Markdown edits with one session-bound semantic memory commit, while keeping all teaching judgments in the model and giving deferred object routing a narrow Plan-owned resolution path.

**Architecture:** Pure study-layer mutation functions turn a model-authored semantic commit into validated candidate Markdown files. A runtime-layer recoverable multi-document transaction applies those candidates and binds IDs, paths, timestamps, revisions, and receipts. Lesson and Plan custom tools expose only irreducible semantic choices; native Lesson `edit/write` is removed, while memory recall remains native `Read/Grep`.

**Tech Stack:** TypeScript 7, Bun 1.3.14 / `bun:test`, TypeBox through `@earendil-works/pi-ai`, Pi custom tools, canonical Markdown learning-set files, Node filesystem primitives.

## Global Constraints

- Work only in `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/m1-teacher-notebook-memory` on `codex/m1-teacher-notebook-memory`.
- Follow `docs/superpowers/specs/2026-08-07-atomic-lesson-memory-consolidation-design.md`.
- Runtime never infers object identity, current judgment, preference, capability signal, bucket membership, or deferred-routing reason.
- Runtime alone binds the current Lesson, Plan/Lesson IDs, paths, time, stable IDs, links, revisions, transaction order, and receipt.
- Existing Classroom Log entries and Trace sections are append-only. Corrections append a new fact and a new Trace.
- `memory/INDEX.md`, bucket files, and deferred routing are projections; object, preference, Trace, and Classroom Log files retain semantic ownership.
- No database, embedding index, graph tool, mastery enum, capability score, legacy plugin compatibility, or generic memory recall tool.
- M0 structural fallback remains: when `memory/INDEX.md` is absent, no memory write tool is registered.
- Use TDD for every code or Skill behavior change: write RED, run and read the expected failure, implement GREEN, rerun, then refactor.
- Commit after every independently green task.

---

## File Map

### New files

- `apps/pi-teaching-web/src/runtime/multi-document-transaction.ts` — recoverable application-level commit and startup recovery for an exact candidate set.
- `apps/pi-teaching-web/src/study/memory-mutations.ts` — semantic input types plus deterministic Markdown parsing, ID binding, candidate rendering, and route resolution.
- `apps/pi-teaching-web/src/runtime/memory-tools.ts` — TypeBox schemas and session-bound `lesson_memory_commit` / `memory_route_resolve` adapters.
- `apps/pi-teaching-web/tests/m1/multi-document-transaction.test.ts` — commit, stale source, rollback, crash recovery, symlink, and exact-path tests.
- `apps/pi-teaching-web/tests/m1/memory-mutations.test.ts` — Trace/object/preference/index/deferred-route mutation tests.
- `apps/pi-teaching-web/tests/m1/memory-tools.test.ts` — schema, registration, idempotency, receipt, and permission tests.
- `docs/audits/2026-08-07-atomic-lesson-memory-consolidation-smoke.md` — observed automated and real-model smoke evidence.

### Modified files

- `apps/pi-teaching-web/src/study/lesson-mutations.ts` — append one model-authored closing fact to an active Block or completed Reflection without changing status.
- `apps/pi-teaching-web/src/runtime/lesson-tools.ts`, `plan-tools.ts`, `session-scope.ts`, `session-factory.ts`, `resource-loader.ts`, `lesson-memory-guard.ts` — register bounded tools, remove Lesson native writes, and recover transactions.
- `apps/pi-teaching-web/src/server/app.ts` — publish course and knowledge invalidation for successful memory commits.
- `apps/pi-teaching-web/resources/contracts/m1-memory-contract.md`, `resources/agents/lesson-node.md`, `resources/agents/plan-node.md`, `resources/skills/tutor-lesson/references/memory-consolidation.md`, and `resources/skills/plan-dialogue/references/post-lesson-review.md` — cut over the behavioral route.
- `apps/pi-teaching-web/tests/m0/lesson-tools.test.ts`, `plan-tools.test.ts`, `native-session.test.ts`, `public-surface.test.ts`, `server-api.test.ts`, plus `tests/m1/lesson-memory-guard.test.ts` and `memory-skill-tree.test.ts` — freeze the new public contracts.
- `docs/audits/2026-08-07-m1a-memory-validation.md` — correct the invalid immediate-Session-switch temporal interpretation without altering unrelated findings.

---

### Task 1: Closure fact append boundary

**Files:**
- Modify: `apps/pi-teaching-web/src/study/lesson-mutations.ts`
- Test: `apps/pi-teaching-web/tests/m0/lesson-mutations.test.ts`

**Interfaces:**
- Consumes: canonical active Lesson Markdown parsed by `parseLessonSource`.
- Produces: `appendClosingClassroomLogSource(path, source, blockId, note): string`.

- [ ] **Step 1: Write RED tests for the two allowed states and one rejected state**

```ts
test('appends one closing fact to a completed Reflection without reopening it', () => {
  const source = reflectionBlockSource({ status: 'completed' });
  const next = appendClosingClassroomLogSource(
    lessonPath,
    source,
    'block-002',
    '学生补充：没有提示时还会继续硬算。',
  );
  const block = parseLessonSource(lessonPath, next).blocks[1]!;
  expect(block.status).toBe('completed');
  expect(block.classroomLog.at(-1)).toBe('学生补充：没有提示时还会继续硬算。');
});

test('appends one closing fact to the selected active Block', () => {
  const next = appendClosingClassroomLogSource(
    lessonPath,
    fixtureSource(),
    'block-002',
    '学生确认本课仍未证明稳定性。',
  );
  expect(parseLessonSource(lessonPath, next).blocks[1]?.classroomLog.at(-1))
    .toBe('学生确认本课仍未证明稳定性。');
});

test('rejects a closing fact on an ordinary completed Block', () => {
  const source = setBlockStatus(fixtureSource(), 'block-001', 'completed');
  expect(() => appendClosingClassroomLogSource(
    lessonPath,
    source,
    'block-001',
    '不应写入。',
  )).toThrow('active Block or completed Reflection');
});
```

- [ ] **Step 2: Run the focused test and verify RED**

```bash
cd apps/pi-teaching-web
bun test tests/m0/lesson-mutations.test.ts
```

Expected: import/export failure for `appendClosingClassroomLogSource`; pre-existing tests remain green.

- [ ] **Step 3: Implement the narrow append function**

Extract a shared `appendLogItemToBlock` from the current active-only implementation, then add:

```ts
export function appendClosingClassroomLogSource(
  path: string,
  source: string,
  blockId: string,
  note: string,
): string {
  const lesson = parseLessonSource(path, source);
  if (lesson.status !== 'active') {
    throw new StudyDocumentError(path, `Lesson must be active, found ${lesson.status}`);
  }
  const block = blockById(lesson, blockId, path);
  if (block.status !== 'active' && !(block.kind === 'reflection' && block.status === 'completed')) {
    throw new StudyDocumentError(
      path,
      `closing fact requires an active Block or completed Reflection: ${blockId}`,
    );
  }
  return appendLogItemToBlock(path, source, blockId, note);
}
```

- [ ] **Step 4: Run focused and adjacent tests GREEN**

```bash
bun test tests/m0/lesson-mutations.test.ts tests/m0/lesson-tools.test.ts
```

Expected: all tests pass with no warnings.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/src/study/lesson-mutations.ts \
  apps/pi-teaching-web/tests/m0/lesson-mutations.test.ts
git commit -m "feat: append bounded lesson closing facts"
```

---

### Task 2: Recoverable multi-document transaction

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/multi-document-transaction.ts`
- Create: `apps/pi-teaching-web/tests/m1/multi-document-transaction.test.ts`

**Interfaces:**

```ts
export type DocumentCandidate = {
  path: string;
  before: string | null;
  after: string;
  validate?: (source: string) => void;
};

export type TransactionTestHooks = {
  afterReplace?: (path: string, index: number) => void;
  leavePreparedOnError?: boolean;
};

export function commitDocumentCandidates(
  root: string,
  candidates: readonly DocumentCandidate[],
  hooks?: TransactionTestHooks,
): { commitId: string; changedPaths: string[] };

export function recoverDocumentTransactions(root: string): string[];
```

- [ ] **Step 1: Write RED tests for commit, stale source, rollback, and recovery**

```ts
test('commits an exact existing and new file set', () => {
  const receipt = commitDocumentCandidates(root, [
    { path: 'memory/INDEX.md', before: indexBefore, after: indexAfter },
    { path: 'memory/objects/obj-001.md', before: null, after: objectAfter },
  ]);
  expect(receipt.changedPaths).toEqual([
    'memory/INDEX.md',
    'memory/objects/obj-001.md',
  ]);
  expect(readFileSync(join(root, 'memory/INDEX.md'), 'utf8')).toBe(indexAfter);
});

test('rolls back every exact target after a mid-commit failure', () => {
  expect(() => commitDocumentCandidates(root, candidates, {
    afterReplace: (_path, index) => {
      if (index === 0) throw new Error('INJECTED_REPLACE_FAILURE');
    },
  })).toThrow('INJECTED_REPLACE_FAILURE');
  expect(readFileSync(join(root, 'memory/INDEX.md'), 'utf8')).toBe(indexBefore);
  expect(existsSync(join(root, 'memory/objects/obj-001.md'))).toBeFalse();
});

test('recovers an interrupted prepared manifest on next open', () => {
  expect(() => commitDocumentCandidates(root, candidates, {
    afterReplace: () => { throw new Error('SIMULATED_PROCESS_EXIT'); },
    leavePreparedOnError: true,
  })).toThrow('SIMULATED_PROCESS_EXIT');
  expect(recoverDocumentTransactions(root)).toHaveLength(1);
  expect(readFileSync(join(root, 'memory/INDEX.md'), 'utf8')).toBe(indexBefore);
});
```

Also cover stale bytes before first replacement, duplicate paths, empty sets, path escape, symlink segments, and an external post-crash edit that stops recovery.

- [ ] **Step 2: Run RED**

```bash
bun test tests/m1/multi-document-transaction.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 3: Implement manifest-backed application-level atomicity**

Use `<root>/.studyforge/transactions/<commitId>/manifest.json` with version 1, `prepared|committed` state, exact target paths, before/after hashes, original files, and candidate files. Validate every candidate and stale source before the first rename. Replace through same-directory temp files. Roll back only when current bytes equal the transaction candidate; otherwise preserve the manifest and throw `TRANSACTION_RECOVERY_CONFLICT:<path>`. Use a process-local root mutex.

- [ ] **Step 4: Run GREEN and the existing atomic regression**

```bash
bun test tests/m1/multi-document-transaction.test.ts tests/m0/atomic-document.test.ts
```

Expected: all tests pass and no completed transaction directory remains.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/src/runtime/multi-document-transaction.ts \
  apps/pi-teaching-web/tests/m1/multi-document-transaction.test.ts
git commit -m "feat: add recoverable document transactions"
```

---

### Task 3: Trace, object, root index, and deferred-route mutation engine

**Files:**
- Create: `apps/pi-teaching-web/src/study/memory-mutations.ts`
- Create: `apps/pi-teaching-web/tests/m1/memory-mutations.test.ts`

**Interfaces:**

```ts
export type ExistingOrNew =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; key: string; title: string };

export type TraceDraft = {
  key: string;
  situation: string;
  firstPerformance: string;
  actualHelp: string;
  laterPerformance: string;
  capabilitySignal?: string;
  evidenceBlockIds: string[];
};

export type BucketRef =
  | { kind: 'existing'; id: string }
  | { kind: 'new'; key: string; title: string };

export type RoutingDecision =
  | { kind: 'keep' }
  | { kind: 'assign'; buckets: BucketRef[] }
  | { kind: 'defer'; reason: string };

export type ObjectMutation = {
  target: ExistingOrNew;
  currentJudgment: string;
  evolutionOverview: string;
  boundaries: string[];
  traceEntries: Array<{ traceKey: string; meaning: string }>;
  routing: RoutingDecision;
  frontierSummary?: string;
};

export type PreferenceMutation = {
  target: ExistingOrNew;
  currentJudgment: string;
  scope: string[];
  explicitStatements: Array<{ text: string; evidenceBlockId: string }>;
  evolutionEntry: string;
  cue: { kind: 'keep' } | { kind: 'upsert'; summary: string } | { kind: 'remove' };
};

export type LessonMemoryCommitDraft = {
  closingFact?: { blockId: string; note: string };
  traces: TraceDraft[];
  objects: ObjectMutation[];
  preferences: PreferenceMutation[];
};

export function planLessonMemoryCommit(
  root: string,
  lessonPath: string,
  draft: LessonMemoryCommitDraft,
  recordedAt: string,
): {
  candidates: DocumentCandidate[];
  traceIds: Record<string, string>;
  objectIds: Record<string, string>;
  preferenceIds: Record<string, string>;
  bucketIds: Record<string, string>;
};
```

- [ ] **Step 1: Write RED for an existing object with `keep`**

```ts
const planned = planLessonMemoryCommit(root, lessonPath, {
  traces: [trace('event')],
  objects: [{
    target: { kind: 'existing', id: 'obj-001' },
    currentJudgment: '能在明确提示后完成；自主识别尚未证明。',
    evolutionOverview: '从首次停顿到提示后完成。',
    boundaries: ['外观改变后的独立识别尚未证明。'],
    traceEntries: [{ traceKey: 'event', meaning: '提示后完成。' }],
    routing: { kind: 'keep' },
    frontierSummary: '提示后可完成，自主识别待检验。',
  }],
  preferences: [],
}, '2026-08-07T20:15:00.000Z');

expect(candidate(planned, lessonPath).after)
  .toContain('### trace-plan-001-lesson-001-01');
expect(candidate(planned, 'memory/objects/obj-001.md').after)
  .toContain('## Trace Timeline');
expect(planned.candidates.some((item) => item.path.includes('indexes/'))).toBeFalse();
```

- [ ] **Step 2: Add RED for new object `assign`, new object `defer`, and one Trace to two objects**

Assertions must prove:

- Runtime assigns `obj-001`, `bucket-001`, and the next Lesson-local Trace number.
- `assign` creates only the explicitly named bucket and root link.
- `defer` creates no bucket and adds one `Deferred Object Routing` entry with the model reason.
- one Trace body appears once in Lesson while both object timelines link the same Trace anchor.
- every Trace key is referenced by at least one object; empty assign and new-object keep fail before candidates are returned.
- existing IDs resolve only to `memory/objects/<id>.md`; paths never enter semantic input.

- [ ] **Step 3: Run RED**

```bash
bun test tests/m1/memory-mutations.test.ts
```

Expected: module-not-found failure.

- [ ] **Step 4: Implement deterministic section and ID helpers**

```ts
function replaceRequiredSection(source: string, heading: string, content: string): string;
function appendRequiredSection(source: string, heading: string, entry: string): string;
function upsertRootLink(source: string, heading: string, target: string, rendered: string): string;
function nextNumericId(directory: string, prefix: 'obj' | 'pref' | 'bucket'): string;
function renderTrace(args: RenderTraceArgs): string;
function renderNewObject(args: RenderObjectArgs): string;
function renderNewBucket(args: RenderBucketArgs): string;
```

Section mutation preserves untouched sections byte-for-byte. Remove the initial “尚无已固化课堂记忆” empty-state line only when inserting the first current object. Resolve stable IDs through bounded canonical paths, reject symlink segments, and never search for semantic similarity.

- [ ] **Step 5: Implement `planLessonMemoryCommit` and verify GREEN**

Read source bytes, validate the active bound Lesson, apply `closingFact` first, invert object `traceEntries` into Trace object IDs, render all candidates in memory, and parse the Lesson candidate before returning. The planner performs no disk writes.

```bash
bun test tests/m1/memory-mutations.test.ts tests/m0/markdown-domain.test.ts
```

Expected: all tests pass.

- [ ] **Step 6: Commit**

```bash
git add apps/pi-teaching-web/src/study/memory-mutations.ts \
  apps/pi-teaching-web/tests/m1/memory-mutations.test.ts
git commit -m "feat: plan semantic lesson memory mutations"
```

---

### Task 4: Preference mutation and Plan deferred-route resolution

**Files:**
- Modify: `apps/pi-teaching-web/src/study/memory-mutations.ts`
- Modify: `apps/pi-teaching-web/tests/m1/memory-mutations.test.ts`

**Interfaces:**

```ts
export function planDeferredRouteResolution(
  root: string,
  objectId: string,
  buckets: BucketRef[],
): {
  candidates: DocumentCandidate[];
  bucketIds: Record<string, string>;
};
```

- [ ] **Step 1: Write RED for new and existing preference updates**

Assert a new preference creates Current Judgment, Scope, Explicit Statements, Evolution History, and Source; `upsert` adds one Active Preference Cue. A second mutation replaces current judgment/scope, appends the new statement/history, and keeps earlier statements byte-identical. A `remove` cue removes only the root projection.

- [ ] **Step 2: Write RED for resolving a real deferred object**

```ts
const planned = planDeferredRouteResolution(root, 'obj-001', [
  { kind: 'existing', id: 'algebraic-structure' },
  { kind: 'new', key: 'route-choice', title: '函数表示与目标选路' },
]);
expect(candidate(planned, 'memory/INDEX.md').after)
  .not.toContain('objects/obj-001.md) — 待归类');
expect(candidate(planned, 'memory/indexes/algebraic-structure.md').after)
  .toContain('../objects/obj-001.md');
expect(planned.bucketIds['route-choice']).toMatch(/^bucket-\d{3}$/);
```

Also reject a non-deferred object, empty bucket list, missing object, and symlink bucket with zero candidates.

- [ ] **Step 3: Run focused RED**

```bash
bun test tests/m1/memory-mutations.test.ts
```

Expected: preference assertions and missing resolver fail for the intended reasons.

- [ ] **Step 4: Implement minimal preference and resolver transformations**

Preference Source uses the current Lesson path plus textual Block ID, not a guessed heading slug. Route resolution accepts only an object listed under `Deferred Object Routing`, adds explicit bucket edges, ensures root bucket links, and removes that one deferred item.

- [ ] **Step 5: Run GREEN and commit**

```bash
bun test tests/m1/memory-mutations.test.ts
git add apps/pi-teaching-web/src/study/memory-mutations.ts \
  apps/pi-teaching-web/tests/m1/memory-mutations.test.ts
git commit -m "feat: resolve deferred teacher memory routes"
```

---

### Task 5: Session-bound memory tools and old-path removal

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/memory-tools.ts`
- Create: `apps/pi-teaching-web/tests/m1/memory-tools.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-memory-guard.ts`
- Modify: `apps/pi-teaching-web/tests/m0/lesson-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/plan-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1/lesson-memory-guard.test.ts`

**Interfaces:**

```ts
export function memoryEnabled(root: string): boolean;
export function createLessonMemoryTool(
  root: string,
  lessonPath: string,
): ReturnType<typeof defineTool> | null;
export function createPlanMemoryTools(root: string): Array<ReturnType<typeof defineTool>>;
export function modelToolsForNode(kind: NodeKind, hasMemory?: boolean): readonly string[];
```

- [ ] **Step 1: Write RED schema and inventory tests**

```ts
expect(createLessonTools(m1Root, lessonPath).map((tool) => tool.name)).toEqual([
  'classroom_log_append',
  'classroom_update',
  'lesson_memory_commit',
]);
expect(createLessonTools(m0Root, lessonPath).map((tool) => tool.name)).toEqual([
  'classroom_log_append',
  'classroom_update',
]);
expect(modelToolsForNode('lesson', true)).toEqual([
  'read', 'grep', 'find', 'ls',
  'classroom_log_append', 'classroom_update', 'lesson_memory_commit',
]);
expect(modelToolsForNode('lesson', false)).not.toContain('edit');
```

Use TypeBox `Check` to prove neither memory tool accepts root, path, Lesson ID, timestamp, stable output ID, or confirmation fields. `memory_route_resolve` accepts only object ID and explicit bucket refs.

- [ ] **Step 2: Write RED execution and idempotency tests**

Invoke `lesson_memory_commit`, assert `commitId`, key maps, exact changed paths, and non-negative `durationMs`. Invoke the same native tool-call ID twice and assert one Trace. Resolve a deferred route and assert only the declared edge changes.

- [ ] **Step 3: Replace guard allowances with RED rejection tests**

```ts
for (const path of [scope.nodePath, 'memory/INDEX.md', 'memory/objects/obj-001.md']) {
  expect(validateLessonMemoryWrite(root, scope, nativeWrite(path)))
    .toContain('lesson_memory_commit');
}
```

- [ ] **Step 4: Run focused RED**

```bash
bun test tests/m1/memory-tools.test.ts \
  tests/m1/lesson-memory-guard.test.ts \
  tests/m0/lesson-tools.test.ts \
  tests/m0/plan-tools.test.ts \
  tests/m0/native-session.test.ts \
  tests/m0/public-surface.test.ts
```

Expected: new modules/tool names are missing and old inventories fail.

- [ ] **Step 5: Implement adapters and idempotent receipts**

```ts
const planned = planLessonMemoryCommit(root, lessonPath, input, now().toISOString());
const committed = commitDocumentCandidates(root, planned.candidates);
const receipt = {
  ok: true,
  commitId: committed.commitId,
  traceIds: planned.traceIds,
  objectIds: planned.objectIds,
  preferenceIds: planned.preferenceIds,
  bucketIds: planned.bucketIds,
  changedPaths: committed.changedPaths,
  durationMs: performance.now() - started,
};
```

Cache only successful receipts by native tool-call ID in the tool closure. Use the same transaction adapter for `memory_route_resolve`.

- [ ] **Step 6: Remove Lesson native file tools and align conditional registration**

Pass `memoryEnabled(root)` into resource assembly and session factory inventory. Plan retains native `edit/write` and conditionally adds `memory_route_resolve`; Lesson never exposes native `edit/write`. Simplify the hidden guard to reject any future Lesson native write with one bounded message.

- [ ] **Step 7: Run focused GREEN, typecheck, and commit**

```bash
bun test tests/m1/memory-tools.test.ts \
  tests/m1/lesson-memory-guard.test.ts \
  tests/m0/lesson-tools.test.ts \
  tests/m0/plan-tools.test.ts \
  tests/m0/native-session.test.ts \
  tests/m0/public-surface.test.ts
bun run typecheck
git add apps/pi-teaching-web/src/runtime apps/pi-teaching-web/tests/m0 \
  apps/pi-teaching-web/tests/m1/memory-tools.test.ts \
  apps/pi-teaching-web/tests/m1/lesson-memory-guard.test.ts
git commit -m "feat: commit lesson memory through bound tools"
```

---

### Task 6: Runtime recovery hook and invalidation projection

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/server-api.test.ts`

**Interfaces:**
- Consumes: `recoverDocumentTransactions(root)` and successful Pi tool events.
- Produces: recovery before session resources load, and one course + knowledge invalidation pair per successful memory tool.

- [ ] **Step 1: Write RED for recovery and event projection**

Create an interrupted manifest fixture, invoke the session-factory setup boundary, and assert original bytes are restored before static resources read. Extend server event tests:

```ts
emit({ type: 'tool_execution_end', toolName: 'lesson_memory_commit', isError: false });
expect(events).toContainEqual({ type: 'course-invalidated' });
expect(events).toContainEqual({ type: 'knowledge-invalidated' });
```

Repeat for `memory_route_resolve`; failed events publish neither.

- [ ] **Step 2: Run RED**

```bash
bun test tests/m0/native-session.test.ts tests/m0/server-api.test.ts
```

Expected: recovery and dual-invalidation assertions fail.

- [ ] **Step 3: Implement one recovery call and one event branch**

Call recovery once when constructing the Pi session factory, before role resources are read. In `app.ts`, group the two memory tool names and publish exactly one of each invalidation after a successful result.

- [ ] **Step 4: Run GREEN and commit**

```bash
bun test tests/m0/native-session.test.ts tests/m0/server-api.test.ts
git add apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/tests/m0/native-session.test.ts \
  apps/pi-teaching-web/tests/m0/server-api.test.ts
git commit -m "feat: recover and project memory commits"
```

---

### Task 7: Skill, Agent, and contract cutover

**Files:**
- Modify: `apps/pi-teaching-web/resources/contracts/m1-memory-contract.md`
- Modify: `apps/pi-teaching-web/resources/agents/lesson-node.md`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-dialogue/references/post-lesson-review.md`
- Modify: `apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts`

**Interfaces:**
- Consumes: exact tools implemented in Task 5.
- Produces: one Tutor commit recipe and one observable Plan deferred-route trigger.

- [ ] **Step 1: Freeze the observed RED baseline**

Add test comments identifying the already-observed no-guidance control: five M1a closes used 9–14 tools, all five first attempted an absolute native edit, and one inserted/started/logged/advanced a temporary Reflection Block. This real-model baseline substitutes for a new delegated pressure run.

- [ ] **Step 2: Change Skill tests first**

```ts
expectInOrder(consolidation, [
  '读取本次判断需要的记忆',
  '形成一次语义提交',
  'lesson_memory_commit',
  '不回读',
  '自然总结',
]);
expect(consolidation).toContain('keep');
expect(consolidation).toContain('assign');
expect(consolidation).toContain('defer');
expect(consolidation).toContain('没有类别配额');
expect(consolidation).not.toContain('用原生 `edit`');
expect(role).toContain('Lesson Session 不使用通用 `edit/write`');
expect(review).toContain('Deferred Object Routing');
expect(review).toContain('memory_route_resolve');
```

- [ ] **Step 3: Run Skill RED**

```bash
bun test tests/m1/memory-skill-tree.test.ts
```

Expected: failures name old native-edit permission and missing commit/deferred text.

- [ ] **Step 4: Rewrite only changed behavior**

Tutor recipe:

```text
读当前 Lesson / INDEX / 必要 L1
→ 形成 Trace、对象、偏好和路由的一次语义提交
→ 既有对象通常 keep；新对象明确 assign 或 defer
→ 调用 lesson_memory_commit 一次
→ 相信回执，不回读
→ 给学生自然总结
```

Keep the existing reflection order, five semantic boundaries, “尚未证明”, ability-signal limit, and correction semantics. Remove handwritten paths, IDs, Markdown templates, exact-end repair, and per-file retry prose. Plan reads `Deferred Object Routing`; it calls `memory_route_resolve` only after Coach can state the bucket judgment. Uncertainty leaves the item unchanged.

- [ ] **Step 5: Run Skill GREEN and commit**

```bash
bun test tests/m1/memory-skill-tree.test.ts tests/m0/native-session.test.ts
git add apps/pi-teaching-web/resources/contracts/m1-memory-contract.md \
  apps/pi-teaching-web/resources/agents/lesson-node.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md \
  apps/pi-teaching-web/resources/skills/plan-dialogue/references/post-lesson-review.md \
  apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts
git commit -m "docs: route lesson memory through atomic commits"
```

---

### Task 8: Full verification, real-model smoke, and audit correction

**Files:**
- Create: `docs/audits/2026-08-07-atomic-lesson-memory-consolidation-smoke.md`
- Modify: `docs/audits/2026-08-07-m1a-memory-validation.md`

**Interfaces:**
- Consumes: completed implementation and retained M1a evidence under `/private/tmp/studyforge-m1a-validation-fUXEZ5` when present.
- Produces: fresh automated gates, one real-model close result, and corrected temporal interpretation.

- [ ] **Step 1: Run all automated gates**

```bash
cd apps/pi-teaching-web
bun run typecheck
bun test --path-ignore-patterns='tests/e2e/**'
bun run build
```

Expected: exit 0 for all commands and zero failed tests.

- [ ] **Step 2: Run a disposable real-model Lesson close smoke**

Use an isolated M1 learning-set copy and the existing local HTTP/session harness. The student speaks naturally, confirms ending, and supplies one meaningful reflection. Exercise an existing object with `keep`; if a new object is genuinely ambiguous, accept `defer` instead of steering the model.

Capture exact product commit/model identity, first-visible and final wall time, model/tool counts, whether exactly one `lesson_memory_commit` occurred, absence of native memory edits and post-success rereads, persisted semantics/paths, and Runtime `durationMs`. Do not script “隔课”“延时” or ask for a specific memory category.

- [ ] **Step 3: Correct the prior temporal verdict using retained evidence**

Amend only affected paragraphs/tables in `2026-08-07-m1a-memory-validation.md`: the harness immediately started the next Lesson after the simulated student said “next time”; the student had questioned whether freshness explained success; the Coach proposed a real wait, but the validator did not provide one. Therefore the temporal failure was protocol contamination, not an M1a memory-semantic failure. Retain the narrower requirement that record time should be mechanical and unsupported intervals must not be invented. Preserve unrelated measurements.

- [ ] **Step 4: Write the smoke report with observed values only**

```md
## Baseline
## Automated Gates
## Real-Model Close
## Semantic Comparison
## Performance Comparison
## Remaining Boundaries
```

State PASS only when semantic bearing gates pass and the new path uses one memory commit without fallback native edits. Otherwise record the exact failure.

- [ ] **Step 5: Verify repository state and commit evidence**

```bash
git diff --check
git status --short
git add docs/audits/2026-08-07-atomic-lesson-memory-consolidation-smoke.md \
  docs/audits/2026-08-07-m1a-memory-validation.md
git commit -m "docs: validate atomic lesson memory consolidation"
```

---

## Completion Gate

- [ ] Re-run `bun run typecheck`, full non-E2E tests, and `bun run build` after the final commit.
- [ ] Run `git diff --check` and verify the worktree is clean.
- [ ] Verify every new runtime function has a test observed RED before implementation.
- [ ] Verify one Trace linked to two objects is stored once, corrections are append-only, and deferred routing has a Plan exit.
- [ ] Verify Lesson has no native `edit/write`, M0 has no memory tool, and Plan cannot write Lesson traces.
- [ ] Verify the real-model smoke preserved semantic quality and reduced write-tool fanout.
- [ ] Use `superpowers:finishing-a-development-branch` for final handoff; do not merge without the user's explicit choice.
