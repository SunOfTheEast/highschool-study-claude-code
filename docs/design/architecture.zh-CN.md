# Markdown 优先的高中学习插件设计

> 本文记录 Claude Code 插件的原始 Markdown-first 重写原则。当前 Pi 运行时、
> Session-bound 写入与学生前端契约以 `AGENTS.md`、`docs/zh-CN/完整说明书.md`
> 和可执行 runtime 为准；本文不是 Pi 的逐项技术契约。

状态：正式设计已确认；已纳入双向题卡/Trace 搜索、Plan 级长期记忆压缩、学习集概述注入与可切换人设

日期：2026-07-21

实施计划：[学习集概述注入与可切换人设](../superpowers/plans/2026-07-21-learning-set-orientation-personas.zh-CN.md)

## 一、设计结论

Highschool Study 是一个本地 Claude Code 插件，不是学习平台后端。

一个学习集就是一个人类可以直接阅读和编辑的目录，其中的 Markdown 文件是持久化学习状态的唯一事实源。Claude Code 负责对话、Agent、Skill、Task List、目录召回和原生 Dynamic Workflow。一个很小的 MCP 服务器只负责真实题卡搜索、Trace 搜索与追加、来源解析；它不拥有数据库，不负责统一上下文编译，也不维护第二份学习状态。

已经确定的学习模型保持不变：

- `Roadmap → Plan → Lesson → ActivityBlock`；
- Roadmap、Plan、Lesson 三层记忆；
- 题卡、教学分类图与主次方法聚合；
- 灵活的积木式课堂；
- 学生拥有暂停和结束课程的主动权；
- 摘要和画像可以回溯到题卡或课堂步骤。

新实现从零开始编写，不重构旧 SQLite 插件，也不继承产品级的数据治理代码。

## 二、重写策略

现有 `highschool-study/` 插件冻结为参考实现。新的 Markdown 插件在同级空目录中重新编写：

```text
highschool-study-markdown/
```

新插件可以继续使用面向用户的插件名 `highschool-study`，但新旧两个插件目录不能同时加载。开发和验收只针对新目录。

以下内容不从旧实现迁移：

- TypeScript 业务服务层；
- SQLite migrations 和 SQL Trigger；
- 数据库测试；
- capability、lease、并发写入与重放机制；
- 兼容读取器或数据迁移器。

题卡、教学分类图等 subject-pack 资产，以及确实仍然适用的短提示词，可以经过人工判断后复制。旧代码不能因为“已经写过”就默认进入新插件。

重写期间不逐步拆除或删除旧目录。新插件通过验收后，可以直接从新目录运行；是否替换或归档旧目录是之后的独立操作。

新插件包只从以下结构开始：

```text
highschool-study-markdown/
├── .claude-plugin/
│   └── plugin.json
├── .mcp.json
├── agents/
│   ├── study-coach.md
│   └── lesson-designer.md
├── skills/
├── server/
│   └── 四工具 Markdown MCP
├── learning-set-template/
├── subject-packs/
├── tests/
└── README.md
```

四工具 MCP 可以使用全新、简短的 TypeScript 模块实现。限制的是旧服务架构的迁移，不是 TypeScript 语言本身。

## 三、学习集目录

```text
learning-set/
├── CLAUDE.md
├── CLAUDE.local.md          # 可选、仅本地、不提交 Git
├── .claude/
│   └── personas/            # 可选的学习集人设扩展或覆盖
├── ROADMAP.md
├── plans/
│   ├── fixed-value.md
│   └── max-value.md
├── lessons/
│   ├── lesson-001.md
│   └── lesson-002.md
├── memory/
│   ├── student-profile.md
│   ├── teaching-profile.md
│   └── planner-attention.md
├── cards/
├── graph/
└── materials/
```

`learning-set/` 是唯一可变的学习状态边界。插件代码、Agent、Skill、测试和 MCP 实现留在插件包内，不复制到每个学习集。`CLAUDE.local.md` 只是本机上该学习集的展示偏好，不是学习证据、长期记忆或共享状态。

