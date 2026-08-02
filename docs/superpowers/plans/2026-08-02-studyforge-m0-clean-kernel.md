# StudyForge M0 Clean Teaching Kernel Implementation Plan

> **Execution rule:** implement this plan in order on an isolated worktree. Use TDD for runtime and UI behavior. Skill/prompt prose is reviewed by inspection and real-class acceptance, not by brittle wording assertions.

**Goal:** Replace the accumulated StudyForge teaching runtime with the approved M0 baseline: Roadmap → Plan → Lesson, native Pi sessions, Block-local classroom logs, direct Markdown reads, and no derived memory system.

**Architecture:** Keep the working Pi provider/session shell and the visual application shell, but replace the teaching-domain core. Markdown files are the only teaching state. Runtime owns only session restoration, student-triggered lifecycle transitions, routing, and raw event transport. Agents use Pi's native `read`, `grep`, `find`, `ls`, `edit`, and `write` tools against the learning-set root.

**Tech stack:** Bun, TypeScript, React 19, Vite, Pi coding-agent packages, YAML, React Markdown, KaTeX, Playwright.

**Design source:** `docs/superpowers/specs/2026-08-02-m0-document-native-memory-ablation-design.md`

---

## Global constraints

1. Do not add a legacy/M0 mode switch. M0 is the only Pi App path on this branch.
2. Do not migrate old Trace, Handoff, profile, BKT, evidence, Context Frame, or safety-projection data.
3. Do not modify the Claude Code plugin during this implementation.
4. Preserve `cards/`, `graph/`, and `materials/` as static assets.
5. A node's status exists only in that node's frontmatter.
6. Parents may edit only `prepared` children; an active/finished child is read-only to its parent.
7. Model-facing tools are the native filesystem tools. Lifecycle transitions remain deterministic student actions.
8. No silent fallback: invalid Markdown must identify the file and reason.
9. Do not write automated tests that assert exact Skill prose. Test observable contracts instead.
10. Do not touch unrelated untracked files already present on `main`.

## Intended M0 data flow

```text
student opens a node
  → runtime resolves node path and stable session key
  → Pi restores or creates that node's native session
  → static role prompt + LEARNING_GUIDE.md + node path are loaded
  → agent reads the node/children/assets with native file tools
  → agent edits Markdown directly
  → server emits raw Pi conversation/tool events
  → UI rereads Markdown snapshots after filesystem-changing turns
```

```text
Lesson closed by student
  → deterministic frontmatter transition active → closed
  → return to original Plan session
  → Planner reads the full lesson.md
  → Planner edits only a future prepared Lesson
```

---

## Task 0: Protect the full version and create an isolated implementation worktree

**Files:** none, except `.gitignore` only if `.worktrees/` is not already ignored.

1. Verify `main` is on the approved design commit and inspect the dirty tree.
2. Commit this implementation plan by itself.
3. Create an annotated rollback tag:

   ```bash
   git tag -a studyforge-full-before-m0-2026-08-02 -m "StudyForge full architecture before M0 ablation"
   ```

4. Verify `.worktrees/` is ignored. If not, add only `.worktrees/` to `.gitignore` and commit it.
5. Create branch and worktree:

   ```bash
   git worktree add .worktrees/studyforge-m0-clean-kernel -b codex/studyforge-m0-clean-kernel
   ```

6. In `apps/pi-teaching-web`, run `bun install` and the current `bun run check`. Record any pre-existing failure before editing.

**Exit condition:** rollback tag exists, worktree is isolated, and baseline result is known.

---

## Task 1: Define the M0 public surface and make legacy concepts unreachable

**Files:**

- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/shared/view-contracts.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/view-state.ts`
- Modify: `apps/pi-teaching-web/src/client/components/PrimaryViewNav.tsx`
- Add: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`
- Delete later with their consumers: Memory-specific routes/types/components.

### Step 1: Write the failing public-surface test

The test must prove:

- node kinds are exactly `roadmap | plan | lesson`;
- statuses are Plan `prepared | active | completed`, Lesson `prepared | active | closed`;
- session keys are `roadmap:<id> | plan:<id> | lesson:<id>`;
- model tool names are exactly Pi native `read`, `grep`, `find`, `ls`, `edit`, `write`;
- primary routes contain Course and Knowledge, but not Memory;
- no exported M0 contract contains `trace`, `handoff`, `evidence`, `ability`, `profile`, `contextPage`, `paused`, or `abandoned`.

