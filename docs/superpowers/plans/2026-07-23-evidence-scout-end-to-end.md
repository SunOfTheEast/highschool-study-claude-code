# Evidence Scout End-to-End Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and implement this plan sequentially. Do not dispatch subagents for this runtime wiring task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Status:** Implemented and vertically accepted on 2026-07-23.

**Goal:** Finish the approved isolated evidence-recall design so a Pi Coach or Tutor can run one Plan-scale Evidence Scout without parent prefetch, receive a compact source-linked result, and show the recalled-card count in the existing workflow rail.

**Architecture:** Keep the existing `deep_workflow_propose` tool, Quick Workflow runtime, `study-scout` child Agent and Session JSONL store. Align the executable tool contract with the approved design, require `card_index` only for the exact `Evidence Scout` role, and return Quick results through the current tool result while confirmed Deep results continue through the hidden synthesis message. Do not add another public MCP tool, top-level Agent, learning-set field or persistence layer.

**Tech Stack:** TypeScript 7, Bun 1.3.14, Pi coding agent 0.81, `pi-subagents` 0.35.1, React 19, Bun tests, Playwright, real configured Pi model.

## Global Constraints

- Base the work on local `main@e89567d`.
- Preserve exactly four public Claude-plugin MCP tools.
- Keep deep mode opt-in and Session-scoped.
- One Quick `Evidence Scout` is valid for context isolation; multiple tasks still require genuinely independent questions.
- Parent Coach/Tutor remains the only learning-state writer.
- Evidence Scout keeps only `read`, `grep`, `find`, `ls`, `card_search`, `trace_search` and `source_resolve`.
- Parent search is valid for one known card or a small current-Lesson question, but it must not prefetch the same Plan-scale payload before delegation.
- Do not add automatic retry, pagination, a database, a rule engine or compatibility code.
- Do not add tests for Skill or Agent prose. Tool schemas, runtime prompts, parsed contracts, safe projections and UI behavior are executable surfaces and may be tested.
- Run real-model smoke only on a copied derivative learning set.

---

## File Map

### Modified

- `apps/pi-teaching-web/src/workflows/runtime.ts`
  - identifies an `Evidence Scout` task, builds its child prompt and requires a compact card index.
- `apps/pi-teaching-web/src/workflows/tool.ts`
  - exposes the approved single-Scout Quick path through the existing executable tool schema.
- `apps/pi-teaching-web/src/workflows/validate.ts`
  - keeps the Quick timeout and task-shape limits without the obsolete 12,000-Token cap.
- `apps/pi-teaching-web/src/workflows/delegation-client.ts`
  - delegates a fresh child Session without the obsolete four-turn cap.
- `apps/pi-teaching-web/src/runtime/session-factory.ts`
  - makes the workflow tool available for deep-mode activation and binds the Pi extension context.
- `apps/pi-teaching-web/src/runtime/subagent-path.ts`
  - materializes the packaged child definition with an absolute child-only extension path.
- `apps/pi-teaching-web/src/runtime/study-tools.ts`
  - provides metadata-only card payloads to the child extension while retaining full parent tool behavior.
- `apps/pi-teaching-web/resources/subagents/study-scout.md`
  - states that evidence retrieval returns `card_index`, including an empty array when no real card qualifies.
- `apps/pi-teaching-web/resources/subagents/tools/study-readonly-tools.ts`
  - registers the compact child-only read tools.
