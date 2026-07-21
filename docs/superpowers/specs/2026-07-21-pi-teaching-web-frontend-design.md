# Pi 教学 Web 前端设计

状态：完整设计已确认，等待书面复核

日期：2026-07-21；2026-07-22 加入深度模式设计

面向读者的中文说明：[Pi 教学前端：中文设计说明](../../zh-CN/Pi教学前端设计说明.md)

## 一、设计结论

Highschool Study 增加一个由 Pi 启动的本地 Web 前端。前端不是通用 Markdown 编辑器，也不是 Pi 终端的浏览器镜像；它把 `Roadmap → Plan → Lesson → ActivityBlock`、Coach/Tutor 会话和课堂事实投影成专门的学习界面。

前端直接使用 Pi 的 `AgentSession` SDK。首版只支持 Pi，不提前抽象 Claude Code 或 OpenCode 运行时。现有 Markdown learning set 继续作为唯一学习状态来源，题卡和教学图谱继续使用已有格式。`card_search`、`trace_search`、`trace_append` 和 `source_resolve` 四个工具契约保持不变；在 Pi 中由 extension 注册为原生工具，并与 Claude Code MCP 适配器共用同一套领域实现。

本设计只保留两个 Agent：

- Coach Agent：每个 Plan 一个持久 Session，负责方向讨论、课后复盘、进度解释和备课；备课是 Coach 按需加载的 Skill，不再单设 Designer Agent 或 Designer Session。
- Tutor Agent：每个正式开始的 Lesson 一个持久 Session，只负责当前 Lesson 的多轮教学、课堂节点推进和 Trace 记录；尚未开始的 Lesson 先作为侧边栏子节点存在。

Coach 与 Tutor 都可以在各自 Session 内开启“深度模式”。深度模式不是第三个用户可见 Agent，而是父 Agent 按需加载的动态工作流 Skill：它生成结构化任务图，由 `pi-subagents` 创建临时、隔离、默认只读的子 Session 并行执行。子 Session 不出现在 Plan 侧边栏、不拥有长期记忆，也不能直接写入学习集；Coach 或 Tutor 始终负责最终判断和正式写入。

每个 Plan 在界面中表现为一个会话工作区：Coach Session 是根会话，Plan 的 `Lesson Index` 中每个 Lesson 是一个可进入的 Tutor 子会话。学生在同一个聊天外壳的侧边栏点击 Coach 或 Lesson 即可切换；结束 Lesson 后默认回到 Coach，也可以随时主动返回。这里的“父子”只表示 Plan 归属和导航关系，不表示上下文继承。Coach/Tutor 不复制彼此的聊天记录，只通过 learning set 文件和带来源的摘要交接。

## 二、目标与非目标

### 2.1 首版目标

- 从当前 learning set 展示学习集概述、Roadmap、Plan 和继续学习入口。
- 在一个 Plan 会话工作区中完成 Coach 讨论、备课、无剧透预览、Lesson 子会话上课和课后复盘。
- 从 Plan 侧边栏查看全部 Lesson，并在 Coach 根会话与各 Tutor 子会话之间切换。
- 支持开课前原地修改 Lesson；Lesson 一旦开始，重新备课必须创建新的 Lesson 子会话并保留旧记录。
- 使用结构化组件呈现题目、材料、视频、阶段、输入请求、工具状态和课堂节点，避免页面退化成消息瀑布。
- 使用 `lessons/<lesson-id>.md` 同时保存课前课堂结构和课中实际节点状态。
- 支持文本、LaTeX、粘贴或上传手写解题图片。
- 默认只向学生返回 Student View；完整备课内容只在开发者启动模式中可见。
- 断开或刷新后，可以使用 Pi Session 和 Markdown 文件恢复当前学习位置。
- 用实时能力星图、动态课堂路线、课后回放和证据透镜呈现“为什么这样教、能力为什么变化”。
- 允许 Coach 和 Tutor 以 Session 级深度模式执行多视角检索、分析和对抗检查，并在前端显示结构化工作流进度。
- 允许人设驱动视觉皮肤和轻量阶段动画，但不让展示层改变教学事实。

### 2.2 首版非目标

- 云端账号、同步、班级和多学生管理；
- 人类教师协作与权限后台；
- 数据库或第二套事件存储；
- 移动端原生应用；
- Obsidian 编辑器集成；
- Claude Code、OpenCode 等多运行时适配；
- 永久专家 Agent、专家长期记忆或自主写入学习状态的 Agent 团队；
- 模型临时编写并执行任意 JavaScript 工作流；
- 对拥有本机文件系统访问权的攻击者隐藏答案。

首版的 Student/Teacher 隔离用于防止课堂界面意外剧透，而不是建立操作系统级安全边界。

## 三、总体架构

```mermaid
flowchart LR
    Browser["本地 Web 前端"] <-->|"HTTP + WebSocket"| Server["Study Web 本地服务"]
    Server --> Projector["Study Event Projector"]
    Server --> Workspace["Plan Session Workspace"]
    Workspace --> Coach["Coach 根 AgentSession\n每个 Plan 一个"]
    Workspace --> Tutor["Tutor 子 AgentSession\n每个 Lesson 一个"]
    Coach --> Skills["召回、备课、复盘 Skills"]
    Tutor --> Teaching["上课、关闭课程 Skills"]
    Coach --> Deep["深度模式 Skill\n结构化 Workflow Graph"]
    Tutor --> Deep
    Deep --> Subagents["pi-subagents\n临时只读子 Session"]
    Coach <--> Files["Markdown learning set"]
    Tutor <--> Files
    Coach <--> Tools["题卡 / Trace 原生工具"]
    Tutor <--> Tools
    Files --> Projector
    Tools --> Projector
    Coach --> Projector
    Tutor --> Projector
    Subagents --> Projector
    Projector --> Server
```

本地服务承担五项职责：

1. 从 Plan `Lesson Index` 建立 Coach 根节点和 Lesson 子节点，并创建、恢复、暂停或释放对应 `AgentSession`；
2. 维护当前选中的会话，把浏览器输入只发送给该 Session；
3. 把 Pi 事件、Lesson 变化和教学工具结果确定性映射为 `StudyViewEvent`；
4. 把深度工作流的任务图和生命周期事件投影为可折叠任务轨道；
5. 为学生模式和开发者模式生成不同的数据投影。

