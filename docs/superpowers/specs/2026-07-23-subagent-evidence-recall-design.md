# Subagent 隔离式证据召回设计

**日期：** 2026-07-23

**状态：** 已实现

**范围：** Pi Teaching Web 中 Coach / Tutor 的跨题卡、跨 Lesson、Plan 级题卡与 Trace 召回

## 1. 背景

题卡 YAML 是学习集中的完整、可追溯事实对象。一张题卡通常同时保存题干、答案、解析、评分点、知识图谱、来源证据、教学提示和质量信息。单张文件约 8–13 KB，这个体积本身正常，不需要为了搜索而删除来源信息或压缩题卡 schema。

问题出在模型会话边界：`trace_search` 在返回命中 Trace 时，还会把每个去重 `cardPath` 对应的完整 `CardContent` 放入 `cardsByPath`。当父 Coach / Tutor 在同一 Session 中多次执行跨题卡或 Plan 级搜索时，批量题卡和历史工具结果会持续留在父上下文。即使单次响应并不大，重复召回也会不断增加后续模型请求的上下文负担。

本设计不改变题卡格式，也不把 `trace_search` 缩减成无法反查题卡的工具。它把重召回和批量阅读放进临时、隔离、只读的 subagent Session，只把带真实来源的题卡索引、召回理由和综合结论返回父 Agent。

## 2. 目标与非目标

### 2.1 目标

1. 单卡和当前 Lesson 的小范围查询继续由父 Agent 直接完成。
2. 跨题卡、跨 Lesson 或 Plan 级证据召回默认交给一个临时 Evidence Scout。
3. 完整 `trace_search` 结果只进入子 Session，不复制到父 Session。
4. Evidence Scout 向父 Agent 返回结构化题卡索引、召回理由、Trace 引用、综合发现、建议和风险。
5. 父 Coach / Tutor 仍是唯一教学决策者和正式写入者。
6. 复用现有 `pi-subagents`、Quick Workflow、Workflow artifact 和 `highschool-study-markdown/study-domain`，不新增顶级 Agent、数据库或公共 MCP 工具。

### 2.2 非目标

- 不缩减或迁移现有题卡 YAML。
- 不改变 `card_search`、`trace_search`、`trace_append`、`source_resolve` 四个公共领域工具的契约。
- 不让 subagent 判定 Plan 完成、能力掌握或长期记忆。
- 不让 subagent 写 Lesson、Trace、Plan、Roadmap、画像或 `planner-attention.md`。
- 不为普通证据召回强制创建多个并行 subagent。
- 不增加自动分页、自动重试或复杂恢复循环。

## 3. 选定方案

复用现有动态工作流，允许 Quick Workflow 执行一个“重召回但单视角”的 Evidence Scout 任务。

```text
父 Coach / Tutor 提出证据问题
  → 创建单任务 Quick Workflow
  → Evidence Scout 在 fresh 子 Session 中调用 trace_search
  → active Trace 与紧凑题卡 metadata 只进入子 Session
  → Evidence Scout 生成 card_index 与综合结论
  → Workflow artifact 保存完整子运行
  → 父 Agent 只收到紧凑结果与 workflow_id
  → 父 Agent 必要时精读一张题卡
  → 父 Agent 作出教学决定并负责正式写入
```

该方案保留现有工作流的生命周期、取消、前端任务轨道和 raw JSON artifact，同时解决父 Agent 先执行重搜索、再把结果交给 subagent 所造成的上下文隔离失效。

本设计细化并覆盖
`2026-07-21-pi-teaching-web-frontend-design.md` 中两处旧约束：

- “至少两个独立视角”不再是创建 Quick Workflow 的唯一理由；单个重召回任务也可以因上下文隔离而委派。
- 父 Agent 不再为 Evidence Scout 预先执行跨题卡或 Plan 级 `trace_search`；这类真实来源由子 Session 自己发现。

其余动态工作流边界保持不变。

## 4. 触发边界

触发由 Coach / Tutor 的召回 Skill 根据问题语义判断，不使用关键词规则或固定命中数量阈值。

现有 Session 级深度模式开关仍是动态工作流总开关。本设计不改变它的默认值：开关启用时，跨题卡或 Plan 级召回默认使用 Evidence Scout；开关关闭时，父 Agent 保留现有直接查询能力。