## 四、各文件的职责

### 4.1 `ROADMAP.md`

`ROADMAP.md` 是当前长期学习目标与 Plan 图的唯一 owner，包含：

- 面向学生的简短“学习集概述”：学什么、适合谁、大致包含哪些 Plan、完成后能做什么；
- Roadmap 的目标和范围；
- 可观察能力标准及其测试方式；
- Plan 引用及建议顺序；
- Plan 之间的依赖、并行与重排关系；
- 当前状态和简短变更记录。

修改 Roadmap 前，Coach 先与学生在正常对话中讨论并获得确认，然后直接编辑文件。不再保存 proposal hash、nonce、DecisionEvent 或 revision service。

### 4.2 `plans/<plan-id>.md`

每个文件负责一个 Plan，包含：

- Plan 目标和可观察能力标准；
- 依赖 Plan 与并行组；
- 本 Plan 的 Lesson 索引；
- 与当前 Plan 有关的历史 Lesson 摘要；
- 未解决问题和建议下一步；
- 每条记忆性结论的来源链接。

后续 Plan 可以读取前面相关 Plan 的摘要。摘要只负责导航，不是独立证据；它必须能够链接回 Lesson 步骤、Trace 条目、题卡或材料。

### 4.3 `lessons/<lesson-id>.md`

一个 Lesson 文件同时保存备课结果与课堂记录，包含：

- 所属 Plan 和可选 Claude session ID；
- 本课目标与能力检查；
- 题卡或材料短别名到真实相对路径的映射；
- 有序 ActivityBlock、可选 Block 与简单分支；
- 只追加的课堂 Trace；
- 评价、学生建议、关闭选择和课后摘要；
- 供其他 Markdown 文件引用的稳定锚点。

Claude Code Task List 根据 ActivityBlock 生成，只负责界面展示。Task 完成不能覆盖 Lesson 文件，也不代表能力达标或课程结束。

### 4.4 `memory/*.md`

`student-profile.md` 只保存学生一侧当前有效、已经确认的稳定学习偏好或约束，例如先独立尝试还是先看示例。`teaching-profile.md` 只保存对 Claude 教师的教学行为、互动方法与稳定气质当前有效、已经确认的长期要求，例如答错后先追问思路还是直接讲解。它不保存“冷静学姐”之类的角色名、自称或口癖；这些属于展示人设。同一长期教学偏好只能选择一个 owner，不能同时换一种说法写入两个文件。

两份画像不是逐 Lesson 自动增长的事件日志。它们只在一个 Plan 完成后，由 `consolidate-plan-memory` 读取该 Plan 的全部课堂记录，生成新增、修改、删除差量，并经学生确认后更新。画像只保存当前有效列表；原始记录和历史仍在 Lesson 与 Git 中。

`planner-attention.md` 是可随时删除并重新生成的备课提示缓存，它来自 Plan、Lesson、Trace 与题卡方法聚合。它不是长期记忆，也不需要学生逐项确认。

每条长期偏好，包括学生明确说出的偏好，都必须以一个或多个相对 Markdown 来源链接结尾，并下钻到原始 Lesson Block、Trace、题卡或材料。链接失效时，该条偏好暂时不作为证据使用，直到来源被修复。

### 4.5 `cards/`、`graph/` 与 `materials/`

题卡继续保留 StudyForge 已有的可读教学结构，包括：

- 目标；
- 主方法与次方法；
- 主路线与辅助路线；
- 稳定题卡步骤；
- 原始材料来源。

`graph/` 保存稳定、容易理解的目标、方法和题型结构，不引入任意的全局前置关系。

`materials/` 保存视频、PDF、图片和文本材料，以 learning-set 内的相对路径引用。

已有 YAML 题卡和图谱资产可以继续保留。Markdown 是学习状态与记忆的强制格式，不要求仅为了统一扩展名而重写所有源资产。

### 4.6 `CLAUDE.md`、`CLAUDE.local.md` 与人设文件

