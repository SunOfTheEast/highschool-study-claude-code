# M2 对话内学习资产草稿设计

**状态：** 已讨论定稿，等待用户复核

**日期：** 2026-08-11

**适用范围：** `apps/pi-teaching-web` 的 Free Learning、Lesson Tutor 与 Plan 备课交付

## 一、问题与目标

StudyForge 已经能够保存 Note、回忆块和 Problem Card，也已经具备 revision、来源绑定、语义
标签与保存回执。当前缺口不是新的资产模型，而是保存前仍由教师用普通 Markdown 模拟一份
“候选资产”：内容层级不稳定，题卡答案可能被提前展开，前端无法把它呈现成保存后接近的
样子，学生也不容易分清教师说明与真正准备保存的内容。

本设计增加一个轻量的对话内草稿层，使学生在保存前看见结构清楚的 Note 或题卡，并继续用
自然语言确认、纠正或拒绝。它必须守住以下边界：

- 对话仍是师生协商的唯一入口；
- 模型仍负责理解自然语言确认与修改；
- Runtime 只负责结构化展示和既有的机械写入；
- 草稿可撤销，不是资产，不进入学习集目录；
- 保存资产不等于学生掌握，也不自动写记忆。

## 二、核心闭环

```text
学生请求整理，或当前讨论已经具体形成一种资产
→ 教师调用展示工具生成对话内草稿
→ 教师自然询问“要保存吗？有想改的地方直接告诉我”
→ 学生纠正：教师生成一张新草稿
→ 学生明确确认最新草稿：教师调用既有保存工具
→ Runtime 写入并返回可点击的资产回执
→ 教师收到成功回执后才说已经保存
```

教师可以主动整理草稿，不需要先增加一次“要不要整理”的确认。草稿只是可丢弃的对话内容，
真正的批准门只存在于持久化之前。讨论仍在发展时，不为了制造资产而中断它。

沉默、离开页面、继续讨论和只说“我懂了”都不构成保存确认；学生在已经看见完整草稿并被
询问是否保存后说“嗯”“可以”“保存吧”等自然回答，可以由模型按当前语境判断为明确确认。
Runtime 不用正则或固定口令重新判断这件事。

## 三、两个非写入展示工具

新增两个模型工具，而不是一个带大量可选字段的联合工具：

### 3.1 `propose_note`

输入只包含：

- `title`；
- `blocks`：沿用现有 Note 的 `markdown` / `recall` block；
- 修改既有 Note 时使用的可选 `target: { id, expectedRevision }`。

### 3.2 `propose_problem_card`

输入只包含：

- `stem`；
- `studentNote`；
- `standardAnswer`；
- `teacherRationale`；
- 修改既有题卡时使用的可选 `target: { id, expectedRevision }`。

Plan Session 中的同名工具由当前 Session 绑定一个更窄的“仅创建”参数版本：不接受
`target`，并额外要求 `lessonId`、`blockId`，以便学生确认后仍能沿既有
`save_prepared_problem_card` 路径挂回准确的 Lesson problem Block。Free Learning 与 Lesson
不出现这两个 Plan 专属参数。

两个工具调用只被投影成结构化 conversation item：执行本身不分配资产 ID，不写文件，不
刷新语义索引，不写足迹或记忆，也不把学生确认编码成内部状态。创建草稿时不提交 `tags`
或 `sourceAliases`；标签与来源继续由最终保存工具在原有证据边界内处理。

模型的原生 tool call 仍在 Pi Session 中保存完整输入，使模型在学生确认后能够沿用答案和
教师依据；投影给学生前端的 Problem Card conversation item 只包含题干、学生笔记与 revision
标识，不包含 `standardAnswer` 或 `teacherRationale`。答案边界由投影保证，不只依赖 CSS 隐藏。

## 四、对话内呈现

草稿以普通师生消息流中的一块内容出现，不打开独立编辑页，也不使用模态框。视觉上沿用当前
信纸、细线和朱砂小标题，不引入新的产品语法。

### 4.1 Note 草稿

- 显示“笔记草稿”或“笔记修改草稿 · 当前第 N 版”；
- 标题与 Markdown 正文直接展示；
- recall block 显示提示，答案默认折叠；
- “显示答案”只改变本地展示，不发消息、不写入、不改变草稿状态。

### 4.2 Problem Card 草稿

- 显示“题卡草稿”或“题卡修改草稿 · 当前第 N 版”；
- 只显示完整题干和学生笔记；
- 显示一句“标准答案将随题卡保存，作答后可查看”；
- 不渲染 `standardAnswer` 与 `teacherRationale`。

题卡草稿不因发生在已经讲完的讨论中就自动展示答案。学生确实要核对时，教师可以在普通
对话中讲解；统一的草稿规则仍保持先作答、再看标准答案，教师讲解不直接成为学生可见答案。

草稿没有“保存”“修改”按钮。学生直接输入确认或修改意见；教师根据修改重新调用展示工具。
每次调用生成一张新的 transcript item，旧草稿保留为当时真实发生的对话，不回写、不折叠成
“已失效”，也不需要草稿 ID 或状态机。

## 五、保存与 revision

创建新资产时，学生确认最新草稿后继续调用现有 `save_note`、`save_problem_card` 或
`save_prepared_problem_card`。最终保存必须沿用最新草稿中的学生可见内容；如果教师改变了
标题、正文、回忆块、题干或学生笔记，必须先展示新草稿。

修改既有资产使用同一条链：

