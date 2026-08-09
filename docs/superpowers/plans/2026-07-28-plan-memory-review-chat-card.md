# Plan Memory Review Chat Card Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Status (2026-07-28):** Implemented and covered by the linked deterministic acceptance record. The checkboxes below remain the reproducible execution recipe rather than mutable project state.

**Goal:** Add a Plan-completion memory-review flow in which the Plan Coach proposes source-linked profile changes, the student decides item by item in the chat timeline, and the same Coach applies accepted changes before reporting from reread Markdown.

**Architecture:** Store proposals and submitted decisions as append-only Pi Session custom entries owned by one completed Plan Coach Session. Project those entries into the existing conversation timeline, submit decisions through a Session-scoped API, and wake the same Coach with one hidden structured message. Confirmed Markdown profiles remain the only durable long-term memory.

**Tech Stack:** Bun 1.3.14, TypeScript 7, React 19.2.8, TypeBox 1.3.6, Pi 0.81.0, Bun test, Playwright 1.61.1.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-28-plan-memory-review-chat-card-design.md`.
- Only a Plan-scoped Coach whose Session-owned Plan is already `completed` may propose a review.
- Roadmap Coach and Tutor must never receive `memory_review_propose`.
- Every candidate starts unselected; the UI actions are `采用 / 改写后采用 / 不采用`.
- Proposals and decisions live only in the owning Pi Session JSONL.
- Do not create pending-memory Markdown, a database, a queue, a vector index, or a fifth public MCP tool.
- Submitting decisions means “saved and delivered to Coach”, not “profiles updated”.
- The frontend never edits `memory/student-profile.md` or `memory/teaching-profile.md`.
- The Coach must edit accepted changes, reread both profiles, and report from the reread state.
- Do not add tests for Skill prose or exact Chinese wording.
- Do not add dependencies.

---

### Task 1: Memory-review contracts, validation, store, and proposal tool

**Files:**
- Create: `apps/pi-teaching-web/src/memory-review/contracts.ts`
- Create: `apps/pi-teaching-web/src/memory-review/store.ts`
- Create: `apps/pi-teaching-web/src/memory-review/source-validation.ts`
- Create: `apps/pi-teaching-web/src/memory-review/tool.ts`
- Create: `apps/pi-teaching-web/tests/memory-review/store.test.ts`
- Create: `apps/pi-teaching-web/tests/memory-review/source-validation.test.ts`
- Create: `apps/pi-teaching-web/tests/memory-review/tool.test.ts`

**Interfaces:**
- Produces:

```ts
export const MEMORY_REVIEW_ENTRY = 'studyforge.memory-review.v1';

export type MemoryReviewItem = {
  id: string;
  operation: 'add' | 'revise' | 'delete';
  owner: 'student' | 'teaching';
  currentText: string | null;
  proposedText: string | null;
  sources: string[];
  rationale: string;
  counterEvidence: string;
  scope: string;
};

export type MemoryReviewDecision = {
  itemId: string;
  action: 'accept' | 'rewrite' | 'reject';
  text: string | null;
};

export type MemoryReviewSnapshot = {
  id: string;
  planId: string;
  status: 'proposed' | 'submitted';
  items: MemoryReviewItem[];
  decisions: MemoryReviewDecision[];
};
```

- Produces:

```ts
export class MemoryReviewStore {
  constructor(manager: SessionManager);
  save(snapshot: MemoryReviewSnapshot): void;
  latest(): MemoryReviewSnapshot | null;
}

export function submittedMemoryReview(
  current: MemoryReviewSnapshot | null,
  reviewId: string,
  decisions: MemoryReviewDecision[],
): MemoryReviewSnapshot;

export function validateMemoryReviewItems(
  root: string,
  planId: string,
  ownerPath: string,
  items: MemoryReviewItem[],
): void;
```

- Produces `createMemoryReviewProposeTool(root, planId, ownerPath, store, createId?)`.

- [ ] **Step 1: Write failing store and decision tests**

Create a proposed snapshot with one `add`, one `revise`, and one `delete` item. Assert that:

```ts
store.save(proposed);
store.save({ ...proposed, status: 'submitted', decisions });
expect(store.latest()).toEqual({ ...proposed, status: 'submitted', decisions });
```

Also assert:

```ts
expect(() => submittedMemoryReview(proposed, 'review-1', [])).toThrow(
  'MEMORY_REVIEW_DECISIONS_INCOMPLETE',
);
expect(() => submittedMemoryReview(proposed, 'review-1', [{
  itemId: 'add-1',
  action: 'rewrite',
  text: '   ',
}])).toThrow('MEMORY_REVIEW_REWRITE_REQUIRED');
```

- [ ] **Step 2: Run the store test and verify the red state**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/memory-review/store.test.ts
```