### 4.1 父 Agent 直接查询

以下情况不创建子 Session：

- 已知精确 `cardPath`，只需核验一张题卡；
- 只读取当前 Lesson 的一条或少量 Trace；
- 只需核验当前课堂节点；
- 当前上下文已经足以回答，无需再次搜索。

### 4.2 单个 Evidence Scout

以下情况使用单任务 Quick Workflow：

- 判断依赖多个不同题卡；
- 需要比较多个 Lesson 的作答变化；
- 需要扫描整个 Plan 的 active Trace；
- 需要从 Trace 反查真实题卡，并解释每张题卡为何与当前问题相关；
- 批量工具结果没有必要长期留在父 Session。

### 4.3 多个 subagent

只有存在多个真正独立、可能改变下一步教学动作的分析问题时，才创建多个任务。例如“证据分析”“题卡选择”和“防剧透检查”可以构成独立视角。普通 Plan 级证据召回只使用一个 Evidence Scout。

现有 Deep Workflow 的确认流程保持不变。单个只读 Evidence Scout 属于 Quick Workflow，可以直接运行；多任务、依赖波次或更大预算仍走深度工作流确认。

## 5. Evidence Scout 权限

Evidence Scout 是临时角色，不进入 Plan 的 Coach / Tutor Session 树。

### 5.1 允许工具

```yaml
tools:
  - trace_search
  - card_search
  - source_resolve
  - read
  - grep
  - find
  - ls
```

### 5.2 禁止能力

```yaml
forbidden:
  - trace_append
  - classroom_update
  - write
  - edit
  - bash
  - subagent
  - deep_workflow_propose
```

Evidence Scout 不能修改学习集、创建教学事实、生成不存在的题卡路径或启动嵌套工作流。它的结论只是带来源的建议。

### 5.3 Child-only extension

Pi subagent 是独立子进程，不会自动继承父 `AgentSession` 通过 `customTools` 注册的工具。仅在 `study-scout.md` 的 `tools` allowlist 中加入 `trace_search` 不会加载工具实现。

因此增加一个只在子进程加载的 extension：

```text
study-readonly-tools
├── card_search
├── trace_search
└── source_resolve
```

该 extension 直接调用现有 `highschool-study-markdown/study-domain` 导出，与父 Session 的工具共用同一领域实现：

```text
父 Session customTools ─┐
                        ├─→ highschool-study-markdown/study-domain
子 Session extension ───┘
```

这样 active Trace、supersede、题卡反查和来源解析不会出现两套逻辑。extension 不注册 `trace_append` 或任何文件写入工具。

子进程调用相同领域函数，但使用 child-only 的紧凑题卡投影：只保留 `path`、`title`、`goal`、`methods` 和完整 active `traceHistory`，移除题干 `content`、解析、步骤、分问和另解。父 Coach / Tutor 的公共 `card_search`、`trace_search` 契约不变，仍可在已知单卡需要精读时取得完整题卡。

## 6. 子 Session 上下文包

Evidence Scout 使用 `context: fresh`，不继承父 transcript、父 Skills 或完整项目上下文。每次只接收当前证据问题、检索范围和输出要求。

```yaml
workflow_id: recall-plan-domain-integrity
role: Evidence Scout

question: >
  检查学生是否已经能在不同题卡中无提示识别同构结构，
  并指出下一课最值得验证的缺口。

scope:
  planId: domain-integrity
  lessonId: null
  cardPath: null

selection:
  active_trace_only: true
  compare_across_cards: true

allowed_read_roots:
  - plans/
  - lessons/
  - cards/
  - graph/

required_output:
  - card_index
  - findings
  - evidence_refs
  - recommended_action
  - risks
```

父 Agent 不再先调用 Plan 级 `trace_search` 来构造 `sourceHandles`。它只传真实的 Plan / Lesson 标识、当前教学问题和必要的已知路径。题卡与 Trace 的实际发现由 Evidence Scout 完成。

## 7. 返回 Master 的契约

“Master”指发起召回的父 Coach 或 Tutor。现有 `WorkflowTaskResult` 增加可选 `card_index`：

```ts
type EvidenceCardIndexEntry = {
  cardPath: string;
  title: string | null;
  goal: string | null;
  methods: {
    primary: string | null;
    secondary: string[];
  };
  reason: string;
  traceRefs: string[];
};

type WorkflowTaskResult = {
  card_index?: EvidenceCardIndexEntry[];
  findings: string[];
  evidence_refs: string[];
  recommended_action: string;
  risks: string[];
};
```

