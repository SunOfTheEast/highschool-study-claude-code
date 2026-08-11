# StudyForge M2 Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task in the current worktree. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Complete the remaining M2 learning-method, inline-asset, paper-research, focus-cycle, unified-calendar, and asset-review loops without introducing mastery scores, a second memory system, or a generic productivity platform.

**Architecture:** Keep semantic teaching decisions in Session-specific Skills and models; keep clocks, IDs, revisions, append-only events, path ownership, and projections in Runtime. Reuse native Pi Sessions as the conversation and time-event record, keep personal appointments app-global, keep review history beside its learning assets, and expose all new functionality through existing React/Tauri surfaces with student-safe projections.

**Tech Stack:** Bun, TypeScript 7, React 19, Pi native Sessions and custom messages, Markdown/YAML/TSV learning-set storage, Semantic Scholar Academic Graph API, Tauri 2/Rust, macOS notifications, Playwright.

## Global Constraints

- Work only in `/Users/yangrundong/Documents/GitHub/highschool-study-claude-code/.worktrees/m2-free-learning-peer` on `codex/m2-free-learning-peer`.
- Preserve and never commit `.playwright-cli/`, `.superpowers/`, or `apps/pi-teaching-web/.playwright-cli/`.
- Apply TDD to each executable slice: focused RED, observe the intended failure, minimal GREEN, focused pass, then refactor.
- Do not add Runtime regular expressions or fixed phrases that infer student approval, research permission, learning success, or review quality.
- Do not add a database, graph store, draft store, mastery score, FSRS parameter, timer history, recurring calendar rule, background daemon, or generic browser/shell tool.
- A tool or UI operation may validate mechanical facts only: scope, ID, path, revision, source binding, timestamp, event order, and transaction integrity.
- Keep student-visible projections free of tool names, internal paths, query strings, HTTP status, agent IDs, Session keys, and raw error details.
- Add tests only for independent hard invariants. Do not snapshot whole Skills or duplicate cases for enum synonyms and copy variants.
- Commit each completed task separately and update this plan's checkboxes after verification.

---

### Task 1: Shared Learning-Method Skill Branch

**Files:**
- Create: `apps/pi-teaching-web/resources/skills/references/learning-methods/INDEX.md`
- Create: `apps/pi-teaching-web/resources/skills/references/learning-methods/brainstorming.md`
- Create: `apps/pi-teaching-web/resources/skills/references/learning-methods/knowledge-reconstruction.md`
- Create: `apps/pi-teaching-web/resources/skills/references/learning-methods/structural-comparison.md`
- Create: `apps/pi-teaching-web/resources/skills/references/learning-methods/claim-challenge.md`
- Create: `apps/pi-teaching-web/resources/skills/references/learning-methods/retrieval-practice.md`
- Modify: `apps/pi-teaching-web/resources/skills/free-learning/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/teaching/math-teaching-core.md`
- Test: `apps/pi-teaching-web/tests/m2/learning-method-resources.test.ts`

**Interfaces:**
- Both Free Learning and Lesson roots route directly to one exact reference; they never read `INDEX.md` to choose.
- The shared references own only the learning action. Session scope, evidence, source, saving, memory, and lifecycle rules remain in the root Skills.
- The common teaching core adds the short question-formation principle, not a new Socratic workflow.

- [x] **Step 1: Write the focused resource RED test**

Assert that all five files are packaged, each root names the exact direct paths, `INDEX.md` is absent from both root routes, and the question-formation paragraph exists in the shared core. Assert no method file contains save/memory/lifecycle tool names.

- [x] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/learning-method-resources.test.ts
```

Expected: missing reference files and routes fail.

- [x] **Step 3: Write the five single-bright-line references**

Use the approved sequences verbatim in substance:

```text
brainstorming: anchor → receive student's link → add one useful route from an allowed source → jointly explain/test/branch
knowledge reconstruction: select object → student reconstructs → locate the decisive gap → student reorganizes → check with one boundary/example
structural comparison: name objects → student states link → shared mechanism → decisive difference → analogy boundary → new judgment
claim challenge: restate claim → preserve local truth → expose enlarged/missing condition → discriminating case → predict/test → revise
retrieval practice: recall before source → preserve first performance → feedback/local teaching → retrieve again elsewhere
```

Keep `INDEX.md` as a human/package audit table only. Add direct observable-state routes to both Session roots and the compact question-formation rule to `math-teaching-core.md`.

- [x] **Step 4: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/learning-method-resources.test.ts
cd ../..
git add apps/pi-teaching-web/resources/skills/references/learning-methods \
  apps/pi-teaching-web/resources/skills/free-learning/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/resources/teaching/math-teaching-core.md \
  apps/pi-teaching-web/tests/m2/learning-method-resources.test.ts
git commit -m "feat: add shared learning method references"
```