Expected: FAIL because the memory-review module does not exist.

- [ ] **Step 3: Implement the append-only store and complete-decision validator**

Use `SessionManager.appendCustomEntry(MEMORY_REVIEW_ENTRY, snapshot)` and scan the active
`manager.getBranch()` for the latest entry of that type. Do not restore review state from an
abandoned Session branch. In `submittedMemoryReview` require:

```ts
const expected = new Set(current.items.map((item) => item.id));
const actual = new Set(decisions.map((decision) => decision.itemId));
if (actual.size !== decisions.length) throw new Error('MEMORY_REVIEW_DECISION_DUPLICATE');
if (actual.size !== expected.size || [...actual].some((id) => !expected.has(id))) {
  throw new Error('MEMORY_REVIEW_DECISIONS_INCOMPLETE');
}
```

Trim rewrite text. Require `text === null` for `accept` and `reject`.

- [ ] **Step 4: Write failing proposal-source tests**

Build a temporary learning set with:

- `plans/p1.md` in `completed` status;
- `lessons/lesson-001.md` linked from the Plan;
- one active Trace anchor in that Lesson;
- both profile files with one existing row.

Assert:

```ts
expect(() => validateMemoryReviewItems(root, 'p1', 'plans/p1.md', validItems))
  .not.toThrow();
expect(() => validateMemoryReviewItems(root, 'p1', 'plans/p1.md', [{
  ...validItems[0]!,
  sources: ['lessons/missing.md#trace-event-404'],
}])).toThrow('MEMORY_REVIEW_SOURCE_INVALID');
expect(() => validateMemoryReviewItems(root, 'p1', 'plans/p1.md', [{
  ...validItems[1]!,
  currentText: '不存在的旧画像条目',
}])).toThrow('MEMORY_REVIEW_CURRENT_TEXT_NOT_FOUND');
```

Also reject duplicate item IDs, empty sources, cross-Plan Lesson sources, invalid operation
field combinations, and a superseded Trace source.

- [ ] **Step 5: Implement exact source and profile validation**

For each candidate:

```ts
if (item.operation === 'add' && (item.currentText !== null || !item.proposedText?.trim())) {
  throw new Error('MEMORY_REVIEW_ADD_INVALID');
}
if (item.operation === 'revise' && (!item.currentText?.trim() || !item.proposedText?.trim())) {
  throw new Error('MEMORY_REVIEW_REVISE_INVALID');
}
if (item.operation === 'delete' && (!item.currentText?.trim() || item.proposedText !== null)) {
  throw new Error('MEMORY_REVIEW_DELETE_INVALID');
}
```

Resolve every `path#anchor` inside the learning-set root. Allow only the current Plan, Lessons
linked by that Plan, their `#block-<id>` anchors, and active Trace source anchors from those
Lessons. For `revise` and `delete`, require exact trimmed `currentText` in the selected profile:

```ts
const profilePath = item.owner === 'student'
  ? 'memory/student-profile.md'
  : 'memory/teaching-profile.md';
```

- [ ] **Step 6: Write failing proposal-tool tests**

Assert:

```ts
await expect(activePlanTool.execute(/* ... */))
  .rejects.toThrow('MEMORY_REVIEW_PLAN_NOT_COMPLETED');

const result = await completedPlanTool.execute(/* valid items */);
expect(store.latest()).toMatchObject({
  id: 'review-1',
  planId: 'p1',
  status: 'proposed',
});
expect(JSON.parse(textResult(result))).toEqual({
  ok: true,
  reviewId: 'review-1',
  itemCount: validItems.length,
});
expect(JSON.stringify(result)).not.toContain(validItems[0]!.proposedText!);
```

- [ ] **Step 7: Implement `memory_review_propose`**

Define a TypeBox schema matching `MemoryReviewItem`. The tool must:

1. reread the Session-owned Plan;
2. verify `kind: plan`, matching ID/path, and `status: completed`;
3. run `validateMemoryReviewItems`;
4. append one proposed snapshot;
5. return only `{ ok, reviewId, itemCount }`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/memory-review/store.test.ts \
  tests/memory-review/source-validation.test.ts \
  tests/memory-review/tool.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit the domain slice**

```bash
git add apps/pi-teaching-web/src/memory-review \
  apps/pi-teaching-web/tests/memory-review
git commit -m "feat: add Plan memory review domain"
```

---

