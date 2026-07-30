# StudyForge 学习节点树、上下文与证据继承设计

状态：待用户审阅
日期：2026-07-30

## 一、结论

StudyForge 将 Roadmap、Plan 和 Lesson 建模为一棵学生专属的学习编排树：

```text
Roadmap
├── Plan A
│   ├── Lesson 001
│   ├── Lesson 002
│   └── Lesson 003
└── Plan B
    ├── Lesson 004
    └── Lesson 005
```

树边表示管理权，不表示知识前置关系：

- Roadmap 管理尚未激活的 Plan；
- Plan 管理尚未激活的 Lesson；
- Lesson 管理尚未激活的 ActivityBlock；
- 子节点激活后取得自己的控制权，父节点不能再改写它；
- 子节点结束后生成带来源 Handoff，父节点在学生返回原 Session 后复盘并重新编排未来分支。

整套架构遵循一句话：

> 已发生的学习由当前节点记录；尚未发生的学习由父节点编排。

这棵树同时成为：

- Agent Session 的边界；
- 上下文装配的边界；
- 文件与工具权限的边界；
- 局部记忆寿命的边界；
- 父子 Handoff 和证据聚合的边界。

题卡、方法图谱和材料仍是学习集公共资产，不并入学生学习树。课堂 Trace 进入学习集级
全局事实池，通过 `plan + lesson + block + card + time` 等运行时来源字段与学习树关联。

## 二、背景

当前系统已经具备：

- Markdown-first 的 Roadmap、Plan、Lesson；
- Roadmap Coach、Plan Coach 和 Lesson Tutor Session；
- 真实题卡、方法图谱、材料与全局搜索；
- Lesson ActivityBlock、课堂 Trace、Plan 总结和长期画像；
- Student View / Teacher Control、安全投影与可恢复路由；
- Coach 问诊、积木式备课和 Tutor 现场教学 Frame。

当前 Roadmap 的 `Plan Graph` 和 Plan 的 `Lesson Index` 仍主要表现为线性列表。真正的
适应性依赖 Coach 在每次会话中重新解释这些列表，因而存在四个结构性缺口：

1. 未来节点与已经发生的历史使用相似的表示，父子编辑权不够直观；
2. Agent 能读到大量记忆，但“哪些记忆如何改变本次设计”没有稳定交接契约；
3. 父子 Agent 的文件可见范围和写权限仍部分依赖 Prompt，而非节点身份；
4. Lesson、Plan、Roadmap 的摘要可以回溯来源，但尚未形成统一、逐层可寻址的
   Handoff 证据树。

本设计不是把线性列表换成一张漂亮的树图，而是把“未来可改、当前自治、历史只读”
变成运行时理解的事实。

## 三、目标与非目标

### 3.1 目标

- 让 Roadmap、Plan、Lesson 共享一套清晰的父子控制权与生命周期语义；
- 保留 Markdown 文件作为唯一持久学习事实，不增加数据库或通用图引擎；
- 让远期教学预案保持轻量，近期节点可以完整备好；
- 激活时冻结带来源上下文，使子 Agent 独立运行且不会被父节点后续变化污染；
- 让记忆向上压缩、向下选择性编译，并可随时回到原始 Trace、Session 和题卡；
- 让每个节点只获得必要文件和工具，所有写入对象由运行时绑定；
- 让长期记忆只从多课证据、学生确认和受信任运行时提交中产生；
- 保留现有高中数学教学 Frame、课堂模板、题目角色、揭示策略与 Tutor 灵活性；
- 用对照式真实模型验收判断个性化是否真正改变了教学设计。

### 3.2 非目标

本设计不增加：

- 通用 DAG 数据库、向量库或后台索引；
- 自动条件规则引擎或自动 mastery 判决；
- 后台调度器、消息队列或 Agent 之间的共享可变内存；
- 每个 ActivityBlock 一个独立 Agent 或 Session；
- 固定学习风格标签、人格推断或自动心理诊断；
- 大量分支类型、教学动作或能力等级枚举；
- 为旧版非规范 Plan、Lesson 或画像增加迁移兼容层；
- 新的公共 Claude Code MCP 工具；公共工具仍保持现有四个；
- 为 Skill 文本增加脆弱的逐句或关键词测试。

## 四、方案选择

### 4.1 方案 A：只把现有列表投影成树

继续使用线性 `Plan Graph` 和 `Lesson Index`，前端按链接绘图。改动小，但激活、
控制权和上下文冻结仍只是约定，无法真正解决越权写入和历史漂移。

### 4.2 方案 B：三类节点，共享生命周期协议

Roadmap、Plan、Lesson 继续保留各自的 Markdown 语义，但共享候选、物化、激活和
终态协议。父节点保存远期轻量候选，近期候选被物化成完整子文件，学生激活后由
子 Session 接管。

采用本方案。

### 4.3 方案 C：通用节点图引擎

把所有对象改造成同一种 Node，通过不同边类型表达管理、依赖、替代和来源。形式统一，
但会引入边验证、冲突处理、迁移和第二套存储语义，超过当前单人版的真实需求。

## 五、两棵图必须分开

### 5.1 学生学习编排树

```text
Roadmap → Plan → Lesson → ActivityBlock
```

它回答：

- 这个学生正在哪一阶段；
- 哪些未来分支仍可调整；
- 哪个 Agent 拥有当前节点；
- 哪些 Handoff 和记忆应进入下一层。

### 5.2 公共教学资产图

```text
方法节点
├── primary route
├── secondary / supporting route
└── problem cards / materials
```

它回答：

