# Tutor 关课 Skill 语义澄清设计

## 背景

Tutor 真课中先用 `classroom_update` 完成 Reflection，随后调用
`lesson_close`，触发 `LESSON_REFLECTION_NOT_ACTIVE`。运行时契约没有问题：
`lesson_close` 本身负责完成仍为 active 的 Reflection，并原子关闭 Lesson。

回归来自 Tutor Skill 的压缩。旧版明确要求保留 active Reflection 并由
`lesson_close` 完成；当前版本只写“生成 Reflection 和 Lesson Summary 后使用
`lesson_close`”，没有说明谁负责改变 Reflection 状态。

## 设计

只修改 Pi Tutor Skill 的 `Transition and closure` 段落，恢复一条低自由度的
操作契约：

1. 学生明确选择结束后，先结清已接受的纠正和必要证据。
2. 保持 Reflection Block 为 active；不得用 `classroom_update` 完成或跳过它。
3. 从现有 active evidence 和直接来源生成 Reflection 与 Lesson Summary。
4. 调用一次 `lesson_close`；该工具原子完成 Reflection 并关闭 Lesson。
5. 只有成功回执同时包含当前 `ownerPath` 和 `status: closed`，Tutor 才能宣称
   Lesson 已正式关闭。

这是一条顺序契约，不增加新的教学判断、错误恢复流程或状态机。

## 范围

修改：

- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`

不修改：

- `lesson_close` schema、实现或 Lesson 状态机；
- DeepSeek 超时、重试或续写机制；
- Claude Code 公共插件 Skill；
- Agent 人设、前端或持久化格式。

## 验证

根据仓库约束，不为 Skill 措辞、标题或固定文本增加自动化测试。实施后只做：

- 审阅差异，确认只改关课段落；
- 对照 `lesson_close` 工具描述，确认两处状态所有权一致；
- 检查 Skill 内不存在要求先完成 Reflection 的冲突语句。

## 成功标准

Tutor 得到唯一且无歧义的关课路径：Reflection 保持 active，`lesson_close`
完成 Reflection 并关闭 Lesson；失败回执不能被表述为成功关课。
