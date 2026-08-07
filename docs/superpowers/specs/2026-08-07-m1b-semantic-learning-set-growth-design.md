# M1b 语义驱动的学习集生长设计

状态：已确认，待分阶段实施

日期：2026-08-07

## 一、M1b 解决的不是“怎么多生成几张卡”

M1a 已经让 StudyForge 能够在正式课堂结束后，把真实课堂痕迹压缩成教师可召回的对象
记忆、能力假设与明确偏好。M1b 继续回答另一个更基础的问题：一个学习集如何从几乎空白
的载体，逐渐长成学生真正使用过、理解过并能再次回到其中的学习环境。

学习集可能从三种地方出生：

1. 学生投入一本书、PDF、讲义或零散资料，系统随着真实学习需要逐步蒸馏；
2. 学生没有现成资料，只是在与教师讨论问题，讨论中逐渐形成题卡、Note 与 Flashcard；
3. 学生复用他人公开的教学资产，但自己的课堂、作答、个人资料与记忆从空白开始。

因此 M1b 不是“课程树初始化”，也不是“卡片生产流水线”。课程、个人资料、教师资产和
记忆都只是学习集可能长出的部分。学习集本身只是承载这些事实的容器。

## 二、首要原则：只对象化必须拥有事实的东西

M1b 的关键设计不是建立一套更复杂的知识对象，而是避免过早对象化。

题卡、Note、Flashcard、课堂、原始作答和对象记忆必须有稳定身份，因为它们需要持久化、
修订、授权、引用和追溯。相比之下，“导数”“绝对值”“三次函数”“极值点偏移”
“沉淀溶解平衡”“阿伦尼乌斯方程”“硫元素的性质”本身已经是含有语义的词语。它们
无需先被塞进 goal、method、structure 或预先规定的知识本体，便能同时服务于：

- 人类阅读与讨论；
- 模型联想和扩展；
- 字面检索；
- 资产召回；
- 图谱聚合与邻居发现；
- 数学、化学和其他学科的自然扩展。

整套设计遵守以下原则：

1. **一个事实，一个持久所有者。** 其他读者需要的形状使用投影，不复制真相。
2. **语义词语优先。** 平坦、人类可读的标签是跨资产与记忆的共同连接层。
3. **显式关系与派生关系分开。** 内容确实依赖某题时保存来源边；语义相近只形成可重建
   邻居。
4. **历史事实只追加，当前资产可修订。** 作答、课堂 Log 与 Trace 不回写；Note、卡片
   内容和当前标签可以修正。
5. **关系图是投影。** 图谱、邻居和召回索引都能从资产、记忆与标签重建，不成为第五份
   canonical truth。
6. **相关不等于掌握。** 共享标签只说明语义相关；学生学到哪里仍由有来源的教师判断
   表达。

## 三、总体分层

学生看到的是一个统一的学习集，内部则保持四类不同所有权：

| 层 | 持有的事实 | 典型内容 |
| --- | --- | --- |
| 原始资料 | 外部来源原貌与位置 | PDF、书籍、图片、讲义 |
| 可复用教学资产 | 可被不同学生使用的知识与教学内容 | 教师题卡、材料 |
| 个人学习资产 | 学生外化并可继续修改的认知产物 | Note、Flashcard、个人题卡 |
| 学习过程与教师记忆 | 这个学生真实经历了什么、教师当前怎样判断 | Session、Log、Trace、对象记忆 |

索引、标签邻居和知识图谱是以上四层的读者投影，不单独拥有教学事实。

学生界面不要求学生理解这四层。学生只需要做自然动作：问老师、上传资料、保存一份笔记、
把一道题加入自己的资料、重新作答或回看过去。

## 四、Session 层级

学习集不是节点。长期课程从学习集里产生，需要一层真正的 Meta Session 负责商议。

~~~text
学习集
├── Meta Session             商议并创建 Roadmap
├── Roadmap Session          商议并创建下一个 Plan
├── Plan Session             商议并准备下一节 Lesson
├── Lesson Session           正式授课
└── Light Lesson Session     不绑定 Plan 的轻量授课
~~~

每一层只设计自己的直接子层：

~~~text
Meta       → Roadmap
Roadmap    → Plan
Plan       → Lesson
Lesson     → 课堂事实、学习资产与课末记忆
~~~

### 4.1 Meta Session

