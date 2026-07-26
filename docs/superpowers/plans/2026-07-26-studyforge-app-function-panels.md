# StudyForge App Function Panels Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the existing Pi teaching web frontend into a single-user product surface with a continue-first home, a pinned classroom stage, a stacked context rail, safe content exploration, explicit Plan-memory confirmation, and a richer persona drawer.

**Architecture:** Keep Markdown, active Trace, confirmed profiles, and Pi Session JSONL as the only durable owners. Add read-only student projections and Session-owned UI artifacts around the existing `WorkspaceRegistry`; compose existing Notebook, Ability, Evidence, Replay, Workflow, and persona features instead of replacing their semantics.

**Tech Stack:** Bun 1.3.14, TypeScript 7, React 19.2.8, Vite 8.1.5, Pi 0.81.0, TypeBox 1.3.6, Bun test, Playwright 1.61.1.

## Global Constraints

- Follow `docs/superpowers/specs/2026-07-26-studyforge-app-function-panels-design.md`.
- Do not add a database, background index, vector store, second event log, third top-level Agent, or new public MCP tool.
- Preserve exactly four public Claude plugin MCP tools.
- Coach remains the Plan owner; Tutor remains the current Lesson owner.
- Student View must not reveal Teacher Control, answers, rubric text, unrevealed hints, private matrices, stored alternative solutions, or child conclusions.
- During an active/paused Tutor Lesson, content search is restricted to already revealed cards, materials, and method nodes.
- Card search results must be authentic and carry complete active Trace history; empty search is valid.
- Lesson Summary remains a Coach retrieval index, not a Tutor context payload.
- New UI failures may degrade their own panel but must not block the current Coach/Tutor conversation.
- Do not add tests for Skill prose, headings, or exact wording; test executable permissions, projections, persistence, and UI behavior.
- Do not add dependencies.

---

### Task 1: Continue-first home projection and route restoration

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/study/home.ts`
- Modify: `apps/pi-teaching-web/src/study/read-workspace.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Create: `apps/pi-teaching-web/tests/study/home.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/routes.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Produces:

```ts
export type HomeContinueTarget = {
  route: string;
  kind: 'coach' | 'lesson';
  planId: string;
  lessonId: string | null;
  title: string;
  detail: string;
};

export type HomeSignal = {
  label: string;
  value: string;
  source: string | null;
};

export type HomeSnapshot = {
  learningSet: LearningSetSnapshot;
  currentPlan: PlanSummary | null;
  availableRoutes: string[];
  continueTarget: HomeContinueTarget | null;
  lessonProgress: { completed: number; total: number };
  coachNote: string;
  signals: HomeSignal[];
  recentReplay: null | { lessonId: string; title: string; route: string };
};

export function readHomeSnapshot(root: string): HomeSnapshot;
export function resolveContinuePath(home: HomeSnapshot, savedPath: string | null): string | null;
```

- Extends `PlanSummary` with exact read-only fields:

```ts
currentPosition: string;
nextLessonCandidate: string;
planSummary: string;
```

- Consumes existing `readLearningSet`, `readPlanWorkspace`, `readAbilityProjection`, and active Trace readers.

- [ ] **Step 1: Write failing home-projection and route-selection tests**

```ts
test('chooses active then paused then prepared then Coach as the home continuation', () => {
  const home = readHomeSnapshot(root);
  expect(home.continueTarget).toMatchObject({
    kind: 'lesson',
    planId: 'domain-integrity',
    lessonId: 'lesson-003',
  });
  expect(home.availableRoutes).toContain('/plan/domain-integrity/lesson/lesson-003');
});

test('uses a valid saved route and rejects an unavailable one', () => {
  expect(resolveContinuePath(home, '/plan/domain-integrity/lesson/lesson-001'))
    .toBe('/plan/domain-integrity/lesson/lesson-001');
  expect(resolveContinuePath(home, '/plan/missing')).toBe(home.continueTarget?.route ?? null);
});
```

- [ ] **Step 2: Run the focused tests and verify the red state**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/home.test.ts tests/client/routes.test.ts
```

Expected: FAIL because `HomeSnapshot`, `readHomeSnapshot`, and `resolveContinuePath` do not exist.

- [ ] **Step 3: Implement the deterministic home projection**

