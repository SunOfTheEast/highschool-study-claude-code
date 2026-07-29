# 学生可见教学可靠性收口设计

状态：待审阅

日期：2026-07-29

## 一、背景

StudyForge 已经完成 Roadmap、Plan、Lesson、题卡、Trace、能力投影、长期画像和
Coach / Tutor 连续体验的主要闭环。最近一次纵向内测用同一学习集连续运行了两个
Plan，证明系统已经能够：

- 在多个 Lesson 之间保留事实和会话连续性；
- 根据前一个 Plan 的学习轨迹改变后续规划；
- 让 Tutor 接受学生的真实替代路线；
- 从 Lesson、Trace 和 Plan Summary 回溯长期表现。

剩余问题不再是“缺少记忆”，而是这些材料进入学生体验时还存在几处毛刺：

1. Plan Coach 有时跳过备课问诊，过早进入检索和备课；
2. Coach 在交接 Tutor 前泄露完整题目、关键方法或选择理由；
3. Plan 结束时的结论缺少稳定的学生可读结构，来源虽在，但不容易理解和质疑；
4. 画像确认后仍依赖 Agent 自己调用通用文件编辑，曾写入错误目录并覆盖已有内容；
5. 工具参数中仍有几处模型容易误填、但运行时其实可以自行推导的信息；
6. Roadmap 的长期目标可能一直保留占位文本；
7. Tutor 偶尔把自己的提示贡献归到学生能力上，或一次反馈倾倒过多内容。

这些问题大部分属于 Agent 行为和交接投影，而不是缺少新的教学状态机。本设计采用：

> 软结构约束 Agent 的教学判断，用两个窄而确定的运行时能力保护学生可见交接和长期
> 画像落盘；不把教学过程改造成规则引擎。

## 二、设计目标

### 2.1 学生始终知道自己正处于什么阶段

Plan Coach 完成问诊、私下检索和备课后，前端展示一张简洁的“课程已准备”卡片。
学生可以开始上课，也可以返回继续商议，但不会在进入 Tutor 前被剧透题目和解法。

### 2.2 Plan 结论可读、可追溯、可质疑

Plan 完成时仍由 Coach 作教学判断，但结论要区分：

- 最能说明当前判断的表现；
- 可以作为参考、但有局限的表现；
- 还需要继续观察的问题。

学生默认先看到自然语言结论和下一步，需要时再展开来源，并可把异议直接带回原
Plan Coach 对话。

### 2.3 经学生确认的长期画像可靠写入

画像候选仍由 Coach 提出、学生逐条确认。确认后的写入不再交给模型自由编辑文件，
而由一个 Plan Coach 专用内部工具原子地写入规范路径：

- `memory/student-profile.md`
- `memory/teaching-profile.md`

### 2.4 只在确定性边界使用运行时约束

运行时只负责它能够客观判断的事项，例如路径、来源归属、active Trace、工具参数和
原子写入。什么表现最重要、学生是否真正掌握、下一步该学什么，仍由 Coach 结合
上下文判断。

## 三、非目标

本轮不增加：

- 新 Agent；
- 新的学生可见 MCP；
- 数据库、向量库或独立 Evidence 文件；
- 备课问诊的运行时硬门；
- 教学状态机；
- 自动 mastery 判决或基于计数的“稳定掌握”文案；
- 关键词式防剧透过滤器；
- 学生直接修改 Trace 的界面；
- 通用工具重试框架；
- 旧版非规范画像或旧版 Plan 的迁移兼容；
- 对一次未复现的前端发送失败做猜测性修复。

本轮也不重新设计全局 `safe` 消息投影。现有投影已经隐藏带 `toolCall` 的 Assistant
消息；只收口 `lesson_prepare` 成功后的最终交接内容。

## 四、总体流程

```text
Plan Coach 读取 Plan、画像、摘要与必要来源
  → 与学生进行备课问诊（一次一问）
  → 总结本课意图，允许学生修正
  → 学生确认
  → Coach 私下检索题卡、比较路线并形成 Teacher Control
  → lesson_prepare 成功写入 Lesson
  → 前端显示通用“课程已准备”卡
  → 学生进入 Tutor Session
  → Tutor 按学生实际思路教学并写 Trace
  → 学生确认结束
  → 返回原 Plan Coach 复盘
  → Plan 完成时写入分层学习回顾
  → 学生确认画像候选
  → memory_review_apply 原子落盘
  → 回到 Roadmap Coach 商议下一阶段
```