Meta Session 绑定学习集根作用域，而不是伪装成 LEARNING_GUIDE.md 节点。Pi Session 保存
商议过程，确认后的设计才进入 ROADMAP.md。

它负责：

- 听学生为什么建立学习集；
- 讨论长周期希望发生的能力变化和总体学法；
- 只在影响长期路线且谈话不足时做轻量诊断；
- 公开 Roadmap 提案；
- 等待学生明确确认；
- 使用窄结构化写入原子创建 ROADMAP.md。

它不创建首个 Plan、不搜题、不备课，也不把一次临时提问扩张成长期目标。ROADMAP.md
创建后，独立的 Roadmap Session 才讨论第一个 Plan。

当前 roadmap-dialogue 中“初次 Roadmap 会面”与“首个 Plan”混在同一 Session 的部分，
在 M1b.2 拆开：长期方向诊断进入 Meta，Roadmap 的空 Plan Tree 分支只制定首个 Plan。

### 4.2 Light Lesson Session

Light Lesson 是第四种文档节点类型 light-lesson。它复用 Tutor、教学技巧、日志与 M1a
记忆核心，但没有 Plan 父级。

建议持久位置为：

~~~text
light-lessons/light-lesson-001.md
~~~

Light Lesson 持有：

- Classroom Log；
- 本次绑定和保存的资产链接；
- Consolidated Learning Traces；
- 学生安全的 Session Summary；
- Runtime 绑定的 Pi Session 与生命周期。

它明确没有：

- Plan 父级与课程树挂载；
- Lesson Goal；
- Blocks；
- Teacher Control；
- 备课状态和 Plan 进度。

它可以源于一次随口提问、重新打开题卡、概念讨论、短诊断或学生拿来的一道题。时长不决定
它是否为轻量课；只要师生没有建立 Plan 承诺，它便保持 Light Lesson。

Light Lesson 不直接加载现有 block-based tutor-lesson 根 Skill。它使用独立的
tutor-light-lesson 路由 Skill，复用同一 Tutor 角色、教学核心和七个教学技巧 reference，
但只保留轻量课的证据边界、日志、资产保存、收口与记忆路线。正式 Lesson 继续只加载
tutor-lesson。这样模型不会同时受到“寻找 active Block”和“本 Session 没有 Block”两组
冲突指令，也不需要为两种课堂维护两份讲解技巧。

## 五、M1b 分阶段实施

统一设计分为四个独立验收闭环：

### M1b.1：个人学习集从空白生长

- 没有 ROADMAP.md 也能打开学习集；
- 开启 Light Lesson；
- 保存 Note、Flashcard 与个人题卡；
- 记录题卡作答与答案查看；
- 建立平坦标签和派生邻居图；
- Light Lesson 收口后进入 M1a 记忆；
- 学生重新打开资产并带着新作答再次问老师。

### M1b.2：Meta Session 让课程结构诞生

- 从学习集根开启 Meta Session；
- 商议并确认 Roadmap；
- Meta 只创建 ROADMAP.md；
- Roadmap Session 再商议首个 Plan；
- 清除现有首次 Roadmap 与首个 Plan 的职责重叠。

### M1b.3：原始资料逐步长成资产

- 上传并保留原始资料；
- 根据真实学习需要逐段蒸馏；
- 生成带来源的题卡、Note、Flashcard 与标签；
- 不要求一次性处理完整本书。

### M1b.4：复用、导入与分享

- 导入他人的可复用资产与词表；
- 不导入对方的个人资产、作答、课堂或记忆；
- 个人资产只有经过学生确认和单独泛化后才发布；
- 图谱和召回索引在本地重建。

第一份实施计划只落地 M1b.1。后三个阶段在同一架构下分别设计实施计划，不把独立系统
一次绑死。

## 六、真正空白的学习集

当前 Runtime 把 ROADMAP.md 当成学习集存在的证明，NodeKind 也只有 roadmap、plan 和
lesson。这阻止了一个没有课程树的学习集工作。

M1b 将“根目录识别”和“课程是否存在”拆开：

- LEARNING_GUIDE.md 继续作为现有学习集根标志和教学契约资源；
- ROADMAP.md 变为可选教学事实；
- LEARNING_GUIDE.md 不是 Session 所有者；
- 个人资产、特征词表和原始资料目录都在第一次真实写入时懒创建；
- .studyforge 仍只保存 Runtime 状态，不承担教学语义。

