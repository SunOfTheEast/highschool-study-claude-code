# StudyForge M0 文档原生记忆消融设计

**状态：** 已确认

**日期：** 2026-08-02

**实施路线：** 保留成熟的 Pi 与前端外壳，重写最小教学内核

## 1. 背景与判断

StudyForge 已经证明 Roadmap → Plan → Lesson 的三级课程组织、独立
Session 和 Markdown-first 课堂可以成立。当前主要问题不是总体方向错误，
而是长期迭代把太多派生机制叠加在了一条教学链路上：

- 独立 Trace 与聚合投影；
- Lesson / Plan Handoff 和 Claim；
- 学生画像、教学画像和 Planner Attention；
- BKT 与能力节点；
- Context Frame、来源解析和细粒度访问范围；
- 面向学生的安全投影；
- 多组专用写入工具及其调用顺序。

这些机制分别都有解释，但叠加后出现了重复语义、上下文污染、工具参数错误、
投影陈旧和不自然话术。系统花费大量复杂度保护低概率边界，反而影响了最常见的
备课和上课流程。

因此不继续局部修补，而是建立一个可观察的 M0 基线：

> 保留三级课程树和课堂 Block，把课堂事实直接写在发生它的 Lesson Block
> 中；父节点需要信息时直接读取原始 Markdown，不再依赖任何派生记忆。

这不是字面回退到 v0.1.0。早期版本本身已有 Trace、Summary 和画像，同时缺少
后来已经成熟的 Pi Session 与前端。M0 选择保留成熟外壳、重写教学内核。

## 2. 目标

M0 要回答一个简单问题：

> 在单人本地学习场景中，仅依靠节点自己的 Session、Block 内课堂事实和父节点
> 对原始文档的直接读取，能否已经完成稳定、自然、连续的个性化教学？

具体目标：

1. 保留 Roadmap → Plan → Lesson 的课程周期控制。
2. 保留每个节点独立且可恢复的 Pi Session。
3. Lesson 继续以 Block 为课堂编排和运行单位。
4. 所有课堂事实原位追加到对应 Block。
5. 父 Agent 使用普通 Read 读取子节点，不经过摘要、投影或上下文编译。
6. 保留已经验证有效的教学提示词能力。
7. 删除旧记忆系统对新运行路径的全部影响。
8. 通过真实多 Lesson 周期决定后续哪一层记忆值得重新加入。

## 3. 非目标

M0 不做以下事情：

- 不兼容旧版学习集格式；
- 不迁移旧 Trace、Handoff、画像或 BKT；
- 不建立数据库、向量库或后台索引；
- 不提供复杂权限、审批门和来源白名单；
- 不用前端安全投影修正 Agent 的表达；
- 不预先解决数百节课后的容量问题；
- 不同时重写 Claude Code 插件；
- 不为尚未在真实课堂出现的边角情况增加状态机；
- 不进行论文式教学有效性实验。

## 4. 学习集结构

M0 学习集结构如下：

~~~text
learning-set/
├── LEARNING_GUIDE.md
├── ROADMAP.md
├── plans/
│   └── plan-001.md
├── lessons/
│   └── lesson-001.md
├── cards/
├── graph/
└── materials/
~~~

其中：

- LEARNING_GUIDE.md 是学习集专属的教学原则；
- cards、graph、materials 是静态教学资产；
- 它们都不是学生记忆；
- 不再创建 memory/ 和 traces/。

## 5. 三层文档职责

### 5.1 ROADMAP.md

只保存：

- 学习集概述；
- 长期目标；
- 可观测能力标准；
- 测试方式；
- Plan 编排；
- 当前结构位置。

Roadmap Agent 可以读取已完成 Plan 和其 Lesson，但只把后续 Plan 编排写回
ROADMAP.md，不复制课堂总结。

### 5.2 plan.md

只保存：