Implement `readHomeSnapshot()` with this exact fallback order:

```ts
const activePlan = learningSet.plans.find((plan) => plan.status === 'active');
const workspace = activePlan ? readPlanWorkspace(root, activePlan.id) : null;
const lesson = workspace?.lessons.find((item) => item.status === 'active')
  ?? workspace?.lessons.find((item) => item.status === 'paused')
  ?? workspace?.lessons.find((item) => item.status === 'prepared')
  ?? null;
```

Build `availableRoutes` only from real Plans and real Lesson Index entries. Use the current Plan sections for `coachNote`; do not call a model on page load. Limit `signals` to the two newest active Trace/method changes and `recentReplay` to the last closed Lesson in linked order.

- [ ] **Step 4: Expose `GET /api/home` and add the client contract**

Add:

```ts
home: () => json<HomeSnapshot>('/api/home'),
```

Keep `GET /api/learning-set` for existing callers; both endpoints read the same Markdown facts.

- [ ] **Step 5: Replace the current Plan-list-dominant home with the continue-first hierarchy**

Keep the component name `LearningSetHome` to minimize churn, but change its input to `HomeSnapshot`. Render:

```tsx
<button className="continue-card" onClick={() => onContinue(continuePath)}>
  <small>继续上次学习</small>
  <strong>{value.continueTarget?.title}</strong>
  <span>{value.continueTarget?.detail}</span>
</button>
```

Below it, render current Plan/Coach note, compact Lesson progress, changed signals, recent Replay, and a secondary Plan list. There must be exactly one `.continue-card`.

- [ ] **Step 6: Persist only the last valid route as browser UI state**

In `App.openRoute`, after a successful Coach/Lesson navigation:

```ts
localStorage.setItem('studyforge.lastRoute', formatBrowserRoute(route));
```

On Home, call `resolveContinuePath(home, localStorage.getItem('studyforge.lastRoute'))`. Never write this preference into Markdown.

- [ ] **Step 7: Run focused tests and server contract tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/home.test.ts tests/client/routes.test.ts tests/server/workspace-api.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the vertical slice**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests
git commit -m "feat: add continue-first learning home"
```

---

### Task 2: Pinned ActivityBlock stage and stacked context rail

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
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
- Create: `apps/pi-teaching-web/tests/client/current-activity-stage.test.tsx`
- Create: `apps/pi-teaching-web/tests/client/context-stack.test.tsx`
- Modify: `apps/pi-teaching-web/tests/study/student-notebook.test.ts`
- Create: `apps/pi-teaching-web/tests/study/coach-context.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Produces:

```ts
export type EvidenceSummary = {
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
  priorLessons: Array<{ lessonId: string; title: string; summary: string }>;
};
```

- Extends `StudentNotebook` with `recentEvidence: EvidenceSummary[]`.
- `CurrentActivityStage` consumes `StudentNotebook | null`; it renders the one active Block and the `StudentProblemCard` objects referenced by that Block.
- `ContextStack` consumes:

```ts
export type ContextStackProps = {
  view: 'coach' | 'tutor' | 'replay';
  workspace: PlanWorkspaceSnapshot;
  lesson: LessonNode | null;
  notebook: StudentNotebook | null;
  replay: LessonReplay | null;
  abilities: AbilityProjection | null;
  workflows: WorkflowView[];
  coachContext: CoachContextView | null;
  onEvidence(source: string): void;
  onWorkflowAction(id: string, action: 'confirm' | 'cancel'): Promise<void>;
};
```

- [ ] **Step 1: Write failing Student View and component tests**