M1b.1 中最小学习集可以只有：

~~~text
LEARNING_GUIDE.md
memory/
  INDEX.md
~~~

M1b.1 只显示已经实现的“问老师”“我的学习资料”和“最近的轻量课”。M1b.2 完成后再增加
“规划一下怎么学”的 Meta 入口。已有 ROADMAP.md 的学习集继续显示现有课程区域。

## 七、个人资产及其边界

个人资产是学生可见、可修改、可导出和可继续使用的外化认知。它们既不是公开教学资产，
也不是隐藏教师记忆。

建议持久位置为：

~~~text
personal/
├── notes/
├── flashcards/
└── problems/
~~~

### 7.1 Note

Note 持有：

- 标题和正文；
- core 与 related 标签；
- 零个、一个或多个 based_on 资产引用；
- Runtime 绑定的创建 Session、稳定 ID、时间、revision 与 provenance。

它不持有掌握判断、能力结论或教师画像。

### 7.2 Flashcard

Flashcard 持有：

- 正面和背面；
- core 与 related 标签；
- 零个、一个或多个 based_on 资产引用；
- Runtime 权威字段。

M1b.1 不引入间隔重复算法、SM-2、掌握等级或复习排程。Flashcard 首先是一份可主动翻面的
个人资料。

### 7.3 教师题卡

教师题卡是题目事实的唯一所有者：

- 题干；
- 学生作答后可以查看的标准答案或规范书面解答；
- 不直接投影给学生的教师讲解依据；
- core 与 related 特征标签；
- 原始资料或课堂来源；
- 稳定 ID 和 revision。

教师讲解依据只保存对该题可复用的数学或教学信息。这个学生当时的具体错误、实际帮助与
后续表现继续属于 Session Log、Trace 和对象记忆，不提升成题卡的通用事实。

现有 highschool-study.problem-card.v1 完整题卡继续受支持。课堂临时产生的新题使用更薄的
教师题目资产形状，不要求模型当场填写现有约 9 KB 的完整教学卡字段。召回适配器把两种
形状投影到同一资产索引。

### 7.4 个人题卡

个人题卡只持有：

- 教师题卡稳定引用；
- 学生自己的笔记；
- Runtime 权威字段。

题干、标准答案、教师讲解和标签都不复制。学生投影从教师题卡读取题干，在满足作答条件后
读取标准答案，从个人题卡读取学生笔记；教师讲解依据永不进入学生 API。

临时新题被学生确认保存时，一次调用原子创建私有教师题卡和个人投影。私有教师题卡只在
当前学习集内可复用，不自动公开。

## 八、明确来源与派生邻居

Note 或 Flashcard 可以是独立遐想，也可以依赖一道或多道题。

唯一持久的来源方向是：

~~~text
Note / Flashcard ── based_on ──→ 教学资产
~~~

based_on 为空表示独立内容；一个引用表示从一道题提炼；多个引用表示比较或归纳多道题。
反向的“题卡有哪些 Note”由索引生成，不在题卡内双写。

Runtime 总是绑定 created_in Session，但 created_in 与 based_on 是不同事实：一份 Note
可能在当前课堂创建，却综合了多道旧题。

Note 自己持有标签，不自动继承来源题卡的全部标签。独立 Note 可以通过标签邻居找到相关
题目，但这种相关性仍是派生边；只有师生明确认为内容依赖某题时，才写 based_on。

若 Note 明确依赖当前讨论中的临时题，而该题尚无稳定资产，保存事务先创建最小教师题卡，
再建立 Note 引用。它不会顺便创建个人题卡，除非学生另外确认保存题卡。

## 九、平坦特征标签

新资产只使用两个相对于该资产的权重层次：

- core：没有这些标签便难以说明资产的主要内容；
- related：确实相关，但不是资产主要辨识特征。

一个资产可以有多个 core，不要求唯一 primary。标签不再被强迫归入 goal、method、
structure，也不要求保留旧 BKT 所需的 primary、secondary 或 subroute 挂载点。

Tutor 提供人类可读的标签。Runtime：

- 解析已知别名；
- 阻止同一标签在 core 与 related 中重复；
- 为 Tutor 明确提出的新词建立稳定身份；
- 维护动态 features/vocabulary.yaml；
- 不根据正文自行发明语义标签。

