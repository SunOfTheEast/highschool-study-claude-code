# 压测前运行时小修设计

日期：2026-07-30

## 背景

压测前的静态审计留下三个局部运行时缺口：

1. 同一 Lesson 的两个并发 `start` 请求会越过 Session cache，并各自触发 Tutor
   开场；
2. 进程重启后，已结束 Lesson 的 Tutor 不在内存中，Replay 因而退化为只有 Trace
   和路线记录；
3. `pauseLesson` 没有检查当前状态，可以把 `prepared`、`paused`、`closed` 或
   `abandoned` 写成 `paused`。

这些都不需要新 schema、Agent 或后台工作流。本轮只修运行时协调和读取边界。

## 一、Lesson 启动 single-flight

`WorkspaceRegistry` 为正在启动的 Lesson 保存一份仅驻留内存的 Promise：

```text
第一个 start
  → 校验 Lesson
  → 登记 in-flight Promise
  → 创建 / 恢复 Tutor Session
  → 写 active
  → 返回 shouldKickoff: true

并发 start
  → 复用同一 Promise
  → 返回 shouldKickoff: false
```

服务端只有拿到 `shouldKickoff: true` 的请求才触发隐藏开场。这样 Session factory、
`tutor_session` 写入和 Tutor 开场都只有一份。

已经是 `active` 的 Lesson 可以确保其 Tutor Session 可恢复，但不会再次触发开场。
`paused` Lesson 的第一次恢复请求是新一轮 leader，会触发一次继续上课。启动失败时
清除 in-flight Promise，并保持现有 session-first 失败语义。

## 二、终态 Replay 冷恢复

Replay 继续优先读取当前进程内已经打开的 Tutor Session。若 Lesson 为 `closed` 或
`abandoned`、内存中没有 Session，运行时按以下链路只读恢复：

```text
Lesson.tutor_session
  → 现有 Session Owner 校验
  → 打开已验证的 Pi JSONL
  → 读取当前 branch
  → 复用 safe / raw-stream 消息投影
  → 与 Trace、Route Changes 合成 Replay
```

冷恢复不创建 Agent、不写 Lesson、不缓存可交互 Session，也不触发模型。找不到归属
正确的 JSONL 时保留现有 evidence-only 回放。

## 三、暂停状态门

`pauseLesson` 只接受 `active → paused`。其他状态统一返回
`LESSON_NOT_ACTIVE: <status>`，且不终止 Session、不修改 Lesson 文件。

## 非目标

- 不增加 `starting` 状态、锁文件、数据库或跨进程分布式锁；
- 不改变 Roadmap、Plan、Trace 或 Lesson schema；
- 不改变 Tutor 教学提示词和课堂流程；
- 不自动修复缺失或损坏的 Pi 历史；
- 不增加旧接口兼容分支。

## 验收

1. 两个并发 start 只创建一个 Tutor Session、只触发一次开场；
2. 新建 Registry 后仍能从真实 Pi JSONL 得到完整终态 Replay；
3. 非 active Lesson 暂停失败且文件逐字不变；
4. unit、typecheck、build 与 E2E 全部通过。
