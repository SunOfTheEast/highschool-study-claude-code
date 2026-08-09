# Session-first Lesson 启动设计

日期：2026-07-30

## 问题

`WorkspaceRegistry.startLesson` 当前先把 Lesson 从 `prepared` 写成
`active`，再等待 Tutor Session factory。全新 Pi 目录首次初始化较慢或 factory
失败时，学生会看到一节已经开始、却还没有可用 Tutor Session 的课。

根因是持久学习事实与运行时依赖的提交顺序相反，不是十秒请求超时本身。

## 选择

Lesson 启动改为以下顺序：

```text
校验 prepared Lesson
  → 创建或恢复 Tutor Session
  → 写回 tutor_session
  → 将 Lesson 改为 active
  → 由现有流程触发隐藏的 Tutor kickoff
```

`openTutor` 对外仍只允许 `active` / `paused` Lesson。新增的内部 helper 只负责按给定
Lesson 快照创建、缓存并持久化 Tutor Session，使 `startLesson` 可以在公开状态仍为
`prepared` 时完成运行时准备。

## 失败语义

- Session factory 尚未完成时，Lesson 继续保持 `prepared`。
- Session factory 抛错时，不写 `tutor_session`，也不激活 Lesson。
- Session 已持久化后才激活 Lesson；若后续激活写入失败，保留的 canonical Session
  可在重试时复用。
- 不增加 `starting` 持久状态，不增加重试器，也不通过延长超时掩盖顺序问题。

## 验收

1. 用受控 pending factory 证明 factory 未完成时 Lesson 仍为 `prepared`，完成后才同时
   得到 `tutor_session` 和 `active`。
2. 用 rejected factory 证明 Lesson 文件逐字不变。
3. 保持 prepared admission、paused resume、Tutor kickoff 和现有 E2E 全部通过。