```text
读取当前资产 revision
→ 展示“当前第 N 版”的修改草稿
→ 学生纠正或确认
→ 用 target: { id, expectedRevision } 保存下一版
```

旧 revision 继续由现有资产系统保留；并发修改仍由现有 stale revision 检查拒绝。草稿层不
复制 revision 存储，也不尝试合并冲突。只有现有保存契约允许修改的资产才进入 revision
流程；没有 M1b provenance 的 legacy Problem Card 仍然只读，Plan 中的备课题卡也只创建、
不修改既有题卡。

保存成功后，不修改先前草稿，而是在对话中追加既有保存工具的结构化回执，显示类似
“已保存为笔记 · Ksp 与离子积的边界”的可点击入口。模型从工具结果得知成功，收到回执后
才能自然说明已经保存。失败时保留草稿，使用学生可理解的错误说明，不声称已经完成。

当前通用工具投影只显示“笔记已保存 / 题卡已保存”，因此可点击回执是本次需要补齐的前端
投影，不假定它已经存在。回执从成功结果中的 asset kind、id 与 revision 生成路由；标题可由
保存工具同时返回的非持久化展示字段提供，不改变资产文件格式。

## 六、Session 装载边界

工具只装载在真实形成或交付学习内容的 Session：

| Session | 展示工具 | 最终保存工具 |
| --- | --- | --- |
| Free Learning | `propose_note`、`propose_problem_card` | `save_note`、`save_problem_card` |
| Lesson Tutor | `propose_note`、`propose_problem_card` | `save_note`、`save_problem_card` |
| Plan | 仅 `propose_problem_card` | `save_prepared_problem_card` |
| Roadmap / Meta | 无 | 无 |

Plan 只在 Lesson 已完成准备与交付后，为本次备课实际采用的教师自编题展示题卡草稿。课程方案
的批准不等于保存题卡，题卡保存失败也不改变 Lesson 已经可开始的事实。Plan 不因此获得
普通 Note 编辑能力。

Roadmap 与 Meta 不直接教授或交付一项学习资产，因此不装载展示工具，也不借此成为资料
编辑器。

## 七、Skill 与帮助文案

只修改行为实际发生的位置：

1. `free-learning/SKILL.md`：允许学生请求或内容具体成形时直接展示草稿；学生明确确认后再
   保存，纠正时重新展示；不为了产出资产打断讨论。
2. `tutor-lesson/SKILL.md`：先完成眼前教学动作，再走同一草稿与确认顺序；来源仍只能使用
   当前 Lesson 已绑定的别名。
3. `prepare-approved-lesson/SKILL.md`：把目前“完整展示题干、答案和笔记”的要求改为调用
   题卡草稿；答案与教师依据不公开，单独确认后才保存。
4. `resources/help/first-learning.md`：删除“值得保留”这一无法执行的抽象标准，改为学生可以
   主动要求整理，教师也可能在内容已经具体形成时给出草稿；保存前始终可纠正或拒绝。
5. 更新现有 `save_problem_card` 工具说明中“学生已经看见答案”的旧前提；保存授权针对已经
   看见的题干与笔记，不要求为授权而剧透答案。

不新增一棵“资产固化 Skill 树”，不把确认语义写入 Runtime，也不把 proposal 工具描述成
一种掌握度判断。

## 八、保持不动的数据与责任

- Note 与 Problem Card 的 durable schema 不变；
- revision、历史版本、来源、标签与语义索引机制不变；
- Problem Card 的作答、答案揭示和教师讲解边界不变；
- Session transcript 仍是草稿协商史，资产文件仍是最终内容；
- 对象记忆只依据学生真实表达、推导、比较或使用，不依据草稿或保存动作；
- 不新增草稿目录、proposal 表、确认字段、审批 token 或消息回写接口。

## 九、实现改动面

后续实现计划应限制在：

1. 新增两个无副作用的 proposal tool 定义及其 Free Learning、Lesson、Plan 装载；
2. 为 conversation item 增加两种 proposal details 投影；
3. 新增一组复用现有 Markdown/LaTeX 与 Note recall 样式的内联渲染组件；
4. 把目前的通用保存状态补成可点击资产回执，并让 Plan 保存题卡后也触发资产页面失效刷新；
5. 按第七节修改三处 Skill 与帮助文案；
6. 增加少量契约、投影与 Session 装载测试，以及真实模型小闭环验收。

不重构已有保存工具，不引入独立编辑器，不改变资产页编辑能力。

## 十、验收重点

自动化与真实模型验收至少覆盖：

1. 生成 Note 草稿不会创建文件、刷新索引或写记忆；回忆答案默认折叠且可本地展开。
2. 生成题卡草稿不会展示标准答案或教师依据，尤其不能剧透 Plan 中尚未上课的自编题。
3. 学生纠正后模型展示新草稿；未明确确认时不调用任何保存工具。
4. 学生自然确认后保存成功，模型能读取回执，学生能从回执打开资产。
5. 修改既有资产时使用当前 revision；过期 revision 按既有冲突路径失败，不覆盖新版本。
   Legacy Problem Card 与 Plan 备课题卡继续守住各自的只读 / 仅创建边界。
6. Free Learning 与 Lesson 能创建两类草稿；Plan 只能创建备课题卡草稿；Roadmap、Meta 看不
   到这些工具。
7. 保存资产不触发掌握判断或对象记忆提交，普通教学也不会为了展示功能频繁生成草稿。