- 阶段目标；
- 可观测能力标准；
- 测试方式；
- Lesson 编排、顺序和依赖；
- 当前结构位置的节点指针；
- 下一节课的安排。

Planner 读取 Lesson 后，可以改变未来课程设计，但不把 Lesson 表现重新总结进
plan.md。

子节点状态只以子节点 frontmatter 为准。父文档中的 Tree 保存链接、顺序和
依赖，不复制一份 prepared / active / closed 状态；前端需要状态时直接读取
子文件。

### 5.3 lesson.md

同时承担两个职责：

1. 课堂流程控制；
2. 按 Block 保存实际课堂过程。

Lesson 不是课后摘要，也不是 Handoff 的载体。它本身就是课堂原始文档。

## 6. Lesson Block 契约

Lesson 保留：

- Lesson 身份、父 Plan、状态和 Session；
- Lesson 目标；
- Block 顺序与依赖；
- Student View；
- Teacher Control；
- 题卡或材料别名；
- 每个 Block 内的 Classroom Log。

删除：

- Activation Snapshot；
- Selected Context；
- Content Boundary；
- Adaptation Brief；
- Lesson Summary；
- Handoff；
- 独立 Trace 引用。

最小示例：

~~~md
---
id: lesson-001
kind: lesson
status: active
parent_id: plan-001
parent_path: plans/plan-001.md
tutor_session: session-lesson-001
---

# Lesson 001：恒成立问题的选路诊断

> 观察学生面对参数恒成立问题时如何选择入口。

## Block block-001

### Node State

- Kind: dialogue
- Required: true
- Status: completed
- Depends on:
- Uses:

### Student View

先聊聊最近做恒成立问题时最容易卡在哪里。

### Teacher Control

追问具体题型和真实停点，不急着给方法。

### Classroom Log

- 10:03 学生：含参数的不等式经常不知道先分离参数还是直接求导。
- 10:04 Tutor：继续追问是哪一种结构。
- 10:06 学生补充：参数同时出现在指数和一次项中。
- 10:07 Block 完成，进入问题练习。
~~~

### 6.1 写入规则

- Node State 中的状态字段允许修改；
- Classroom Log 按发生顺序只追加、不覆盖；
- 后续纠正直接追加在同一 Block；
- 不建立事件 ID、证据等级、判断枚举或 supersedes 链；
- Block 本身就是课堂事实的定位坐标；
- 一个独立判断的题卡对应一个 Problem Block；
- 多问只有在分别作答、分别判断时才拆为多个 Block；
- Tutor 可以新增、跳过或调整尚未执行的 Block。

因此 M0 并非没有 Trace，而是采用：

> Block-local Trace：Trace 内嵌于 Lesson，没有被对象化为独立数据层。

## 7. Session 与上下文

### 7.1 Session 绑定

- 一个 Roadmap 对应一个长期 Session；
- 每个 Plan 对应一个独立 Planner Session；
- 每个 Lesson 对应一个独立 Tutor Session；
- 再次打开同一节点时恢复原 Session；
- 不在不同 Session 之间复制聊天记录。

M0 是跨节点没有派生记忆，不是节点内失忆。

### 7.2 上下文获取

Agent 的静态角色资源只有：

~~~text
共享教学原则
+ 当前节点角色说明
+ 当前学习集教学指南
+ 当前节点路径
+ 该节点自己的原生 Session
~~~

共享原则、角色说明和学习集指南在 Session 创建时作为静态提示资源加载，不随
课堂事实动态变化。Plan、Lesson、题卡、材料等业务文档不由 Runtime 编译注入；
Agent 使用普通 Read 和 Search 获取。

Lesson 结束后：

~~~text
学生结束 Lesson
→ 返回原 Plan Session
→ Planner Read 完整 lesson.md
→ 复盘或准备下一节课
~~~

Plan 完成后：

~~~text
学生完成 Plan
→ 返回原 Roadmap Session
→ Roadmap Agent Read plan.md
→ 按需要 Read 该 Plan 下全部 lesson.md
→ 编排下一个 Plan
~~~