---

### Task 2: Bounded Paper Research Tool and Safe Activity Projection

**Files:**
- Create: `apps/pi-teaching-web/resources/subagents/paper-research-scout.md`
- Create: `apps/pi-teaching-web/src/research/semantic-scholar.ts`
- Create: `apps/pi-teaching-web/src/runtime/paper-research-runner.ts`
- Create: `apps/pi-teaching-web/src/runtime/paper-research-tools.ts`
- Create: `apps/pi-teaching-web/src/projection/paper-research.ts`
- Create: `apps/pi-teaching-web/src/client/components/PaperResearchActivity.tsx`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-tools.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Test: `apps/pi-teaching-web/tests/m2/paper-research.test.ts`
- Test: `apps/pi-teaching-web/tests/m2/paper-research-projection.test.tsx`

**Interfaces:**

```ts
type PaperResearchRequest = {
  anchor: string;
  bridgeQuestion: string;
  studentLevel: string;
};

type PaperBridge = {
  title: string;
  year: number | null;
  authors: string[];
  url: string;
  supportedFinding: string | null;
  relevance: string;
  limitation: string | null;
};
```

- `paper_research` is present only in active Free Learning and Lesson model-tool lists.
- Runtime gives a fixed fresh Paper Research Scout only the three request fields and bounded Semantic Scholar results; it has no file/write/memory tools.
- The client sees `searching → checking → done|unavailable`, never the provider query or internal IDs.

- [x] **Step 1: Write client/parser/scope RED tests**

Cover: bounded field parsing and candidate count; timeout, 429, empty results, missing abstracts; Free/Lesson tool availability and Roadmap/Plan/Meta absence; safe live/history projection; no asset or memory mutation.

- [x] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/paper-research.test.ts tests/m2/paper-research-projection.test.tsx
```

- [x] **Step 3: Implement one replaceable Semantic Scholar adapter**

Use injected `fetch`, `AbortSignal.timeout`, the official relevance endpoint, explicit fields, a small fixed result limit, and no retries. Parse only title/year/authors/abstract/url/open-access metadata. Treat rate limits, offline errors, malformed responses, and empty results as an ordinary unavailable result.

- [x] **Step 4: Implement fixed Scout and scoped tool**

The tool description states the semantic permission boundary for the model but Runtime does not inspect transcript wording. The runner asks the fixed Scout to select and summarize at most three bridges from returned metadata; it cannot read workspace files or write anything. Return structured bridges to the parent teacher.

- [x] **Step 5: Project student-safe progress and verify**

```bash
cd apps/pi-teaching-web
bun test tests/m2/paper-research.test.ts tests/m2/paper-research-projection.test.tsx
bun run typecheck
cd ../..
git add apps/pi-teaching-web/resources/subagents/paper-research-scout.md \
  apps/pi-teaching-web/src/research apps/pi-teaching-web/src/runtime/paper-research-* \
  apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/runtime/free-learning-tools.ts \
  apps/pi-teaching-web/src/runtime/lesson-tools.ts \
  apps/pi-teaching-web/src/projection/paper-research.ts \
  apps/pi-teaching-web/src/projection/conversation.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/client/components/PaperResearchActivity.tsx \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/tests/m2/paper-research*.ts*
git commit -m "feat: add bounded paper research bridges"
```

---

### Task 3: Inline Note and Problem-Card Proposals

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/learning-asset-proposal-tools.ts`
- Create: `apps/pi-teaching-web/src/projection/learning-asset-proposal.ts`
- Create: `apps/pi-teaching-web/src/client/components/LearningAssetProposal.tsx`
- Modify: `apps/pi-teaching-web/src/runtime/learning-asset-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/resources/skills/free-learning/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/help/first-learning.md`
- Test: `apps/pi-teaching-web/tests/m2/learning-asset-proposals.test.tsx`

**Interfaces:**

```ts
propose_note({ title, blocks, target? })
propose_problem_card({ stem, studentNote, standardAnswer, teacherRationale, target? })
// Plan-only variant additionally requires lessonId/blockId and disallows target.
```

- Proposal tools return transcript details only and perform no I/O.
- Student projection for Problem Card omits `standardAnswer` and `teacherRationale` at the TypeScript boundary.
- Save receipts include kind/id/revision/title/route and render as links; proposals have no save/edit buttons or mutable status.

