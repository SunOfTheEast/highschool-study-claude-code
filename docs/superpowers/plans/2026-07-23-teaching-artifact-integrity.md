# Teaching Artifact Integrity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:executing-plans` to implement this plan task-by-task.

**Goal:** Make LLM-authored Plan and Lesson Markdown become executable only after explicit registration, structural validation, Session ownership verification, and a successful write receipt.

**Architecture:** Keep the existing Markdown-first, Coach/Tutor, Plan/Lesson design. Add four narrow runtime primitives—`register → validate → bind-owner → commit-receipt`—at the points where files enter runtime behavior. Do not add a database, general rule engine, compatibility layer, third Agent, or teaching-quality gate.

**Tech Stack:** Bun, TypeScript, React, Pi `SessionManager` custom entries, Markdown/YAML, `bun:test`, Playwright.

**Source design:** `docs/superpowers/specs/2026-07-23-teaching-artifact-integrity-design.md`

## Scope and execution rules

- Execute tasks in order; each task ends in a focused commit.
- For executable behavior, write the focused failing test first and observe the expected failure.
- Skill and Agent prose is reviewed directly and receives no wording tests.
- Never mutate `examples/derivative-demo/learning-set/**` during automated tests or live acceptance. Copy it to `/tmp`.
- Keep the public plugin at exactly four MCP tools. `plan_register` is Pi Coach-only.
- Old Pi Sessions without the owner custom entry are not reused. Do not add a display-name or history-content fallback.
- Lesson admission checks only mechanical executability. It must not judge question count, teaching relevance, pacing, or hint quality.

---

## Task 1: Bind every Pi Session to its real Markdown owner

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/session-owner.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`

- [ ] **Step 1: Add failing owner lookup and creation tests**

In `workspace-registry.test.ts`, change the injected lookup to accept the expected
`StudySessionScope`, then cover both roles:

```ts
const lookup = mock(async (
  root: string,
  sessionId: string,
  expected: StudySessionScope,
) => expected.ownerId === 'fixed-value' ? '/tmp/owned.jsonl' : null);
```

Assert:

1. `openCoach('fixed-value')` passes `{ role: 'coach', ownerId: 'fixed-value', ownerPath: 'plans/fixed-value.md' }`;
2. `openTutor('lesson-001')` passes the Lesson scope;
3. a lookup returning `null` causes a fresh factory call and rewrites the actual new Session ID;
4. a cached runtime Session remains reusable in the same process.

In `session-factory.test.ts`, construct a real temporary `SessionManager`, create a new
Coach/Tutor Session through the factory seam already used by the suite, and assert the
JSONL entries contain exactly one:

```ts
{
  type: 'custom',
  customType: 'studyforge.session-owner.v1',
  data: { role, ownerId, ownerPath },
}
```

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/workspace-registry.test.ts tests/runtime/session-factory.test.ts
```

Expected: FAIL because lookup receives two arguments and new Sessions do not append the owner entry.

- [ ] **Step 2: Add the Session owner primitive**

Create `session-owner.ts` with this public contract:

```ts
import type { SessionManager } from '@earendil-works/pi-coding-agent';
import type { StudySessionScope } from './session-scope';

export const SESSION_OWNER_TYPE = 'studyforge.session-owner.v1';

export function appendSessionOwner(
  manager: Pick<SessionManager, 'appendCustomEntry'>,
  owner: StudySessionScope,
): void;

export function readSessionOwner(
  manager: Pick<SessionManager, 'getEntries'>,
): StudySessionScope | null;

export function sessionOwnerMatches(
  actual: StudySessionScope | null,
  expected: StudySessionScope,
): boolean;
```

`readSessionOwner` returns a value only when there is exactly one custom entry of the
right type and its `role`, `ownerId`, and `ownerPath` are valid strings with an allowed
role. Missing, duplicate, malformed, or extra owner entries return `null`.

- [ ] **Step 3: Write and verify ownership on create/open**

In `session-factory.ts`, after `appendSessionInfo` for a new Session, call:

```ts
appendSessionOwner(manager, scope);
```

In `workspace-registry.ts`, define:

```ts
export type SessionFileLookup = (
  root: string,
  sessionId: string,
  expected: StudySessionScope,
) => Promise<string | null>;
```

