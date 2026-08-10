# Plan / Lesson 语义收口与机械关闭设计

状态：已确认

日期：2026-08-10

## 问题

当前“完成这一阶段”和“结束本课”直接调用 Runtime 生命周期接口。它会立刻中止并释放
当前 Session，再把 Plan / Lesson 改成终态。因此学生的按钮动作绕过了已经写在 Skill 中的
阶段复盘、课末反思、课堂事实补齐和记忆固化。真实 Lesson 已出现 `closed`，但没有
`lesson_memory_commit`、对象记忆仍停在课前、下一层只能重读整课补洞的情况。

问题不在按钮本身，而在一个动作承担了两种不同含义：学生表达“我想结束”，和 Runtime
执行“语义工作已经结束后的机械状态迁移”。

## 采用方案

保留 Plan 与 Lesson 页面的学生结束按钮，但把它改成当前绑定 Session 的一条自然结束意图：

```text
学生点击结束
→ 当前 Plan / Lesson Session 收到真实结束意图
→ Teacher 按现有收口 Skill 对话、补齐语义写入
→ Teacher 调用当前节点绑定的无参数 finish 工具
→ Runtime 原子执行 active → completed / closed
→ 现有 course-invalidated 事件刷新页面为只读
```

Plan 使用 `finish_plan`，Lesson 使用 `finish_lesson`。两者没有路径、节点 ID、确认布尔值、
摘要或状态参数；Runtime 从 Session scope 绑定唯一目标。工具不判断学生语义，不读聊天文本，
也不检查“达标”或记忆内容，只执行已经由 Teacher 发起的合法机械迁移。

按钮在当前 Session 正在回复或连接不可用时禁用，避免并发加入第二个结束请求。启动 Plan / Lesson
仍是直接的学生 UI 生命周期动作；只有终结动作需要先经过语义收口。

## 各层收口

### Lesson

Tutor 仍按课末 reference 完成自然回顾、听取学生、形成有边界判断、补齐必要 Classroom Log，
并在启用 M1 时调用 `lesson_memory_commit`。完成本轮最小充分固化后调用 `finish_lesson`，随后
给出自然总结。Runtime 不以是否存在记忆提交作为硬门：无 M1 记忆的学习集和确实没有新增记忆
内容的课堂仍可正常结束。

### Plan

Coach 仍公开区分“达标完成”和“选择结束”，听取学生意见，更新 `Current Position` 与
`Next Lesson Arrangement`，按需校准记忆；完成这些语义动作后调用 `finish_plan`。工具只把
当前 Plan 改为 `completed`，不创建下一个 Plan 或 Lesson。

## 删除的旁路

- 客户端保留 `completePlan` / `closeLesson` 这两个学生动作，但它们不再直接关闭节点。
- HTTP 的 `/complete` 与 `/close` 只接受学生的结束意图并排入当前 Session；旧的 Runtime
  直接关闭方法删除。
- 不增加 Runtime 正则、语义确认门、`closing/ready` 状态、永久 receipt 或第二套前端状态机。
- Free Learning、Meta、Roadmap 和 Plan / Lesson 的启动动作不变。

## 失败与恢复

- Teacher 尚需追问或学生改变主意时，不调用 finish 工具，节点继续 `active`。
- finish 工具只接受当前绑定节点；`prepared` 或其他非法状态拒绝。
- 同一终态工具因传输重放再次执行时返回同一机械成功结果，不重复改写文档。
- 状态迁移后，关闭节点拒绝新的消息；历史仍可只读回放。
- 工具或模型失败时节点保持 `active`，学生可重试或继续对话。

## 验收

1. 点击 Lesson 结束只产生结束意图，不立即把 Lesson 改为 `closed`。
2. Tutor 可继续反思、日志和记忆工具；调用 `finish_lesson` 后才变为 `closed`。
3. 点击 Plan 完成只产生结束意图；Coach 更新阶段判断并调用 `finish_plan` 后才变为
   `completed`。
4. finish 工具没有任何模型可填写的身份、路径、确认或状态字段。
5. 直接 HTTP 关闭旁路不再存在；节点终态后不能继续发送。
6. Free Learning、Meta、Roadmap 和启动动作的现有测试不变。