- [x] **Step 1: Write RED tests for scope, side effects, privacy, and receipt links**

Use a temporary learning set and assert proposal execution leaves its file tree byte-for-byte unchanged. Reconstruct history from native tool calls and assert Note recall answers are locally collapsible, Problem Card answer/rationale strings are absent from rendered markup, Plan accepts only the narrow shape, and saved receipts link to `/assets/notes/:id` or `/assets/problem-cards/:id`.

- [x] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/learning-asset-proposals.test.tsx
```

- [x] **Step 3: Implement stateless proposal tools and projections**

Return `details.kind = 'learning-asset-proposal'` with a discriminated public payload. Do not generate an ID, revision, confirmation token, draft file, or session state. Keep the full native tool arguments in Pi history for the teacher, but construct the public Problem Card item from stem/studentNote only.

- [x] **Step 4: Upgrade existing save receipts and Skill sequence**

Include the non-durable display title and route in successful tool details. Projection adds a separate `LearningAssetSavedConversationItem`; server invalidates home/assets/knowledge for all three save tools. Update Skills to follow proposal → natural correction/confirmation → existing save tool, with the latest visible draft as semantic owner.

- [x] **Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/learning-asset-proposals.test.tsx
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/runtime/learning-asset-proposal-tools.ts \
  apps/pi-teaching-web/src/runtime/learning-asset-tools.ts \
  apps/pi-teaching-web/src/runtime/free-learning-tools.ts \
  apps/pi-teaching-web/src/runtime/lesson-tools.ts \
  apps/pi-teaching-web/src/runtime/plan-tools.ts \
  apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/src/projection/learning-asset-proposal.ts \
  apps/pi-teaching-web/src/projection/conversation.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/client/components/LearningAssetProposal.tsx \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/resources/skills/free-learning/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md \
  apps/pi-teaching-web/resources/help/first-learning.md \
  apps/pi-teaching-web/tests/m2/learning-asset-proposals.test.tsx
git commit -m "feat: preview learning assets in conversation"
```

---

### Task 4: Native Custom-Message Adapter and Focus Repository

**Files:**
- Create: `apps/pi-teaching-web/src/time/focus-cycle.ts`
- Create: `apps/pi-teaching-web/src/runtime/session-custom-messages.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Test: `apps/pi-teaching-web/tests/m2/focus-cycle.test.ts`
- Test: `apps/pi-teaching-web/tests/m2/session-custom-messages.test.ts`

**Interfaces:**

```ts
type FocusCycleState = {
  cycleId: string;
  sessionKey: SessionKey;
  sessionId: string;
  targetSeconds: 900 | 1500 | 2700;
  startedAt: string;
  status: 'running' | 'paused';
  runningSince: string | null;
  accumulatedSeconds: number;
};

StudySession.sendCustomMessage(
  customType: string,
  data: unknown,
  options: { triggerTurn: boolean; deliverAs?: 'followUp' },
): Promise<void>;
```

- [x] **Step 1: Write deterministic RED tests with an injected clock**

Cover the three durations, pause/resume arithmetic, atomic file write, duplicate start, running/paused restart, elapsed restart, started/ended idempotency, active Free/Lesson qualification, and parent-session end. Do not wait in real time.

- [x] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/focus-cycle.test.ts tests/m2/session-custom-messages.test.ts
```

- [x] **Step 3: Expose the narrow Pi native custom-message operation**

Wrap Pi's native custom-message API instead of calling `prompt`. `WorkspaceRegistry` owns serialization with existing turns: focus start never triggers a turn; ordinary focus end triggers immediately or as follow-up; parent-session end records without triggering. Add exact custom types `studyforge.m2.focus-started.v1` and `studyforge.m2.focus-ended.v1`.

- [x] **Step 4: Implement the one-file focus state machine**

Persist only `.studyforge/time/focus.json`; derive remaining/expiry values. Start writes state then started message and rolls back on clear failure. End publishes the mechanical terminal snapshot, writes/checks ended message, then removes state. Recovery reconciles by `cycleId` without duplicate messages.

- [x] **Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/focus-cycle.test.ts tests/m2/session-custom-messages.test.ts
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/time/focus-cycle.ts \
  apps/pi-teaching-web/src/runtime/session-custom-messages.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/tests/m2/focus-cycle.test.ts \
  apps/pi-teaching-web/tests/m2/session-custom-messages.test.ts
