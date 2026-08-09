# Runtime-Owned Teaching Contracts Design

## 目标

消除最近真实课堂中反复出现的四类可避免参数错误，同时保持现有 Markdown-first 节点树、单 Session 互动方式和四个公共 MCP 工具不变：

1. Candidate 来源不再要求模型填写当前 Session；
2. `lesson_prepare` 不再让模型同时填写题卡清单与 `Uses`；
3. `source_resolve` 从“只返回内容”升级为备课前可执行的核验事实；
4. `trace_append` 与 Block 推进的职责在工具契约中明确分开。

本轮不新增 Agent、工具、持久化字段、数据库、收据 ID 或 Block 状态机，也不兼容旧的模型调用参数。

## 1. Candidate 的当前 Session 来源由 Runtime 注入

模型仍可为 `roadmap_update` 和 `plan_update` 的 Candidate 选择 `claim:`、`trace:`、`card:`、`block:`、`memory:` 等真实来源，但参数 schema 明确拒绝 `session:`。当前节点 Session 的规范句柄由 `NodeAccessPolicy` 暴露给 Runtime；Runtime 在每个 `add` 或 `revise` Candidate 写入前自动追加该句柄并去重。

这样，模型不需要区分父 Session、子 Session 或当前 Session。跨子节点学习仍只能通过已封存 Handoff 的 `claim:` 进入父节点；自动注入的永远只是当前写入者自己的 Session。

若绕过 schema 直接把 `session:` 填进模型输入，Runtime 也拒绝，而不是猜测或替换。

## 2. problem Block 直接绑定一个 `cardAlias`

模型面对的 `lesson_prepare` Block schema 改为按 `kind` 区分：

- `problem`：必须填写一个 `cardAlias`；
- `dialogue`、`material`、`reflection`：没有 `cardAlias`，也没有 `uses`。

Runtime 将 `problem.cardAlias` 编译成现有内部 `uses: [cardAlias]`，其他 Block 编译成 `uses: []`。Lesson Markdown 的 `Uses`、内部 `LessonBlueprint`、读取器和投影保持不变。

一次独立判定的题卡作答仍属于一个 problem Block。题目呈现、作答前选路讨论、分级提示、学生求解、评价以及同一次 attempt 的 Trace，可以在同一个 Block 中跨多轮完成；不能因为互动阶段变化而拆成无题卡 dialogue Block。只有独立回答并独立判定的另一问，才建立另一个 problem Block，并拥有自己的真实题卡 alias。

## 3. `source_resolve` 形成当前 Session 内的核验集合

`NodeAccessPolicy` 在内存中分别维护：

- 已由搜索或上下文授权的来源；
- 已经由一次成功 `source_resolve` 核验的来源。

无效或被拒绝的解析不会进入已核验集合。成功解析题卡后，以规范 `card:<path>` 记录核验状态。

`lesson_prepare` 在写任何文件前检查每个 problem Block 选中的题卡：该题卡必须已在当前 Plan Session 中成功解析，否则抛出：

```text
LESSON_CARD_NOT_RESOLVED: card:<path>
```

搜索只负责发现候选，解析负责读取并核验最终采用的题卡；解析另一张题卡不能替代目标题卡。该状态只属于当前运行 Session，不写入 Markdown，也不新增长期日志。

## 4. Trace 记录不隐式推进 Block

`trace_append` 只写证据及刷新投影，不改变 Block 状态。其工具描述与回执明确返回 `blockState: "unchanged"`。

`classroom_update(action: "activate")` 的参数说明明确：若已有 active Block，必须先显式 `complete` 或 `skip` 当前 Block，再激活下一 Block。现有 Runtime 拒绝规则继续作为唯一状态转换约束；不新增 `advance` 动作或隐式连跳。

Tutor Skill 同步说明：一次 problem Block 可跨多轮；写 Trace 后仍停留在当前 Block。Coach Skill 同步采用 `problem.cardAlias`，并重申作答前协议属于同一 problem Block。

## 数据流

```text
Plan Session
  ├─ card_search ───────────────→ granted(card:path)
  ├─ source_resolve(card:path) ─→ resolved(card:path)
  └─ lesson_prepare
       ├─ problem.cardAlias ────→ Runtime 编译 Uses
       ├─ 检查 card:path 已 resolved
       └─ 原子写入 Lesson + 父 Plan 索引

Roadmap / Plan Session
  └─ *_update(candidate.sources)
       ├─ 拒绝模型提供 session:
       ├─ Runtime 追加当前 session:
       └─ 校验并写入 Candidate

Tutor Session
  ├─ trace_append ──────────────→ Trace 写入；Block 不变
  └─ classroom_update
       ├─ complete/skip 当前 Block
       └─ activate 下一 Block
```

## 验收标准

1. `roadmap_update` 与 `plan_update` 的模型 schema 不接受 `session:` Candidate 来源；真实 Session 运行时写出的 Candidate 自动包含当前 Session。
2. `lesson_prepare` schema 不再出现 Block `uses`，problem Block 必须使用 `cardAlias`，生成的 Markdown 仍有正确 `Uses`。
3. 只搜索未解析的题卡不能备课；解析目标题卡后可以；解析其他题卡仍不能。
4. `trace_append` 回执明确 Block 未改变，现有“未完成当前 Block 不得激活下一 Block”测试继续通过。
5. Pi 单元测试、类型检查与构建通过；Skill 文本不增加脆弱的逐字快照测试。
