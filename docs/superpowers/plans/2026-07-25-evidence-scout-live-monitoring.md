# Evidence Scout Live Monitoring Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Raise Quick Evidence Scout's fixed timeout to 180 seconds and surface safe live progress in the existing Task Rail.

**Architecture:** Keep `pi-subagents` as the progress source. `DeepWorkflowRuntime` records only safe counters and the current tool name, `projectWorkflow` converts that tool name to a student-facing activity label, and `TaskRail` renders the projected metrics. Final findings remain atomic and private until the child completes.

**Tech Stack:** TypeScript, Bun test, React server rendering, Pi delegation events, WebSocket workflow projection.

## Global Constraints

- Quick Evidence Scout timeout is exactly `180000ms`.
- Keep the existing 50,000 Token recommendation, one-Scout workflow, read-only child, and cancel action.
- Never project `recentOutput`, `recentOutputLines`, `currentToolArgs`, child reasoning, or partial findings.
- Do not add configuration, retry logic, a new workflow type, or teaching-data schema fields.
- Skill prose receives no dedicated prose test; runtime and UI behavior remain tested.

---

### Task 1: Raise the Quick Workflow timeout contract

**Files:**
- Modify: `apps/pi-teaching-web/tests/workflows/validate.test.ts`
- Modify: `apps/pi-teaching-web/tests/workflows/tool.test.ts`
- Modify: `apps/pi-teaching-web/src/workflows/validate.ts`
- Modify: `apps/pi-teaching-web/src/workflows/tool.ts`
- Modify: `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`

**Interfaces:**
- Consumes: `validateWorkflowGraph(graph: WorkflowGraph): WorkflowGraph`
- Produces: Quick workflows accept `timeoutMs <= 180_000`; the tool schema and Skill instruct the model to use `180000`.

- [ ] **Step 1: Write the failing timeout tests**

Change the Quick fixture to `timeoutMs: 180_000`, assert it is accepted, assert `180_001` throws `QUICK_TIMEOUT_LIMIT`, and require the tool description to contain `180,000`.

- [ ] **Step 2: Run the focused tests and verify RED**

Run:

```bash
bun test tests/workflows/validate.test.ts tests/workflows/tool.test.ts
```

Expected: failure because Quick still rejects values above 45,000 and the schema still describes 45,000.

- [ ] **Step 3: Implement the 180-second contract**

Use:

```ts
if (graph.timeoutMs > 180_000) throw new Error('QUICK_TIMEOUT_LIMIT');
```

Update the tool description to “Quick mode must use at most 180,000 ms” and the Skill invocation to `timeoutMs: 180000`.

- [ ] **Step 4: Run the focused tests and verify GREEN**

Run:

```bash
bun test tests/workflows/validate.test.ts tests/workflows/tool.test.ts
```

Expected: all focused tests pass.

### Task 2: Project and render safe live telemetry

**Files:**
- Modify: `apps/pi-teaching-web/tests/workflows/runtime.test.ts`
- Modify: `apps/pi-teaching-web/tests/projection/workflow-projector.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/task-rail.test.tsx`
- Modify: `apps/pi-teaching-web/src/workflows/contracts.ts`
- Modify: `apps/pi-teaching-web/src/workflows/runtime.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/projection/workflow-projector.ts`
- Modify: `apps/pi-teaching-web/src/client/components/TaskRail.tsx`

**Interfaces:**
- Consumes: `SubagentDelegationUpdate` fields `durationMs`, `tokens`, `toolCount`, and `currentTool`.
- Produces: `WorkflowTaskState.toolCount: number`, `WorkflowTaskState.currentTool: string | null`, and projected `WorkflowTaskView.durationMs`, `tokens`, `toolCount`, `currentActivity`.

- [ ] **Step 1: Write failing runtime and projection tests**

Add a runtime delegate that emits:

```ts
onUpdate({
  requestId: input.requestId,
  durationMs: 42_000,
  tokens: 3_777,
  toolCount: 4,
  currentTool: 'card_search',
  currentToolArgs: '{"query":"hidden"}',
  recentOutput: 'private partial answer',
});
```

Subscribe to workflow snapshots and assert the running snapshot contains only the safe counters and `currentTool`. Update the projector fixture to assert:

```ts
{
  durationMs: 42_000,
  tokens: 3_777,
  toolCount: 4,
  currentActivity: '正在检索题卡',
}
```

Also assert serialized projection does not contain the tool arguments or partial answer.

- [ ] **Step 2: Write the failing Task Rail test**

Render a running Quick workflow with 180-second and 50,000-Token budgets. Assert the HTML contains:

```text
正在检索题卡
42 / 180 秒
3,777 / 50,000 Token
4 次工具
来源完成后汇总
```

Assert it does not contain `0 个来源`, `currentToolArgs`, or partial output.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
bun test tests/workflows/runtime.test.ts tests/projection/workflow-projector.test.ts tests/client/task-rail.test.tsx
```

Expected: type or assertion failures because the live fields are not yet stored, projected, or rendered.

- [ ] **Step 4: Implement runtime telemetry**

Initialize new task state with:

```ts
toolCount: 0,
currentTool: null,
```

On each delegation update:

```ts
task.tokens = update.tokens ?? task.tokens;
task.durationMs = update.durationMs ?? task.durationMs;
task.toolCount = update.toolCount ?? task.toolCount;
task.currentTool = update.currentTool ?? task.currentTool;
this.commit(snapshot, false);
```

On terminal response, take final `toolCount` when present and set `currentTool = null`.

- [ ] **Step 5: Implement safe projection**

Map only known tool names:

```ts
const activity = {
  read: '正在读取来源',
  card_search: '正在检索题卡',
  trace_search: '正在检索 Trace',
  find: '正在定位来源',
  grep: '正在定位来源',
} as const;
```

Unknown or absent tools use `正在分析`. Do not add fields for raw output or tool arguments.

- [ ] **Step 6: Render the existing Task Rail metrics**

For running tasks, render elapsed/budget time, task/workflow Tokens, tool count, and “来源完成后汇总”. Show card/source counts only for completed tasks. Preserve proposed, cancellation, and confirmation controls.

- [ ] **Step 7: Run focused tests and verify GREEN**

Run:

```bash
bun test tests/workflows/runtime.test.ts tests/projection/workflow-projector.test.ts tests/client/task-rail.test.tsx
```

Expected: all focused tests pass.

### Task 3: Verify, merge, reinstall, and run real-model acceptance

**Files:**
- Verify: `plugins/highschool-study`
- Verify: `apps/pi-teaching-web`
- Runtime copy: a new `/tmp/studyforge-scout-monitor-*` directory.

**Interfaces:**
- Consumes: committed plugin package and Pi credentials already configured on the machine.
- Produces: a running isolated acceptance URL and an audited Coach Session.

- [ ] **Step 1: Run full verification**

Run:

```bash
cd plugins/highschool-study && bun install --frozen-lockfile && bun run release:check
cd apps/pi-teaching-web && bun install --frozen-lockfile && bun run check
```

Expected: plugin release checks, all app tests, typecheck, and production build pass.

- [ ] **Step 2: Commit implementation**

Stage only the files listed in Tasks 1 and 2 and commit:

```bash
git commit -m "feat: monitor evidence scout progress"
```

- [ ] **Step 3: Fast-forward local main without touching the user's dirty worktree**

Use a temporary clean main worktree and:

```bash
git merge --ff-only codex/lesson-close-reflection-decoupling
```

Expected: local `main` points at the implementation commit and the user's `feat/learning-workflows` worktree remains unchanged.

- [ ] **Step 4: Reinstall and launch an isolated learning set**

Install the merged app package, copy `examples/derivative-demo/learning-set`, and launch on an unused localhost port.

- [ ] **Step 5: Run the same real Evidence Scout scenario**

Enable deep mode and ask one Evidence Scout to check the three known candidate cards against Test 3. Observe that:

- the task runs beyond 45 seconds without cancellation;
- elapsed time, Token count, tool count, and activity update in the Task Rail;
- running state says “来源完成后汇总” rather than “0 个来源”;
- final compact findings return to Coach within 180 seconds;
- no child partial output or tool arguments appear in the student UI or projected workflow event.

- [ ] **Step 6: Audit facts and report**

Verify the raw Pi Session owner/model, workflow terminal state, child result, parent-only writes, Plan reread, route refresh, and user worktree preservation. Retain the isolated runtime until the user reviews the result.
