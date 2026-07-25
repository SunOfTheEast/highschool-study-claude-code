# Lesson 关闭与 Reflection 解耦设计

## 背景

当前 Pi Tutor 把两条本应独立的状态轴耦合在一起：

- Lesson 生命周期：`active`、`paused`、`closed`、`abandoned`；
- 课堂 Block 流程：`pending`、`active`、`completed`、`skipped`。

`lesson_close` 当前只接受“恰好一个 `Kind: reflection` 且
`Status: active` 的 Block”，随后把该 Block 改为 `completed`，再写入顶层
`## Reflection`、`## Lesson Summary` 和 Lesson 的 `status: closed`。

真实课堂已经证明该契约依赖学生在哪一轮表达结束：

- 学生在 Reflection 回答中同时要求结束时，Reflection 仍为 `active`，
  `lesson_close` 一次成功；
- 学生先完成 Reflection、下一轮再确认结束时，Reflection 已为
  `completed`，`lesson_close` 失败；
- 学生在 problem Block 中提前结束时，active Block 不是 Reflection，
  `lesson_close` 失败。

这不是参数错误、旧 Skill、前端竞态或 Provider 中断。新版 Tutor Skill 已在
新 Session 中正确加载；错误来自运行时对 active Reflection 的固定前置条件。

## 设计原则

### 两条状态轴互不代替

Reflection Block 是课程安排的一部分，与 problem、material、dialogue 一样由
模板、依赖、`required` 和课堂路线决定。

`lesson_close` 是学生随时可以触发的 Lesson 生命周期动作。它不表示课程模板已
正常走完，也不表示能力标准已经达成。

因此：

- Block 是否必做，不限制学生结束 Lesson；
- Lesson 已关闭，不把未完成 Block 伪装成已完成；
- Coach 根据真实 Block 状态、Trace 和 Lesson Summary 判断课程完成度；
- Plan 是否完成仍由后续 Plan 审计决定。

### Reflection Block 由模板提供可调整默认值

Reflection Block 是学生实际参与的课堂环节，不是每一种 Lesson 都必须具有的
结构占位符。Blueprint 和 prepared admission 不再全局要求“恰好一个
Reflection Block”，而是允许 0、1 或多个。

六种 canonical template 继续存在，但只提供备课起点：

| Template | Reflection Block 默认安排 |
| --- | --- |
| `diagnostic` | 默认 0 个；诊断证据由结课复盘汇总，需要学生自述时可增加 1 个 |
| `concept` | 默认 1 个可调整的结尾反思；若 exit quiz 已承担收束作用可删除 |
| `deliberate-practice` | 默认不设统一结尾反思；可在关键练习组后插入 1 个或多个局部反思 |
| `remediation` | 默认在 unseen retest 后安排 1 个反思，用于说清修正后的判断依据 |
| `assessment` | 默认 0 个，避免在独立作答中混入额外教学要求 |
| `review` | 默认 1 个方法比较或总结反思，可按课堂节奏调整 |

这些是可调整默认值，不是 validator 规则、配额或隐藏状态机。Coach 可以根据
能力目标、学生状态、题卡供给和学生讨论结果删除、增加、重排 Reflection
Block，并用现有 `Lesson Configuration / Adjustment` 说明偏离默认安排的原因。
不新增 `reflectionPolicy` 字段。

Block 的 `required`、依赖、顺序和路线语义保持不变。某个 Reflection Block
可以被标记为必做，用来表达正常课程安排；但学生仍可随时结束 Lesson，未完成
状态会原样保留给 Coach 审计。

### 只保留一份持久化结课压缩

当前顶层 `## Reflection` 和 `## Lesson Summary` 都由 Tutor 在同一次关课中，
根据同一批 Trace、课堂过程和直接来源生成。两者的写入者、生命周期和事实来源
相同；仅靠“一个面向学生、一个面向 Coach”的措辞约定，不能防止重复、矛盾或
更正遗漏。

新设计明确区分三个对象：

- `Kind: reflection` Block：学生参与的课堂活动，数量由模板默认与 Coach
  调整共同决定；
- Tutor 的自然结课回顾：面向学生的会话消息，保留在 Lesson Session 原始记录；
- `## Lesson Summary`：本 Lesson 唯一持久化的结课压缩，供 Coach 和后续同
  Plan Lesson 上溯使用。

固定顶层 `## Reflection` 删除。学生在 Reflection Block 中说过什么，仍可从
Lesson Session 原始记录上溯；其中影响能力判断、实际支持、方法路线或纠正的
事实必须先进入 active Trace，不能只留在自然语言总结中。

`## Lesson Summary` 只交接已经发生的事实：

- 本课实际完成的环节和可观察结果；
- active Trace 所显示的作答、支持和方法证据；
- 尚未解决的问题、证据空缺和关闭时所在节点；
- 学生明确表达的继续、调整或暂停意愿；
- 必要的 Lesson、Trace、题卡或材料来源链接。

