# Roadmap 私有选卡与无剧透 Plan 交接设计

日期：2026-07-29
状态：已通过对话设计，待实施计划

## 一、背景

学生安全真课验收中，Roadmap Coach 的问诊、长期目标确认和三周 Plan 设计均正常。
当学生要求第一节使用真实题卡诊断后，Roadmap Coach 调用两次 `card_search`，随后在
学生可见回复中同时公开：

- 完整诊断题面；
- 导函数的决定性因式分解；
- 显点与隐点的位置和作用；
- 两条候选路线；
- 同一张题将在第一节承担首次诊断。

虽然回复没有直接给出最终参数范围，但本课要观察的能力正是“能否独立发现结构并
选择路线”。因此这张题已经失去独立诊断价值。

问题不是 Roadmap Coach 看见了题卡，也不是提前出现任何题目都算错误。真正的冲突
是：完整题卡和解题骨架进入私有规划上下文后，又被自由文本投影到了学生界面。

当前链路存在一个明确空档：

1. Roadmap scope 拥有返回完整题卡的 `card_search`；
2. `safe` 投影只在 `lesson_prepare` 成功后抑制 Coach 的自由 final；
3. Roadmap Coach 不能调用 `lesson_prepare`；
4. 所以 Roadmap 在 `card_search` 后生成的纯文本 final 会被当作普通回复展示。

本设计保留 Roadmap 的素材判断能力，只修复私有检索与学生可见输出之间的边界。

## 二、设计目标

1. Roadmap Coach 可以私下搜索、读取和比较真实题卡。
2. 学生确认 Plan 后，Roadmap 可以用题库检查 Plan 是否有真实素材可落地。
3. Roadmap 可以在现有 Plan Markdown 中留下一个非绑定、非语义的题号，供 Plan
   Coach 重新检索。
4. 学生界面不出现题面、答案、方法、关键结构或选卡理由。
5. Plan Coach 必须重新检查题卡，可以采用、替换或忽略 Roadmap 留下的线索。
6. `safe` 实时事件与历史重建使用同一条投影语义。
7. 原始 Pi JSONL 与显式 `raw-stream` 调试模式保持完整。

## 三、非目标

本次不实现：

- 禁止 Roadmap Coach 使用 `card_search`；
- 已曝光题卡账本；
- 语义剧透分类器或额外裁判模型；
- Roadmap 到 Plan Coach 的私有消息队列；
- 候选卡专用 custom entry、hint ID 或 consumed marker；
- 新的公共 MCP 工具；
- Plan、Lesson、题卡、Trace 或长期记忆 schema；
- 自动选择题卡或强制 Plan Coach 采用 Roadmap 的候选；
- 循环式 post-tool 自动重试。

## 四、核心原则

### 4.1 选择权与披露权分开

Roadmap 可以私下查看完整题卡。学生可见面只接收已经确认的 Plan 事实和确定性状态，
不接收 Roadmap 的题卡比较过程。

### 4.2 Plan 先确认，题卡后核对

Roadmap 的问诊、Plan 目标、节奏、能力标准和 Test 必须先通过自然对话获得学生确认。
确认后，Roadmap 先按学生已经看过的草案写出完整 Plan，其中备课参考题号保持
“未核对”。只有这时才能调用 `card_search` 检查素材。

搜题后不得重新生成或扩写 Plan 内容；唯一允许的 Plan 修改是把“未核对”替换为一个
非语义题号，或在搜索为空时删除这行，然后立即调用 `plan_register`。这样完整题卡
不会成为任何学生可见 Plan 文本的生成来源。

题卡不反向替学生决定长期方向。检索只验证已确认 Plan 的可执行性，并为下一层备课
留下可选线索。

### 4.3 现有 Markdown 继续承担 Session 交接

Roadmap Session 与 Plan Coach Session 不复制聊天历史，也不增加新的隐藏传输协议。
Plan Coach 继续从注册后的 Plan 文件读取交接内容。

### 4.4 题号只是来源线索

Roadmap 可以在 `Next Lesson Candidate` 中写入一个非语义题号，例如：

