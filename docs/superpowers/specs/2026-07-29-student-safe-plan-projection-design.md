# Markdown 事实源与学生安全 Plan 投影设计

状态：已实施并通过自动化验收

日期：2026-07-29

## 一、结论

本轮不把 Plan 改造成高度结构化的公开表单，也不限制 Coach 在私有检索后的
`plan_update`。问题不在 Markdown 作为事实源，而在学生前端把事实源中的自由备课文本
直接当成了展示文案。

采用与现有 Lesson 相同的边界：

```text
Plan Markdown ─────────────────────→ Plan Coach 完整读取
       │
       └─ Student Plan Projection ─→ 首页与 Context Stack

Lesson Markdown ───────────────────→ Tutor 完整读取
         │
         └─ Student View / Ready ──→ 课堂与课程就绪卡
```

Plan、Lesson 和 Session JSONL 继续保存完整事实。默认学生界面只消费可重建的安全
投影，不直接渲染 `Next Lesson Candidate`、active Plan 的 `Plan Summary` 或 prepared
Lesson 的真实标题。

这不是文件权限系统。学生拥有本地 learning set，仍可以主动打开 Markdown，开发者也
可以使用 `raw-stream`。目标是防止系统主动把未揭示的题目和路线推到学生眼前，而不是
对本地文件进行对抗性保密。

## 二、为什么这是历史一致的修法

StudyForge 从一开始就采用以下原则：

1. Markdown 是唯一持久学习事实源，不增加数据库或第二套可编辑状态；
2. 程序拥有路径、状态、索引等可确定推导的结构；
3. Coach/Tutor 保留教学判断和自然语言表达；
4. 学生界面是事实的安全投影，不取得教学事实所有权；
5. 防剧透是默认展示边界，不是本地文件访问控制。

已有三个直接先例：

- `LessonBlueprint` 只结构化课堂骨架，最终 Lesson Markdown 仍保存自由的
  Student View 与 Teacher Control；
- Lesson Index 发生损坏后，运行时只接管可重建索引，没有接管 Coach 的教学判断；
- assessment、课程就绪卡、工具消息和研习资料都通过学生安全投影隐藏未揭示内容，
  没有删除原始 Markdown 或 Pi JSONL。

因此，把整个 Plan 改造成封闭 schema 会背离既有边界；继续让前端读取任意 Plan
Markdown 又会重复本次故障。正确的中间位置是保留 Plan 事实自由度，只收紧学生消费
端。

## 三、问题与根因

第五节真实验收中，`lesson_prepare` 的课程就绪卡是安全的，但同一页面右侧
Context Stack 直接展示了 Plan 的：

- `Next Lesson Candidate`；
- active Plan 的 `Plan Summary`。

其中包含题卡短号、目标函数、目标小问、具体导数、隐零点困难、替代路线的决定性变形
和预设换路信号。首页也直接使用 `Current Position`、`Next Lesson Candidate` 和
`Plan Summary` 生成“学习顾问写下的下一步”，并可能把 prepared Lesson 的真实标题
作为续学标题。

现有链路是：

```text
plan_update 自由文本
  → Plan Markdown
  → readPlanWorkspace / readCoachContext
  → shared client contract
  → ContextStack / LearningSetHome 原样渲染
```

这条链路把“可供 Coach 重读的学习事实”误等同为“适合学生此刻看到的产品文案”。
Skill 已经要求题面、方法和选卡理由保持私有，但只要模型有一次把备课摘要写进 Plan，
前端就会绕过安全课程就绪卡。

## 四、目标与非目标

### 4.1 目标

- 保留当前 Markdown-first 事实模型和 Plan 八节契约；
- Plan Coach 可以完整读取 Plan、Lesson、题卡和私有检索结果；
- 首页、Context Stack、prepared Lesson 入口和课程就绪卡使用同一安全语义；
- 学生仍能看见真实进度、课堂活动形态和适当的学习目的；
- assessment 与 diagnostic 在首次尝试前不暴露会破坏检验的问题目标；
- 页面刷新和 Session 恢复后能从现有事实重建相同投影；
- 安全失败时降级为通用说明，不回退显示原始 Plan 文本。