- 学习集里有哪些数学方法和内容；
- 题卡主要考查什么、次要涉及什么；
- Agent 可以选择哪些真实材料。

学习编排节点可以引用资产图谱中的方法、题卡和材料，但学生个体历史不会反向改写
公共知识骨架。全局 Trace Pool 是连接两者的事实桥梁。

## 六、节点生命周期与控制权

### 6.1 共享语义

```text
candidate
  → prepared
  → active / paused
  → closed / completed / abandoned
```

不同节点保留自己的终态词汇：

- Lesson 使用 `closed` 或 `abandoned`；
- Plan 使用 `completed` 或 `abandoned`；
- Roadmap 是持续存在的根节点，通过版本化 Handoff Checkpoint 表达阶段变化。

共享的是控制权语义，而不是强迫三种 Markdown 使用完全相同的内容字段。

### 6.2 Candidate

Candidate 是父节点中的轻量教学预案：

- 没有独立文件；
- 没有 Agent Session；
- 可以被父节点增删、重排和改写；
- 可以同时存在多个互斥或并列分支；
- “适用条件”只使用自然语言，不由规则引擎自动判断。

Candidate 的内部句柄由运行时分配。模型提交公开目的、考虑条件、来源和教学判断，
不负责生成全局唯一 ID、文件路径或父节点引用。

最小候选内容为：

```markdown
### Candidate <stable-id>

- Public purpose: 学生可以看到的学习目的
- After: 该分支在视图中接在哪个已存在孩子之后；没有则为空
- Depends on: 激活前必须结束的兄弟节点句柄；没有则为空
- Consider when: 父 Coach 何时会考虑该分支
- Sources: 支持这个预案的学生原话、Handoff 或 Trace
- Private note: 不对学生展示的简短教学判断
```

其中 `<stable-id>` 是运行时返回给父 Agent 的局部句柄。候选状态由它所在的父节点
候选区推导，不重复写一个 `status: candidate`。候选物化时，运行时根据该句柄分配
子节点 ID、路径和父链接；模型只提交无法推导的节点标题与教学内容。

`After` 只决定编排视图和建议顺序，不自动触发激活。`Depends on` 是唯一可选的硬
依赖，Runtime 只检查被引用兄弟是否已结束；教学条件仍由父 Coach 与学生判断。
没有依赖的 Plan 可以并行，没有依赖的 Lesson 仍受“每 Plan 单 active Lesson”限制。

### 6.3 Prepared

父节点决定近期可能执行某个候选时，将它物化为完整子节点文件：

- 完整 Plan 或 Lesson Markdown 已经存在；
- 父节点仍拥有它，可以原地重新准备；
- 学生界面只显示安全的公开目的、活动形状和状态；
- 子节点尚无独立常驻 Agent Session；
- 父节点不能同时把远期所有分支都完整备出。

远期分支保持轻量，下一步才物化，避免提前生产大量很快过时的课程。

### 6.4 Active

学生确认开始后，由运行时原子转移控制权：

1. 验证子节点文件、父链接、出生快照和必需来源；
2. 检查并行约束并预留激活；
3. 创建或恢复带唯一 Node Owner 的 Session；
4. 编译 Prompt、Context Frame、文件 Allowlist 和工具集合；
5. 提交 `active` 状态并刷新前端投影。

任一步失败，子节点仍保持 `prepared`，父节点继续拥有它。

节点激活后：

- 父节点不能修改其目标、父链接或出生快照；
- 子 Agent 只写本节点允许的事实；
- 子 Agent 可以管理本节点仍未激活的孩子，例如 Plan 的 Lesson Candidate 或
  Lesson 的 pending Block；
- 若需要完全重备，保留原节点并创建新的兄弟替代节点；
- 不允许通过回写历史伪装成“从未发生”。

### 6.5 Terminal

Plan 完成和 Roadmap 形成 Checkpoint 时，先验证并封存 Handoff，再提交相应事实：

- Handoff 及节点历史只读；
- 父节点可以读取结果，但不能回头改写；
- 父 Agent 在学生返回原 Session 后重新编排仍未激活的兄弟节点；
- 不自动在后台唤醒父 Agent。

Lesson 的关闭主动权属于学生，不能被 Handoff、Reflection 或总结格式阻塞：

- 正常路径由 Tutor 在 `lesson_close` 中提交学生安全总结和 Handoff Claims；
- Runtime 验证可用 Claim，封存来源后关闭 Lesson；
- 若学生明确结束而 Tutor 没有提供合法 Claim，Runtime 仍立即关闭 Lesson，并保存
  一个不含结论、只含真实 Trace 与 Session 入口的 source-only Handoff；
- source-only Handoff 不能直接支持长期记忆，但父 Coach 可以回读原始来源后形成自己
  负责的上层 Claim；
- 关闭后 Tutor 不再继续教学或补问 Reflection。

### 6.6 并行边界

- Roadmap 下可以同时存在多个 active Plan；
- 每个 Plan 同时最多一节 active Lesson；
- 学生选择当前进入哪个 Plan，Agent 不静默切换；
- paused Lesson 仍占用该 Plan 的 active Lesson 名额；
- Lesson 内可以有多个 pending ActivityBlock，但同时最多一个 active Block。

## 七、父节点对孩子的持久表示

父节点持久保存两类信息：

1. 仍未物化的 Candidate；
2. 已物化子节点的编排关系和公开目的。

子节点自己的 `status` 是状态唯一真相。父文档中的树形列表不复制子节点状态文字，
前端读取子文件后投影状态，避免父子状态相互冲突。