现有冻结的 graph/vocabulary.yaml 与 519 张旧题卡保持不动。兼容投影把旧卡的
goal.primary、分问 goal、method.primary、method.secondary、method.subroute、
structure.primary 与 structure.secondary 全部拍平成标签；不延续当前 recall index 漏掉
method.subroute 的行为。各轴 primary 与分问 goal 投影为 core，secondary 与 subroute
投影为 related；重复词去重，源文件不回写。新旧词表在查询视图中合并。

对象记忆使用一个平坦的 about_tags 列表连接同一词表，不再区分 core 与 related。标签由
Tutor 在新建对象或本次证据确实改变对象语义边界时，通过记忆提交明确给出；Runtime 只做
别名解析和稳定引用。既有 M1a 对象允许暂时没有 about_tags，不根据标题、Trace 或相邻资产
自动补标签；它们在后续真实课堂再次更新时逐步进入图谱。第一次带标签的资产或对象写入时
创建 features/vocabulary.yaml。

## 十、语义关系图

第一阶段图谱的显式节点包括：

- 标签；
- 教师资产；
- 个人资产；
- 对象记忆。

显式持久边只有：

- 资产具有 core 标签；
- 资产具有 related 标签；
- 对象记忆讨论哪些标签；
- Note / Flashcard based_on 哪些资产。

以下关系全部派生：

- 标签共现邻居；
- 共享标签的相似资产；
- 题卡的反向 Note / Flashcard；
- 对象记忆可能关联的教学资产；
- 学生资料与教师资产的语义邻居。

core 共现可以比 related 共现具有更高召回权重；高频、低区分度词可在排名时降权。这些
分数只影响投影排序，不进入资产正文。

模型召回走短路线：

~~~text
精确标签组合
→ 数量不足时扩展一跳标签邻居
→ 达到调用者要求的数量后停止
~~~

这延续现有 Scout 的“找到所需数量的合格项即可”原则，不为寻找全局最优遍历题库。

共现不自动升级为先修、因果、对照或易混淆。若未来教学行为确实依赖这些关系，再由教师
确认后保存为单独的语义边。学生与标签相关也不生成“掌握”边；对象记忆继续持有有来源的
自然语言判断。

M1b.1 使用可由 read/grep 读取的薄索引和 tag-neighbors 投影，不新增 recall 工具，也不
引入图数据库。

## 十一、分读者索引与渐进式披露

共享标签语义不意味着把所有内容放进同一索引。系统保留三个不同读者入口：

1. memory/INDEX.md：教师记忆的常驻导航，只放认知前沿、明确偏好和对象入口；
2. 教学资产索引：来自教师题卡与材料，供 Scout、Coach 与获准的 Tutor 使用；
3. 个人资产索引：来自 Note、Flashcard 和个人题卡，供学生界面与当前 Tutor 使用。

Scout 只获得教学资产索引，不接触个人笔记、作答或教师记忆。学生索引不包含教师讲解
依据。需要跨层图谱时，Runtime 根据当前读者权限临时连接，不持久化一份混合私有内容的
总表。

Session 上下文按以下顺序披露：

~~~text
当前 Session 文档
→ 当前绑定资产
→ 常驻 memory/INDEX.md
→ 眼前教学动作确实需要时，才沿标签或记忆链接下钻
~~~

资产索引不常驻模型上下文。从题卡进入 Light Lesson 时，只注入当前教师题卡的允许视图、
个人笔记、最近作答和答案查看状态；从自由讨论进入时不预先搜索整个学习集。

## 十二、三个窄语义写入

Tutor 不使用原生 write/edit 猜 ID、路径和引用，也不获得一个字段庞杂的通用资产 CRUD。
M1b.1 提供三个窄动作：

- save_note；
- save_flashcard；
- save_problem_card。

这些动作只在正式 Lesson 或 Light Lesson Tutor 中出现。Meta、Roadmap、Plan 与 Scout
不得调用。

模型负责不可约语义：

- 学生可见内容；
- 标准答案与教师讲解依据；
- core / related 标签；
- 无法从当前绑定推断的 based_on 短别名；
- 学生个人笔记。

Runtime 负责：

- 学习集、学生、Session 和当前资产绑定；
- 稳定 ID、路径、时间、revision 与 provenance；
- 已知标签别名和短资产别名解析；
- 来源引用与读者隔离校验；
- 多文件原子事务；
- 同一 toolCallId 的幂等；
- 成功回执与投影重建。

