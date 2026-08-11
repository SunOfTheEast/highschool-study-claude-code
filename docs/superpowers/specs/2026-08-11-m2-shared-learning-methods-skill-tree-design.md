# M2 共享学习方法 Skill 树设计

**状态：** 已讨论定稿，等待用户复核

**日期：** 2026-08-11

**适用范围：** `apps/pi-teaching-web` 的 Free Learning 与 Lesson Tutor

**相关设计：** `2026-08-11-m2-shared-brainstorming-and-paper-research-design.md`

## 一、目标

M2 需要补充学习方法，但不应按教育术语新增一批顶层 Skill，也不应为 Free Learning 与
Lesson 复制两套相似流程。本设计沿用当前 Session 专属 Skill 树：常见教师动作留在既有根
Skill，共享且足以改变一段学习活动形状的方法成为按需 reference，课堂专属技巧与备课模板
保持原位。

本设计只整理以下能力：

- 帮助学生形成和生成问题；
- 用自己的语言重建并组织知识；
- 系统比较概念、结构与类比边界；
- 检验或明确驳斥不准确的概括；
- 在不先看原文的情况下进行检索练习。

头脑风暴已经由独立设计定稿，本设计只说明它在同一分支中的位置，不重复定义论文研究或
四路信息源。

## 二、沿用现有 Skill 树

当前 Runtime 按 Session 装载根 Skill：Free Learning 只装载 `free-learning/SKILL.md`，
Lesson 只装载 `tutor-lesson/SKILL.md`。现有 reference 有两种位置：

1. 只服务一个节点的内容放在该根 Skill 下，例如
   `tutor-lesson/references/teaching-techniques/`；
2. 被多个节点共同读取的内容放在 `skills/references/`，例如现有的
   `skills/references/plan-cycles/`。

共享学习方法采用第二种，不注册为新的顶层 Skill：

```text
apps/pi-teaching-web/resources/skills/
├── free-learning/
│   └── SKILL.md
├── tutor-lesson/
│   ├── SKILL.md
│   └── references/
│       └── teaching-techniques/       # 现有 Lesson 专属技巧
├── prepare-approved-lesson/
│   └── references/
│       └── lesson-templates/          # 现有备课模板
└── references/
    ├── plan-cycles/                   # 现有跨节点 reference
    └── learning-methods/
        ├── INDEX.md                   # 只供打包检查与人工审计
        ├── brainstorming.md
        ├── knowledge-reconstruction.md
        ├── structural-comparison.md
        ├── claim-challenge.md
        └── retrieval-practice.md
```

两个根 Skill 根据学生当前表现直接读取一个精确文件，不先读取 `INDEX.md` 分类。reference
只拥有学习方法，不复制 Session 权限、Lesson Goal、资产确认、记忆证据或生命周期规则。

## 三、常驻能力：帮助学生形成问题

现有系统提示与 Tutor 核心循环已经默认采用苏格拉底式循序推进：理解学生当前表达，选择
一个成比例的追问、提示或讲解，再观察下一次回应。它不是新的按需学习方法，不新增
`socratic-guided-discovery.md`。

在 Free Learning 与 Lesson 都会常驻读取的 `resources/teaching/math-teaching-core.md` 中补一段
紧凑原则：

- 学生只有模糊困惑时，帮助他逐渐定位对象、矛盾、前提或边界，形成自己的问题；
- 学生面对材料却不知道能问什么时，可以从异常、联系、条件或反例中帮助他主动生成问题；
- 问题已经清楚时直接进入讨论，不为展示苏格拉底法继续反问；
- 缺少不可自行推出的事实时先补充事实，不把“不知道”变成猜老师心思。

这项能力由现有共享教学核心常驻，不放进按需 reference，也不在两个根 Skill 中重复。它同样
可以帮助 Roadmap 与 Plan 会话理解学生尚未说清的学习问题，但不能成为继续盘问的理由。
Coach 仍可在需要时把形成问题安排成一个完整 Block，但这不是 Tutor 使用它的前置条件。

## 四、共享按需方法

### 4.1 `brainstorming.md`

沿用已定稿的共享头脑风暴设计。它负责从当前锚点共同发散和建立联系，不负责把其中一条
联系研究到底。Free Learning 与 Lesson Tutor 都直接路由到同一文件。

### 4.2 `knowledge-reconstruction.md`

当学生需要把零散认识重新组织成自己的解释时使用。普通的一句“为什么”仍由常驻教学
循环处理；只有活动明显进入重建一个概念、推导或知识结构时才读取。

亮线：

> 选定对象或关系 → 学生先按自己的理解重建 → 教师指出真正的缺口、矛盾或断点 → 学生
> 重新组织 → 用一个例子、边界或应用校验

允许两种模式：

- **开卷重组：** 可以查看题目、Note 或 Material，目标是形成更好的知识结构；
- **脱离材料重建：** 先收起现成解释，目标同时包含检索与理解检查。

教师必须保留是否查看材料与实际帮助的边界。共同整理出的漂亮解释不是独立掌握证据；是否
保存为 Note 继续走现有资产确认流程，不是本方法的固定产出。

### 4.3 `structural-comparison.md`

当师生准备围绕两个或少量对象系统研究共同机制、决定性差异和类比边界时使用。它不同于
现有 `method-comparison.md`：后者只在学生已经完成并核验一条解题路线后比较方法，本方法
可以比较概念、现象、表示、结构或模型，也不要求先出现错误。

亮线：

> 明确比较对象 → 学生先说自己看到的联系 → 找共同机制 → 找改变判断的决定性差异 → 检查
> 类比失效的边界 → 把区别用于一个新判断