新运行时使用确定的节点区：

- `ROADMAP.md / ## Plan Tree`；
- `plans/<id>.md / ## Lesson Tree`；
- `lessons/<id>.md / ## Block ...`。

`Plan Tree` 和 `Lesson Tree` 同时容纳已物化子节点链接及仍未物化的 Candidate。
Materialized entry 保留公开目的、`After` 和 `Depends on`，状态始终从子文件读取。
旧 `Plan Graph` 与 `Lesson Index` 不再作为新运行时输入，也不增加双读兼容。

子节点的父归属属于运行时权限事实：

- Lesson 的父 Plan 由当前 Plan Session 和物化操作绑定；
- Plan 的父 Roadmap 固定为当前学习集根；
- 模型不填写 `ownerPath`、父 Session ID 或磁盘绝对路径；
- 父子链接与子文件写入在同一运行时操作中完成。


## 八、上下文页表

每个 active Node Session 的 Context Frame 由四类页面组成。

### 8.1 Resident

每轮稳定装入：

- 共享高中数学 Teaching Core；
- 当前 Node Role Prompt；
- 当前学习集的相关学习原则；
- 少量与本节点直接相关的确认长期记忆；
- 当前节点身份、允许文件和可用工具摘要。

### 8.2 Frozen

父节点激活子节点时冻结：

- 子节点为什么在此刻被选择；
- 相关父节点结论；
- 选入的历史 Handoff 和 Trace 来源；
- 与本节点有关的长期记忆；
- 内容与揭示边界；
- Activation Adaptation Brief。

Frozen 内容不会因为父 Session 后续变化而改变。

### 8.3 Local

当前节点自己产生：

- 当前 Node Markdown；
- 当前 Pi Session JSONL；
- 当前节点状态与本地工作结论；
- Lesson 的 Block 状态；
- Plan 或 Roadmap 的未激活候选分支。

### 8.4 Index

只保留来源，按需回读：

- 前序 Lesson / Plan Handoff；
- 全局 Trace Pool 查询入口；
- 题卡、方法节点和材料；
- 原始 Session 消息引用；
- 证据树的下层 Claim。

不把完整父 Session、兄弟 Session、所有题卡或全量 Trace 预塞给子 Agent。

### 8.5 三种 Agent 的默认工作集

#### Roadmap

```text
Resident
├── Roadmap Prompt
├── 学习集概述与学习原则
└── 根级确认画像

Local
├── ROADMAP.md
├── Plan Candidate Tree
└── 当前 Roadmap Session

Index
├── Plan Handoffs
├── Roadmap Handoff Checkpoints
└── 全局 Trace 聚合入口
```

#### Plan

```text
Resident
├── Plan Prompt
├── 相关学习原则
└── 与本周期相关的确认画像

Frozen
└── Roadmap → Plan 出生快照

Local
├── 当前 Plan.md
├── Lesson Candidate Tree
└── 当前 Plan Session

Index
├── 同 Plan Lesson Handoffs
├── Plan 范围 Trace
└── 题卡、方法与材料
```

#### Lesson

```text
Resident
├── Lesson Prompt
├── 课堂协议
└── 本课真正相关的少量画像

Frozen
└── Plan → Lesson 出生快照与 Teacher Control

Local
├── 当前 Lesson.md
├── Block 状态
└── 当前 Tutor Session

Index
├── 已绑定或已揭示题卡
├── 当前题卡完整 active Trace 历史
└── 允许的材料与来源
```

父子不复制原始 Session。控制权通过 Frozen Snapshot 交接，细节通过 Index 按需换入。

## 九、Activation Adaptation Brief

仅仅“读取记忆”不会自动形成个性化。每次 Roadmap 激活 Plan、Plan 激活 Lesson 时，
父 Agent 必须把关键材料合成为一份简短适配说明，并冻结在子节点出生快照中。

最小契约为：

```markdown
### Adaptation Brief

- Working judgment: 当前最值得检验的学生理解或教学机会
- Sources:
  - 可解析的学生原话、Handoff Claim 或 Trace
- Design consequence: 该判断具体改变了本节点的目标、任务、顺序或介入方式中的什么
- Revise if: 什么后续表现会推翻或收窄当前判断
```

四项均为父 Agent 无法由运行时推导的教学判断，因此属于持久事实，而不是 UI 投影。

适配说明不得退化为：

- 画像条目列表；
- “根据学生情况个性化安排”之类空话；
- 无来源的心理猜测；
- 与实际节点设计没有可观察差异的总结。

最终判断标准是：

> 如果移除某条关键 Handoff 或长期记忆，本节点的目标、任务、顺序或介入方式是否会
> 发生可解释的变化。

如果不会，这条记忆就没有真正参与个性化。

## 十、分级记忆与全局 Trace Pool

### 10.1 节点局部记忆

#### Lesson

保存最细的局部课堂记忆：

- 当前 Session；
- Block 状态；
- 出生快照；
- Trace 引用；
- Lesson Handoff。

#### Plan

保存本周期工作记忆：

- Roadmap 出生快照；
- Current Position；
- Lesson Handoff 索引；
- 与当前 Plan 相关的注意事项投影；
- 未激活 Lesson 候选；
- Plan Handoff 和长期记忆候选。

#### Roadmap

保存跨周期方向：

- 长期 Goal、能力标准与 Test；
- Plan Candidate Tree；
- Plan Handoff 索引；
- Roadmap Handoff Checkpoints；
- 经学生确认的学生画像和教学偏好。

### 10.2 记忆寿命跟随节点

