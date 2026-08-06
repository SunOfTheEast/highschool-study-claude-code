# Printable Lesson Handout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Lesson 已完成备课、链接、重读并公开报告可开始之后，由 Coach 询问学生是否需要讲义；只有学生明确同意，才把当前 Plan 下已链接 Lesson 的指定 `Student View` Blocks 投影成可打开、打印或另存为 PDF 的讲义。

**Architecture:** `artifact_export` 是 Plan Session 的节点绑定 Runtime 工具，不是 generic Worker Agent。工具验证当前 Plan、Lesson Tree 和 Block IDs 后，只返回一个可重建的打印 URL，不复制正文。独立 handout API 每次沿 Roadmap → Plan → Lesson 的权威树重读公开内容；React utility route 在 AppShell 之外渲染 A4 打印页。Plan Session 工具历史是讲义卡片的持久来源，不增加 export manifest、数据库、Markdown 副本或服务端 PDF 队列。

**Tech Stack:** TypeScript 7、Bun test、React 19、React Markdown/KaTeX、Pi custom tools、Playwright、CSS print media。

## Global Constraints

- 保留 dirty worktree，不回滚或覆盖已有层级树、Skill、Scout、UI 和长周期验收改动。
- 不创建 generic `worker` 子代理，不让模型重新生成、改写、总结或补齐讲义正文。
- 不建立 `.studyforge/exports`、manifest、数据库、临时 Markdown、服务端 PDF 或浏览器渲染队列。
- Lesson Markdown 的 `Student View` 是唯一正文事实源；`Teacher Control`、`Classroom Log`、聊天和推理永不进入 API 或工具结果。
- `artifact_export` 失败、页面失效或学生拒绝都不得改变 Lesson 状态，也不得阻塞开课。
- 不增加配置向导、固定确认话术或未来产物类型的空壳抽象；第一版只实现 `lesson-handout`。
- 当前工作树存在大量未提交用户改动；本计划以测试和 diff 检查为任务边界，不自动提交混杂变更。

---

### Task 1: Define one canonical public handout projection

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/study/lesson-handout.ts`
- Create: `apps/pi-teaching-web/tests/m0/lesson-handout.test.ts`

**Interfaces:**
- Produces:

```ts
export type LessonHandoutBlock = {
  id: string;
  title: string;
  kind: ActivityKind;
  studentView: string;
};

export type LessonHandout = {
  kind: 'lesson-handout';
  planId: string;
  lessonId: string;
  title: string;
  lessonGoal: string;
  blocks: LessonHandoutBlock[];
};
```

- Produces:

```ts
export function readLessonHandout(
  root: string,
  planId: string,
  lessonId: string,
  blockIds: readonly string[],
  options?: { requirePrepared?: boolean },
): LessonHandout;
```

- Consumes: `readRoadmap`, `readPlan`, `readLesson`, `planNodePath`, and `lessonNodePath`.

- [ ] Write RED tests using the nested fixture for:
  - exact ordered selection of two Blocks;
  - unknown Block ID;
  - duplicate Block ID;
  - Lesson absent from current Plan Tree even if a file exists;
  - same local Lesson ID under a different Plan;
  - mismatched Plan or Lesson `parent_id`/`parent_path`;
  - `requirePrepared: true` rejecting `active` and `closed`;
  - default/read mode accepting a linked Lesson after it becomes `active` or `closed`.
- [ ] Assert the serialized result contains selected `studentView`, title, kind and goal, but not `teacherControl`, `classroomLog`, `uses`, `raw`, unselected Block text, or Session fields.
- [ ] Implement traversal as a closed chain, never with directory enumeration:

```ts
const roadmap = readRoadmap(root);
const planRef = roadmap.plans.find((item) => item.id === planId);
if (!planRef || planRef.path !== planNodePath(planId)) fail(...);
const plan = readPlan(root, planRef.path);
const lessonRef = plan.lessons.find((item) => item.id === lessonId);
if (!lessonRef || lessonRef.path !== lessonNodePath(planId, lessonId)) fail(...);
const lesson = readLesson(root, lessonRef.path);
```

- [ ] Validate parent IDs and paths at both hops before looking up Blocks. Reject an empty `blockIds` list and reject duplicates before projection.
- [ ] Preserve the request order by mapping each verified ID; do not reorder by Lesson document order.
- [ ] Use `StudyDocumentError` with the authoritative owner path for document-integrity failures so the existing server error boundary returns 422.
- [ ] Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/lesson-handout.test.ts tests/m0/markdown-domain.test.ts
bun run typecheck
```