它不拥有学习数据库，不复制 Roadmap、Plan、Lesson、Trace 或长期记忆。父子关系由 Plan、Lesson 和 runtime Session 绑定推导，不新增会话树数据库，也不向 Pi transcript 写入另一 Session 的历史。

## 四、Agent 与 Session 生命周期

### 4.1 Coach Agent

Coach 是学生的学习管理入口，职责包括：

- 读取 Roadmap、当前 Plan、相关 Lesson 摘要和两份已确认画像；
- 与学生讨论下一课方向和课后建议；
- 在学生确认方向后加载备课 Skill；
- 搜索真实题卡、读取绑定 Trace，并写出下一份 Lesson；
- 在 Plan 完成后运行长期记忆聚合和学生确认流程。

Coach Session 以 Plan 为生命周期，也是该 Plan 会话工作区的根节点。Plan frontmatter 可以保存可选的 `coach_session`；Lesson frontmatter 可以保存可选的 `tutor_session`。这两个字段属于 runtime authority，只能由本地服务绑定真实 Pi Session ID，模型不得填写或猜测。标识缺失或失效时，新建对应 Session 并从 Markdown 恢复，不把 Session 当成学习事实。

Plan 的 `Lesson Index` 决定侧边栏 Lesson 子节点的成员和顺序；目标 Lesson frontmatter 的 `status` 决定状态显示，索引行中的说明文字不作为第二份状态。Lesson 的 `plan_id` 用于反向校验归属。服务不持久化额外的 `parent_session_id`。Coach 可以在任何未关闭的 Plan 中继续备课，并向索引追加新的 Lesson。

### 4.2 备课是 Coach Skill

备课不再拥有独立 Agent 或 Session。Coach 在当前 Plan Session 中按需加载备课 Skill：

1. 复盘上一课并与学生确认下一课方向；
2. 读取备课所需的记忆、题卡、Trace、图谱和材料；
3. 新建或修改尚未开课、带 ActivityBlock 的 `lesson-xxx.md`；
4. 向学生只展示无剧透的课堂结构与安排理由；
5. 等待学生主动开始课程。

Coach 可以看到备课答案和 Teacher Control，但它不承担课堂教学。前端不向学生显示备课工具的原始结果。

### 4.3 Tutor Agent

Tutor Session 与一个 Lesson 一一绑定，并作为所属 Plan 下的逻辑子会话。Tutor 不继承 Coach transcript。待开始 Lesson 的侧边栏节点可以先于 Session 存在；学生首次点击“开始上课”时，服务才创建并绑定 Tutor Session。它：

- 读取当前 Lesson、两份确认画像和直接来源；
- 一次只呈现当前 ActivityBlock 的 Student View；
- 根据 Teacher Control 执行提示、评价和分支，但不向学生转述这些内容；
- 在证据活动后追加 Trace，并更新 Lesson 节点状态；
- 在学生请求暂停或结束时立即执行相应流程；
- 学生确认结束后写入 Reflection 与 Lesson Summary，并关闭 Session。

暂停的 Lesson 保留 Tutor Session。正常关闭的 Tutor runtime 可以释放；Pi Session 文件仍可用于审计和恢复。`closed` 或 `abandoned` Lesson 的侧边栏节点只用于查看与回放，不再接收新的课堂消息。

### 4.4 Plan 会话工作区与导航

一个 Plan 工作区固定包含一个 Coach 根节点，并按 `Lesson Index` 顺序展示全部 Lesson 子节点：

```text
定义域完整性 Plan
├── Coach
├── Lesson 001 · 已完成
├── Lesson 002 · 已暂停
├── Lesson 003 · 已中止
└── Lesson 004 · 待开始
```

- 点击 Coach：恢复原 Plan Coach Session；若当前 Tutor 正在课堂中，则在当前回复结束后把 Lesson 置为 `paused`，不关闭也不复制 transcript。
- 点击 `prepared` Lesson：展示无剧透摘要；学生明确开始后才创建或恢复 Tutor Session。
- 点击 `active` 或 `paused` Lesson：恢复对应 Tutor Session 和课堂节点。
- 点击 `closed` 或 `abandoned` Lesson：进入只读回放，不重新激活 Tutor。
- 同一时刻只有当前选中的 Coach 或 Tutor Session 接收学生输入；其他 Coach/Tutor Session 可以持久存在，但不会后台继续生成。已经由学生确认启动的深度工作流可以在所属父 Session 下继续，切回该 Session 时恢复任务轨道。

前端在 Lesson 正常关闭后默认把焦点返回 Coach。除此之外，导航权始终在学生手里，而不是由模型决定切换哪个 Agent。

### 4.5 重新备课

重新备课仍由原 Coach Session 加载同一备课 Skill，不创建 Designer Session，也不更换 Coach：

1. Lesson 仍为 `prepared`，且 Tutor 尚未正式开始时，Coach 可以原地修改同一 `lesson-xxx.md`；侧边栏条目和 Lesson ID 不变。
2. 一旦学生正式开始 Tutor Session，课前方案、课堂消息、节点状态和 Trace 就形成同一份历史。此后不得用新教案覆盖该 Lesson。
3. 学生返回 Coach 请求重新备课时，原 Lesson 标记为 `abandoned`，停止接受新的课堂写入；已有 Session、作答、节点和 Trace 全部保留。
4. Coach 使用新的 Lesson ID 写出重备版本，并把它追加到当前 Plan 的 `Lesson Index`。新条目处于 `prepared`，首次进入时创建新的 Tutor Session。
5. 新 Lesson 的安全说明以普通 Markdown 链接指出它接替哪一课及重备原因；首版不增加版本表或 `parent_lesson_id` 数据模型。

“正式开始”的边界是服务接受学生的“开始上课”命令，并在调用 Tutor 前把状态从 `prepared` 改为 `active`。只打开无剧透预览不锁定 Lesson，仍可原地修改。

### 4.6 Session 交接

```mermaid
sequenceDiagram
    participant Student as 学生
    participant Coach as Coach Session
    participant Lesson as lesson-xxx.md
    participant Tutor as Tutor Session

    Student->>Coach: 确认下一课方向
    Coach->>Coach: 加载备课 Skill
    Coach->>Lesson: 写入课堂节点与安全摘要
    Coach-->>Student: 展示无剧透备课摘要
    Student->>Tutor: 从侧边栏点击 Lesson 并开始上课
    Tutor->>Lesson: 按节点教学并追加 Trace
    Student->>Tutor: 确认结束课程
    Tutor->>Lesson: 写入课后摘要并关闭
    Tutor-->>Coach: 仅通知 Lesson 路径与关闭状态
    Coach->>Lesson: 读取课后摘要
    Coach-->>Student: 继续复盘
```