### 4.2 非目标

- 不修改 Plan Markdown 的必需章节；
- 不把 `Next Lesson Candidate` 改成复杂对象或持久 DSL；
- 不增加 Plan 的第二份 public/private 文件；
- 不增加数据库、索引服务、新 Agent、新 MCP 工具或审查模型；
- 不建立关键词、公式或方法名过滤器；
- 不按“当前 turn 是否调用过 `card_search`”锁定 `plan_update`；
- 不验证 Coach 的教学判断是否正确；
- 不阻止学生主动打开本地 Markdown、Authoring source 或 `raw-stream`；
- 不为旧 Plan 增加迁移或兼容层。

## 五、信息所有权

| 信息 | 持久 owner | 默认学生展示 |
| --- | --- | --- |
| Plan Goal、能力标准 | Plan Markdown | 可展示 |
| Current Position | Plan Markdown | 可展示，但只能表达已经发生的学习位置 |
| Next Lesson Candidate | Plan Markdown | Coach 可读；学生界面不原样展示 |
| active Plan Summary | Plan Markdown | Coach 可读；学生界面不原样展示 |
| completed Learning Review | Plan Markdown | 通过现有结构化投影展示 |
| Lesson Capability Target | Lesson Markdown | 按课堂模板决定是否展示 |
| Lesson title | Lesson Markdown | prepared 时隐藏；开始后展示 |
| Block 数量与类型 | Lesson Markdown / prepare receipt | 可确定性展示 |
| 题卡短来源号 | Card metadata | 可选展示 |
| 题面、方法、路线、卡点、提示、答案 | Lesson Student View / Teacher Control / Card | 按课堂揭示边界展示 |
| 原始工具调用和模型回复 | Pi Session JSONL | 只在 `raw-stream` 展示 |

`Current Position` 保持学生可见，因为它的职责是回顾已经发生的状态；它不得承担下一题
备课说明。`Next Lesson Candidate` 和 active `Plan Summary` 允许 Coach 保留完整规划
语境，但不再被默认学生界面消费。

精确备课内容应以 Lesson 为 owner。Plan 可以保存高层方向、未决问题、短来源线索和对
Lesson 的引用，不应重复一份 Teacher Control。这个职责通过 Skill 与工具描述澄清，
但默认学生安全不依赖模型每次都写对。

本设计提供两种不同强度的保证：

- **确定性边界**：默认界面绝不直接显示 Next Lesson Candidate、active Plan
  Summary、prepared Lesson title、Teacher Control 或 Pending Student View；
- **教学表达边界**：Current Position、非考察课的 Capability Target 和普通 Coach
  对话仍由模型自然表达，其是否清楚、恰当和不过度提示继续由 Skill 与真实课程验收
  判断。

后者不可能在保留自然教学对话的同时由 schema 完全判定。本设计不把“关闭已知的原文
泄漏通道”夸大为“模型永远不可能在聊天中说漏嘴”。

## 六、学生 Plan 投影

新增一个纯读取、可重建的 `StudentPlanProjection` 概念。它不是新文件，不持久化，
也不成为第二份学习事实。

概念结构如下：

```ts
type StudentPlanProjection = {
  progress: {
    closedLessons: number;
    registeredLessons: number;
    state: 'discussing' | 'prepared' | 'active' | 'paused' | 'completed';
  };
  currentPosition: string;
  nextLesson: null | {
    lessonId: string;
    status: 'prepared' | 'active' | 'paused';
    publicTitle: string;
    publicPurpose: string | null;
    blockCount: number;
    blockKinds: ActivityKind[];
    sourceNumbers: string[];
  };
  learningReview: LearningReview | null;
};
```