Agent 之间仍不复制 Session 历史，只通过已经持久化的 Lesson、Trace、Plan Summary
和确认画像交接。

## 五、Agent 根提示与 Skill 分工

### 5.1 Plan Coach 根提示

以下不变量放在 Plan Coach 的高显著位置，而不是埋在长 Skill 末尾：

1. 每次调用 `lesson_prepare` 前必须先进入备课问诊；
2. 一次只问一个关键问题，直到会改变本课的歧义已经澄清，或学生明确要求停止询问；
3. 学生确认本课意图后，题卡召回、路线比较和 Teacher Control 都属于私下备课；
4. `lesson_prepare` 成功后不再用自由文本复述题目、方法、路线数或选材理由；
5. Plan 审计和画像落盘后，只汇报重新读取到的持久化结果。

这里的“必须问诊”是 Agent 行为契约，不新增 `lesson_prepare` 硬门。学生可以明确把
判断权交给 Coach，Coach 也不必重复已经得到答案的问题，但不能因为历史记录丰富而
完全跳过学生当下的意图。

### 5.2 Tutor 根提示

Tutor 根提示保留少量高频不变量：

1. 每次回复只推进一个主要教学动作；
2. 不向学生提及 Teacher Control、来源解答、内部判据或工具参数；
3. 在给出方向性提示前，先保留学生已经独立表达的尝试；
4. 写最终 Trace 前比较学生提示前内容、Tutor 的实际贡献和最终路线；
5. 学生明确结束课程后，不再开启新的教学或反思环节。

### 5.3 Skills 的职责

复杂教学方法继续留在 Skills：

- 如何从学生上一句话生成有洞见的下一问；
- 如何比较竞争性的学情解释；
- 如何选择课堂模板、题卡和支持节奏；
- 如何验证并记录一题多解；
- 如何区分学生独立完成与 Tutor 支持后的完成；
- 如何形成 Plan 级学习回顾和长期画像候选。

Plan Coach 和 Tutor 的根提示只保存跨任务都不能遗忘的边界。共享教学语义同时更新
Pi 与 Claude 插件中的对应 Skill；Pi 专有的前端卡片和内部工具不复制到 Claude
插件。

## 六、无剧透课程就绪卡

### 6.1 触发条件

就绪卡只在以下事实都成立后出现：

1. 学生已经确认或授权本课意图；
2. Coach 的私下召回和备课已经完成；
3. `lesson_prepare` 已成功写入并能够重新读取 Lesson。

它不是“正在备课”状态，也不能由 Agent 自称“准备好了”触发。

前两项由 Plan Coach 的行为契约保证，不增加机器判定或备课硬门；前端唯一使用的确定
触发事实是第三项。若 Coach 违反前两项，应在 Agent 验收中发现和修订提示，而不是
让运行时猜测一段对话是否构成了充分问诊。

### 6.2 学生可见内容

卡片始终使用通用表达，只展示：

- Lesson 已准备完成；
- 本课会包含哪些一般活动，例如尝试、讨论、反馈、小结；
- 大致活动数量或结构；
- “具体题目与思路将在课堂中逐步展开”；
- “开始上课”和“返回继续讨论”两个操作。

卡片不得展示：

- Lesson 标题中可能构成提示的内容；
- 题卡编号、完整题面或隐藏条件；
- 目标方法、决定性变形或检查点；
- 候选路线数量与路线特征；
- Coach 的选材理由和 Teacher Control。

不增加 `handoffMode`。不同课堂类型的揭示节奏继续由备课 Skill 和 Tutor 行为决定，
而不是让就绪卡承担第二套状态分支。

### 6.3 safe 与 raw-stream

现有 `safe` 投影已经隐藏包含工具调用的 Assistant 消息，因此不重构整条消息过滤
链路。只增加一个窄投影：

- 若一次 Agent 运行中存在成功的 `lesson_prepare`，其学生可见终态由结构化就绪卡
  取代；