Tutor 不接收 Coach transcript；Coach 恢复时也不接收 Tutor transcript。交接消息只包含真实 Lesson 路径、状态和“请读取相应摘要”的指令。侧边栏可以把这些 Session 排在同一棵树里，但这只是 UI 投影，不会把消息数组合并后发给模型。

### 4.7 深度模式的 Session 边界

深度模式是当前 Coach 或 Tutor Session 的本地开关。开启后，父 Agent 仍先判断现有信息是否已经足够；只有多视角结果可能改变下一步教学决策时，才创建工作流。临时子 Session：

- 只属于触发它的父 Session，不成为 Plan 会话树节点；
- 不继承完整父 transcript，只接收本任务的目标、来源句柄、允许读取范围、输出格式和预算；
- 默认只读，不能调用 `trace_append`、`classroom_update` 或直接修改 Markdown；
- 将结构化结果和原始 JSON 返回父 Agent，由父 Agent 选择是否采纳；
- 生命周期与父 Session 绑定，但不参与 Coach/Tutor 长期记忆聚合。

Coach/Tutor transcript 不复制给临时子 Session，临时子 Session 的 transcript 也不回填父 transcript。父 Agent 只接收最终综合、关键来源和可回读的 `workflow_id`，避免一次并行分析永久撑大上下文。

## 五、Pi 的记忆承载方式

### 5.1 结论

Pi 可以承载本项目需要的记忆功能，但它与 Claude Code 的自动加载语义并不完全相同。项目不模拟一套 Claude Code memory；它使用 Pi 的原生资源加载能力，把不同记忆放在正确的层次：

- `AGENTS.md` / `CLAUDE.md`：稳定的项目指令与学习集入口；
- Pi Skills：按需加载的召回、备课、上课、复盘和长期记忆工作流；
- Pi Session JSONL 与 compaction：Coach/Tutor 各自的短期会话连续性；
- Roadmap、Plan、Lesson、画像、题卡和 Trace 文件：可跨 Session、可校正、可回溯的长期学习记忆；
- `DefaultResourceLoader`：为 Coach 和 Tutor 选择不同的角色指令、Skill 集、人设和本地配置。

Pi Session 和 compaction 摘要不是学习事实的 owner。即使 Session 文件丢失，Agent 也必须能够通过 learning set 恢复。

### 5.2 Context 文件与本地人设

两个 AgentSession 的 `cwd` 都设为 `learning-set/`。Pi 会沿父目录自动加载 `AGENTS.md` 或 `CLAUDE.md`；已在导数学习集上实测，它会同时加载：

```text
examples/derivative-demo/CLAUDE.md
examples/derivative-demo/learning-set/CLAUDE.md
```

Pi 不会自动加载 `CLAUDE.local.md`。本地服务通过 `DefaultResourceLoader.agentsFilesOverride` 显式追加：

- 当前 learning set 的可选 `CLAUDE.local.md`；
- 最终选中的一份人设文件；
- 一个很短的虚拟角色上下文，包含 Agent 角色、当前 Plan 或 Lesson ID 及其真实路径。

不把全部 Roadmap、画像、历史 Lesson 或题卡塞进系统提示词。它们由 Skill 在需要时读取。

### 5.3 Coach 与 Tutor 的不同资源视图

Coach ResourceLoader 提供：

- Coach 角色指令；
- 当前 Plan 定位；
- 负责读取学习集概述的进入 Skill，以及选中人设；
- Roadmap/Plan 召回、进度检查、备课、复盘、纠正记录和 Plan 记忆聚合 Skills；
- 深度模式 Skill 与 Coach 临时角色模板；
- 四个题卡/Trace/来源原生工具。

Tutor ResourceLoader 提供：

- Tutor 角色指令；
- 当前 Lesson 定位；
- 选中人设；
- 教学召回、上课、关闭课程和纠正课堂记录 Skills；
- 深度模式 Skill 与 Tutor 临时角色模板；
- 课堂所需的题卡/Trace/来源原生工具；
- 不提供备课 Skill，也不注入 `planner-attention.md`。

Pi 只把 Skill 的名称和描述常驻上下文；完整 `SKILL.md` 在匹配或显式调用时才读取。前端触发关键流程时使用明确的 Skill 命令，避免依赖模型猜测是否加载。

现有 Claude Code Skills 是工作流内容来源，不作为可直接加载的 Pi 包。Pi 版本保留 Agent Skills 标准的正文与引用结构，移除 Claude Code 专属的 Agent 调用和工具名；Coach/Tutor 的真实工具权限由 `createAgentSession()` 配置，而不是依赖 Skill frontmatter 形成安全边界。

### 5.4 学习记忆的召回位置

| 记忆 | 持久 owner | Coach | Tutor |
|---|---|---|---|
| 学习集概述与 Roadmap | `ROADMAP.md` | 进入 Plan 和解释进度时读取 | 不完整注入 |
| Plan 目标与前序摘要 | `plans/<plan-id>.md` | 完整读取当前 Plan，按链接上溯 | 仅通过当前 Lesson 获得必要目标 |
| Lesson 结构与课堂记录 | `lessons/<lesson-id>.md` | 备课或课后复盘读取 | 完整读取当前 Lesson |
| 学生与教学画像 | `memory/student-profile.md` 与 `memory/teaching-profile.md` | 召回时完整读取两份确认画像 | 开课时完整读取两份确认画像 |
| 备课注意事项 | `memory/planner-attention.md` | 只在备课时读取 | 永不读取 |
| 题卡与绑定 Trace | `cards/` 与 Lesson Trace | 备课工具按需搜索 | 当前活动按需读取 |
| Session 对话历史 | Pi Session JSONL | 当前 Plan 内连续 | 当前 Lesson 内连续 |

同一 Plan 的前序 Lesson 摘要和后续 Plan 所需的前序 Plan 摘要仍按原设计通过 Markdown 链接召回。Pi 的上下文压缩只维持当前 Session 可用，不替代 Plan 完成后的长期记忆确认流程。

### 5.5 四工具在 Pi 中的承载

Pi 核心没有内置 MCP 客户端，因此首版不增加 MCP transport extension。实现时把四个工具背后的纯领域操作提取为共享模块：

