# 材料准备协议

仅在下一课已经具备准备条件、外部材料角色已经明确，而且需要探索或比较候选时读取。
这份文件规定易出错的 Scout 调用协议；它不负责师生协商、教学目标或 Lesson 结构判断。

## 建立临时材料槽位

为每个仍需要外部材料的已确定 Block 建立一个临时槽位：

- 一个 problem Block 通常对应一个 problem-card 槽位；
- video 或 reading Block 可以各自形成槽位；
- 不需要外部材料的讨论或反思 Block 不形成槽位。

槽位只服务于当前备课调用，不写入 Plan 或 Lesson，也不成为新的持久对象。

每个槽位 brief 包含：

- 槽位名称；
- 公开教学目的；
- 材料种类与工作量；
- 应避免的结构，以及需要避开的既用材料精确路径或 ID；
- 会改变适配判断的学生事实；
- 可选的建议检索词；
- 只有精确组合可能过窄时才提供的放宽顺序。

Coach 已经沿当前 Plan Tree 读取了可用课程证据。把真正会改变选材的结论和既用材料压进
brief；不要把 Plan/Lesson 路径交给 Scout，让它重新解释父子文档或扩大证据范围。

建议检索词只负责召回，不代表最终适配。题卡优先使用学习集冻结词表中的规范词；自由文本
使用短而不特殊的字面入口，并可列出常见符号变体：

```text
建议检索词（只用于召回）：
- goal: 求参数范围
- method: 参变量分离
- structure: 三次/高次函数结构
- text: [绝对值, |]

放宽顺序：先去掉 text；仍为空时再放宽 method。
```

非题卡材料可以只写素材类型和自由文本，不为满足格式编造 `goal`、`method` 或
`structure`。brief 不要求候选数量、完整路线、数学结论、穷尽证明或搜索起点；这些旧要求
会与 Scout 的浅召回边界冲突。

题卡 Scout 会优先使用学习集的 `graph/card-recall-index.tsv` 做召回；它只是把公开题面和
规范特征排在同一行的安全 sidecar，不是选材证据，也不替代 Coach 对正式题卡的完整核验。

## 调用材料 Scout

每个槽位启动一个全新上下文的 `study-material-scout`。不要为同一槽位预先建立第二种
“搜索视角”，也不要用固定任务数代替真实材料需要。

不要先在父 Session 中批量列目录、搜索或打开多个候选。若首次调用前确实需要确认
打包的 Scout 是否可用，可以先调用一次 `subagent(action: "list")`。

所有槽位使用一次前台并行 `subagent` 调用：

- `concurrency: 3`；
- `context: "fresh"`；
- `async: false`；
- `includeProgress: false`；
- `artifacts: false`；
- `agentScope: "user"`；
- 不设置 `timeoutMs` 或 `maxRuntimeMs`。

调用对象恰好使用七个顶层字段：

```text
tasks
concurrency
context
async
includeProgress
artifacts
agentScope
```

每个 `tasks` 项恰好包含：

```json
{
  "agent": "study-material-scout",
  "task": "当前槽位的完整 brief",
  "acceptance": {
    "level": "none",
    "reason": "read-only candidate recall"
  }
}
```

结果保持 inline：省略 `output` 和 `outputMode`。

## 合并、选择与核验

等待所有槽位任务结束。按 `asset_path` 合并和去重浅候选，再由 Coach 根据当前 Plan、
closed Lesson 和学生对话选择每个槽位的当前首选。

Coach 完整读取当前首选，并分别核验：

- 来源真实且路径存在；
- 数学内容正确；
- 预期完整路线确实走得通；
- 定义域、隐零点、端点、取等条件没有遗漏；
- 难度、计算量、结构、来源陌生度和教学作用适合；
- 不会泄露本课需要学生独立作出的关键判断；
- 与其他槽位不形成无意义重复。

只有首选未通过核验时，才读取 Scout 返回的备用项。没有备用项或备用项也失败时，可以在
原批准边界内，根据 `search_boundary` 发出一次更明确或按已授权顺序放宽的检索；不要把
路线核验重新下放给 Scout，也不要自动重跑整个 fan-out。材料图谱帮助定位，题卡 metadata
描述材料；二者都不能替代数学核验和对学生的教学判断。

## 失败边界

一个任务失败时，保留其他槽位中可用的结果。如果任何必需槽位仍没有合适真实材料：

- 不创建 Lesson；
- 不静默减少活动数量；
- 不自动重复 fan-out；
- 不回到父 Session 做批量兜底搜索；
- 只告诉学生哪个公开条件无法满足，在后续回合讨论应改变哪个条件。

Scout 不决定学生能力、教学顺序、Lesson 结构、提示策略、Plan 完成与否或任何持久事实。
课后复盘也不是 Scout 任务；Coach 直接读取已经关闭的 Lesson。