- `apps/pi-teaching-web/resources/agents/coach.md`
- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`
  - route an explicit or Plan-scale Evidence Scout before parent-side broad prefetch.
- `apps/pi-teaching-web/src/shared/contracts.ts`
  - adds safe recalled-card count to the browser task DTO.
- `apps/pi-teaching-web/src/projection/workflow-projector.ts`
  - derives recalled-card and evidence-source counts without exposing findings.
- `apps/pi-teaching-web/src/client/components/TaskRail.tsx`
  - displays recalled-card count for Evidence Scout tasks.
- `apps/pi-teaching-web/README.md`
  - documents one-Scout context isolation and the real smoke.
- `docs/superpowers/specs/2026-07-23-subagent-evidence-recall-design.md`
  - records implemented delivery semantics: Quick returns inline; confirmed Deep resumes through a hidden message.

### Tests

- `apps/pi-teaching-web/tests/workflows/runtime.test.ts`
- `apps/pi-teaching-web/tests/workflows/tool.test.ts`
- `apps/pi-teaching-web/tests/workflows/validate.test.ts`
- `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- `apps/pi-teaching-web/tests/runtime/subagent-path.test.ts`
- `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- `apps/pi-teaching-web/tests/projection/workflow-projector.test.ts`
- `apps/pi-teaching-web/tests/client/task-rail.test.tsx`

---

### Task 1: Make single-Scout recall an executable workflow contract

**Files:**

- Modify: `apps/pi-teaching-web/tests/workflows/runtime.test.ts`
- Modify: `apps/pi-teaching-web/tests/workflows/tool.test.ts`
- Modify: `apps/pi-teaching-web/src/workflows/runtime.ts`
- Modify: `apps/pi-teaching-web/src/workflows/tool.ts`
- Modify: `apps/pi-teaching-web/resources/subagents/study-scout.md`

**Interfaces:**

- Consumes: existing `WorkflowTask.role`, `instruction`, `sourceHandles` and `readRoots`.
- Produces:

```ts
export function parseTaskResult(
  output: string | undefined,
  options?: { requireCardIndex?: boolean },
): WorkflowTaskResult;
```

- The exact role name `Evidence Scout` selects the evidence-recall contract.
- `sourceHandles: []` is valid; the child discovers authentic cards and Trace inside declared roots.

- [x] **Step 1: Add failing runtime tests**

Add tests that submit a one-task Quick graph with:

```ts
{
  id: 'evidence',
  label: '检索 Plan 证据',
  role: 'Evidence Scout',
  instruction: 'Search Plan domain-integrity across cards and Lessons.',
  dependsOn: [],
  sourceHandles: [],
  readRoots: ['plans', 'lessons', 'cards', 'graph'],
}
```

The captured child prompt must:

- tell the child to discover authentic sources itself;
- preserve the Plan question and read roots;
- require `card_index`, including `[]` when evidence is absent;
- contain no prefetched card content.

For the same role, completed JSON without `card_index` must become `INVALID_TASK_RESULT`. A normal role without `card_index` must still complete.

Add a parser test whose child JSON contains extra `content`, `solution` and `transcript` properties. Assert the parsed result contains only the approved `card_index`, findings, references, recommendation and risks.

- [x] **Step 2: Run the runtime tests and observe RED**

```bash
cd apps/pi-teaching-web
bun test tests/workflows/runtime.test.ts
```

Expected failures:

- the Evidence Scout result without `card_index` is currently accepted;
- the captured prompt does not require an empty-or-populated `card_index`.

- [x] **Step 3: Implement the minimal role-sensitive contract**

In `runtime.ts`:

```ts
const EVIDENCE_SCOUT_ROLE = 'Evidence Scout';

function isEvidenceScout(task: Pick<WorkflowTask, 'role'>): boolean {
  return task.role.trim() === EVIDENCE_SCOUT_ROLE;
}

