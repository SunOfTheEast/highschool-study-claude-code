# 长期学情融合与个性化 Plan 规划 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Coach 在 Plan 边界把跨周期学习事实融合为可解释、可证伪的下一 Plan，并用受控真实模型实验检验长期历史是否真正改变且改善教学决策。

**Architecture:** 新增一个由 Coach 按需加载的 `plan-next-cycle` Skill；它复用现有 Markdown、四个 MCP 工具和 Dynamic Workflow，不新增 Agent、数据库或能力分数。`plan-next-cycle` 创建的新 Plan 用 `Planning Basis` 保存规划依据，现有 `Plan Summary` 在周期结束时回看判断与干预结果；Pi 读取并在当前 Plan 页面展示该依据。

**Tech Stack:** Markdown Skills、Bun 1.3、TypeScript 7、React 19、React Markdown、Pi coding-agent 0.81、Playwright 1.61、Claude Code plugin manifest

## Global Constraints

- 权威设计：`docs/superpowers/specs/2026-07-27-longitudinal-personalized-planning-design.md`。
- 不新增 MCP 工具、数据库、向量库、长期记忆文件、能力分数、规则引擎或学生可见 Agent。
- `Planning Basis` 对 `plan-next-cycle` 创建的新 Plan 必填；读取层对旧 Plan 保持可选兼容。
- Coach 负责最终研判和写入；Evidence Scout 只读返回紧凑发现与来源，不能决定 Plan。
- 只有多个独立问题确实会改变决策时才启动多个 Scout；不得固定凑满三个任务。
- 未经学生确认，不写入或注册下一 Plan。
- 不给 Skill/Agent 正文增加字符串匹配测试；只测试工具边界、资源装配、Markdown 投影和可见 UI。
- 真实模型验收只使用 `/tmp` 隔离副本；不得修改 `examples/derivative-demo/learning-set/**`。
- 错配 Plan 只用于模拟验收，不得故意施加给真实学生。
- 验收期间冻结产品代码和 Prompt；发现问题只记录，不在实验中途修补。
- 导数题卡、两种历史模式和实验标签只属于本轮受控验收，不得写成产品枚举、
  固定学生类型或 Prompt 分支。
- 最终结论只能是 `PERSONALIZATION_CONFIRMED`、`PLANNING_ONLY` 或 `NO_EFFECT`，并明确只适用于本轮受控实验。

---

## File Structure

### Product files

- `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
  Pi Coach 的 Plan 级学情研判工作流。
- `plugins/highschool-study/skills/plan-next-cycle/SKILL.md`
  Claude Code 插件中的等价工作流。
- `apps/pi-teaching-web/src/runtime/resource-loader.ts`
  只向 Coach 装配 `plan-next-cycle`，Tutor 不可见。
- `apps/pi-teaching-web/src/shared/contracts.ts`
  在 `PlanSummary` 中投影完整 `planningBasis: string`。
- `apps/pi-teaching-web/src/study/read-workspace.ts`
  读取可选 `## Planning Basis`。
- `apps/pi-teaching-web/src/client/components/PlanRationale.tsx`
  单独负责学生可见的“为什么这样安排”。
- `apps/pi-teaching-web/src/client/components/SessionTree.tsx`
  在当前 Plan 上下文中装配 `PlanRationale`。
- `apps/pi-teaching-web/src/client/styles.css`
  使用现有留白主题样式该区域。

### Teaching workflow files

- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
  在 Plan 边界加载新 Skill，并在 Plan 结束时回看 `Planning Basis`。
- `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`
  允许本工作流从一到三个真正独立的问题中选择，不固定三路。
- `plugins/highschool-study/skills/study/SKILL.md`
  把“选择下一 Plan / 重规划”路由给新 Skill。
- `plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md`
  保留首次 Roadmap 设计职责，避免吞并长期学情研判。
- `plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md`
  完成 Plan 时把初始判断与实际结果写入 Plan Summary；证据不足时不声称干预有效。

### Tests and documentation

- `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- `apps/pi-teaching-web/tests/client/plan-rationale.test.tsx`
- `apps/pi-teaching-web/tests/client/session-tree.test.tsx`
- `apps/pi-teaching-web/tests/client/state.test.ts`
- `apps/pi-teaching-web/tests/runtime/resource-loader.test.ts`
- `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/plans/domain-integrity.md`
- `apps/pi-teaching-web/README.md`
- `plugins/highschool-study/README.md`
- `docs/design/architecture.zh-CN.md`
- `docs/design/architecture.en.md`
- `docs/zh-CN/完整说明书.md`
- `docs/audits/2026-07-27-longitudinal-personalization-acceptance.md`

---

### Task 1: Project optional `Planning Basis` through the Pi workspace contract

**Files:**
- Modify: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/plans/domain-integrity.md`
- Modify: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/read-workspace.ts`
- Modify: `apps/pi-teaching-web/tests/client/session-tree.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`

**Interfaces:**
- Produces: `PlanSummary.planningBasis: string`.
- Consumes: existing `section(body, heading)` helper; an absent section maps to `''`.
- Compatibility: every old Plan remains readable without migration.

- [ ] **Step 1: Put one real `Planning Basis` in the isolated Plan fixture**

Insert between `## Test` and `## Lesson Index`:

```markdown
## Planning Basis

当前判断是定义域遗漏已经成为稳定阻塞点，而不是一次计算失误。

关键来源：[Lesson 001](../lessons/lesson-001.md#trace-event-001)、
[Lesson 002](../lessons/lesson-002.md#trace-event-001)。

若连续独立核验仍出现遗漏，就重新检查是否需要更基础的函数条件诊断。
```

- [ ] **Step 2: Write the failing reader assertion**

Add to `tests/study/read-workspace.test.ts`:

```ts
expect(workspace.plan.planningBasis)
  .toContain('定义域遗漏已经成为稳定阻塞点');
expect(learningSet.plans[0]?.planningBasis)
  .toBe(workspace.plan.planningBasis);
```

- [ ] **Step 3: Run the focused test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts
```

Expected: FAIL because `planningBasis` is not present on `PlanSummary`.

- [ ] **Step 4: Add the contract and reader projection**

Change `PlanSummary` in `src/shared/contracts.ts`:

```ts
export type PlanSummary = {
  id: string;
  title: string;
  path: string;
  status: string;
  goal: string;
  capabilityStandard: string;
  planningBasis: string;
};
```

Change `planSummary()` in `src/study/read-workspace.ts`:

```ts
return {
  id: document.id,
  title: title(document.body).replace(/^Plan[:：]\s*/, ''),
  path: planPath,
  status: scalar(document.frontmatter, 'status') ?? 'unknown',
  goal: section(document.body, 'Goal'),
  capabilityStandard: section(document.body, 'Observable Capability Standard'),
  planningBasis: section(document.body, 'Planning Basis'),
};
```

Add `planningBasis: ''` to the synthetic `PlanSummary` literals in
`tests/client/session-tree.test.tsx` and `tests/client/state.test.ts`.

- [ ] **Step 5: Run focused tests and typecheck**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts tests/client/session-tree.test.tsx tests/client/state.test.ts
bun run typecheck
```

Expected: all focused tests PASS and TypeScript exits 0.

- [ ] **Step 6: Commit the projection**

```bash
git add \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/study/read-workspace.ts \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/plans/domain-integrity.md \
  apps/pi-teaching-web/tests/study/read-workspace.test.ts \
  apps/pi-teaching-web/tests/client/session-tree.test.tsx \
  apps/pi-teaching-web/tests/client/state.test.ts
git commit -m "feat: project plan planning basis"
```

---

### Task 2: Show “为什么这样安排” on the current Plan page

**Files:**
- Create: `apps/pi-teaching-web/src/client/components/PlanRationale.tsx`
- Create: `apps/pi-teaching-web/tests/client/plan-rationale.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/SessionTree.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`

**Interfaces:**
- Consumes: `workspace.plan.planningBasis`.
- Produces: `PlanRationale({ value }: { value: string })`; returns `null` for empty
  or whitespace-only content.
- Reuses: `MarkdownView`; no new API endpoint or source-view schema.

- [ ] **Step 1: Write the failing component test**

Create `tests/client/plan-rationale.test.tsx`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { PlanRationale } from '../../src/client/components/PlanRationale';

test('shows a compact plan rationale only when Planning Basis exists', () => {
  const visible = renderToStaticMarkup(
    <PlanRationale value={'当前判断：需要练迁移。\n\n来源：[Lesson](../lessons/l.md#lesson-summary)'} />,
  );
  expect(visible).toContain('为什么这样安排');
  expect(visible).toContain('需要练迁移');
  expect(visible).toContain('../lessons/l.md#lesson-summary');
  expect(renderToStaticMarkup(<PlanRationale value="  " />)).toBe('');
});
```

- [ ] **Step 2: Run the component test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/plan-rationale.test.tsx
```

Expected: FAIL because `PlanRationale.tsx` does not exist.

- [ ] **Step 3: Implement the focused component**

Create `src/client/components/PlanRationale.tsx`:

```tsx
import { MarkdownView } from './MarkdownView';

export function PlanRationale({ value }: { value: string }) {
  if (!value.trim()) return null;
  return (
    <section className="plan-rationale" aria-labelledby="plan-rationale-title">
      <span>Planning basis</span>
      <h3 id="plan-rationale-title">为什么这样安排</h3>
      <div className="plan-rationale-copy">
        <MarkdownView>{value}</MarkdownView>
      </div>
    </section>
  );
}
```

Import it in `SessionTree.tsx` and place it immediately after `.tree-context`:

```tsx
<PlanRationale value={workspace.plan.planningBasis} />
```

Add restrained styles in `styles.css`:

```css
.plan-rationale {
  margin: 0 .5rem 1.2rem;
  padding: 1rem 0 1.15rem;
  border-block: 1px solid var(--rule);
}
.plan-rationale > span {
  color: var(--accent);
  font: .62rem/1.4 ui-monospace, monospace;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.plan-rationale h3 {
  margin: .45rem 0 .65rem;
  font-family: var(--font-display);
  font-size: 1rem;
  font-weight: 500;
}
.plan-rationale-copy {
  color: var(--ink-soft);
  font-size: .74rem;
  line-height: 1.7;
}
.plan-rationale-copy p { margin: .45rem 0 0; }
.plan-rationale-copy a { color: var(--accent); }
```