git commit -m "feat: add authoritative focus cycle runtime"
```

---

### Task 5: Focus HTTP, Conversation Markers, Topbar, and macOS Shell

**Files:**
- Create: `apps/pi-teaching-web/src/projection/focus-cycle.ts`
- Create: `apps/pi-teaching-web/src/client/components/FocusCycleControls.tsx`
- Create: `apps/pi-teaching-web/src/client/focus-alert.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/server/event-hub.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/AppShell.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/bridge.ts`
- Modify: `apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/components.css`
- Modify: `apps/pi-teaching-web/src-tauri/Cargo.toml`
- Modify: `apps/pi-teaching-web/src-tauri/src/lib.rs`
- Modify: `apps/pi-teaching-web/src-tauri/capabilities/default.json`
- Test: `apps/pi-teaching-web/tests/m2/focus-cycle-http.test.ts`
- Test: `apps/pi-teaching-web/tests/m2/focus-cycle-ui.test.tsx`
- Test: `apps/pi-teaching-web/tests/m2/focus-cycle-shell.test.ts`

**Interfaces:**
- HTTP: `GET /api/focus`, `POST /api/focus/start|pause|resume|end`.
- `StudyEvent` adds `focus-invalidated`; HTTP snapshots remain authoritative.
- Desktop bridge adds one local notification operation; local audio has a bundled/offline fallback.

- [x] **Step 1: Write RED tests for endpoint qualification and UI projection**

Assert only active Free Learning/Lesson pages offer start; the topbar remains across home/assets/course navigation while active; ended Session hides controls; internal IDs never render; switching learning sets is refused while active; notification rejection does not fail end.

- [x] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/focus-cycle-http.test.ts tests/m2/focus-cycle-ui.test.tsx \
  tests/m2/focus-cycle-shell.test.ts
```

- [x] **Step 3: Add mechanical API and student-safe time markers**

Project started/ended native messages as thin neutral timeline items. Render “开始专注” with 15/25/45 only in eligible chat headers, and render running/paused remaining time plus pause/resume/end in `AppShell`. Browser intervals refresh display only; every refresh derives from Runtime snapshot timestamps.

- [x] **Step 4: Add single-instance and notification shell support**

Use the Tauri single-instance plugin so a second launch reveals/focuses `main`. Provide a narrow command/plugin call for a StudyForge local notification. Play the local alert immediately on client-observed terminal state; system notification is additive and fallible.

- [x] **Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/focus-cycle-http.test.ts tests/m2/focus-cycle-ui.test.tsx \
  tests/m2/focus-cycle-shell.test.ts
cargo test --manifest-path src-tauri/Cargo.toml
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/projection/focus-cycle.ts \
  apps/pi-teaching-web/src/server apps/pi-teaching-web/src/client \
  apps/pi-teaching-web/src-tauri/Cargo.toml apps/pi-teaching-web/src-tauri/src/lib.rs \
  apps/pi-teaching-web/src-tauri/capabilities/default.json \
  apps/pi-teaching-web/tests/m2/focus-cycle-*.ts*
git commit -m "feat: surface focus cycles across the desktop app"
```

---

### Task 6: App-Global Calendar Repository and Session Tools

**Files:**
- Create: `apps/pi-teaching-web/src/calendar/appointments.ts`
- Create: `apps/pi-teaching-web/src/runtime/calendar-tools.ts`
- Modify: `apps/pi-teaching-web/src/desktop/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/start-server.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-tools.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Test: `apps/pi-teaching-web/tests/m2/calendar-repository.test.ts`
- Test: `apps/pi-teaching-web/tests/m2/calendar-tools.test.ts`

**Interfaces:**

```ts
type CalendarStore = { version: 1; appointments: CalendarAppointment[] };
type CalendarAppointment = {
  id: string;
  revision: number;
  title: string;
  startsAt: string;
  plannedMinutes: number | null;
  learningSetPath: string;
  destination:
    | { kind: 'plan'; planId: string }
    | { kind: 'free-learning'; intent: 'open' | 'review'; assets: LearningContextReference[] };
};
```

- Store path: `<app-home>/calendar/appointments.json`.
- Session tools are available in Plan, Lesson, and Free Learning only. Lesson formal appointments resolve to its parent Plan; Runtime never chooses a Lesson.
- Model create/update/delete is permitted only after natural confirmation by Skill; Runtime validates the mechanical request, not transcript wording.

- [ ] **Step 1: Write repository and scope RED tests**

Cover atomic create/update/delete, stale revision, absolute learning-set identity, one-off time validation, nullable minutes, Plan destination verification, Lesson-to-parent-Plan binding, selected-asset validation, and Roadmap/Meta absence.

