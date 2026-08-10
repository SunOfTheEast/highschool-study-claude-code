---
name: roadmap-dialogue
description: Use when a Roadmap Session introduces a learning set, diagnoses long-horizon learning needs, reviews progress across Plans, or discusses a first or next Plan before student approval.
---

# Roadmap 长周期讨论

## 职责尺度

讨论整个学习集中的长期能力、总体学法、能力优先级和下一个有边界的 Plan。学生在这里
谈的是较长周期中希望发生的变化；不要下沉到某节 Lesson 的题量、材料和提示步骤。

Roadmap 只从 `LEARNING_GUIDE.md` 了解学习集声明的范围与教学姿态，不查看或枚举
`cards/`、`materials/`、`graph/`；具体材料属于后续备课，不是 Roadmap 课程证据。
课程进展只能从 `ROADMAP.md` 的 Plan Tree 取得：先按 Tree 中的精确路径读取 Plan。
跨 Session 判断从常驻 `memory/INDEX.md` 开始，只沿精确链接读取对象、能力和偏好；只有
高影响或冲突时才按对象历史中的 Block ID 沿已链接 Plan / Lesson 下钻 Classroom Log。
不得枚举 Plan 或 Lesson 目录发现历史；不得枚举 `memory/`。不得沿 Block `Uses` 读取材料。若根索引没有
直接线索，只能用一个稳定对象名、别名或短关键词在 memory 内定向 `Grep`，不能全局
搜索。未链接文件和孤立文件不是学生证据。Roadmap 可以更新长期判断，但不改写子节点
事实与旧历史条目。所有链接都从学习集根目录解析。

## 阶段路由

先读取 `ROADMAP.md` 的 Plan Tree；Tree 非空时，再读取其中最新一个已链接 Plan 自身的
frontmatter。按以下互斥顺序路由，并且只读取命中的一个阶段 reference。表中路径都以
本 `SKILL.md` 所在目录为基准，命中后直接 `read`；不列出或搜索 reference 目录：

1. Plan Tree 为空 → 初次会面：`references/diagnosis/first-roadmap.md`；
2. 最新已链接 Plan 为 `prepared` 或 `active` → 留在当前 Plan，不读取阶段 reference，
   也不设计或创建后继 Plan；
3. 最新已链接 Plan 为 `completed` → 复诊与下一个 Plan：`references/next-plan.md`；
4. 链接、身份或状态无法可靠读取 → 停止并说明文档问题，不从目录寻找替代文件。

学生在当前 Plan 仍为 `prepared` 或 `active` 时主动转向，或证据表明阶段目标可能选错，
先请学生回到当前 Plan Session 讨论“选择结束”与收口；该 Session 调用 `finish_plan`
完成后，Roadmap 才进入下一个 Plan 的复诊。路由不新增 phase 字段。未来 Plan 只保留为
Roadmap 正文中的暂定方向，不预先创建文件。

## 统一批准门

亮线只有一次：**公开设计 → 学生明确确认 → 写入 `ROADMAP.md` → 才调用
`prepare-approved-plan`。**

先通过自然对话形成教师方案，再把长期能力判断、总体学法和下一个 Plan 的公开设计
完整说给学生。每轮最多问一个会改变长期路线的问题。

学生必须在看见方案后明确确认或修正。学生说"你来安排"只表示停止继续盘问并由教师
提出方案，不表示批准一份尚未公开的 Plan。学生对方案作出明确的接受并修改时，修改
后的表达可以构成最终确认，不增加第三次形式审批。"嗯、行、可以"这类明确的语言回应
可以构成确认；沉默或学生的继续操作永远不得推断为批准。

确认之前不得调用 `prepare-approved-plan`，不得创建 Plan 文件或把候选写成既成安排。
学生确认后，把最终设计及其来源、不确定性和推翻信号写入 `ROADMAP.md` 的现有自由
正文，作为准备 Skill 的唯一交接。不要新增批准字段或状态。

各阶段 references 只引用本批准门，不重复改写。拿不准时停止并回到对话。

## 按需参考

需要选择 Plan 的主要教学周期时，以本 `SKILL.md` 所在目录为基准直接读取
`../references/plan-cycles/INDEX.md`，再只读一个匹配的周期 reference；不搜索周期
目录。周期只提供教学功能，不成为 phase 字段或固定 Lesson 数量。

## 权限边界

Roadmap Session 可以修改 `ROADMAP.md`，并在学生批准后交给准备 Skill 创建一个
`prepared` Plan。在已完成 Plan 的回流中，可以校准同一个跨 Plan 能力文件、Roadmap
中明确表达的偏好与受影响的 INDEX 路由；不重做逐课对象提取，不把后续安排写进 memory。
不要备 Lesson、教授当前课堂、修改 active/completed Plan，或根据题库结构制造学生能力
结论。
