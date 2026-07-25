# Lesson 关闭与 Reflection 解耦设计

## 背景

当前 Pi Tutor 把两条本应独立的状态轴耦合在一起：

- Lesson 生命周期：`active`、`paused`、`closed`、`abandoned`；
- 课堂 Block 流程：`pending`、`active`、`completed`、`skipped`。

`lesson_close` 当前要求“恰好一个 `Kind: reflection` 且 `Status: active` 的
Block”，随后把该 Block 改为 `completed`，再写入顶层 `## Reflection`、
`## Lesson Summary` 和 Lesson 的 `status: closed`。

真实课堂已经证明，该契约会因学生在哪一轮表达结束而产生不同结果：

- 学生在 Reflection 回答中同时要求结束时，关课一次成功；
- 学生先完成 Reflection、下一轮再确认结束时，关课失败；
- 学生在 problem Block 中提前结束时，关课失败。

这不是参数错误、旧 Skill、前端竞态或 Provider 中断，而是 Lesson 生命周期、
课堂流程和结课文本被绑定成了一个操作。

## 设计原则

### Lesson 生命周期与 Block 流程互不代替

Reflection Block 与 problem、material、dialogue 一样，只是课程安排的一部分。
`lesson_close` 是学生随时可以选择的 Lesson 生命周期动作。

因此：

- Block 是否必做，不限制学生结束 Lesson；
- Lesson 已关闭，不把未完成 Block 伪装成已完成；
- 关闭 Lesson 不表示课程模板走完，也不表示能力标准达成；
- Plan 是否完成仍由 Coach 根据证据和学生选择审计。

### Reflection Block 由模板提供可调整默认值

Reflection Block 是学生实际参与的课堂活动，不是所有 Lesson 必须具有的结构
占位符。Blueprint 和 prepared admission 允许 0、1 或多个 Reflection Block。

六种 canonical template 只提供备课起点：

| Template | Reflection Block 默认安排 |
| --- | --- |
| `diagnostic` | 默认 0 个；需要学生自述时可增加 1 个 |
| `concept` | 默认 1 个可调整的结尾反思；若 exit quiz 已完成收束可删除 |
| `deliberate-practice` | 默认不设统一结尾反思；可在关键练习组后加入局部反思 |
| `remediation` | 默认在 unseen retest 后安排 1 个反思 |
| `assessment` | 默认 0 个，避免向独立作答加入额外教学要求 |
| `review` | 默认 1 个方法比较或总结反思 |

这些是可调整默认值，不是 validator 规则、配额或隐藏状态机。Coach 可以根据
能力目标、学生状态、题卡供给和学生讨论结果删除、增加或重排 Reflection Block，
并用现有 `Lesson Configuration / Adjustment` 说明原因。不新增
`reflectionPolicy` 字段。

某个 Reflection Block 仍可标记为 `required`，表示正常课程安排；学生提前结束
时，它的未完成状态原样保留给 Coach。

## Trace、快照与纠错

### 单一事实与读取优先级

课堂证据的权威事实是 active Trace。真实 Block 状态和 Lesson Session 是其
过程来源。其余文字分别承担不同时间点的压缩或决定：

- `## Lesson Summary`：Tutor 关课时生成的 Lesson 快照；
- Plan Summary、Current Position 和 Next Lesson Candidate：Coach 上次审计时
  写下的 Plan 决定；
- 长期记忆：Plan 完成后由学生逐项确认的历史结论；
- BKT、Planner Attention 和能力节点：可从 active Trace 重建的投影。

普通判断遵守：

```text
active Trace > Lesson Summary > Plan 中较早的叙述
```

Trace 被纠正后，不自动改写 Lesson Summary、Plan 或长期记忆。下一个拥有相应
决策权的正常工作流在需要时读取 active Trace，再决定是否更新自己的文件。这样
一次证据纠正不会触发跨文件级联事务。

### 同一次 attempt 的修正

一个 problem Block 表示一次独立作答，其 attempt 身份由现有事实
`lessonPath + blockId + cardPath` 确定。

以下情况属于同一次 attempt 的修正，应追加新 Trace 并用 `Supersedes` 指向当前
active Trace：

- Tutor 误判 assessment；
- 学生在该次作答尚未结束时改口或补全；
- 实际使用的 support 被记错；
- 学生确认、否定或更正方法节点；
- Tutor 接受学生对该次历史记录的异议。