如果 Session 被压缩或重新打开，父 Agent 重新读取当前子树内已经完成的文档。

不存在：

- Context Frame；
- Runtime 自动语义注入；
- Source Page；
- read hash；
- source_resolve；
- 搜索结果摘要；
- 父子 Handoff 协议。

## 8. Agent 职责

### 8.1 Roadmap Agent

- 先自然介绍学习集的目标、用途和适用场景；
- 通过有洞见的问诊确定长期方向；
- 创建和调整尚未开始的 Plan；
- Plan 完成后读取原始 Plan 与 Lesson；
- 只更新未来 Plan 编排。

### 8.2 Plan Agent

- 通过追问厘清阶段内的真实困难；
- 备课前读取自己的 plan.md；
- 读取此前所有已完成的 lesson.md；
- 搜索题卡、知识图谱和材料；
- 创建、调整或重排尚未开始的 Lesson；
- 不把课堂结论复制进 plan.md。

### 8.3 Lesson Agent

- 读取当前 lesson.md 及其中引用的资产；
- 按 Block 推进课堂；
- 根据学生表现调整尚未执行的 Block；
- 将课堂过程追加到对应 Classroom Log；
- 使用自然、像真人教师的表达；
- 把结束课程的主动权交给学生。

## 9. 教学提示词的保留与删除

M0 只消融记忆系统，不消融已经打磨出的教学能力。

保留：

- Roadmap 问诊；
- 备课问诊；
- 学习集概述；
- 分级提示；
- 先验证学生路线；
- 一题多解判断；
- 学生澄清优先；
- 自然教师文风；
- 不悄悄缩减已商定的课堂内容；
- 不主动倾倒完整答案。

删除与旧架构耦合的文本：

- Trace 写入和证据等级；
- Handoff、Claim 和来源封存；
- BKT、能力投影和 Planner Attention；
- 长期画像确认；
- Context Frame 页表；
- 安全投影和内部/外部矩阵；
- 复杂工具调用顺序。

## 10. 工具与写入通路

Agent 的语义操作使用普通工具：

- Read；
- Search；
- Edit；
- Write。

父 Agent 直接创建或编辑尚未开始的子节点 Markdown；Tutor 直接更新当前
Lesson 的 Block 状态和 Classroom Log。

Runtime 只负责机械事实：

- 创建或恢复 Session；
- 学生激活节点；
- 学生结束 Lesson；
- 学生完成 Plan；
- 页面路由。

M0 不保留这些模型专用工具：

- roadmap_update；
- plan_update；
- lesson_prepare；
- classroom_update；
- lesson_close；
- trace_append。

如果真实运行证明普通 Markdown 编辑经常损坏文件，再针对已经观察到的故障增加
一个最小确定性写入工具，而不是恢复旧工具集。

## 11. 节点生命周期与单写者规则

最小生命周期：

~~~text
Plan：prepared → active → completed
Lesson：prepared → active → closed
~~~

不设置 paused。学生离开但没有结束时，节点仍是 active，之后恢复原 Session。

单写者规则：

~~~text
父节点编排尚未开始的子节点
子节点激活后由自己的 Agent 负责
父节点只读已经开始或结束的子节点
~~~

- Roadmap Agent 可编辑 prepared Plan；
- Planner 可编辑 prepared Lesson；
- Lesson 激活后由 Tutor 写入；
- Lesson 关闭后父节点只读；
- 如需重上已关闭课程，创建新的 Lesson；
- Agent 可以建议结束，但状态切换由学生操作。

节点状态只写在节点自己的 frontmatter。父节点 Tree 不保存第二份子节点状态，
因此不存在父子状态同步协议。

这是一条避免并发写坏文档的协作纪律，不是安全权限系统。

## 12. 前端

### 12.1 Course