`learning-set/CLAUDE.md` 是随学习集共享的稳定 Claude Code 指令，只保存：

- 这是一个 Highschool Study 学习集，应通过 `highschool-study:study` 进入；
- 学习集默认人设 ID；
- 人设只能影响表达层，不能覆盖教学事实和能力标准；
- 不得编造不存在的人设、题卡、Trace 或来源。

`learning-set/CLAUDE.local.md` 只保存学生在当前学习集中选定的持久人设，并加入 `.gitignore`。“这节课换一个人设”只在当前 Lesson Session 生效，不写文件；“以后这个学习集都用”才更新该本地文件。

插件的基础人设放在 `skills/enter-learning-set/references/personas/`；学习集可以在 `.claude/personas/` 中新增人设，或用同名文件覆盖插件版。人设文件是普通 Markdown，只描述名称、称呼、语气、鼓励方式和可选世界观，不定义教学结论、题卡选择或评价规则。

Claude Code 会把 `CLAUDE.md` 和 `CLAUDE.local.md` 作为会话上下文而不是强制配置，且 `@` import 会在会话启动时展开并占用上下文。因此不在 `CLAUDE.md` 中 import 全部人设；动态选择交给 Skill，每次只读一份。参见 [Claude Code memory 文档](https://code.claude.com/docs/en/memory)。

## 五、Markdown 约定

状态文件使用少量 YAML frontmatter 负责机器路由，正文使用 Markdown。ID 在一个 learning set 内保持稳定，并尽量可读。

```markdown
---
id: lesson-001
plan: max-value
status: closed
session: claude-session-id-or-null
---

## Block step-03 — 独立练习

...

## Trace event-007

...
```

跨文件引用使用普通相对链接和稳定锚点：

```markdown
- 无提示时能够识别冻结量，但仍遗漏定义域。
  来源：[lesson-001 event-007](../lessons/lesson-001.md#trace-event-007)，
  [冻结变量步骤](../cards/conics/freeze-variable-01.yaml#step=identify-freeze)
```

对于 Markdown 文件，fragment 是标题锚点。对于 YAML 等结构化题卡，`source_resolve` 把 `#step=<stable-step-id>` 解释为语义片段，并验证该步骤确实存在。

模型可以在某节 Lesson 中使用 `Q-FREEZE-01` 这样的短别名，但 Lesson 内的 alias 区必须把它映射到真实相对路径。别名不会成为隐藏的全局状态。

## 六、Claude Code 角色

- `study-coach` 是唯一面向学生的入口，负责规划、备课、上课、查看进度和更正记录的路由。
- `lesson-designer` 是备课专用配置，可由 Coach 在内部调用；学生不需要切换 Agent。
- 教学工作流继续写成 Skill。Skill 只保存工作步骤和提示词，不保存学生事实。
- `enter-learning-set` 在每次通过 `study` 进入时注入学习集概述与当前人设；它不创建新 Agent。
- `recall-study-memory` 负责结构、摘要与记忆召回。它使用 Claude Code 原生 `Read`、`Glob`、`Grep` 和必要时的 `Agent`，而不是调用一个固定的上下文编译工具。
- `consolidate-plan-memory` 只在 Plan 完成后运行，负责生成长期偏好差量、向学生确认，并编辑两份画像。
- 原生 Dynamic Workflow 是可选升级路径，仅在备课缺少值得并行查找的信息时运行。
- Workflow 分支的 raw JSON 留在 Claude Code 内。主 Agent 只把实际采用、并带来源链接的结论写入 Lesson Markdown。
- Task List 展示当前 Lesson 的课堂积木，但不是持久层。

### 6.1 学习集进入与人设解析

`study` 在判断 Roadmap、Plan 或 Lesson 路由之前，先调用 `enter-learning-set`：

1. 读取 `ROADMAP.md` 的“学习集概述”。概述在每次进入时都作为背景上下文，但只在学习集没有任何课堂 Trace，或学生主动询问时对外展开。
2. 按“当前 Session 临时选择 → `CLAUDE.local.md` 本学习集选择 → `CLAUDE.md` 学习集默认 → 插件默认”解析人设。
3. 枚举真实存在的本地和插件人设文件，按 ID 精确匹配。学习集同名文件优先；不从学生文本直接拼接路径。
4. 只读取最终选中的一份人设并交给 `study-coach`。“关闭人设”等价于选择插件内置的中性教师。
5. 备课 Agent 保持中性。人设只作用于学生可见输出，不进入 `lesson-designer`、`planner-attention.md`、Trace、摘要、长期画像或方法聚合。

首版插件只内置少量模板，例如“中性教师”、“冷静学姐”和“元气同桌”。扩展人设不需要修改 MCP、新增 Agent 或建立人设数据库。

## 七、召回策略

插件不使用单一的 `study_context_get` 预编译所有上下文。不同事实使用不同召回方式：

1. **结构召回**：用 `Read`、`Glob`、`Grep` 找到 `ROADMAP.md`、当前 Plan、当前 Lesson 和索引关系。
2. **层级摘要召回**：同一 Plan 内召回前序 Lesson Summary；后续 Plan 召回前面相关 Plan Summary。摘要负责导航，必要时沿链接上溯原始记录。
3. **长期偏好召回**：`student-profile.md` 与 `teaching-profile.md` 已经过 Plan 级压缩且足够短，备课和上课时完整读取，不再做相似度筛选。
4. **备课提示召回**：仅备课读取可重建的 `planner-attention.md`。
5. **题卡召回**：使用 `card_search`；每张候选题卡同时带回与它绑定的全部有效 Trace 历史。
6. **证据召回**：使用 `trace_search` 按 Plan、Lesson、题卡或文本条件搜索；命中项可以反查真实题卡。
7. **来源下钻**：使用 `source_resolve` 验证并打开精确文件或锚点。

`recall-study-memory` 先用直接目录读取完成结构与摘要召回。只有 Planner 判断信息不足且确实存在可并行的独立查找问题时，才启动原生 Agent/Dynamic Workflow；信息已经足够时不启动。分支结果保留在 Claude Code 的 raw JSON 中，不写成第二份记忆。

## 八、最小 MCP 工具面

新的 MCP 服务器只暴露四个工具。

### 8.1 `card_search`

- 只搜索 `cards/` 中实际存在的题卡；
- 可以使用 `graph/` 中的目标、主次方法和题型结构信息；
- 返回真实相对路径、可用别名、方法角色和真实题卡步骤；
- 每一张候选题卡都附带按时间排序的全部有效 `traceHistory`，没有历史时返回 `[]`；
- 通过限制题卡候选数量控制上下文，不截断单张题卡的 Trace 历史；
- 没有合适题卡时返回空结果。

### 8.2 `trace_search`

- 搜索全部 Lesson 中当前有效、未被 supersede 的 Trace；
- 支持按 Plan、Lesson、`cardPath` 和文本条件过滤；
- 每条命中保留 `cardPath` 与可选 `cardStepId`，从 Trace 可以直接反查题卡；
- 多条 Trace 指向同一题卡时，以去重的 `cardsByPath` 返回题卡内容，避免重复占用上下文；
- 不带题卡的讲解、视频、讨论等 Trace 仍可正常返回。

### 8.3 `trace_append`

- 向当前 Lesson 文件追加一个带稳定 ID 的 Trace 小节；
- 从当前 Lesson 的 alias 映射解析题卡编号，保存真实的 learning-set 相对 `cardPath` 与可选 `cardStepId`；
- 在存在相应对象时记录 Block、题卡或材料路径、评价、支持程度和来源锚点；
- 不改写已有 Trace 条目。

### 8.4 `source_resolve`

- 在 learning-set 根目录内解析 Markdown、题卡和材料的相对链接；
- 返回精确文件和锚点，或者明确返回引用无效；
- 不搜索 learning set 以外的路径。

Roadmap、Plan、Lesson 备课内容、摘要和画像由 Claude Code 使用普通 Markdown 文件编辑完成。MCP 是便利工具和真实性 fence，不是业务服务层。

## 九、题卡与 Trace 的双向关系

关联事实只保存一次，由 Trace 持有：

```text
Trace -- cardPath / cardStepId --> Card
Card  -- 按 cardPath 的运行时反向索引 --> Trace[]
```

题卡文件不保存 Trace backlink。`trace_append` 写入 canonical `cardPath`；`trace_search` 沿该字段正向解析题卡；`card_search` 在读取题卡候选后按 `cardPath` 反向连接 Trace。

每次相关 MCP 请求只解析一次 active Trace，并建立请求内索引 `Map<cardPath, TraceRecord[]>`。`card_search` 不得为每张候选题卡分别扫描全部 Lesson；`trace_search` 只读取命中 Trace 所引用的去重题卡。当前本地插件不建立数据库或持久化索引；只有性能测量证明有必要时，才考虑进程内、按 Lesson 文件修改时间失效的缓存。

被后续更正 supersede 的旧 Trace 保留在 Lesson 文件中，但不进入 `traceHistory`、`trace_search` 结果、方法聚合或长期记忆压缩输入。

## 十、Plan 级长期记忆压缩

长期记忆只表示经过学生确认、跨 Lesson 仍有用的偏好，不表示知识掌握度、某次答题结论或临时备课提醒。

Plan 进行中，课堂事实只写入 Lesson Trace；同一 Plan 的后续 Lesson 通过前序 Lesson Summary 与按需 Trace 搜索保持连续性。Plan 达到能力标准且学生确认完成后，`consolidate-plan-memory` 执行一次压缩：

1. 读取该 Plan 的全部 Lesson、active Trace、课堂步骤、学生建议与 Lesson Summary；
2. 读取当前 `student-profile.md` 与 `teaching-profile.md`；
3. 由 LLM 做语义聚合，不使用固定分数或规则阈值；
4. 生成带直接原始来源的新增、修改、删除差量，并同时显示支持证据、冲突证据和适用条件；
5. 向学生展示候选列表，允许自然语言保留、改写或删除；
6. 只有得到明确确认后，才通过普通 Markdown 编辑合并到两份画像。

学生侧偏好只写入 `student-profile.md`，教师的教学行为、互动方法与稳定气质要求只写入 `teaching-profile.md`；展示人设不进入两份长期画像。边界项选择一个 owner，不双写。画像只保留当前有效列表；候选、废弃版本和被拒绝项不常驻。学生在确认阶段提出的反对或修正应记录到最后一次 Plan 复盘对应的 Lesson Block/Trace，成为下一次压缩可见的原始证据。

Plan 结束后的压缩是差量合并，不是从全部历史重写画像。后续备课和上课完整读取两份短画像；只有需要验证某条偏好时，才沿其来源链接下钻。

### 10.1 跨周期学情研判与 `Planning Basis`

长期偏好压缩回答“哪些学习要求应常驻”，`plan-next-cycle` 回答“结合长期
变化，此刻最值得进入哪个学习周期”。两者不合并成新的记忆层。

Coach 在方向可能变化时读取 Roadmap、相关 Plan Summary、已确认画像和
`LEARNING_GUIDE.md`，再按需沿摘要来源打开 Lesson、active Trace 或题卡。
它重建独立性、支持、迁移、保持、反复出现的认知动作和既往教学反应。
只有多个解释会导向实质不同的 Plan 时才比较它们；证据不足时创建短诊断
Plan，而不是机械选择最低方法信号。

学生确认后，新 Plan 以普通 Markdown `## Planning Basis` 保存当前判断、
真正改变选择的直接来源，以及验证或重规划信号。每份 Plan 都使用当前八
小节契约：`Goal`、`Observable Capability Standard`、`Test`、
`Planning Basis`、`Lesson Index`、`Current Position`、
`Next Lesson Candidate` 和 `Plan Summary` 必须各出现一次且内容非空。
共享读取器会在学习集打开或 Plan 注册前拒绝旧版或不完整 Plan。系统不自动
迁移；使用新运行时前应保留原内容和来源，手工补全缺失小节。

来源冲突时按 `active Trace → 带来源的 Lesson/Plan Summary → Planner Attention`
判断。active Trace 决定作答结果、支持程度、实际方法和记录时间；带来源摘要
只是紧凑检索索引，Planner Attention 只是可重建的备课提示。手工维护或明确
标为 prototype 的 HEATMAP 不属于当前学情证据。

Plan 结束时，现有 Plan Summary 对照 active evidence 回看初始判断与教学
作用；没有课堂来源时，干预效果、迁移和保持继续标为未验证。

```text
confirmed profiles = 经学生确认、跨课仍有效的偏好
active Trace = 具体课堂表现事实
Planner Attention = 可重建的备课提示
Planning Basis = 当前 Plan 带来源的工作判断
Plan Summary = 结果回看与后续召回索引
```

```text
Planning Basis → Lesson / active Trace → Plan Summary → plan-next-cycle
```

信息充分时 Coach 直接研判。只有历史广、冲突或可能改变方向时，才选择一到
三个真正独立的 Evidence Scout 问题；子任务只返回来源与发现，不决定或写入
Plan。

## 十一、题卡真实性 fence

题卡真实性只使用两层控制：

1. `card_search` 只返回 `cards/` 中真实存在的文件，同时给出真实步骤、路径与绑定 Trace。
2. 备课与教学提示词明确要求：只允许使用查询结果；没有合适题卡就停止寻找，不得编造题卡、路径、步骤、分数或别名。

没有合适题卡时，Lesson 仍可以使用真实材料、讲解、示范或对话，但不能声称存在一条基于题卡的评价证据。

## 十二、学习闭环

1. 学生与 Coach 通过普通对话创建或修改 `ROADMAP.md` 和 Plan 文件。
2. `recall-study-memory` 读取当前 Plan、前序摘要和两份完整画像；备课另外读取 `planner-attention.md`。
3. Designer 通过 `card_search` 获得真实题卡及其完整 Trace 历史，必要时通过 `trace_search` 查找跨题卡证据。
4. Designer 将下一课写成由 ActivityBlock 组成的 Lesson Markdown。
5. 上课时，Coach 把 ActivityBlock 投影到 Task List，并通过 `trace_append` 追加课堂 Trace。
6. 学生暂停或结束 Lesson 时仍拥有最终决定权；Lesson 记录选择、建议和摘要。
7. 下一次备课根据题卡主次方法与 active Trace 做简单聚合，并重建 `planner-attention.md`。主方法贡献多、次方法贡献少。
8. Plan 完成时运行长期记忆压缩；学生确认差量后更新两份画像。
9. 后续 Plan 完整读取已经压缩的偏好，形成跨会话闭环。

## 十三、更正与历史

更正记录追加到原 Lesson 中，形成新的 Trace 小节：

```markdown
Supersedes: [event-007](#trace-event-007)
```

新小节写明更正后的内容。所有搜索、聚合和压缩过程忽略被 supersede 的旧条目，也忽略只引用无效来源的 memory 条目，然后重新生成受影响的摘要和 `planner-attention.md`。如果更正改变了一条已确认偏好的依据，下一次 Plan 压缩必须把修改或删除作为候选交给学生确认；不得静默改写长期偏好。

Git 可以提供文件历史和回滚，但插件不要求自动提交。系统不再维护 SQL 更正图、stale 传播表或 schema migration。

## 十四、不带入新实现的架构

全新实现不复制、也不模拟以下机制：

- SQLite、migration、schema identity 和数据库兼容代码；
- RuntimeCapability、WriterLease、operation replay 和多写者并发机制；
- proposal hash、nonce、expiry、DecisionRequest 和 DecisionEvent；
- SQL 版 ContextView、MethodMastery、PlannerAttention、画像、教学方法和 resident memory 表；
- Workflow finding adoption 持久化和 DerivationRun 协议；
- Zod、TypeScript 服务层和 SQL Trigger 中重复的验证逻辑；
- 产品级多用户、多进程、备份、恢复和 authority 声明。

不提供兼容读取器或旧数据库转换器。冻结的 SQLite 插件和数据可以留作参考，但新插件不会读取它们。

## 十五、错误处理

插件只做直接、可见的失败处理：

- 找不到题卡：返回空结果，不编造；
- Lesson alias 找不到真实题卡或题卡步骤：拒绝追加该条 Trace，并指出失效 alias/步骤；
- 来源链接失效：排除依赖该链接的 memory 结论，并显示损坏链接；
- frontmatter 格式错误：报告文件并在覆盖前停止；
- 同一目录中出现重复稳定 ID：报告冲突；
- 缺少当前 Roadmap、Plan 或 Lesson：由 Coach 引导创建或选择；
- 找不到指定人设：明确告知学生，并回退到学习集默认或插件中性人设；
- `ROADMAP.md` 缺少学习集概述：从 Roadmap 标题、Goal、Plan Graph 和能力标准组成一句简短说明，不阻塞上课。

不实现 lease、自动重试、分布式事务或就地 schema 升级。

## 十六、验收标准

- 不运行插件时，用户也能直接读懂一个完整 learning set。
- Coach 能创建并恢复 Roadmap、Plan 和 Lesson Markdown。
- 一节课能按需要组合视频、讲解、练习、互动和测试，而不是套固定流程。
- MCP 工具面严格是 `card_search`、`trace_search`、`trace_append`、`source_resolve`，不存在 `study_context_get`。
- `card_search` 不返回不存在的文件；空结果不会产生虚构引用；每张候选题卡都返回完整 active `traceHistory` 或 `[]`。
- `trace_search` 能从 Trace 反查去重题卡，也能返回不绑定题卡的课堂 Trace。
- 任意带题卡的课堂 Trace 可以追溯到对应 Lesson Block、真实题卡与可选题卡步骤；题卡文件不保存 backlink。
- 每条长期偏好，包括学生明确声明，都能追溯到真实来源锚点。
- 同一 Plan 的前序 Lesson 摘要会改变后续 Lesson 备课；上一 Plan 的摘要会进入相关后续 Plan 的召回。
- Plan 完成后只有经学生确认的差量才能修改两份画像；删除和改写都遵从学生选择。
- 备课和上课完整读取两份短画像，只有备课读取 `planner-attention.md`。
- 学生结束课程与系统判断能力达标保持分离。
- 方法聚合能够从 Trace 和题卡主次方法角色重新生成。
- Dynamic Workflow 保持可选，不产生第二套持久化协议。
- 新插件可以直接从 `highschool-study-markdown/` 安装和运行，不加载旧插件。
- 新插件启动时不需要 SQLite、migrations 或数据库数据目录。
- 每次通过 `study` 进入都会读取学习集概述；无课堂 Trace 时主动介绍，已有 Trace 时不重复展开。
- 人设解析遵循 Session 临时选择、本学习集持久选择、学习集默认、插件默认的固定优先级。
- 临时切换不改写文件；持久切换只更新被 Git 忽略的 `CLAUDE.local.md`，并在下一个 Lesson Session 继续生效。
- 学习集人设能新增或覆盖插件人设；每次进入只加载一份最终人设文件。
- 切换或关闭人设不会改变能力判断、题卡选择、Trace 事实、测试标准或备课结果。

## 十七、非目标

- 产品级多用户或教师管理；
- 强身份、权限、审计或并发写入保证；
- 校准后的 BKT 或教学效果声明；
- 任意关系的通用知识图谱；
- 后台自动运行或离线教学服务；
- 通用向量数据库、持久化 Trace 反向索引或后台记忆聚合服务；
- 从已废弃的预发布数据库架构迁移数据；
- 人设商店、人设数据库、每个人设一个 Agent，或将全部人设常驻注入上下文。
