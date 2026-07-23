# Tutor 工具契约文案小改设计

## 目标

让 Tutor 一次看懂 `student_confirmed` Trace 的配套字段，以及 `lesson_close` 对 active Reflection 的前置条件，减少可避免的工具重试。

## 改动

1. `tutor-lesson` 的关课说明明确：
   - Reflection Block 保持 `active`；
   - 不先调用 `classroom_update complete`；
   - `lesson_close` 自行完成 Reflection 并关闭 Lesson。
2. `lesson_close` 的工具描述公开相同前置条件。
3. `trace_append.methodStatus` 的描述明确：选择 `student_confirmed` 时，同一次调用必须提供 `methodPrimary`、`methodDecisiveStep` 和 `methodConfirmation`。

## 非目标

- 不修改 schema。
- 不修改状态机或持久化逻辑。
- 不增加工具、字段、重试器或防御性代码。
- 不为 Skill、Agent 或工具描述的具体措辞增加测试。

## 验收

- 三处说明表达同一份契约，没有互相矛盾。
- Pi 现有类型检查、单元测试与生产构建通过。
- 代码 diff 不包含运行行为变化。