The production lookup must:

1. find the JSONL through `SessionManager.list(root)`;
2. open it with `SessionManager.open(path, undefined, root)`;
3. read the custom owner;
4. return the path only on an exact match.

Pass the expected Plan or Lesson scope from `openCoach` and `openTutor`. A stale
frontmatter ID is left untouched until the fresh Session is successfully created; the
existing post-create write then replaces it with the new ID.

- [ ] **Step 4: Run focused verification and commit**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/workspace-registry.test.ts tests/runtime/session-factory.test.ts
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/runtime/session-owner.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts
git commit -m "fix: bind pi sessions to markdown owners"
```

Expected: focused tests and typecheck PASS.

---

## Task 2: Register Coach-created Plans and refresh the Roadmap home

**Files:**

- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Create: `apps/pi-teaching-web/src/runtime/plan-register.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

- [ ] **Step 1: Add failing Plan registration tests**

In `write-workspace.test.ts`, copy the normal fixture to a temporary directory, write
`plans/isomorphic-transformation.md` with:

```md
---
kind: plan
id: isomorphic-transformation
status: active
coach_session: null
---

# 同构变形
```

Test `registerPlan(root, 'isomorphic-transformation')` and assert:

- it derives `plans/isomorphic-transformation.md`;
- it rejects wrong `kind` and ID mismatch;
- it uses `同构变形` as the link text;
- it appends exactly one link under the existing `## Plan Graph`;
- two calls produce byte-identical Roadmap content after the first;
- a missing `## Plan Graph` fails without modifying the file.

In `session-factory.test.ts`, assert the Coach tool list contains `plan_register` and the
Tutor list does not.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts tests/runtime/session-factory.test.ts
```

Expected: FAIL because the registration function and tool do not exist.

- [ ] **Step 2: Implement the idempotent Markdown write**

Export from `write-workspace.ts`:

```ts
export type RegisteredPlan = {
  id: string;
  title: string;
  path: string;
  coachSessionId: string | null;
};

export function registerPlan(root: string, planId: string): RegisteredPlan;
```

Implementation requirements:

- validate `planId` as a single safe Markdown filename stem;
- derive the path instead of accepting it;
- parse frontmatter through the existing Markdown reader;
- read the first H1 as the title;
- insert `- [<title>](plans/<planId>.md)` at the end of `## Plan Graph`;
- identify duplicates by canonical target path, not link text;
- fail before writing on all validation errors;
- reread the Plan and Roadmap before returning.

- [ ] **Step 3: Add the Coach-only `plan_register` tool**

Create `plan-register.ts`:

```ts
export function createPlanRegisterTool(
  root: string,
  currentPlanPath: string,
  sessionLookup: SessionFileLookup,
): ToolDefinition;
```

The tool accepts only `{ planId: string }`. It registers the Plan, verifies any
frontmatter `coach_session` against:

```ts
{ role: 'coach', ownerId: plan.id, ownerPath: plan.path }
```

and writes YAML `null` if the ID is not owned by that Plan. It then rereads
`readLearningSet(root)` and returns:

```ts
{
  ok: true,
  ownerPath: plan.path,
  factId: plan.id,
  status: 'registered',
  plan: canonicalRoadmapPlan,
}
```

Register it only in the Coach branch of `createPiSessionFactory`, and add
`plan_register` to `roleToolNames('coach')`.

- [ ] **Step 4: Refetch the Roadmap whenever the home route opens**

In `App.tsx`, make the home branch await `api.learningSet()` and call
`setLearningSet(value)` before clearing the workspace. Do not add a Roadmap event type.

Add a server/client-level test that changes the injected learning-set snapshot between
initial load and returning home and verifies the second result is used.

- [ ] **Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts \
  tests/runtime/session-factory.test.ts \
  tests/server/workspace-api.test.ts
