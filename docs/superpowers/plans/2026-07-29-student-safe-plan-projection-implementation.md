# Student-Safe Plan Projection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the known Plan-to-student spoiler path while preserving complete Markdown facts for Coach, Authoring, and raw-stream.

**Architecture:** Add one deterministic, read-only projection over the existing Plan/Lesson/Card facts. Home, Coach Context Stack, and the `lesson_prepare` readiness event consume this projection; raw Plan/Lesson Markdown and Pi JSONL remain unchanged. Projection failures omit optional detail or use generic copy and never fall back to `Next Lesson Candidate`, active `Plan Summary`, Teacher Control, pending Student View, paths, or inferred card IDs.

**Tech Stack:** TypeScript 7, Bun test runner, React 19 server rendering, YAML 2, existing Markdown-first `highschool-study-markdown` domain.

## Global Constraints

- Keep Plan, Lesson, Trace, memory, Session JSONL, and public MCP schemas unchanged.
- Do not add a database, persistent public summary, migration, semantic filter, review Agent, turn lock, or new tool.
- Keep `readPlanWorkspace` as the complete fact reader for Coach/runtime work.
- Default student-facing consumers must use the safe projection, not raw future-facing Plan sections.
- `Current Position` remains visible and retains its existing semantic contract: it describes facts that have already happened.
- Prepared Lesson titles stay generic. Active/paused Lesson titles may be shown because the Lesson has started.
- `assessment` and `diagnostic` purposes are fixed generic copy. Other templates may show `Capability Target`.
- A source number comes only from a real card's `content_item_id`; missing metadata means omission, never filename inference.
- Tests cover runtime behavior and rendered output. Do not add tests that assert prose in Skill files.
- Preserve the user's existing untracked files under `.superpowers/` and `docs/superpowers/plans/2026-07-22-three-lesson-teaching-quality-optimization.md`.

---

## Task 1: Build the pure student Plan projection

**Files:**

- Create: `apps/pi-teaching-web/src/study/student-plan-projection.ts`
- Create: `apps/pi-teaching-web/tests/study/student-plan-projection.test.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`

- [x] **Step 1: Add failing projection tests**

Create fixture-copy tests for the existing `domain-integrity` Plan. Assert that a prepared assessment projects:

```ts
expect(projection).toMatchObject({
  progress: {
    closedLessons: 2,
    registeredLessons: 3,
    state: 'prepared',
  },
  currentPosition: expect.stringContaining('阶段 `1a` 已通过'),
  nextLesson: {
    lessonId: 'lesson-003',
    status: 'prepared',
    publicTitle: '下一节课堂',
    publicPurpose: '完成一次独立能力检验',
    blockCount: 5,
    blockKinds: ['dialogue', 'problem', 'reflection'],
    sourceNumbers: ['mst_p0017_ex05', 'mst_p0030_ex16', 'mst_p0032_ex22'],
  },
  learningReview: null,
});
```

Also cover:

- `diagnostic` uses `确认当前真实起点`;
- `deliberate-practice` uses the Lesson `Capability Target`;
- a card without `content_item_id` contributes no guessed filename;
- no prepared/active/paused Lesson returns `nextLesson: null` and `state: 'discussing'`;
- active/paused Lessons use the real Lesson title;
- a completed Plan projects its structured `Learning Review`.

Use unique marker strings in raw `Next Lesson Candidate`, `Plan Summary`, `Sources`, Teacher Control, and pending Student View, then assert `JSON.stringify(projection)` contains none of them.

- [x] **Step 2: Run the new test and verify the expected red state**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/student-plan-projection.test.ts
```

Expected: FAIL because the projection module and contract do not exist.

- [x] **Step 3: Add explicit student-facing contracts**

In `src/shared/contracts.ts`, add:

```ts
export type StudentPlanState =
  | 'discussing'
  | 'prepared'
  | 'active'
  | 'paused'
  | 'completed';

export type StudentLessonPreview = {
  lessonId: string;
  status: 'prepared' | 'active' | 'paused';
  publicTitle: string;
  publicPurpose: string | null;
  blockCount: number;
  blockKinds: ActivityKind[];
  sourceNumbers: string[];
};

