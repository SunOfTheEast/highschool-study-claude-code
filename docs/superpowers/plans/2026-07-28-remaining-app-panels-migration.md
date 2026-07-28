# Remaining App Panels Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reimplement the four valuable product-panel slices from the stale app branch on current `main`: a pinned classroom stage and context rail, safe asset exploration, a continue-first home, and a persona/display drawer.

**Architecture:** Build each feature as an independently testable vertical slice over current Markdown facts, active Trace, Pi Session ownership, and existing projections. Reuse the present Plan workspace and route shell; do not merge or cherry-pick `codex/app-function-panels`. Auxiliary projections may fail independently without blocking the active Coach/Tutor conversation.

**Tech Stack:** Bun 1.3.14, TypeScript 7, React 19.2.8, Vite 8.1.5, Pi 0.81.0, TypeBox 1.3.6, Bun test, Playwright 1.61.1.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-28-remaining-app-panels-migration-design.md`.
- Implement on current `main`; the old panel branch is reference only.
- Keep exactly four top-level browser routes and four public Claude MCP tools.
- Do not add a database, background index, vector store, compatibility layer, or dependency.
- UI projections never decide mastery, modify Plan/Lesson, advance Blocks, or write Trace.
- Prepared and pending Blocks must not expose Student View, cards, answers, Teacher Control, unrevealed hints, or alternatives.
- Card results always carry complete active Trace history; superseded Trace is excluded.
- Roadmap Coach does not receive the content explorer in this release.
- Technical identifiers remain Coach/Tutor; student-facing copy uses 学习总览、学习顾问、课堂导师、学习记录、方法进展、记录来源、深入查找、研习资料、陪伴风格.
- Preserve the Plan memory-review chat card as a separate feature and timeline item.
- Do not add tests for exact Skill prose or exact UI copy; test structure, state, safety, persistence, and behavior.

---

### Task 1: Pinned ActivityBlock stage and stacked context rail

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/read-workspace.ts`
- Modify: `apps/pi-teaching-web/src/study/student-notebook.ts`
- Create: `apps/pi-teaching-web/src/study/coach-context.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/src/client/components/CurrentActivityStage.tsx`
- Create: `apps/pi-teaching-web/src/client/components/ContextSection.tsx`
- Create: `apps/pi-teaching-web/src/client/components/ContextStack.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/LessonNotebook.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/AbilityMap.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/TaskRail.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/student-notebook.test.ts`
- Create: `apps/pi-teaching-web/tests/study/coach-context.test.ts`
- Create: `apps/pi-teaching-web/tests/client/current-activity-stage.test.tsx`
- Create: `apps/pi-teaching-web/tests/client/context-stack.test.tsx`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Extends `PlanSummary`:

```ts
currentPosition: string;
nextLessonCandidate: string;
planSummary: string;
```

- Adds:

```ts
export type LearningRecordSummary = {
  source: string;
  lessonId: string;
  blockId: string;
  assessment: string;
  support: string;
  note: string;
};

export type CoachContextView = {
  currentPosition: string;
  nextLessonCandidate: string;
  planSummary: string;
  plannerAttention: string;
  priorLessons: Array<{
    lessonId: string;
    title: string;
    summary: string;
    source: string;
  }>;
};
```

- Extends `StudentNotebook` with `recentRecords: LearningRecordSummary[]`.
- Adds `readCoachContext(root, planId): CoachContextView`.

- [ ] **Step 1: Write failing student-projection tests**

Assert that `readPlanWorkspace` returns the three Plan review sections and that
`readStudentNotebook`:

- preserves every Block title/status;
- exposes Student View only for active/completed Blocks;
- leaves prepared/pending Student View empty for every template;
- returns cards only for active/completed Block aliases;
- returns only current-Lesson active Trace in `recentRecords`.

Use:

```ts
expect(notebook.lesson.blocks.find((block) => block.id === 'future')?.studentView).toBe('');
expect(notebook.cards).not.toHaveProperty('FUTURE_CARD');
expect(notebook.recentRecords.every((record) => record.lessonId === 'lesson-003')).toBe(true);
```

- [ ] **Step 2: Run study tests and verify the red state**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts \
  tests/study/student-notebook.test.ts \
  tests/study/coach-context.test.ts
