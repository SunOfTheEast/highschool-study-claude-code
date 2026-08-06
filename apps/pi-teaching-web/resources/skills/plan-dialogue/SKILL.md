---
name: plan-dialogue
description: Use when a Plan Session first interprets its stage, reviews closed Lessons, discusses the next Lesson, or discusses stage closure before student approval.
---

# Plan 阶段与逐课讨论

## 职责尺度

当前 Plan 已经拥有稳定的 Stage Goal、Observable Capability Standard 与 Test。本
Skill 讨论这个阶段怎样通过多节 Lesson 推进、复盘已关闭课堂，以及当前下一课或
阶段收口应承担什么作用；不要重新设计整个 Roadmap，也不要进入具体题目的现场教学。

证据只能沿当前 Plan 的 Lesson Tree 读取；Tree 路径从学习集根目录解析，不相对于
`plans/` 目录拼接。目录中未链接的文件不是该学生的历史。Plan 级判断可以更新，但不
改写已关闭 Lesson 持有的事实。

## 阶段路由

先读取当前 Plan 的 frontmatter 与 Lesson Tree 结构状态，按状态进入对应阶段，
并且只读取那一个 reference：

- Lesson Tree 为空且没有当前 Lesson → 首次进入：`references/first-entry.md`
- 最新 Lesson 已 closed，且没有 prepared/active 的下一课 → 课后复盘：
  `references/post-lesson-review.md`
- 学生主动提出结束，或教师在复盘后认为已有达标可能 → Plan 收口：
  `references/plan-closure.md`
- 已有 prepared/active Lesson → 不创建另一课

路由只依据既有文档状态，不新增 phase 字段。"证据接近标准"是教师在复盘后作出的
专业判断，不是结构触发条件；收口不得由预计课次数、预设弧线走完或章节讲完触发。

## 统一批准门

每一节 Lesson 都先公开讨论。Coach 应说明本课想产生的变化、主要活动形态、处理
深度、独立尝试与提示方式，以及学生明确在意的题量、工作量和节奏，然后停止等待
学生明确确认或修正。

学生的初始要求即使很具体，也只是课程设计输入；Coach 仍需呈现完整课堂方案供学生
确认。学生说"你来安排"只授权教师提出方案。学生对方案作出明确的接受并修改时，
修改后的表达可以构成最终确认，不增加第三次形式审批。连续课程中的提案可以随既定
节奏紧凑，只要相同要素仍被学生看懂；"嗯、行、可以"这类明确的语言回应可以构成
确认；沉默或学生的继续操作永远不得推断为批准。

确认之前不得调用 `prepare-approved-lesson`，不得读取 Lesson 模板、搜索材料、调用
Scout 或创建 Lesson。确认后，把最终公开设计写入 Plan 的 `Next Lesson Arrangement`，
作为准备 Skill 的唯一交接；不新增批准字段或状态。

各阶段 references 只引用本批准门，不重复改写。拿不准时停止并回到对话。

## 按需参考

当前 Plan 的剩余弧线因真实课堂证据需要重新解释时，可以读取
`../references/plan-cycles/INDEX.md`，再只读一个匹配的周期 reference。周期只提供
教学功能，不成为 phase 字段或固定 Lesson 数量。

## 权限边界

Plan Session 可以更新当前 Plan 的 Current Position 和 Next Lesson Arrangement。
如果阶段问题本身需要改变，返回 Roadmap。不要修改 active/closed Lesson，不要在本
Session 代替 Tutor 上课。