- [ ] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/calendar-repository.test.ts tests/m2/calendar-tools.test.ts
```

- [ ] **Step 3: Thread app-home into runtime without widening learning-set services**

Add `appHome` to server/runtime construction options and create a dedicated calendar repository. Do not place calendar files under `root`, and do not make generic workspace services accept arbitrary absolute paths.

- [ ] **Step 4: Implement CRUD and the narrow model tools**

Generate IDs/timestamps/revisions mechanically. Plan and Lesson may create only formal Plan destinations. Free Learning may create open/review destinations with validated selected contexts. Update/delete require current ID and revision. Return a student-safe appointment receipt.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/calendar-repository.test.ts tests/m2/calendar-tools.test.ts
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/calendar/appointments.ts \
  apps/pi-teaching-web/src/runtime/calendar-tools.ts \
  apps/pi-teaching-web/src/desktop/contracts.ts \
  apps/pi-teaching-web/src/server/start-server.ts apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/src/runtime/free-learning-tools.ts \
  apps/pi-teaching-web/src/runtime/lesson-tools.ts \
  apps/pi-teaching-web/src/runtime/plan-tools.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/tests/m2/calendar-*.test.ts
git commit -m "feat: add one app-global learning calendar"
```

---

### Task 7: Calendar Page, Cross-Learning-Set Opening, and macOS Reminders

**Files:**
- Create: `apps/pi-teaching-web/src/client/pages/CalendarPage.tsx`
- Create: `apps/pi-teaching-web/src/client/components/CalendarDayPanel.tsx`
- Create: `apps/pi-teaching-web/src/client/calendar-navigation.ts`
- Create: `apps/pi-teaching-web/src-tauri/src/calendar_notifications.rs`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/components/AppShell.tsx`
- Modify: `apps/pi-teaching-web/src/client/desktop/bridge.ts`
- Modify: `apps/pi-teaching-web/src/client/desktop/DesktopRoot.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/pages.css`
- Modify: `apps/pi-teaching-web/src-tauri/src/lib.rs`
- Modify: `apps/pi-teaching-web/src-tauri/capabilities/default.json`
- Test: `apps/pi-teaching-web/tests/m2/calendar-ui.test.tsx`
- Test: `apps/pi-teaching-web/tests/m2/calendar-notifications.test.ts`

**Interfaces:**
- UI endpoints list/create/update/delete appointments and expose an empty `reviewCandidates` provider until Task 10.
- Native reconciliation schedules deterministic `appointment:<id>:advance` and `appointment:<id>:due` notifications.
- Opening an appointment switches the desktop learning set if needed, then routes to Plan or creates/opens the intended Free Learning. The opened receipt prevents duplicate Session creation on a repeated notification click; it is not a completion state.

- [ ] **Step 1: Write RED tests for month/day interaction and notification reconciliation**

Cover month navigation, day side panel, direct CRUD, cross-set label, Plan-only course route, Free open/review launch, deterministic 10-minute/due IDs, update/delete reconciliation, cold click, and no `completed/missed` fields.

- [ ] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/calendar-ui.test.tsx tests/m2/calendar-notifications.test.ts
```

- [ ] **Step 3: Build the restrained calendar page**

Add a single top-level “日历” destination. The month grid shows appointment marks and review-count hooks; clicking a date opens one side panel. Direct form actions do not invoke the model. Opening a formal appointment always returns to `/course/plan/:id`; it never resolves Lesson children.

- [ ] **Step 4: Implement native reminder reconciliation**

Desktop shell receives the public appointment list and reconciles local notifications. Use deterministic IDs and no stored delivery receipt. Notification click opens/focuses the app and passes one launch intent; the main client resolves it after runtime readiness. Failure to obtain permission does not affect appointments.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/calendar-ui.test.tsx tests/m2/calendar-notifications.test.ts
cargo test --manifest-path src-tauri/Cargo.toml calendar
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/client/pages/CalendarPage.tsx \
  apps/pi-teaching-web/src/client/components/CalendarDayPanel.tsx \
  apps/pi-teaching-web/src/client/calendar-navigation.ts \
  apps/pi-teaching-web/src/client/api.ts apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/routes.ts \
  apps/pi-teaching-web/src/client/components/AppShell.tsx \
  apps/pi-teaching-web/src/client/desktop \
  apps/pi-teaching-web/src/client/styles/pages.css \
  apps/pi-teaching-web/src-tauri/src/calendar_notifications.rs \
  apps/pi-teaching-web/src-tauri/src/lib.rs \
  apps/pi-teaching-web/src-tauri/capabilities/default.json \
  apps/pi-teaching-web/tests/m2/calendar-ui.test.tsx \
  apps/pi-teaching-web/tests/m2/calendar-notifications.test.ts
