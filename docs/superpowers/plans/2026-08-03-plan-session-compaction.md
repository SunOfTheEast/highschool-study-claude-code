# Plan Session Compaction Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Compact a long Plan-owned Pi Session after a successful Lesson write at a settled turn boundary once its active context reaches 200,000 tokens.

**Architecture:** Add one focused runtime adapter that observes native `edit`/`write` lifecycle events, wraps the native prompt, and invokes Pi's existing `compact(customInstructions)` only after `prompt()` has settled. The adapter is used only by the existing Session factory; Markdown remains the durable source of truth and raw JSONL remains untouched.

**Tech Stack:** TypeScript 7, Bun test, `@earendil-works/pi-coding-agent` 0.81.0, native Pi Session API.

## Global Constraints

- Preserve one native Pi Session per Roadmap, Plan, and Lesson node.
- Do not add Handoff, memory, Trace, context projection, tool-result clearing, Session rollover, or disk archival.
- Only a successful Plan-owned `edit` or `write` targeting `lessons/*.md` creates a semantic compaction boundary.
- Compact only after the native prompt has fully settled and only at `tokens >= 200_000`.
- Compaction failure must not turn an already completed teaching response into a failed student message.
- Preserve unrelated dirty worktree changes.

---

### Task 1: Add the settled Plan compaction adapter

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/plan-compaction.ts`
- Create: `apps/pi-teaching-web/tests/m0/plan-compaction.test.ts`

**Interfaces:**
- Consumes: native Pi `prompt`, `subscribe`, `getContextUsage`, and `compact` methods plus `NodeSessionScope`.
- Produces: `createPlanCompactionPrompt(session, scope, reportError)` returning `{ prompt, dispose }`.

- [ ] **Step 1: Write failing policy and lifecycle tests**

Create tests with a fake native Session that emits real `AgentSessionEvent` shapes. Cover:

```ts
test('compacts a Plan only after a settled successful Lesson mutation at the threshold', async () => {
  const order: string[] = [];
  const session = fakeNativeSession({
    tokens: PLAN_COMPACTION_THRESHOLD_TOKENS,
    onPrompt(listener) {
      order.push('prompt:start');
      listener({
        type: 'tool_execution_start',
        toolCallId: 'write-lesson',
        toolName: 'write',
        args: { path: 'lessons/lesson-002.md' },
      });
      listener({
        type: 'tool_execution_end',
        toolCallId: 'write-lesson',
        toolName: 'write',
        result: { details: { path: 'lessons/lesson-002.md' } },
        isError: false,
      });
      order.push('prompt:settled');
    },
    onUsage: () => order.push('usage'),
    onCompact: (instructions) => {
      order.push('compact');
      expect(instructions).toBe(PLAN_COMPACTION_INSTRUCTIONS);
    },
  });
  const wrapped = createPlanCompactionPrompt(session, PLAN_SCOPE, () => {});

  await wrapped.prompt('准备下一课');

  expect(order).toEqual(['prompt:start', 'prompt:settled', 'usage', 'compact']);
});
```

Additional tests must prove that no compaction occurs for a failed Lesson mutation,
a Plan-file mutation, a Lesson-owned Session, or usage below 200,000 tokens; a compact
error is reported but does not reject the completed prompt.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/plan-compaction.test.ts
```

Expected: FAIL because `src/runtime/plan-compaction.ts` does not exist.

- [ ] **Step 3: Implement the minimal adapter**

Implement:

```ts
export const PLAN_COMPACTION_THRESHOLD_TOKENS = 200_000;

export const PLAN_COMPACTION_INSTRUCTIONS = `StudyForge Plan-session checkpoint:
- Treat ROADMAP.md, the current Plan, and Lesson Markdown as the durable sources of truth.
- Keep exact current-node and relevant Lesson paths, explicit student requirements, unresolved questions, decisions, and next actions.
- Distinguish observed student facts, teacher hypotheses, and judgments that still need verification.
- Do not reproduce card bodies, Scout search transcripts, old tool output, or classroom logs already stored in Markdown.
- When detail is needed later, read the original Markdown again. This summary is a working index, not a teaching fact or Handoff.`;
```

The adapter must:

1. reset its per-turn state before `session.prompt()`;
2. record matching `tool_execution_start` IDs only while a Plan prompt is active;
3. accept the boundary only after the matching non-error `tool_execution_end`;
4. await `session.prompt()` before consulting `getContextUsage()`;
5. call `session.compact(PLAN_COMPACTION_INSTRUCTIONS)` once when eligible;
6. report compact failure without rejecting the prompt;
7. unsubscribe its internal listener from `dispose()`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
bun test tests/m0/plan-compaction.test.ts
```

Expected: all Plan compaction tests pass.

- [ ] **Step 5: Commit the adapter**

```bash
git add apps/pi-teaching-web/src/runtime/plan-compaction.ts \
  apps/pi-teaching-web/tests/m0/plan-compaction.test.ts
