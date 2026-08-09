# Plan 索引运行时所有权设计

日期：2026-07-24

## 问题

真实模型验收连续复现了两次同一故障：

- 完成 `domain-integrity` 时，Coach 调用 `plan_update` 并提交
  `lessonIndex: "3"`，原有三条 Lesson 链接被覆盖；
- 为 `isomorphic-migration` 准备 `lesson-004` 后，Coach 又提交
  `lessonIndex: "1"`，刚由 `lesson_prepare` 写入的链接被覆盖。

`lesson-004.md` 仍真实存在，但 `readPlanWorkspace()` 只能从 Plan 的
`## Lesson Index` 发现 Lesson，因此前端得到 `lessonCount: 0`，课堂无法开始。
同一次结课还留下了 Roadmap Plan Graph 的陈旧 `active` 状态。

## 方案比较

### A. 只加强 Coach Skill

明确要求 Coach 在备课后不要调用 `plan_update`，并要求它复制完整索引。

优点是改动最小；缺点是结构正确性继续依赖模型完整复制 Markdown。真实运行已经证明
模型会把“课程数”误填成“课程索引”，因此不采用。

### B. 运行时拥有结构字段（采用）

从 `plan_update` 参数中删除 `lessonIndex`。运行时保留现有链接顺序，同时扫描真实
Lesson 文件补回属于当前 Plan、但尚未链接的 Lesson，再根据真实标题和状态重建索引。
Roadmap Plan Graph 的状态标记也由 Plan frontmatter 同步。

这保留 Coach 对教学判断文本的控制，同时把可从文件推导的结构交还给运行时。

### C. 全量重建 Roadmap 与 Plan

每次审计都扫描整个学习集并重写所有 Plan Graph、Plan 与 Lesson 元数据。

能够统一格式，但会扩大改动面，并可能破坏学生确认过的顺序和依赖说明，因此不采用。

## 设计

### `plan_update` 契约

模型只提交：

- `decision`
- `currentPosition`
- `nextLessonCandidate`
- `planSummary`

不再提交 `lessonIndex`、Plan 路径、Lesson 路径或 Session 身份。

### Lesson Index 派生

`updatePlan(root, planPath, input)` 在写入前：

1. 读取当前 Plan ID 与现有 Lesson Index 链接顺序；
2. 读取这些链接指向的真实 Lesson；
3. 扫描 `lessons/*.md`，补入 `plan_id` 等于当前 Plan ID 的未链接 Lesson；
4. 现有链接保持原顺序，补入项按规范路径排序；
5. 用真实 Lesson 标题和 frontmatter 状态生成编号 Markdown；
6. 没有 Lesson 时写入 `（暂无）`。

模型文本不能覆盖、删除或伪造 Lesson 链接。

### Roadmap 状态同步

`registerPlan` 新增链接时写入 Plan 的真实状态。`updatePlan` 改变 Plan 状态时，同步
Plan Graph 中同一路径后的首个状态标记：

- `complete` → `completed`
- `active` / `replan` → `active`

已有的顺序和状态标记后的人工说明保留；运行时不重排 Plan，也不重写依赖叙述。

### 原子边界

在写入 Plan 前先完成所有 Plan、Lesson 与 Roadmap 校验和字符串构造。任一必需章节、
已链接 Lesson 或 Plan Graph 链接无效时，不写任何文件。成功时更新 Plan 和 Roadmap。

## 测试

1. `plan_update` 工具 schema 不再包含 `lessonIndex`。
2. `updatePlan` 无论 Coach 文本为何，都从真实 Lesson 重建链接、标题和状态。
3. 已有 Lesson 顺序保持，未链接的同 Plan Lesson 被补入。
4. 其他 Plan 的 Lesson 不会混入。
5. Plan 完成后 Roadmap 状态从 `active` 同步为 `completed`。
6. 缺少必需审计章节时，Plan 与 Roadmap 均保持逐字节不变。
7. 既有完整前端与插件验证继续通过。

## 非目标

- 不修改无剧透策略；
- 不修改题卡、Trace、能力投影或 Session schema；
- 不增加数据库、索引服务、兼容层或新工具；
- 不在失败的真实验收副本里手工修复 Markdown。