示例（为便于阅读，`title` 省略了选择题选项；真实输出仍复制完整 `CardContent.title`）：

```json
{
  "card_index": [
    {
      "cardPath": "cards/derivative/mst_p0032_ex22.card.yaml",
      "title": "（2025 江苏卓越联盟月考 T8）若关于 x 的不等式 x²+x ln a-aeˣ ln x>0 对所有 x∈(0,1) 恒成立，则实数 a 的取值范围为（ ）",
      "goal": "求参数范围",
      "methods": {
        "primary": "同构变形与换元法",
        "secondary": ["参变量分离"]
      },
      "reason": "该题同时提供同构识别和参数分离证据，与当前 Plan 的迁移目标直接相关。",
      "traceRefs": [
        "lessons/lesson-002.md#trace-event-003",
        "lessons/lesson-004.md#trace-event-008"
      ]
    }
  ],
  "findings": [
    "学生能在原题中完成同构变形，但陌生题中仍依赖 Tutor 提示。",
    "参变量分离已经出现两次无提示正确证据。"
  ],
  "evidence_refs": [
    "cards/derivative/mst_p0032_ex22.card.yaml",
    "lessons/lesson-002.md#trace-event-003",
    "lessons/lesson-004.md#trace-event-008"
  ],
  "recommended_action": "下一课使用不同题型检验同构识别的无提示迁移。",
  "risks": [
    "同构方法的无提示证据仍来自同一张题卡。"
  ]
}
```

### 7.1 字段规则

- `card_index` 只包含实际参与判断的真实题卡。
- `cardPath` 必须是 learning-set 根目录下的 canonical 路径。
- `title` 复制领域层当前返回的 `CardContent.title`，不由 subagent 另起标题。
- `goal` 与 `methods` 只能复制题卡图谱元数据，缺失时返回 `null` 或空数组，不能推断或改写。
- `reason` 说明该卡为何与本次问题相关，不复述完整题解。
- `traceRefs` 使用 Trace 的真实 `sourceAnchor`，例如 `lessons/lesson-002.md#trace-event-003`。
- `findings` 表达跨题卡或跨 Lesson 的综合结论。
- `evidence_refs` 汇总结论所依赖的真实题卡、Trace、Lesson 或材料路径。
- 不向 Master 返回完整 YAML、完整 `solution`、全部 Trace 正文或子 Session transcript。
- 非证据检索型工作流可以省略 `card_index`。

## 8. Master 消费结果

两种执行路径使用同一个紧凑 `WorkflowTaskResult`，但交付机制不同：

- 单任务 Quick Workflow 在 `deep_workflow_propose` 返回时，把 `workflowId` 和已完成任务结果直接交还当前父 Agent 回合；
- 学生确认后的 Deep Workflow 在后台完成后，向父 Session 注入隐藏的 `studyforge.workflow-result.v1` custom message，再触发父 Agent 继续综合。

```text
Master 读取 card_index 与 reason
  → 判断哪些题卡会改变当前教学决策
  → 必要时只精读一个 cardPath 及其 active Trace
  → 形成备课、复盘或课堂判断
  → Master 决定是否正式写入
```

Master 不得在收到结果后无条件重跑同一 Plan 的完整 `trace_search`。需要核验一张题卡时，可以执行单卡范围查询；单卡完整内容进入父上下文是预期行为。

子 Agent 的 `recommended_action` 不是自动指令。Coach / Tutor 要结合当前 Plan、Lesson 和学生选择作出最终决定。

## 9. 保存与前端投影

保存分为两层：

1. `pi-subagents` 继续保存子 Session 的 raw JSON、工具结果和运行 artifact，以 `runId` 标识；
2. 父 Session 的 `WorkflowStore` 只保存工作流快照、`runId` 和解析后的紧凑结果，不复制子 Session raw JSON。

父 Session 中的结构保持为：

```text
workflow_id
parent_session_id
workflow_graph
lifecycle_events
tasks
  ├── runId
  └── result
      └── card_index
status
```

两层数据都不进入 learning set。父 Agent 上下文只保留：

