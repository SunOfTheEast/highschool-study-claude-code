# Pre-pressure Runtime Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在不扩张持久架构的前提下，修复重复开场、终态 Replay 断档和非法暂停。

**Architecture:** `WorkspaceRegistry` 用进程内 Promise 合并同一 Lesson 的启动；服务端
依据 leader 结果触发一次 Tutor 开场。终态 Replay 使用现有 Session Owner 校验后
只读 Pi JSONL，并复用现有消息投影。暂停增加单一状态前置条件。

**Tech Stack:** TypeScript、Bun test、Pi SessionManager、Markdown workspace

## Global Constraints

- 不增加持久字段、新 Agent、后台任务或兼容层。
- 每项先写失败测试，再写最小实现。
- 冷恢复只读，不创建可交互 Agent Session。

---

### Task 1: 合并同一 Lesson 的并发启动

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Test: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Test: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Test fixture: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`

- [ ] 写并发 registry 与 HTTP start 回归测试，确认当前实现创建 / 开场两次。
- [ ] 新增内存 `lessonStarts`，让 leader 返回 `shouldKickoff: true`，其余请求返回
  `false`。
- [ ] 服务端只为 leader 调用 `triggerLessonStart`，更新测试 fixture 的返回契约。
- [ ] 运行：

```bash
bun test tests/runtime/workspace-registry.test.ts tests/server/workspace-api.test.ts
```

---

### Task 2: 从 Pi JSONL 冷恢复终态 Replay

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/session-owner.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Test: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Test: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

- [ ] 用真实 `SessionManager` 写一个带 Tutor owner 和学生消息的临时 JSONL。
- [ ] 用全新 Registry 读取 Replay，确认当前实现只得到空 history。
- [ ] 增加 owner 校验后的 branch reader 与 `replayHistory`；不得调用 Session factory。
- [ ] 让 Replay API await 冷恢复结果，并保留 owner 缺失时的 evidence-only fallback。
- [ ] 运行：

```bash
bun test tests/runtime/workspace-registry.test.ts tests/server/workspace-api.test.ts
```

---

### Task 3: 收紧暂停状态

**Files:**
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Test: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`

- [ ] 为 `prepared`、`paused`、`closed`、`abandoned` 写文件不变的失败测试。
- [ ] 在任何 abort / 写入前要求 Lesson 状态为 `active`。
- [ ] 运行定向 registry 测试。

---

### Task 4: 完整验收与提交

- [ ] 运行：

```bash
bun run check
bun run test:e2e
git diff --check
```

- [ ] 审查 diff 只包含三项局部修复及其文档 / 测试。
- [ ] 提交到 `codex/pre-pressure-runtime-closure`，等待合并决定。