### Task 2: Bind review ownership and hidden Coach continuation

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`

**Interfaces:**
- Extends `StudySession` with:

```ts
readonly entries: readonly SessionEntry[];
memoryReview(): MemoryReviewSnapshot | null;
submitMemoryReview(
  id: string,
  decisions: MemoryReviewDecision[],
): Promise<MemoryReviewSnapshot>;
```

- Extends `WorkspaceRegistry` with:

```ts
memoryReview(key: SessionKey): Promise<MemoryReviewSnapshot | null>;
submitMemoryReview(
  key: SessionKey,
  id: string,
  decisions: MemoryReviewDecision[],
): Promise<MemoryReviewSnapshot>;
```

- [ ] **Step 1: Write failing role-boundary tests**

Assert exact tool sets:

```ts
expect(roleToolNames('coach')).toContain('memory_review_propose');
expect(scopeToolNames(ROADMAP_COACH_SCOPE)).not.toContain('memory_review_propose');
expect(roleToolNames('tutor')).not.toContain('memory_review_propose');
```

Use a fake `StudySession` to assert Tutor and Roadmap keys fail before any snapshot is written.

- [ ] **Step 2: Run the focused runtime tests and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts \
  tests/runtime/workspace-registry.test.ts
```

Expected: FAIL because memory-review methods and tool registration are absent.

- [ ] **Step 3: Register the tool only for a Plan Coach**

Add `memory_review_propose` to `roleToolNames('coach')`, but keep the explicit Roadmap scope list
without it. In the owner tool branch:

```ts
const memoryReviewStore = new MemoryReviewStore(manager);

const ownerTools = role === 'tutor'
  ? tutorTools
  : isRoadmapCoachScope(scope)
    ? roadmapTools
    : [
      createLessonPrepareTool(root, ownerId, ownerPath),
      createPlanRegisterTool(root),
      createPlanUpdateTool(root, ownerPath),
      createMemoryReviewProposeTool(root, ownerId, ownerPath, memoryReviewStore),
    ];
```

- [ ] **Step 4: Implement Session-owned review reading and submission**

Expose the current `manager.getBranch()` as a read-only copy through `StudySession.entries`.

Submission must:

1. call `submittedMemoryReview`;
2. append the submitted snapshot before the model turn;
3. send one hidden `studyforge.memory-review-decisions.v1` custom message;
4. trigger the same Plan Coach turn;
5. return the submitted snapshot.

The hidden content must include the exact items and decisions:

```ts
content: JSON.stringify({
  reviewId: submitted.id,
  planId: submitted.planId,
  instruction: [
    'For accept, apply the candidate operation.',
    'For rewrite, use the student text; rewriting a delete means retain and replace the old row.',
    'For reject, make no profile change.',
    'Edit the matching confirmed profile Markdown.',
    'Reread both profile files and report only the reread state.',
  ],
  items: submitted.items,
  decisions: submitted.decisions,
})
```

Use `display: false` and `triggerTurn: true`; do not use `session.prompt`, because that would
create a visible student message.

- [ ] **Step 5: Add registry ownership checks**

Require `coach:<planId>` with `planId !== '@roadmap'`. Resolve the real Plan through
`openCoach(planId)`; Tutor and Roadmap calls throw `MEMORY_REVIEW_PLAN_COACH_ONLY`.

- [ ] **Step 6: Assert hidden continuation and persistence**

In the fake Pi session test, verify:

- a submitted custom entry is present before the hidden custom message;
- the hidden message uses `display: false`;
- one Coach turn is triggered;
- reopening from the same SessionManager returns the submitted snapshot;
- neither profile file is edited by runtime code.

- [ ] **Step 7: Run focused runtime tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts \
  tests/runtime/workspace-registry.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the runtime slice**

```bash
git add apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts
git commit -m "feat: bind memory review to Plan Coach sessions"
```

---

### Task 3: Project review cards into the conversation and expose APIs

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/projection/conversation-projector.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/tests/projection/conversation-projector.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Produces:

```ts
export type ConversationItem =
  | { kind: 'message'; message: ChatMessage }
  | { kind: 'memory-review'; review: MemoryReviewSnapshot };

export function projectConversationEntries(
  key: SessionKey,
  entries: readonly SessionEntry[],
  mode: MessageProjectionMode,
): ConversationItem[];
```

- Adds event:

```ts
| {
    type: 'conversation-snapshot';
    sessionKey: SessionKey;
    items: ConversationItem[];
  }
```

- Changes `WorkspaceRegistry.history()` to return `ConversationItem[]`.
- Adds:

```text
GET  /api/sessions/:coachKey/memory-review
POST /api/sessions/:coachKey/memory-review/:reviewId/submit
```