- 一次课堂的疲劳、情绪或临时选择默认留在 Lesson；
- 一个周期内反复出现但尚未跨周期确认的模式留在 Plan；
- 跨任务、跨 Lesson 或跨 Plan 重复出现，并经学生逐条确认的内容才进入根级长期记忆；
- 不增加模型自由填写的 TTL 或“稳定度”数字，节点位置和确认流程已经表达寿命。

### 10.3 全局 Trace Pool

题卡 Trace 不属于 Lesson 私有文件，而属于学习集级全局事实池。

每条 Trace 的运行时来源至少包含：

```text
trace_id
card
plan
lesson
block
occurred_at
assessment
support
source refs
```

Plan、Lesson、Roadmap 和题卡页面只是同一事实池的不同读取投影：

```text
Lesson view  = trace.lesson == current lesson
Plan view    = trace.plan == current plan
Card view    = trace.card == current card
Roadmap view = current learning set aggregate
```

“访问过题卡”在本设计中指某个 Lesson 实际使用该卡并产生课堂 Trace，不为普通
`card_search` 或 `source_resolve` 读取增加学习事实。

Trace 更正继续使用 active / supersede 语义。普通投影只读取 active Trace。

## 十一、节点间通信与写入

### 11.1 本层写，本层负责

- Roadmap Agent 写 Roadmap 自身和自己拥有的 prepared Plan；
- Plan Agent 写 Plan 自身和自己拥有的 prepared Lesson；
- Lesson Agent 写 Lesson 自身与课堂局部状态；
- active Lesson 可以向全局 Trace Pool 追加真实课堂事实；
- 任何 Agent 都不能直接修改父节点、活动兄弟节点或根级确认画像。

### 11.2 向下通信

父节点激活子节点时一次性交付 Frozen Snapshot：

```text
父节点判断
→ Adaptation Brief
→ 选入的记忆与来源索引
→ 内容和权限边界
→ 子 Session
```

激活后没有父节点实时注入或共享可变上下文。

### 11.3 向上通信

子节点结束后生成并封存 Completion Handoff：

```text
子节点事实
→ Handoff Claims
→ 父节点恢复 Session
→ 学生与父 Coach 复盘
→ 重编排未激活兄弟节点
```

父节点不在后台自动运行。学生返回父 Session 才发生新的教学判断。

### 11.4 横向通信

兄弟节点不直接互读：

- Lesson 003 不直接读取 Lesson 001 Session；
- Plan B 不直接读取 Plan A 的原始工作上下文；
- 父节点根据需要把前序 Handoff Claim 或来源索引编入新的出生快照。

## 十二、三层 Handoff 证据树

### 12.1 层级

```text
Roadmap Handoff Claim
  → Plan Handoff Claim
    → Lesson Handoff Claim
      → Trace / Session Message / Card / Block
```

#### Lesson Handoff

引用当前 Lesson 的原始课堂事实。

#### Plan Handoff

引用本 Plan 内一个或多个 Lesson Handoff Claim，表达周期结论、边界和下一步。

#### Roadmap Handoff

Roadmap 没有父节点，因此它是版本化的根级阶段检查点。它引用多个 Plan Handoff
Claim，为未来 Plan、跨周期复诊和长期记忆解释提供来源。

多个上层 Claim 可以共享同一底层来源，底层实现可能是 DAG；学生从一个当前结论向下
展开时，仍看到一棵易理解的证据树。

### 12.2 Handoff Envelope

```markdown
## Handoff

- ID: lesson-006/handoff
- From: lesson:lesson-006
- To: plan:route-choice
- Sealed at: 2026-08-04T20:32:00+08:00
```

`ID`、`From`、`To` 和 `Sealed at` 属于运行时权限与来源事实，由当前节点身份和时钟
绑定。模型不填写磁盘路径、Session ID、Handoff ID 或 Claim ID。模型提交有序的
Claim 内容，运行时渲染稳定锚点并在成功回执中返回可引用的来源句柄。

### 12.3 Claim 契约

```markdown
### Learner Claim C1

- Statement: 学生能独立识别两条可行路线
- Scope: 本节两道同类题
- Sources:
  - trace:trace-0194
  - session:msg-028
- Boundary: 尚未证明跨题型稳定
- Next use: 下一课测试限时路线选择
```

```markdown
### Teaching Claim T1

- Statement: 先比较路线成本比直接提示方法名更能促成独立选择
- Scope: 本节第二道题及随后的迁移尝试
- Sources:
  - lesson-006/handoff#learner-claim-c1
  - trace:trace-0194
- Boundary: 尚未验证在陌生题型中的效果
- Next use: 下一课保持题型陌生，但继续要求先比较路线代价
```

Learner Claim 支撑学生能力和困难判断；Teaching Claim 支撑教学偏好与有效介入判断。
两者使用相同字段，避免分别发明两套证据系统。

### 12.4 Open Question 契约

```markdown
### Open Question Q1

- Question: 犹豫来自计算成本判断，还是来自对陌生路线的不确定感？
- Sources:
  - lesson-006/handoff#learner-claim-c1
- Next check: 保持题型，只改变两条路线的成本差
```

### 12.5 Source-only Lesson Handoff

学生主动结束课堂时，关闭优先于综合结论。若 Tutor 没有提供可封存 Claim，Runtime
仍生成最小 Handoff：

```markdown
## Handoff

- ID: lesson-006/handoff
- From: lesson:lesson-006
- To: plan:route-choice
- Sealed at: 2026-08-04T20:32:00+08:00

### Source Index

- trace:trace-0194
- session:lesson-006
```