不以生成穷尽的“相同点/不同点”表为目标。头脑风暴发现可能的联系；结构比较只把其中一条
联系研究清楚。普通的一次对照仍由教师自然完成，不必读取本文件。

### 4.4 `claim-challenge.md`

当学生或教师已经形成一句值得检验的猜想、概括、因果解释或选路规则时使用，尤其适用于
学生把少量成功经验过拟合成普遍规律的情况。

亮线：

> 准确复述当前概括 → 保留局部成立的经验 → 找出被扩大或遗漏的条件 → 选择一个最有区分力
> 的情形 → 让学生预测并检验 → 修订原来的说法

允许两种力度：

- **共同检验：** 结论尚不确定，师生一起寻找边界、极端情况或反例；
- **明确驳斥：** 教师已经能够确认概括不成立，直接说明错误范围，再用一个决定性反例或
  推导帮助学生定位失效原因。

驳斥针对命题，不否定学生本人；一个决定性反例通常已经足够。反例之后要形成更准确的
说法，不能只留下“这题特殊”。本方法不常驻成教师固定唱反调的姿态。

### 4.5 `retrieval-practice.md`

当学生主动要求复习，教师在当前情境中建议回忆，或未来 Runtime 提供的到期候选被学生接受
时使用。它决定“拿出来以后怎样复习”；日历和资产级复习排程只决定“什么现在值得拿出来”。

亮线：

> 先脱离原文回忆 → 保留第一次表现 → 再反馈或局部教学 → 换一个位置重新提取

任务可以是解释概念、辨析边界、回忆方法进入信号、完成决定性步骤或处理一条相关新题。
看到材料后重新组织属于 `knowledge-reconstruction.md`；未看材料的首次提取属于本方法。
到期不等于已经遗忘，当场重新答对也不证明长期保持。

当前方法可以先支持学生主动发起和教师现场建议，不依赖日历。未来时间系统只增加触发来源，
不重写教学流程。现有 `review-spaced-retrieval.md` 继续负责一整节正式复习课的备课形状。

## 五、两个 Session 如何挂载

### 5.1 Free Learning

`free-learning/SKILL.md` 保留自由转向和无需预设目标的边界，并按可观察状态直接路由：

- 明确想发散或建立联系 → `brainstorming.md`；
- 想把零散认识重新讲清或组织起来 → `knowledge-reconstruction.md`；
- 想系统研究几个对象的共同机制与边界 → `structural-comparison.md`；
- 已经提出值得检验或需要驳斥的概括 → `claim-challenge.md`；
- 明确想脱离原文回忆或接受一次复习建议 → `retrieval-practice.md`。

这些方法不强制形成目标、总结、资产或结课仪式。

### 5.2 Lesson Tutor

`tutor-lesson/SKILL.md` 在“根据学生的真实回应教学”之后增加同一组直接路由。方法不必预先
出现在 Teacher Control；若备课已经安排相关活动，Teacher Control 仍提供具体材料、目标和
预判。Tutor 使用方法时继续服从现有 Lesson Goal、证据范围、帮助边界和小幅可逆调整。

现有根 Skill 已经要求一轮只承担一个主要教学动作，因此不再为共享方法增加固定轮数、文件
数量或新的互斥状态机。一次方法可以自然持续多轮，学生的下一次回应仍决定继续、切换或停止。

## 六、保持不动的节点

- `tutor-lesson/references/teaching-techniques/` 保留概念边界修复、挫败与暂停、独立迁移
  检查和解题方法比较；它们是 Lesson 专属窄技巧，不迁入共享分支。
- `prepare-approved-lesson/references/lesson-templates/` 继续负责诊断、概念建构、刻意练习、
  修复、验收、阶段整理与延迟复习的整节课形状。
- Peer 没有独立 Session 或学习事实所有权，不给 Peer 复制一套方法 Skill。教师可以在已经
  选择某种学习方法后邀请 Peer 参与，Peer 回复仍只是公开教学帮助。
- 不修改课程、资产、对象记忆、语义索引或 Session durable schema。
- 不因使用某种方法自动调用 `save_note`、`save_problem_card` 或记忆提交。

## 七、实现改动面

后续实现计划只需要：

1. 在现有 `math-teaching-core.md` 增加紧凑的问题形成原则；
2. 新增 `learning-methods/INDEX.md` 与四个剩余方法 reference；
3. 复用头脑风暴设计将 `brainstorming.md` 放入同一目录；
4. 在 `free-learning/SKILL.md` 与 `tutor-lesson/SKILL.md` 增加精确路由；
5. 增加共享 reference 的打包检查、根 Skill 路由检查和真实模型行为验收。

头脑风暴的 Paper Research Scout、工具、进度投影与失败降级仍由其独立实施计划负责。本设计
不提前实现日历、到期队列或资产级间隔算法。

## 八、验收重点

真实模型验收至少覆盖：

1. 学生只有模糊感受时，教师逐渐帮助形成问题；问题已经清楚时不继续盘问。
2. 学生会做但理解零散时，教师让学生自己重建，不代写一份漂亮总结。
3. 比较 Ksp 与一般平衡常数时，教师找到共同机制和决定性边界，不只列相同点与不同点。
4. 学生把局部经验概括成普遍规则时，教师敢于明确驳斥，并帮助形成修订后的说法。
5. 学生主动要求复习时，教师先保留无提示的首次提取，再反馈和重新检验。
6. 普通问答、单次对照或简单纠错不为展示方法而膨胀成完整流程。
7. Free Learning 可以自由转向；Lesson 使用同一方法时仍守住当前 Goal 与证据范围。