git commit -m "feat: compact plan sessions at lesson boundaries"
```

### Task 2: Wire the adapter into native Study Sessions

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`

**Interfaces:**
- Consumes: `createPlanCompactionPrompt()` from Task 1.
- Produces: the unchanged public `StudySession` interface, with its `prompt()` now carrying the Plan-only maintenance step.

- [ ] **Step 1: Integrate the tested adapter without widening `StudySession`**

In `session-factory.ts`:

```ts
const compaction = createPlanCompactionPrompt(session, scope, (error) => {
  console.warn(
    `[studyforge] Plan Session compaction failed: ${error instanceof Error ? error.message : String(error)}`,
  );
});
```

Return `prompt: compaction.prompt`. In `dispose`, call `compaction.dispose()` before
`session.dispose()`. Do not expose `compact` or context-usage methods through the
public `StudySession` interface.

- [ ] **Step 2: Run the adapter and existing native-session tests**

Run:

```bash
bun test tests/m0/plan-compaction.test.ts tests/m0/native-session.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 3: Commit the factory integration**

```bash
git add apps/pi-teaching-web/src/runtime/session-factory.ts
git commit -m "feat: bind plan compaction to native prompts"
```

### Task 3: Document and verify the runtime behavior

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/README.md`

**Interfaces:**
- Consumes: the behavior implemented in Tasks 1–2.
- Produces: contributor and operator documentation for the exact compaction boundary.

- [ ] **Step 1: Update current M0 documentation**

Document that Plan material scouting remains isolated, and that a successful Lesson
write followed by a fully settled turn may trigger native Pi compaction at 200,000
tokens. State explicitly that the summary is Session continuity only, all teaching
facts remain in Markdown, and the raw JSONL stays complete.

- [ ] **Step 2: Run the focused runtime suite**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/plan-compaction.test.ts tests/m0/native-session.test.ts tests/m0/server-api.test.ts
```

Expected: all focused tests pass.

- [ ] **Step 3: Run full mechanical verification**

Run:

```bash
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: typecheck, unit tests, build, and deterministic M0 browser closure all pass.

- [ ] **Step 4: Inspect the diff and repository state**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors; only the planned files are staged or modified in the
isolated implementation worktree.

- [ ] **Step 5: Commit documentation**

```bash
git add AGENTS.md apps/pi-teaching-web/README.md
git commit -m "docs: explain plan session compaction"
```

### Task 4: Real-model acceptance on a copied learning set

**Files:**
- Create only outside the repository: copied learning set and Pi Session JSONL.
- Do not modify public example state.

**Interfaces:**
- Consumes: the implemented runtime and configured `deepseek-v4-flash` provider.
- Produces: direct evidence that a native `compaction` entry is appended and the next Plan turn can reread Markdown.

- [ ] **Step 1: Copy the derivative M0 learning set to `/tmp`**

Use `mktemp -d`, copy `examples/derivative-m0/learning-set`, and point
`STUDY_LEARNING_SET` plus temporary Pi home variables at the copy.

- [ ] **Step 2: Exercise a Plan turn above the threshold or a deterministic compactable fixture**

Prefer the shortest real-model route that produces a successful Lesson write while
the Plan context is at least 200,000 tokens. Do not inflate the prompt with meaningless
padding merely to cross the threshold. If no natural copied Session is available,
record the real-model check as deferred rather than altering the public example.

- [ ] **Step 3: Inspect the copied JSONL**

Run:

```bash
jq -r '.type' "$SESSION_FILE" | sort | uniq -c
jq -c 'select(.type == "compaction") | {tokensBefore, firstKeptEntryId, summary}' "$SESSION_FILE"
```

Expected: at least one native `compaction` entry with `tokensBefore >= 200000`; the
raw pre-compaction messages remain in the JSONL.

- [ ] **Step 4: Continue the same Plan Session once**

Ask an ordinary follow-up that requires reopening the current Plan and relevant
Lesson. Confirm that the Coach reads the original Markdown and continues without a
Handoff or copied child transcript.

- [ ] **Step 5: Record actual acceptance status and commit the plan**

If real-model acceptance is deferred, state exactly why and retain the full mechanical
verification evidence. Commit the implementation plan itself:

```bash
git add docs/superpowers/plans/2026-08-03-plan-session-compaction.md
git commit -m "docs: plan Plan-session compaction implementation"
```