它只说明有哪些真实课堂来源，不声称学生学会了什么，也不虚构 Open Question。
Plan Coach 后续可以读取这些来源并形成自己负责的 Plan Claim。

### 12.6 封存与更正

- Handoff 在节点 active 期间可以在当前 Session 中形成草稿，但不持久化第二份
  `.handoff.json` 或其他可编辑真相源；
- Plan 完成和 Roadmap Checkpoint 提交前，运行时验证所有来源存在且在权限范围内；
- Lesson 普通关闭验证并保留合法 Claim；不合法 Claim 被拒绝进入证据树，但不阻止
  学生结束课堂；
- 封存后 Handoff 只读；
- 上层使用下层 Claim 时重新检查叶子来源是否仍为 active；
- 底层 Trace 后来被 supersede 时，证据树把相关上层来源投影为失效；
- 不自动级联改写所有历史 Handoff；
- 长期记忆提交不得使用已失效来源。

这样完成“更正闭包”：依赖结论会被确定地标记为不可继续使用，但历史文本仍保留当时
的真实判断。

## 十三、长期记忆晋升

长期记忆只有一条晋升路径：

```text
Lesson 观察
→ Trace / Lesson Handoff
→ Plan 内多课验证
→ Plan Handoff
→ 候选长期记忆
→ 学生逐条确认、改写或删除
→ 运行时事务写入根级 profile
```

约束为：

- Agent 只能提出候选，不能直接编辑确认画像；
- 学生可以接受、重写或删除每一项；
- `memory_review_apply` 属于受信任运行时，不向模型暴露自由路径和内容写入；
- 确认条目继续保留 `Content`、`Scope`、`Sources`、`Rationale` 和
  `Counter-evidence`；
- Learner Claim 可以支持 student-profile 候选，但普通能力结论继续留在 Handoff、
  Roadmap 和能力投影，不自动变成偏好画像；
- Teaching Claim 可以支持 teaching-profile 候选，但一次有效介入不会自动变成稳定
  教学偏好；
- 单个 Lesson Claim 不直接成为长期模式；
- Roadmap Handoff 可以在跨 Plan 复诊时进一步收窄或解释已有记忆，但不静默覆盖。

## 十四、文件可见范围

### 14.1 公共资产与学生事实分开授权

公共资产可以全学习集搜索：

- cards；
- graph；
- materials；
- LEARNING_GUIDE。

学生学习事实沿管理树授权：

- Roadmap、Plan、Lesson；
- Handoff；
- profile；
- Session；
- 节点局部工作记忆。

### 14.2 Roadmap Agent

直接可见：

- `ROADMAP.md`；
- `LEARNING_GUIDE.md`；
- 根级确认 profiles；
- Plan Handoff；
- Roadmap Handoff Checkpoints。

按需查询：

- Plan 摘要；
- 全局 Trace 聚合；
- 方法图谱索引；
- 题卡元数据。

默认不装入完整题解或 Lesson 原始 Session。

### 14.3 Plan Agent

直接可见：

- 当前 Plan；
- Roadmap → Plan 出生快照；
- 相关 profile 条目；
- 同 Plan 的 sealed Lesson Handoff；
- 本 Plan 自己拥有的 prepared Lesson。

按需查询：

- 题卡、材料、方法图谱；
- 全局 Trace Pool；
- Handoff 和原始来源句柄。

### 14.4 Lesson Agent

直接可见：

- 当前 Lesson；
- Plan → Lesson 出生快照；
- 当前 Tutor Session；
- 已绑定或已揭示素材；
- 当前卡的完整 active Trace 历史。

Lesson 不遍历其他 Plan、兄弟 Lesson、根级 profile 文件或父 Session。

### 14.5 Allowlist 与来源句柄

StudyForge Session 不再获得不受约束的学习集级 `read / grep / find / ls`：

1. Runtime 根据节点身份建立初始文件 Allowlist；
2. 搜索工具返回真实来源句柄；
3. `source_resolve` 只解析 Allowlist 或真实搜索结果中的句柄；
4. 任意磁盘路径不能被模型伪装成来源；
5. 公共资产搜索不等于获得其他学生学习分支的文件权限。

实现可以使用受限工具包装器或 Runtime 文件策略，但不得只靠 Prompt 声明边界。

## 十五、工具权限

以下名称表示内部 Pi Runtime 的逻辑能力。实现时可以复用现有工具，但权限语义必须
一致。公共 Claude MCP 仍只保留：

- `card_search`
- `trace_search`
- `trace_append`
- `source_resolve`

### 15.1 Roadmap

```text
read-only
├── card_search
├── trace_search
└── source_resolve

write
├── roadmap_update
└── plan_prepare
```

Roadmap Handoff Checkpoint 由 `roadmap_update` 的受限决定分支写入并封存，不额外增加
一个通用 Handoff 编辑工具。

### 15.2 Plan

```text
read-only
├── card_search
├── trace_search
└── source_resolve

write
├── plan_update
├── lesson_prepare
└── memory_review_propose
```

Plan 完成时，`plan_update` 同时接收并封存符合契约的 Plan Handoff。模型不直接调用
长期画像写入。

### 15.3 Lesson

```text
read-only
├── card_search
├── trace_search
└── source_resolve

write
├── classroom_update
├── trace_append
├── card_alternative_append
└── lesson_close
```

`lesson_close` 同时接收学生安全总结和可选 Handoff Claim 内容。Runtime 封存合法
Claim 并关闭 Lesson；学生明确结束时，Claim 校验失败不会阻止关闭，Runtime 改为
封存 source-only Handoff，并在回执中明确没有可用 Claim。