```

Expected: FAIL because Plan review fields, recent records, and Coach context are absent.

- [ ] **Step 3: Implement safe Notebook and Coach context projections**

Change Student View projection to:

```ts
function projectedStudentView(blockStatus: BlockStatus, value: string): string {
  return blockStatus === 'active' || blockStatus === 'completed' ? value : '';
}
```

Build `recentRecords` from `readActiveTraces(root, [lesson.path])`, newest first. Build Coach
context from the true Plan sections, `memory/planner-attention.md`, and closed Lesson summaries.
Every prior Lesson summary carries its exact `lessons/...md#lesson-summary` source.

- [ ] **Step 4: Write failing stage and context component tests**

For `CurrentActivityStage`, assert:

```ts
expect(html).toContain('当前课堂');
expect(html).toContain('active-card-stem');
expect(html).not.toContain('pending-card-stem');
expect(html).not.toContain('Teacher Control');
```

For `ContextStack`, assert Coach, Tutor, and Replay views contain only their designed section
labels and that only the first section has `open=""`.

- [ ] **Step 5: Implement the focused components**

`CurrentActivityStage` selects only:

```ts
const active = notebook?.lesson.blocks.find((block) => block.status === 'active') ?? null;
```

Render the active Block and the cards referenced by `active.uses`. If there is no active Block,
render an orientation state; never choose pending automatically.

`ContextStack` composes existing `LessonNotebook`, `AbilityMap`, `TaskRail`, replay, and the new
Coach context. Add `embedded` props to remove nested outer `<aside>` and duplicate headings.
`LessonNotebook` must never render pending content, and it must omit the active Block body when the
same body is already in the stage.

- [ ] **Step 6: Expose Coach context and wire the workspace**

Add:

```text
GET /api/plans/:planId/context
```

In `App`, load it only for the selected Plan Coach. Put `CurrentActivityStage` above the Tutor
timeline and replace the single right-side Notebook/Ability choice with `ContextStack`.
Prepared Lesson keeps the start gate and title-only Block preview; paused Lesson keeps the stage
visible but disables the composer until the student resumes.

- [ ] **Step 7: Refresh only from successful facts**

Reuse current `snapshot`, `activity`, and `ability-update` events. Refetch Notebook/Coach context
after the selected Lesson object or owning Plan snapshot changes. Do not add optimistic completion
or a second event log.

- [ ] **Step 8: Run focused tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts \
  tests/study/student-notebook.test.ts \
  tests/study/coach-context.test.ts \
  tests/client/current-activity-stage.test.tsx \
  tests/client/context-stack.test.tsx \
  tests/server/workspace-api.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit the classroom workspace slice**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests
git commit -m "feat: add focused classroom workspace"
```

---

### Task 2: Student-safe asset and Trace explorer

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/student-notebook.ts`
- Create: `apps/pi-teaching-web/src/study/content-explorer.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/src/client/components/ContentExplorer.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/SessionTree.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Create: `apps/pi-teaching-web/tests/study/content-explorer.test.ts`
- Create: `apps/pi-teaching-web/tests/client/content-explorer.test.tsx`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Produces:

```ts
export type ContentSearchHit = {
  kind: 'card' | 'method' | 'material';
  id: string;
  title: string;
  subtitle: string;
  source: string;
  matchedBy: 'asset' | 'trace';
  matchReason: string;
  traceHistory: LearningRecordSummary[];
  card: StudentProblemCard | null;
  preview: string | null;
};

export type ContentSearchResult = {
  query: string;
  hits: ContentSearchHit[];
};

export function searchStudentContent(
  root: string,
  input: { query: string; sessionKey: SessionKey; limit: number },
): ContentSearchResult;
```

- Exports `readStudentProblemCard(root, cardPath)` from `student-notebook.ts`.

- [ ] **Step 1: Write failing search-scope tests**

Build fixtures containing:

- one active card, one pending card, and one completed card;
- one material per state;
- active and superseded Trace;
- a Trace note containing a unique query term.

Assert:

```ts
const tutor = searchStudentContent(root, {
  query: 'unique-trace-term',
  sessionKey: 'tutor:lesson-003',
  limit: 20,
});
expect(tutor.hits[0]).toMatchObject({
  kind: 'card',
  matchedBy: 'trace',
  source: 'cards/visible.card.yaml',
});
expect(tutor.hits[0]?.traceHistory).toHaveLength(2);
expect(JSON.stringify(tutor)).not.toContain('superseded-event');
expect(JSON.stringify(tutor)).not.toContain('pending-card');
```

Also assert Plan Coach and closed Replay can search the full student-safe asset set, while
`coach:@roadmap` is rejected.

- [ ] **Step 2: Run the study search test and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/content-explorer.test.ts
```