Run:

```bash
bun test tests/m0/public-surface.test.ts
```

Expected: FAIL against the old surface.

### Step 2: Replace the contracts

Keep only contracts needed by:

- learning-set identity and guide;
- Roadmap/Plan/Lesson document snapshots;
- block state and Classroom Log;
- course tree;
- static knowledge assets;
- raw conversation and tool events;
- session/run state.

Do not retain deprecated aliases.

### Step 3: Make session scope native-tool-only

`session-scope.ts` should expose:

```ts
export type NodeKind = 'roadmap' | 'plan' | 'lesson';
export type NodeSessionScope = {
  nodeKind: NodeKind;
  nodeId: string;
  nodePath: string;
  parentId: string | null;
  parentPath: string | null;
};

export const M0_MODEL_TOOLS = ['read', 'grep', 'find', 'ls', 'edit', 'write'] as const;
export function sessionKeyForNode(scope: NodeSessionScope): SessionKey;
```

Delete `roleToolNames()` and `scopeToolNames()` branches for specialized StudyForge tools.

### Step 4: Remove Memory navigation and routing

Course and Knowledge remain. `/memory` must not be generated or presented. A stale `/memory` URL may redirect to `/course`; do not preserve a hidden Memory implementation.

### Step 5: Verify and commit

```bash
bun test tests/m0/public-surface.test.ts
rg -n "trace_append|lesson_prepare|plan_update|roadmap_update|memory_review|deep_workflow|source_resolve" src/shared src/runtime/session-scope.ts src/client/routes.ts src/client/view-state.ts
```

Expected: test passes; audit has no model-facing legacy tool references in the M0 surface.

Commit: `refactor: cut StudyForge M0 public surface`

---

## Task 2: Build the strict M0 Markdown domain

**Files:**

- Add: `apps/pi-teaching-web/src/study/markdown.ts`
- Add: `apps/pi-teaching-web/src/study/workspace.ts`
- Add: `apps/pi-teaching-web/src/study/knowledge.ts`
- Add: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/LEARNING_GUIDE.md`
- Add: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/ROADMAP.md`
- Add: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/plans/plan-001.md`
- Add: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/lessons/lesson-001.md`
- Add: minimal fixture files under `cards/`, `graph/`, and `materials/`
- Add: `apps/pi-teaching-web/tests/m0/markdown-domain.test.ts`

### Step 1: Specify canonical documents in fixtures

Frontmatter:

```yaml
# ROADMAP.md
id: roadmap
kind: roadmap
status: active
session_id: null

# plans/plan-001.md
id: plan-001
kind: plan
status: prepared
parent_id: roadmap
parent_path: ROADMAP.md
session_id: null

# lessons/lesson-001.md
id: lesson-001
kind: lesson
status: prepared
parent_id: plan-001
parent_path: plans/plan-001.md
session_id: null
```

Roadmap body sections: Overview, Long-term Goal, Observable Capability Standard, Test, Plan Tree, Current Position.

Plan body sections: Stage Goal, Observable Capability Standard, Test, Lesson Tree, Current Position, Next Lesson Arrangement.

Lesson body sections: Lesson Goal and one or more Blocks. Every Block has Node State, Student View, Teacher Control, and Classroom Log.

### Step 2: Write failing parser tests

Cover:

- valid fixture parses into typed snapshots;
- child links are resolved from Markdown links, not duplicated status text;
- status is taken from child frontmatter;
- Block order, dependencies, uses, Student View, Teacher Control, and log lines are preserved;
- missing required section, invalid enum, escaping path, duplicate ID, or malformed frontmatter throws `StudyDocumentError(path, reason)`;
- old Lesson sections such as Handoff or Activation Snapshot are rejected rather than adapted;
- `memory/` and `traces/` are ignored as non-M0 input and are not exposed.

Run and observe failure:

```bash
bun test tests/m0/markdown-domain.test.ts
```

### Step 3: Implement a local parser

Do not call the plugin's old `validatePlanDocument()` or other old strict domain readers. Use `yaml` for frontmatter plus small explicit Markdown section parsers.