`classroom_update` 的决定联合允许 Tutor：

- 推进现有 Block 状态；
- 跳过、重排或重复 pending Block；
- 在当前 Lesson 目标内物化新的 pending dialogue、material 或 problem Block。

新增 problem Block 必须选择 `card_search` 返回的真实题卡句柄，Runtime 生成绑定和
初始状态。active / completed Block 不能被改造成另一道任务。

`card_alternative_append` 仍是带 Lesson 来源的追加式内容发现，不修改原题卡事实。

### 15.4 Runtime / UI

Runtime 独占：

- `node_activate`；
- `memory_review_apply`；
- Session Owner 写入与核验；
- Handoff 运行时字段绑定；
- 文件 Allowlist；
- 路由和状态投影刷新。

激活由学生点击触发，Agent 只能准备子节点，不能自行取得或转移控制权。

### 15.5 绑定原则

- Runtime 绑定学习集、节点、父节点、Session、ownerPath、时间和来源；
- 模型只提交无法推导的教学判断和短别名；
- 工具 schema 描述字段、枚举、原子性和成功回执；
- Agent Prompt 不复制工具参数说明；
- 没有成功回执就不能声称持久化完成。

## 十六、Agent Prompt 编译

每个 Active Node Session 由五层材料编译：

```text
Teaching Core
+ Node Role Prompt
+ Dynamic Node Frame
+ On-demand Skills
+ Presentation Persona
= Active Node Session
```

### 16.1 Teaching Core

所有节点共享现有五判断：

1. 目标：现在要改变什么数学理解；
2. 起点：学生当前怎样看问题；
3. 任务：什么经历能产生这个变化；
4. 介入：怎样推进而不替代学生思考；
5. 证据：什么新的独立表现说明学习发生。

### 16.2 Roadmap Role Prompt

稳定职责：

- 理解长期方向；
- 综合 Plan Handoff 和确认长期记忆；
- 与学生一次一问地商议新周期；
- 管理未激活 Plan 候选；
- 生成 Roadmap → Plan Adaptation Brief；
- 写 Roadmap Handoff Checkpoint。

停止边界：

- 不准备 Lesson；
- 不进入 Tutor 教学；
- 不改写 active 或 terminal Plan；
- 不把局部单课表现升级成长期结论。

### 16.3 Plan Role Prompt

稳定职责：

- 解决一个阶段性学习问题；
- 综合 Lesson Handoff 和 Plan 范围 Trace；
- 每次备课前询问真正会改变选材或节奏的问题；
- 管理未激活 Lesson 候选；
- 生成 Plan → Lesson Adaptation Brief；
- 完成 Plan Handoff 和记忆候选。

停止边界：

- 不替代 Tutor 上课；
- 不写活动 Lesson；
- 不修改 Roadmap；
- 不直接写确认长期画像。

### 16.4 Lesson Role Prompt

稳定职责：

- 只负责当前 Lesson 和当前 active Block；
- 沿学生真实思路执行“听懂—判断—介入—再观察”；
- 保留学生已经正确的部分；
- 在帮助前保留学生独立尝试；
- 准确记录支持条件、另解和更正；
- 管理 pending Block 的跳过、重排、加深和备用路线；
- 结束时生成 Lesson Handoff。

停止边界：

- 不改 Plan、Roadmap 或长期画像；
- 不把 Teacher Control、答案或内部工具旁白展示给学生；
- 学生结束后不继续开启新教学动作。

### 16.5 Dynamic Node Frame

Runtime 注入：

- 当前 Node ID、类型、状态和 owner；
- Frozen Snapshot；
- 当前文件 Allowlist；
- 可用工具集合；
- 选入的长期记忆和来源句柄；
- 当前候选树或 Block 状态；
- Handoff 契约位置。

### 16.6 Skill 与 Tool Schema 的边界

- Agent Prompt 写 Why、责任和停止边界；
- Skill 写问诊、备课、课堂模板、提示、复盘和深度检索 Workflow；
- Tool Schema 写具体参数、运行时绑定与成功回执；
- 人设只影响表达，不改变事实、权限、评价和 Trace。

不把这三层复制进一篇不断膨胀的系统 Prompt。

## 十七、Lesson 内部的 Block 子树

ActivityBlock 继续是 Lesson 内部执行节点，但不拥有独立 Agent Session。

### 17.1 控制权

- Plan Coach 在 prepared Lesson 中设计初始 Block 拓扑；
- Lesson 激活后，Tutor 取得整个 Lesson 及其 pending Block 的编排权；
- Tutor 可以跳过、重排、重复、加深或启用备用 Block；
- 同时最多一个 active Block；
- 已产生 Trace 的 active / completed Block 不被回写成另一个任务；
- 每次独立评价仍绑定一个 problem Block 和一张真实题卡。

### 17.2 教学灵活性

节点冻结不等于把课堂写死：

- 冻结的是 Lesson 目标、出生上下文和学生首次可见边界；
- Tutor 可以根据现场思路改变 pending Block 路线；
- 新增问题型 Block 必须绑定真实题卡；
- 对话、材料或反思 Block 可以在 Lesson 目标范围内灵活调整；
- 若需要改变整个 Lesson 目标，应结束或暂停本节点，回到 Plan 重新准备兄弟节点。

## 十八、教学质量补充

### 18.1 保留已有教学资产

本设计不重写，必须继续保留：