export function parseTaskResult(
  output: string | undefined,
  options: { requireCardIndex?: boolean } = {},
): WorkflowTaskResult {
  // existing JSON parsing and field validation
  const cardIndex = parseCardIndex(candidate.card_index);
  if (options.requireCardIndex && cardIndex === undefined) {
    throw new Error('INVALID_TASK_RESULT');
  }
  // return only reconstructed approved fields
}
```

When parsing a completed task, pass:

```ts
parseTaskResult(response.output, {
  requireCardIndex: isEvidenceScout(task),
});
```

In `promptFor`, add the Evidence Scout-only instruction:

```text
Discover authentic cards and active Trace inside the declared roots; the parent has intentionally not prefetched the broad result.
Return card_index even when empty. Copy title, goal and methods from real card metadata and use real Trace source anchors.
```

Ordinary workflow prompts keep `card_index` optional.

- [x] **Step 4: Add failing executable-tool tests**

In `tool.test.ts`, capture the graph passed to `runtime.propose` and execute a one-task Quick Evidence Scout request with empty `sourceHandles`.

Assert:

- `mode` remains `quick`;
- exactly one task is forwarded;
- empty `sourceHandles` is preserved;
- the tool result includes `workflowId` and compact `card_index`;
- the tool result contains no `content`, `solution` or transcript.

Also inspect the registered tool's executable `description` and TypeBox field descriptions. They must allow one Evidence Scout and say not to prefetch broad cards/Trace. They must not retain the old two-view or “gather handles first” rule.

- [x] **Step 5: Run the tool tests and observe RED**

```bash
bun test tests/workflows/tool.test.ts
```

Expected: schema-description assertions fail against the old multi-view/prefetch contract.

- [x] **Step 6: Align the existing tool schema**

Keep the tool name `deep_workflow_propose`. Change its label to describe an isolated teaching workflow rather than a multi-view-only consultation.

Its description must state:

- one Quick Evidence Scout is allowed for cross-card, cross-Lesson or Plan-scale context isolation;
- the parent passes the evidence question and known scope only;
- the child discovers cards and Trace;
- multiple tasks are for independent questions;
- Deep still requires student confirmation.

Add TypeBox descriptions to `role`, `instruction`, `sourceHandles` and `readRoots`. `sourceHandles` explicitly permits an empty array and forbids parent prefetch for Evidence Scout tasks.

Update `study-scout.md` editorially so an evidence task always emits `card_index`, with `[]` for no matching real cards. Do not add a prose test.

- [x] **Step 7: Verify Task 1**

```bash
bun test tests/workflows/runtime.test.ts tests/workflows/tool.test.ts
bun run typecheck
```

Expected: all targeted tests pass and TypeScript reports no errors.

- [x] **Step 8: Commit**

```bash
git add apps/pi-teaching-web/src/workflows \
  apps/pi-teaching-web/resources/subagents/study-scout.md \
  apps/pi-teaching-web/tests/workflows
git commit -m "feat: connect evidence scout quick recall"
```

---

### Task 2: Project recalled-card count into the existing task rail

**Files:**

- Modify: `apps/pi-teaching-web/tests/projection/workflow-projector.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/task-rail.test.tsx`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/projection/workflow-projector.ts`
- Modify: `apps/pi-teaching-web/src/client/components/TaskRail.tsx`

**Interfaces:**

- Produces:

```ts
export type WorkflowTaskView = {
  // existing fields
  sourceCount: number;
  cardCount: number;
  progress: string;
};
```

- [x] **Step 1: Add failing projection and component tests**

Extend the workflow fixture with two `card_index` entries and three `evidence_refs`.

Assert:

```ts
expect(view.tasks[0]).toMatchObject({
  sourceCount: 3,
  cardCount: 2,
});
```

Render `TaskRail` and assert it includes `2 张题卡` and `3 个来源`, while still excluding child findings, recommendations, card titles and `runId`.

- [x] **Step 2: Run the tests and observe RED**

```bash
cd apps/pi-teaching-web
bun test tests/projection/workflow-projector.test.ts tests/client/task-rail.test.tsx
```

Expected: `cardCount` is absent and the rendered rail has no recalled-card count.

- [x] **Step 3: Implement safe projection**

Add `cardCount` to `WorkflowTaskView`.

In `projectWorkflow`:

```ts
cardCount: task.result?.card_index?.length ?? 0,
```

In `TaskRail`, render `N 张题卡` only when `cardCount > 0`, followed by the existing source count. Do not render card titles, reasons, findings or recommendations.

- [x] **Step 4: Verify and commit**

```bash
bun test tests/projection/workflow-projector.test.ts tests/client/task-rail.test.tsx
bun run typecheck
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/projection/workflow-projector.ts \
  apps/pi-teaching-web/src/client/components/TaskRail.tsx \
  apps/pi-teaching-web/tests/projection/workflow-projector.test.ts \
  apps/pi-teaching-web/tests/client/task-rail.test.tsx
git commit -m "feat: show evidence scout card counts"
```

---

### Task 3: Document delivery semantics and run vertical acceptance

**Files:**

- Modify: `apps/pi-teaching-web/README.md`
- Modify: `docs/superpowers/specs/2026-07-23-subagent-evidence-recall-design.md`

**Interfaces:**

- Quick: synchronous tool result returns compact results to the invoking parent turn.
- Confirmed Deep: `studyforge.workflow-result.v1` hidden custom message triggers parent synthesis.
- Both paths keep raw child artifacts outside learning-set Markdown and Student View.

- [x] **Step 1: Update current documentation**

In the design:

- set status to `已实现`;
- state the two delivery paths above;
- retain the original no-prefetch, read-only, compact-result and parent-writer boundaries.

In the Pi README:

- replace the obsolete “two independent views required for every workflow” sentence;
- document a single Quick Evidence Scout for Plan-scale recall;
- document `card_index` and task-rail card count;
- keep Deep confirmation and cancellation behavior unchanged.

- [x] **Step 2: Run deterministic browser and package verification**

```bash
cd apps/pi-teaching-web
bun run check
bunx playwright test tests/e2e/workspace.spec.ts tests/e2e/deep-workflow.spec.ts
cd ../../plugins/highschool-study
bun run release:check
```

Expected:

- Pi typecheck, 90+ non-E2E tests and build pass;
- both workflow/browser tests pass;
- plugin release check and strict validation pass.

- [x] **Step 3: Prepare an isolated real-model learning set**

```bash
SMOKE=$(mktemp -d /tmp/studyforge-evidence-scout-XXXXXX)
cp -R examples/derivative-demo "$SMOKE/derivative-demo"
find "$SMOKE/derivative-demo/learning-set" -type f -print0 \
  | sort -z \
  | xargs -0 shasum -a 256 > "$SMOKE/before-open.sha256"
```

Start the merged app against:

```text
$SMOKE/derivative-demo/learning-set
```

Use a free localhost port. Open `coach:domain-integrity`, enable deep mode, then capture a second checksum baseline after Session binding but before sending the evidence question.

- [x] **Step 4: Run one natural single-Scout query**

Send this student request through the normal Coach message API:

```text
请只做一次只读的 Plan 级证据检查：比较本 Plan 不同 Lesson、不同题卡中的无提示作答，指出下一课最值得验证的缺口。请使用一个 Evidence Scout，不要先在主会话批量搜索，也先不要备课或改写任何学习文件。
```

Wait for the workflow to reach a terminal status and the Coach to finish its response.

Verify from the HTTP workflow projection and parent Session JSONL:

- exactly one Quick task has role `Evidence Scout`;
- the task reports `cardCount > 0`;
- the compact result contains real canonical `cardPath`, reasons and Trace source anchors;
- the parent tool result contains no card `content`, `solution`, full YAML or child transcript;
- no parent Plan-scale `trace_search` tool call occurs before the workflow;
- the Coach cites compact source handles and does not treat `recommended_action` as an automatic decision.

Verify every returned `cardPath` and `traceRef` against the copied learning set.

- [x] **Step 5: Verify read-only behavior**

Recompute checksums after the Coach answer. Compare against the post-Session-binding baseline, not the pre-open baseline:

```bash
diff -u "$SMOKE/after-open.sha256" "$SMOKE/after-workflow.sha256"
```

Expected: no learning-set file changed during the Evidence Scout query.

Stop the server and retain only a concise sanitized report under `/tmp`; do not commit credentials, raw transcripts, Pi Session JSONL or the copied learning set.

- [x] **Step 6: Commit documentation**

```bash
git add apps/pi-teaching-web/README.md \
  docs/superpowers/specs/2026-07-23-subagent-evidence-recall-design.md
git commit -m "docs: mark evidence scout recall implemented"
```

---

## Completion Criteria

- A deep-enabled Coach/Tutor can run one Quick `Evidence Scout` without two analytical views.
- The parent does not prefetch the same broad card/Trace payload.
- Evidence Scout executes with the child-only read-only domain extension.
- Evidence Scout output always contains an empty or populated compact `card_index`.
- The parent receives `workflowId`, card paths, reasons, real Trace anchors, findings, recommendation and risks, without full card YAML or child transcript.
- The task rail shows recalled-card count without child conclusions.
- Quick and confirmed-Deep delivery paths are documented truthfully.
- The derivative real-model smoke proves one child task, resolvable sources, no parent prefetch and no learning-set mutations.
- Pi checks, browser workflow tests and Claude-plugin release checks pass.

## Implementation Result

The real-model smoke used one Quick `Evidence Scout`, returned four resolvable cards and five sources in 38 seconds, kept full card content and the child transcript out of the parent result, and left learning-set fact files unchanged. Runtime acceptance also required binding Pi extensions, generating an absolute packaged child-extension path, removing the obsolete Quick token and four-turn caps, and using metadata-only card projections inside the child process.