Expected: the helper can only expose selected public Blocks reached through the exact current course tree.

### Task 2: Bind `artifact_export` to the current Plan Session

**Files:**
- Create: `apps/pi-teaching-web/src/shared/handout-route.ts`
- Create: `apps/pi-teaching-web/src/runtime/plan-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Create: `apps/pi-teaching-web/tests/m0/plan-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`

**Interfaces:**
- Produces:

```ts
export function formatLessonHandoutPath(
  planId: string,
  lessonId: string,
  blockIds: readonly string[],
): string;
```

- Produces: `createPlanTools(root, scope)` returning one `artifact_export` tool.
- Changes: `PLAN_MODEL_TOOLS` to `read, grep, find, ls, edit, write, subagent, artifact_export`.
- Tool input:

```ts
{
  kind: 'lesson-handout';
  lessonId: string;
  blockIds: string[];
}
```

- Tool success details:

```ts
{
  kind: 'lesson-handout';
  planId: string;
  lessonId: string;
  blockIds: string[];
  title: string;
  url: string;
}
```

- [ ] Write RED route-helper tests for valid IDs, preserved Block order, an empty list, invalid IDs, duplicate IDs and round-trip-safe URL encoding. The exact public route is:

```text
/course/plan/:planId/lesson/:lessonId/handout/:blockId,blockId
```

- [ ] Write RED tool tests proving:
  - Plan ID comes from `scope.nodeId` and is not a model parameter;
  - a linked `prepared` Lesson succeeds;
  - active/closed, cross-Plan, unlinked, unknown and duplicate Blocks fail before a URL is returned;
  - success details contain no Block body;
  - every failure leaves Roadmap, Plan and Lesson bytes unchanged.
- [ ] Define TypeBox parameters with `additionalProperties: false`, `kind` as `Type.Literal('lesson-handout')`, non-empty `blockIds`, and the existing node-ID pattern.
- [ ] In `execute`, call `readLessonHandout(..., { requirePrepared: true })`, then return a compact text receipt plus safe details. Do not write any file.
- [ ] Change `customToolsForNode`:

```ts
if (scope.nodeKind === 'lesson') return createLessonTools(root, scope.nodePath);
if (scope.nodeKind === 'plan') return createPlanTools(root, scope);
return [];
```

- [ ] Keep Roadmap and Lesson tool surfaces unchanged. Update exact tool-list tests only for Plan.
- [ ] Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/plan-tools.test.ts tests/m0/native-session.test.ts tests/m0/public-surface.test.ts
bun run typecheck
```

Expected: only a Plan Session can publish a handout URL, and only for its own currently prepared child Lesson.

### Task 3: Serve a safe, reread-on-open handout API

**Files:**
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/tests/m0/server-api.test.ts`

**Interfaces:**
- Produces: `GET /api/plans/:planId/lessons/:lessonId/handout/:blockId,blockId`.
- Produces: `api.lessonHandout(planId, lessonId, blockIds): Promise<LessonHandout>`.
- Preserves: existing 404/409/422 error semantics and SPA fallback.

- [ ] Add RED API tests for a prepared Lesson and then mutate its status to `active` and `closed`; the same URL must continue to serve its current public projection.
- [ ] Add rejection tests for malformed route IDs, empty/duplicate lists, cross-Plan or unlinked Lesson, missing source and corrupt parent metadata.
- [ ] Assert a successful JSON response omits these exact private sentinels from the fixture: one `Teacher Control` phrase, one `Classroom Log` phrase, one unselected Block phrase, `session_id`, and `raw`.
- [ ] Parse the final path segment as a comma-separated ID list using the shared ID validator. Do not accept a filesystem path or a JSON body.
- [ ] Call `readLessonHandout` with default `requirePrepared: false`; the URL was authorized at publication time and remains a stable projection after Lesson lifecycle changes.
- [ ] Keep API construction symmetric with `formatLessonHandoutPath`; derive the API path from the same validated identifiers rather than copying raw route text.
- [ ] Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/server-api.test.ts tests/m0/lesson-handout.test.ts
bun run typecheck
```