Expected: FAIL because the explorer does not exist.

- [ ] **Step 3: Implement deterministic entity and Trace search**

Use existing `searchCards`, `listCanonicalMethodNames`, `readActiveTraces`,
`readLessonAliases`, and root-safe path resolution.

The ranking order is:

1. direct asset text/title/path match;
2. active Trace note/Lesson/Block/method match mapped back to its real `cardPath`;
3. stable source-path tie-break.

Deduplicate by `kind + source`. A card hit always attaches all active Trace for that card, even if
only one Trace matched the query.

For active/paused Tutor, derive allowed assets only from active/completed Blocks and current-Lesson
active Trace. Never inspect non-empty pending Student View as permission.

- [ ] **Step 4: Add safe material and method previews**

Read only text-like material extensions (`.md`, `.txt`, `.json`, `.yaml`, `.yml`, `.csv`,
`.html`). Return a short matching excerpt, not the full file. Binary/video results return title,
path, and metadata without file contents. Method results return canonical node names and related
Trace; do not expose private matrices or stored alternatives.

- [ ] **Step 5: Write failing API and component tests**

Assert:

- missing query returns an empty result;
- invalid/Tutor/Roadmap scope gets a stable 4xx response;
- the component has one search field, type filters, result list, detail pane, exact source, and
  “相关学习记录”;
- empty results display an authentic empty state;
- selecting a Trace calls the existing Evidence Lens callback.

- [ ] **Step 6: Expose the Session-scoped endpoint**

Add:

```text
GET /api/content-search?query=<text>&sessionKey=<encoded>&limit=20
```

The server derives all permissions from the real Session key and owner. Do not accept a scope or
“full search” flag from the client.

- [ ] **Step 7: Implement the two-pane overlay**

Use one result list and one detail pane on desktop; use list/detail navigation on narrow screens.
Keep filter state local. Preserve query, selected result, and scroll while the Evidence Lens opens
and closes. Closing the explorer restores the original Session URL and chat scroll.

- [ ] **Step 8: Run focused tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/content-explorer.test.ts \
  tests/client/content-explorer.test.tsx \
  tests/server/workspace-api.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit the explorer slice**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests
git commit -m "feat: add safe learning asset explorer"
```

---

### Task 3: Continue-first learning-set home

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/study/home.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Create: `apps/pi-teaching-web/tests/study/home.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/learning-set-home.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/routes.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Produces:

```ts
export type HomeContinueTarget = {
  route: string;
  kind: 'roadmap' | 'coach' | 'lesson';
  planId: string | null;
  lessonId: string | null;
  title: string;
  detail: string;
};

export type HomeSnapshot = {
  learningSet: LearningSetSnapshot;
  currentPlan: PlanSummary | null;
  eligibleContinueRoutes: string[];
  continueTarget: HomeContinueTarget;
  lessonProgress: { completed: number; total: number };
  coachNote: string;
  signals: Array<{ label: string; value: string; source: string | null }>;
  recentReplay: null | { lessonId: string; title: string; route: string };
};

export function readHomeSnapshot(root: string): HomeSnapshot;
export function resolveContinuePath(home: HomeSnapshot, savedPath: string | null): string;
```

- [ ] **Step 1: Write failing continuation-order tests**

Cover:

```ts
active lesson > paused lesson > prepared lesson > active Plan Coach
unfinished Plan Coach > first Roadmap setup
all Plans completed > Roadmap next-stage planning
```

Assert a saved route is accepted only if it points to an eligible unfinished Plan Coach or an
active/paused/prepared Lesson. Closed/abandoned Lesson and completed Plan Coach routes must fall
back.

