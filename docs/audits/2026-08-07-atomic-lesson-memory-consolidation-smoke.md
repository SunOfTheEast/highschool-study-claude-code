# Lesson 课末记忆原子固化烟测

- 产品提交：`6c027d2`
- 模型：`openai-codex/gpt-5.6-sol`
- Thinking：`high`
- 隔离运行：`studyforge-atomic-memory-smoke-SqnNYM`
- 结果：**PASS（单次真实模型小闭环）**

本报告只评价新课末固化路径的一次真实模型烟测，不把单次通过写成长期稳定性结论。原生
Session、事件流和完整学习集保留在仓库外；仓库不保存认证信息、完整工具载荷或思维链。

## Baseline

旧 M1a 长周期的五次课末固化最终耗时为 83.1—144.6 秒，每次 9—14 次工具调用。Tutor 需要
分别追加 Classroom Log、Lesson Trace、对象当前判断与时间线、bucket 和根 INDEX；五次还都
先尝试了被守卫拒绝的原生 `edit`，并出现 exact-end、active Block 等机械修复。

旧数据来自 `studyforge-m1a-validation-fUXEZ5`，课程输入并不与本次烟测完全相同，因此这里只把
它作为改造前的运行区间，不声称是严格同题 A/B。

## Automated Gates

在 `apps/pi-teaching-web` 运行：

- `bun run typecheck`：通过；
- `bun test --path-ignore-patterns='tests/e2e/**'`：189 pass、0 fail、7,278 expects；
- `bun run build`：通过；仅出现既有的 Vite chunk-size warning。

覆盖面包括多文件事务的 stale source、回滚、崩溃恢复、符号链接与路径边界；Trace、对象、偏好、
INDEX 和 deferred route 的确定性变换；工具注册、会话权限、幂等回执；M0 无记忆工具、Lesson 无
原生 `edit/write`、Plan 不能写 Lesson Trace，以及前端 invalidation。

## Real-Model Close

烟测从既有 M1a 学习集的隔离副本开始，在 Plan 002 下放置一节 active Lesson。已完成的问题
Block 提供真实的首次表现、方向提示和提示后独立完成证据，Reflection 保持 active。学生只用自然
语言说今天结束，并回看：最初只沿原方程计算；在“目标还能改写成什么大小比较”的追问后才想到
位置比较；差函数由自己完成；下次能否无提示触发仍不确定。输入没有指定记忆类别、对象、bucket
或工具，也没有编写“隔课”“延时”等时间结论。

观察到的完整工具序列为：

1. `read` × 5：Tutor Skill、当前 Lesson、暂停技巧、课末固化 reference、既有对象；
2. `classroom_log_append` × 1：追加学生刚确认的帮助边界；
3. `classroom_update` × 1：完成 Reflection；
4. `lesson_memory_commit` × 1：一次提交 Trace、既有对象更新和 INDEX 前沿。

共 7 次模型调用、8 次工具调用，原生 usage 的 `totalTokens` 合计为 83,515。没有调用原生
`edit` 或 `write`；`lesson_memory_commit` 成功后没有回读 Lesson、对象或 INDEX，也没有第二次
提交。

Runtime 回执为：

- `ok: true`；
- `durationMs: 16.552`；
- Trace key `sum-route-help-boundary` 绑定为 `trace-plan-002-lesson-003-01`；
- 改动路径恰为 `plans/plan-002/lessons/lesson-003.md`、`memory/objects/obj-001.md`、
  `memory/INDEX.md`；
- 没有新 object、preference 或 bucket ID；
- `.studyforge/transactions` 没有残留事务。

## Semantic Comparison

本次语义承重门全部守住：

- 最终学生可见总结明确区分“目标改写需要方向提醒”与“提示后独立完成差函数和论证”；
- 没把提示后的顺利完成升级成无提示掌握，并保留“下次能否主动触发未知”；
- Lesson 只新增一条 Runtime 分配 ID、机械记录时间为
  `2026-08-07T10:23:46.022Z` 的 Trace，来源指向当前两个 Block；
- 既有 `obj-001` 使用 `keep`：只修订当前判断、流变概述与边界，并追加本次时间线入口；旧时间线
  没有被改写；
- 根 INDEX 只更新该对象的当前前沿；既有 bucket 与 preference 文件的 SHA-256 前后完全一致；
- 没有生成能力假设、偏好或新 bucket，也没有把分桶判断交给 Runtime。

模型最后对学生说的是：目标改写需要方向提醒，位置比较之后的差函数和论证由学生独立完成；
无提示触发尚不能确认。它没有播报内部 schema、提交状态或文件操作。

## Performance Comparison

从服务进入 running 到第一条学生可见工具进展为 5.7 秒，到最终稳定回复为 64.8 秒。第一段教师
自然语言在 63.7 秒才开始输出；学生前面看到的是读取与固化进展，而不是一段可交互的教学回复。

相对旧五次固化的 83.1—144.6 秒区间，本次最终时间低 22.0%—55.2%；工具总数由 9—14 次降到
8 次。更重要的结构变化不是少一两次读取，而是记忆持久化本身只剩一次工具调用，且其机械事务
仅耗时 16.552ms，没有原生编辑失败、逐文件回读或部分写入修复。

这组数据支持“旧路径的机械写入扇出已被移除”，但不支持把 64.8 秒称为已经足够快。Runtime
不是剩余延迟的大头；主要时间仍发生在模型读取、形成语义判断和组织提交之前。

## Remaining Boundaries

- 这是一个既有对象 `keep` 场景的单次真实模型烟测；新对象、多对象关联与 `defer → Plan resolve`
  已有自动化测试，但未在本次真实模型回合重复支付验证成本。
- 本次没有真实时间间隔，不评价延迟保持；Runtime 只机械写记录时间，不替模型作保持性判断。
- 本次没有触发 Scout、compaction、事务故障或并发冲突；相应结论来自独立测试，不冒充本次观察。
- 64.8 秒仍可能让学生分心。后续优化应继续看模型读取与一次性语义判断，不应把 bucket 归类等
  教学语义下放给 Runtime，也不应重新引入逐文件写入。
- 完整 M1a PASS 仍需要一次诚实的时间协议和长周期复验；本报告的 PASS 只属于原子固化小闭环。