旧 Trace 保留用于审计，但不再参与普通搜索和能力投影。

### 新的独立 attempt

学生后来重新做同一道题，无论表现变好还是变差，都是新的 evidence-bearing
attempt。它必须位于新的 problem Block 或新的 Lesson，并写入独立 Trace，不能
supersede 早先真实发生的作答。

例如第一次 `correct`、第二次 `incorrect` 时，两条 Trace 都保持 active。BKT
可以据此判断表现不稳定；同卡重复不能冒充不同题卡的独立迁移证据。

### 首次准确写入优先

supersede 是安全阀，不是日常写入流程。Tutor 首次写 Trace 时：

- Runtime 绑定 Lesson、Block、card、Session、时间和来源身份；
- 模型只填写不可推导的 assessment、实际 support、路线和简短判断；
- 先冻结学生自己的数学内容，再加入 Tutor 推理；
- 只有作答已经可判断时才写 Trace；
- 非标准路线先完整重构，不能直接按参考答案否定；
- 方法节点不确定时保持 `unmapped`，学生确认后才能绑定；
- Tutor 提供的决定性内容不能反向升级学生被冻结的独立作答；
- 已提出并被接受的异议必须在关课和生成 Summary 前完成 supersede。

这些规则通过 Skill、窄 tool schema、Runtime owner 绑定和真实模型验收共同实现，
不为每次 Trace 增加确认弹窗或额外裁判 Agent。

### 投影不反向改写事实

- BKT、能力节点和 Planner Attention 只聚合 active Trace；
- 来源 Trace 已失效的另解不参与能力投影，但历史 sidecar 不被自动改写；
- Lesson Summary 保留为关课快照；
- Plan 保留为 Coach 上次确认的决定；
- 长期记忆只在下一次 Plan 级聚合和学生确认时处理冲突。

极少数关课后才发现的历史误记，可以通过现有
`highschool-study:correct-learning-record` maintenance Skill 明确追加
superseding Trace。它报告受影响的快照和决定，但不自动重写它们。本轮不在 Pi
closed Lesson 中增加纠错模式、新工具或常驻入口。

## 唯一的持久化结课压缩

当前顶层 `## Reflection` 和 `## Lesson Summary` 由同一 Tutor 在同一时刻、
根据同一批来源生成，属于重复叙述。新设计只保留：

- `Kind: reflection` Block：可选的课堂活动；
- Tutor 的自然结课回顾：面向学生的 Session 消息；
- `## Lesson Summary`：learning set 中唯一持久化的关课摘要字段。

固定顶层 `## Reflection` 删除。Lesson Summary 记录：

- 本课实际完成的环节和可观察结果；
- 关课时 active Trace 所显示的 assessment、support 和方法证据；
- 尚未解决的问题、证据空缺和结束时所在节点；
- 学生明确表达的继续、调整或暂停意愿；
- 必要的 Lesson、Trace、题卡或材料来源链接。

它不替 Coach 决定下一节课，不宣称 Plan 达标，也不把推测写成学生画像。

Lesson Summary 会在 closed Lesson 中展示给学生，因此使用透明、可核对的语言，
不包含 Teacher Control、隐藏 rubric、未公开答案或 Planner 内部判断。Coach
需要更深判断时直接上溯 active Trace 和原始来源。

Tutor 的最终消息仍保留在原始 Session JSONL 中，但它是会话来源，不是第二个
learning-set 结课状态。

## 新的 `lesson_close` 契约

### 调用条件

Tutor 只有在学生明确选择结束 Lesson 后调用 `lesson_close`。调用前：

1. 结清已经接受的纠正；
2. 写完必须先于总结持久化的 Trace 或另解事实；
3. 从关课时的 active evidence、直接来源和真实课堂过程生成 Lesson Summary。

不需要：

- 把当前 Block 完成或跳过；
- 路由到 Reflection；
- 激活 Reflection；
- 把 completed Reflection 重新激活；
- 为满足关课前置条件而改变任何 Block。

### 输入与原子写入

`lesson_close` 只接受一个模型填写字段：

- `summary`：source-linked Lesson 关课快照；提前结束时明确记录未进行的环节、
  证据空缺和关闭位置。

删除 `reflection` 参数。一次写入只执行：

1. 更新顶层 `## Lesson Summary`；
2. 将 Lesson frontmatter `status` 设为 `closed`。

它不读取 Reflection Block 状态，也不修改任何 Block。已经 `closed` 或
`abandoned` 的 Lesson 不再次执行关闭。