```tsx
test('renders only the active block and its revealed card in the stage', () => {
  const html = renderToStaticMarkup(<CurrentActivityStage notebook={{
    lesson: {
      id: 'lesson-003',
      title: 'Lesson 003',
      path: 'lessons/lesson-003.md',
      planId: 'domain-integrity',
      status: 'active',
      sessionKey: 'tutor:lesson-003',
      tutorSessionId: 'session-1',
      blocks: [{
        id: 'assessment-01',
        title: 'assessment-01',
        kind: 'problem',
        required: true,
        status: 'active',
        dependsOn: [],
        uses: ['Q-DOMAIN-EX22'],
        studentView: '请完成 Q-DOMAIN-EX22',
        evidence: [],
      }, {
        id: 'assessment-02',
        title: 'assessment-02',
        kind: 'problem',
        required: true,
        status: 'pending',
        dependsOn: ['assessment-01'],
        uses: ['Q-DOMAIN-EX16'],
        studentView: '',
        evidence: [],
      }],
    },
    cards: {
      'Q-DOMAIN-EX22': {
        path: 'cards/derivative/mst_p0032_ex22.card.yaml',
        stem: '可见题干',
        choices: [],
      },
    },
    lessonSummary: null,
    recentEvidence: [],
  }} />);
  expect(html).toContain('assessment-01');
  expect(html).toContain('Q-DOMAIN-EX22');
  expect(html).not.toContain('Q-DOMAIN-EX16');
  expect(html).not.toContain('Teacher Control');
});

test('orders Tutor context as route, ability, evidence, workflow', () => {
  const html = renderToStaticMarkup(<ContextStack
    view="tutor"
    workspace={{ plan: { id: 'p1' }, lessons: [] } as never}
    lesson={{ id: 'lesson-1', status: 'active' } as never}
    notebook={{
      lesson: {
        id: 'lesson-1',
        status: 'active',
        blocks: [{ id: 'b1', title: '当前题', status: 'active' }],
      },
      cards: {},
      lessonSummary: null,
      recentEvidence: [],
    } as never}
    replay={null}
    abilities={{ nodes: [] }}
    workflows={[{ id: 'wf-1', goal: '核对证据', status: 'running', tasks: [] } as never]}
    coachContext={null}
    onEvidence={() => {}}
    onWorkflowAction={async () => {}}
  />);
  const labels = ['课堂路线', '能力信号', '最近证据', '深度任务'];
  const positions = labels.map((label) => html.indexOf(label));
  expect(positions.every((position) => position >= 0)).toBe(true);
  expect(positions).toEqual([...positions].sort((left, right) => left - right));
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/current-activity-stage.test.tsx tests/client/context-stack.test.tsx tests/study/coach-context.test.ts
```

Expected: FAIL because the components and Coach projection do not exist.

- [ ] **Step 3: Project recent active evidence into the Student Notebook**

Read active Trace for the selected Lesson and return only:

```ts
{
  source: trace.sourceAnchor,
  lessonId: trace.lessonId,
  blockId: trace.blockId,
  assessment: trace.assessment,
  support: trace.support,
  note: trace.note,
}
```

Do not include card solutions, method alternatives, tool arguments, or superseded Trace.

- [ ] **Step 4: Implement `readCoachContext(root, planId)`**

Read the current Plan sections, `memory/planner-attention.md`, and closed Lesson summaries in Lesson Index order. Return student-safe Markdown text only; do not open raw Tutor transcript or card answers.

Expose:

```ts
GET /api/plans/:planId/context
```

- [ ] **Step 5: Build the pinned classroom stage**

`CurrentActivityStage` must:

```tsx
const active = notebook?.lesson.blocks.find((block) => block.status === 'active');
if (!active?.studentView) return null;
return (
  <section className="current-activity" data-kind={active.kind}>
    <MarkdownView>{active.studentView}</MarkdownView>
    {active.uses.map((alias) => (
      notebook.cards[alias]
        ? <StudentCard key={alias} alias={alias} card={notebook.cards[alias]} />
        : null
    ))}
  </section>
);
```

Pass it to `ChatPanel` through a `stage: ReactNode` prop and render it above `.timeline`. Remove active cards from the Tutor right rail so the same Student View is not rendered twice; closed Replay may still show card sources.

- [ ] **Step 6: Compose existing projections into `ContextStack`**

Use `ContextSection` as the disclosure primitive. Default behavior:

- Tutor: route expanded; ability/evidence compact; workflow shown only when present.
- Coach: Plan position expanded; planner attention and prior summaries compact; workflow shown only when present.
- Replay: Replay/route expanded; ability and evidence compact.

Move `TaskRail` out of `ChatPanel` and into `ContextStack`. Add an `embedded` presentation prop to `AbilityMap`, `LessonNotebook`, and `TaskRail`; do not duplicate their data logic.

- [ ] **Step 7: Wire live refresh**