字段名可以在实施时按现有 contract 命名调整；重要的是来源和展示规则，而不是增加一套
持久 schema。

### 6.1 进度

`closedLessons`、`registeredLessons` 和当前状态由真实 Lesson Index 与 Lesson
frontmatter 推导。它们不读取模型对进度的自然语言描述，也不自动判定能力达标。

### 6.2 尚未备课

当前 Plan 没有 prepared、active 或 paused Lesson 时：

- 显示 Plan 标题、Goal、能力标准和真实 Current Position；
- 下一步只显示“正在与学习顾问商议下一课”或“等待学习顾问复盘”；
- 不把 `Next Lesson Candidate` 或 `Plan Summary` 当作回退文案。

学生已经在聊天中看过并确认的意图仍留在正常 Coach 对话中，不需要复制成第二份 UI
事实。

### 6.3 prepared Lesson

存在 prepared Lesson 时，投影从真实 Lesson 和其绑定题卡生成：

- `publicTitle` 使用通用名称，例如“下一节课堂”，不展示真实 Lesson title；
- `blockCount` 与去重后的 `blockKinds` 沿用现有课程就绪卡；
- `sourceNumbers` 只使用题卡稳定短 ID，例如 `content_item_id`，不展示
  `storage_uri`、语义文件名、题面或选卡理由；
- 没有合适短 ID 时省略题号，不从路径猜测；
- 不读取 `Next Lesson Candidate`、Sources、Teacher Control 或 Pending
  Student View 生成预告。

`publicPurpose` 复用 Lesson 已有的 `Capability Target`，但遵守课堂揭示策略：

- `assessment`：使用固定的“完成一次独立能力检验”；
- `diagnostic`：使用固定的“确认当前真实起点”；
- `concept`、`deliberate-practice`、`remediation`、`review`：可以展示
  `Capability Target`，因为这些课堂本来就允许学生知道正在学习或练习什么；
- 若 Capability Target 为空或 Lesson 读取失败，省略目的并使用通用就绪说明，不能
  回退显示 Plan 原文。

这延续了此前已经确认的区别：考察或诊断不预告会破坏首次作答的识别目标，专题学习不
需要假装学生不知道正在练什么。

### 6.4 active、paused 与 closed

- active/paused Lesson 已经开始，可以显示真实 Lesson title 和已经揭示的当前
  Student View；
- Pending Block、Teacher Control 和未揭示题卡继续沿用现有课堂投影；
- closed Lesson 进入 Replay，不再作为“下一课”；
- 若没有新的 prepared Lesson，Coach 视图回到“复盘并商议下一课”。

### 6.5 completed Plan

completed Plan 使用现有结构化 `Learning Review`。学生可以查看结论、边界、下一步和
带来源内容；不再展示 active 阶段的自由 `Plan Summary`。

## 七、统一消费者

### 7.1 Context Stack

Coach 右栏不再接收或渲染原始 `nextLessonCandidate` 和 `planSummary`。它显示：

1. 真实 Current Position；
2. Lesson 数量和当前状态；
3. 安全的下一课投影；
4. completed 时的 Learning Review；
5. 现有 Planner Attention 与前课摘要保持 Coach 工作区用途，不因此改成新的学生事实。

若 Planner Attention 或前课摘要仍属于 Coach 私有上下文，前端不得因为它们已经存在于
`CoachContextView` 就默认展开或转成面向学生的结论。本设计只处理当前已确认的 Plan
泄漏面，不重新设计这些既有折叠区。

### 7.2 继续学习首页

首页不再用：

```text
nextLessonCandidate || currentPosition || planSummary
```

生成“学习顾问写下的下一步”。首页改为：

- 当前阶段：真实 Current Position；
- 进度：由 Lesson 状态计数；
- prepared：通用标题 + 安全下一课投影；
- active/paused：真实已开始 Lesson；
- 无 Lesson：回到学习顾问商议；
- completed：进入 Roadmap 规划下一阶段。

