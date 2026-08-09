# StudyForge M0 Plan Session Compaction Design

**状态：** 已确认

**日期：** 2026-08-03

## 1. 问题

StudyForge M0 为每个 Plan 保留一个原生 Pi Session。六节多题课验收中，Plan
Session 的 JSONL 增长到约 1.60 MB，最后一次模型请求使用了约 35.3 万 token
的上下文，但 Session 内没有任何 compaction 记录。

这不是 Pi 压缩失效。当前 `deepseek-v4-flash` 的上下文窗口为 100 万 token，
Pi 默认只在逼近模型窗口时自动压缩。对 StudyForge 而言，等到接近 100 万 token
才处理太晚：旧备课推理、完整 Read 结果和 Scout 返回已经开始增加等待时间，
也会稀释当前教学信息。

## 2. 目标

在不拆分 Plan Session、不增加 Handoff、不裁剪工具结果的前提下，让长 Plan 在
完整课次边界使用 Pi 原生 compaction，继续保留自然对话连续性。

具体要求：

- 只作用于 Plan Session；
- 只在一次 Agent turn 完全 settled 后运行；
- 只有本轮成功创建或修改 `lessons/*.md`，才形成压缩边界；
- 上下文达到 200,000 token 才压缩；
- 使用 Pi 原生 `session.compact(customInstructions)`；
- 压缩期间保持当前请求处于 running，完成后再回到 idle；
- 原始 JSONL 不删除、不重写；
- Roadmap、Lesson 和 Scout Session 行为不变；
- 本阶段不实现旧工具结果裁剪、CoT 删除、Session 轮换或磁盘归档。

## 3. 采用方案

在 StudyForge 的 Pi Session 适配层中观察原生工具生命周期：

```text
Plan turn 开始
  → edit/write lessons/*.md
  → tool_execution_end 成功
  → Pi 完成全部续写、重试和自动处理
  → session.prompt() 返回（agent_settled 已发生）
  → 读取 getContextUsage()
  → tokens >= 200,000 时调用 compact()
  → compact 完成
  → WorkspaceRegistry.send() 返回
  → 前端 running → idle
```

工具开始事件记录 `toolCallId → path`，工具结束事件只有在同一调用成功时才确认
边界。失败的 Write/Edit、Plan 自身写入和普通 Read/Search 都不能触发压缩。

不通过调高 `reserveTokens` 提前触发 Pi 自动压缩。该字段同时承担模型输出预留和
摘要预算职责，为 100 万窗口伪造几十万 token 的输出预留会混淆其原始语义。

## 4. 压缩摘要契约

压缩继续使用 Pi 的原生结构化摘要，只附加 StudyForge 专用指令：

- `ROADMAP.md`、当前 Plan 和 Lesson Markdown 是持久事实来源；
- 不复制题卡全文、Scout 搜索过程、旧工具输出或已经落盘的课堂流水；
- 保留准确的当前节点路径和需要重新读取的 Lesson 路径；
- 保留学生明确表达、但尚未写入文档的要求、异议和偏好；
- 保留未决问题、已作出的教学决定和下一步；
- 区分学生事实、教师假设和仍待验证的判断；
- 后续需要细节时重新 Read 原始 Markdown，不把摘要升级为教学事实。

这份摘要只是当前 Plan Session 的工作索引，不是新的长期记忆或 Handoff。

## 5. 失败语义

Lesson 已成功落盘后，compaction 属于上下文维护，不应把已经完成的教学回合伪装
成发送失败。压缩失败时：

- Pi 保留原始 Session，后续仍可继续；
- 本轮学生消息和 Lesson 写入不回滚；
- Runtime 记录压缩失败供本地诊断；
- 下一次满足边界和阈值时可以再次尝试；
- 不自动重发学生消息，也不自动重跑备课。

## 6. 验证

机械测试覆盖：

1. 只有 Plan 的成功 Lesson Write/Edit 被识别为边界；
2. 失败工具调用、其他路径和其他节点不会触发；
3. 低于 200,000 token 不压缩；
4. 达到阈值时只调用一次原生 compact，并传入专用指令；
5. compact 在 prompt settled 后发生；
6. compact 失败不使已完成的 prompt 变成失败；
7. 现有 M0 单元、构建和浏览器闭环继续通过。

真实验收使用复制的导数学习集完成至少两次备课边界，确认 JSONL 中出现
`compaction` entry，下一轮 Coach 能重新读取 Plan 与 Lesson 并自然继续。