- 共享高中数学 Teaching Core；
- 洞见式、一次一问的 Roadmap / Plan 问诊；
- 六类轻量课堂模板；
- 多题角色与真实卡检索；
- Student View / Teacher Control；
- `zero / ladder / worked-example` 揭示策略；
- Tutor 的“听懂—判断—介入—再观察”循环；
- 正确路线优先、另解确认和提示依赖记录。

### 18.2 从记忆到教学动作

Activation Adaptation Brief 是新架构最重要的教学质量要求。父 Coach 必须说明历史
材料具体改变了：

- 当前节点的主要认知目标；
- 任务或题目角色；
- 活动顺序；
- 提示和等待方式；
- 独立证据机会。

不用运行时判断这些内容是否“足够优秀”，但真实模型验收必须检查它们是否真正发生。

### 18.3 Handoff 的双线发现

每层 Handoff 同时允许：

- Learner Claims：学生理解、能力、困难及边界；
- Teaching Claims：什么介入、表征、节奏或互动对该学生有效及边界。

两条线都必须有来源和可推翻边界，不能从一次课堂直接生成永久偏好。

### 18.4 教学与验收分离

若 Tutor 在某题给出决定性帮助：

- Trace 如实记录 `support: tutor`；
- 该题可以说明教学后的表现，不能冒充独立掌握；
- 若 Plan 仍需验证独立能力，后续使用另一道未见题或新的独立 Block；
- Handoff 的 Boundary 明确帮助条件。

### 18.5 避免只对最近一次表现反应

父 Coach 选择分支时同时查看：

- 当前学生解释；
- 最近子节点 Handoff；
- 同层其他支持与反证；
- 根级确认记忆；
- 仍缺少的迁移或保持证据。

Candidate 的 `Consider when` 是可修订教学预案，不是自动触发条件。

### 18.6 不新增教学质量伪精确

不持久化：

- “教学质量分数”；
- 固定学习风格；
- 由一次表现推导的 mastery；
- 强制题量；
- 固定提示次数；
- 每种分支的封闭类型。

这些判断继续由教学 Frame、Skill、学生互动和真实 Handoff 负责。

## 十九、学生可见投影

学生看到公开学习树：

- 节点名称或安全公共名称；
- 公开学习目的；
- candidate / prepared / active / completed 等状态；
- 当前进度；
- 可由学生选择的 Plan 或课程入口。

Coach 私下看到：

- Candidate `Consider when`；
- Adaptation Brief；
- Handoff 证据树；
- 题卡和方法选择理由；
- Teacher Control；
- 长期记忆候选和反证。

Assessment 或 diagnostic 节点继续遵守防剧透投影。其他课型可以按现有揭示策略展示
题号、公开能力目标或活动结构，但不展示答案、关键变形或私有判断。

前端树、进度、能力节点和 Handoff 展开视图均为可重建投影，不成为第二学习事实源。

## 二十、最小失败处理

只处理会破坏学习事实的四类失败。

### 20.1 激活失败

- 不创建半激活节点；
- 子节点保持 prepared；
- 父节点仍拥有编辑权；
- 不创建错误路由或重复 Session Owner。

### 20.2 Handoff 无效

- Plan 或 Roadmap Claim 的来源不存在、越界或不可解析时不能封存；
- 对应 Plan 决定或 Roadmap Checkpoint 不提交，Agent 修正后重试；
- Lesson 的不合法 Claim 不进入证据树，但学生明确结束时仍关闭课堂并封存
  source-only Handoff；
- 不允许父节点用未封存、无来源或 source-only Handoff 冒充下层结论；
- 父节点仍可自行读取 source-only Handoff 的原始来源，并形成自己负责的新 Claim。

### 20.3 工具调用失败

- 没有成功回执就不声称写入；
- Agent 先重新读取当前节点事实；
- 不使用通用自动重试框架；
- 由具体工具错误决定是否修正参数或回到父节点。

### 20.4 叶子来源被更正

- Trace supersede 立即改变 active Trace 投影；
- 依赖该 Trace 的 Handoff Claim 被标记为来源失效；
- 不自动改写历史 Handoff 文本；
- 上层下一次使用该 Claim 时必须重新判断；
- 无效来源不能进入新的长期记忆提交。

## 二十一、完整运行示例

### 21.1 Roadmap 编排 Plan

```text
Roadmap active
├── Plan Candidate A：参数分离
├── Plan Candidate B：路线选择
└── Plan Candidate C：综合迁移
```

Roadmap Coach 根据 Plan Handoff 和学生当前需求，把 B 物化为 prepared Plan。
学生确认后，Runtime 冻结 Roadmap → Plan Adaptation Brief 并激活 Plan B。

### 21.2 Plan 编排 Lesson

```text
Plan B active
├── Lesson 001 closed
├── Lesson 002 active
├── Candidate A：符号判断补强
├── Candidate B：同构迁移
└── Candidate C：多路线选路
```

Lesson 002 结束后：

1. Tutor 写入全局 Trace；
2. `lesson_close` 封存 Learner Claim 和 Teaching Claim；
3. 学生返回原 Plan Session；
4. Plan Coach 读取 Handoff 与相关 Trace；
5. 若基础判断稳定但路线选择仍犹豫，Coach 物化 Candidate C；
6. Plan → Lesson Adaptation Brief 明确说明这一选择如何改变题目角色和课堂介入。

### 21.3 形成长期记忆

Plan 内多节课都显示：

- 学生会识别多种路线；
- 先比较计算成本比直接提示方法名更能促成独立选择；
- 这一效果在两个题型成立，在陌生综合题中尚未验证。

