# 考察课课前无剧透投影设计

日期：2026-07-24

## 问题

真实课程中，学生明确要求考察课保持无剧透，Coach 在 `lesson_prepare`
成功后仍复述了完整题目、逻辑陷阱和换元入口。同时，学生课堂本会返回并允许
展开 assessment Lesson 中尚未开始的 Block `Student View`。

工具安全投影已经隐藏 `lesson_prepare` Blueprint；泄漏来自 Coach 的自然语言
公告和课堂本对 Pending Block 的读取投影。

## 目标

- assessment 备课完成公告只表达“已经备好”和题目数量。
- assessment Lesson 开始前不向学生返回未来 Block 的 `Student View`。
- 课堂开始后，只显示 active/completed Block；closed 后恢复完整学生视图。
- 非 assessment Lesson 保持现有预览能力。
- Authoring 模式继续可以通过原始 Lesson source 查看完整教案。

## 设计

### Coach 公告

Pi `coach-study` 与 Claude 插件 `prepare-next-lesson` 使用同一条件式输出契约：

> 当主模板为 `assessment`，完成公告只包含 Lesson 已备好和 problem Block
> 数量，例如“考察课已备好，共两道题。准备好就可以开始。”

题干、公式、题型、方法、换元入口、逻辑陷阱、能力识别目标和题卡编号继续留在
Lesson 文件中，直到 Tutor 激活相应 Block。其他模板可以继续说明活动角色和课程
方向。

### 学生投影

`readPlanWorkspace` 继续从同一份 Lesson Markdown 读取 Block，但在返回
assessment Lesson 时投影 `studentView`：

- Lesson 为 `closed`：显示全部 Block；
- Block 为 `active` 或 `completed`：显示该 Block；
- 其他状态：返回空字符串。

题卡正文沿用现有规则，只在其 Block active/completed 后进入学生课堂本。
Authoring source 不经过这一投影。

## 非目标

- 不修改 Lesson Markdown schema、Blueprint schema 或工具数量；
- 不建立语义审查器，不拦截普通 Coach 消息；
- 不改变 concept、deliberate-practice、remediation、diagnostic 或 review 的预览；
- 不为 Skill 的具体措辞添加自动化测试。

## 验收

1. prepared assessment 的所有 Pending Block `studentView` 都为空。
2. active/completed assessment Block 可见，未来 Pending Block 仍为空。
3. closed assessment 的全部 Student View 可见。
4. 非 assessment Lesson 的 Pending Student View 保持可见。
5. 题卡答案、Teacher Control 和未激活题卡仍不进入学生课堂本。
6. Pi 完整 `bun run check` 通过。