它不替 Coach 决定下一节课内容，不宣称 Plan 达标，也不把推测写成学生画像。
Coach 结合 Plan 标准、前序 Lesson Summary、active Trace 和学生选择，另行决定
下一步。

Lesson Summary 是带来源的持久化压缩，不是新的课堂证据。active Trace、真实
Block 状态和 Lesson Session 仍是可上溯事实；若上游证据通过 supersede 被
纠正，任何受影响的 Lesson Summary 都必须按现有纠错流程重建，普通读取不得用
旧摘要覆盖 active Trace。

Lesson Summary 同时允许学生在 closed Lesson 回放中查看，因此必须使用透明、
可核对的语言，不包含 Teacher Control、隐藏 rubric、未公开答案或 Planner
内部判断。Coach 需要更深判断时直接上溯 active Trace 和原始来源，不把私有推测
塞进 Summary。

### 关课后的纠错闭环

学生课后纠正的是“过去那次作答被记录错了”，不是补交一次新作答。closed
Lesson 保持 `closed`，原 Tutor Session、Lesson owner 和 Block 状态都不改变，
也不创建新 Agent 或新 Lesson。

closed Lesson 回放提供“纠正课堂记录”入口。学生点击后，前端在同一个 Tutor
Session 中临时开放多轮输入；刷新页面或学生主动退出纠错后恢复只读。Tutor：

1. 定位学生所指的历史 attempt、active Trace 和原始会话；
2. 若身份或纠正范围不明确，先询问，不猜测；
3. 若 Trace 记录错误，调用现有 `trace_append` 追加 superseding Trace；
4. 重新读取 active Trace，并用 `lesson_summary_update` 重建唯一的 Lesson
   Summary；
5. 向学生说明改动了什么、仍有什么不确定。

若 Trace 本身正确、只有 Summary 表述失真，Tutor 可在核对来源后直接调用
`lesson_summary_update`。若学生展示的是关课后新完成的解答、后来学会的方法或
新的能力证据，则不 supersede；返回 Coach，由新 Lesson 或新 attempt 承载。

`lesson_summary_update` 是 Pi Tutor 私有工具，不是第五个公共 MCP。它：

- 只接受 `summary`；
- 从 Tutor Session 绑定真实 `ownerPath`；
- 只允许更新 `status: closed` Lesson 的顶层 `## Lesson Summary`；
- 不修改 Trace、Block、Lesson status、Plan 或画像；
- 成功后返回当前 `ownerPath` 与 `status: closed`。

它与 superseding Trace 是顺序闭环而非伪原子事务：Trace 先成为正确事实，
Summary 更新失败时 active Trace 仍然有效，Coach 必须优先读取 Trace；Tutor
可以重试 Summary 更新，但不能回滚或复制 Trace。

## 新的 `lesson_close` 契约

### 调用条件

Tutor 只有在学生明确选择结束 Lesson 后调用 `lesson_close`。

调用前只需：

1. 结清已经接受的纠正；
2. 写完必须先于总结持久化的 Trace 或另解事实；
3. 从现有 active evidence、直接来源和真实课堂过程生成 source-linked Lesson
   Summary。

不需要：

- 把当前 Block 完成或跳过；
- 路由到 Reflection；
- 激活 Reflection；
- 把 completed Reflection 重新激活；
- 为满足关课前置条件而改变任何 Block。

### 输入

`lesson_close` 只接受一个模型填写字段：

- `summary`：本 Lesson 的 source-linked handoff，按照上述事实边界压缩；提前
  结束时明确记录未进行的环节、证据空缺和关闭位置。

删除 `reflection` 参数。学生可见的结课回顾由 Tutor 在成功关课后的自然语言
回复中表达，不作为第二份 Markdown 事实写入。

### 原子写入

`lesson_close` 在一次写入中只执行：

1. 更新顶层 `## Lesson Summary`；
2. 将 Lesson frontmatter `status` 设为 `closed`。

它不读取 Reflection Block 状态，也不修改任何 Block 状态。

成功回执保持：

```json
{
  "ok": true,
  "ownerPath": "lessons/lesson-xxx.md",
  "status": "closed"
}
```

Tutor 只有收到当前 ownerPath 的成功回执后才能宣布正式结课。

## 关闭后的状态解释

关闭时保留所有 Block 的真实状态：

- `completed`：关闭前已经完成；
- `active`：学生结束时所在的课堂节点；
- `pending`：尚未进行；
- `skipped`：课堂中已经明确跳过。

`closed` 是 Lesson 级终态，因此 closed Lesson 中的 `active` 不表示仍有运行中
Session。学生若只是暂时离开，应使用 `pause`，而不是 `close`。

