# Session-first Lesson Start Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 防止 Tutor Session 冷启动期间把 Lesson 提前持久化为 `active`。

**Architecture:** 从 `openTutor` 提取一个私有的 Tutor Session 创建 helper。`startLesson`
先校验 Lesson，再由 helper 创建并写回 Session，最后才激活 Lesson；公开
`openTutor` 的状态门保持不变。

**Tech Stack:** TypeScript、Bun test、Pi teaching runtime、Markdown frontmatter

## Global Constraints

- 不增加新的 Lesson 状态、后台任务、重试器或数据库。
- `prepared` admission 规则与 `openTutor` 的公开状态门保持不变。
- factory 失败时 Lesson 文件必须逐字不变。

---

### Task 1: Tutor Session 先于 Lesson 激活

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Test: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`

**Interfaces:**
- Consumes: `StudySessionFactory` 与现有 `PlanWorkspaceSnapshot['lessons'][number]`
- Produces: 私有 `createTutorSession(lessonId, lesson): Promise<StudySession>`

- [ ] **Step 1: 写 pending 与 rejected factory 的失败回归测试**

测试在 factory 等待期间读取 Lesson，断言状态仍为 `prepared`；factory 完成后断言
`tutor_session` 已写入且状态为 `active`。第二个测试让 factory 抛错并逐字比较 Lesson
文件。

- [ ] **Step 2: 运行定向测试并确认 RED**

Run:

```bash
bun test tests/runtime/workspace-registry.test.ts
```

Expected: 新的 pending factory 测试读到错误的 `active`，rejected factory 测试发现
Lesson 文件已被修改。

- [ ] **Step 3: 提取内部 Session helper 并重排 `startLesson`**

实现形态：

```ts
private async createTutorSession(
  lessonId: string,
  lesson: PlanWorkspaceSnapshot['lessons'][number],
): Promise<StudySession> {
  // 复用原 openTutor 的 cache、owner scope、lookup、factory 和 tutor_session 写回。
}
```

`startLesson` 对 `prepared` 完成 admission 后先等待该 helper，随后才将
`status` 写为 `active`。`openTutor` 完成原有状态检查后调用同一 helper。

- [ ] **Step 4: 运行定向测试并确认 GREEN**

Run:

```bash
bun test tests/runtime/workspace-registry.test.ts
```

Expected: 全部通过。

- [ ] **Step 5: 运行应用完整验收**

Run:

```bash
bun run check
bun run test:e2e
```

Expected: typecheck、unit tests、production build 与 Playwright E2E 全部通过。

- [ ] **Step 6: 审查并提交**

```bash
git diff --check
git status --short
git add apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts \
  docs/superpowers/specs/2026-07-30-session-first-lesson-start-design.md \
  docs/superpowers/plans/2026-07-30-session-first-lesson-start.md
git commit -m "fix: create tutor session before lesson activation"
```