- [ ] **Step 1: Write failing history-order tests**

Construct Session entries in this order:

```text
student message
assistant reply
proposed review custom entry
tool result
assistant explanation
later student message
submitted review custom entry
hidden continuation
assistant confirmation
```

Assert:

```ts
const items = projectConversationEntries('coach:p1', entries, 'safe');
expect(items.map((item) => item.kind)).toEqual([
  'message',
  'message',
  'message',
  'memory-review',
  'message',
  'message',
]);
expect(items.find((item) => item.kind === 'memory-review')?.review.status)
  .toBe('submitted');
```

Add a case where no visible assistant message follows the proposal; the card must appear at the
history end.

- [ ] **Step 2: Run the projection test and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/projection/conversation-projector.test.ts
```

Expected: FAIL because `ConversationItem` and the projector do not exist.

- [ ] **Step 3: Implement the two-pass conversation projector**

First scan all custom entries to collect the latest snapshot per review ID. Then walk entries in
order:

- project normal message entries through `projectStoredMessage`;
- queue a review ID when its first `proposed` entry appears;
- after the next visible Coach message, flush queued cards;
- flush remaining cards at history end;
- render every card with the latest snapshot for its ID;
- never project the hidden decisions custom message as a student message.

- [ ] **Step 4: Write failing API tests**

Assert:

```ts
const getTutor = await handler(new Request(
  'http://local/api/sessions/tutor%3Alesson-1/memory-review',
));
expect(getTutor.status).toBe(403);

const incomplete = await handler(new Request(
  'http://local/api/sessions/coach%3Ap1/memory-review/review-1/submit',
  {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ decisions: [] }),
  },
));
expect(incomplete.status).toBe(400);
```

Also verify a valid submission returns `202` with `status: submitted` and invokes the same Coach
Session once.

- [ ] **Step 5: Implement history, submission, and live reconciliation**

Change `/history` and `api.history()` to use `ConversationItem[]`.

On every non-retrying `agent_end`, publish:

```ts
deps.hub.publish({
  type: 'conversation-snapshot',
  sessionKey: key,
  items: deps.registry.history(key, projectionMode),
});
```

The POST submission route validates all decisions before starting the Coach turn and returns the
submitted snapshot with HTTP 202. Map known review errors to 400, Tutor/Roadmap scope to 403, and
missing reviews to 404.

- [ ] **Step 6: Run projection and API tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/projection/conversation-projector.test.ts \
  tests/server/workspace-api.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the projection and API slice**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/projection/conversation-projector.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/client/api.ts \
  apps/pi-teaching-web/tests/projection/conversation-projector.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "feat: project memory review into Coach chat"
```

---

### Task 4: Add the structured chat card and confirmation panel

**Files:**
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Create: `apps/pi-teaching-web/src/client/components/MemoryReviewCard.tsx`
- Create: `apps/pi-teaching-web/src/client/components/MemoryReviewPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`
- Create: `apps/pi-teaching-web/tests/client/memory-review-card.test.tsx`
- Create: `apps/pi-teaching-web/tests/client/memory-review-panel.test.tsx`

**Interfaces:**
- Client state stores:

```ts
conversations: Partial<Record<SessionKey, ConversationItem[]>>;
```

- `ChatPanel` consumes `items: ConversationItem[]`.
- `MemoryReviewPanel` produces a complete `MemoryReviewDecision[]`.

- [ ] **Step 1: Write failing client-state tests**

Assert that:

```ts
const next = reduceClientState(state, {
  type: 'conversation-snapshot',
  sessionKey: 'coach:p1',
  items,
});
expect(next.conversations['coach:p1']).toEqual(items);
```

Existing `message` and `message-delta` events must still append/update only their message item,
without removing an existing review card.

- [ ] **Step 2: Write failing component tests**

For the card, assert proposed and submitted states:

```ts
expect(proposedHtml).toContain('长期记忆待确认');
expect(proposedHtml).toContain('逐条确认');
expect(proposedHtml).toContain('稍后处理');
expect(submittedHtml).toContain('已提交');
expect(submittedHtml).not.toContain('逐条确认');
```

For the panel, assert:

- every item begins unselected;
- submit is disabled until all items have a decision;
- actions read `采用 / 改写后采用 / 不采用`;
- rewrite requires non-empty text;
- operation, owner, current/proposed text, sources, rationale, counter-evidence, and scope are shown.

Because the repository does not use React Testing Library, export and unit-test a small pure
`memoryReviewComplete(items, drafts)` helper for the enablement rule; use Playwright for the click
sequence.