前端在 closed Lesson 的回放中，把 `active` 的展示标签投影为“结束时所在节点”，
避免显示为“进行中”。该变化只属于展示投影，不写回 Markdown。

### 结课回顾与返回 Coach

`lesson_close` 成功并结束当前 Tutor turn 后，前端不再自动切换到 Coach，而是
停留在当前 closed Tutor Session：

- 聊天区保留 Tutor 的最终自然语言回顾；
- Lesson notebook 从同一个 `## Lesson Summary` 渲染“本课记录”，即使模型在
  工具后没有额外文本，学生仍能看到持久化结课事实；
- 输入区默认只读，并显示“纠正课堂记录”和“返回 Coach”两个动作；
- 学生读完后点击“返回 Coach”，才切回原 Plan 的 Coach Session。

这不增加新的路由状态或持久化字段。是否处于纠错输入只属于当前前端页面状态；
Lesson 的 durable status 始终是 `closed`。

## Skill 语义

Tutor Skill 的 closure 段落改为一条高层语义：

- 学生明确选择结束后，停止新的教学和 Reflection 问题；
- 结清已接受纠正和必要事实；
- 根据真实证据生成唯一的 Lesson Summary；
- 调用一次 `lesson_close`；
- 不为了关闭 Lesson 而改变 Block 路线或状态；
- 只有成功回执后才宣布关闭，并用自然语言向学生回顾本课。

closed Lesson 的 correction 段落只处理历史记录纠错：区分 supersede 与新
attempt，先修正 Trace，再更新 Lesson Summary。Skill 不描述运行时错误恢复，
不要求模型维护 active Reflection 技术令牌。

## 代码范围

修改：

- `apps/pi-teaching-web/src/study/write-workspace.ts`
  - 删除 `activeReflectionBlockId`；
  - `closeLesson` 不再调用 `replaceBlockStatus`。
  - `closeLesson` 输入只保留 `summary`，不再写顶层 `## Reflection`。
- `apps/pi-teaching-web/src/runtime/lesson-close.ts`
  - 工具描述删除 active Reflection 前置条件；
  - 参数删除 `reflection`，只保留 `summary`；
  - 成功回执保持不变。
- `apps/pi-teaching-web/src/runtime/lesson-summary-update.ts`
  - 新增 Session-bound `lesson_summary_update`；
  - 只更新 closed Lesson 的 `## Lesson Summary`。
- `apps/pi-teaching-web/src/runtime/session-factory.ts`
  - Tutor 增加 `lesson_summary_update`，Coach 不获得该工具。
- `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
  - 删除全局“恰好一个 reflection”校验；
  - 继续支持 `kind: reflection`；
  - 不再生成顶层 `## Reflection`。
- `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
  - 删除 `LESSON_REFLECTION_COUNT`；
  - admission 接受 0、1 或多个 Reflection Block；
  - admission 不再要求顶层 `## Reflection` section。
- `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
  - 工具描述不再宣称 Lesson 必须恰好包含一个 Reflection Block。
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
  - 关闭协议改为与 Block 无关，只生成 Lesson Summary；
  - 增加 closed Lesson 历史纠错边界。
- `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
  - 删除“恰好一个 reflection Block”和顶层 `## Reflection` 要求。
- `plugins/highschool-study/skills/prepare-next-lesson/references/classroom-templates.md`
  - 写明各模板的可调整 Reflection 默认安排。
- `plugins/highschool-study/skills/close-lesson-reflection/SKILL.md`
  - 关闭时只持久化 Lesson Summary；Reflection 仍可作为课堂活动或会话过程。
- `apps/pi-teaching-web/src/client/components/LessonNotebook.tsx`
  - closed Lesson 的 active Block 显示“结束时所在节点”；
  - 从 StudentNotebook 投影显示唯一的 Lesson Summary。
- 若仍被使用，`ActivityDrawer.tsx` 应采用相同投影规则。
- `apps/pi-teaching-web/src/study/student-notebook.ts` 与
  `apps/pi-teaching-web/src/shared/contracts.ts`
  - closed Lesson 的学生安全投影增加 Lesson Summary。
- `apps/pi-teaching-web/src/client/state.ts` 与
  `apps/pi-teaching-web/src/client/App.tsx`
  - 关闭 snapshot 不再自动选择 Coach；
  - closed replay 提供本地纠错输入开关和显式“返回 Coach”。
- `AGENTS.md` 与 `docs/zh-CN/完整说明书.md`
  - 删除 admission 的全局 Reflection 数量与顶层 section 要求；
  - 说明模板默认、Lesson Summary、课后纠错和 Coach 决策权的边界。
- `examples/derivative-demo/learning-set/lessons/lesson-003.md`
  - 删除固定顶层 `## Reflection`，保留原有 Block、Trace 和 Lesson Summary。
