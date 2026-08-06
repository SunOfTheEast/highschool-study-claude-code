# Bounded Lesson Risk Reviewer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 Plan Session 的子代理能力收口为材料浅召回与局部风险核验两类，并用专用 `lesson-risk-reviewer` 取代误用的 generic reviewer，在不降低数学与教学质量的前提下缩短备课关键路径。

**Architecture:** 继续复用原生 `pi-subagents` 执行和 Session artifact，但在 Plan 专属 `DefaultResourceLoader` 中注入一个运行时 `tool_call` 守卫；守卫只允许 `study-material-scout` 与 `lesson-risk-reviewer`。Reviewer 使用 fresh context、Sol high 和只读工具，只消费 Coach 提供的自足 brief。父会话投影只显示安全的“题目核验”状态，不公开 brief、子会话路径、usage 或核验正文。

**Tech Stack:** TypeScript 7、Bun test、React 19、Pi 0.81、pi-subagents 0.35.1、Markdown Skill/Agent resources。

## Global Constraints

- 保留当前 dirty worktree；只修改本计划列出的文件，不覆盖或回滚既有改动。
- 不修改用户级 Pi 配置，不向 learning set 写 `.pi/settings.json`，不 fork `pi-subagents`。
- 不把 Reviewer 变成每课必经步骤，不增加风险评分表、固定调用次数或固定秒数门槛。
- 不让 Reviewer 搜题、重写 Lesson、比较候选最优性或写文件；最终责任仍在 Plan Coach。
- 不在学生投影中暴露 subagent brief、输出、transcript、文件路径、token 或模型内部状态。
- 当前工作树存在大量未提交的用户变更；每个任务以测试与 `git diff --check` 作为检查点，不在任务间自动提交，以免误带无关文件。

---

### Task 1: 锁定专用 Reviewer 的资源契约与按需触发边界

**Files:**
- Create: `apps/pi-teaching-web/resources/subagents/lesson-risk-reviewer.md`
- Create: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/risk-review.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/prepare-approved-lesson/references/material-preparation.md`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Produces: packaged subagent name `lesson-risk-reviewer`.
- Consumes: one self-contained brief containing public task, lesson purpose, expected conclusion/route, workload, and named risk.
- Produces: exactly one compact verdict shaped as `可用 / 修改后可用 / 不建议使用`, decisive issue, and minimum necessary correction.

- [ ] Add a RED resource test in `native-session.test.ts` that reads `resources/subagents/lesson-risk-reviewer.md` and asserts:

```ts
expect(source).toContain('name: lesson-risk-reviewer');
expect(source).toContain('model: openai-codex/gpt-5.6-sol');
expect(source).toContain('thinking: high');
expect(source).toContain('defaultContext: fresh');
expect(source).toContain('tools: read');
expect(source).toContain('systemPromptMode: replace');
expect(source).toContain('inheritProjectContext: false');
expect(source).toContain('inheritSkills: false');
```

Parse the frontmatter with the existing resource helper and assert its `tools` value is exactly
`read`; do not search the prose for tool-name substrings.

- [ ] Add RED assertions that the assembled Plan Skill names only the two product agents and no longer recommends `subagent(action: "list")`.
- [ ] Create `lesson-risk-reviewer.md` with minimal frontmatter and a bright-line workflow:

```md
---
name: lesson-risk-reviewer
description: 核验一项已点名课堂内容中的决定性数学或教学风险，不搜索、不重写整课。
model: openai-codex/gpt-5.6-sol
thinking: high
tools: read
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
defaultContext: fresh
completionGuard: false
---

只核验 brief 点名的内容与风险。brief 不足时，只说明缺少哪项决定性信息。

按以下顺序返回：
1. 结论：可用 / 修改后可用 / 不建议使用
2. 决定性问题：只列会改变结论或课堂可用性的发现
3. 最低必要修正：只说需要修到哪里

不要搜索题库、比较最优候选、输出完整标准解答、设计提示梯度或重写 Lesson。
```

- [ ] Put trigger details in `references/risk-review.md`, not in the always-loaded role text: self-authored or materially adapted tasks, domain/parameter/case/equality/proof-closure risks, one self-contained brief, one bounded call, no automatic retry.
- [ ] Add a single route sentence to `prepare-approved-lesson/SKILL.md`: read `risk-review.md` only when a named candidate has a material risk; otherwise continue preparation without Reviewer.
- [ ] Delete only the capability-discovery sentence from `material-preparation.md`; preserve its existing Scout recall workflow.
- [ ] Add one concise role line to `plan-node.md`: Plan may use Scout for material recall and Reviewer for a named risk, while Coach owns the final Lesson.
- [ ] Run the targeted test and inspect the resource diff:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts
git diff --check -- resources/subagents resources/skills/prepare-approved-lesson resources/agents/plan-node.md tests/m0/native-session.test.ts
```