Primary API:

```ts
export class StudyDocumentError extends Error {
  constructor(readonly path: string, readonly reason: string);
}

export function readRoadmap(root: string): RoadmapDocument;
export function readPlan(root: string, path: string): PlanDocument;
export function readLesson(root: string, path: string): LessonDocument;
export function readCourseTree(root: string): CourseSnapshot;
```

Path resolution must stay inside the learning-set root. This is correctness, not an elaborate permission layer.

### Step 4: Implement static knowledge reads

Reuse only stateless card/method-tree parsing if it does not attach Trace. Otherwise implement a small M0 adapter. Knowledge reads must never inspect `traces/`, profiles, BKT, or sessions.

```ts
export function readKnowledge(root: string): KnowledgeSnapshot;
```

### Step 5: Verify and commit

```bash
bun test tests/m0/markdown-domain.test.ts
```

Commit: `feat: add M0 Markdown teaching domain`

---

## Task 3: Replace context compilation with node-owned native Pi sessions

**Files:**

- Rewrite: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Rewrite: `apps/pi-teaching-web/src/runtime/session-owner.ts`
- Rewrite: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Rewrite: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/pi-extension.ts`
- Add: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Delete after replacement: `src/runtime/node-access.ts`, `node-context.ts`, `study-tools.ts`, `subagent-path.ts`, and specialized model mutation modules.

### Step 1: Write failing native-session tests

Use fakes for Pi session creation and prove:

- same node path restores the same persisted Pi session;
- different Roadmap/Plan/Lesson nodes never share session history;
- the system prompt contains shared math teaching guidance, the role resource, `LEARNING_GUIDE.md`, learning-set root, and current node path;
- it does not contain Plan/Lesson content, child summaries, traces, handoffs, profiles, context frames, or card search results;
- enabled tools are exactly the six native file tools;
- no cross-session transcript is copied;
- reopening after compaction still leaves the agent able to call `read` on the current node.

### Step 2: Implement minimal resource loading

```ts
export type StaticNodeResources = {
  systemPrompt: string;
  tools: readonly NativeToolName[];
};

export function loadStaticNodeResources(
  learningSetRoot: string,
  scope: NodeSessionScope,
): StaticNodeResources;
```

The prompt names files to read; it does not inline dynamic business documents.

### Step 3: Rebuild registry semantics

Registry responsibilities:

- map stable `SessionKey` to Pi session storage;
- create/restore session;
- expose raw history;
- stream raw Pi events;
- serialize one turn per session;
- persist the Pi session ID into the owning node's frontmatter when first created.

It must not project ability, evidence, memory, workflow, or student-safe messages.

### Step 4: Simplify the Pi extension

Register only what is necessary to expose the M0 app and native tools. Remove specialized StudyForge tool registration and workflow hooks from this runtime path.

### Step 5: Verify and commit

```bash
bun test tests/m0/native-session.test.ts
```

Commit: `refactor: use node-owned native Pi sessions`

---

## Task 4: Implement deterministic student-owned lifecycle transitions

**Files:**

- Add: `apps/pi-teaching-web/src/runtime/node-lifecycle.ts`
- Add: `apps/pi-teaching-web/tests/m0/node-lifecycle.test.ts`

### Step 1: Write failing transition tests

Cover:

- Plan `prepared → active → completed`;
- Lesson `prepared → active → closed`;
- all reverse or skip transitions fail with file-specific errors;
- transition modifies only the node's frontmatter status;
- starting a node allocates/restores its session but does not inject a generated message;
- closing a Lesson returns the Plan route and does not synthesize Reflection/Handoff/Summary;
- completing a Plan returns the Roadmap route;
- re-open/redo requires a new node rather than reopening a closed node.

### Step 2: Implement the transition writer

Use a focused frontmatter callback, not string replacement over the whole Markdown document:

```ts
export function transitionNode(
  root: string,
  nodePath: string,
  expected: NodeStatus,
  next: NodeStatus,
): void;
```

Preserve the entire Markdown body byte-for-byte.

### Step 3: Verify and commit

```bash
bun test tests/m0/node-lifecycle.test.ts
```

Commit: `feat: add M0 node lifecycle`

---

## Task 5: Replace the server with a minimal M0 API and raw event transport

**Files:**

- Rewrite: `apps/pi-teaching-web/src/server/app.ts`
- Simplify: `apps/pi-teaching-web/src/server/event-hub.ts`
- Modify: `apps/pi-teaching-web/src/server/index.ts`
- Add: `apps/pi-teaching-web/src/projection/conversation.ts`
- Add: `apps/pi-teaching-web/tests/m0/server-api.test.ts`
- Delete after replacement: old projection, workflow, memory-review, ability/evidence APIs and modules.

### Step 1: Write failing API tests

Required endpoints:

```text
GET  /api/health
GET  /api/course
GET  /api/knowledge
GET  /api/sessions/:sessionKey/history
POST /api/sessions/:sessionKey/messages
POST /api/plans/:planId/start
POST /api/plans/:planId/complete
POST /api/lessons/:lessonId/start
POST /api/lessons/:lessonId/close
GET  /events                         (WebSocket upgrade)
```

Assert that old `/api/views/memory`, `/api/abilities`, memory review, replay evidence, and specialized mutation endpoints return 404.

### Step 2: Preserve raw assistant output

The only conversation normalization should convert Pi's raw events to stable transport records:

```ts
type ConversationItem =
  | { kind: 'user'; text: string; at: string }
  | { kind: 'assistant'; text: string; at: string }
  | { kind: 'tool'; name: string; status: 'running' | 'done' | 'error'; detail: unknown };