export type StudentPlanProjection = {
  progress: {
    closedLessons: number;
    registeredLessons: number;
    state: StudentPlanState;
  };
  currentPosition: string;
  nextLesson: StudentLessonPreview | null;
  learningReview: LearningReview | null;
};
```

This type is a rebuildable view only; do not add it to Markdown or Session storage.

- [x] **Step 4: Implement deterministic projection readers**

Implement:

```ts
export function readStudentLessonPreview(
  root: string,
  lesson: LessonNode,
): StudentLessonPreview;

export function readStudentPlanProjection(
  root: string,
  planId: string,
): StudentPlanProjection;
```

The implementation must:

1. select `active → paused → prepared`;
2. read only `Capability Target`, `Primary template`, Block shape, aliases, and card `content_item_id` for the preview;
3. use fixed purposes for `assessment` and `diagnostic`;
4. use `下一节课堂` only while prepared;
5. resolve card paths relative to the Lesson and inside the learning-set root;
6. deduplicate and sort short source IDs for deterministic output;
7. catch optional card/metadata failures and omit those IDs;
8. never inspect `Next Lesson Candidate`, active `Plan Summary`, Sources prose, Teacher Control, or pending Student View to construct the preview.

- [x] **Step 5: Run the projection tests green**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/student-plan-projection.test.ts
```

Expected: PASS.

- [x] **Step 6: Commit Task 1**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/study/student-plan-projection.ts \
  apps/pi-teaching-web/tests/study/student-plan-projection.test.ts
git commit -m "feat: add student-safe plan projection"
```

---

## Task 2: Make Coach Context Stack consume only the safe projection

**Files:**

- Modify: `apps/pi-teaching-web/src/study/coach-context.ts`
- Modify: `apps/pi-teaching-web/src/client/components/ContextStack.tsx`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/tests/study/coach-context.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/context-stack.test.tsx`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

- [x] **Step 1: Rewrite Coach context tests to express the safety boundary**

Change `CoachContextView` from three raw Plan strings to:

```ts
type CoachContextView = {
  plan: StudentPlanProjection;
  plannerAttention: string;
  priorLessons: Array<{
    lessonId: string;
    title: string;
    summary: string;
    source: string;
  }>;
};
```

Before production edits, update the tests so they:

- inject `LEAK_NEXT_CANDIDATE` and `LEAK_ACTIVE_SUMMARY` into the Plan;
- require the API value and rendered Context Stack to omit both markers;
- require `Current Position`, progress, generic assessment purpose, block shape, and source numbers;
- keep Planner Attention and prior Lesson summaries intact;
- keep the completed Learning Review behavior.

- [x] **Step 2: Run focused tests and verify red**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/coach-context.test.ts \
  tests/client/context-stack.test.tsx \
  tests/server/workspace-api.test.ts
```

Expected: FAIL because Coach context still exposes raw future-facing Plan fields.

- [x] **Step 3: Route the Context Stack through `readStudentPlanProjection`**

Update `readCoachContext` to return:

```ts
return {
  plan: readStudentPlanProjection(root, planId),
  plannerAttention,
  priorLessons,
};
```

Update `ContextStack` to render:

- Current Position;
- `closedLessons / registeredLessons`;
- generic “与学习顾问商议下一课” when `nextLesson` is null;
- safe public title/purpose, block count/kinds, and optional source numbers when present;
- existing completed Learning Review notice.

Do not pass through raw `nextLessonCandidate` or `planSummary`.

- [x] **Step 4: Run the focused tests green**

Run the Step 2 command again.

Expected: PASS and no serialized/rendered leak markers.

- [x] **Step 5: Commit Task 2**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/study/coach-context.ts \
  apps/pi-teaching-web/src/client/components/ContextStack.tsx \
  apps/pi-teaching-web/tests/study/coach-context.test.ts \
  apps/pi-teaching-web/tests/client/context-stack.test.tsx \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "fix: project safe plan context for students"
```

