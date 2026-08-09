# 学生安全六课续跑验收

日期：2026-07-29  
结论：`PASS WITH FINDINGS`

本轮承接
[学生安全六课复验](./2026-07-29-student-safe-six-lesson-rerun.md)。
上一轮在 Lesson 5 开始前发现学生可见 Plan 面板泄露私有备课信息，因此冻结运行；
本轮先合并学生安全投影实现，再从未受污染的 Lesson 5 入口继续完成：

```text
Lesson 5
  → Lesson 6
  → Quick Evidence Scout
  → Learning Review
  → 学生确认长期记忆
  → Plan 完成
  → 返回原 Roadmap Coach 跨周期复诊
```

本报告不保存凭据、隐藏提示、完整 thinking、完整题卡 payload 或完整聊天转录。

## Baseline

- 仓库：`highschool-study-claude-code`
- 合并后基线：`main@c45978c`
- 提交：`docs: complete student-safe projection plan`
- Runtime root：`/tmp/studyforge-six-lesson-final-zMsYzg`
- Provider / model / thinking：`deepseek / deepseek-v4-pro / high`
- Message projection：`safe`
- 续跑服务：`http://127.0.0.1:50728`
- Roadmap Coach：`019facec-5575-704f-b0ee-7033ae8842fa`
- Plan Coach：`019facf3-908c-7854-9615-cac2ee9f2bc2`
- Lesson 5 Tutor：`019fae51-7368-7664-b996-47be21f9a7a6`
- Lesson 6 Tutor：`019fae5a-757f-721d-a875-0c83861b9394`
- Evidence Scout：`wf-7ac4e955-282d-4d76-95c5-b80e748b6a15`

## Student-safe Projection

修复目标通过。

Lesson 5 和 Lesson 6 开始前，学生可见页面只显示：

- 公开学习目的；
- 环节数量与一般活动形式；
- 题号；
- “具体题目会由课堂导师逐步展开”等普通说明。

学生开始课堂前没有看到：

- 题目表达式；
- 预设方法；
- 决定性变形；
- 候选路线及选卡理由；
- 预设换路信号；
- Lesson 的 Teacher Control。

Plan 面板不再通过自由文本旁路泄露私有备课信息。旧 Coach 历史中仍保留修复前已经
产生的泄露消息，但本轮学生在 Lesson 5 结束前没有打开该历史，因此没有污染首次作答。

## Lesson 5：中途换路

学生先独立完成第一问，第二问从直接作差、求导路线开始：

```text
发现隐零点难定位
  + 题设关键条件迟迟没有进入推理
  → 判断当前路线成本上涨
  → 主动决定换路
```

这部分没有 Tutor 提示。学生决定换路后，Tutor 给出“分离指数项和对数项，分别考察”
的方向提示；学生随后独立找到除以 `x^3` 的入口，并完成两侧最值估计。

最终证据边界正确保留为：

- 信号识别：独立；
- 换路决定：独立；
- 替代路线方向：Tutor 提示；
- 提示后的构造与计算：学生独立完成；
- 这是一次换路事件，不能升级为稳定能力。

### 非阻塞毛刺

学生曾追问题设条件究竟是 `e/3` 还是 `1/(3e)`。Tutor 没有直接回答该澄清问题，
虽然后续证明与课堂回放都采用了正确的 `e/3`。这是 P2 教学回应问题，不影响最终事实。

## Lesson 6：完整决策链收束

Lesson 6 使用 assessment 模板和表面结构不同的零点问题。学生在无提示条件下：

1. 独立完成基础小问；
2. 在执行前比较直接求导与按 `ln x` 符号分区间两条路线；
3. 判断直接求导会引入含参隐式零点；
4. 选择分区间路线；
5. 用参数上界、切线不等式与 `ln x / x` 最大值完成严格不等式链；
6. 确认方法节点为“切线放缩与凹凸性”，辅以“含参数分类讨论”。

本课证明了前摄比较、选路和执行可以在一次陌生题中无提示串联，但没有触发中途换路，
因此不能覆盖 Lesson 5 暴露的“换路后独立找到替代入口”缺口。

## Evidence Scout And Memory

Quick Evidence Scout 完成：

- 用时约 118 秒；
- 38,569 tokens；
- 15 次工具调用；
- 自动返回父 Coach Session；
- 没有出现工具结果后的空回复。

学生对五条记忆候选逐项修订，明确要求：

- 单次 clean 证据仍是单次，不写成稳定能力；
- Lesson 2 受课前脚手架影响；
- Lesson 3 只算同族无提示迁移，不算跨族稳定；
- Lesson 5 的触发信号是具体的，真正限制是事件仅一次且替代入口受提示；
- 不把六节课的方法过宽归为“充分/必要性探路”；
- 保留跨族信号、计时比较、多题连续决策、重复无提示换路和独立替代入口五个开放项。

最终结果：

