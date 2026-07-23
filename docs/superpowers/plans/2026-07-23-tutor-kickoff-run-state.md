# Tutor Kickoff Run State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prevent student input while a Tutor kickoff or ordinary Session turn is still running, without blocking HTTP or changing teaching facts.

**Architecture:** The server publishes a transient `session-run` event around each asynchronous Session turn. The client stores this state per Session and uses it only to render progress and disable composition; durable Lesson state remains unchanged.

**Tech Stack:** TypeScript, React, Bun test, WebSocket view events.

## Global Constraints

- Do not change Roadmap, Plan, Lesson, Trace, card, or Skill schemas.
- Do not queue messages or retry model calls.
- Keep lesson start HTTP non-blocking.
- Use one transient status per Session and preserve existing tool-status rendering.

---

### Task 1: Represent and render Session run state

**Files:**
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`

**Interfaces:**
- Produces: `StudyViewEvent` variant `{ type: 'session-run'; sessionKey; status; label }`.
- Produces: `ClientState.busy: Partial<Record<SessionKey, string>>`.
- Consumes: existing `EventHub`, Session promises, `client.work`, and Lesson status.

- [x] **Step 1: Write failing server and client tests**

Extend the lesson-start test so it records `session-run:running` before the
pending kickoff and `session-run:idle` only after release. Add a reducer test:

```ts
test('tracks one running turn by Session key until it becomes idle', () => {
  let state = reduceClientState(initialClientState, {
    type: 'session-run',
    sessionKey: 'tutor:l1',
    status: 'running',
    label: 'Tutor 正在启动',
  });
  expect(state.busy['tutor:l1']).toBe('Tutor 正在启动');
  state = reduceClientState(state, {
    type: 'session-run',
    sessionKey: 'tutor:l1',
    status: 'idle',
    label: '',
  });
  expect(state.busy['tutor:l1']).toBe('');
});
```

- [x] **Step 2: Run the focused tests and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/server/workspace-api.test.ts tests/client/state.test.ts
```

Expected: type/runtime failures because `session-run` and `ClientState.busy`
do not exist.

- [x] **Step 3: Implement the minimal transient event**

Add the `session-run` contract and reducer branch. In the server, publish
`running` immediately before invoking each asynchronous Session turn and
publish `idle` from `finally`. In `App.tsx`, compute:

```ts
const sessionBusy = Boolean(client.selected && client.busy[client.selected]);
const composerEnabled = (isCoach || selectedLesson?.status === 'active')
  && !sessionBusy;
```

Pass `client.work[selected] || client.busy[selected] || ''` to `ChatPanel`.

- [x] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/server/workspace-api.test.ts tests/client/state.test.ts
```

Expected: all focused tests pass.

- [x] **Step 5: Run the full app verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: typecheck, all non-E2E tests, and Vite build pass.

- [x] **Step 6: Restart and run one real Lesson**

Restart the existing isolated runtime at `http://127.0.0.1:65261`. From the
visible Coach Session prepare the next Test 3 Lesson, start it through the
visible UI, verify the kickoff status blocks input, then complete and close a
natural Tutor Session. Audit the Pi JSONL, Lesson, active Trace, Plan writeback,
and ability projection.

- [x] **Step 7: Commit**

```bash
git add docs/superpowers/specs/2026-07-23-tutor-kickoff-run-state-design.md \
  docs/superpowers/plans/2026-07-23-tutor-kickoff-run-state.md \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts \
  apps/pi-teaching-web/tests/client/state.test.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/client/state.ts \
  apps/pi-teaching-web/src/client/App.tsx
git commit -m "fix: block input during active session turns"
```
