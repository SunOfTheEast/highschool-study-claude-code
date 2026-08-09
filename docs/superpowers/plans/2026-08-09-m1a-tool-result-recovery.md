# M1a Tool Result Recovery Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lesson/free-learning memory commits recover exactly once across a process interruption, remove the `closingFact` evidence shortcut, and make Lesson close/reconnect mechanically retryable without adding model-facing state.

**Architecture:** Canonical teaching facts remain in Lesson Logs, native Pi Sessions, and `memory/`. A short-lived Runtime record, keyed by the already-persisted Pi `toolCallId`, is committed atomically beside memory candidates and removed after the matching Pi tool result is visible. Lesson close and browser reconnect remain independent read/lifecycle operations.

**Tech Stack:** TypeScript 7, Bun 1.3, TypeBox, Pi `SessionManager`, React 19, Markdown teaching resources.

## Global Constraints

- Do not add `sourceTurnId`, evidence revisions, cross-tool-call semantic deduplication, or new Lesson lifecycle states.
- Do not expose recovery paths, revisions, receipts, Session IDs, or retry flags to the model.
- Do not make memory submission a prerequisite for closing a Lesson.
- Runtime binds identity, paths, time, commit IDs, and atomicity; the model supplies only teaching judgments.
- Old Classroom Log and Learning History entries remain append-only.
- Keep tests focused on the new hard invariants; do not duplicate existing transaction coverage.

---

### Task 1: Give课末新证据 one canonical path

**Files:**
- Modify: `apps/pi-teaching-web/tests/m1/memory-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/lesson-mutations.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/memory-tools.ts`
- Modify: `apps/pi-teaching-web/src/study/memory-mutations.ts`
- Modify: `apps/pi-teaching-web/src/study/lesson-mutations.ts`
- Modify: `apps/pi-teaching-web/resources/contracts/m1-memory-contract.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md`

**Interfaces:**
- Consumes: existing `classroom_update`, `classroom_log_append`, and Block evidence IDs.
- Produces: `LessonMemoryCommitDraft` with only `objects` and `preferences`; `lesson_memory_commit` no longer writes Lesson evidence.

- [ ] **Step 1: Write failing schema and Skill tests**

Add to the existing memory tool schema test:

```ts
expect(Check(lesson.parameters, {
  ...commitInput(),
  closingFact: { blockId: 'block-001', note: '不再允许的旁路事实。' },
})).toBeFalse();
```

Add to the consolidation resource test:

```ts
expect(consolidation).toContain('课末交流真的产生了新的决定性表现');
expect(consolidation).toContain('classroom_update');
expect(consolidation).toContain('classroom_log_append');
expect(consolidation).toContain('Reflection Block');
expect(consolidation).not.toContain('closingFact');
```

- [ ] **Step 2: Run RED tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/memory-tools.test.ts tests/m1/memory-skill-tree.test.ts
```

Expected: FAIL because `closingFact` is still accepted and the Skill still instructs the shortcut.

- [ ] **Step 3: Remove the shortcut from code and resources**

Make the durable draft exactly:

```ts
export type LessonMemoryCommitDraft = {
  objects: ObjectMutation[];
  preferences: PreferenceMutation[];
};
```

Remove `closingFact` from the TypeBox schema. In `planLessonMemoryCommit`, read and parse the Lesson without mutating it:

```ts
const lessonBefore = readRequired(root, lessonPath);
const lesson = parseLessonSource(lessonPath, lessonBefore);
```

Delete `appendClosingClassroomLogSource` and its three dedicated tests. Retain the existing active-Block-only `appendClassroomLogSource` tests.

Rewrite the reference boundary as:

```text
课末交流没有产生新的决定性表现：只引用已经存在的真实 Block。
课末交流真的产生了新的决定性表现：先用 classroom_update 插入并开始一个短 Reflection Block，
再用 classroom_log_append 记录事实，正常完成该 Block 后才让对象记忆引用它。
```

- [ ] **Step 4: Run GREEN tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/lesson-mutations.test.ts tests/m1/memory-mutations.test.ts tests/m1/memory-tools.test.ts tests/m1/memory-skill-tree.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/src/study/lesson-mutations.ts \
  apps/pi-teaching-web/src/study/memory-mutations.ts \
  apps/pi-teaching-web/src/runtime/memory-tools.ts \
  apps/pi-teaching-web/resources/contracts/m1-memory-contract.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md \
  apps/pi-teaching-web/tests/m0/lesson-mutations.test.ts \
  apps/pi-teaching-web/tests/m1/memory-tools.test.ts \
  apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts
git commit -m "fix: keep closing evidence in lesson blocks"
```

