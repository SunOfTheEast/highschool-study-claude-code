# 可打印 Lesson 讲义

只在 Lesson 已经成功写入、链接进当前 Plan 的 Lesson Tree、完整回读为 `prepared`，并且
Coach 已经公开报告“Lesson 已经可以开始”之后读取。讲义是可选的现实交付，不是开课门槛。

按一条顺序完成：

```text
Lesson 已经可以开始
→ 简短询问是否需要讲义，并用一句话说明准备包含哪些公开 Blocks
→ 学生明确同意：按说明过的顺序调用 artifact_export
→ 学生拒绝、暂时不要或没有回应：结束，不调用
→ 导出失败：说明可以稍后再试，不回滚 Lesson，也不阻塞开课
```

“要、可以、嗯”等对当前讲义提议的明确同意即可，不要求第二轮形式化确认；沉默、继续其他
操作或含糊回应不是批准。

Coach 只从当前 Plan 已链接 Lesson 中选择现有公开 Block，并传入它们的 ID 顺序。
`artifact_export` 只出版这些 Block 的 `Student View`；不要让它补写解释、解题、总结聊天，
也不要选择或泄露 `Teacher Control`、`Classroom Log` 和未说明的 Block。