Reuse existing `ability-update`, snapshot, notebook fetch, and workflow events. When a Tutor snapshot changes the active Block, refetch the notebook so the stage and route rail move together.

- [ ] **Step 8: Run focused and regression tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/current-activity-stage.test.tsx tests/client/context-stack.test.tsx tests/study/student-notebook.test.ts tests/study/coach-context.test.ts tests/server/workspace-api.test.ts tests/client/task-rail.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit the vertical slice**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests
git commit -m "feat: add structured classroom workspace"
```

---

### Task 3: Student-safe content explorer

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
  traceCount: number;
  card: StudentProblemCard | null;
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

- Exports the existing safe card reader as:

```ts
export function readStudentProblemCard(
  root: string,
  cardPath: string,
): StudentProblemCard;
```

- [ ] **Step 1: Write failing authenticity and reveal-boundary tests**

```ts
test('active Tutor search returns only revealed cards and confirmed methods', () => {
  const result = searchStudentContent(root, {
    query: '定义域',
    sessionKey: 'tutor:lesson-003',
    limit: 20,
  });
  expect(result.hits.map((hit) => hit.source)).toContain(
    'cards/derivative/mst_p0032_ex22.card.yaml',
  );
  expect(result.hits.map((hit) => hit.source)).not.toContain(
    'cards/derivative/mst_p0030_ex16.card.yaml',
  );
});