### Task 2: Let one transaction use a preallocated commit ID

**Files:**
- Modify: `apps/pi-teaching-web/tests/m1/multi-document-transaction.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/multi-document-transaction.ts`

**Interfaces:**
- Consumes: current `TransactionTestHooks` third argument.
- Produces: `TransactionOptions extends TransactionTestHooks` with optional `commitId`; existing callers remain source-compatible.

- [ ] **Step 1: Write the failing transaction test**

```ts
test('uses one runtime-preallocated commit id', () => {
  const root = createRoot();
  const commitId = '123e4567-e89b-42d3-a456-426614174000';

  expect(commitDocumentCandidates(root, candidates(root), { commitId }).commitId)
    .toBe(commitId);
  expect(transactionDirectories(root)).toEqual([]);
});
```

Also assert an invalid path-capable value is rejected before candidates change:

```ts
expect(() => commitDocumentCandidates(root, candidates(root), {
  commitId: '../escape',
})).toThrow('COMMIT_ID_INVALID');
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/multi-document-transaction.test.ts
```

Expected: FAIL because `TransactionTestHooks` has no `commitId` and the function always calls `randomUUID()`.

- [ ] **Step 3: Implement the minimal option**

```ts
export type TransactionOptions = TransactionTestHooks & {
  commitId?: string;
};

function checkedCommitId(value: string | undefined): string {
  const id = value ?? randomUUID();
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) {
    throw new Error('COMMIT_ID_INVALID');
  }
  return id;
}
```

Resolve the ID before creating `.studyforge/transactions/<commitId>` and keep `afterReplace` / `leavePreparedOnError` unchanged.

- [ ] **Step 4: Run GREEN tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/multi-document-transaction.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/src/runtime/multi-document-transaction.ts \
  apps/pi-teaching-web/tests/m1/multi-document-transaction.test.ts
git commit -m "feat: preallocate atomic document commit ids"
```

### Task 3: Recover memory tool results by native toolCallId

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/pending-tool-results.ts`
- Create: `apps/pi-teaching-web/tests/m1/pending-tool-results.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/memory-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/tests/m1/memory-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m1b/free-learning-memory.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Consumes: `SessionManager.getSessionId()`, `getBranch()`, `appendMessage()`, memory planners, and preallocated transaction IDs.
- Produces:

```ts
export type RecoverableToolSession = Pick<SessionManager, 'getSessionId' | 'getBranch'>;

export function stableToolInputDigest(input: unknown): string;
export function pendingToolResultCandidate(
  root: string,
  sessionId: string,
  toolName: MemoryToolName,
  toolCallId: string,
  requestDigest: string,
  commitId: string,
  result: StableMemoryToolResult,
): DocumentCandidate;
export function readPendingToolResult(
  root: string,
  sessionId: string,
  toolCallId: string,
): PendingToolResult | null;
export function reconcilePendingMemoryToolResults(
  root: string,
  manager: Pick<SessionManager, 'getSessionId' | 'getBranch' | 'appendMessage'>,
): void;
export function clearPersistedPendingResult(
  root: string,
  sessionId: string,
  toolCallId: string,
): void;
```

- [ ] **Step 1: Write focused failing recovery tests**

Use a real persisted `SessionManager` with one assistant message containing a memory tool call. Cover only these invariants:

```ts
test('restores one committed orphan tool result after reopening the Pi session', async () => {
  // Execute the bound tool directly, deliberately do not append its returned result,
  // reopen SessionManager, reconcile, and assert one non-error toolResult plus one
  // Learning History entry and no pending file.
});

test('cleans a pending record when the Pi result already exists', async () => {
  // Execute, append the returned ToolResultMessage, reconcile, then assert one result
  // and no pending file.
});

test('rejects different arguments for the same persisted tool call', async () => {
  // Seed assistant arguments A, execute the same toolCallId with B, assert no memory files changed.
});
```

Update Lesson and free-learning schema tests to construct a session whose branch contains the matching assistant tool call. Assert `durationMs` is absent from the stable result.

- [ ] **Step 2: Run recovery tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/pending-tool-results.test.ts tests/m1/memory-tools.test.ts tests/m1b/free-learning-memory.test.ts
```

Expected: FAIL because the pending-result module and session-bound execution do not exist.

- [ ] **Step 3: Implement deterministic paths and request digests**