- [ ] **Step 3: Run client tests and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/state.test.ts \
  tests/client/memory-review-card.test.tsx \
  tests/client/memory-review-panel.test.tsx
```

Expected: FAIL because the union timeline and components do not exist.

- [ ] **Step 4: Implement the union timeline reducer**

Rename the per-Session message collection to `conversations`. Wrap live messages as:

```ts
{ kind: 'message', message }
```

For `message-delta`, locate only matching `kind: 'message'`. For
`conversation-snapshot`, replace the owning Session list exactly. Preserve all other Session lists.

- [ ] **Step 5: Implement `MemoryReviewCard` and local “later” behavior**

Render counts by owner and status from the structured snapshot. “稍后处理” only changes a local
`focused` boolean:

```ts
const [focused, setFocused] = useState(true);
```

The card remains in the timeline and remains clickable. Do not persist `focused`.

- [ ] **Step 6: Implement the confirmation panel**

Keep draft decisions in component state keyed by item ID. Use `null` for unselected. Enable submit
only when every item has a valid decision. Source anchors beginning with a known active Trace
pattern call the existing Evidence Lens handler; other sources render as exact path/anchor text.

- [ ] **Step 7: Wire submission through App and update the original card**

Add:

```ts
api.submitMemoryReview(sessionKey, reviewId, decisions)
```

On successful 202 response, replace the matching `memory-review` item in the current conversation
with the returned submitted snapshot. Do not append another item and do not display “已应用”.

- [ ] **Step 8: Add restrained styling**

Use one timeline-width structured card, one right-side or centered confirmation overlay, existing
theme tokens, thin dividers, and no dashboard grid. Respect `prefers-reduced-motion`.

- [ ] **Step 9: Run focused client tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/state.test.ts \
  tests/client/memory-review-card.test.tsx \
  tests/client/memory-review-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit the UI slice**

```bash
git add apps/pi-teaching-web/src/client \
  apps/pi-teaching-web/tests/client
git commit -m "feat: add Plan memory review chat card"
```

---

### Task 5: Coach instruction, end-to-end flow, and release checks

**Files:**
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Modify: `docs/zh-CN/完整说明书.md`
- Create: `docs/audits/2026-07-28-plan-memory-review-acceptance.md`

**Interfaces:**
- No new runtime interface.

- [ ] **Step 1: Add the minimal Coach operational instruction**

After the existing completion paragraph, add the semantics:

```markdown
After `plan_update` completes the Plan, reread it. If repeated cross-Lesson preferences or
teaching requirements justify a durable profile change, use `memory_review_propose` with direct
sources, counter-evidence and scope. Do not propose ability conclusions, single-attempt states or
Planner Attention. Wait for item-by-item student decisions; apply only accepted or rewritten
items, then reread both confirmed profiles before reporting.
```

Do not encode API validation branches or UI wording in the Skill.

- [ ] **Step 2: Add a Playwright fixture for card recovery and submission**

Make the fixture server return one conversation containing a proposed review. The test must:

1. open the Plan Coach;
2. find the card after the Coach reply;
3. click “稍后处理” and confirm it remains recoverable;
4. refresh and confirm the card restores;
5. choose accept, rewrite, and reject across three items;
6. submit once;
7. confirm the original card changes to submitted without duplication.

- [ ] **Step 3: Run the full deterministic application checks**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e
```

Expected: typecheck, unit tests, production build, and Playwright all PASS.

- [ ] **Step 4: Verify the public plugin boundary**

Run:

```bash
cd plugins/highschool-study
bun run release:check
```

Expected: PASS and exactly four public MCP tools.

- [ ] **Step 5: Run one isolated real-model acceptance**

Copy `examples/derivative-demo/learning-set` to a temporary acceptance root. Complete a small Plan,
have the Plan Coach propose at least one valid preference candidate, choose a rewrite and a reject,
and verify:

- the review survives service restart;
- the hidden decision event does not appear as a student message;
- accepted/rewrite text is present after Coach rereads profiles;
- rejected text is absent;
- the chat card remains `submitted`, not `applied`.

Never mutate the public demo root and never record credentials or private reasoning.

- [ ] **Step 6: Write the acceptance report and update the manual**

Record commands, copied-root path, observed Session owner, candidate sources, UI states, final
profile diffs, and any non-blocking limitation. Update the user manual with the confirmed behavior;
do not copy implementation history into the manual.

- [ ] **Step 7: Commit the acceptance slice**

```bash
git add apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/tests/e2e \
  docs/zh-CN/完整说明书.md \
  docs/audits/2026-07-28-plan-memory-review-acceptance.md
git commit -m "test: accept Plan memory review flow"
```