- Plan 状态：`completed`；
- 六节 Lesson 全部：`closed`；
- Learning Review 已写入；
- 五条确认后的 teaching memory 已写入；
- Plan 与 `teaching-profile.md` 已由 Coach 回读；
- `student-profile.md` 本轮没有新增偏好，符合事实。

## Finding 1：Learning Review 证据层级重试循环

严重度：P1。

Plan 完成时，Coach 多次把普通课堂 Trace 填入 `keyEvidence`。运行时正确拒绝了这些
写入，典型错误包括：

```text
LEARNING_REVIEW_KEY_NOT_ASSESSMENT
LEARNING_REVIEW_SOURCE_INVALID
LEARNING_REVIEW_SOURCE_TIER_DUPLICATE
```

Coach 没有从错误中归纳出“keyEvidence 只接受 assessment Lesson 中 problem Block
上的 correct、support:none、active Trace”，而是不断更换 Lesson 1、3、4、Plan、
Roadmap 和题卡来源机械重试。

为停止无效循环，本轮重启了服务。原 Session 与全部事实恢复后，学生明确指出：

```text
keyEvidence:
  lessons/lesson-006.md#trace-event-003

supportingEvidence:
  Lesson 1–5 的 active Trace，并保留 limitation
```

Coach 随后一次完成 `plan_update(complete)`。运行时没有接受任何错误写入，Plan 在恢复
前一直保持未完成状态，因此没有数据损坏。

### 根因判断

这是工具契约对模型不够自解释，而不是 Learning Review 设计本身错误：

- tool schema 中 `source` 只是普通字符串；
- assessment、problem Block、active Trace 等约束只存在于执行期校验；
- 错误码只说明“不是 assessment”，没有返回当前 Plan 可用的候选来源；
- 模型在长周期末尾已经承载大量总结任务，容易把“最重要的事实”误当成
  “keyEvidence”，忽略这里的 `key` 实际表示“正式评估证据”。

同一 turn 中，`memory_review_propose` 还短暂引用了已被 supersede 的
`lesson-005#trace-event-002`，运行时拒绝后模型自行改为 active 来源并恢复。

## Finding 2：Roadmap 融合时重新过度归纳

严重度：P1。

Roadmap Coach 成功只读取压缩后的 Plan、Lesson 摘要/来源索引和确认画像完成复诊，
没有复制六节完整聊天。但第一次综合时出现两处错误：

1. 把只有一次 clean 证据的前摄双路比较称为“稳固起点”；
2. 把唯一一次换路误写成“始终换入充分/必要性探路”。

第二条同时犯了数量外推和方法改写。Lesson 5 实际换入的是 Tutor 给方向后的
“保值性与分治”路线。

学生指出后，Coach 在原 Roadmap Session 中正确修订：

- 多课稳定：仅技术执行（六课全正）；
- 单次 clean、需复现：前摄比较、换路信号与决策、同族无提示迁移；
- 受提示：换路后替代入口；
- 零覆盖：跨族信号、计时比较、多题连续决策；
- “方法空间过窄”降级为待诊断候选假设。

修订后更可靠的核心矛盾是：

> 组件能力在不同课堂中各自出现过，但尚未在一次无提示、计时的完整事件中串联为
> 比较 → 选择 → 执行 → 识别换路信号 → 换路 → 独立构造替代入口 → 完成。

这说明跨周期读取和融合链路已经工作，但系统仍依赖学生纠正 Coach 的二次文学加工；
它还没有稳定做到第一次就守住次数、支持等级和方法名称。

## Finding 3：Scout 进度可见性有限

严重度：P2。

Scout 可以在 180 秒预算内完成并自动回到父 Session，但前端只显示“正在回应”和
“1 个工作流”，没有实时显示检索、交叉核对、归纳等阶段。功能正确，长等待期间的
可解释性仍可提升。

## Final Assessment

本轮证明：

1. 学生安全投影已经堵住 Plan 自由文本绕过就绪卡的泄露通道；
2. 六节独立 Tutor Session、Plan Coach、Evidence Scout、Learning Review、长期记忆
   和 Roadmap 回访能够完成一个真实闭环；
3. Lesson 5/6 的证据边界能够区分独立、受提示和未触发；
4. 压缩后的 Plan 与确认画像足以支持跨周期复诊，不需要复制完整课堂聊天。

仍未解决的最重要问题不是数据链，而是 Agent 的证据融合纪律：

- 工具层能拒绝错误事实；
- 学生能纠正错误总结；
- 但 Coach 第一次综合时仍可能把单次表现写成稳定能力，或改写实际方法。

下一步优先级应为：

1. 让 `plan_update` 的 schema/错误结果直接说明 keyEvidence 的资格并返回可用候选；
2. 在 Roadmap 综合前强制核对“次数、support、是否触发、方法原名”四项；
3. 再跑一个新 Plan，重点验证完整决策链的集成，而不是继续增加同类单题证据。
