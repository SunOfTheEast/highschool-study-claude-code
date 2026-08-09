# Evidence Scout 180 秒与实时监控设计

## 问题

真实验收中的两个 Quick Evidence Scout 分别在 44.883 秒和 44.991 秒被取消。两次均未触及 50,000 Token 上限，失败点是现有 45 秒硬超时。

当前 `pi-subagents` 已持续发送 `durationMs`、`tokens`、`toolCount` 和 `currentTool`。StudyForge 运行时只保留了前两项，投影层又没有把它们交给前端，因此学生只能看到“正在分析”和最终来源数，无法判断 Scout 是否仍在推进。

## 目标

- Quick Evidence Scout 的最大运行时间固定为 180 秒。
- 工作流运行时实时展示已用时间、Token、工具次数和安全的当前活动。
- 最终结构化结果仍一次性交给 Coach；Coach 仍是唯一决策者和写入者。
- 保留现有单 Scout、只读工具、50,000 Token 和取消按钮。

## 非目标

- 不增加用户级超时配置。
- 不流式展示子 Agent 的 `recentOutput`、工具参数、思考或半成品结论。
- 不修改题卡、Trace、Plan 或 Lesson schema。
- 不增加新的工作流类型、重试系统或监督 Agent。

## 设计

### 1. 180 秒 Quick 上限

把 Quick Workflow 的校验上限、工具说明和 `deep-workflow` Skill 中的推荐值统一改为 `180000ms`。Deep Workflow 的既有行为不变。

### 2. 复用现有增量事件

`DeepWorkflowRuntime` 继续监听 `SubagentDelegationUpdate`，并为运行中的任务维护：

- `durationMs`
- `tokens`
- `toolCount`
- `currentTool`

每次增量更新只广播内存快照，不把高频进度逐条写入 Pi JSONL。任务进入终态后再持久化最终快照。

`recentOutput`、`recentOutputLines`、`currentToolArgs` 不进入 StudyForge 状态或前端投影。

### 3. 安全投影

工作流投影只暴露：

- 已用秒数
- Token 数
- 工具调用次数
- 当前工具的安全活动标签

当前工具只映射为教学侧可读标签，例如“正在读取来源”“正在检索题卡”“正在检索 Trace”；未知工具统一显示“正在分析”。不展示参数、路径内容或子 Agent 输出。

运行中不再显示“0 个来源”。来源数和题卡数只在任务完成并解析出最终结构化结果后显示；运行中显示“来源完成后汇总”。

### 4. 前端表现

Task Rail 保留现有工作流结构，并在每个运行中任务上显示：

```text
正在检索题卡
42 / 180 秒 · 3,777 / 50,000 Token · 4 次工具
来源完成后汇总
```

完成后恢复为来源数与题卡数。失败或取消沿用现有状态，不新增复杂恢复流程。

## 验证

- 校验器接受 Quick `180000ms`，拒绝 `180001ms`。
- 工具 schema 与 Skill 均声明 180 秒。
- 增量 update 能进入工作流快照并被投影。
- Task Rail 显示实时指标，运行中不再显示误导性的零来源。
- 插件发布检查、应用测试、类型检查和生产构建全部通过。
- 从隔离导数学习集重跑同一 Evidence Scout：确认运行超过 45 秒不会被取消，前端指标持续更新，最终结果返回 Coach，原始 Session 不含子 Agent 的流式半成品。