git commit -m "feat: add calendar navigation and local reminders"
```

---

### Task 8: Append-Only Asset Review Repository and Fixed Ladder

**Files:**
- Create: `apps/pi-teaching-web/src/study/asset-reviews.ts`
- Create: `apps/pi-teaching-web/src/study/asset-review-index.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Test: `apps/pi-teaching-web/tests/m2/asset-review-repository.test.ts`

**Interfaces:**

```ts
type ReviewResult = 'forgot' | 'effortful' | 'fluent';
type ReviewEvent = Enrolled | Reviewed | Corrected | Removed | Restarted;
type AssetReviewProjection = {
  asset: LearningAssetHandle;
  active: boolean;
  stage: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  dueOn: string | null;
  lastResult: ReviewResult | null;
};
```

- Canonical logs are Markdown under `activity/asset-reviews/{notes,problem-cards}/<id>.md`.
- `activity/asset-reviews/index.tsv` is a deterministic rebuildable projection with `kind id active stage due_on last_result`.
- Fixed intervals are exactly `1/3/7/14/30/60/120` days; corrections replay history rather than editing it.

- [ ] **Step 1: Write event-parser and replay RED tests**

Cover every event variant, request-id replay/conflict, local-date calculation, ladder transitions, overdue behavior, same-local-day first effective review, corrected-null reopening, remove/re-enroll/restart, unknown policy failure, and index rebuild after deletion/corruption.

- [ ] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/asset-review-repository.test.ts
```

- [ ] **Step 3: Implement strict append-only events and deterministic projection**

Use existing atomic document primitives. Bind asset kind/id by the managed file path; callers never submit paths or timestamps. Validate referenced corrections and preserve unknown/invalid state as unavailable instead of guessing.

- [ ] **Step 4: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/asset-review-repository.test.ts
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/study/asset-reviews.ts \
  apps/pi-teaching-web/src/study/asset-review-index.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/tests/m2/asset-review-repository.test.ts
git commit -m "feat: add append-only asset review history"
```

---

### Task 9: Atomic Enrollment and Direct Asset Review

**Files:**
- Modify: `apps/pi-teaching-web/src/study/learning-assets.ts`
- Modify: `apps/pi-teaching-web/src/runtime/learning-asset-tools.ts`
- Modify: `apps/pi-teaching-web/src/study/problem-attempts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/pages/NotePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx`
- Create: `apps/pi-teaching-web/src/client/components/AssetReviewControls.tsx`
- Test: `apps/pi-teaching-web/tests/m2/asset-review-enrollment.test.ts`
- Test: `apps/pi-teaching-web/tests/m2/direct-asset-review.test.tsx`

**Interfaces:**
- New Note/Problem Card save candidates include `enrolled(trigger='asset-saved')` in the same multi-document transaction.
- A legacy Problem Card first real attempt enrolls with `first-attempt`; one bounded startup migration enrolls only cards with actual historical attempt logs.
- Direct endpoints support enroll/remove/restart/review; Runtime binds revision, current attempt, reveal, date, and event IDs.

- [ ] **Step 1: Write RED tests for enrollment boundaries**

Assert new asset save is atomic with enrollment; failed enrollment fails the asset transaction; 519 untouched legacy cards remain absent; historical migration reads only attempt logs; plain open/reveal/search/lesson use does not enroll.

- [ ] **Step 2: Write direct-review UI/API RED tests**

For Note: only recall-block Notes offer direct review; all current blocks must reveal before rating; revision change aborts. For Problem Card: review mode re-hides prior answers, requires a new attempt/cannot plus reveal, and binds that attempt before accepting one rating.