现有 lesson_memory_commit 在 M1b.1 扩展对象的 about_tags 语义输入。正式 Lesson 与
Light Lesson 共用这一字段；模型只提交标签词语，不提交图节点 ID 或边。没有新对象判断的
课堂不为图谱完整性强行更新对象。

Skill 的唯一批准门是：

~~~text
形成值得保存的内容
→ Tutor 用普通教师语言提出保存建议
→ 学生明确确认
→ 调用一个窄写入动作
→ 成功后才说已经保存
~~~

“嗯、可以、存一下”可以构成确认；沉默、继续做题或离开页面不能推断为批准。

学生在资产页直接编辑自己的 Note 或 Flashcard 时，由当前资产绑定的 Runtime API 处理，
不唤醒 Tutor，也不要求模型填写路径。

## 十三、题卡交互记录

重新打开题卡并不自动启动 Light Lesson，也不把历次作答追加进题卡正文。原始交互由独立、
只追加的记录持有，建议位置为：

~~~text
activity/problem-attempts/<personal-problem-id>.md
~~~

它记录：

- 稳定事件 ID；
- 个人题卡与教师题卡稳定引用；
- 学生实际提交的内容，或明确选择“不会”；
- Runtime 时间；
- 本次作答对应的教师题卡 revision；
- 标准答案在这次作答之前是否已经查看；
- 随后开启的 Light Lesson 引用，若存在。

Runtime 不写对错、掌握、能力、偏好或教学结论。答案查看本身也不是学习效果证据。

学生可以：

~~~text
打开个人题卡
→ 查看题干与个人笔记
→ 提交作答，或明确选择“不会，直接看答案”
→ Runtime 追加原始事件
→ 查看标准答案
→ 直接离开，或点击“问老师”
~~~

点击“问老师”时，新建或恢复绑定该资产的 Light Lesson，只提供当前题卡、个人笔记、
最近作答和答案查看状态。Tutor 的判断写入 Light Lesson Log。课末对象记忆可以同时引用
原始作答事件和课堂 Log。

没有进入 Tutor 的作答仍被保留，但只是原始学习痕迹，不自动升级为长期认知判断。

## 十四、Light Lesson 日志、收口与记忆

Light Lesson 复用现有 classroom_log_append 的语义动作：

- 正式 Lesson 中，Runtime 把 Log 绑定到当前 active Block；
- Light Lesson 中，Runtime 把 Log 直接追加到 Session，并分配稳定条目 ID。

不为 Light Lesson 伪造 Block。M1a 记忆提交内部抽出共同的 Teaching Session Evidence
核心：

- 正式 Lesson 使用真实 Block 证据；
- Light Lesson 使用真实 Log 条目和可选原始作答事件；
- 对象判断、偏好、Trace、路由与原子事务继续复用。

资产和 Log 在教学过程中即时落盘。对象记忆只在学生确认收口后固化，避免同一课堂在当前
Session 中既以完整对话存在，又被展开为一份重复的详细记忆。

收口亮线为：

~~~text
教学与检验
→ 需要的资产即时保存
→ Tutor 在自然完成点询问继续还是收口
→ 学生确认
→ 固化 Trace 与对象记忆
→ 写 Session Summary
→ 关闭 Light Lesson
~~~

学生直接离开时，Runtime 不用超时猜测“已经学完”。Light Lesson 保持未收口并可恢复；
它不阻塞学生另开问题，但在真正收口前不进入长期对象记忆。

## 十五、对象记忆的读者边界

对象记忆的首要读者是未来的 Tutor、Coach 和 Roadmap。它不是为学生界面编写的学习报告。

它可以保存：

- Current Judgment；
- Evolution Overview；
- Boundaries / Not Yet Demonstrated；
- Trace Timeline；
- 暂定能力信号和需要未来证据检验的教师假设。

这些内容继续独立存在，因为它们服务于下一次教学判断。学生有权回看来时路，但不直接读取
教师内部 Markdown。

学生的“学习足迹”从学生安全来源派生：

- 正式 Lesson Summary；
- Light Lesson Session Summary；
- 学生自己的作答；
- 保存或修改的个人资产；
- 时间、标签与来源 Session。