- [ ] **Step 4: Run component and existing SessionTree tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/plan-rationale.test.tsx tests/client/session-tree.test.tsx
```

Expected: both test files PASS.

- [ ] **Step 5: Add one browser acceptance**

Append to `tests/e2e/workspace.spec.ts`:

```ts
test('shows the current Plan planning rationale', async ({ page }) => {
  await page.goto('/plan/domain-integrity');
  const rationale = page.getByRole('region', { name: '为什么这样安排' });
  await expect(rationale).toBeVisible();
  await expect(rationale).toContainText('定义域遗漏已经成为稳定阻塞点');
  await expect(rationale).not.toContainText('Teacher Control');
});
```

If the `section` name is not exposed from `aria-labelledby` in the installed browser,
use `page.locator('.plan-rationale')` while retaining the accessibility label.

- [ ] **Step 6: Run browser verification**

Run:

```bash
cd apps/pi-teaching-web
bun run build
bunx playwright test tests/e2e/workspace.spec.ts --grep "planning rationale"
```

Expected: build exits 0 and the focused Playwright test passes.

- [ ] **Step 7: Commit the student-visible rationale**

```bash
git add \
  apps/pi-teaching-web/src/client/components/PlanRationale.tsx \
  apps/pi-teaching-web/src/client/components/SessionTree.tsx \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/tests/client/plan-rationale.test.tsx \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts
git commit -m "feat: show personalized plan rationale"
```

---

### Task 3: Add the Pi Coach next-cycle planning Skill

**Files:**
- Create: `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/resource-loader.test.ts`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`

**Interfaces:**
- Produces: `roleSkillNames(role: SessionRole): string[]`.
- Coach skills: `coach-study`, `plan-next-cycle`, `deep-workflow`.
- Tutor skills: `tutor-lesson`, `deep-workflow`.
- The Skill creates a new Plan through existing `write` / `edit`, then calls existing
  `plan_register`; when the decision only revises the active Plan, it uses existing
  `plan_update` instead.

- [ ] **Step 1: Write the failing role-bound resource test**

Update `tests/runtime/resource-loader.test.ts`:

```ts
type RoleSkillNames = (role: 'coach' | 'tutor') => string[];

function roleSkillNames(): RoleSkillNames {
  const value = (resourceLoader as Record<string, unknown>).roleSkillNames;
  expect(value).toBeFunction();
  return value as RoleSkillNames;
}

test('offers next-cycle planning only to Coach', () => {
  expect(roleSkillNames()('coach')).toEqual([
    'coach-study',
    'plan-next-cycle',
    'deep-workflow',
  ]);
  expect(roleSkillNames()('tutor')).toEqual([
    'tutor-lesson',
    'deep-workflow',
  ]);
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/resource-loader.test.ts
```

Expected: FAIL because `roleSkillNames` does not exist.

- [ ] **Step 3: Implement role-scoped skill loading**

In `src/runtime/resource-loader.ts`, extend the existing `session-scope` import while
keeping the current `SessionRole` re-export:

```ts
import {
  formatSessionOwnerContext,
  type SessionRole,
  type StudySessionScope,
} from './session-scope';
```

Then add:

```ts
export function roleSkillNames(role: SessionRole): string[] {
  return role === 'coach'
    ? ['coach-study', 'plan-next-cycle', 'deep-workflow']
    : ['tutor-lesson', 'deep-workflow'];
}
```

Replace the current `skillPath` / `deepWorkflowSkillPath` pair with:

```ts
const skillPaths = roleSkillNames(role)
  .map((name) => join(resourceRoot, 'skills', name, 'SKILL.md'));
```

and pass:

```ts
additionalSkillPaths: skillPaths,
```

- [ ] **Step 4: Create the Pi `plan-next-cycle` Skill**

Create `resources/skills/plan-next-cycle/SKILL.md` with this complete behavioral contract:

```markdown
---
name: plan-next-cycle
description: Use when accumulated learning evidence may change whether the student continues, revises, diagnoses, or starts the next Plan.
---

# Plan Next Cycle

Coach owns the judgment and final write. Tutor evidence, cards, summaries, profiles,
planner attention, and child findings are inputs, not verdicts.

## Establish the decision

Read the Roadmap, relevant Plan Summaries, confirmed profiles, and LEARNING_GUIDE.md.
Use Lesson Summary as a retrieval entry and active Trace for claims about student
performance. Read planner attention only as a preparation signal. Do not bulk-load
old Lessons; open a source only when it could change the decision.

Reconstruct change over time: independence, support, transfer, retention, recurring
student reasoning, and response to prior teaching moves. A score or method label can
locate a question but cannot explain its cause.

If no prior evidence exists, treat the student's account as unverified starting
context and recommend a first diagnostic Plan. A missing or broken source makes its
claim unverified; never replace it with an inferred fact.

When materially different explanations would lead to different Plans, compare only
the plausible alternatives. If direct evidence already determines the next useful
step, do not invent competing hypotheses. If key alternatives remain unresolved,
recommend a short diagnostic Plan.

Choose one leverage point that matters to the Roadmap and can plausibly change within
one Plan. Do not mechanically choose the lowest signal.

## Optional evidence workflow

Use direct evidence when it is sufficient. When relevant history is broad, conflicting,
or direction-changing and deep mode is enabled, load deep-workflow. Ask one to three
independent Evidence Scout questions selected from capability trajectory, recurring
reasoning, and response to prior teaching. Do not create a task merely to fill a
category. Scouts return findings and exact sources; they never select the Plan.
If a workflow returns only partial results, use them only when the remaining evidence
is sufficient; otherwise keep the decision diagnostic or unresolved.

## Discuss and persist

Present one recommended next Plan or diagnostic Plan in student language. Explain the
current judgment, the sources that changed the decision, uncertainty, and what later
result would support or overturn it. The student may reject, revise, reorder, pause,
or choose another eligible direction.

If the confirmed decision keeps the current Plan and only changes its next teaching
move, use plan_update and preserve the original Planning Basis. Record the revised
judgment in Current Position and Plan Summary so the initial hypothesis remains
auditable. Create a new Plan only when the decision starts a new learning cycle.

Only after explicit confirmation, write the canonical plans/<plan-id>.md. Include
Goal, Observable Capability Standard, Test, Planning Basis, Lesson Index, Current
Position, Next Lesson Candidate, and Plan Summary. Planning Basis must contain:

- the current judgment and why this direction matters now;
- direct source links that actually changed the choice;
- a validation or replanning signal.

Use natural prose or a short list; do not force unused fields. Call plan_register,
reread the Plan and Roadmap, and report only the persisted state.

At Plan completion, compare its Planning Basis with active evidence in Plan Summary.
State an intervention effect only when classroom evidence supports it. Preserve
unverified transfer, retention, and causal claims as open.
```

- [ ] **Step 5: Route Pi Coach and generalize the existing workflow guidance**

Add to `resources/skills/coach-study/SKILL.md`, immediately before `## Prepare the next Lesson`:

```markdown
## Choose or revise the Plan

When accumulated evidence may change the current direction or the student asks what
to study next, load `plan-next-cycle`. Ordinary post-Lesson review and preparation
remain here. Do not jump from a low method signal directly to a new Plan.
```

In its Plan completion paragraph, require the final Plan Summary to compare any
existing `Planning Basis` with active evidence, without claiming an intervention
effect when the record cannot support one.

Change `resources/skills/deep-workflow/SKILL.md` so the ordinary retrieval default
remains one Quick Evidence Scout, while `plan-next-cycle` may select one to three
independent Scout questions. Preserve the existing student confirmation rule for
dependent/deep waves and the 180-second Quick limit.

Do not add tests that assert these prose sentences.

- [ ] **Step 6: Run focused and full Pi checks**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/resource-loader.test.ts
bun run check
```

Expected: resource-loader tests, all non-E2E tests, typecheck and Vite build PASS.

- [ ] **Step 7: Commit the Pi workflow**

```bash
git add \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md \
  apps/pi-teaching-web/src/runtime/resource-loader.ts \
  apps/pi-teaching-web/tests/runtime/resource-loader.test.ts
git commit -m "feat: add pi next-cycle planning skill"
```

---

### Task 4: Add the equivalent Claude Code plugin workflow

**Files:**
- Create: `plugins/highschool-study/skills/plan-next-cycle/SKILL.md`
- Modify: `plugins/highschool-study/skills/study/SKILL.md`
- Modify: `plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md`
- Modify: `plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md`
- Modify: `plugins/highschool-study/tests/contract/package-and-template.test.ts`
- Modify: `plugins/highschool-study/tests/contract/agent-and-skills.test.ts`

**Interfaces:**
- New invocable route: `highschool-study:plan-next-cycle`.
- Allowed tools: filesystem reads/writes, Skill, read-only internal
  `Agent(highschool-study:lesson-designer)`, `card_search`, `trace_search`,
  `source_resolve`.
- Forbidden: `trace_append`; Plan planning never writes classroom evidence.

- [ ] **Step 1: Write failing packaging and tool-boundary tests**

In `tests/contract/package-and-template.test.ts`, add to the existing asset list:

```ts
'skills/plan-next-cycle/SKILL.md',
```

In `tests/contract/agent-and-skills.test.ts`, extend the tool-boundary test:

```ts
const nextCycle = toolList(
  'skills/plan-next-cycle/SKILL.md',
  'allowed-tools',
);
expect(nextCycle).toContain('Write');
expect(nextCycle).toContain('Edit');
expect(nextCycle).toContain(mcp.traceSearch);
expect(nextCycle).toContain(mcp.sourceResolve);
expect(nextCycle).not.toContain(mcp.traceAppend);
```

These assertions inspect packaging and tool authority only; do not assert Skill prose.

- [ ] **Step 2: Run the contract tests and verify RED**

Run:

```bash
cd plugins/highschool-study
bun test tests/contract/package-and-template.test.ts tests/contract/agent-and-skills.test.ts
```

Expected: FAIL because the Skill file is absent.

- [ ] **Step 3: Create the complete plugin Skill**

Create `skills/plan-next-cycle/SKILL.md`:

```markdown
---
name: plan-next-cycle
description: Use when accumulated learning evidence may change whether the student continues, revises, diagnoses, or starts the next Plan.
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Agent(highschool-study:lesson-designer), mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