Plan Handoff 分别形成 Learner Claim 与 Teaching Claim。Coach 提出两条长期记忆候选，
学生逐条确认或改写后，Runtime 将其写入 student-profile 与 teaching-profile。

Roadmap 后续创建新 Plan 时，可以引用这些确认记忆，但仍需根据学生当前解释形成新的
Adaptation Brief，而不是机械复用旧结论。

## 二十二、验证方案

### 22.1 生命周期与权责

- Candidate 没有文件和 Session；
- prepared 子节点可由父节点原地重备；
- active 后父写工具拒绝；
- terminal 后所有 Agent 只读；
- 学生明确结束 Lesson 时，即使 Tutor Handoff Claim 无效也能立即关闭；
- 多个 Plan 可并行；
- 每个 Plan 最多一个 active / paused Lesson；
- Lesson 最多一个 active Block。

### 22.2 上下文隔离

- 子节点的 Frozen Snapshot 与激活时父输出完全一致；
- 子节点看不到父原始 Session；
- 子节点看不到兄弟学习文件；
- 允许来源可以通过句柄回读；
- 未授权任意路径不可解析。

### 22.3 工具权限

- `ownerPath`、父节点、时间和 Session 由 Runtime 绑定；
- Roadmap、Plan、Lesson 只获得本节点工具集合；
- 模型无法调用 `node_activate` 或 `memory_review_apply`；
- 越权写入在运行时被拒绝；
- 公共 Claude MCP 仍保持四个工具。

### 22.4 Handoff 证据树

- Lesson Claim 可以解析到真实 Trace、Session 消息和题卡；
- Plan Claim 可以解析到 Lesson Claim；
- Roadmap Claim 可以解析到 Plan Claim；
- 不存在或越界来源阻止 Plan Handoff 和 Roadmap Checkpoint 封存；
- 学生结束 Lesson 时，无效 Claim 被丢弃为 source-only Handoff，但课堂仍关闭；
- superseded Trace 使依赖来源投影为失效；
- 无效来源不能进入长期记忆。

### 22.5 长期记忆

- Lesson 观察不会直接写入 profile；
- Plan 只能提出候选；
- 未确认候选不能落盘；
- 学生接受、改写和删除均按项生效；
- Runtime 原子写入两份 profile；
- 条目保留 Scope、Sources、Rationale 和 Counter-evidence。

### 22.6 对照式教学 Smoke

保持学习集资产、能力目标和可用题卡相同，只改变学生上下文：

#### 学生 A

- 能完成标准方法；
- 多次在两条路线都可行时犹豫；
- 比较路线成本后表现改善。

#### 学生 B

- 路线选择迅速；
- 经常在定义域或取等条件上遗漏；
- 把条件核验提前后表现改善。

验收要求：

- 两个 Plan / Lesson 的 Adaptation Brief 引用不同真实来源；
- 主要目标、题目角色、活动顺序或介入方式出现有意义差异；
- 差异能够沿 Handoff 证据树解释；
- 不是只在开场复述不同画像，随后生成相同课堂。

### 22.7 Tutor 真实情境

至少覆盖：

- 完全答错；
- 部分正确；
- 只写半句；
- 卡住并请求提示；
- 提示后完成；
- 提出与题卡不同的正确路线；
- 反驳 Tutor 的错误判断；
- 疲劳或主动提前结束。

检查 Tutor 是否：

- 保留正确部分；
- 每轮只推进一个主要教学动作；
- 真实记录支持条件；
- 不把 Tutor 的贡献归入学生独立能力；
- 正确生成 Learner / Teaching Handoff；
- 将结束主动权交还学生。

教学 Prompt 与 Skill 使用真实模型行为验收，不使用脆弱字符串断言。

## 二十三、实现边界

实施时按以下依赖顺序展开，但具体任务拆分留给后续实施计划：

1. Node Candidate、父子关系和共享生命周期读取契约；
2. Runtime 原子激活与 Session Owner；
3. Frozen Snapshot 和 Adaptation Brief；
4. 三层 Handoff 契约、封存和证据解析；
5. 全局 Trace Pool 与节点查询投影；
6. 文件 Allowlist 和节点工具集合；
7. Prompt Compiler 与三份 Node Role Prompt；
8. 前端公开树、私有树和证据下钻；
9. 教学质量对照 Smoke 与完整周期验收。

不保留旧版 Plan / Lesson 的运行时兼容分支。导数示范学习集将在实现后按新契约重建，
旧文件可以留在 Git 历史或单独备份，不进入新运行时判断。

## 二十四、完成标准

以下条件同时满足时，本设计实现完成：

- Roadmap、Plan、Lesson 显示为真实管理权树，而非线性列表换皮；
- 远期候选轻量，近期节点可完整准备；
- 激活后控制权原子转移，父节点不能修改 active 子节点；
- 每个 active 节点拥有独立 Session、Prompt、Context Frame、Allowlist 和工具集合；
- 全局 Trace Pool 可以按 card、Lesson、Plan 和时间反查；
- 三层 Handoff 能从 Roadmap Claim 一路回溯到原始课堂事实；
- 长期记忆只能通过 Plan 复盘、学生确认和 Runtime 提交产生；
- Activation Adaptation Brief 能证明关键记忆实际改变了教学设计；
- Tutor 保留积木式 Block 调整和自然多轮教学能力；
- Handoff、Reflection 或工具格式错误不会夺走学生结束 Lesson 的主动权；
- 学生看到安全、可理解的学习树和证据说明；
- 对照式真实模型验收显示不同学生上下文产生有意义的教学差异；
- 没有新增数据库、通用规则引擎、后台调度器或公共 MCP 工具。