prepared Lesson 的真实标题不能出现在首页主按钮、侧栏或开始页。

### 7.3 课程就绪卡与刷新

课程就绪卡和 Plan 页面使用同一个纯投影函数。`lesson_prepare` 成功回执可以携带这份
投影的安全字段，页面刷新时则从真实 prepared Lesson 重建；回执只是重建线索，不是
新的事实 owner。

实时事件、历史恢复和直接打开 prepared Lesson 必须得到同样的学生视图，不能只修其中
一条路径。

### 7.4 Authoring 与 raw-stream

- Authoring source 继续显示完整 Markdown；
- `raw-stream` 继续显示原始模型文本、工具参数和结果；
- 默认 `safe` 不显示这些内容；
- 设置页应继续明确 `raw-stream` 是本地诊断模式。

## 八、Coach 与工具契约

### 8.1 `plan_update`

保留当前决定 union 和 Plan 八节写入：

- `currentPosition`；
- `nextLessonCandidate`；
- active/replan 的 `planSummary`；
- complete 的结构化 `learningReview`。

不新增“搜题后禁止写 Plan”的 turn 状态，也不因存在 prepared Lesson 全面禁止
`plan_update`。Coach 仍然需要在复盘、学生改变方向或重新备课时更新 Plan。

工具描述只澄清：

- Current Position 是已发生的学习位置；
- Next Lesson Candidate 是高层方向、未决问题和可选短来源线索；
- 精确题面、方法、路线、关键变形、卡点、提示和答案属于 Lesson；
- Plan Summary 不复制 Teacher Control。

### 8.2 `lesson_prepare`

`lesson_prepare` 继续是精确备课内容进入 Lesson 的唯一 Plan Coach 写入路径。其
Blueprint 和 Lesson Markdown schema 不因本设计增加第二份公开摘要。

课程就绪投影复用已有字段：

- `primaryTemplate`；
- `capabilityTarget`；
- Block kind；
- 真实 Card binding 与题卡 `content_item_id`。

运行时只确定性选择哪些既有字段可以进入学生投影，不判断选题或教学设计是否正确。

### 8.3 Skill 小修

Coach Skill 只补一条职责边界：

> Plan 保存方向、当前位置和带来源的阶段判断；完成精确选卡后，把题面、路线、卡点、
> 揭示策略和答案写入 Lesson，不在 Plan 中复制 Teacher Control。

不为这段 Skill 文本增加逐行自动化测试。实际安全边界由投影测试承担，教学表达由真实
课程验收。

## 九、失败与恢复

### 9.1 `lesson_prepare` 失败

不显示课程就绪投影。Coach 可以解释“当前材料不匹配”或工具返回的正常失败，但学生端
不能退回显示原始 Next Lesson Candidate。

### 9.2 找不到合适题卡

不生成 Lesson。Plan 可以保留高层方向；学生界面显示“继续与学习顾问商议”，下一轮
重新问诊或调整目标。

### 9.3 prepared Lesson 重新备课

沿用现有所有权规则原地修改同一 prepared Lesson。成功后安全投影从最新 Lesson 重建，
旧题号、活动数量和目的不得残留。

### 9.4 Lesson 已经开始

沿用现有规则保留旧课堂记录并创建替代 Lesson；本设计不改变 Lesson 生命周期。学生
视图只展示当前真实 active/paused Lesson 和已经揭示内容。

### 9.5 投影读取失败

缺少可选题号、Capability Target 或 Session receipt 时，逐级省略可选信息并显示通用
状态。不得使用原始 Next Lesson Candidate、Plan Summary、Teacher Control 或题卡路径
作为 fallback。

## 十、验证

### 10.1 确定性测试

1. 在 Plan 的 Next Lesson Candidate 与 Plan Summary 写入唯一剧透标记；首页和
   Context Stack 的默认学生输出均不包含该标记。