# Plan Next Cycle

Coach owns the judgment and final write. Tutor evidence, cards, summaries, profiles,
planner attention, and child findings are inputs, not verdicts.

## Establish the decision

Read the Roadmap, relevant Plan Summaries, confirmed profiles, and LEARNING_GUIDE.md.
Use Lesson Summary as a retrieval entry and active Trace for claims about student
performance. Read planner attention only as a preparation signal. Do not bulk-load
old Lessons; open a source only when it could change the decision.

Reconstruct change over time: independence, support, transfer, retention, recurring
student reasoning, and response to prior teaching moves. A score or method label can
locate a question but cannot explain its cause.

If no prior evidence exists, treat the student's account as unverified starting
context and recommend a first diagnostic Plan. A missing or broken source makes its
claim unverified; never replace it with an inferred fact.

When materially different explanations would lead to different Plans, compare only
the plausible alternatives. If direct evidence already determines the next useful
step, do not invent competing hypotheses. If key alternatives remain unresolved,
recommend a short diagnostic Plan.

Choose one leverage point that matters to the Roadmap and can plausibly change within
one Plan. Do not mechanically choose the lowest signal.

## Optional evidence workflow

Use direct evidence when it is sufficient. For broad, conflicting, or direction-changing
history, delegate one to three genuinely independent evidence questions to
Agent(highschool-study:lesson-designer). Select questions from capability trajectory,
recurring reasoning, and response to prior teaching; do not create a task merely to
fill a category. The delegate returns compact paths, findings, conflicts and uncertainty.
It cannot write learning facts or select the Plan.
If delegation returns only partial results, use them only when the remaining evidence
is sufficient; otherwise keep the decision diagnostic or unresolved.

## Discuss and persist

Present one recommended next Plan or diagnostic Plan in student language. Explain the
current judgment, the sources that changed the decision, uncertainty, and what later
result would support or overturn it. The student may reject, revise, reorder, pause,
or choose another eligible direction.

If the confirmed decision keeps the current Plan and only changes its next teaching
move, edit the existing Current Position, Next Lesson Candidate and Plan Summary while
preserving the original Planning Basis. Create a new Plan only when the decision
starts a new learning cycle.

Only after explicit confirmation, write the canonical plans/<plan-id>.md inside the
real learning-set root.
Include Goal, Observable Capability Standard, Test, Planning Basis, Lesson Index,
Current Position, Next Lesson Candidate, and Plan Summary. Planning Basis must contain:

- the current judgment and why this direction matters now;
- direct source links that actually changed the choice;
- a validation or replanning signal.

Use natural prose or a short list; do not force unused fields. Add the canonical Plan
link under ROADMAP.md / Plan Graph, reread both files, and report only the persisted
state.

At Plan completion, compare its Planning Basis with active evidence in Plan Summary.
State an intervention effect only when classroom evidence supports it. Preserve
unverified transfer, retention, and causal claims as open.
```

- [ ] **Step 4: Fix the plugin routing boundary**

Update `skills/study/SKILL.md` so the final route sequence becomes:

```markdown
6. If the current Plan meets its standard and the student chooses completion, route
   through `highschool-study:consolidate-plan-memory`.
7. If accumulated evidence may change the direction, no active Plan remains, or the
   student asks what to study next, route to `highschool-study:plan-next-cycle`.
8. Otherwise continue the selected active Plan and prepare its next Lesson.
```

Add one sentence to `start-or-revise-roadmap/SKILL.md`: it owns the first long-term
goal and explicit Roadmap restructuring; evidence-driven next-cycle selection belongs
to `plan-next-cycle`.

Update `consolidate-plan-memory/SKILL.md`: when `Planning Basis` exists, the persisted
Plan Summary compares its initial judgment to active evidence and distinguishes
supported, refuted and still-unverified claims. It may describe an intervention
effect only when Lesson/Trace sources support that statement.

- [ ] **Step 5: Run plugin release verification**

Run:

```bash
cd plugins/highschool-study
bun run release:check
```

Expected: typecheck PASS, all plugin tests PASS, build PASS, and strict
`claude plugin validate` PASS. Public MCP tool count remains exactly four.

- [ ] **Step 6: Commit the plugin workflow**

```bash
git add \
  plugins/highschool-study/skills/plan-next-cycle/SKILL.md \
  plugins/highschool-study/skills/study/SKILL.md \
  plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md \
  plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md \
  plugins/highschool-study/tests/contract/package-and-template.test.ts \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "feat: add plugin next-cycle planning skill"