---

## Task 3: Make Home continuation use the same projection

**Files:**

- Modify: `apps/pi-teaching-web/src/study/home.ts`
- Modify: `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/tests/study/home.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/learning-set-home.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/session-tree.test.tsx` only if the shared contract requires fixture updates

- [x] **Step 1: Add failing Home leak and continuity tests**

Assert that:

- prepared Lesson continuation title is `下一节课堂`, not the real Lesson title;
- the Home snapshot includes `studentPlan`, not `coachNote`;
- rendered Home shows `Current Position`, progress, safe purpose, activity shape, and optional source numbers;
- raw `LEAK_NEXT_CANDIDATE` and `LEAK_ACTIVE_SUMMARY` never appear;
- no current Lesson renders “正在与学习顾问商议下一课” without raw fallback;
- active/paused continuation still uses the real started Lesson title and existing route;
- route priority and saved-route eligibility do not change.

- [x] **Step 2: Run Home tests and verify red**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/home.test.ts \
  tests/client/learning-set-home.test.tsx \
  tests/client/session-tree.test.tsx
```

Expected: FAIL because Home still reads raw Plan copy and prepared Lesson title.

- [x] **Step 3: Replace `coachNote` with the shared projection**

Update `HomeSnapshot` to carry:

```ts
studentPlan: StudentPlanProjection | null;
```

Remove `coachNote`. In `readHomeSnapshot`:

- calculate the projection for the selected current Plan;
- use its generic prepared title for the continuation target;
- retain real titles for active/paused Lessons;
- retain existing route and progress calculations.

Update `LearningSetHome` to render only `studentPlan.currentPosition`,
`studentPlan.progress`, and `studentPlan.nextLesson`.

- [x] **Step 4: Run Home tests green**

Run the Step 2 command again.

Expected: PASS.

- [x] **Step 5: Commit Task 3**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/study/home.ts \
  apps/pi-teaching-web/src/client/components/LearningSetHome.tsx \
  apps/pi-teaching-web/tests/study/home.test.ts \
  apps/pi-teaching-web/tests/client/learning-set-home.test.tsx \
  apps/pi-teaching-web/tests/client/session-tree.test.tsx
git commit -m "fix: use safe plan projection on home"
```

---

## Task 4: Unify live, stored, and refreshed Lesson readiness

**Files:**

- Modify: `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation-projector.ts`
- Modify: `apps/pi-teaching-web/src/client/components/LessonReadyCard.tsx`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/lesson-prepare.test.ts`
- Modify: `apps/pi-teaching-web/tests/projection/conversation-projector.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/lesson-ready-card.test.tsx`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts` only for the readiness-card expectations

- [x] **Step 1: Add failing cross-path parity tests**

Extend `LessonReadyNotice` with:

```ts
publicTitle: string;
publicPurpose: string | null;
sourceNumbers: string[];
```

Tests must require:

- `lesson_prepare` reads the newly written Lesson through `readStudentLessonPreview`;
- a deliberate-practice receipt carries its safe Capability Target and stable source number;
- an assessment/diagnostic receipt carries fixed generic purpose;
- `lessonReadyNoticeFromToolResult` rejects malformed new fields;
- safe stored-history projection produces the same notice as the live receipt;
- `LessonReadyCard` renders purpose and optional source numbers without rendering paths, real prepared title, or private Coach final;
- `raw-stream` still preserves the original Coach text and full tool result.

- [x] **Step 2: Run focused readiness tests and verify red**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/lesson-prepare.test.ts \
  tests/projection/conversation-projector.test.ts \
  tests/client/lesson-ready-card.test.tsx \
  tests/server/workspace-api.test.ts