bun run typecheck
cd ../..
git add apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/src/runtime/plan-register.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "feat: register coach plans in the roadmap"
```

Expected: focused tests and typecheck PASS.

---

## Task 3: Admit only structurally executable prepared Lessons

**Files:**

- Create: `plugins/highschool-study/server/src/lesson-aliases.ts`
- Modify: `plugins/highschool-study/server/src/domain.ts`
- Modify: `plugins/highschool-study/server/src/traces.ts`
- Create: `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`

- [ ] **Step 1: Add failing admission tests**

Create temporary Lesson variants from the normal fixture and assert `startLesson`:

1. rejects a missing top-level `## Aliases`, `## Reflection`, `## Lesson Summary`, or `## Traces`;
2. rejects every non-empty `Uses` alias that is not declared;
3. rejects an alias whose target is missing or not a problem card;
4. rejects zero or two explicit `Kind: reflection` Blocks;
5. rejects a block merely named `reflection` when its actual Kind is `dialogue`;
6. leaves the Lesson `prepared` and does not call the Session factory on rejection;
7. activates a valid Lesson and creates the Tutor;
8. resumes `paused` without repeating admission.

The API test must expect HTTP 422:

```json
{
  "error": "PREPARED_LESSON_INVALID",
  "issues": [
    { "code": "LESSON_ALIAS_MISSING", "message": "..." }
  ]
}
```

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/workspace-registry.test.ts tests/server/workspace-api.test.ts
```

Expected: FAIL because invalid prepared Lessons currently become active.

- [ ] **Step 2: Share one narrow alias parser**

Move the current `aliases(source)` logic from `traces.ts` into
`lesson-aliases.ts` as:

```ts
export function readLessonAliases(source: string): Map<string, string>;
```

Export it from `domain.ts` and reuse it in `traces.ts`. This is extraction only; do not
change valid alias syntax.

- [ ] **Step 3: Implement the prepared Lesson validator**

Create `validate-prepared-lesson.ts` with:

```ts
export type PreparedLessonIssue = {
  code:
    | 'LESSON_SECTION_MISSING'
    | 'LESSON_ALIAS_MISSING'
    | 'LESSON_ALIAS_INVALID'
    | 'LESSON_REFLECTION_COUNT';
  message: string;
};

export class PreparedLessonValidationError extends Error {
  readonly code = 'PREPARED_LESSON_INVALID';
  constructor(readonly issues: PreparedLessonIssue[]) {
    super('PREPARED_LESSON_INVALID');
  }
}

export function validatePreparedLesson(root: string, lessonPath: string): void;
```

Read the raw Markdown and:

- detect exact top-level H2 sections;
- inspect every raw Block Node State and split comma-separated non-empty `Uses`;
- resolve used aliases relative to the Lesson with `sourceResolve`;
- accept only targets that `readCard` confirms as real problem cards;
- count explicit raw `Kind: reflection` values, not projected block names;
- collect all issues and throw once.

- [ ] **Step 4: Place admission before any mutation**

In `WorkspaceRegistry.startLesson`, call the validator only when current status is
`prepared`, before changing status and before `openTutor`. Do not revalidate `paused`.

In `server/app.ts`, catch only `PreparedLessonValidationError` around the lesson start
action and return its 422 JSON. Let unrelated failures retain existing behavior.

In `client/api.ts`, add a small `ApiError` carrying `status` and parsed JSON. In
`App.tsx`, render:

```text
这节课还没备完整：<issue messages>。请返回 Coach 修正。
```

Other start failures retain the existing Pi configuration message.

- [ ] **Step 5: Add one browser acceptance for the actionable error**

In `workspace.spec.ts`, use the fixture server to return the 422 issue payload, click
“开始上课”, and assert the alert contains the issue plus “请返回 Coach 修正”, while
the prepared gate remains visible.

- [ ] **Step 6: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/workspace-registry.test.ts tests/server/workspace-api.test.ts
bun run test:e2e -- tests/e2e/workspace.spec.ts
bun run typecheck
cd ../..
git add plugins/highschool-study/server/src/lesson-aliases.ts \
  plugins/highschool-study/server/src/domain.ts \
  plugins/highschool-study/server/src/traces.ts \
  apps/pi-teaching-web/src/study/validate-prepared-lesson.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/client/api.ts \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts
git commit -m "feat: validate lessons before tutor startup"
```

Expected: unit, API, E2E, and typecheck PASS.

---

## Task 4: Make write failures actionable and successes auditable

**Files:**

- Modify: `plugins/highschool-study/server/src/traces.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-close.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`