test('never returns answer-bearing card fields', () => {
  const text = JSON.stringify(searchStudentContent(root, {
    query: '定义域',
    sessionKey: 'coach:domain-integrity',
    limit: 20,
  }));
  for (const forbidden of ['rubric', 'Teacher Control', 'source_solution_summary', 'alternatives']) {
    expect(text).not.toContain(forbidden);
  }
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/content-explorer.test.ts tests/client/content-explorer.test.tsx
```

Expected: FAIL because the search projection and overlay do not exist.

- [ ] **Step 3: Implement server-derived scope**

Do not accept a client-authored visibility mode. Derive it from `sessionKey`:

```ts
const tutor = sessionKey.startsWith('tutor:');
const lesson = tutor ? lessonForSession(root, sessionKey.slice(6)) : null;
const restricted = lesson?.status === 'active' || lesson?.status === 'paused';
```

Implement the private helper by iterating only real Roadmap Plans:

```ts
function lessonForSession(root: string, lessonId: string): LessonNode | null {
  for (const plan of readLearningSet(root).plans) {
    const lesson = readPlanWorkspace(root, plan.id).lessons
      .find((candidate) => candidate.id === lessonId);
    if (lesson) return lesson;
  }
  return null;
}
```

For restricted Tutor scope:

- allowed cards are exactly `readStudentNotebook(...).cards`;
- allowed methods are canonical names present in visible Student View or confirmed active Trace for the Lesson;
- allowed materials are paths linked by visible Blocks or active Trace.

Coach and closed/abandoned Replay may search the whole learning set, but all results remain student-safe projections.

- [ ] **Step 4: Implement authentic card, method, and material result mapping**

- Cards: call existing `searchCards`; preserve complete active Trace count; return only safe stem/choices and metadata.
- Methods: search `listCanonicalMethodNames(root)` and count active Trace references.
- Materials: recursively search real files under `materials/`; return title/path metadata only, never unstructured body content.
- Empty query or no match returns `{ hits: [] }`.

- [ ] **Step 5: Expose the endpoint**

```text
GET /api/content-search?query=<text>&sessionKey=<real key>&limit=20
```

Reject missing/invalid `sessionKey` with `400`; return `404` for a nonexistent Tutor Lesson.

- [ ] **Step 6: Build the overlay**

`ContentExplorer` contains search input, `全部/题卡/知识节点/材料` client filters, safe result cards, Trace count, and a close button. It never renders raw YAML or Markdown source.

Open it from a “内容” button in the workspace navigation. Closing restores the same Session and scroll position.

- [ ] **Step 7: Run focused server and component tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/content-explorer.test.ts tests/client/content-explorer.test.tsx tests/server/workspace-api.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit the vertical slice**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests
git commit -m "feat: add safe learning content explorer"
```

---

### Task 4: Session-owned Plan memory review

**Files:**
- Create: `apps/pi-teaching-web/src/memory-review/contracts.ts`
- Create: `apps/pi-teaching-web/src/memory-review/store.ts`
- Create: `apps/pi-teaching-web/src/memory-review/tool.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/projection/projector.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/src/client/components/MemoryReviewPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Create: `apps/pi-teaching-web/tests/memory-review/store.test.ts`
- Create: `apps/pi-teaching-web/tests/memory-review/tool.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Modify: `apps/pi-teaching-web/tests/projection/projector.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Create: `apps/pi-teaching-web/tests/client/memory-review-panel.test.tsx`

**Interfaces:**
- Produces:

```ts
export type MemoryReviewItem = {
  id: string;
  operation: 'add' | 'revise' | 'delete';
  owner: 'student' | 'teaching';
  proposal: string;
  source: string;
  support: string;
  conflict: string;
  scope: string;
};

export type MemoryReviewDecision = {
  itemId: string;
  action: 'keep' | 'rewrite' | 'reject';
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

- Adds one Pi-only Coach tool, `memory_review_propose`; it does not alter the four public MCP tools.
- Produces:

```ts
export function createMemoryReviewProposeTool(
  root: string,
  planId: string,
  ownerPath: string,
  store: MemoryReviewStore,
  createId?: () => string,
): ToolDefinition;
```

- Extends `StudySession` with:

```ts
memoryReview(): MemoryReviewSnapshot | null;
submitMemoryReview(id: string, decisions: MemoryReviewDecision[]): Promise<MemoryReviewSnapshot>;
```

- [ ] **Step 1: Write failing store and tool tests**

```ts
test('keeps the latest review snapshot in Pi Session custom entries', () => {
  const proposed: MemoryReviewSnapshot = {
    id: 'review-1',
    planId: 'domain-integrity',
    status: 'proposed',
    items: [{
      id: 'preference-1',
      operation: 'add',
      owner: 'student',
      proposal: '先独立尝试',
      source: 'lessons/lesson-003.md#trace-event-001',
      support: '三节课中均主动要求先尝试',
      conflict: '无',
      scope: '本 Roadmap 的解题课',
    }],
    decisions: [],
  };
  const decisions: MemoryReviewDecision[] = [{
    itemId: 'preference-1',
    action: 'keep',
    text: null,
  }];
  const entries: unknown[] = [];
  const manager = {
    appendCustomEntry(customType: string, data: unknown) {
      entries.push({ type: 'custom', customType, data });
    },
    getEntries: () => entries,
  } as never;
  const store = new MemoryReviewStore(manager);
  store.save(proposed);
  store.save({ ...proposed, status: 'submitted', decisions });
  expect(store.latest()).toEqual({ ...proposed, status: 'submitted', decisions });
});

test('rejects a proposal before the Session-owned Plan is completed', async () => {
  const root = mkdtempSync(join(tmpdir(), 'memory-review-'));
  mkdirSync(join(root, 'plans'), { recursive: true });
  writeFileSync(join(root, 'plans/p1.md'), `---
id: p1
kind: plan
status: active
---
# Plan p1
`);
  const entries: unknown[] = [];
  const manager = {
    appendCustomEntry(customType: string, data: unknown) {
      entries.push({ type: 'custom', customType, data });
    },
    getEntries: () => entries,
  } as never;
  const tool = createMemoryReviewProposeTool(
    root,
    'p1',
    'plans/p1.md',
    new MemoryReviewStore(manager),
    () => 'review-1',
  );
  const input = {
    items: [{
      id: 'preference-1',
      operation: 'add',
      owner: 'student',
      proposal: '先独立尝试',
      source: 'lessons/lesson-003.md#trace-event-001',
      support: '三节课中均主动要求先尝试',
      conflict: '无',
      scope: '本 Roadmap 的解题课',
    }],
  } as const;
  await expect(tool.execute('call', input, new AbortController().signal))
    .rejects.toThrow('MEMORY_REVIEW_PLAN_NOT_COMPLETED');
  rmSync(root, { recursive: true, force: true });
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/memory-review/store.test.ts tests/memory-review/tool.test.ts
```

Expected: FAIL because the store and tool do not exist.

- [ ] **Step 3: Implement the append-only Session store**

Use custom type `studyforge.memory-review.v1`. `latest()` reads the last entry for the current Plan. No `memory/pending-*` file is created.

- [ ] **Step 4: Implement `memory_review_propose`**

The tool:

- is registered only for Coach;
- validates the Session-owned Plan frontmatter is `completed`;
- requires one unique ID per item and a real nonempty source;
- stores the proposal;
- returns only `{ ok: true, reviewId, itemCount }`.

It does not write either profile.

Add `memory_review_propose` to the human-readable work-status label map. Project only its tool name/status; never project candidate text from tool arguments or results.

- [ ] **Step 5: Submit explicit student decisions through the existing Coach Session**

`submitMemoryReview()` validates every decision refers to one proposed item, stores `status: submitted`, and sends one visible Coach prompt containing the exact `keep/rewrite/reject` decisions. The prompt instructs Coach to edit only confirmed rows, reread both profiles, and report the reread state.

Submission means “sent to Coach”, not “profiles persisted”; do not display a persistence success before Coach completes the existing write/readback flow.

- [ ] **Step 6: Expose review endpoints**

```text
GET  /api/sessions/:coachKey/memory-review
POST /api/sessions/:coachKey/memory-review/:reviewId/submit
```

The POST body is:

```ts
{ decisions: MemoryReviewDecision[] }
```

Reject Tutor keys. Use the existing `session-run` lifecycle while Coach processes the submitted confirmation.

- [ ] **Step 7: Build the review panel**

Show each candidate with owner, operation, proposal, source, support, conflict, scope, and `保留/改写/删除` controls. A rewrite requires nonempty text. Submit all choices once; “稍后处理” closes the panel without changing the Session artifact or profiles.

- [ ] **Step 8: Update Coach Skill semantics**

Add one concise instruction: after Plan completion, propose source-linked candidates through `memory_review_propose`; wait for the UI’s item-by-item decisions before editing profiles. Do not add tests for this prose.

- [ ] **Step 9: Run focused runtime, API, and UI tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/memory-review tests/runtime/session-factory.test.ts tests/runtime/workspace-registry.test.ts tests/server/workspace-api.test.ts tests/client/memory-review-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 10: Commit the vertical slice**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/resources apps/pi-teaching-web/tests
git commit -m "feat: add Plan memory review UI"
```

---

### Task 5: Persona preview drawer and presentation preferences

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Create: `apps/pi-teaching-web/src/client/presentation.ts`
- Create: `apps/pi-teaching-web/src/client/components/PersonaDrawer.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/src/client/theme-liubai.css`
- Create: `apps/pi-teaching-web/tests/client/persona-drawer.test.tsx`
- Modify: `apps/pi-teaching-web/tests/study/persona.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Extends each persona choice:

```ts
{
  id: string;
  name: string;
  description: string;
  glyph: string;
  palette: [string, string, string];
}
```

- Produces UI-only preferences:

```ts
export type PresentationPreferences = {
  motion: 'gentle' | 'reduced';
  completionFeedback: boolean;
};

export function readPresentationPreferences(storage: Storage): PresentationPreferences;
export function writePresentationPreferences(
  storage: Storage,
  value: PresentationPreferences,
): void;
```

- [ ] **Step 1: Write failing persona drawer tests**

```tsx
test('previews persona metadata and emits one selected id', () => {
  const html = renderToStaticMarkup(
    <PersonaDrawer
      open
      value={{
        id: 'calm-senpai',
        choices: [{
          id: 'calm-senpai',
          name: '冷静学姐',
          description: '语言简洁，等待时间更长。',
          glyph: '静',
          palette: ['#3f5b54', '#b08e4d', '#d6c7a8'],
        }],
      }}
      preferences={{ motion: 'gentle', completionFeedback: true }}
      onSelect={() => {}}
      onPreferences={() => {}}
      onClose={() => {}}
    />,
  );
  expect(html).toContain('冷静学姐');
  expect(html).toContain('语言简洁');
  expect(html).toContain('#3f5b54');
});
```

- [ ] **Step 2: Run the focused tests and verify they fail**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/persona-drawer.test.tsx tests/study/persona.test.ts tests/server/workspace-api.test.ts
```

Expected: FAIL because the richer presentation contract and drawer do not exist.

- [ ] **Step 3: Enrich the existing persona projection**

Keep the same three IDs and same `setPersona` API. Add safe presentation metadata only; do not read persona prompt bodies into the browser.

- [ ] **Step 4: Replace the header `<select>` with a drawer trigger**

The Chat header shows current glyph/name and opens `PersonaDrawer`. Selection calls the existing `onPersona(id)`. The drawer also persists `motion` and `completionFeedback` to localStorage; these are display preferences, not learning memory.

- [ ] **Step 5: Apply restrained presentation states**

Set:

```tsx
data-motion={preferences.motion}
data-completion-feedback={preferences.completionFeedback ? 'on' : 'off'}
```

Use persona palette only for avatar, focus ring, and small phase accents. Do not recolor semantic success/error/lesson-state tokens.

- [ ] **Step 6: Run focused tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/persona-drawer.test.tsx tests/study/persona.test.ts tests/server/workspace-api.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit the vertical slice**

```bash
git add apps/pi-teaching-web/src apps/pi-teaching-web/tests
git commit -m "feat: add persona preview drawer"
```

---

### Task 6: Browser acceptance, responsive polish, and functional documentation

**Files:**
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/src/client/theme-liubai.css`
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `docs/zh-CN/完整说明书.md`
- Modify: `AGENTS.md`

**Interfaces:**
- Consumes every interface from Tasks 1–5.
- Produces no new runtime or persistence contract.

- [ ] **Step 1: Add an end-to-end continue-home scenario**

```ts
test('continues the last valid Lesson from the home hero', async ({ page }) => {
  await page.goto('/plan/domain-integrity/lesson/lesson-003');
  await page.goto('/');
  await page.getByRole('button', { name: /继续.*Lesson 003/ }).click();
  await expect(page).toHaveURL(/lesson-003$/);
});
```

- [ ] **Step 2: Add an end-to-end classroom-stage/context scenario**

Assert:

- exactly one current ActivityBlock Student View;
- only the revealed card is visible;
- the right rail contains route, ability, evidence, and active workflow sections;
- a Trace-triggered event refreshes the ability/evidence summary without reload.

- [ ] **Step 3: Add an end-to-end content-explorer boundary scenario**

While Lesson 003 assessment-01 is active, search for both real card aliases. Expect EX22 and reject EX16. Close the Lesson, reopen Replay, repeat the search, and expect both safe card stems while still rejecting answer-bearing text.

- [ ] **Step 4: Add an end-to-end memory-review scenario**

Extend the fixture registry with a real Session-owned proposed review. In Coach:

- open the panel;
- keep one row;
- rewrite one row;
- reject one row;
- submit;
- assert the Coach Session receives exactly those decisions;
- assert the fixture profiles are unchanged until the simulated Coach write occurs.

- [ ] **Step 5: Add persona and responsive acceptance**

At widths `390×844` and `1440×900`, assert:

- no horizontal overflow;
- Tutor composer and current Activity remain visible;
- right context rail collapses below the main stage on narrow screens;
- persona drawer changes only `data-persona`/presentation attributes.

- [ ] **Step 6: Run the complete frontend verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e
```

Expected: typecheck PASS, all Bun tests PASS, production build PASS, all Playwright tests PASS.

- [ ] **Step 7: Verify the public plugin contract remains unchanged**

Run:

```bash
cd plugins/highschool-study
bun run release:check
```

Expected: build PASS, tests PASS, strict plugin validation PASS, public MCP tool count remains four.

- [ ] **Step 8: Update current functional documentation**

Document only the final user-facing behavior:

- continue-first home;
- pinned ActivityBlock;
- stacked context rail;
- Tutor/Coach/Replay content-search scopes;
- Plan memory confirmation;
- persona display preferences.

Do not copy the full historical design into `AGENTS.md`; add only new stable invariants and file ownership.

- [ ] **Step 9: Run final diff and secret checks**

Run:

```bash
git diff --check
git status --short
rg -n 'sk-[A-Za-z0-9_-]{16,}|api[_-]?key|authorization:' apps/pi-teaching-web docs AGENTS.md
```

Expected: no whitespace errors; only intended files are modified; no credential matches.

- [ ] **Step 10: Commit the acceptance slice**

```bash
git add AGENTS.md apps/pi-teaching-web docs/zh-CN/完整说明书.md
git commit -m "docs: complete app panel experience"
```
