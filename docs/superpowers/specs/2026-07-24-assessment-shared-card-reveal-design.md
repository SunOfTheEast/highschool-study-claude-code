# 考察课共享题卡延迟揭示设计

日期：2026-07-24

## 问题

assessment 已按 Block 隐藏未来 `Student View`，但学生课堂本仍按题卡 alias
聚合可见题卡。同一张多问题题卡被多个 problem Block 复用时，第一个 Block
激活就会返回整张题卡，因此尚未激活的后续分问也会提前出现。

真实验收还发现，Coach 写入的 assessment `Student View` 和 Tutor 的开场话术
可能在首次作答前提示方法名称、能力目标或“定义域别忘了”一类识别线索。

## 目标

- 同一 alias 仍被未来 Pending Block 使用时，不在侧栏返回整张题卡。
- 所有使用该 alias 的 Block 均已 active/completed 后，恢复现有整卡展示。
- 单个 Block 独占的题卡保持现有行为：该 Block 激活后立即显示。
- closed Lesson 继续显示完整题卡和课堂回放。
- assessment 首次作答前只呈现当前题目与中性作答要求。

## 设计

### 共享 alias 可见性

`readStudentNotebook` 继续使用现有 `StudentProblemCard`，不增加题卡分问字段。
对每个 alias 收集所有引用它的 Block：

- 非 assessment 或 closed Lesson：沿用现有可见性；
- assessment 进行中：只有当所有引用该 alias 的 Block 都不再是
  `pending`/`skipped` 时，才把整张题卡加入 `cards`；
- 仅被一个 Block 引用的 alias 仍在该 Block active/completed 时显示。

因此第一问进行时，准确题面仍由 Tutor 当前消息呈现；第二问激活后，两问都已经
解锁，侧栏再显示完整原题。该方案不推断 `parts` 顺序，也不改变持久化 schema。

### Assessment 文本规则

Pi 与 Claude 插件的 Coach Skill 同步规定：assessment 的 `Student View`
不得加入方法名、能力标签、识别提示、定义域提醒、变形入口或其他答题线索。

Tutor Skill 同步规定：首次尝试前只呈现当前 Block 对应的真实题面与中性作答
要求，不复述 Lesson 的能力目标、方法分类或 Teacher Control 中的检查点。方法
归类仍在学生完成作答并写入初始 Trace 后按现有确认流程进行。

## 非目标

- 不修改 Lesson、Blueprint、题卡或 Trace schema；
- 不解析或裁剪题卡 `parts`；
- 不改变非 assessment 课程的题卡侧栏；
- 不修改已经生成的旧 Lesson；
- 不为 Skill 具体措辞添加自动化测试；
- 不处理 Roadmap 尾注或模型偶发参数重试。

## 验收

1. assessment 中同一 alias 分别绑定 `p1`、`p2` 时，只有 `p1` active 不返回整卡。
2. `p1` completed 且 `p2` active 时返回整卡。
3. assessment 的单 Block 题卡仍在该 Block active 时返回。
4. closed assessment 返回完整题卡。
5. 现有 Student View、答案隔离、Trace 和路由测试保持通过。
6. Pi `bun run check` 与 Playwright E2E 通过。