对象记忆只帮助系统把这些来源路由到同一条认知流变。每一项学生足迹都能回到真实课堂、
作答或资产，而不是展示脱离证据的能力标签。

学生直接问“我最近进步在哪里”时，Tutor 可以读取对象记忆和来源，在对话中区分已证实
变化、暂定判断和仍待检验边界。这次解释不另存为第二份“学生版对象记忆”。

## 十六、可修改资产、不可改写经历、可重建图谱

纠错遵守三种不同生命周期：

1. Note、Flashcard、题卡正文、标签与 based_on 是当前资产，可以修正并增加 revision；
2. Classroom Log、原始作答和 Consolidated Trace 是历史事实，只追加纠正，不回写旧条目；
3. 召回索引、反向链接、邻居和知识图谱是投影，源事实变化后直接重建。

教师题卡修正时保持稳定 ID。旧作答记录保留当时的 source revision，不能用后来修正的答案
倒推学生当时的表现。

M1b.1 只提供归档，不提供破坏历史引用的硬删除。被引用资产归档后保持可追溯；学生默认
列表可以隐藏它，历史 Session 与事件仍能解析来源。

语义重复不由 Runtime 猜测。两份相近 Note 可以同时存在；只有同一 toolCallId 重试被视为
机械重复。个人题卡对同一教师题卡已有投影时，Runtime 返回现有投影供继续编辑，不创建
第二份壳。

## 十七、原子性与派生失败

以下事实必须同一次提交成功或全部不发生：

- 新教师题卡；
- 个人资产；
- based_on 与 provenance；
- 新标签词条；
- 当前 Session 的 Saved Assets 链接。

任一真实引用不存在、越权、指向错误资产类型或发生 revision 冲突时，提交不留下孤立文件。
Tutor 只有收到成功回执后才能公开声称资产已保存。

召回索引和邻居图不属于 canonical transaction。若重建失败：

- 真实资产保持成功；
- 回执明确返回 projection stale；
- 当前对话使用回执中的稳定资产入口；
- 后续读取或维护任务可从 canonical 文件重新生成投影。

这种失败不允许模型用目录扫描猜测修复，也不允许为了索引完整回滚学生刚确认保存的内容。

## 十八、M1b.1 学生体验

无 ROADMAP.md 时，学习集首页显示：

- 问老师；
- 我的学习资料；
- 最近的轻量课。

已有 Roadmap 时，现有课程区域继续存在，不把 Light Lesson 插入 Roadmap → Plan → Lesson
树。

Light Lesson 允许学生直接输入自然问题，不要求先选知识点或填写目标。保存成功后，Note、
Flashcard 或题卡以可点击资产卡片内联返回。

“我的学习资料”提供：

- Note 阅读与编辑；
- Flashcard 正面与主动翻面；
- 题卡题干、个人笔记和作答区；
- 作答或明确选择不会后查看标准答案；
- 从资产页带上下文“问老师”；
- 以类型、最近使用和标签浏览。

标签是学生可理解的导航词，不展示内部边类型、召回分数或教师记忆字段。

## 十九、兼容现有 M0 / M1a

必须保持：

- 已有 Roadmap、Plan、Plan-local Lesson Tree 与正式 Session 生命周期；
- 正式 Lesson 的 Block、Uses、Teacher Control 和课堂证据边界；
- M1a memory/INDEX.md、对象文件、偏好、Trace 与原子 lesson_memory_commit；
- 现有 519 张完整题卡及其 graph/vocabulary.yaml；
- Scout 只能检索获准教学资产；
- 旧学习集不需批量迁移即可运行。

M1b.1 的兼容适配发生在读取与索引层。旧题卡可以继续产出现有
graph/card-recall-index.tsv，也能被新特征投影读取。新资产不再反向填充旧
goal/method/structure 字段。

## 二十、M1b.1 验收

### 20.1 确定性测试

1. 只有 LEARNING_GUIDE.md 与 memory/INDEX.md 的学习集可以启动。
2. roadmap、plan、lesson 行为不回归，light-lesson 作用域与课程树隔离；两种 Tutor
   Session 只加载各自根 Skill，共享技巧文件而不共享冲突的 Block 路由。