- 运行中的现有工作状态照常显示；
- `raw-stream` 继续保留完整 Pi JSONL、工具调用和原始回复；
- 页面刷新后从持久化的成功工具结果与 Lesson 状态重建卡片，不创建新的教学事实。

如果 `lesson_prepare` 失败，不能显示就绪卡，也不能吞掉可帮助用户理解失败的正常
错误反馈。

## 七、Plan 级双层学习回顾

### 7.1 学生默认视图

Plan 页面首先显示两项：

1. Coach 对本阶段学习结果的自然语言结论；
2. 建议的下一步。

详细来源默认折叠在“为什么这样判断”中。展开后使用学生能理解的三个层次：

- **最能说明这一点**：与当前结论最直接相关的关键表现；
- **可以作为参考**：有关联，但存在提示、任务熟悉度或其他局限；
- **还需要再看看**：目前证据不足、需要后续任务验证的问题。

界面不向学生展示 PASS / FAIL、contaminated、evidence tier 等内部术语。

### 7.2 `plan_update` 契约

不新增 Evidence 对象或文件。Plan 完成时，`plan_update` 使用结构化
`learningReview`：

```ts
type LearningReview = {
  conclusion: string
  nextStep: string
  keyEvidence: Array<{
    claim: string
    source: string
  }>
  supportingEvidence: Array<{
    claim: string
    source: string
    limitation: string
  }>
  openQuestions: Array<{
    question: string
    nextCheck: string
  }>
}
```

`plan_update` 按决定类型分为两种写法：

- `active` / `replan`：继续使用 `currentPosition`、`nextLessonCandidate` 和自由
  `planSummary`；
- `complete`：必须提供 `currentPosition`、`nextLessonCandidate` 和
  `learningReview`，不再同时接收自由 `planSummary`。

运行时把 `learningReview` 渲染进现有 `## Plan Summary`，不增加新的持久化小节。
这样避免一份结构化结论和一份自由文本结论彼此矛盾。

### 7.3 来源校验边界

运行时只校验客观事实：

- 来源属于当前 Plan；
- 路径可以解析；
- Trace 为 active 且未被 supersede；
- 关键来源至少是一条 assessment 类任务中的正确表现；
- 关键来源的支持程度为 `none`。

这些条件只说明一条来源有资格成为关键来源，不自动说明学生已经稳定掌握。来源是否
真正匹配结论、是否具有代表性，以及该如何表述，仍由 Coach 判断。

`supportingEvidence.limitation` 用来如实说明提示依赖、熟悉题型、一次性表现等限制。
不存在自然的未决问题时，`openQuestions` 可以为空，不能为了格式虚构风险。

### 7.4 来源下钻与学生异议

每条来源链接打开学生安全版的 Lesson / Trace 回放。来源旁提供：

> 这和我的实际情况不一样

点击后不直接改 Trace 或 Plan，而是把该来源、Coach 的对应判断和学生的异议入口作为
预填消息送回同一个 Plan Coach Session。Coach 先理解异议，再决定是否：

- 仅修订 Plan 结论；
- 发现事实记录确有错误并按现有 supersede 流程更正；
- 保留双方不同理解，安排下一次观察。

这不是新的异议对象，也不产生自动裁决。

## 八、长期画像确认与原子落盘

### 8.1 现有问题

纵向内测中，Coach 曾把长期画像写入：

- `profiles/student.md`
- `profiles/teaching.md`

而当前规范路径实际是：

- `memory/student-profile.md`
- `memory/teaching-profile.md`

跨 Plan 个性化之所以仍然出现，是模型后来主动找到了非规范目录，不代表画像契约
已经闭环。通用 `write` / `edit` 还允许路径选错、局部覆盖和只写一半。

### 8.2 `memory_review_apply`

新增 Plan Coach 专用的 Pi 内部工具：

```ts
memory_review_apply({ reviewId })
```

工具执行：

1. 从同一个 Plan Coach Session 和 owner-bound Plan 读取最近已提交的 review；
2. 逐条采用 UI 中已经确认的 accept / rewrite / reject 决定；
3. 校验学生画像和教学画像的当前版本；
4. 在内存中生成两份新内容；
5. 两份文件全部验证通过后原子写入；
6. 保存 apply receipt，供刷新、重试和 Coach 回读。

返回：