成功回执保持：

```json
{
  "ok": true,
  "ownerPath": "lessons/lesson-xxx.md",
  "status": "closed"
}
```

Tutor 只有收到当前 ownerPath 的成功回执后才能宣布正式结课。

## 关闭后的状态与学生体验

关闭时保留所有 Block 的真实状态：

- `completed`：关闭前已经完成；
- `active`：学生结束时所在的课堂节点；
- `pending`：尚未进行；
- `skipped`：课堂中已经明确跳过。

closed Lesson 中的 `active` 不表示仍有运行中 Session。前端在回放中将其展示为
“结束时所在节点”，不写回 Markdown。

`lesson_close` 成功并结束当前 Tutor turn 后，前端不自动切换 Coach，而是停留在
当前 closed Tutor Session：

- 聊天区保留 Tutor 的最终自然语言回顾；
- Lesson notebook 从同一个 `## Lesson Summary` 渲染“结课时记录”，即使模型
  在工具后没有额外文本，学生仍能看到持久化快照；
- 输入区保持只读；
- 学生读完后点击“返回 Coach”，才切回原 Plan 的 Coach Session。

不增加 closed correction mode、额外路由状态或持久化字段。

## Skill 语义

Tutor Skill：

- 以首次准确写入为目标，区分同一次 attempt 修正和新的独立 attempt；
- 学生明确结束后停止新的教学和 Reflection 问题；
- 结清已接受纠正和必要事实；
- 根据关课时 active evidence 生成唯一的 Lesson Summary；
- 调用一次 `lesson_close`，不为关课改变 Block；
- 只有成功回执后才宣布关闭并自然回顾本课。

Coach Skill：

- 把 Lesson Summary 当作关课快照和检索入口，不当作最新能力事实；
- 做 Plan 决定前以 active Trace 和可观察标准为准；
- 只有 Coach 在正常复盘中调用 `plan_update` 才改变 Plan 决定。

Claude 插件的 `correct-learning-record` Skill：

- 只追加精确的 superseding Trace；
- 重读 active evidence 并报告受影响的 Summary、Plan 或画像；
- 不自动重写这些快照，也不静默修改学生确认的长期记忆。

Skill 不描述 Runtime 错误恢复，不测试固定措辞。

## 代码范围

修改：

- `apps/pi-teaching-web/src/study/write-workspace.ts`
  - 删除 `activeReflectionBlockId`；
  - `closeLesson` 输入只保留 `summary`；
  - 关闭不再修改 Reflection Block；
  - 拒绝重复关闭终态 Lesson。
- `apps/pi-teaching-web/src/runtime/lesson-close.ts`
  - 删除 active Reflection 前置条件和 `reflection` 参数；
  - 成功回执保持不变。
- `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
  - 删除全局“恰好一个 reflection”校验；
  - 继续支持 `kind: reflection`；
  - 不再生成顶层 `## Reflection`。
- `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
  - 删除 `LESSON_REFLECTION_COUNT`；
  - admission 接受 0、1 或多个 Reflection Block；
  - admission 不再要求顶层 `## Reflection`。
- `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
  - 工具描述不再宣称 Lesson 必须恰好包含一个 Reflection Block。
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
  - 更新首次写入、attempt、supersede 和关课语义。
- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
  - 明确 active Trace 高于 Summary 快照。
- `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
  - 删除“恰好一个 reflection Block”和顶层 `## Reflection` 要求。
- `plugins/highschool-study/skills/prepare-next-lesson/references/classroom-templates.md`
  - 写明 Reflection 的可调整默认安排。
- `plugins/highschool-study/skills/close-lesson-reflection/SKILL.md`
  - 关闭时只持久化 Lesson Summary。
- `plugins/highschool-study/skills/correct-learning-record/SKILL.md`
  - 删除自动重建 Lesson、Plan Summary 的要求。
- `apps/pi-teaching-web/src/client/components/LessonNotebook.tsx`
  - closed Lesson 的 active Block 显示“结束时所在节点”；
  - 显示唯一的 Lesson Summary。
- `apps/pi-teaching-web/src/study/student-notebook.ts` 与
  `apps/pi-teaching-web/src/shared/contracts.ts`
  - closed Lesson 的学生安全投影增加 Lesson Summary。
