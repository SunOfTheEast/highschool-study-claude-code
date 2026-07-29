# Roadmap Private Card Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the Roadmap Coach inspect authentic cards privately without projecting stems, methods, decisive structures, answers, or selection reasoning to the student.

**Architecture:** Add one Roadmap-only, turn-local safe-projection state to the existing stored and live projectors. A successful `card_search` makes the next free Roadmap final private; a successful `plan_register` emits one ordinary deterministic Coach message and suppresses the model final. Keep the existing Markdown Plan as the only Session handoff and tighten the two role Skills without adding schema, tools, frontend components, or persistent runtime state.

**Tech Stack:** TypeScript, Bun test, Pi Session events, Markdown Skills.

## Global Constraints

- Apply the new projection only to `coach:@roadmap` in `safe` mode.
- Preserve raw Pi JSONL and explicit `raw-stream` output unchanged.
- Use an ordinary `ChatMessage` for Plan readiness; do not add a `ConversationItem` kind or React component.
- Keep `ROADMAP.md`, Plan, Lesson, card, Trace, and memory schemas unchanged.
- Do not add a semantic spoiler classifier, Plan diff guard, hidden handoff queue, custom Session entry, retry loop, or database state.
- A Roadmap hint is at most a non-semantic short source number in the existing `Next Lesson Candidate` prose.
- Plan Coach treats the number only as a search seed and independently adopts, replaces, or ignores it.
- Do not add tests for exact Skill or Agent prose.

---

### Task 1: Protect stored Roadmap conversation projection

**Files:**
- Modify: `apps/pi-teaching-web/tests/projection/conversation-projector.test.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation-projector.ts`

**Interfaces:**
- Consumes: Pi stored `toolResult` messages for `card_search` (`details.kind === "card-search"`) and `plan_register` (`details.kind === "plan-register"` with `value.ok === true`).
- Produces: `roadmapPrivateToolResult(raw): "card-search" | "plan-register" | null`, fixed student-safe Coach messages, and Roadmap-only behavior in `projectConversationEntries`.

- [ ] **Step 1: Add failing stored-history tests**

Add helpers that create successful tool results:

```ts
function toolResult(
  id: string,
  toolName: 'card_search' | 'plan_register',
  kind: 'card-search' | 'plan-register',
  value: object,
  isError = false,
): SessionEntry {
  return entry(id, {
    type: 'message',
    message: {
      role: 'toolResult',
      toolName,
      isError,
      content: [{ type: 'text', text: JSON.stringify(value) }],
      details: isError ? undefined : { kind, value },
    },
  });
}
```

Cover these behaviors:

```ts
test('replaces a Roadmap post-search final with a fixed recovery message', () => {
  const items = projectConversationEntries('coach:@roadmap', [
    toolResult('search', 'card_search', 'card-search', {
      cards: [{ stem: '绝密题面', answer: '绝密答案' }],
    }),
    message('final', 'assistant', '绝密题面使用冻结变量法。'),
  ], 'safe');

  expect(JSON.stringify(items)).not.toContain('绝密');
  expect(items).toEqual([expect.objectContaining({
    kind: 'message',
    message: expect.objectContaining({
      role: 'coach',
      text: '课程素材已经核对，但学习周期尚未登记。可以继续完成当前计划。',
    }),
  })]);
});

test('replaces a registered Roadmap post-search final with one ordinary ready message', () => {
  const items = projectConversationEntries('coach:@roadmap', [
    toolResult('search', 'card_search', 'card-search', { cards: [] }),
    toolResult('register', 'plan_register', 'plan-register', {
      ok: true,
      factId: 'route-choice',
    }),
    message('final', 'assistant', '这题的关键因式是秘密。'),
  ], 'safe');

  expect(items).toEqual([expect.objectContaining({
    kind: 'message',
    message: expect.objectContaining({
      role: 'coach',
      text: '学习周期已建立。具体素材会由学习顾问在备课时重新核对。',
    }),
  })]);
  expect(JSON.stringify(items)).not.toContain('秘密');
});
```

Also assert that `coach:plan` remains unchanged, failed `card_search` does not activate privacy state, and `raw-stream` retains the original final.

- [ ] **Step 2: Run the stored projection tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/projection/conversation-projector.test.ts
```

Expected: the new Roadmap cases fail because the current projector exposes the pure assistant final and produces no deterministic Plan-ready message.

- [ ] **Step 3: Implement the minimal stored state**

Add compact receipt recognition:

```ts
export type RoadmapPrivateToolResult = 'card-search' | 'plan-register';

export function roadmapPrivateToolResult(raw: unknown): RoadmapPrivateToolResult | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const message = raw as Record<string, unknown>;
  if (message.role !== 'toolResult' || message.isError !== false) return null;
  const details = message.details;
  if (details === null || typeof details !== 'object' || Array.isArray(details)) return null;
  const detail = details as Record<string, unknown>;
  if (message.toolName === 'card_search' && detail.kind === 'card-search') {
    return 'card-search';
  }
  if (message.toolName !== 'plan_register' || detail.kind !== 'plan-register') return null;
  const value = detail.value;
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && (value as Record<string, unknown>).ok === true
    ? 'plan-register'
    : null;
}
```

In `projectConversationEntries`, maintain only:

```ts
let roadmapPrivateState: 'idle' | 'searching' | 'registered' = 'idle';
```

For `safe` history on `coach:@roadmap`:

- successful `card-search` sets `searching`;
- successful `plan-register` while `searching` appends the fixed ordinary Coach message and sets `registered`;
- a Coach final while `registered` is discarded and returns to `idle`;
- a Coach final while `searching` is replaced by the fixed recovery message and returns to `idle`;
- a later student message clears an unfinished turn-local state;
- every other Session and `raw-stream` follows existing behavior.

- [ ] **Step 4: Run the stored projection tests and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/projection/conversation-projector.test.ts
```