```ts
{
  ok: true,
  reviewId: string,
  appliedItems: string[],
  unchangedItems: string[],
  profilePaths: {
    student: "memory/student-profile.md",
    teaching: "memory/teaching-profile.md"
  }
}
```

同一个 `reviewId` 重复调用必须幂等。任何一份文件校验失败时，两份都不写入。

### 8.3 规范画像格式

两个文件都在 `## Active Preferences` 下保存稳定条目：

```markdown
### S1

- Content: 独立尝试后再获得方向性提示
- Scope: 当前 Roadmap
- Sources: lessons/lesson-003.md#...
- Rationale: 多节课中这种节奏能保留学生自己的路线判断
- Counter-evidence: 暂无
```

教学画像使用 `T1`、`T2` 等编号。运行时分配编号，不让模型自行选择路径或编号。

候选项：

- `add` 时目标不得已经存在；
- `revise` / `delete` 时目标必须存在，且 `currentText` 必须与当前内容一致；
- 来源只接受纯路径，不接受“路径（附带解释）”；
- 不兼容、迁移或猜测旧的自由结构；内容不符合规范时明确报错。

### 8.4 工具权限收口

- Plan Coach 移除通用 `write` 和 `edit`；
- Roadmap Coach 保留二者，用于 Roadmap 和 Plan 文件的正式规划；
- Tutor 工具集不变；
- UI 提交画像决定后，唤醒原 Plan Coach，并明确要求调用
  `memory_review_apply`，不再提示 Agent 自行编辑文件；
- 工具成功后 Coach 重新读取两份规范画像，再向学生报告结果。

## 九、工具契约小修

本轮只修复运行时已经知道答案、却仍要求模型猜测的参数：

1. `lesson_prepare.adjustments` 改为可选，缺省为 `[]`；
2. `trace_append.blockId` 根据当前 Lesson 的可记录 block 动态生成枚举；
3. `classroom_update.blockId` 使用同一动态枚举；
4. `card_alternative_append`：
   - 题卡没有分问时由运行时推导为“整题”；
   - 有分问时，`question` 只允许题卡中的真实分问标签；
5. 画像 review 的 source schema 明确只接受纯路径。

这些修改不降低事实校验。Schema 仍应拒绝错误参数，但 Agent 根提示要求遇到拒绝时先
读取错误和当前上下文再修正，不能无脑循环调用。现有 post-tool continuation 保持
有限次数，不新增一套通用重试系统。

## 十、Roadmap 长期目标同步

不新增 `roadmap_update`。

Roadmap Coach 在首次注册 Plan 前必须：

1. 与学生确认长期 Goal；
2. 确认可观测能力标准；
3. 确认用于判断 Roadmap 达成的 Test；
4. 用现有文件编辑能力替换 Roadmap 中的占位文本；
5. 再调用 `plan_register`；
6. 重新读取 Roadmap 和 Plan 后向学生汇报。

后续只有长期目标真正变化时才修改 Roadmap，不能把某一个 Plan 的局部目标复制成
Roadmap 目标。

## 十一、Tutor 教学行为收口

Tutor 使用以下自然循环：

```text
理解学生实际写出的数学内容
  → 找到一个最关键的障碍或机会
  → 给出一个与当前需要匹配的干预
  → 观察学生下一次反应
```

具体要求：

- 对错误或不完整回答，先保留正确部分，只指出一个当前阻塞点；
- 学生没有请求完整解答时，不倾倒标准路线；
- 提示不增加 UI 硬门，按学生请求、课堂目标和已有尝试自然给出；
- 一次提示只提供足以推进当前一步的帮助；
- 方向性提示之前先记录学生独立尝试；
- 若最终解答依赖 Tutor 提示，Trace 的支持程度必须反映该贡献；
- 反馈默认不用评分表、长篇复述或内部矩阵，只说明哪里成立、一个关键问题和下一步；
- 对真正不同的分问解法按现有另解契约处理；
- 学生确认结束后，不再开启新的教学或 Reflection。

本轮不引入“每题一个 Session”或隐式 context compact。连续课堂仍保留同一 Lesson
Session，避免破坏缓存和跨题衔接。

## 十二、完整周期验收

### 12.1 运行范围

使用全新隔离的导数学习集：