- 对应 executable tests。

不修改：

- `classroom_update` schema；
- Trace、能力投影、Plan 审计；
- 公共 Claude Code MCP；
- 原始 Pi Session JSONL。

不增加运行时迁移器或兼容分支。仓库内示例与 fixture 直接改为新结构；外部历史
Lesson 中残留的顶层 `## Reflection` 不再被读取、写入或视为权威，也不在关课时
自动删除。

## 测试

不测试 Skill 固定措辞，只测试可执行契约。

### 持久化测试

1. 0、1、多个 Reflection Block 的 Blueprint 均可生成并通过 admission；
   生成结果不含固定顶层 `## Reflection`，但始终含 `## Lesson Summary`。
2. Reflection active 时关闭：
   - Lesson 变为 closed；
   - Reflection Block 仍为 active；
   - Lesson Summary 正确写入。
3. Reflection completed 时关闭：
   - 一次成功；
   - Reflection Block 仍为 completed。
4. problem active 且没有 Reflection Block 时提前关闭：
   - 一次成功；
   - problem 仍为 active；
   - 后续 Block 保持原状态。
5. 多个 Reflection Block 时关闭：
   - 不选择、不完成其中任何一个；
   - 所有 Block 状态保持原样。
6. 缺少顶层 Lesson Summary 时：
   - 整次写入失败；
   - 文件字节不变。

### 工具测试

1. `lesson_close` 可从任意当前 Block 返回标准 owner receipt。
2. schema 只有 `summary`，不暴露路径、Block ID 或关闭状态选择权。
3. `classroom_update` 不参与关闭。
4. `lesson_prepare` 不因 Reflection Block 为 0 个或多个而拒绝 Lesson。
5. `lesson_summary_update` 只在 Session-owned closed Lesson 上成功：
   - 只替换 Lesson Summary；
   - frontmatter、Block 和 Trace 字节保持不变；
   - prepared、active、paused 或错误 owner 均被拒绝。
6. superseding Trace 成功但 Summary 更新失败时：
   - 新 Trace 保持 active；
   - 旧 Trace 保持 superseded；
   - 不追加第二条纠正 Trace。

### 前端测试

1. active Lesson 的 active Block 仍显示“进行中”；
2. closed Lesson 的 active Block 显示“结束时所在节点”；
3. active → closed snapshot 后仍选中原 Tutor Session；
4. closed Lesson 显示持久化 Lesson Summary 和最终 Tutor 消息；
5. 默认输入只读，学生可显式进入和退出多轮纠错；
6. “返回 Coach”才切换原 Coach Session；
7. closed Lesson 仍可完整回放，刷新后保持原 Lesson 路由并恢复只读。

### 真实模型验收

在复制的 learning set 上至少覆盖六种对话：

1. Reflection 回答与结束请求在同一轮；
2. Reflection 回答后，下一轮单独确认结束；
3. 没有 Reflection Block 的 Lesson 在 problem Block 中提前结束；
4. 含多个局部 Reflection Block 的 Lesson 在中途结束；
5. 关课后学生纠正一次错误的 assessment、support 或方法绑定；
6. 关课后学生提交新解答，Tutor 不 supersede，返回 Coach 安排新 attempt。

前四种关课路径都必须只调用一次 `lesson_close`，没有为了关课而发生的
`classroom_update`，最终文件保留真实 Block 状态并只写一份 Lesson Summary。
后两种课后路径不再调用 `lesson_close`：纠错复用原 Tutor Session，正确 Trace
成为 active，Summary 随之更新，Lesson 始终保持 closed；新学习证据不伪装成
历史纠错。

## 成功标准

- 学生在哪一轮、哪一个 Block 选择结束，不再影响 `lesson_close` 是否成功；
- Lesson 关闭不再暗示 Reflection Block 完成；
- Blueprint 与 admission 接受 0、1 或多个 Reflection Block；
- 模板给出可调整的 Reflection 默认安排，Coach 的修改不需要绕过 validator；
- 固定顶层 `## Reflection` 与 `lesson_close.reflection` 被删除；
- Lesson Summary 成为唯一持久化结课压缩，只交接事实而不决定下一课；
- 面向学生的结课回顾稳定留在 closed Tutor Session，并由同一 Lesson Summary
  提供结构化回退；
- 学生显式返回后才切换 Coach，Reflection Block 仍表达正常课堂安排；
- 关课后可在原 Tutor Session 纠正历史 Trace 并同步重建 Lesson Summary；
- 新作答不能通过 supersede 冒充对旧记录的修正；
- Lesson Summary、Trace 和原始 Tutor Session 继续为 Coach 提供可上溯证据；
- 不增加持久化字段、新 Agent、规则引擎或兼容层；只新增一个 Pi 私有 Summary
  更新工具，公共 MCP 仍为四个。