2. Plan Coach 资源加载仍能读取同一原始标记，证明 Coach 记忆没有被删减。
3. prepared Lesson 在首页、侧栏、开始页隐藏真实 title。
4. prepared deliberate-practice 显示 Capability Target、Block 数量与活动类型，但
   不显示 Sources、Teacher Control、Pending Student View 或题卡路径。
5. prepared assessment/diagnostic 使用通用目的，不显示精确 Capability Target。
6. 安全短题号存在时可以显示；缺失时省略，不从语义文件名猜测。
7. active/paused 后真实标题和已揭示 Student View 可见，未来 Block 仍不可见。
8. completed Plan 显示结构化 Learning Review，不显示 active Plan Summary 原文。
9. `lesson_prepare` 失败或 prepared Lesson 读取失败时显示通用状态，不回退原始 Plan。
10. 实时就绪事件、历史重建和刷新后的 workspace 投影语义一致。
11. `raw-stream` 与 Authoring source 仍可读取原始内容。
12. Plan validator、`plan_update` schema、Lesson schema 和公共 MCP 工具数量不变。

测试针对运行时行为和投影结果，不断言 Skill 的逐字措辞。

### 10.2 真实课程验收

使用全新的学生 Session，从被污染的第五节之前重新准备课堂：

1. Coach 完成问诊、Plan 复盘和私下选卡；
2. 在 Plan 中故意保留足以帮助 Coach 的精确内部候选说明；
3. `lesson_prepare` 成功；
4. 学生界面只能看到真实进度、通用/模板适配的学习目的、活动数量与类型，以及可选短
   题号；
5. 页面不出现题干、目标函数、方法、具体导数、隐零点、决定性变形、换路信号或选材
   理由；
6. 刷新、返回首页、重新进入 Plan 和恢复 Coach Session 后结果不变；
7. Tutor 开始相应 Block 后，才按 Student View 正常揭示题目；
8. 无泄漏后继续第五、六节、Quick Evidence Scout、Learning Review、长期记忆确认和
   Roadmap 回访。

已被剧透的旧学生 Session 不用于首次尝试证据。

## 十一、复杂度审计

本设计增加的是一个只读投影边界，不是新的学习状态层。

预期改动集中在：

- shared student-facing contract；
- `coach-context.ts` 与 `home.ts`；
- prepared Lesson 安全投影 helper；
- Context Stack、首页和现有课程就绪卡；
- 对应 projection、study、client 与端到端测试；
- Coach Skill 的一处职责澄清。

明确不增加：

- Plan 或 Lesson 的第二份文件；
- Plan migration；
- turn 状态机；
- 内容审查器；
- Agent handoff；
- 后台队列；
- 新工具；
- 新的事实 owner。

与“结构化公开 Plan”相比，这个方案保留 Plan 对教学判断的自由表达；与“只改 Skill”
相比，它确定性关闭了学生前端的原文泄漏通道；与“分离 public/private 文件”相比，它
继续遵守 Markdown 单一事实源和本地可审计原则。

## 十二、完成标准

以下条件同时满足时，本设计实现完成：

- 默认学生界面不再直接消费 Next Lesson Candidate 或 active Plan Summary；
- Plan Coach 仍能读取完整 Plan，并能正常复盘、备课和重排；
- 首页、Context Stack、课程就绪卡与 prepared 入口使用同一学生安全语义；
- 专题课可展示有用的学习目的，assessment/diagnostic 不泄露检验目标；
- prepared Lesson 的真实标题、题面、路线和 Teacher Control 不主动展示；
- 刷新、历史恢复和实时事件的投影一致；
- Markdown、Pi JSONL、Authoring 与 `raw-stream` 保持完整；
- 当前 Plan、Lesson、Trace、记忆和公共 MCP 契约不被扩展成第二套系统；
- 第五节重跑不再复现本轮阻塞泄漏，并能继续完成剩余周期验收。