- 空白 Roadmap；
- 一个包含六节真实 Lesson 的 Plan；
- Plan 完成后的双层学习回顾；
- 学生确认并应用长期画像；
- 返回 Roadmap Coach，完成下一阶段方向的问诊与建议；
- 不实际开始第二个 Plan。

运行开始前记录固定 provider、model、仓库 commit 和学习集资产 hash。先通过确定性
测试，再冻结代码与提示词；真课期间不边跑边改。

### 12.2 模拟学生

模拟普通高中生，不扮演系统审计员：

- 只根据学生可见信息回答；
- 不知道 Trace、工具、Teacher Control 或验收目标；
- 有基础的导数与函数知识；
- 会出现不完整回答、普通计算错误和疲劳；
- 会在需要时请求或拒绝提示；
- 可能自己纠正，也可能坚持一条不成熟路线；
- 说话自然，不主动替系统制造边界案例。

尽量自然覆盖以下课堂现象：

- 不完整回答；
- 错误回答；
- 请求一个小提示；
- 提示后完成；
- 独立自我纠正；
- 提出合理替代路线；
- 暂停或主动关课。

没有自然出现的情形记为“未覆盖”，不能让模拟学生为了完成测试清单故意表演。

### 12.3 验收维度

最终报告分别审计：

1. **问诊触发**：六节课前是否都发生了有价值的一次一问；
2. **揭示边界**：私下备课、就绪卡和 Tutor 首次揭题是否分工清楚；
3. **教学适配**：Tutor 是否根据学生这一步的真实内容调整；
4. **Trace 真实性**：独立内容、提示贡献、方法和题卡绑定是否准确；
5. **学习回顾**：结论、关键来源、参考来源和未决问题是否相称；
6. **画像落盘**：是否只写入规范 `memory/` 路径，且确认、原子性和幂等成立；
7. **会话连续性**：Plan Coach、六个 Tutor Session 和 Roadmap Coach 路由可恢复；
8. **学生观感**：界面是否自然、克制、没有内部工具旁白。

对前端发送操作做人工观察。如果再次出现点击无效，再根据事件与请求记录定位；未复现
时不把它包装成已修复缺陷。

报告必须把结果分为：

- 已修复并验证；
- 运行时拦截后恢复；
- 本周期未覆盖；
- 仍需处理。

## 十三、必要复杂度审计

本设计真正新增的产品组件只有两个：

1. `lesson_prepare` 成功后的学生安全就绪卡；
2. `memory_review_apply` 原子画像写入。

其余改动均复用现有结构：

| 需求 | 复用方式 |
| --- | --- |
| Plan 学习结论 | 扩展现有 `plan_update`，仍写入 `Plan Summary` |
| 来源下钻 | 复用 Lesson / Trace 学生安全回放 |
| 学生异议 | 复用同一个 Plan Coach 聊天，不建新对象 |
| Roadmap 同步 | 复用 Roadmap Coach 的文件编辑和 `plan_register` |
| 备课问诊 | 复用现有 Coach Session 与 Skill |
| Tutor 适配 | 修改 Skill 和高显著根提示 |
| 参数纠错 | 收窄现有 schema，不增加工具 |

明确删除或拒绝的复杂度：

- 不增加 `handoffMode`；
- 不建立独立 Evidence 数据层；
- 不让 evidence count 生成 mastery 文案；
- 不重写全局 safe projection；
- 不增加画像迁移与兼容分支；
- 不增加自动异议裁决；
- 不增加通用重试控制器。

这条边界用于约束实施：若某项代码不能直接服务于本文的学生可见交接、来源回顾、
规范画像落盘或已观察到的工具错误，就不进入本轮。

## 十四、完成标准

本设计完成后，学生应感受到的是：

- Coach 先真正理解本课需要，再去备课；
- 课程准备完成时有清楚入口，但不会被提前剧透；
- Tutor 一步一步回应自己的思路，而不是宣读标准答案；
- Plan 结束时能够看懂系统为什么这样评价，也能自然提出异议；
- 自己确认过的长期偏好在下一个周期确实生效；
- Roadmap、Plan、Lesson 和画像都显示重新读取后的真实状态。

系统内部仍保留完整工具日志和来源链，但这些复杂度不再倾倒给学生，也不代替教师式
判断。