- [ ] **Step 1: Add failing error and receipt tests**

Assert:

- an undeclared card alias throws a message starting `LESSON_ALIAS_MISSING`;
- it includes the requested alias, sorted allowed aliases, and “不要搜索、猜测或重试”;
- a declared alias resolving to a non-card throws `LESSON_ALIAS_INVALID` with alias and target;
- closing without exactly one active reflection throws `LESSON_REFLECTION_NOT_ACTIVE`,
  listing active block IDs/kinds and the expected condition;
- `trace_append` success content includes `ok: true`, the current Lesson `ownerPath`, and
  `factId === eventId`;
- `lesson_close` success content includes `ok: true`, the current Lesson `ownerPath`, and
  `status: 'closed'`;
- failed writes never return a payload containing `ok: true`.

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts tests/study/write-workspace.test.ts
```

Expected: FAIL on the new stable errors and receipt fields.

- [ ] **Step 2: Emit stable structural errors**

In `traces.ts`, replace only the two alias failure branches:

```text
LESSON_ALIAS_MISSING: requested=<alias>; allowed=<comma list>;
这是 Lesson 结构错误，不要搜索、猜测或重试，请返回 Coach 修正源文件
```

```text
LESSON_ALIAS_INVALID: alias=<alias>; target=<path>;
这是 Lesson 结构错误，不要搜索、猜测或重试，请返回 Coach 修正源文件
```

Do not change other `INVALID_TRACE` validation.

In `write-workspace.ts`, make the reflection lookup report all currently active Blocks
as `<id>:<kind>` and state that exactly one active `Kind: reflection` is required.

- [ ] **Step 3: Normalize successful receipts**

Wrap the existing trace append result:

```ts
const trace = appendTraceWithProjection(...);
return result('trace-append', {
  ok: true,
  ownerPath: context.ownerPath,
  factId: trace.eventId,
  ...trace,
});
```

Return from `lesson_close`:

```ts
{ ok: true, ownerPath, status: 'closed' }
```

Do not add an output interceptor or a generalized receipt framework.

- [ ] **Step 4: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts tests/study/write-workspace.test.ts
bun run typecheck
cd ../..
git add plugins/highschool-study/server/src/traces.ts \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/src/runtime/lesson-close.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts
git commit -m "fix: return auditable teaching write receipts"
```

Expected: focused tests and typecheck PASS.

---

## Task 5: Align Coach/Tutor Skills and current documentation

**Files:**

- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `docs/zh-CN/完整说明书.md`

- [ ] **Step 1: Update Coach authoring rules without prose tests**

The Pi Coach Skill must say:

- a new Plan starts with `coach_session: null`;
- creation is complete only after `plan_register({ planId })` returns `ok: true` and the
  Roadmap is reread;
- a prepared Lesson requires all four top-level sections, complete `Uses → Aliases`
  declarations, resolvable problem-card aliases, and exactly one explicit
  `Kind: reflection` Block;
- these checks are executability requirements, not teaching-quality scoring.

The public plugin roadmap Skill cannot call `plan_register`; it must explicitly edit
`ROADMAP.md / Plan Graph`, reread it, and only then announce completion.

The public prepare Skill receives the same Lesson shape requirements.

- [ ] **Step 2: Update Tutor fail-stop and receipt rules**

Both Tutor Skills must say:

- `LESSON_*` means the Lesson source must be repaired by Coach;
- do not search, guess, substitute, or repeat the failed call;
- tell the student that the fact was not persisted;
- only claim Trace recording or formal closure after a receipt with `ok: true`;
- ordinary parameter mistakes retain the existing single correction attempt.

Do not add hint gates, teaching rubrics, or new classroom policy.

- [ ] **Step 3: Update the authoritative functional docs**

Document in `AGENTS.md` and `docs/zh-CN/完整说明书.md`:

- Pi custom owner entry and exact reuse rule;
- Coach-only `plan_register`;
- prepared-to-active Lesson admission;
- stable `LESSON_*` errors;
- minimal successful receipt;
- public plugin remains four MCP tools.

- [ ] **Step 4: Review prose diff and run plugin release validation**