Use SHA-256 for both safe path segments and a versioned, recursively key-sorted JSON representation for request parameters:

```ts
function safeKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function pendingPath(sessionId: string, toolCallId: string): string {
  return `.studyforge/pending-tool-results/${safeKey(sessionId)}/${safeKey(toolCallId)}.json`;
}
```

Arrays retain order; plain-object keys sort lexicographically. Do not normalize teaching text.

- [ ] **Step 4: Bind memory execution to the persisted Pi call**

Change the factories to receive `RecoverableToolSession`:

```ts
createLessonMemoryTool(root, lessonPath, session)
createFreeLearningMemoryTool(root, session)
```

Before planning a mutation:

1. find the exact assistant tool call in `session.getBranch()`;
2. compare the digest of its persisted `arguments` with the execution input;
3. return an already persisted matching tool result, if present;
4. otherwise return a matching pending result, if present;
5. otherwise preallocate `commitId`, plan canonical files, add one pending candidate, and commit once.

Build the stable result before committing and omit `durationMs`:

```ts
const stable = {
  ok: true,
  commitId,
  objectIds: planned.objectIds,
  preferenceIds: planned.preferenceIds,
  bucketIds: planned.bucketIds,
  changedPaths: planned.candidates.map((candidate) => candidate.path),
};
```

- [ ] **Step 5: Reconcile before creating the AgentSession**

For an existing Pi session, call `reconcilePendingMemoryToolResults(root, manager)` before `createAgentSession`:

- pending record matches orphan call: append the stored success tool result;
- no pending record: append `INTERRUPTED_BEFORE_COMMIT` as an error tool result;
- existing success result plus pending record: remove only the exact pending file;
- mismatch: leave the pending file and append no success.

Subscribe to `turn_end`, after Pi has persisted the preceding tool-result `message_end`. Re-read
`manager.getBranch()` and clean only after the matching result is present. Dispose this listener with the
session. (`AgentSession` notifies user listeners before persisting `message_end`, so that event is too early.)

- [ ] **Step 6: Run GREEN and integration tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/pending-tool-results.test.ts \
  tests/m1/memory-tools.test.ts \
  tests/m1b/free-learning-memory.test.ts \
  tests/m0/native-session.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/pi-teaching-web/src/runtime/pending-tool-results.ts \
  apps/pi-teaching-web/src/runtime/memory-tools.ts \
  apps/pi-teaching-web/src/runtime/lesson-tools.ts \
  apps/pi-teaching-web/src/runtime/free-learning-tools.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/tests/m1/pending-tool-results.test.ts \
  apps/pi-teaching-web/tests/m1/memory-tools.test.ts \
  apps/pi-teaching-web/tests/m1b/free-learning-memory.test.ts \
  apps/pi-teaching-web/tests/m0/native-session.test.ts
git commit -m "feat: recover committed memory tool results"
```

### Task 4: Make close and reconnect retryable

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/node-lifecycle.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/node-lifecycle.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Create: `apps/pi-teaching-web/src/client/reconnect-gate.ts`
- Create: `apps/pi-teaching-web/tests/m0/reconnect-gate.test.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`

**Interfaces:**
- Consumes: existing `abort`, `release`, `loadRoute`, and `conversation-snapshot` replacement.
- Produces: idempotent `closeLesson`; `WorkspaceRegistry.abort` resolves only after its queued turn settles; reconnect gate returns `true` only after the first socket open.

- [ ] **Step 1: Write failing close and reconnect tests**

Add lifecycle coverage:

```ts
expect(await lifecycle.closeLesson('plan-001', 'lesson-001')).toEqual({
  route: '/course/plan/plan-001',
});
expect(await lifecycle.closeLesson('plan-001', 'lesson-001')).toEqual({
  route: '/course/plan/plan-001',
});
expect(readLesson(root, lessonPath).status).toBe('closed');
```

Add a Registry test with a pending `prompt()` promise and assert `abort()` does not resolve until that prompt settles.

Add the gate test:

```ts
const gate = createReconnectGate();
expect(gate.opened()).toBeFalse();
expect(gate.opened()).toBeTrue();
expect(gate.opened()).toBeTrue();
```

- [ ] **Step 2: Run tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/node-lifecycle.test.ts tests/m0/native-session.test.ts tests/m0/reconnect-gate.test.ts
```

Expected: double close fails on `expected status active`, Registry abort resolves too early, and reconnect gate is missing.

- [ ] **Step 3: Implement minimal lifecycle behavior**

In `closeLesson`, re-read the linked Lesson status before transitioning:

```ts
if (document.status === 'closed') {
  await this.sessions.release(sessionKey);
  return { route };
}
if (document.status !== 'active') {
  throw new StudyDocumentError(node.path, `Lesson cannot close from ${document.status}`);
}
await this.sessions.abort(sessionKey);
transitionNode(this.root, node.path, 'active', 'closed');
await this.sessions.release(sessionKey);
return { route };
```

In `WorkspaceRegistry.abort`, abort streaming generation and then await the captured `turnTails` promise, swallowing only the already-reported turn failure:

```ts
const tail = this.turnTails.get(key);
if (session?.isStreaming) await session.abort();
await tail?.catch(() => {});
```

- [ ] **Step 4: Reload only after a real reconnect**

Implement the gate as two lines of state, instantiate it once per socket effect, and on subsequent `onopen` calls reload the currently visible route:

```ts
socket.onopen = () => {
  setConnection('open');
  if (!gate.opened()) return;
  const current = parseBrowserRoute(window.location.pathname) ?? { kind: 'home' as const };
  void loadRoute(current);
};
```

`loadRoute` already fetches the node snapshot and Pi history and dispatches `conversation-snapshot`, so do not add another frontend state channel.

- [ ] **Step 5: Run GREEN tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/node-lifecycle.test.ts tests/m0/native-session.test.ts tests/m0/reconnect-gate.test.ts
```

Expected: all selected tests PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/pi-teaching-web/src/runtime/node-lifecycle.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/src/client/reconnect-gate.ts \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/tests/m0/node-lifecycle.test.ts \
  apps/pi-teaching-web/tests/m0/native-session.test.ts \
  apps/pi-teaching-web/tests/m0/reconnect-gate.test.ts
git commit -m "fix: make teaching session close recoverable"
```

### Task 5: Verify the release slice

**Files:**
- Modify only if validation exposes a defect in files already listed above.
- Record: `docs/superpowers/reports/2026-08-09-m1a-recovery-validation.md`

**Interfaces:**
- Consumes: completed Tasks 1–4.
- Produces: deterministic verification evidence and a short real-model behavior report.

- [ ] **Step 1: Run stale-surface scans**

Run:

```bash
rg -n "closingFact|appendClosingClassroomLogSource|sourceTurnId|evidenceRevision|memory-receipts" \
  apps/pi-teaching-web/src apps/pi-teaching-web/resources
```

Expected: no active Runtime or resource matches.

- [ ] **Step 2: Run the complete project check**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: typecheck, all non-E2E tests, and Vite build PASS.

- [ ] **Step 3: Run two real-model closing scenarios**

Create two isolated fixtures and start one server at a time:

```bash
cd apps/pi-teaching-web
validation_root="$(mktemp -d /tmp/studyforge-m1a-recovery-XXXXXX)"
cp -R tests/fixtures/m0-learning-set "$validation_root/no-new-evidence"
cp -R tests/fixtures/m0-learning-set "$validation_root/new-closing-evidence"
bun run src/server/index.ts --learning-set "$validation_root/no-new-evidence" --port 65201
```

In a second terminal, call `sendObservedTurn` from
`scripts/m1a-validation/turn-client.ts` against `lesson:plan-001:lesson-001` with these exact student turns:

```text
这道题我不继续展开了，我想结束本课。请按正常流程收尾。
没什么新的补充，刚才聊到的就是我的实际情况。
```

Stop the first server, then start the second fixture on port 65202 and send:

```text
我想结束本课，先做一下正常收尾。
我刚才才意识到：约掉 x-1 以前必须先保留 x≠1；如果题目问原式定义域，不能把化简后的 x+1 当成处处成立。这会改变你对我边界检查的判断。
```

1. a Lesson whose final exchange adds no new decisive evidence—Tutor must not create a decorative Reflection;
2. a Lesson whose final student explanation changes the object boundary—Tutor must create/log a short Reflection before memory submission.

For each scenario inspect the final Lesson and object file, not only the transcript. Require every claimed closing behavior to appear in the cited Block Log.

- [ ] **Step 4: Write the validation report**

Record commands, model/provider, exact fixture path, deterministic results, the two first-hit outcomes, and any remaining blocker. Do not claim the old Trace-based M1a A/B protocol was rerun; that protocol remains a separate audit item.

- [ ] **Step 5: Commit the report**

```bash
git add docs/superpowers/reports/2026-08-09-m1a-recovery-validation.md
git commit -m "docs: validate m1a recovery boundary"
```