3. Light Lesson 无 Plan 父级、无 Blocks，仍可写 Log、资产、Trace 与 Summary。
4. 三个窄保存动作验证确认后的正常路径、无效引用、原子失败和幂等重试。
5. 学生投影不含教师讲解依据；Scout 不可读取个人索引与记忆。
6. Note 的零个、一个与多个 based_on 均可解析；反向边只由投影生成。
7. 旧题卡能拍平成 core/related 查询视图，新标签能动态加入词表。
8. 精确标签召回、单跳邻居和达到所需数量后停止均可重复验证。
9. 题卡作答、明确不会、答案查看、source revision 与 Light Lesson 绑定正确。
10. 对象记忆在收口后生成；未收口 Session 不被超时伪造为已完成。
11. 资产修订后索引可重建，旧事件仍指向当时 revision。
12. 故障注入证明 canonical transaction 无半套写入，projection 失败不丢资产。

### 20.2 前端闭环

~~~text
空白学习集
→ 自然提问并进入 Light Lesson
→ 确认保存 Note 与题卡
→ 自然收口并形成对象记忆
→ 重启应用
→ 从“我的学习资料”打开题卡
→ 独立作答并查看标准答案
→ 带着本次作答再次问老师
→ 新 Light Lesson 获得正确上下文
~~~

页面必须同时证明：

- 未保存前没有资产；
- 成功回执后资产立即可达；
- 教师内容未泄漏；
- 未收口 Light Lesson 可恢复；
- Light Lesson 不污染课程树；
- 标签邻居能找到相关内容但不展示“已掌握”。

### 20.3 真实模型验收

使用表达自然、不会主动说系统术语的学生情境。学生可以模糊地问一个具体问题，不主动要求
系统调用工具、创建标签或写记忆。验收最终结果：

- Tutor 没把普通问题扩张为 Roadmap 或 Plan；
- 没为了产资产打断教学；
- 只有内容真正值得保留时才提出保存；
- 学生确认前没有写入；
- Note 与标签抓住了讨论要害；
- 二次 Light Lesson 正确使用原题、个人笔记、最近作答与相关对象记忆；
- 没把标签相关、看过答案或提示后完成说成掌握；
- 全程记录模型调用、工具调用和阶段耗时；
- 保存、索引和图谱构建都是本地机械工作，不触发 Scout 或额外模型检索。

### 20.4 回归基线

在现有导数学习集上回归：

- 课程树、正式课堂、M1a 记忆和旧题卡召回继续工作；
- 不要求改写 519 张卡；
- 新个人资产和 Light Lesson 可以与旧课程并存；
- 教师、学生和 Scout 三种投影继续遵守各自证据边界。

## 二十一、M1b.1 非目标

第一阶段明确不实现：

- Meta Session 与首个 Roadmap 的物化；
- 书籍/PDF 的自动蒸馏；
- 导入、发布、社区分享或权限市场；
- 间隔重复排程和记忆算法；
- BKT、掌握分数或统一能力等级；
- 图数据库、embedding 服务或新 recall 工具；
- 先修、因果、易混淆等持久语义边；
- 自动合并语义相近资产；
- 破坏引用的硬删除；
- 把 Light Lesson 中途转换为正式 Lesson。

这些边界不否认 M1b 的整体方向，只确保第一份实施计划能够以完整学生闭环验收。

## 二十二、最终决策摘要

1. 学习集是载体；Meta、Roadmap、Plan、Lesson 分别设计自己的直接子层。
2. M1b.1 先实现“空白 → Light Lesson → 个人资产 → 记忆 → 再使用”。
3. Note、Flashcard 和个人题卡是个人学习资产，不是教师记忆。
4. 教师题卡持有题干、答案、教师讲解与标签；个人题卡只持有引用和学生笔记。
5. 原始作答由独立追加记录持有，不塞进题卡，也不自动形成掌握判断。
6. core / related 平坦语义标签取代新资产中的 goal / method / structure 强制分类。
7. based_on 保存明确内容依赖；标签邻居表达派生相关。
8. 关系图与索引可重建，并按教师、学生、Scout 读者边界分开。
9. 三个窄写入让模型负责语义，Runtime 负责身份、引用、原子性和投影。
10. Light Lesson 由 Tutor 提议、学生确认后收口；资产和 Log 即时保存，长期记忆课末固化。
11. 对象记忆首先服务教师判断；学生来时路从真实学生安全来源派生。
12. 当前资产可修订，历史经历不可改写，图谱随源事实重建。