Expected: changing URL parameters can only request another fully revalidated public projection, never bypass the Plan tree.

### Task 4: Restore a dedicated handout card from live and persisted tool history

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/projection/lesson-handout.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation.ts`
- Create: `apps/pi-teaching-web/src/client/components/LessonHandoutActivity.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/course.css`
- Modify: `apps/pi-teaching-web/tests/m0/material-search-projection.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/course-ui.test.tsx`

**Interfaces:**
- Produces:

```ts
export type LessonHandoutConversationItem = {
  id: string;
  kind: 'lesson-handout';
  status: 'running' | 'done' | 'error';
  title: string | null;
  url: string | null;
  at: string;
};
```

- Produces: `lessonHandoutStart` and `lessonHandoutEnd` that recognize only `toolName === 'artifact_export'` and `details.kind === 'lesson-handout'`.

- [ ] Add RED live projection tests: start shows a non-sensitive publication status; success uses only `title` and validated same-origin path `url`; error exposes no raw tool args or error body.
- [ ] Add persisted-history reconstruction test proving a page reload produces the same successful card from the native tool call/result pair without a manifest.
- [ ] Seed unsafe `blockIds`, Lesson source, `teacherControl`, and arbitrary output into test events and assert none appears in serialized `ConversationItem` except the already validated public URL.
- [ ] Project `artifact_export` before the generic tool fallback in both persisted and live paths. A malformed success result becomes an error-state handout item, not an inspectable generic tool.
- [ ] Render:
  - running: `正在整理讲义`;
  - success: title plus an anchor `查看并打印讲义`;
  - failure: `讲义暂时没有生成，课程仍可开始`.
- [ ] Ensure the anchor is same-origin and opens the utility route; do not use `target="_blank"` unless the existing app navigation tests show it is required for preserving the Plan Session.
- [ ] Keep `artifact_export` out of generic `<details>` so raw details can never be expanded.
- [ ] Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/material-search-projection.test.ts tests/m0/course-ui.test.tsx
bun run typecheck
```

Expected: the Plan transcript itself restores a safe handout card, and no copied teaching body is stored in the conversation projection.

### Task 5: Add the standalone A4 print view

**Files:**
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/LessonHandoutPage.tsx`
- Create: `apps/pi-teaching-web/src/client/styles/handout.css`
- Modify: `apps/pi-teaching-web/src/client/main.tsx`
- Modify: `apps/pi-teaching-web/tests/m0/course-ui.test.tsx`

**Interfaces:**
- Adds browser route:

```ts
{
  kind: 'lesson-handout';
  planId: string;
  lessonId: string;
  blockIds: string[];
}
```

- `LessonHandoutPage` consumes only `LessonHandout`, `loading/error`, and an `onPrint` callback.

- [ ] Add RED route parsing/formatting tests for one and multiple Blocks, bad IDs, duplicates, trailing slash, malformed comma lists and a full round trip.
- [ ] Add RED static-render tests proving the page includes Lesson title, goal, name/date blanks, selected Block titles, Markdown math markup and a `打印 / 另存为 PDF` button; it must exclude Course Tree, chat, Teacher Control and unselected content.
- [ ] In `App`, recognize the utility route before loading course/session history. Load only `api.lessonHandout`; do not connect it to selected Session state or primary navigation.
- [ ] Render `LessonHandoutPage` outside `AppShell`. On error, show a clear source-invalid message and a link back to the owning Lesson route; do not scan or substitute content.
- [ ] Use existing `MarkdownView` for Lesson goal and every `studentView` so KaTeX behavior stays identical.
- [ ] Give each Block a stable heading and answer-space class based only on existing `ActivityKind`; keep whitespace moderate and printable instead of generating model-authored worksheets.
- [ ] Implement CSS with:
  - centered paper preview on screen;
  - `@page { size: A4; margin: 16mm 15mm 18mm; }`;
  - `break-after: avoid` for headings and `break-inside: avoid` for short activity wrappers;
  - print-safe black text and hidden `.handout-actions`;
  - no AppShell chrome in either screen or print markup.
- [ ] Wire the button directly to `window.print()`; do not introduce PDF dependencies.
- [ ] Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/course-ui.test.tsx
bun run build
bun run typecheck
```