```

---

### Task 5: Document the longitudinal decision loop and run deterministic regression

**Files:**
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `plugins/highschool-study/README.md`
- Modify: `docs/design/architecture.zh-CN.md`
- Modify: `docs/design/architecture.en.md`
- Modify: `docs/zh-CN/完整说明书.md`

**Interfaces:**
- Documents one loop: `Planning Basis → Lesson/Trace → Plan Summary → next-cycle`.
- Distinguishes confirmed preference memory from ability evidence and planning hypotheses.

- [ ] **Step 1: Update the Pi README**

Add a “长期学情研判” subsection stating:

- Coach loads `plan-next-cycle` only for direction-changing decisions;
- old Plan summaries index the history; exact Lesson/Trace opens only when material;
- `Planning Basis` explains why the current Plan exists;
- the current Plan page shows this rationale;
- Plan Summary later checks whether the judgment and teaching move held up;
- deep mode may run one to three independent evidence questions, never a fixed panel.

- [ ] **Step 2: Update plugin and architecture documentation**

Add the same semantic loop to the plugin README and both architecture documents.
Keep the following boundary explicit in Chinese and English:

```text
confirmed profiles = durable student-approved preferences
active Trace = classroom performance facts
Planner Attention = rebuildable preparation signal
Planning Basis = one Plan's source-linked working judgment
Plan Summary = outcome and retrieval index
```

Update `docs/zh-CN/完整说明书.md` with the student-visible sequence:

```text
Coach 回溯长期轨迹
  → 提出下一 Plan 或诊断 Plan
  → 学生确认
  → 页面显示“为什么这样安排”
  → 多节课产生新证据
  → Plan Summary 回看判断是否成立
```

- [ ] **Step 3: Run documentation and repository boundary checks**

Run:

```bash
git diff --check
rg -n "Planning Basis|plan-next-cycle|为什么这样安排" \
  apps/pi-teaching-web/README.md \
  plugins/highschool-study/README.md \
  docs/design/architecture.zh-CN.md \
  docs/design/architecture.en.md \
  docs/zh-CN/完整说明书.md
git diff --exit-code HEAD -- examples/derivative-demo/learning-set
```

Expected: no whitespace errors; every document names the new loop; repository demo
learning state is unchanged.

- [ ] **Step 4: Run full automated verification**

Run in parallel:

```bash
cd plugins/highschool-study && bun run release:check
```

```bash
cd apps/pi-teaching-web && bun run check && bun run test:e2e
```

Expected:

- plugin typecheck, tests, build and strict validation PASS;
- Pi typecheck, unit tests and build PASS;
- all Playwright tests PASS;
- no new public MCP tool appears.

- [ ] **Step 5: Commit documentation**

```bash
git add \
  apps/pi-teaching-web/README.md \
  plugins/highschool-study/README.md \
  docs/design/architecture.zh-CN.md \
  docs/design/architecture.en.md \
  docs/zh-CN/完整说明书.md
git commit -m "docs: explain longitudinal personalized planning"
```

---

### Task 6: Run the blinded history-interchange planning experiment

**Files:**
- Create: `docs/audits/2026-07-27-longitudinal-personalization-acceptance.md`
- Do not modify: product source, Skills, prompts, or repository learning-set fixtures.

**Interfaces:**
- Consumes: frozen candidate commit after Task 5.
- Produces: four Coach Sessions, four registered candidate Plans, sanitized blind
  packets, and an intermediate `PLANNING_ONLY` or `NO_EFFECT` judgment.

- [ ] **Step 1: Load the real-model validation procedure**

Before starting model traffic, load `studyclaw-e2e-validation` and follow its provider,
session, projection, source-integrity and shutdown requirements.

- [ ] **Step 2: Freeze identities and create four isolated roots**

Record:

```bash
git rev-parse HEAD
git status --short
```

Create:

```bash
ACCEPT_ROOT="$(mktemp -d /tmp/studyforge-personalization-XXXXXX)"
for root in red-1 blue-1 red-2 blue-2; do
  cp -R examples/derivative-demo/learning-set "$ACCEPT_ROOT/$root"
done
```

Use separate Pi config/session roots and free ports for all four runs. Do not print
credentials. Store the frozen commit, roots, ports, provider, model, thinking level
and persona in the report. Before any model traffic, predeclare `red-1` as the
History A treatment-source run and `blue-1` as the History B treatment-source run.
The second pair tests planning replication only; do not choose treatment Plans after
comparing which generated prose looks better.

- [ ] **Step 3: Seed two controlled longitudinal histories**

Use the same Roadmap, profiles, six real cards, six attempt counts, four correct /
two partially-correct outcomes and two Tutor-supported attempts in both histories.
Only the longitudinal pattern and prior intervention response differ.

| Attempt | Real card | History A: structural-transfer pattern | History B: condition-boundary pattern |
| --- | --- | --- | --- |
| 1 | `mst_p0016_ex01` | correct / none; familiar structure and calculation independent | correct / none; structure and calculation independent |
| 2 | `mst_p0016_ex02` | correct / none; familiar `te^t` shell independent | correct / none; structure and calculation independent |
| 3 | `mst_p0017_ex05` | correct / none; calculation fluent after structure recognized | partially_correct / tutor; omitted `a>0`, corrected after prompt |
| 4 | `mst_p0019_ex11` | correct / none; domain written before comparison | partially_correct / tutor; omitted logarithm domain before comparison |
| 5 | `mst_p0020_ex12` | partially_correct / tutor; could calculate after method-start hint | correct / none; structure selected without method hint |
| 6 | `mst_p0032_ex22` | partially_correct / tutor; unfamiliar shell again blocked method start | correct / none; written condition checklist prevented the prior omission |

Materialize each history as three completed Plans with two closed Lessons each.
Use these identical structural identities in both histories:

```text
cycle-01 → lesson-001, lesson-002
cycle-02 → lesson-003, lesson-004
cycle-03 → lesson-005, lesson-006
```

Every Plan contains `Observable Capability Standard`, `Test`, `Lesson Index`,
`Current Position`, `Next Lesson Candidate` and a source-linked `Plan Summary`.
Every Lesson is `closed`, contains one `## Block attempt`, one real card alias,
one active `## Trace event-001`, and one `## Lesson Summary`. Use the same six
timestamps in both histories. Each Trace binds `[attempt](#block-attempt)`, uses the
exact card, assessment and support from its matrix row, records
`Primary method: 同构变形与换元法` and `Secondary methods: []`, and stores the
history-specific observable behavior as a valid JSON string in `Note`.