- `apps/pi-teaching-web/src/client/state.ts` 与
  `apps/pi-teaching-web/src/client/App.tsx`
  - 关闭 snapshot 不再自动选择 Coach；
  - closed replay 保持只读并显式“返回 Coach”。
- `AGENTS.md` 与 `docs/zh-CN/完整说明书.md`
  - 更新 Trace、快照、Reflection、关课和 Coach 权限边界。
- `examples/derivative-demo/learning-set/lessons/lesson-003.md`
  - 删除固定顶层 `## Reflection`，保留原有 Block、Trace 和 Lesson Summary。
- 对应 executable tests。

不增加：

- `lesson_summary_update` 或其他 Pi 工具；
- closed Lesson 纠错 UI；
- 新持久化字段、Agent、规则引擎、迁移器或兼容分支；
- 第五个公共 MCP。

不修改：

- 公共 Trace schema；
- `classroom_update` schema；
- 原始 Pi Session JSONL。

仓库内示例与 fixture 直接改为新结构。外部历史 Lesson 残留的顶层
`## Reflection` 不再作为结构字段读取、写入或视为权威，也不在关课时自动删除。

## 测试

不测试 Skill 固定措辞，只测试可执行契约和真实教学行为。

### Lesson 与关课

1. 0、1、多个 Reflection Block 均可生成并通过 admission；
2. 生成结果没有固定顶层 `## Reflection`，但始终包含 `## Lesson Summary`；
3. 从 active Reflection、completed Reflection、active problem 或没有
   Reflection Block 的 Lesson 都能一次关闭；
4. 关闭只更新 Lesson Summary 和 Lesson status，所有 Block 状态保持原样；
5. 缺少 Lesson Summary 时整次写入失败且文件不变；
6. 已 closed 或 abandoned 的 Lesson 不能重复执行关闭；
7. `lesson_close` schema 只有 `summary`，不暴露路径、Block 或状态选择权。

### Trace 与投影

1. 同一次 attempt 的 completion、accepted correction、support 或方法更正通过
   supersede 只留下一个 active Trace；
2. 同卡的第二次独立作答位于新 Block，两条 Trace 都保持 active；
3. `correct → incorrect` 的独立 attempts 被投影为不稳定，而不是覆盖第一次；
4. BKT 和 Planner Attention 不读取 superseded Trace；
5. 来源 Trace 失效的另解不参与能力投影；
6. supersede 后 Lesson Summary section、Plan 文件和画像文件保持不变。

### 前端

1. active Lesson 的 active Block 显示“进行中”；
2. closed Lesson 的 active Block 显示“结束时所在节点”；
3. active → closed snapshot 后仍选中原 Tutor Session；
4. closed Lesson 显示 Lesson Summary 和最终 Tutor 消息；
5. closed 输入保持只读；
6. “返回 Coach”才切换原 Coach Session；
7. 刷新后保持 closed Lesson 路由和只读回放。

### 真实模型验收

在复制的 learning set 上至少覆盖：

1. Reflection 回答与结束请求在同一轮；
2. Reflection 回答后，下一轮单独确认结束；
3. 没有 Reflection Block 时在 problem Block 中提前结束；
4. 含多个局部 Reflection Block 时中途结束；
5. 学生在关课前提出异议，Tutor 接受后先 supersede 再关闭；
6. 同卡后来出现一次新的独立错误作答，Tutor 写入新 Block Trace 而不 supersede
   早先正确证据。

所有关课路径只调用一次 `lesson_close`，没有为了关课而调用
`classroom_update`。最终文件保留真实 Block 状态，只写一份 Lesson Summary。

## 成功标准

- 学生在哪一轮、哪一个 Block 选择结束，不影响 `lesson_close` 是否成功；
- Lesson 关闭不再暗示 Reflection Block 完成；
- Blueprint 与 admission 接受 0、1 或多个 Reflection Block；
- 模板提供可调整默认值，不重新成为 validator；
- 固定顶层 `## Reflection` 与 `lesson_close.reflection` 被删除；
- Lesson Summary 是 learning set 中唯一持久化关课摘要字段，不决定下一课；
- 同一次 attempt 可以纠错，新的 attempt 不覆盖旧的真实证据；
- active Trace 驱动 BKT、Planner Attention 和能力投影；
- Trace 更正不级联改写 Lesson Summary、Plan、另解 sidecar 或长期记忆；
- 学生看完结课记录后显式返回 Coach；
- 不增加新工具、新 Agent、持久化字段、规则引擎或兼容层。
