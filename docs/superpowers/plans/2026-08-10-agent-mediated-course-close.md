# Plan / Lesson Semantic Close Handshake Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让 Plan / Lesson 的学生结束按钮先进入当前 Teacher Session 完成语义收口，只有绑定的无参数 finish 工具才能执行最终机械状态迁移。

**Architecture:** 保留现有 Plan / Lesson 启动路径；把 `/complete` 与 `/close` 改为向当前 Session 排入一条自然结束意图。新增两个由 Runtime scope 绑定目标的 finish 工具，工具只做幂等的 `active → terminal`；现有 WebSocket invalidation 刷新终态页面，Runtime 不解析确认语义。

**Tech Stack:** TypeScript 7、Bun test、React 19、Pi custom tools、Markdown Skills

## Global Constraints

- 不新增确认正则、`closing/ready` 状态、永久 receipt、数据库或第二套前端状态机。
- finish 工具不接收路径、ID、状态、确认布尔值、总结或记忆内容。
- Free Learning、Meta、Roadmap 与 Plan / Lesson 启动动作不变。
- 保留用户未提交文件；所有测试在复制的学习集上修改。

---

### Task 1: Bound finish tools and terminal Session guard

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/node-finish-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/runtime/node-lifecycle.ts`
- Test: `apps/pi-teaching-web/tests/m0/node-lifecycle.test.ts`
- Test: `apps/pi-teaching-web/tests/m0/lesson-tools.test.ts`
- Test: `apps/pi-teaching-web/tests/m0/plan-tools.test.ts`
- Test: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Test: `apps/pi-teaching-web/tests/m0/public-surface.test.ts`

**Interfaces:**
- Produces: `createNodeFinishTool(root, kind, path)` returning `finish_plan` or `finish_lesson` with an empty object schema.
- Produces: terminal node status rejects later `WorkspaceRegistry.send`, even if the Session was already cached.
- Removes: direct `NodeLifecycleService.completePlan` and `NodeLifecycleService.closeLesson`; start methods remain.

- [ ] **Step 1: Write failing tool and lifecycle tests**

Add focused assertions that the Plan and Lesson tool lists end in their finish tool, their schemas accept `{}` and reject identity fields, invoking each tool transitions only its bound active document, a second invocation is idempotent, and a prepared node is rejected. Change the lifecycle test so only starts open Sessions and no direct close method exists.

```ts
expect(createLessonTools(root, lessonPath, session).at(-1)?.name).toBe('finish_lesson');
expect(Check(finish.parameters, {})).toBeTrue();
expect(Check(finish.parameters, { lessonId: 'lesson-001' })).toBeFalse();
await finish.execute('finish-1', {}, undefined, undefined, {} as never);
expect(readLesson(root, lessonPath).status).toBe('closed');
```

- [ ] **Step 2: Run RED**

Run:

```bash
bun test tests/m0/node-lifecycle.test.ts tests/m0/lesson-tools.test.ts tests/m0/plan-tools.test.ts tests/m0/native-session.test.ts tests/m0/public-surface.test.ts
```

Expected: FAIL because finish tools do not exist and the old lifecycle service still exposes direct terminal transitions.

- [ ] **Step 3: Implement the minimal bound tool**

Create one generic implementation with the two fixed names and no model-supplied authority:

```ts
export function createNodeFinishTool(
  root: string,
  kind: 'plan' | 'lesson',
  path: string,
) {
  const terminal = kind === 'plan' ? 'completed' : 'closed';
  return defineTool({
    name: kind === 'plan' ? 'finish_plan' : 'finish_lesson',
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async () => {
      const document = kind === 'plan' ? readPlan(root, path) : readLesson(root, path);
      if (document.status !== terminal) transitionNode(root, path, 'active', terminal);
      return safeFinishResult(kind, terminal);
    },
  });
}
```

Reject every non-`active`/non-terminal status before writing. Register the tool last in each node tool list and model allow-list. In `WorkspaceRegistry.open`, re-check cached node status before returning it. Delete direct terminal methods from `NodeLifecycleService` and narrow its port to `open`.

- [ ] **Step 4: Run GREEN**

Run the same focused command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/src/runtime apps/pi-teaching-web/tests/m0
git commit -m "feat: bind semantic finish tools to course nodes"
```

### Task 2: Turn student finish buttons into Session intents