```text
card_search
trace_search
trace_append
source_resolve
```

- Claude Code 插件继续由 MCP server adapter 暴露这些操作；
- Pi package 由 extension 使用 `registerTool()` 暴露相同名称、参数、返回值和真实性边界；
- Web 前端只观察工具事件，不直接调用领域模块写学习事实。

这不是运行时抽象层；只是让两个薄适配器复用同一套文件操作，避免复制题卡与 Trace 规则。

Web runtime 另外给 Tutor 注册一个不对外发布的 `classroom_update` 工具，用于更新 Block 状态和追加 Route Changes。它属于课堂 UI 协调，不扩大四个题卡/Trace 领域工具的公共契约。

## 六、页面结构

首版只有三个页面。

### 6.1 学习集首页

展示：

- `ROADMAP.md` 中的学习集概述；
- 当前 Roadmap 的能力目标；
- Plan 列表、依赖和当前状态；
- 最近 Lesson 与唯一主要操作“继续学习”。
- 当前 Plan 的能力星图摘要；节点点击后可打开对应证据透镜。

应用从一个 learning set 目录启动，因此首版不建设多学习集书架或文件管理器。

### 6.2 Plan 会话页

Coach、备课进度和 Tutor 课堂使用同一页面外壳。左侧是当前 Plan 的会话树：Coach 固定为根节点，其下按 `Lesson Index` 展示每个 Lesson 的标题和 `待开始 / 进行中 / 已暂停 / 已完成 / 已中止` 状态。点击节点只改变当前路由和输入目标，不合并 Session 历史。

顶部状态显示：

- 规划中；
- 备课中；
- 等待开课；
- 上课中；
- 已暂停；
- 复盘中。

学生不需要理解 Agent 配置，但可以像切换章节一样选择 Coach 或 Lesson。页面保持统一的人设、视觉语言和输入框；输入框上方始终显示当前接收消息的节点，避免把复盘内容误发给 Tutor 或把课堂作答误发给 Coach。

主区域采用对话流。结构化题目和材料作为消息流中的专用组件呈现；课堂节点抽屉提供可跳转的结构化回看，防止长课变成无法导航的消息瀑布。节点抽屉同时显示当前有效路线；节点插入、跳过、重排或重复时以动画更新，并展示学生安全的变更理由。

深度模式运行时，主区域显示一个独立于聊天消息的可折叠任务轨道。它展示工作流目标、任务依赖、完成数量、当前运行节点、来源数量和取消操作；工作流结束后折叠成一行。原始子 Session 对话不进入消息流，也不因多个并行任务形成新的消息瀑布。

能力星图可以作为可折叠侧栏随课堂更新。它不占据作答主区域，也不在学生正在思考时弹出带答案倾向的诊断。

### 6.3 备课本

备课本直接读取当前 Lesson：

- 学生模式：课堂安排、节点标题、无剧透备课摘要、来源名称和完成状态；
- 开发者模式：额外显示 Teacher Control、题卡答案、提示阶梯、原始工具事件和来源解析信息。

已结束的 Lesson 在备课本中增加“课堂回放”标签；任一题卡、Trace、能力节点和路线变更都可以打开证据透镜。

默认服务以学生模式启动。使用显式 `--authoring` 启动同一应用时，服务才注册和返回开发者投影；学生模式不是用 CSS 隐藏敏感字段。

## 七、结构化事件投影

### 7.1 事件来源

界面消费四种已有事实：

1. Pi `AgentSessionEvent`：消息流、工具开始/结束、Extension UI 请求、Session 状态；
2. Lesson 快照与文件变化：当前 ActivityBlock、节点状态、Lesson 状态和证据链接；
3. 教学工具结果：真实题卡、Trace、来源和写入确认；
4. `pi-subagents` 生命周期记录：工作流、任务、依赖、状态和结构化最终输出。

`Study Event Projector` 使用事件名、工具名和 Lesson 字段做确定性映射。它不调用另一个 LLM 推断应该渲染什么。

### 7.2 最小 `StudyViewEvent` 类型

- `message`：Coach、Tutor 或学生的自然语言消息及流式增量；
- `phase`：规划、备课、课堂、暂停、关闭和复盘阶段；
- `activity`：当前 ActivityBlock 的安全内容与状态；
- `resource`：题目、图片、视频或其他材料；
- `input`：文本、数学、选择或图片输入请求；
- `work-status`：搜索题卡、写入 Trace、加载材料等可折叠状态；
- `notebook-node`：课堂节点被激活、完成、跳过或恢复；
- `route-change`：课堂路线的插入、跳过、重排或重复；
- `ability-update`：Trace 使一个或多个方法节点的掌握度投影发生变化；
- `workflow`：深度工作流被提出、确认、运行、取消、中断或完成；
- `workflow-task`：临时任务等待、运行、完成、失败或取消，以及安全的进度摘要和来源数量。

`StudyViewEvent` 本身只存在于内存和 WebSocket 流中，不持久化为新的教学日志。页面刷新时，普通课堂事件从 Pi Session JSONL、Lesson Markdown 和现有 Trace 重新投影；工作流事件从 `pi-subagents` 的 Session-owned lifecycle artifact 重新投影。

### 7.3 渲染规则

- 普通文本渲染为聊天气泡，数学公式由数学渲染器处理；
- `problem` ActivityBlock 渲染为题目卡和作答区；
- `material` ActivityBlock 渲染为图片、视频或文本材料卡；
- Extension 的选择、确认和输入请求渲染为原生交互组件；
- 工具调用默认折叠为人类可读状态，不显示完整参数或结果；
- thinking、题卡答案、rubric、Teacher Control 和未揭示提示不进入学生事件；
- Trace 写入成功只显示“已记录到当前课堂节点”，详细内容由证据视图按权限读取；
- `workflow-task` 只显示角色、任务、状态、来源数量和无剧透结果摘要；不显示思维链、未揭示答案或原始子 Session transcript；
- Tutor 深度工作流中可能泄露答案的节点结果，在 Tutor 完成最终综合前不发送到学生投影。

## 八、Lesson 节点格式

现有 Lesson Markdown 结构继续使用，只为每个 Block 增加一个最小状态区：

```markdown
## Block assessment-01

### Node State

- Kind: problem
- Required: true
- Status: active
- Depends on: orientation
- Uses: Q-DOMAIN-EX22

### Student View

请独立完成这道题，给出完整过程、理由和结论。

### Teacher Control

- Evidence target: 能否无提示写全定义域并实际使用
- Reveal: zero
- Card evidence: Q-DOMAIN-EX22 `step_2`、`step_5`

### Evidence

- [Trace event-007](#trace-event-007)
```

