# StudyForge M0 文档契约

这份文件是 Roadmap、Plan 与 Lesson 持久化骨架的唯一语法说明。严格照抄字段名、
章节名和 Tree 形状；章节正文根据真实教学需要自由书写，不要把教学内容压成表单。

## 子节点写入顺序

创建 Plan 或 Lesson 时，顺序固定为：

```text
write 完整子文件
→ read 子文件，确认 frontmatter、标题与必需章节
→ edit 父节点 Tree，加入已经存在的子文件链接
→ read 父节点，确认链接和正文仍然完整
```

不能先挂链接再创建文件，也不能为尚未创建的节点预留链接。Tree 可以为空；空 Tree
是 Tree 标题和下一标题之间没有任何文字，不写说明、注释、占位符或未来路径。

## Tree 条目

Roadmap 的 `## Plan Tree` 使用：

```markdown
- [plan-001 | 阶段标题](plans/plan-001/PLAN.md)
  - After:
  - Depends on:
```

Plan 的 `## Lesson Tree` 使用：

```markdown
- [lesson-001 | 课程标题](plans/plan-001/lessons/lesson-001.md)
  - After:
  - Depends on:
```

`After` 为空或填写一个前序同级节点 ID；`Depends on` 为空或填写用英文逗号分隔的
同级节点 ID。链接 ID 必须与子文件 frontmatter 的 `id` 完全相同。路径从学习集根目录
开始。每个 Plan 使用 `plans/<plan-id>/` 目录，Plan 文档固定为其中的 `PLAN.md`；该
Plan 的 Lesson 放在同一目录的 `lessons/` 下，Lesson ID 只需在当前 Plan 内唯一。

## 新 Plan 模板

新 Plan 必须以 `prepared` 创建。把示例 ID、标题和正文替换成当前阶段的真实内容，
不要替换字段名和章节名。

```markdown
---
id: plan-001
kind: plan
status: prepared
parent_id: roadmap
parent_path: ROADMAP.md
session_id: null
---

# Plan 001：阶段标题

## Stage Goal

这个阶段要解决的具体学习问题。

## Observable Capability Standard

阶段结束时学生能够表现出的可观察能力。

## Test

用于检验上述能力的真实任务或表现。

## Lesson Tree

## Current Position

目前已知的起点、已确认的约束和仍待厘清之处。

## Next Lesson Arrangement

公开的课程弧线、下一课候选和需要与学生继续确认的安排。
```

Plan 状态只允许 `prepared`、`active`、`completed`。创建时使用 `prepared`；开始和完成
由学生界面处理，不由 Agent 自行改写。

## 新 Lesson 模板

新 Lesson 必须以 `prepared` 创建，并至少包含一个合法 Block。把示例 ID、标题、资源
路径和正文替换成当前课堂的真实内容，不要替换字段名和章节名。

```markdown
---
id: lesson-001
kind: lesson
status: prepared
parent_id: plan-001
parent_path: plans/plan-001/PLAN.md
session_id: null
---

# Lesson 001：课程标题

## Lesson Goal

本节课保持不变的教学目标。

## Block block-001：活动名称

### Node State

- Kind: dialogue
- Required: true
- Status: pending
- Depends on:
- Uses:

### Student View

学生此刻可以看到的材料、问题或活动说明。

### Teacher Control

本 Block 的教学意图、观察重点和按学生反应调整帮助的原则。

### Classroom Log
```

Lesson 状态只允许 `prepared`、`active`、`closed`。Block 的 `Kind` 只允许 `dialogue`、
`problem`、`material`、`reflection`；`Required` 只允许 `true`、`false`；`Status` 只允许
`pending`、`active`、`completed`、`skipped`。`Depends on` 和 `Uses` 都使用英文逗号分隔，
没有内容时保留冒号后为空。每个 Block 恰好包含一次 `Node State`、`Student View`、
`Teacher Control`、`Classroom Log`；前三者不能留空，初始 `Classroom Log` 可以为空。

同一 Lesson 可以有多个 Block。复制完整 Block 骨架并使用新的 Block ID；课堂目标、
活动数量、学生话术、教师判断与真实课堂记录都属于自由正文，应服务于本节课，而不是
为了迎合模板添加无意义内容。