```

Do not rewrite tool results into teacher speech. Do not suppress a final assistant message. Tool details are collapsible in the client.

### Step 3: Refresh snapshots after edits

At the end of a turn that used `edit` or `write`, publish `course-invalidated` and/or `knowledge-invalidated`. The client rereads Markdown; the server does not infer semantic deltas.

### Step 4: Verify and commit

```bash
bun test tests/m0/server-api.test.ts
```

Commit: `refactor: expose minimal M0 teaching API`

---

## Task 6: Rebuild the student UI around Course and raw chat

**Files:**

- Rewrite: `apps/pi-teaching-web/src/client/api.ts`
- Rewrite: `apps/pi-teaching-web/src/client/state.ts`
- Rewrite: `apps/pi-teaching-web/src/client/App.tsx`
- Rewrite: `apps/pi-teaching-web/src/client/pages/CoursePage.tsx`
- Rewrite: `apps/pi-teaching-web/src/client/pages/FocusedClassroomPage.tsx`
- Rewrite as needed: `AppShell.tsx`, `ChatPanel.tsx`, `CourseTree.tsx`, `ActivityDrawer.tsx`, `MarkdownView.tsx`
- Remove: Memory/evidence/ability/context/replay/persona UI modules not used by M0
- Consolidate: `styles.css`, `styles/course.css`, `styles/classroom.css`, `styles/knowledge.css`, `styles/responsive.css`
- Add: `apps/pi-teaching-web/tests/m0/course-ui.test.tsx`

### Step 1: Write failing UI tests

Prove:

- `/course` opens Roadmap and restores its chat;
- selecting Plan or Lesson changes route and loads that node's own chat;
- Roadmap → Plan → Lesson tree status comes from child frontmatter;
- chat is the widest column; side rails collapse at desktop and disappear behind drawers on narrow screens;
- start/close/complete controls belong to the student UI;
- closing Lesson navigates to its Plan; completing Plan navigates to Roadmap;
- Assistant final text is rendered exactly once and unchanged;
- tool events are visible in a collapsed activity drawer;
- Memory navigation does not exist;
- Teacher Control is not shown in the normal student classroom panel;
- current Block and Block progress are derived from lesson.md.

### Step 2: Build a small route state

Use URL as the source of selection:

```text
/course
/course/plan/:planId
/course/plan/:planId/lesson/:lessonId
/knowledge
```

Refresh must restore the same node and session.

### Step 3: Rebuild Course page

Desktop composition:

```text
collapsible course tree | dominant chat/classroom | collapsible document/activity rail
```

Roadmap and Plan views show their public Markdown sections plus chat. Lesson view shows Student View, current Block, progress, and chat. Full source remains reachable through a secondary local-document action, not injected into the chat.

### Step 4: Verify and commit

```bash
bun test tests/m0/course-ui.test.tsx
```

Commit: `feat: rebuild M0 course workspace`

---

## Task 7: Keep Knowledge as a static asset browser

**Files:**

- Rewrite: `apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx`
- Reuse/simplify: `MethodLandscape.tsx`, `MethodInspector.tsx`, `ContentExplorer.tsx`
- Add: `apps/pi-teaching-web/tests/m0/knowledge-ui.test.tsx`

### Step 1: Write failing tests

Assert that Knowledge can:

- show the method graph;
- filter and inspect cards/materials;
- open a source path;
- operate when no Plan or Lesson exists;
- show no personal mastery, trace history, evidence count, BKT state, or learning recommendation.

### Step 2: Implement the static view

Retain the current visual language, but remove personal overlays and their legends. Search is ordinary static asset search, not a memory-recall service.

### Step 3: Verify and commit

```bash
bun test tests/m0/knowledge-ui.test.tsx
```

Commit: `refactor: make Knowledge a static asset view`

---

## Task 8: Rewrite role prompts and teaching Skills for direct document work

**Files:**

- Rewrite: `apps/pi-teaching-web/resources/agents/roadmap-node.md`
- Rewrite: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Rewrite: `apps/pi-teaching-web/resources/agents/lesson-node.md`
- Rewrite: `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Rewrite: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Rewrite: `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
- Rewrite: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Retain only if independently useful: `resources/teaching/math-teaching-core.md`
- Remove from M0 registration: deep workflow and Study Scout resources.

### Step 1: Rewrite Roadmap behavior

Required behavior:

- first introduce the learning set's purpose, scope, and value in natural language;
- then ask one useful diagnostic question at a time;
- read `ROADMAP.md`, completed Plan files, and needed Lesson files directly;
- arrange only future prepared Plans;
- never claim a derived memory, evidence grade, or profile update.

### Step 2: Rewrite Planner behavior

Required behavior:

- ask enough specific questions to understand the requested lesson;
- turn broad complaints into a concrete structure/type/stop point;
- read its own Plan and all completed prior Lessons before planning the next Lesson;
- privately inspect cards/graph/materials with native tools;
- do not leak solution steps merely because it selected a card;
- never silently reduce agreed lesson content; ask the student if materials do not fit;
- edit only prepared Lessons.

### Step 3: Rewrite Tutor behavior

Required behavior:

- read current Lesson and referenced assets;
- teach through Blocks;
- append actual dialogue, support, correction, and decisions to the current Block's Classroom Log;
- use progressive hints based on what the student actually needs, not rigid phrase gates;
- verify alternative routes before correcting them;
- ask the student when method-node binding is uncertain;
- do not dump a standard solution after a valid alternative;
- let the student decide when to close the Lesson.

### Step 4: Remove obsolete vocabulary

Audit:

```bash
rg -n "Trace|Handoff|Claim|BKT|Planner Attention|Context Frame|安全投影|memory_review|source_resolve|lesson_prepare|classroom_update|lesson_close|supersede" apps/pi-teaching-web/resources
```

Every remaining match must be removed or justified as historical documentation outside runtime resources.

Do not add exact-wording tests. Review the full prompt assembly in a session-factory test and then validate prose in a real class.

Commit: `refactor: teach from native M0 documents`

---

## Task 9: Migrate the derivative demo and delete the superseded runtime

**Files:**

- Move: `examples/derivative-demo` → `examples/derivative-m0`
- Rewrite: demo `LEARNING_GUIDE.md` and `ROADMAP.md`
- Add: a clean prepared Plan and Lesson suitable for smoke testing
- Remove from demo: `memory/`, `traces/`, old plans/lessons, generated audit artifacts
- Delete old app modules and tests with no M0 consumer
- Update: package/runtime docs that point the Pi App at the demo
- Add: `apps/pi-teaching-web/tests/m0/derivative-demo.test.ts`

### Step 1: Preserve static assets without duplication

Use `git mv` for the demo root, then retain cards, graph, and allowed materials. Do not copy the 5.8 MB card set into a second directory.

### Step 2: Build a clean learning set

The demo starts with an honest Roadmap and either:

- no Plan, allowing Roadmap diagnosis to create one; or
- one `prepared` smoke Plan/Lesson clearly marked as test content.

It must not contain claims from old synthetic acceptance classes.

### Step 3: Delete the old implementation surface

Delete modules only after all imports have moved. Expected families include:

- `src/memory-review/**`;
- `src/workflows/**`;
- ability/evidence/handoff/context-frame/projection modules;
- specialized mutation tools;
- Memory/evidence/ability/replay UI;
- their old tests.

Do not leave compatibility shims that make legacy behavior callable.

### Step 4: Write and run the demo audit

The test verifies:

- required M0 files/directories exist;
- no `memory/` or `traces/` directory exists;
- Roadmap, Plan, Lesson parse under the M0 domain;
- cards and graph remain readable;
- runtime resources contain no old model tool names.

Run:

```bash
bun test tests/m0/derivative-demo.test.ts
bun run typecheck
```

Commit: `refactor: replace demo with clean M0 learning set`

---

## Task 10: End-to-end closure and browser acceptance

**Files:**

- Rewrite/add: `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`
- Update: `apps/pi-teaching-web/README.md`
- Update: root `README.md` and `AGENTS.md` to describe the implemented M0 only
- Add: `docs/audits/2026-08-02-m0-implementation-acceptance.md`

### Step 1: Add deterministic browser flow

Fixture-backed Playwright flow:

1. open Roadmap;
2. send a diagnostic message and observe unmodified assistant text;
3. start a prepared Plan;
4. start a prepared Lesson;
5. inspect Block progress and tool activity;
6. close the Lesson and return to the Plan;
7. refresh and verify route/session restoration;
8. complete Plan and return to Roadmap;
9. open Knowledge and inspect a static card/method;
10. verify no Memory page or old endpoint is reachable.

### Step 2: Run full verification

```bash
cd apps/pi-teaching-web
bun run typecheck
bun test --path-ignore-patterns='tests/e2e/**'
bun run build
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Then repository audits:

```bash
rg -n "trace_append|trace_search|Handoff|Planner Attention|BKT|Context Frame|memory_review|source_resolve|lesson_prepare|classroom_update|lesson_close" apps/pi-teaching-web examples/derivative-m0
find examples/derivative-m0/learning-set -maxdepth 2 -type d | sort
git diff --check
git status --short
```

Runtime code/resource matches must be zero; documentation may mention removed concepts only in the design and acceptance report.

### Step 3: Manual local smoke

Start the app against `examples/derivative-m0/learning-set`, then verify in the browser:

- conversation is the visual center;
- the learning-set introduction precedes diagnosis;
- replying to a diagnosis produces a normal teacher response, not an internal-material status message;
- native tool activity is inspectable but not substituted for the teacher reply;
- direct Markdown edits appear after invalidation;
- refresh restores node route and chat.

### Step 4: Record implementation truth

The acceptance report must list:

- deleted subsystems;
- surviving responsibilities;
- exact verification commands and results;
- any observed limitation;
- the prescribed real-course cycle (6 Lessons + a new 2–3 Lesson Plan), explicitly marked as subsequent empirical validation rather than silently claimed complete.

Commit: `docs: close StudyForge M0 implementation`

---

## Execution checkpoints

### Checkpoint A — teaching-domain kernel

After Tasks 1–4:

- M0 documents parse;
- node sessions are isolated and restorable;
- only native file tools reach the model;
- student lifecycle transitions work;
- no model-facing legacy API remains.

### Checkpoint B — usable local app

After Tasks 5–8:

- server transports raw conversations;
- Course and Knowledge work;
- direct-file teaching prompts are installed;
- the strange “internal material verification” response path no longer exists.

### Checkpoint C — clean replacement

After Tasks 9–10:

- old app implementation is deleted, not hidden;
- clean derivative demo loads;
- automated and browser checks pass;
- repository docs match the running software.

## Post-implementation empirical validation

After the code merge, reinstall the local Pi App and run:

```text
Roadmap diagnosis
→ Plan 1 with 6 real Lessons
→ return to Roadmap
→ Plan 2 with 2–3 real Lessons
```

For every proposed new memory mechanism, record the exact repeated failure and source Lesson/Block. Add M1 only if the same direct-read limitation appears in at least two real Lessons. Do not reintroduce a mechanism merely because the old version had it.