```md
- 备课参考题号：mst_p0276
- 性质：仅供 Plan Coach 复核，不代表已经选定
```

题号必须是书本页码、例题号或题卡的短编号，不得使用包含函数、方法或答案语义的完整
文件名。它不是新字段，也不要求唯一绑定。Plan Coach 使用该编号重新
`card_search`：

- 命中一张时重新读取并判断；
- 命中多张时自行比较；
- 没有命中时按本课意图重新搜索。

Roadmap 不写完整路径、题面、方法、答案、关键结构或“为什么适合”。

## 五、正常数据流

```text
Roadmap 多轮问诊
  → 学生确认 Plan Goal、节奏、能力标准和 Test
  → Roadmap 按已确认草案写出完整 Plan，题号标为未核对
  → Roadmap 私下 card_search
  → 检查是否存在可用真实素材
  → 只替换或删除 Next Lesson Candidate 中的题号行
  → plan_register
  → safe 模式显示确定性 Plan 就绪消息
  → 学生进入独立 Plan Coach Session
  → Plan Coach 从 Plan 读取本课意图与可选题号
  → Plan Coach 重新 card_search、重新判断
  → lesson_prepare
  → Tutor 开课后才展示真实题面
```

Roadmap 的候选不会进入 Lesson。只有 Plan Coach 提交并通过 `lesson_prepare` 的题卡才
成为实际课堂资产。

## 六、学生可见投影

### 6.1 私有检索阶段

在 `safe` 模式下，Roadmap Coach 当前 turn 一旦成功调用 `card_search`：

- 工具状态只显示“正在核对课程素材”；
- 工具参数与完整结果保持不可见；
- 该 turn 随后的普通 assistant 自由文本不再投影；
- mixed tool message 继续沿用现有隐藏规则。

这条规则同时应用于实时事件和 Session 历史重建，不能只修其中一侧。

### 6.2 Plan 注册完成

成功的 `plan_register` 成为 Roadmap 私有检索 turn 的学生可见终点。运行时从注册
回执生成一条普通的确定性 Coach 消息，不使用模型的后续自由总结，也不新增
Plan-ready 卡片、`ConversationItem` 类型或前端组件：

```text
学习周期已建立
具体素材会由学习顾问在备课时重新核对。
```

这条消息不读取或展示题卡内容。Roadmap 随后生成的自由 final 继续被抑制；注册完成后
服务端现有的 learning-set 刷新负责让新 Plan 出现在界面中。

### 6.3 调试模式

`raw-stream` 保持现有语义：

- 允许显示模型原始文本与流式增量；
- 不修改 Pi JSONL；
- 明确只用于本地诊断，不作为学生默认体验。

## 七、职责文本

### 7.1 Roadmap Study

`roadmap-study` 增加以下边界：

1. 在学生确认 Plan 前，不调用 `card_search`。
2. 确认后先按学生看过的草案写出完整 Plan，再用真实题卡检查素材。
3. 搜题后不得重写 Plan 正文；只替换或删除预留的题号行，然后调用
   `plan_register`。
4. 不得解释题面、方法、答案、关键结构或选卡理由。
5. 如需留下线索，只在 `Next Lesson Candidate` 写非语义题号和“仅供复核”。
6. 不把题号描述成已经选定的课堂内容。

### 7.2 Plan Coach

`coach-study` 增加以下边界：

1. Roadmap 题号只是搜索线索，不是 Lesson 绑定。
2. 必须重新执行 `card_search` 并读取真实题卡。
3. 根据本课问诊、历史 Trace 和学生当前状态独立判断，可以忽略或替换。
4. 实际题卡只有通过 `lesson_prepare` 后才进入 Lesson。
5. `lesson_prepare` 前不向学生预告题面、方法或选卡理由。

## 八、异常处理

### 8.1 搜索为空

Roadmap 不编造题号。Plan 仍可正常注册，`Next Lesson Candidate` 只保留无剧透的本课
意图；Plan Coach 备课时重新搜索。

### 8.2 题号命中多张

不算结构错误。题号是来源线索，不是唯一外键。Plan Coach 比较真实候选后再决定。

### 8.3 Roadmap 生成剧透 final