```

Expected: FAIL because receipts and cards do not yet carry the unified safe fields.

- [x] **Step 3: Generate the receipt from the same helper**

After the prepared Lesson has been written and reread, call:

```ts
const preview = readStudentLessonPreview(root, lesson);
```

Return only the preview-safe fields plus the existing ownership/fact receipt. Do not copy Blueprint input strings directly into the response.

Update the conversation projector validator and `LessonReadyCard` to consume those fields. Optional source-number display should be ordinary source labels, not links or paths.

- [x] **Step 4: Run focused readiness tests green**

Run the Step 2 command again.

Expected: PASS.

- [x] **Step 5: Run the targeted E2E readiness path**

Run:

```bash
cd apps/pi-teaching-web
bunx playwright test tests/e2e/workspace.spec.ts --grep "prepared|ready|Lesson"
```

Expected: the ready card remains the only safe post-prepare surface and survives refresh/history reconstruction.

- [x] **Step 6: Commit Task 4**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/runtime/lesson-prepare.ts \
  apps/pi-teaching-web/src/projection/conversation-projector.ts \
  apps/pi-teaching-web/src/client/components/LessonReadyCard.tsx \
  apps/pi-teaching-web/tests/runtime/lesson-prepare.test.ts \
  apps/pi-teaching-web/tests/projection/conversation-projector.test.ts \
  apps/pi-teaching-web/tests/client/lesson-ready-card.test.tsx \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts
git commit -m "fix: unify safe lesson readiness projection"
```

---

## Task 5: Clarify ownership, document behavior, and verify the whole runtime

**Files:**

- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `docs/zh-CN/完整说明书.md`
- Modify: `docs/superpowers/specs/2026-07-29-student-safe-plan-projection-design.md`

- [x] **Step 1: Make the minimal Coach Skill clarification**

Add one concise boundary near Plan update/preparation guidance:

> Plan 保存方向、已发生的位置和带来源的阶段判断。完成精确选卡后，题面、路线、卡点、揭示策略和答案只写入 Lesson，不在 Next Lesson Candidate 或 Plan Summary 中复制 Teacher Control。

Do not add runtime branches, error enumerations, or tests for this prose.

- [x] **Step 2: Update current contract documentation**

Update `AGENTS.md` and `docs/zh-CN/完整说明书.md` so they state:

- raw Plan remains Coach-readable;
- Home, Context Stack, prepared gate/sidebar, and readiness card use one rebuildable safe projection;
- assessment/diagnostic use generic purpose;
- specialist teaching may show Capability Target;
- source numbers come only from `content_item_id`;
- missing safe fields never fall back to raw Plan text;
- Authoring and raw-stream retain full content.

Mark the design status as implemented only after verification succeeds.

- [x] **Step 3: Run static searches for forbidden consumer paths**

Run:

```bash
rg -n "nextLessonCandidate|planSummary|coachNote" \
  apps/pi-teaching-web/src/client \
  apps/pi-teaching-web/src/study/coach-context.ts \
  apps/pi-teaching-web/src/study/home.ts
```

Expected: no student-rendering use of raw `nextLessonCandidate`, active `planSummary`, or removed `coachNote`.

- [x] **Step 4: Run the complete Pi web verification**

Run:

```bash
cd apps/pi-teaching-web
bun run check
```

Expected: typecheck, all non-E2E tests, and production build pass.

- [x] **Step 5: Run the complete browser E2E suite**

Run:

```bash
cd apps/pi-teaching-web
bun run test:e2e
```

Expected: all browser flows pass.

- [x] **Step 6: Inspect the final diff and fact preservation**

Run:

```bash
git diff --check
git status --short
git diff main...HEAD --stat
```

Verify manually that:

- no Plan/Lesson/card fixture was migrated;
- no public MCP tool was added or removed;
- no raw Markdown or Pi JSONL fact was deleted;
- the only new runtime concept is a rebuildable reader/projection.

- [ ] **Step 7: Commit Task 5**

```bash
git add AGENTS.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  docs/zh-CN/完整说明书.md \
  docs/superpowers/specs/2026-07-29-student-safe-plan-projection-design.md
git commit -m "docs: define student-safe plan display boundary"
```

- [ ] **Step 8: Final verification after all commits**

Run fresh:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e
cd ../..
git status --short
git log --oneline --decorate -6
```

Expected: all checks pass, only the user's pre-existing untracked files remain outside the feature work, and the branch is ready to merge.