```bash
git diff --check
git diff -- \
  apps/pi-teaching-web/resources/skills \
  plugins/highschool-study/skills \
  AGENTS.md docs/zh-CN/完整说明书.md
cd plugins/highschool-study
bun run release:check
cd ../..
git add apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  plugins/highschool-study/skills/run-lesson/SKILL.md \
  AGENTS.md docs/zh-CN/完整说明书.md
git commit -m "docs: define executable teaching artifact boundaries"
```

Expected: release check PASS; no test has been added solely for Skill wording.

---

## Task 6: Full verification and one copied real-model class

**Files:**

- Create: `docs/superpowers/reports/2026-07-23-teaching-artifact-integrity-live.md`
- Verify only: `examples/derivative-demo/learning-set/**`

- [ ] **Step 1: Run the full automated gates**

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e
cd ../../plugins/highschool-study
bun run release:check
cd ../..
git diff --check
git status --short
```

Expected: all commands PASS. The only uncommitted path before live acceptance is the
new report once it is created.

- [ ] **Step 2: Create an isolated live learning set**

```bash
pilot_root="$(mktemp -d /tmp/studyforge-artifact-integrity-XXXXXX)"
cp -R examples/derivative-demo/learning-set "$pilot_root/learning-set"
printf '%s\n' "$pilot_root"
```

Never print or copy provider credentials. Use the already configured Pi provider and
model.

- [ ] **Step 3: Start the rebuilt runtime**

Choose an unused port, then run:

```bash
cd apps/pi-teaching-web
bun run build
bun run start -- \
  --learning-set "$pilot_root/learning-set" \
  --port 65321
```

Open `http://127.0.0.1:65321/`. Record the actual port if 65321 is unavailable.

- [ ] **Step 4: Run the five-boundary live flow**

Through the real Coach/Tutor UI:

1. ask Coach to create a small new Plan; verify it calls `plan_register` and the Plan
   appears after returning home;
2. deliberately place an existing foreign `coach_session` in that Plan before opening
   it; verify a fresh Coach Session is created and its Pi JSONL contains exactly one
   matching owner custom entry;
3. prepare a short Lesson, then temporarily remove one alias or change the reflection
   Kind; verify Start returns the actionable error, status stays `prepared`, and no
   Tutor Session is created;
4. have Coach repair the Lesson, start it, answer one short problem as the student, and
   verify `trace_append` returns a real receipt and writes one Trace;
5. reach Reflection, explicitly agree to close, and verify the Tutor announces formal
   closure only after `lesson_close` returns `ok: true`.

Do not coach the model around a failed structural tool call. Observe whether the new
fail-stop instruction is followed naturally.

- [ ] **Step 5: Audit remaining observations**

Write the report with this table:

```md
| Observation | Evidence | Classification | Recommended action |
|---|---|---|---|
| ... | file/session/tool event | real defect / model occasional / test false positive | fix now / observe / discard |
```

Also record:

- copied learning-set path;
- app commit;
- model/provider label without credentials;
- Plan, Lesson, Session IDs;
- whether each of the five boundaries passed;
- any model parameter retries;
- any incorrect success claim before a receipt;
- whether repository demo files stayed unchanged.

- [ ] **Step 6: Verify repository data isolation and commit the report**

```bash
git diff --exit-code -- examples/derivative-demo/learning-set
git diff --check
git add docs/superpowers/reports/2026-07-23-teaching-artifact-integrity-live.md
git commit -m "docs: report teaching artifact live acceptance"
git status --short
```

Expected: the repository demo learning set is unchanged and the worktree is clean.

---

## Final acceptance checklist

- [ ] A Plan is not announced as created before `plan_register` succeeds.
- [ ] Returning home refetches Roadmap state.
- [ ] Coach and Tutor reuse only exactly owned Pi Sessions.
- [ ] Invalid prepared Lessons cannot become active or create Tutor Sessions.
- [ ] Valid and paused Lessons preserve the expected start/resume behavior.
- [ ] Alias and reflection failures identify the exact source repair.
- [ ] Trace and close claims follow `ok: true` receipts.
- [ ] Public plugin still exposes exactly four MCP tools.
- [ ] `bun run check`, Playwright, and plugin `release:check` pass.
- [ ] One copied real-model class is completed and remaining observations are classified.