- [ ] **Step 3: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/asset-review-enrollment.test.ts tests/m2/direct-asset-review.test.tsx
```

- [ ] **Step 4: Implement atomic hooks and direct controls**

Add review candidates to `planLearningNoteSave`/`planProblemCardSave` rather than performing a second write after commit. Extend the existing Problem attempt transaction for first enrollment. Asset pages show only next date, interval, and `现在复习 / 移出复习 / 重新开始` or `加入复习`; no strength, score, or streak.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/asset-review-enrollment.test.ts tests/m2/direct-asset-review.test.tsx
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/study/learning-assets.ts \
  apps/pi-teaching-web/src/runtime/learning-asset-tools.ts \
  apps/pi-teaching-web/src/study/problem-attempts.ts \
  apps/pi-teaching-web/src/server/app.ts apps/pi-teaching-web/src/client/api.ts \
  apps/pi-teaching-web/src/client/pages/NotePage.tsx \
  apps/pi-teaching-web/src/client/pages/ProblemCardPage.tsx \
  apps/pi-teaching-web/src/client/components/AssetReviewControls.tsx \
  apps/pi-teaching-web/tests/m2/asset-review-enrollment.test.ts \
  apps/pi-teaching-web/tests/m2/direct-asset-review.test.tsx
git commit -m "feat: enroll and directly review learning assets"
```

---

### Task 10: Guided Free/Lesson Review and Bounded Preparation Query

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/asset-review-tools.ts`
- Create: `apps/pi-teaching-web/src/runtime/asset-review-context.ts`
- Create: `apps/pi-teaching-web/resources/skills/references/learning-methods/batch-asset-review.md`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-owner.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/runtime/free-learning-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/resources/skills/free-learning/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Test: `apps/pi-teaching-web/tests/m2/guided-asset-review.test.ts`

**Interfaces:**
- Free Learning can carry optional persisted `intent: 'open' | 'review'`; review intent adds a compact alias/due/stage/last-result brief, not full history.
- `record_asset_review({ alias, result })` binds Free selected context or current Lesson Uses and writes Session evidence.
- Preparation receives one read-only bounded due-candidate query; selecting/reading a candidate never records a review.

- [ ] **Step 1: Write RED tests for context and write authority**

Cover persistent review intent, compact brief recovery, selected alias binding, Lesson Uses-only binding, Plan/Meta/Roadmap write-tool absence, untouched batch candidates remaining due, same-day rule, and preparation query limit/no writes.

- [ ] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/guided-asset-review.test.ts
```

- [ ] **Step 3: Implement review context and narrow write tools**

Extend only Free scope ownership metadata with `intent`; preserve old sessions as `open`. Runtime supplies aliases and binds Session key/revision/date. The tool accepts only alias/result. It does not judge correctness or infer cold retrieval. Lesson can write only assets already in current `Uses`.

- [ ] **Step 4: Add the teaching bright line and bounded prepare route**

Free/Lesson follow: cold retrieval first → preserve first result → then teach/compare → record only touched assets → state the next appearance. Pure Markdown Notes receive one or a few questions derived from content without first revealing it. Preparation reads candidate summaries with a hard small limit and opens the asset only after choosing it.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/guided-asset-review.test.ts
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/runtime/asset-review-* \
  apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/src/runtime/session-owner.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/src/runtime/free-learning-tools.ts \
  apps/pi-teaching-web/src/runtime/lesson-tools.ts \
  apps/pi-teaching-web/src/runtime/resource-loader.ts \
  apps/pi-teaching-web/resources/skills/references/learning-methods/batch-asset-review.md \
  apps/pi-teaching-web/resources/skills/free-learning/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md \
  apps/pi-teaching-web/tests/m2/guided-asset-review.test.ts
git commit -m "feat: guide spaced review through teaching sessions"
```

---

### Task 11: Cross-Learning-Set Review Candidates in the Calendar

**Files:**
- Create: `apps/pi-teaching-web/src/calendar/review-candidates.ts`
- Modify: `apps/pi-teaching-web/src/server/desktop-app.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/pages/CalendarPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/CalendarDayPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/AssetsPage.tsx`
- Test: `apps/pi-teaching-web/tests/m2/calendar-review-candidates.test.tsx`

**Interfaces:**
- Aggregator reads only known/recent learning-set roots from desktop config, never searches the filesystem.
- Candidate projection carries learning-set path/name, asset handle/title, due date/stage/last result, and unavailable status; it does not copy review history.
- “现在开始复习” creates one existing Free Learning with selected contexts and `intent='review'`; “安排到时间” creates an ordinary review appointment.

- [ ] **Step 1: Write RED tests for aggregation and ownership**

Cover multiple learning sets, oldest-due ordering, future day counts, overdue inclusion today, invalid/missing asset, no implicit enumeration, batch selection, appointment persistence after early review, and candidate refresh after result.

- [ ] **Step 2: Run RED**

```bash
cd apps/pi-teaching-web
bun test tests/m2/calendar-review-candidates.test.tsx
```

- [ ] **Step 3: Implement provider and connect the empty calendar hook**

Read/rebuild each known learning set's review index and resolve only projected candidates. Calendar owns explicit appointments; it never deletes them when review state changes. Asset library adds selection entry points without turning the library into a second review queue.

- [ ] **Step 4: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m2/calendar-review-candidates.test.tsx
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/calendar/review-candidates.ts \
  apps/pi-teaching-web/src/server/desktop-app.ts apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/client/api.ts \
  apps/pi-teaching-web/src/client/pages/CalendarPage.tsx \
  apps/pi-teaching-web/src/client/components/CalendarDayPanel.tsx \
  apps/pi-teaching-web/src/client/pages/AssetsPage.tsx \
  apps/pi-teaching-web/tests/m2/calendar-review-candidates.test.tsx
git commit -m "feat: connect review candidates to the calendar"
```