保留 Roadmap → Plan → Lesson 三级树、节点状态、开始/继续/结束动作和节点
Session。聊天区保持为视觉中心，左右面板默认收窄或折叠。

Lesson 页面直接从 lesson.md 显示 Block 顺序、当前 Block 和完成状态，不维护
第二份课堂状态。

### 12.2 Knowledge

继续显示静态方法图谱、题卡和材料，不叠加个人 Trace、BKT 或能力信号。

### 12.3 Memory

M0 隐藏 Memory 页面，因为此时不存在独立长期记忆。

### 12.4 消息呈现

- 页面原样显示 Assistant 的最终回复；
- 工具过程可以折叠，但不能吞掉或替换回复；
- 不生成伪教师话术；
- Teacher Control 不在普通课堂面板主动展示；
- 本地用户仍可直接查看完整 Markdown；
- 不建立语义安全投影。

## 13. 重写落点

第一阶段只重写本地 Pi App：

- 保留当前前端视觉、聊天外壳和 Pi Session；
- 保留通用 Markdown 组件与静态资产浏览；
- 重写 apps/pi-teaching-web 的教学领域内核；
- 新内核不得引用旧 trace、handoff、evidence、memory 或 context-frame 模块；
- 新建干净的导数 M0 学习集；
- Claude Code 插件暂不改动。

当前完整版在重构前保留明确标签。M0 在独立分支实施，不增加 memoryMode
开关，也不在同一运行路径中保留旧兼容分支。

错误处理保持直接：

- Markdown 解析失败时显示文件和错误位置；
- 工具失败时返回真实错误；
- 不自动修复旧格式；
- 不静默降级；
- 不提供兼容适配器。

## 14. M0 验收

首轮真实周期：

~~~text
Roadmap 问诊
→ Plan 1：连续 6 节 Lesson
→ 完成 Plan 1
→ 返回 Roadmap
→ 创建 Plan 2
→ 再运行 2–3 节 Lesson
~~~

重点观察：

1. Planner 是否实际读取完整 Lesson；
2. 下一节课是否根据此前课堂改变；
3. Roadmap 是否能基于多个原始 Lesson 制定不同的第二个 Plan；
4. 是否出现错误记忆或过度概括；
5. Token 和等待时间是否已不可接受；
6. 工具和 Markdown 写入是否稳定；
7. 没有旧记忆系统后，对话是否更自然；
8. Tutor 面对错误、卡顿、提示依赖和学生异议时是否仍能正常教学。

这是一轮工程验收，不是教学效果论文。

## 15. 后续记忆阶梯

后续层级是候选方向，不是预先承诺的功能：

~~~text
M0：原始文档直接读取
 ↓
M1：可定位的来源索引
 ↓
M2：Plan 内局部压缩
 ↓
M3：跨 Plan 长期记忆
 ↓
M4：能力聚合与统计投影
~~~

### M1：来源索引

只记录 Lesson、Block、题卡/材料、时间和原文路径，不写能力判断。

### M2：Plan 内局部压缩

只服务当前 Plan，每条结论必须指回 Lesson/Block，原文优先。

### M3：跨 Plan 长期记忆

只保存跨周期反复出现并经学生确认的偏好、困难和有效教学方式。

### M4：能力聚合

只有人工读取已无法发现大量课堂中的模式时才考虑 BKT 和方法节点聚合；它们只
作为 Planner 的注意信号，不成为能力真相。

每次升级必须满足：

> 先在至少两节真实课堂中观察到相同缺口，再加入解决该缺口的最小机制。

## 16. 最终架构判断

M0 的核心不是删除一切，而是恢复一个清楚的信息所有权：

~~~text
课堂事实只属于 Lesson Block
阶段安排只属于 Plan
长期安排只属于 Roadmap
需要信息的 Agent 自己读取原始来源
~~~

只要直接读取仍然有效，就不制造第二份记忆。只有真实课堂证明某类信息无法被
可靠、及时地重新找到时，才允许为那一类问题增加新的记忆层。