- `workflow_id`；
- 紧凑 `card_index`；
- 综合发现与关键引用；
- 父 Agent 最终采用的行动。

前端继续把 Quick Workflow 渲染为任务轨道，而不是聊天消息。单 Evidence Scout 只需要显示类似：

```text
✓ 正在检索 Plan 证据 · 召回 6 张相关题卡
```

题卡数量和安全摘要可以展示；完整内部分析、答案性中间结果和原始 transcript 不自动进入学生消息流。

当前任务轨只显示召回题卡数和来源数，例如 `4 张题卡 · 5 个来源`，不显示卡片标题、findings、recommendation 或 `runId`。`.pi-subagents/` 中的 raw JSON 和 artifact 属于运行时私有层，不计入 learning-set 的 Roadmap、Plan、Lesson、Trace 或画像事实。

## 10. 失败语义

保持有限、可解释的失败处理：

1. **没有真实证据：** 返回空 `card_index` 和空 `findings`，由 Master 说明证据不足。
2. **子运行失败：** Workflow 标记失败；Master 不自动在父 Session 重跑同一 Plan 级搜索。
3. **输出不符合契约：** 本次结果不进入 Master 的教学判断。
4. **检索范围不合适：** Master 可以提出一个更具体的新问题，不自动分页或无限重试。
5. **题卡图谱字段缺失：** 保留真实 `cardPath`，缺失字段返回 `null` / 空数组。
6. **部分引用无法解析：** 保留可核验结果，在 `risks` 中指出缺失来源。

## 11. 验收标准

### 11.1 合同测试

- `study-scout` 的 allowlist 包含三个只读领域工具；
- child-only extension 能在子进程注册 `card_search`、`trace_search`、`source_resolve`；
- 子进程没有 `trace_append`、`classroom_update`、写文件、shell 或嵌套 subagent 能力；
- `WorkflowTaskResult` 能解析、保存并恢复 `card_index`；
- 非证据型工作流省略 `card_index` 时仍保持兼容。

### 11.2 运行时测试

- 单任务 Quick Workflow 可以在无需学生确认的情况下运行；
- Plan 级 `trace_search` 的完整结果只存在于子 Session artifact；
- 父 Session 收到 `workflow_id`、题卡索引、召回理由和真实 Trace `sourceAnchor`；
- 父 Session 的 workflow-result message 不包含批量题卡的 `content`、`solution` 或完整 YAML；
- 父 Agent 可以根据一个返回的 `cardPath` 继续执行单卡核验；
- 子运行失败时，父 Agent 不自动执行相同的大范围搜索。

### 11.3 真实学习集冒烟

在导数学习集选择一个含多个 Lesson 和多张题卡的 Plan：

1. 由 Coach 提出跨题卡能力证据问题；
2. 启动一个 Evidence Scout；
3. 确认前端显示单任务召回状态；
4. 确认返回的每个 `cardPath` 和 `traceRefs` 都能解析；
5. 确认每张题卡带有具体召回理由；
6. 确认父 Session 没有接收批量完整题卡；
7. 让 Coach 精读其中一张卡并继续给出备课判断。

## 12. 实施与真实模型验收

实现时补齐了四个现有运行时断点：`deep_workflow_propose` 必须先进入 Session 工具允许列表再由深度模式开关启停；Pi Session 创建后必须绑定 extension context；子 Agent 定义中的 extension 路径必须解析为打包资源的绝对路径；Plan 级召回不能沿用 12,000 Token 和四回合限制。Quick 仍受 45 秒总时限和 12 次工具调用硬上限约束，不增加自动重试。

导数学习集的隔离副本已完成一次真实模型纵向冒烟：

- 父 Coach 只读取当前 Plan 与工作流 Skill，然后创建一个 Quick `Evidence Scout`；
- 子任务完成后返回 4 张真实题卡和 5 个来源，所有 `cardPath` 均可解析；
- 父工具结果不含 `content`、`solution` 或子 Session transcript；
- 排除 `.pi-subagents/` 私有 artifact 后，learning-set 事实文件校验和无变化。

## 13. 设计结论

题卡 YAML 的丰富性继续保留。重召回的问题通过 Session 隔离解决，而不是通过删除题卡信息或扩充规则引擎解决：

```text
重搜索在 subagent
题卡索引与理由回到 Master
精读按需发生
正式判断和写入仍由 Master 完成
```