- [ ] **Step 2: Run home tests and verify failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/home.test.ts tests/client/routes.test.ts
```

Expected: FAIL because `HomeSnapshot` and continuation resolution do not exist.

- [ ] **Step 3: Implement the deterministic home projection**

Read the current Roadmap and Plan workspaces. Do not call a model. Build:

- Coach note from `nextLessonCandidate`, then `currentPosition`, then `planSummary`;
- progress from real Lesson status;
- at most two recent signals from newest active Trace plus ability state;
- recent replay from the latest closed Lesson;
- a Roadmap target when no active/unfinished Plan exists.

`eligibleContinueRoutes` contains only routes allowed by the saved-route rule.

- [ ] **Step 4: Add `GET /api/home` and client types**

Return one `HomeSnapshot`. Keep `/api/learning-set` for existing callers and Roadmap events.

- [ ] **Step 5: Write failing home-component tests**

Assert:

- exactly one primary continue button;
- current stage and Coach note appear;
- recent signals and replay are omitted when absent;
- other Plans and 学习总览 remain secondary;
- no large ability map or workflow history appears.

- [ ] **Step 6: Recompose `LearningSetHome`**

Use a poster-like first viewport with one action:

```tsx
<button className="continue-entry" onClick={() => onContinue(continuePath)}>
  <small>继续学习</small>
  <strong>{value.continueTarget.title}</strong>
  <span>{value.continueTarget.detail}</span>
</button>
```

Below it render compact progress, Coach-written next step, latest signals, replay, other Plans,
learning overview, and principles. Use dividers and typography rather than a dashboard-card grid.

- [ ] **Step 7: Persist only successful eligible routes**

After successful navigation to an unfinished Plan Coach or active/paused/prepared Lesson:

```ts
localStorage.setItem('studyforge.lastVisitedRoute', formatBrowserRoute(route));
```

Never save Home, Roadmap, closed Replay, or failed routes. On Home, call
`resolveContinuePath(snapshot, savedValue)`.

- [ ] **Step 8: Run focused tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/home.test.ts \
  tests/client/learning-set-home.test.tsx \
  tests/client/routes.test.ts \
  tests/server/workspace-api.test.ts
```

Expected: PASS.

- [ ] **Step 9: Commit the home slice**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests
git commit -m "feat: add continue-first learning home"
```

---

### Task 4: Persona preview and display-preference drawer

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/persona.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/src/client/presentation.ts`
- Create: `apps/pi-teaching-web/src/client/components/PersonaDrawer.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/SessionTree.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/RoadmapCoachShell.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/AbilityMap.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/EvidenceLens.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/TaskRail.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/src/client/theme-liubai.css`
- Modify: `plugins/highschool-study/skills/enter-learning-set/references/personas/neutral-tutor.md`
- Modify: `plugins/highschool-study/skills/enter-learning-set/references/personas/calm-senpai.md`
- Modify: `plugins/highschool-study/skills/enter-learning-set/references/personas/energetic-classmate.md`
- Modify: `apps/pi-teaching-web/tests/study/persona.test.ts`
- Create: `apps/pi-teaching-web/tests/client/presentation.test.ts`
- Create: `apps/pi-teaching-web/tests/client/persona-drawer.test.tsx`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Replaces each persona choice with:

```ts
export type PersonaChoice = {
  id: string;
  name: string;
  description: string;
  glyph: string;
  accent: string;
  portraitUrl: string | null;
};
```

- Adds:

```ts
export type PresentationPreferences = {
  motion: 'gentle' | 'reduced';
  completionFeedback: boolean;
};

export function readPresentationPreferences(
  storage: Pick<Storage, 'getItem'>,
  reducedMotion: boolean,
): PresentationPreferences;

export function writePresentationPreferences(
  storage: Pick<Storage, 'setItem'>,
  value: PresentationPreferences,
): void;
```

- [ ] **Step 1: Write failing persona-discovery tests**

Create one `.claude/personas/custom-guide.md` with:

```markdown
# Custom Guide

- ID: `custom-guide`
- Display name: 自定义学伴
- Student preview: 先听完整思路，再给一个短提示。
- Glyph: 伴
- Accent: #48636f
- Portrait: `.claude/personas/assets/custom-guide.webp`
```

Assert built-ins plus custom are discovered, a same-ID local file overrides the bundled persona,
and mismatched file name/ID or an outside-root Portrait is rejected. Missing optional metadata
uses a neutral description, the first display-name character, the default accent, and null
portrait.

- [ ] **Step 2: Implement Markdown-first persona presentation discovery**

Keep `resolvePersona` for prompt content. Add `personaChoices(root)` which merges the three bundled
IDs with `.claude/personas/*.md`, parses only the explicit public metadata labels, and produces
stable sorted choices. Internal prompt bullets never become `description`.

Add a root-safe portrait endpoint:

```text
GET /api/personas/:id/portrait
```

It serves only the discovered local file for that ID and supports PNG/JPEG/WebP.