`safe` 不展示该自由回复：注册成功后只保留确定性就绪消息，尚未注册时用下一节的固定
恢复消息替换。原始 JSONL 保留，便于审计模型行为。

### 8.4 搜题后提前生成自由回复

不循环调用模型。若 Roadmap `card_search` 成功后、`plan_register` 尚未成功时模型先
生成了纯文本 final，`safe` 投影用固定恢复消息替换该 final：

```text
课程素材已经核对，但学习周期尚未登记。可以继续完成当前计划。
```

同一 Session 保持可恢复。完全没有 assistant final 的空 turn 沿用现有通用运行状态和
历史重建，不为本次问题增加 custom entry、持久恢复状态或专用 `agent_end` 协议。

### 8.5 Plan 注册失败

保留现有明确错误和同一 Session。失败回执不生成 Plan 就绪消息，也不能把候选题卡
信息投影给学生。Roadmap 根据错误修正 Plan 后重新注册。

## 九、实现边界

预计只需要修改现有表面：

- Roadmap 与 Plan Coach 的 Skill 文本；
- live safe projector；
- stored conversation projector；
- Plan 注册回执到普通 Coach 消息的确定性投影；
- 相应的 projection 测试和真实模型验收。

不增加数据库、文件类型、公共工具、共享前端契约、前端组件或跨 Session 存储。服务端
现有 Roadmap turn 完成后的 learning-set 刷新保持不变。生产代码预计约 60–140 行，
主要影响两份 Skill 和两个 projector，测试集中在两个 projection 测试文件。

运行时只确定性保证聊天投影不泄露检索结果。Plan 正文“先写完整草案、搜题后只改短题号”
由 Skill 顺序契约和真实模型验收保证；本次不增加 Plan diff guard 或语义剧透检查器。

## 十、验证

### 10.1 确定性测试

1. Roadmap `card_search → 带题面/方法的纯文本 final`：safe 实时事件不发布该消息。
2. 同一历史重建：safe history 不包含该消息。
3. `card_search → plan_register → 自由 final`：学生只收到一个 Plan 就绪投影。
4. 搜索为空且 Plan 合法：Plan 正常注册，没有伪造题号。
5. 搜题后在 `plan_register` 前出现纯文本 final：用固定恢复消息替换，不显示剧透文本。
6. `raw-stream` 继续显示原始文本。
7. 原始 Pi Session JSONL 保留完整工具结果和模型回复。
8. 工具列表、Plan schema、Lesson schema 与公共 MCP 工具数量不变。

Skill 与 Agent prose 不增加逐行文本测试；行为边界由投影测试和真实模型验收覆盖。

### 10.2 真实模型验收

从新的 Roadmap Session 重跑同一自然场景：

1. 学生要求第一节使用真实题卡诊断；
2. Roadmap 完成问诊并先获得 Plan 确认；
3. Roadmap 私下搜索真实题卡；
4. 学生界面只出现工作状态和 Plan 就绪消息；
5. Plan 的 `Next Lesson Candidate` 最多出现一个非语义题号；
6. 不出现题面、方法、关键变形、驻点、答案或选卡理由；
7. Plan Coach 根据题号重新搜索并明确保留独立判断；
8. `lesson_prepare` 成功后仍只显示课程就绪卡；
9. Tutor 开课后题面才首次出现。

验收应同时检查学生截图、safe history、原始 JSONL、注册后的 Plan 和 Plan Coach
Session，确认“学生未看见”与“私有选卡信息确实存在”同时成立。

## 十一、取舍结论

本设计不通过削弱 Roadmap 的题库访问来换取安全，也不增加语义剧透分类器。它采用
更窄的写入顺序、作者契约和确定性聊天投影：

- Plan 方向先由学生确认；
- 完整 Plan 在读取题卡前写好；
- 真实题卡随后私下核对；
- 搜题后只允许替换非语义题号；
- Markdown 只交接非语义题号；
- 学生只接收现有事实工具生成的确定性状态；
- Plan Coach 对实际 Lesson 重新负责。

这样既保留素材判断质量，也维持当前 Markdown-first、Session 分层和无额外记忆服务
的总体架构。