---

### Task 12: Full Verification, Real-Model Protocol, and Desktop Smoke

**Files:**
- Create: `apps/pi-teaching-web/scripts/m2-validation/cli.ts`
- Create: `apps/pi-teaching-web/scripts/m2-validation/scenarios.ts`
- Create: `apps/pi-teaching-web/docs/validation/m2-completion-protocol.md`
- Create: `apps/pi-teaching-web/docs/validation/m2-completion-report.md`
- Modify: `apps/pi-teaching-web/package.json`
- Modify: `docs/superpowers/plans/2026-08-12-m2-completion.md`

**Interfaces:**
- `bun run validate:m2 -- --root <fixture-or-real-learning-set> --api-base <url>` records actual model first-hit behavior, tool calls, durable diffs, and elapsed time without exposing hidden reasoning.
- Validation never uses production students' private learning sets or credentials in committed fixtures.

- [ ] **Step 1: Add a deterministic validation harness and dry-run tests**

Scenarios:

1. fuzzy question formation then knowledge reconstruction;
2. brainstorming from activity evidence, inventory-only asset, model knowledge, and permission-gated paper research;
3. Note proposal correction/natural confirmation/save receipt;
4. Plan-created Problem Card proposal without answer leakage;
5. focus start silence, manual end, elapsed end, and Session-end cleanup;
6. Plan calendar appointment and review appointment launch;
7. recall Note direct review and Problem Card re-hidden answer;
8. batch Free review with one untouched item;
9. Lesson absorbs one relevant due asset and records only after cold retrieval.

- [ ] **Step 2: Run all focused M2 tests**

```bash
cd apps/pi-teaching-web
bun test tests/m2
```

- [ ] **Step 3: Run the complete repository verification**

```bash
cd apps/pi-teaching-web
bun run check
cargo test --manifest-path src-tauri/Cargo.toml
bun run desktop:prepare
bun run desktop:smoke
```

Expected: typecheck, all Bun tests, Vite build, Rust tests, packaged resources, and sidecar smoke all exit 0.

- [ ] **Step 4: Run real-model acceptance using release model configuration**

Record first-hit behavior, student-visible wait states, tool use, durable diffs, and wall time in the report. Required gates:

- no method or asset saving is forced into ordinary dialogue;
- paper search never runs without model-observed student permission and failure leaves the conversation usable;
- proposals do not write, Problem Card proposals do not reveal answers, and natural confirmation saves the latest draft;
- focus start is silent and focus end asks for actual progress without claiming attention/mastery;
- calendar opens only the intended Plan or Free Learning;
- direct and guided review preserve cold-attempt, revision, same-day, and untouched-item boundaries;
- no automatic object-memory, course-state, or mastery write occurs.

- [ ] **Step 5: Build and smoke the real macOS DMG**

```bash
cd apps/pi-teaching-web
bun run desktop:build
bun run desktop:verify
```

Install/open the generated DMG, verify one-instance behavior, local timer sound/notification, notification click, calendar persistence across restart, review persistence/index rebuild, and the existing Peer/Live2D path. Record any environment-only blocker honestly; do not mark the plan complete if an in-scope product defect remains.

- [ ] **Step 6: Final diff audit and commit**

```bash
git status --short
git diff --check
git diff --stat HEAD~12..HEAD
git add apps/pi-teaching-web/scripts/m2-validation \
  apps/pi-teaching-web/docs/validation/m2-completion-protocol.md \
  apps/pi-teaching-web/docs/validation/m2-completion-report.md \
  apps/pi-teaching-web/package.json \
  docs/superpowers/plans/2026-08-12-m2-completion.md
git commit -m "test: validate the complete M2 learning loop"
```

Do not stage the three scratch directories. Confirm `git status --short` contains only those ignored/untracked scratch paths, or is otherwise clean.