Expected: the utility page is readable on screen and produces an A4 system print dialog without a second rendering service.

### Task 6: Put the consent boundary in the preparation workflow

**Files:**
- Create: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/printable-handout.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Trigger state: Lesson write succeeded → linked in current Plan Tree → reread parses as `prepared` → public ready report already sent.
- Student confirmation: explicit “要 / 可以 / 嗯” permits one export; refusal, uncertainty, silence or continuing to another action does not.

- [ ] Add RED resource assertions that the root Skill routes to `printable-handout.md` only after its existing write/link/reread/report steps and names `artifact_export` only in the confirmed branch.
- [ ] Write the reference as one bright-line sequence:

```text
课程已经可以开始
→ 简短询问是否需要讲义，并说明准备包含哪些公开 Blocks
→ 明确同意：按确认顺序调用 artifact_export
→ 拒绝/暂不/无回应：结束，不调用
→ 导出失败：说明可稍后再试，不回滚 Lesson
```

- [ ] State that Coach selects existing public Blocks; it must not ask the publication tool to add explanations, solve problems or include Teacher Control.
- [ ] Keep the question natural and compact; do not add a second formal approval gate or a fixed phrase snapshot.
- [ ] Add one concise Plan role sentence that `artifact_export` publishes selected public Lesson Blocks after student consent; keep all timing detail in the reference.
- [ ] Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
git diff --check -- resources/skills/prepare-approved-lesson resources/agents/plan-node.md
```

Expected: Skill text cannot justify early, silent or content-generating export.

### Task 7: Validate the end-to-end consent, persistence and print boundary

**Files:**
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`
- Modify: `apps/pi-teaching-web/tests/m0/server-api.test.ts`
- Create: `docs/audits/2026-08-06-printable-lesson-handout-acceptance.md`

**Interfaces:**
- Deterministic fixture emits native `artifact_export` start/end events only after a Plan message explicitly asks for the already-offered handout.
- Real-model acceptance uses Sol high Coach and a repository-external learning set.

- [ ] Extend the fake Plan turn so a student message `要讲义` emits an `artifact_export` call/result with a real fixture Lesson and two selected Blocks. Do not preseed the card before consent.
- [ ] Extend Playwright E2E:
  - reach the Plan after its Lesson is prepared;
  - send explicit consent;
  - see `查看并打印讲义`;
  - reload Plan and see the same card from history;
  - open the card and verify title, goal and selected Student Views;
  - verify private sentinel text and unselected Block text are absent;
  - intercept or spy on `window.print()` and click the print button;
  - navigate back and start the Lesson normally.
- [ ] Add a refusal control in an API/projection test: no `artifact_export` event means no card and no Lesson mutation. Do not attempt to prove language understanding with a brittle fixed-dialogue unit test.
- [ ] Run the complete deterministic gate:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
git diff --check
```

- [ ] In an isolated real-model Plan Session, let the Coach finish one Lesson preparation. Verify its first public response says the Lesson is ready and asks about a handout only afterward.
- [ ] Decline once and verify no `artifact_export`; then explicitly agree in a second prepared Lesson case and verify exactly one tool call, a safe card, a working print page, and unchanged Lesson bytes/state.
- [ ] Record user-visible wait from consent to card, because the first version should be effectively immediate and must not invoke a model Worker or background queue.
- [ ] Write the audit report around final outcomes: timing of the question, consent behavior, public-content integrity, print usability, persistence after reload, and non-blocking failure behavior.

Do not mark this plan complete if the card appears before explicit confirmation, if the API can expose private Lesson sections, if the URL depends on a copied manifest, or if export failure changes the Lesson lifecycle.