### 8.1 字段语义

- `Kind`：只决定呈现方式，首版闭集为 `dialogue | problem | material | reflection`；
- `Required`：是否属于本课必做节点；
- `Status`：首版闭集为 `pending | active | completed | skipped`；
- `Depends on`：前置 Block ID，可以为空；
- `Uses`：本 Lesson `Aliases` 中真实存在的题卡或材料别名，可以为空或包含多个；
- `Student View`：学生端唯一可以直接返回的 Block 正文；
- `Teacher Control`：教学目标、揭示策略、卡片步骤和提示，只供 Coach、Tutor 与开发者视图读取；
- `Evidence`：只保存 Trace 链接，不复制 Trace 的观察、评价或纵向结论。

Lesson 自身状态使用 `prepared | active | paused | closed | abandoned`。`abandoned` 表示该课堂在开始后被中止并由新 Lesson 接替；其历史与 Trace 保留，但不能继续写入。一个 Lesson 最多有一个 `active` Block；`closed` 或 `abandoned` Lesson 不得保留活动 Block。

进度百分比、时间线文案、节点摘要和当前导航都由上述事实投影，不写成另一套状态。

### 8.2 学生图片

学生粘贴或上传的图片保存到：

```text
materials/classroom/<lesson-id>/
```

前端把图片作为 Pi prompt 的 image content 发送；形成课堂证据时，Trace 使用相对路径链接图片并绑定当前 Lesson/Block。图片是原始课堂材料，不嵌入长期画像。

### 8.3 课堂路线变更

初始课堂路线由 Block 的文档顺序、`Required` 和 `Depends on` 决定。课堂中发生插入、跳过、重排或重复时，不覆盖初始意图，而是在 Lesson 末尾追加一条路线变更：

```markdown
## Route Changes

### Route change route-001

- Action: skip
- Block: foundation-explanation
- Reason: 你已经无提示完成诊断，因此直接进入迁移练习。
- Source: [Trace event-007](#trace-event-007)
```

- `Action` 的首版闭集为 `insert | skip | move | repeat`；
- `Block` 必须引用当前 Lesson 中真实存在的 Block ID；
- `insert` 或 `move` 可以增加 `Before` 或 `After`，目标也必须是真实 Block ID；
- `Reason` 是学生可见、无剧透的一句话；
- `Source` 必须指向触发该决策的 Trace 或课堂记录；
- `route-xxx` ID 和追加顺序由本地服务绑定，模型不得猜测已有 ID。

当前有效路线由“初始路线 + Route Changes”重放得到。后续更正使用新的路线变更抵消前一条，不重写历史。实时 `route-change` 只是这份记录的 Web 投影。

Tutor 通过 session-local `classroom_update` 提交动作、真实 Block 别名、学生安全理由和来源；本地服务绑定当前 Session、Lesson、route ID 与追加位置，并同时产生 `notebook-node` 或 `route-change` 投影。Tutor 不用自由编辑这些 runtime authority 字段。

## 九、Student View 与 Teacher Control 边界

学生投影可以包含：

- 学习集概述、Roadmap 和 Plan 的学生可读内容；
- Lesson 的 Student View 与无剧透备课摘要；
- 当前真实题卡的题干、选项和已获准揭示的提示；
- 学生自己的作答、课堂节点状态和可公开的 Trace 摘要；
- 视频、图片和其他已安排材料。

学生投影不得包含：

- Teacher Control 原文；
- 题卡答案、完整解法、rubric 或未揭示步骤；
- 备课搜索候选、废弃方案或完整工具结果；
- Pi thinking；
- 深度工作流中的原始子 Session 对话、未采纳结论或答案性中间结果；
- 未来 ActivityBlock 的教学路线或答案性提示。

这一边界由服务端 projection 函数实现。学生前端只接收安全 DTO，不接收完整 Lesson 或完整题卡后自行隐藏。

## 十、核心流程

### 10.1 打开学习集

1. Pi 包中的启动命令以当前目录寻找 `learning-set/`；
2. 本地服务验证必要目录和文件；
3. 浏览器打开当前学习集首页；
4. 服务从 Plan 的 Session 标识恢复 Coach，失败时新建并通过 Markdown 召回；
5. 服务读取 Plan `Lesson Index`，生成 Coach 根节点与 Lesson 子节点，并按最近活动位置选中一个节点。

### 10.2 备课和开课

1. 学生与 Coach 完成上一课复盘和下一课方向确认；
2. Coach 加载备课 Skill，并更新备课状态事件；
3. Coach 写出完整 Lesson；
4. Coach 把 Lesson 追加到当前 Plan 的 `Lesson Index`；服务解析 Lesson，仅向学生返回安全摘要和节点标题；
5. 侧边栏出现新的 `prepared` Lesson；学生点击并明确开始上课后，服务创建和绑定该 Lesson 的 Tutor Session；
6. Tutor 每次只推进一个 ActivityBlock。

### 10.3 暂停、恢复与关闭

- 返回 Coach：当前 Tutor 回合结束后把 Lesson 写为 `paused`，保留当前节点和 Tutor Session；
- 恢复：学生从侧边栏再次点击该 Lesson，先展示暂停点和剩余节点，明确选择后才继续；
- 关闭：必须由学生确认，Tutor 写入 Reflection、Lesson Summary 和最终节点状态；
- 关闭后返回：服务默认选中原 Coach Session，并要求它从 Lesson 摘要开始复盘；
- 查看历史：`closed` 和 `abandoned` 子节点进入只读回放，不重新启动 Tutor。

### 10.4 重新备课

1. 学生从当前 Lesson 返回所属 Plan 的 Coach 根会话；
2. 如果 Lesson 尚未开始，Coach 直接修改原文件，服务重新生成安全预览；
3. 如果 Lesson 已经开始，服务先把原 Lesson 写为 `abandoned` 并冻结其课堂写入；
4. Coach 加载备课 Skill，写出使用新 ID 的 Lesson，并在 `Lesson Index` 中追加新条目；
5. 旧条目继续提供回放，新条目等待学生点击开始，二者不复用 Tutor Session。

### 10.5 深度模式