Expected: all stored conversation projection tests pass.

---

### Task 2: Mirror the boundary in live projection

**Files:**
- Modify: `apps/pi-teaching-web/tests/projection/projector.test.ts`
- Modify: `apps/pi-teaching-web/src/projection/projector.ts`

**Interfaces:**
- Consumes: `roadmapPrivateToolResult`, fixed message builders/text from Task 1, and existing `AgentSessionEvent`.
- Produces: live `work-status` plus deterministic ordinary `message` events with the same visible sequence as stored history.

- [ ] **Step 1: Add failing live-event tests**

Construct successful `tool_execution_end` events with the same `details.kind` values used by stored history. Verify:

```ts
const safe = createLiveSessionEventProjector('coach:@roadmap', 'safe');
expect(safe(cardSearchReceipt)).toEqual([expect.objectContaining({
  type: 'work-status',
})]);
expect(safe(spoilerFinal)).toEqual([expect.objectContaining({
  type: 'message',
  message: expect.objectContaining({
    text: '课程素材已经核对，但学习周期尚未登记。可以继续完成当前计划。',
  }),
})]);
```

Then verify `card_search → plan_register → spoiler final` emits one fixed ready message and suppresses the final. Add controls proving `coach:plan` and `raw-stream` still show their ordinary final.

Update the status-label test so Roadmap `card_search` displays `正在核对课程素材`, while non-Roadmap `card_search` keeps `正在查找真实题卡`.

- [ ] **Step 2: Run the live projection tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/projection/projector.test.ts
```

Expected: the Roadmap final remains visible, no Plan-ready message is emitted, and the Roadmap-specific status label is absent.

- [ ] **Step 3: Implement the live state without new contracts**

Use the same three explicit states as stored history:

```ts
let roadmapPrivateState: 'idle' | 'searching' | 'registered' = 'idle';
```

On successful Roadmap `card_search`, set `searching`. On successful Roadmap
`plan_register` while searching, append one existing `StudyViewEvent` message with
the fixed text and set `registered`. Replace a pure assistant final while searching
with the fixed recovery message; suppress it while registered. Reset on a
non-retrying `agent_end`.

Keep the existing `preparedInCurrentTurn` behavior independent. Do not generalize
both features into a rule engine.

- [ ] **Step 4: Run both projection suites and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/projection/conversation-projector.test.ts tests/projection/projector.test.ts
```

Expected: both live and stored tests pass with matching safe behavior.

---

### Task 3: Tighten authoring order and current documentation

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `docs/zh-CN/完整说明书.md`
- Modify: `docs/superpowers/specs/2026-07-29-roadmap-private-card-selection-design.md`

**Interfaces:**
- Consumes: existing Plan Markdown sections, existing `card_search`, and existing `plan_register`.
- Produces: one authoring order for Roadmap and one non-binding retrieval interpretation for Plan Coach.

- [ ] **Step 1: Add the compact Roadmap authoring contract**

In `roadmap-study / Publish a new cycle`, state:

```markdown
After the student approves the Plan, finish the complete Plan from that approved
draft before searching cards. Reserve at most one non-semantic short source number
under Next Lesson Candidate and mark it “仅供 Plan Coach 复核，不代表已经选定”.
Only then may you privately call card_search to check whether authentic material
exists. After seeing card results, do not regenerate or expand the Plan: replace or
remove only that reserved number line, call plan_register immediately, and do not
write a free-form card summary. Never put the stem, answer, method, decisive
structure, full semantic filename, or selection reason into the Plan or student
reply.
```

An empty search leaves the approved Plan valid and removes the unverified number
instead of inventing one.

- [ ] **Step 2: Add the compact Plan Coach interpretation**

In `coach-study / Prepare the next Lesson`, state that a Roadmap short source number
is only a search seed. Plan Coach must rerun `card_search`, compare the real card
against current inquiry, Trace, and Lesson purpose, and may adopt, replace, or ignore
it. It must not reveal the stem, method, decisive structure, answer, or selection
reason before `lesson_prepare`.

- [ ] **Step 3: Update durable and user-facing documentation**

Add one concise invariant to `AGENTS.md`: after Roadmap private card search, safe
projection replaces free model output with a deterministic ordinary Coach message;
no new frontend card or handoff store exists.

Update the Roadmap and safe-projection sections in `docs/zh-CN/完整说明书.md` to
describe Plan-first private verification, the optional short number, Plan Coach
re-verification, and raw-stream preservation.

Keep the design spec aligned with the audited minimal implementation: ordinary
message, no `agent_end` recovery protocol, no frontend/shared-contract changes, and
60–120 expected production lines.

- [ ] **Step 4: Run focused static checks**

Run:

```bash
git diff --check
rg -n "card_search|plan_register|非语义|search seed|普通.*Coach" \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  AGENTS.md docs/zh-CN/完整说明书.md \
  docs/superpowers/specs/2026-07-29-roadmap-private-card-selection-design.md
```

Expected: no whitespace errors; each responsibility appears in its semantic owner.
Do not add exact-prose tests.

- [ ] **Step 5: Run the complete Pi verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: TypeScript typecheck passes, all Bun tests pass, and the production build completes.

- [ ] **Step 6: Verify scope did not expand**

Run:

```bash
git diff --name-only
git diff --stat
git diff -- apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/client apps/pi-teaching-web/src/server
```

Expected: no shared-contract, React client, or server changes; no schema, public tool,
database, or persistent Session entry was introduced.