Do not add inferred mastery, hidden Teacher Control or generated card steps. Give both
histories identical empty confirmed profiles. Keeping the same actual method on every
attempt makes the aggregate method signal comparable; the planner must use the
longitudinal notes and summaries rather than a different method label.

Plan Summaries must preserve these prior intervention results:

- History A: repeated same-shell practice improved speed but did not repair first-seen
  method initiation; comparing shells helped once and still needs transfer verification.
- History B: end-of-solution verbal reminders did not prevent later omissions; requiring
  a written condition checkpoint before calculation improved the latest attempt.

Use A in `red-1`, B in `blue-1`, B in `red-2`, and A in `blue-2`. Rebuild
`memory/planner-attention.md` in every root from active Trace.

- [ ] **Step 4: Verify the experimental controls before model traffic**

For every root, verify:

- exactly three completed Plans and six closed Lessons;
- all six `cardPath` values resolve;
- four correct and two partially-correct attempts;
- two `support: tutor` attempts;
- identical Roadmap, profiles, card tree, graph and learning guide;
- no `Planning Basis` or next Plan already exists;
- the only semantic difference is the history content specified above.

Save SHA-256 hashes of the shared assets and a compact JSON control summary under
`$ACCEPT_ROOT`. Stop if any control differs unexpectedly.

- [ ] **Step 5: Run the same Coach request four times**

Use the same provider, model, thinking level, persona and deep-mode setting. Send:

```text
我准备进入下一个学习阶段。请根据已有 Roadmap 和长期学习记录，
判断现在最值得改变的一个认知动作；如果证据不足，就先建议一个短诊断 Plan。
请先说明判断、真正影响决定的来源和可能推翻它的后续表现，等我确认后再创建 Plan。
```

If Coach proposes a deep workflow, approve it in every run under the same policy.
Answer factual clarification questions with the same neutral constraints. After the
recommendation, send:

```text
我确认按这个方向进入下一 Plan。请写入、注册并重新读取后告诉我最终状态。
```

Do not steer card choice, hypothesis or Plan wording.

- [ ] **Step 6: Produce randomized blind packets**

From safe student-visible projection, create one packet per pair containing:

- prior-history label removed;
- Coach recommendation before confirmation;
- final persisted Goal, capability standard, Test and Planning Basis;
- resolvable source paths, with learner/root names randomized;
- no tool arguments, private child conclusions, credentials or hidden prompts.

Keep the mapping unread until scoring finishes.

- [ ] **Step 7: Score planning discrimination**

For each pair, judge:

1. Does the primary cognitive change differ materially?
2. Is each difference caused by the supplied longitudinal history?
3. Does the Plan distinguish current evidence from hypothesis?
4. Does it use the prior intervention response?
5. Are the validation and replanning signals genuinely different?
6. Do all decisive claims resolve to authentic sources?

Stage-one PASS requires both pairs to follow the history after labels are swapped,
with no fabricated source or unsupported certainty. If it fails, the report result is
`NO_EFFECT`; do not proceed to cross-treatment.

- [ ] **Step 8: Write and commit the stage-one report**

Create `docs/audits/2026-07-27-longitudinal-personalization-acceptance.md` with:

- Run Identity;
- Controlled Histories;
- History-Swap Mapping;
- Blinded Planning Scores;
- Source and Runtime Invariants;
- Intermediate Result;
- Remaining Uncertainty;
- Cross-Treatment Inputs.

Use `PLANNING_ONLY` when stage one passes, because outcome improvement has not yet
been tested.

```bash
git add docs/audits/2026-07-27-longitudinal-personalization-acceptance.md
git commit -m "test: record personalized planning discrimination"
```

---

### Task 7: Run matched-versus-mismatched Lessons and close acceptance

**Files:**
- Modify: `docs/audits/2026-07-27-longitudinal-personalization-acceptance.md`
- Do not modify: product source, Skills, prompts, repository fixtures, or candidate Plans
  after the treatment roots are created.

**Interfaces:**
- Consumes: the predeclared `red-1` History A Plan, the predeclared `blue-1`
  History B Plan, and the frozen histories from Task 6.
- Produces: one matched and one mismatched branch per learner type—four branches
  total—plus a sanitized blind comparison and the final three-level result.

- [ ] **Step 1: Create treatment roots without changing the histories**

From the frozen History A and History B roots, create:

```text
A-matched      History A + Plan A
A-mismatched   History A + Plan B
B-matched      History B + Plan B
B-mismatched   History B + Plan A
```

