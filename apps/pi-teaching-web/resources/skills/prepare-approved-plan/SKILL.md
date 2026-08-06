---
name: prepare-approved-plan
description: Use when a Roadmap Session has a student-approved Plan design recorded in ROADMAP.md and must materialize that approved Plan.
---

# 准备已批准的 Plan

## 前置条件

只实施 `ROADMAP.md` 已经记录、且学生在当前 Roadmap 对话中明确确认的 Plan 设计。
若目标能力、总体学法、Plan Goal、Observable Capability Standard、Test 或公开初始
弧线仍未批准，停止并返回 `roadmap-dialogue`。不得把"你来安排"当作预先批准。

## 实施边界

以忠实结构化为主：Plan 的 Stage Goal、Observable Capability Standard、Test、阶段
学法、当前依据和公开初始弧线原则上都已在 Roadmap 对话中公开并确认。本 Skill 可以
规范表达、生成 ID、填入文档骨架和安排合法 Tree 元数据，但不能新增阶段目标、改变
达标标准、替换 Test、扩张负担或选择另一种 Plan 周期。内部小调整若会改变学生已经
批准的公开设计，停止并回到 `roadmap-dialogue` 重新商议。

按照注入的文档契约：

1. 读取 `ROADMAP.md`、当前确认语境与注入的 M0 文档契约；
2. 区分已批准的公开设计、允许自主决定的内部细节和必须返回 `roadmap-dialogue` 的
   实质缺口；已批准内容彼此矛盾时不自行选择其中一项；
3. 从父 Tree 确定当前一个 Plan 的候选 ID；其目录固定为 `plans/<plan-id>/`，文档
   精确路径固定为该目录下的 `PLAN.md`，确认不会覆盖既有文件；
4. 在该精确路径写入一份完整的 `status: prepared` Plan，`Lesson Tree` 保持为空；
5. 完整回读子文件，核验 frontmatter、父子关系、必需章节与批准设计一致；
6. 只有子文件合法后，才把它加入 Roadmap 的 Plan Tree；
7. 回读 `ROADMAP.md` 与新 Plan，确认链接唯一、正文未损坏、内容仍与批准设计一致；
8. 向学生说明已准备的阶段目标、能力标准、检验和公开课程弧线。

## ID 与路径

从父 Tree 的既有条目生成候选 ID，并检查 `plans/<plan-id>/PLAN.md` 这一精确目标路径。
不能枚举 `plans/` 目录寻找可当成当前产物的既有文件。精确路径已存在且无法证明是本次尚未
完成的同一产物时，停止并报告冲突：不覆盖、不改名后悄悄重建、不把它自动挂入
Tree。

## 部分失败

- 子文件写入后验证失败：只修复本次创建的同一个文件；合法之前绝不链接父 Tree。
- 子文件合法但父 Tree 编辑失败：重新读取父节点，只重试链接同一个已验证子文件；
  重试前检查父 Tree 是否已经含有该链接，防止重复条目。
- 无法安全完成时：明确报告"子文件已存在但尚未链接"的精确路径和当前状态，不宣称
  成功，不创建第二份，也不自动删除。
- 恢复时只读取自己刚创建的精确路径；不扫描目录猜测哪个孤立文件属于当前批准设计。

本 Skill 不创建 Lesson、不启动 Plan、不教授内容，也不预先物化未来整串 Plan。