**Files:**
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/CoursePage.tsx`
- Test: `apps/pi-teaching-web/tests/m0/server-api.test.ts`
- Test: `apps/pi-teaching-web/tests/m1d/course-workspace-ui.test.tsx`

**Interfaces:**
- `/api/plans/:id/complete` queues `我想完成这一阶段。` into `plan:<id>` and returns `{ accepted: true }` with HTTP 202.
- `/api/plans/:plan/lessons/:lesson/close` queues `我想结束本课。` into `lesson:<plan>:<lesson>` and returns `{ accepted: true }` with HTTP 202.
- Successful `finish_plan` / `finish_lesson` publishes `course-invalidated`.

- [ ] **Step 1: Write failing transport and UI tests**

Replace the old assertion that close/complete call lifecycle methods with an assertion that only start calls do so, while finish endpoints call `registry.send` with the exact bound key and natural text. Add a render assertion that an active finish button is disabled while `running` and enabled when idle.

```ts
expect(sent).toEqual([
  ['lesson:plan-001:lesson-001', '我想结束本课。'],
  ['plan:plan-001', '我想完成这一阶段。'],
]);
expect(closeResponse.status).toBe(202);
```

- [ ] **Step 2: Run RED**

Run:

```bash
bun test tests/m0/server-api.test.ts tests/m1d/course-workspace-ui.test.tsx
```

Expected: FAIL because finish endpoints still call direct lifecycle transitions and the button ignores run state.

- [ ] **Step 3: Implement the shared queued-turn path**

Extract the existing messages-route run publication into one local `queueTurn(key, text)` helper and reuse it for normal messages and the two finish endpoints. Keep starts on `NodeLifecycleService`. Update client result types to `{ accepted: true }`; only start actions navigate. Disable the lifecycle button when disconnected or running. Extend the existing successful-tool invalidation condition:

```ts
event.toolName === 'finish_plan' || event.toolName === 'finish_lesson'
```

- [ ] **Step 4: Run GREEN**

Run the same focused command. Expected: all selected tests pass.

- [ ] **Step 5: Commit**

```bash
git add apps/pi-teaching-web/src/server apps/pi-teaching-web/src/client apps/pi-teaching-web/tests/m0/server-api.test.ts apps/pi-teaching-web/tests/m1d/course-workspace-ui.test.tsx
git commit -m "fix: route course endings through teacher sessions"
```

### Task 3: Align Teacher contracts and verify the complete product

**Files:**
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/resources/agents/lesson-node.md`
- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-dialogue/references/plan-closure.md`
- Test: `apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts`
- Test: `apps/pi-teaching-web/tests/e2e/m0-cycle.spec.ts`

**Interfaces:**
- Lesson bright line ends with `lesson_memory_commit` when available, then `finish_lesson`.
- Plan closure ends with updated Plan/memory facts, then `finish_plan`.
- Neither Skill edits top-level lifecycle frontmatter directly.

- [ ] **Step 1: Write failing contract assertions**

Assert the Tutor Skill and consolidation reference name `finish_lesson` after semantic consolidation, the Plan closure reference names `finish_plan` after updating Current Position, and role prompts still forbid direct frontmatter edits.

- [ ] **Step 2: Run RED**

Run:

```bash
bun test tests/m1/memory-skill-tree.test.ts
```

Expected: FAIL because current resources hand terminal control back to the old direct UI path.

- [ ] **Step 3: Update only lifecycle wording**

Replace “界面直接关闭” with the approved sequence. Keep the existing reflection, evidence, memory, approval, and student-decision rules unchanged. Update `AGENTS.md` so activation remains direct UI/Runtime, while completion is student-requested and Teacher-signaled through the bound finish tools.

- [ ] **Step 4: Run focused and full verification**

Run:

```bash
bun test tests/m1/memory-skill-tree.test.ts
bun run check
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts tests/e2e/m1c-cycle.spec.ts tests/e2e/m1d-ui.spec.ts
```

Expected: unit/type/build pass and all four browser suites pass. Update the deterministic fixture teacher so it invokes the finish tools after its existing close summaries; do not bypass the production route.

- [ ] **Step 5: Commit**

```bash
git add AGENTS.md apps/pi-teaching-web/resources apps/pi-teaching-web/tests
git commit -m "docs: teach agents the course close handshake"
```