1. 学生在当前 Coach 或 Tutor Session 开启深度模式；
2. 父 Agent 在每次任务前选择直接处理、快速会诊或深度工作流；
3. 快速会诊最多使用三个临时子 Session、单轮并行和固定小预算，可以直接开始；
4. 多于三个任务、包含多轮依赖或对抗验证的工作流，先展示任务图、Token 上限和时间上限，等待学生确认；
5. 深度模式 Skill 生成结构化 Workflow Graph，`pi-subagents` 执行并持续发送生命周期事件；
6. 父 Agent 读取结构化结果和原始 JSON，完成最终综合；
7. Coach 通过既有备课流程写 Lesson，Tutor 通过既有工具推进节点和写 Trace；临时子 Session 不直接写入；
8. 前端折叠已完成的任务轨道，后续需要细节时由父 Agent 使用 `workflow_id` 回读。

## 十一、技术组成

- Runtime：`@earendil-works/pi-coding-agent` 的 `AgentSession` SDK；
- 动态执行：[`pi-subagents`](https://github.com/nicobailon/pi-subagents)，负责临时子 Session、并发、取消、恢复和生命周期记录；
- 资源加载：每类 Agent 独立的 `DefaultResourceLoader`，负责 context files、Skills、人设和角色指令；
- 教学工具：Pi extension 原生工具，复用现有题卡与 Trace 领域模块；
- 课堂协调：仅 Tutor Session 可用的 `classroom_update`，负责节点状态和路线变更；
- 本地服务：TypeScript/Node.js；
- 前端：React Web 应用；
- 通信：HTTP 负责初始数据、上传和命令，WebSocket 负责事件流；
- 内容：Markdown 渲染与 LaTeX/KaTeX 数学渲染；
- 持久化：learning set 文件与 Pi 自身 Session JSONL；
- 分发：作为 Pi package 安装，由一个 extension command 启动服务和浏览器。

首版不引入通用状态同步框架、事件总线服务、ORM 或数据库。

## 十二、核心失败处理

只处理会阻止正常学习的七类失败：

1. **Pi 没有可用模型或凭据**：显示配置提示，不创建 Session；
2. **learning set 缺少必要文件**：列出真实缺失项，不猜测或自动生成学习事实；
3. **Lesson 节点无法解析**：停止开课并返回 Coach 修复；尚未开课时原地修复，已经开课时创建新 Lesson，不把完整文件降级展示给学生；
4. **模型或连接中断**：保留 Lesson、输入草稿和 Session，允许重连后继续；
5. **没有合适题卡或来源**：展示真实空结果，让 Coach 缩减、替换材料或重新讨论目标，绝不编卡；
6. **单个深度工作流分支失败**：输出格式无效也按节点失败处理；其余节点继续，父 Agent 可以使用已有结果综合并明确缺少的分析视角，不启动复杂自动修复循环；
7. **深度工作流被取消或中断**：停止未完成节点并保留已完成的运行记录，但不自动写入 Lesson、Trace 或长期记忆；中断后由学生选择恢复或重新运行。

备课未成功写出可解析 Lesson 时，不创建 Tutor Session。

## 十三、测试与验收

### 13.1 自动测试

- Lesson parser 能读取现有 Block，并正确解析 `Node State`；
- Student projection 永远不包含 Teacher Control、题卡答案、rubric、未揭示提示或 thinking；
- `AgentSessionEvent`、Lesson 变化和教学工具结果映射为预期 `StudyViewEvent`；
- Coach/Tutor 的 ResourceLoader 只加载各自允许的角色上下文、Skills 和记忆入口；
- `CLAUDE.local.md` 与选中人设按显式 override 注入，未选择的人设不进入上下文；
- Coach/Tutor Session 创建、暂停、恢复、关闭和 handoff 正确；
- Plan 会话树严格按 `Lesson Index` 投影，Coach 为唯一根节点，每个 Lesson 只绑定自己的 Tutor Session；
- 切换侧边栏节点后，学生输入只进入当前选中的 Session，Coach/Tutor transcript 不互相复制；
- `prepared` Lesson 重备时保留 ID 并原地更新；接受“开始上课”命令后重备则把旧 Lesson 标记为 `abandoned`、保留 Trace，并创建新 Lesson/Tutor Session；
- `closed` 与 `abandoned` 子节点只能回放，不能继续追加课堂消息或 Trace；
- 上传图片能保存到真实相对路径，并作为 Pi image content 发送；
- 刷新后可由 Session JSONL 与 Markdown 重建课堂界面；
- 题卡搜索空结果不会产生虚构题目或路径；
- 能力聚合对主方法赋予较高权重、对次方法赋予较低权重，并排除已撤回 Trace；
- Route Changes 能重建当前路线，每条变化都引用真实 Block 和来源；
- 课堂回放在 Session JSONL 存在时显示完整时间线，缺失时明确降级为证据回放；
- 证据透镜遇到断链时停止下钻，学生投影不会越权读取 Teacher Control；
- 人设主题变化不改变 Agent 工具、Lesson、Trace、能力聚合或学生评价；
- 深度模式关闭或父 Agent 判断信息充分时，不创建临时子 Session；
- 快速会诊不超过三个任务，深度工作流在启动前返回任务图、Token 上限和时间上限；
- 临时子 Session 只收到声明的最小上下文和读取权限，不能调用正式写入工具；
- 工作流生命周期事件能够确定性重建等待、运行、完成、失败、取消和中断状态；
- 单个任务失败或用户取消时，不产生隐式 Lesson、Trace 或长期记忆写入；
- Tutor 工作流的学生投影不包含答案性中间结果、思维链或原始子 Session transcript；
- 题卡或 Trace 搜索为空时，临时子 Session 返回真实空结果，不生成虚构编号、路径或来源；
- Plan 结束后的深度记忆聚合只生成候选差量，未经学生确认不能更新两份长期画像。

### 13.2 真实端到端验收

使用仓库中的导数学习集完成一次真实模型流程：

1. 打开学习集并恢复当前 Plan，侧边栏显示 Coach 根节点和已有 Lesson 子节点；
2. 在 Coach Session 开启深度模式，由 Coach 判断需要会诊并展示备课工作流的任务、依赖和预算；
3. 确认工作流，观察多个检索与审查节点实时推进，其中至少一个节点读取真实题卡及其绑定 Trace；
4. Coach 综合工作流结果并加载备课 Skill，生成包含多个课堂节点的下一课；
5. 学生查看无剧透摘要；开课前让 Coach 原地调整一次安排，确认 Lesson ID 和侧边栏条目不变；
6. 学生点击该 Lesson，确认输入被路由到独立 Tutor Session 并开始上课；
7. Tutor 呈现真实题卡，接收文本、LaTeX 和手写图片；
8. 触发一次 Tutor 快速会诊，确认临时节点不会出现在 Plan 侧边栏，学生只能看到安全任务状态和 Tutor 最终回应；
9. 完成至少一个证据活动并写入 Trace；
10. 返回 Coach 请求重新备课，确认旧 Lesson 变为 `abandoned`、旧证据仍可回放，新 Lesson 使用新 ID 和新 Tutor Session；
11. 进入新 Lesson，刷新页面，确认侧边栏、节点、消息、工作流轨道和证据仍可恢复；
12. 产生一次带来源的路线调整，并观察路线动画；
13. 写入 Trace 后观察能力星图变化，并从节点下钻到原始证据；
14. 学生主动结束，默认返回原 Coach Session 完成复盘；
15. 打开课后回放，定位路线改变、手写图片与能力变化；
16. 切换人设主题，确认教学内容和证据保持不变。

### 13.3 首版成功标准

首版成功不以功能数量衡量，而以“一名学生能否在不接触文件系统和终端的情况下，完整上完一节真实课程，并保留可回溯学习证据”为准。

## 十四、旗舰演示功能

以下六项功能全部进入设计范围，但共用现有学习事实、来源链接和事件投影，不各自建立数据模型或后台。

### 14.1 实时能力星图

能力星图把 `graph/` 中的能力、题型、主方法和次方法节点绘制成可交互网络。当前 Lesson 涉及的节点高亮；当新的 active Trace 写入时，证据信号沿“题卡 → 方法 → 能力目标”传播并产生短暂动画。

首版掌握度采用已经确认的简单聚合：

- 每条 active Trace 从真实题卡取得主方法和次方法；
- 主方法获得较高权重，次方法获得较低权重；
- `assessment`、`support` 和课堂判断保持独立，不把有提示完成等同于独立掌握；
- 被纠正或撤回的 Trace 不参与当前投影；
- 同一节点同时展示支持证据、冲突证据和证据数量。

首版界面使用“待观察 / 不稳定 / 较稳”等区间和不确定性光晕，不展示未经校准的伪精确百分比。底层投影将来可以替换为正式 BKT，而不改变题卡、Trace 或前端交互契约。

交互包括：

- 悬停显示本次变化来自哪一张题卡和哪条 Trace；
- 点击节点打开证据透镜；
- 在课堂中只突出当前相关的局部子图；
- 在学习集首页展示整个 Plan 的压缩视图；
- 备课时把相同聚合结果投影到 `planner-attention.md`，但不把掌握度写回图谱节点。

### 14.2 动态课堂路线

课堂节点抽屉同时呈现两条路线：

- 浅色底图：Coach 备课时安排的初始 ActivityBlock 路线；
- 高亮实线：Tutor 当前实际执行的路线。

Tutor 根据真实课堂证据插入、跳过、重排或重复节点时：

1. 先按既有课堂规则与学生讨论或响应学生请求；
2. 在 Lesson 的 `Route Changes` 中追加带来源的决定；
3. 前端收到 `route-change` 投影并以平滑动画重排节点；
4. 在消息流中展示一句无剧透解释。

路线动画不能代替能力判断。Task 完成、时间经过或模型主观感觉都不能单独触发“已掌握”路线；改变必须能够链接到学生请求、Trace 或其他真实课堂记录。

### 14.3 课后学习回放

已关闭 Lesson 在备课本中提供可拖动时间轴。回放组合以下已有来源：

- Pi Tutor Session JSONL 中的学生与 Tutor 消息；
- Lesson 中的 ActivityBlock 状态与 Route Changes；
- Lesson Trace；
- 学生上传的手写图片；
- 题卡和材料真实路径；
- 能力星图在各 Trace 时点的可重建投影。

时间轴可以定位：

- 首次暴露问题的节点；
- 学生的首次尝试和后续修正；
- 提示阶梯实际推进到哪一级；
- 哪条 Trace 形成支持或冲突证据；
- 课堂路线何时、为什么改变；
- 能力星图在课前与课后的差异。

回放不保存第二份完整事件日志。若 Pi Session JSONL 缺失，页面明确降级为“证据回放”：仍展示 Lesson 节点、Route Changes、Trace、题卡和图片，但不伪造缺失的完整聊天内容。

### 14.4 证据透镜

证据透镜是通用侧边面板，不是新页面。它可以从能力节点、题卡、Trace、路线变更或课后结论打开，并沿真实链接展示：

```text
Roadmap 能力标准
  → Plan 目标
  → Lesson / ActivityBlock
  → Trace 与学生原始作答
  → 真实题卡或材料
  → 主方法 / 次方法节点
```

路径由 Markdown 链接、Lesson alias、题卡方法字段和 `source_resolve` 结果拼接，不建立第二套知识图谱。断链时显示断点，不自动补造关系。

学生模式只显示安全来源、自己的作答和已经公开的判断；开发者模式可以继续下钻到 Teacher Control、题卡步骤和原始工具结果。

### 14.5 二次元课堂皮肤

人设继续只控制表达和展示。前端可以为当前人设加载头像、配色、轻量动效和不同阶段的视觉状态：

- Coach 规划；
- 备课处理中；
- Tutor 讲解；
- 等待学生作答；
- 完成节点；
- 课后复盘。

视觉状态只由 `phase`、`work-status` 和 `notebook-node` 等确定事件驱动，不让模型输出任意动画指令。角色包缺失或加载失败时退回中性教师主题，不影响会话、Lesson 或证据写入。

首版使用静态立绘加 CSS/Rive/Lottie 一类轻动效即可；Live2D 等更重的角色运行时属于可替换展示插件，不成为课堂主流程依赖。

### 14.6 深度模式与动态工作流

深度模式把多视角教学分析变成 Coach 和 Tutor 都能使用的 Session 内能力。它不增加第三个顶级 Agent，也不让学生手动切换到临时专家。父 Agent 负责判断是否需要工作流、生成任务图、接受结果和执行正式写入；`pi-subagents` 只负责运行临时子 Session。

#### 14.6.1 三级触发

深度模式开启后，父 Agent 在每个任务前选择：

1. **直接处理**：现有上下文已经足够，不创建工作流；
2. **快速会诊**：最多三个子任务、单轮并行，默认总上限为 12,000 Token、45 秒，可以直接运行；
3. **深度工作流**：任务更多、存在多轮依赖、对抗验证或后台执行时，先显示目标、任务图、最大并发、Token 上限和时间上限，学生确认后启动。

是否启动不由关键词规则决定。父 Agent 只有在“至少存在两个可独立分析的视角，且结果可能改变下一步教学动作”时才使用工作流；否则继续普通对话。Session 开关表达的是允许使用，不是每轮强制并行。

#### 14.6.2 动态角色

Skill 提供一个小型角色模板库，但不把角色固化为长期 Agent：

| 父 Agent | 常用临时角色 | 任务 |
|---|---|---|
| Coach | 证据检索员 | 搜索题卡、绑定 Trace、图谱和前序摘要 |
| Coach | 学情分析员 | 从带来源课堂事实中提出当前薄弱点 |
| Coach | 课堂设计员 | 组合题目、视频、互动讲解和小测节点 |
| Coach | 防剧透审查员 | 检查学生可见内容是否提前泄露解法 |
| Coach | 对抗审稿员 | 质疑教案是否真正服务 Plan 能力目标 |
| Tutor | 作答分析员 | 阅读学生当前答案、草稿或图片过程 |
| Tutor | 错因诊断员 | 区分概念、计算、表达和策略问题 |
| Tutor | 提示设计员 | 设计不代替学生思考的下一层提示 |
| Tutor | 讲法替换员 | 在原讲法无效时寻找另一种表示或路径 |
| Tutor | 课堂审查员 | 检查剧透、难度跳跃和 Lesson 偏离 |

Skill 可以按任务组合这些模板，也可以生成新的临时角色名称，但所有角色必须使用既有的只读权限模板和统一输出结构，不能自行扩大工具权限。

#### 14.6.3 最小上下文包

临时子 Session 不接收完整父对话。每个任务只接收：

```yaml
goal: 本次子任务
lesson_step: 当前课堂节点或备课位置
source_handles:
  - 题卡别名与真实路径
  - 绑定 Trace
  - 前序摘要引用
allowed_reads:
  - 当前任务需要的目录或对象
output_schema:
  - findings
  - evidence_refs
  - recommended_action
  - risks
budget: 本任务 Token 与时间上限
```

普通 Markdown 和摘要由召回 Skill 在限定目录中搜索。题卡与 Trace 继续通过既有工具双向查询；读取一张题卡时附带其绑定 Trace，检索 Trace 时可以反查真实题卡。任何判断都必须返回 `evidence_refs`；找不到来源时返回空结果，不生成题卡编号或路径。

#### 14.6.4 任务轨道

前端把工作流渲染成一个可折叠任务轨道，而不是聊天消息：

```text
深度会诊 · 3/5 已完成 · 2 个正在运行                  [取消]

✓ 查找相关题卡与 Trace                    找到 8 条来源
● 分析可能的知识缺口                      正在分析
● 设计下一步提示                          等待知识缺口分析
✓ 检查是否提前剧透                        通过
○ Coach / Tutor 最终综合                   尚未开始
```

每个任务只展示角色、任务、依赖、状态、来源数量和安全摘要。点击可以查看最终结构化结论和来源；学生模式不展示思维链、原始 transcript 或答案性中间结果。工作流完成后轨道折叠成一行，切换 Session 或刷新后由生命周期记录恢复。

#### 14.6.5 数据与写入边界

运行时只保存以下 Session-owned artifact：

```text
workflow_id
parent_session_id
workflow_graph
lifecycle_events
subagent_outputs
final_synthesis
status
```

它们不进入 learning set，也不新增 `workflows/` 目录。上下文压缩时，父 Agent 只保留工作流目标、最终结论、关键来源和 `workflow_id`；需要细节时再读取原始 JSON。

正式教学事实仍只通过现有路径落地：Coach 写 Lesson，Tutor 推进课堂并写 Trace，Plan 结束时生成待学生确认的长期记忆差量。临时子 Session 不能直接写 Roadmap、Plan、Lesson、Trace、画像或 `planner-attention.md`。

单个分支失败不阻止其他分支；父 Agent 使用有效结果并说明缺失视角。用户取消时停止未完成节点、保留已完成运行记录，但不产生正式写入。父 Session 删除时一并删除临时工作流记录；已经正式写入且有来源的教学事实不受影响。

### 14.7 与三个现有页面的关系

六项功能不增加新的顶级导航：

| 功能 | 学习集首页 | Plan 会话页 | 备课本 |
|---|---|---|---|
| 能力星图 | Plan 总览 | 当前局部子图 | 课前/课后对比 |
| 动态课堂路线 | 最近 Lesson 摘要 | 实时节点抽屉 | 初始/实际路线对照 |
| 学习回放 | 最近回放入口 | 不占据当前课堂 | 完整时间轴 |
| 证据透镜 | 从能力节点打开 | 从题目与 Trace 打开 | 从总结与路线变化打开 |
| 二次元皮肤 | 学习集主题 | Coach/Tutor 状态 | 轻量主题，不遮挡文档 |
| 深度模式 | 不常驻展示 | 实时任务轨道 | 查看备课工作流摘要与来源 |

这些功能的目标不是装饰仪表盘，而是把“个性化教学正在发生”变成可观察、可解释、可回溯的体验。

## 十五、实施切片

完整设计按依赖关系拆成六个可独立验收的切片，避免同时铺开所有界面：

1. **Pi runtime 与安全投影**：Plan 父子 Session 工作区、Coach/Tutor ResourceLoader、原生四工具和 Student/Teacher DTO；
2. **课堂核心界面**：三个页面、Plan 会话侧边栏、结构化事件、Lesson 节点、重备课、文本/LaTeX/图片输入和基础恢复；
3. **深度模式纵向闭环**：Session 开关、动态工作流 Skill、`pi-subagents` 执行、任务轨道、父 Agent 独占写入和中断恢复；
4. **证据可视化**：主次方法聚合、实时能力星图和证据透镜；
5. **课堂时序**：Route Changes、动态路线和课后学习回放；
6. **展示层收口**：二次元主题、轻量动画、完整导数学习集 E2E 与演示脚本。

每个切片都必须在导数学习集上形成可运行的纵向闭环后才能进入下一片。后续实施计划按这些切片拆任务，不把它们实现成六套孤立的数据服务。