Expected: GREEN; Reviewer has no search/write/delegation surface, and the Plan prompt does not teach generic agent discovery.

### Task 2: Enforce the Plan subagent allowlist at runtime

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/study-subagent-guard.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Create: `apps/pi-teaching-web/tests/m0/study-subagent-guard.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`

**Interfaces:**
- Produces: `STUDY_SUBAGENTS`, `validateStudySubagentCall(input)`, and `studySubagentGuard(pi)`.
- Consumes: the mutable `input` carried by Pi's `tool_call` event for tool name `subagent`.
- Returns: `null` for allowed direct/parallel calls; a stable reason string for blocked calls.

- [ ] Write RED table tests for the pure validator. Required allowed inputs:

```ts
{ agent: 'study-material-scout', task: '召回两道题' }
{ agent: 'lesson-risk-reviewer', task: '核验定义域' }
{
  tasks: [
    { agent: 'study-material-scout', task: '槽位一' },
    { agent: 'study-material-scout', task: '槽位二' },
  ],
  concurrency: 2,
}
```

- [ ] Cover every blocked class: generic direct agent; mixed allowed/generic `tasks`; `chain`; `action: list/create/update/eject/disable`; missing or malformed target; non-object input.
- [ ] Implement the validator without rewriting arguments or guessing intent:

```ts
export const STUDY_SUBAGENTS = new Set([
  'study-material-scout',
  'lesson-risk-reviewer',
]);

export function validateStudySubagentCall(input: unknown): string | null {
  // Direct call: exactly one allowed agent.
  // Parallel call: non-empty tasks and every task names an allowed agent.
  // Everything else returns STUDY_SUBAGENT_NOT_ALLOWED.
}
```

- [ ] Register a Plan-only inline extension:

```ts
export function studySubagentGuard(pi: ExtensionAPI) {
  pi.on('tool_call', (event) => {
    if (event.toolName !== 'subagent') return;
    const reason = validateStudySubagentCall(event.input);
    return reason ? { block: true, reason } : undefined;
  });
}
```

- [ ] Add it to `DefaultResourceLoader` through `extensionFactories` only when `scope.nodeKind === 'plan'`; keep the existing `pi-subagents` extension path and do not change `noExtensions` or global settings.
- [ ] Add a loader-level test using a fake Extension API to prove Roadmap/Lesson do not receive the guard and Plan does.
- [ ] If the installed Pi event property differs from `event.input`, derive the exact property from its local TypeScript declaration and update both implementation and test; do not cast away the contract with `any`.
- [ ] Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/study-subagent-guard.test.ts tests/m0/native-session.test.ts tests/m0/subagent-path.test.ts
bun run typecheck
```

Expected: every disallowed call is blocked before child execution, while existing Scout parallel calls still pass.

### Task 3: Project Reviewer activity without leaking private evidence

**Files:**
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/projection/lesson-review.ts`
- Modify: `apps/pi-teaching-web/src/projection/conversation.ts`
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Create: `apps/pi-teaching-web/src/client/components/LessonReviewActivity.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles/course.css`
- Modify: `apps/pi-teaching-web/tests/m0/material-search-projection.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/course-ui.test.tsx`

**Interfaces:**
- Produces:

```ts
export type LessonReviewConversationItem = {
  id: string;
  kind: 'lesson-review';
  status: 'running' | 'done' | 'error';
  elapsedMs: number;
  at: string;
  updatedAt: string;
};
```

- Produces: `lessonReviewStart`, `lessonReviewEnd`, and `mergeLessonReviewItem` with the same safe-projection boundary as material search.
- Preserves: current `MaterialSearchConversationItem` behavior for Scout calls.

- [ ] Add RED live and persisted-history tests using deliberately unsafe data in the Reviewer brief/result (`题目全文`, `sessionFile`, `finalOutput`, `usage`) and assert none appears in serialized `ConversationItem`.
- [ ] Implement Reviewer recognition for a direct `agent: 'lesson-risk-reviewer'` call and a `tasks` call whose entries are all Reviewer tasks. Do not project a mixed or unknown subagent payload as a Reviewer.
- [ ] Calculate persisted wall time from the parent tool-call timestamp to tool-result timestamp. For live completion without a prior item, use only safe progress duration if present; otherwise zero.
- [ ] Update `conversation.ts` classification order for `subagent`:

```ts
const projected = materialSearchStart(...) ?? lessonReviewStart(...);
```

Use the corresponding previous item when projecting the terminal event; fall back to the existing generic hidden-detail subagent item for unrecognized calls.
- [ ] Merge live Reviewer updates by ID while preserving the first `at` and monotonic `elapsedMs`, including the existing fallback where a terminal generic subagent event replaces a running specialized item.
- [ ] Render `LessonReviewActivity` as “正在核验题目 / 题目核验完成 / 题目核验失败” with optional elapsed time only. Do not render tool args or final output.
- [ ] Suppress the duplicate “老师正在思考…” indicator while either material search or lesson review is running.
- [ ] Add UI tests for running, success and failure labels and absence of unsafe brief/result text.
- [ ] Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/material-search-projection.test.ts tests/m0/course-ui.test.tsx
bun run typecheck
```

Expected: Scout keeps its richer phase meter; Reviewer gets a separate minimal status; private child data never enters the public contract.

### Task 4: Close deterministic regressions and verify product boundaries

**Files:**
- Modify: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Modify only if required by real emitted data: `apps/pi-teaching-web/src/projection/lesson-review.ts`

**Interfaces:**
- Verifies: Plan retains the `subagent` tool but runtime targets are allowlisted.
- Verifies: only two StudyForge product agent files are available in `resources/subagents`.
- Verifies: no generic agent name is presented as a supported product capability.

- [ ] Add a static product-surface assertion that `resources/subagents` contains exactly `study-material-scout.md` and `lesson-risk-reviewer.md` after filtering Markdown files.
- [ ] Keep exact node tool assertions unchanged: Roadmap has no `subagent`; Plan has one `subagent`; Lesson has no `subagent`.
- [ ] Add an integration-level guard test that invokes the captured `tool_call` handler and verifies `{ block: true }` for `reviewer` and no block for both product agents.
- [ ] Run the complete deterministic gate:

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
git diff --check
```

- [ ] Inspect `git diff --stat` and `git status --short`; confirm no user-owned unrelated path was rewritten.

### Task 5: Run the real-model quality and latency acceptance

**Files:**
- Create: `docs/audits/2026-08-06-bounded-lesson-reviewer-acceptance.md`
- Modify only in a repository-external isolated learning set created for this acceptance.

**Interfaces:**
- Uses: Sol high Plan Coach and packaged `lesson-risk-reviewer` Sol high, fresh context.
- Produces: one no-review control, one real-risk review case, timing/usage evidence, final Lesson quality audit, and guard evidence.

- [ ] Copy a clean fixture to a new `mktemp -d` root and start the app with isolated Pi config/session directories. Record the exact root, port, provider and model settings.
- [ ] Control case: ask the Coach to prepare a Lesson from an unchanged trusted card. Verify the first attempt does not call Reviewer and the Lesson reaches `prepared` normally.
- [ ] Risk case: give the Coach an approved Lesson arrangement that requires either a genuinely self-authored problem or a material mathematical adaptation. Verify it calls `lesson-risk-reviewer` once with a bounded brief and does not ask it for a full solution or whole-Lesson rewrite.
- [ ] Record parent wall-clock segments, Reviewer duration, parent and child usage, Reviewer final-output length, and the prepared Lesson. Compare against the M0 baseline (9m54 total preparation; generic reviewer about 203s) without claiming statistical significance or imposing a fabricated cutoff.
- [ ] Independently audit the final candidate for domain, parameter range, case split, equality conditions, proof closure, lesson goal and one-hour workload. Quality must not regress merely because the Reviewer output is shorter.
- [ ] From the same Plan Session, attempt `subagent` calls to generic `reviewer`, a mixed allowed/generic task batch, and management `list`; verify each is immediately blocked and no child Session artifact appears.
- [ ] Write the acceptance report with a concise result table and a final verdict answering:
  - Did ordinary trusted material avoid Reviewer cost?
  - Did the risk case receive one useful bounded review?
  - Was duplicated deep analysis materially reduced?
  - Did mathematical and teaching quality hold?
  - Did every generic subagent path fail closed?
- [ ] Run final evidence checks:

```bash
cd apps/pi-teaching-web
bun run check
git diff --check
```

Do not mark this plan complete if the Reviewer failed but the Coach silently proceeded, if the final Lesson relies on an unverified risky claim, or if generic agents can still start.