- [ ] **Step 3: Write failing display-preference and drawer tests**

Assert:

```ts
expect(readPresentationPreferences(emptyStorage, false)).toEqual({
  motion: 'gentle',
  completionFeedback: true,
});
expect(readPresentationPreferences(emptyStorage, true).motion).toBe('reduced');
```

The drawer test must show choice name, description, glyph/palette or portrait, current state, and
the two toggles. It must not contain internal prompt instructions.

- [ ] **Step 4: Implement browser-local presentation preferences**

Use one key, `studyforge.presentation.v1`. Invalid JSON returns the defaults; system reduced-motion
always forces effective motion to `reduced`. Do not write these values to Session or Markdown.

- [ ] **Step 5: Replace the persona select with the drawer**

The chat-header avatar opens `PersonaDrawer`. Selecting a choice calls the existing Session-scoped
persona API; close only after a successful response. The visual accent updates immediately from
the returned current choice. Historical messages remain unchanged.

Render a one-time gentle completion response only when an ActivityBlock transitions from active to
completed and `completionFeedback` is true. Do not trigger for skipped, close-only, initial load,
or Replay hydration.

- [ ] **Step 6: Apply the student-facing terminology table**

Change only visible labels:

```text
Roadmap Coach → 学习总览
Plan Coach → 学习顾问
Tutor → 课堂导师
Evidence → 学习记录
Ability Map → 方法进展
Evidence Lens → 记录来源
Deep workflow → 深入查找
Content Explorer → 研习资料
Persona → 陪伴风格
```

Do not rename types, routes, Session keys, test fixture IDs, raw events, or diagnostic output.

- [ ] **Step 7: Run focused tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/persona.test.ts \
  tests/client/presentation.test.ts \
  tests/client/persona-drawer.test.tsx \
  tests/server/workspace-api.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the presentation slice**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests \
  plugins/highschool-study/skills/enter-learning-set/references/personas
git commit -m "feat: add companion style drawer"
```

---

### Task 5: Integrated browser acceptance and product documentation

**Files:**
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Modify: `docs/zh-CN/完整说明书.md`
- Create: `docs/audits/2026-07-28-app-panels-migration-acceptance.md`

**Interfaces:**
- No new runtime interface.

- [ ] **Step 1: Extend the E2E fixture with all four panel states**

The fixture must provide:

- one unfinished Plan with prepared, active, paused, closed, and abandoned Lessons;
- one active Block and one pending Block with different cards;
- current and superseded Trace;
- one material and method result;
- one custom persona;
- a valid Home snapshot and recent Replay.

- [ ] **Step 2: Add the integrated Playwright flow**

The browser test must:

1. open Home and verify one primary continue action;
2. enter the active Lesson;
3. see the active card in the fixed stage and not see pending content;
4. open/close the context sections;
5. search by Trace note and open the bound card plus complete active history;
6. confirm pending content is absent;
7. open the source lens and return to the same search;
8. switch companion style and refresh the Session;
9. pause/resume and verify the stage persists;
10. open a closed Replay and confirm it never becomes the saved continue target.

- [ ] **Step 3: Run the complete app checks**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e
```

Expected: typecheck, all unit tests, production build, and Playwright PASS.

- [ ] **Step 4: Run the plugin release boundary**

Run:

```bash
cd plugins/highschool-study
bun run release:check
```

Expected: PASS with exactly four public MCP tools.

- [ ] **Step 5: Perform a local visual smoke**

Start the production or dev server against a copied learning set and inspect desktop plus one narrow
viewport. Verify:

- the first Home viewport has one dominant action;
- the current stage is visually stronger than the chat history;
- the context rail reads as one vertical document, not a card dashboard;
- explorer and persona overlays preserve the underlying Session and scroll;
- reduced motion removes transitions;
- no panel causes horizontal overflow.

Save only non-sensitive screenshots needed for the acceptance report.

- [ ] **Step 6: Update the manual and write the acceptance report**

Document the final user flow and UI-only state ownership. Record test commands, browser sizes,
fixture/copy paths, observed safety boundaries, and any remaining limitation. Do not describe the
stale branch as a supported alternative.

- [ ] **Step 7: Commit the integrated acceptance**

```bash
git add apps/pi-teaching-web/tests/e2e \
  docs/zh-CN/完整说明书.md \
  docs/audits/2026-07-28-app-panels-migration-acceptance.md
git commit -m "test: accept migrated StudyForge panels"
```