Run one complete four-condition replication in this acceptance. Use the same Plan IDs
and source-relative file names in both histories. Preserve each Plan's Goal, standard,
Test, Planning Basis and proposed teaching strategy verbatim. Record hashes before any
Lesson begins; treat the small sample as an explicit remaining uncertainty.

- [ ] **Step 2: Prepare the first Lesson under identical operational conditions**

For every branch:

- same provider/model/thinking/persona;
- same deep-mode policy;
- same student request: `请按这个 Plan 给我准备第一节课，不要提前透露答案。`;
- same rule that the student sees only Student View;
- Coach may choose different authentic cards because card choice is part of treatment;
- no product or Prompt changes between branches.

Record the resulting Lesson ID, template, card paths and task functions.

- [ ] **Step 3: Simulate the two stable learner dispositions**

For History A branches, consistently act as a student who calculates fluently after a
method is started but does not spontaneously transfer a familiar structure to a new
shell. For History B branches, consistently identify broad structure but initially omit
condition or boundary checks unless the teaching sequence has made that action habitual.

The simulated student:

- answers only from visible content;
- does not mention the hidden history label or expected Plan;
- preserves a plausible mistake until Tutor responds;
- does not intentionally sabotage a correct teaching move;
- decides when to end the Lesson.

- [ ] **Step 4: Run two Lessons per condition**

After Lesson 1, return to the same Coach Session for source-linked review and preparation
of Lesson 2. Lesson 2 must contain an independent check of the Plan's stated cognitive
change. Preserve all Session IDs, Lesson files, active Trace, support attribution,
route changes and Plan updates.

Do not count Tutor-provided decisive content as independent student evidence.

- [ ] **Step 5: Build matched/mismatched blind packets**

For each learner type, randomly label the matched and mismatched branches. Include:

- the Plan standard and public Planning Basis;
- sanitized student-visible Tutor transcript;
- Lesson Summary and active Trace outcomes;
- support level and whether the final check was independent;
- Coach's post-Lesson decision.

Exclude root labels, treatment labels, tool arguments, hidden Teacher Control, answers,
private reasoning and raw child output.

- [ ] **Step 6: Judge treatment fit before unblinding**

Evaluate each learner type against its own Plan standard:

- how quickly the Lesson reached the actual recurring bottleneck;
- whether intervention matched the recorded failed/successful teaching history;
- amount and decisiveness of support;
- independent performance on the second-Lesson check;
- whether Coach appropriately retained or revised the diagnosis.

`PERSONALIZATION_CONFIRMED` requires the matched branch to be better for both learner
types without a factual, evidence, ownership or closure regression. If planning
discriminated but outcome is tied or mixed, keep `PLANNING_ONLY`. If planning did not
track history, use `NO_EFFECT`.

- [ ] **Step 7: Audit runtime invariants**

For every branch verify:

- real card and block bindings;
- active Trace only in Planner Attention;
- correct support attribution;
- Tutor and Coach Session ownership;
- student-confirmed Lesson closure;
- Plan writes reread from disk;
- no repository example mutation;
- no credentials or private child result in the report.

- [ ] **Step 8: Finalize and commit the acceptance report**

Update the report with:

- Treatment Matrix;
- Per-Lesson Run Identity;
- Blinded Outcome Comparison;
- Runtime Invariants;
- Final Result;
- Remaining Uncertainty;
- Next Action.

Do not upgrade `PLANNING_ONLY` merely because the personalized prose sounds more
convincing.

```bash
git add docs/audits/2026-07-27-longitudinal-personalization-acceptance.md
git commit -m "test: evaluate matched personalized plans"
```

- [ ] **Step 9: Run final verification**

Run:

```bash
git diff --check
git status --short
git diff --exit-code "$(git merge-base HEAD main)" -- examples/derivative-demo/learning-set
cd plugins/highschool-study && bun run release:check
cd ../../apps/pi-teaching-web && bun run check && bun run test:e2e
```

Expected: clean feature worktree, unchanged repository demo, all plugin/Pi/E2E checks
PASS, and the report contains one honest final result.

---

## Final Completion Gate

- [ ] Pi and Claude expose equivalent `plan-next-cycle` workflows.
- [ ] Tutor cannot load the Plan-level Skill.
- [ ] Old Plans without `Planning Basis` still load.
- [ ] Every Plan created through `plan-next-cycle` contains source-linked rationale and
      validation/replanning signals.
- [ ] Student confirmation precedes Plan write and registration.
- [ ] Plan Summary compares the initial judgment with actual evidence without inventing
      intervention effects.
- [ ] The Plan page shows “为什么这样安排” only when the section exists.
- [ ] Direct planning remains available; Dynamic Workflow does not become mandatory.
- [ ] Multiple Scouts are selected only for independent, decision-changing questions.
- [ ] Public MCP tool count remains exactly four.
- [ ] No Skill/Agent prose-string tests were added.
- [ ] Plugin release checks, Pi checks and browser E2E pass.
- [ ] Repository derivative demo remains unchanged by live acceptance.
- [ ] History interchange produces `PLANNING_ONLY` or `NO_EFFECT` before treatment.
- [ ] Cross-treatment produces one final scoped result:
      `PERSONALIZATION_CONFIRMED`, `PLANNING_ONLY` or `NO_EFFECT`.
