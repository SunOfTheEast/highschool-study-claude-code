# Plan 切换与 Lesson 归属锁定实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让学生通过前端显式切换 Plan，并禁止 completed Plan 或另一 Plan 的 Coach 覆盖既有 Lesson。

**Architecture:** 保留现有 `LearningSetSnapshot -> Plan route -> Coach Session` 链路，不增加 API、Agent 或持久化字段。领域写入层在任何文件变化前检查 Plan 状态和既有 Lesson 的 `plan_id`；前端只在当前 Plan 已完成时显示其他 Plan，点击后复用现有 `openRoute({ kind: "coach" })`。

**Tech Stack:** TypeScript 7、React 19、Bun test、Playwright、Markdown learning set。

## Global Constraints

- Plan 切换只能由学生点击触发，模型不选择目标 Plan。
- `lesson_prepare` 继续从 Coach Session 推导 `ownerId` 与 `ownerPath`。
- `completed` Plan 必须先通过现有 `plan_update` 重新变为 `active`，才能继续备课。
- 既有 Lesson 的 `plan_id` 不可由另一 Plan 改写，即使 Lesson 仍是 `prepared`。
- 同一 Plan 仍可原地重备 `prepared` Lesson。
- 不新增兼容层、数据库、后台索引、规则引擎或防御性工作流。

---

### Task 1: 在写入层锁定 Plan 与 Lesson 归属

**Files:**
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`

**Interfaces:**
- Consumes: `writePreparedLesson(root, planPath, input)`
- Produces:
  - `PLAN_PREPARATION_REQUIRES_REACTIVATION`
  - `LESSON_PLAN_OWNERSHIP_CONFLICT`

- [x] **Step 1: 写跨 Plan 覆盖的失败测试**

在 `write-workspace.test.ts` 创建第二个 Plan，让 Plan A 先写入
`lesson-shared.md`，再由 Plan B 使用同一 Lesson ID 重备。断言抛出
`LESSON_PLAN_OWNERSHIP_CONFLICT`，并且 Lesson、Plan A、Plan B 都保持第二次调用前
的字节内容。

- [x] **Step 2: 写 completed Plan 备课的失败测试**

将目标 Plan frontmatter 改为 `status: completed`，调用
`writePreparedLesson`，断言抛出
`PLAN_PREPARATION_REQUIRES_REACTIVATION`，且 Lesson 不存在、Plan 不变。

- [x] **Step 3: 运行测试并确认 RED**

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts
```

预期：跨 Plan 调用会覆盖 Lesson，completed Plan 仍会成功写入。

- [x] **Step 4: 在任何写入前加入两个校验**

在 `writePreparedLesson` 中先读取目标 Plan：

```ts
const owner = readMarkdownFile(root, planPath);
if (owner.frontmatter.status === 'completed') {
  throw new Error(`PLAN_PREPARATION_REQUIRES_REACTIVATION: ${owner.id}`);
}
```

若 Lesson 已存在，读取其 durable `plan_id`：

```ts
const currentPlanId = typeof current.frontmatter.plan_id === 'string'
  ? current.frontmatter.plan_id
  : null;
if (currentPlanId !== owner.id) {
  throw new Error(
    `LESSON_PLAN_OWNERSHIP_CONFLICT: lesson=${input.lessonId}; `
    + `existing=${currentPlanId ?? '(none)'}; requested=${owner.id}`,
  );
}
```

随后保留原有 started Lesson 与同 Plan prepared Lesson 逻辑。

- [x] **Step 5: 运行领域与 tool 测试并确认 GREEN**

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts tests/runtime/study-tools.test.ts
```

预期：新测试通过，原地重备与 Session-bound `lesson_prepare` 继续通过。

---

### Task 2: 显示由学生控制的下一 Plan 入口

**Files:**
- Create: `apps/pi-teaching-web/tests/client/session-tree.test.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/SessionTree.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`

**Interfaces:**
- `SessionTree` 新增 `onPlanSelect(planId: string): void`
- 点击后调用现有 `openRoute({ kind: 'coach', planId }, 'push')`

- [x] **Step 1: 写 SessionTree 投影失败测试**

用 `renderToStaticMarkup` 证明：

- 当前 Plan 为 `active` 时不显示其他 Plan；
- 当前 Plan 为 `completed` 时显示“继续其他 Plan”和其他 Plan 标题；
- 当前 Plan 本身不出现在候选列表。

- [x] **Step 2: 运行测试并确认 RED**

```bash
cd apps/pi-teaching-web
bun test tests/client/session-tree.test.tsx
```

预期：组件尚未渲染 Plan 候选。

- [x] **Step 3: 实现克制的侧栏入口**

`SessionTree` 从 `workspace.learningSet.plans` 过滤当前 Plan；仅在
`workspace.plan.status === "completed"` 且存在候选时渲染一个普通列表。按钮使用
现有纸张、细分隔线和单一 accent，不新增卡片或弹窗。

`App` 将回调绑定到：

```ts
onPlanSelect={(planId) => {
  void openRoute({ kind: 'coach', planId }, 'push');
}}
```

不发送模型消息，也不自动选择第一项。

- [x] **Step 4: 写浏览器点击验收**

测试 fixture 增加仅测试用的 completed Plan 状态入口。Playwright 注册第二 Plan、
完成它并重新打开其 Coach，确认 URL 不会自动变化；点击“定义域完整性的系统加固”后才进入
`/plan/domain-integrity` 并显示其 Coach。

- [x] **Step 5: 运行单元与 E2E 并确认 GREEN**

```bash
cd apps/pi-teaching-web
bun test tests/client/session-tree.test.tsx
bun run test:e2e
```

预期：学生点击前停留当前 Plan，点击后打开目标 Coach。

---

### Task 3: 同步契约并完成组合验证

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `docs/zh-CN/完整说明书.md`

- [x] **Step 1: 同步当前契约**

记录三条事实：Plan 切换属于前端/学生；completed Plan 先显式 replan/active 再备课；
prepared Lesson 只允许原 Plan 原地重备。

- [x] **Step 2: 运行完整验证**

```bash
cd apps/pi-teaching-web
bun run check
bun run test:e2e

cd ../../plugins/highschool-study
bun run release:check
```

预期：Pi 类型检查、139+ 单元测试、构建、全部 E2E、公共四工具合同和严格插件校验通过。

- [x] **Step 3: 自审并提交**

```bash
git diff --check
git status --short
git add AGENTS.md apps/pi-teaching-web docs/zh-CN/完整说明书.md
git commit -m "fix: keep lessons owned by their plans"
```

确认没有新增 API、持久化字段、自动 Plan 切换或模型目标 Plan 参数。
