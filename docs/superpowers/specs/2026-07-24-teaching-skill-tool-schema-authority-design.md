# 教学 Skill 与 Tool Schema 权威重构设计

状态：讨论通过，正式设计与实施计划均已完成，待实施

实施计划：
[`2026-07-24-teaching-skill-tool-schema-authority.md`](../plans/2026-07-24-teaching-skill-tool-schema-authority.md)

日期：2026-07-24

## 一、问题

当前教学系统已经具备完整的 Coach、Tutor、Lesson、Trace、题卡、方法节点和
Plan 闭环。真实课程中剩余的问题主要不是缺少能力，而是同一教学规则被反复写入
不同上下文：

- Agent prompt；
- Pi Skill；
- Claude Code 插件 Skill；
- Skill reference；
- tool description 与参数 description；
- runtime 校验；
- `AGENTS.md`。

历史上每次真实课程发现问题，通常都会向 Skill 追加一段更具体的说明。这种方式
短期有效，但形成了明显的补丁循环：

| 文档 | 清理前峰值 | 2026-07-23 清理后 | 当前 |
|---|---:|---:|---:|
| Pi `tutor-lesson` | 1648 词 | 532 词 | 890 词 |
| Pi `coach-study` | 约 845 词 | 317 词 | 800 词 |
| 插件 `run-lesson` | 1885 词 | 380 词 | 557 词 |
| 插件 `prepare-next-lesson` | 762 词 | 366 词 | 593 词 |

重新增长的内容主要不是新的教学理念，而是：

- 工具字段、字段组合和成功回执教程；
- Block 状态切换和原子写入细节；
- 方法确认、Trace supersede、另解落盘的逐字段事务脚本；
- 针对一次泄漏不断扩展的禁词清单；
- 针对一次模型失误写出的固定话术和错误码处理。

这会产生四种后果：

1. 模型需要同时记忆教学目标和底层协议，课堂表达变得僵硬。
2. 同一规则存在多个副本，修改一处后容易语义漂移。
3. Tool schema 过短，Skill 被迫替工具解释参数。
4. 单次验收中的例外被提升为全局规则，专题课也受到考察课限制。

因此，本轮不再分别为每个现象追加提示词，而是重新确定每条信息的唯一权威。

## 二、研究依据

本设计采用以下公开结论：

1. Anthropic 的
   [Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
   建议 Skill 保持简洁，只提供模型不知道且足以改变行为的信息，并根据任务的
   可靠性需求设置不同自由度。
2. Anthropic 的
   [Define tools](https://platform.claude.com/docs/en/agents-and-tools/tool-use/define-tools)
   建议 tool description 详细说明用途、调用时机、参数语义、限制和返回信息；
   复杂输入可以辅以合法示例。
3. Anthropic 的
   [Writing effective tools for agents](https://www.anthropic.com/engineering/writing-tools-for-agents)
   强调工具应具有清晰而互不重叠的用途、语义化参数、高信号返回值和可行动错误。
4. [IFEval-FC](https://arxiv.org/abs/2509.18420) 表明，即使先进模型也可能违反
   写在参数描述中的简单格式要求。因此，description 能帮助模型理解，但不能代替
   runtime 对确定性事实的约束。
5. [BFCL](https://proceedings.mlr.press/v267/patil25a.html) 与
   [τ-bench](https://arxiv.org/abs/2406.12045) 表明，单轮函数调用已经较强，
   但多轮状态、动态决策和长链一致性仍然困难。跨多轮义务应缩短为可观察事件上的
   checkpoint，不应写成长事务脚本。
6. MCP 对
   [hint 与 contract](https://blog.modelcontextprotocol.io/posts/2026-03-16-tool-annotations/)
   的区分适用于本项目：提示帮助模型决策；如果正确性依赖某条件必定成立，该条件
   应由 schema、runtime 或权限边界保证。

这些结论共同导出一个原则：

> Skill 负责为什么与何时，tool schema 负责调用什么，runtime 负责绝不能错什么。

## 三、目标与非目标

### 目标

- 为每项教学规则指定唯一权威，删除其他位置的完整副本。
- 保留 Coach 与 Tutor 的教学判断能力，同时减少协议文本对课堂语言的污染。
- 让工具在脱离 Skill 字段教程后仍能被模型正确选择和填写。
- 将可确定执行的真实性、所有权、状态和原子性继续留在 runtime。
- 统一 Pi 与 Claude Code 插件的教学语义，但允许二者因工具能力不同保留必要差异。
- 用真实课程中已经发生的失败指导精简，不为假设中的边角情况增加文字。

### 非目标

- 不新增 Agent、裁判 Agent、规则引擎、后台工作流或持久化层。
- 不增加提示许可门、输出拦截器或数学自动判定器。
- 不改变 Roadmap、Plan、Lesson、Trace、题卡或知识图谱的持久化 schema。
- 不增加公共 MCP 工具数量。
- 不把 Pi Skill 拆成大量微型 Skill。
- 不为 Skill 句子、固定话术、标题或禁词编写自动化测试。
- 不要求 Pi 与 Claude Code 插件使用同一份物理文件；只要求共享语义一致。

## 四、五层唯一权威

| 层 | 唯一职责 | 明确排除 |
|---|---|---|
| Agent prompt | 角色、Session 所有权、可用工具范围、学生界面表达 | 完整教学流程、字段教程、错误码 |
| Skill | 教学判断、学生控制、事件触发、短跨工具流程 | 参数签名、成功回执结构、Markdown 变换 |
| Tool description/schema | 工具用途、何时调用、参数局部语义、调用前置条件、返回语义 | 完整教学哲学、跨整节课策略 |
| Runtime | 身份、路径、枚举、引用、状态、原子性、唯一性和真实性 | 依赖模型自行遵守的软约束 |
| Reference | Reveal、Evidence、Template 等稳定领域定义 | 工具签名、runtime 实现和重复工作流 |

### 4.1 Agent prompt

Coach Agent 只保留：

- 一次 Session 只拥有一个 Plan；
- Coach 负责方向、复盘和备课，不写课堂 Trace；
- 只使用真实来源；
- 最终回复前完成必要工具调用。

Tutor Agent 只保留：

- 一次 Session 只拥有一个 Lesson；
- Tutor 只教 active Block；
- 不编辑 Roadmap、Plan 和长期记忆；
- 私有控制信息不作为学生内容输出。

Agent prompt 不再复述 reveal、support、方法确认、另解定义或关课步骤。

### 4.2 Skill

Skill 只保留需要模型进行语义判断的内容，例如：

- 学生是在继续思考、求助、纠错、切换还是结束；
- 学生自己的数学链是否完整；
- Tutor 的帮助是否实际进入最终路线；
- 学生路线是否为真正另解；
- 哪些数学结论可以作为来源支持的备课事实；
- 当前证据是否满足 Plan 的可观测能力标准。

Skill 可以指名工具，但不复制工具参数表。推荐句式为：

> 当一次可评价作答形成后，在追加可能改变其证据的帮助前，用
> `trace_append` 保存学生已经给出的内容。

而不是：

> 调用 `trace_append`，填写 `methodStatus`、`methodPrimary`、
> `methodDecisiveStep`、`methodConfirmation`、`support` 和
> `supersedes`，再检查 `ok`、`ownerPath` 与 `factId`。

### 4.3 Tool description 与参数 schema

每个复杂写工具的 description 使用同一结构：

1. **Outcome**：工具最终写入或改变什么。
2. **When**：何时调用，以及最容易混淆的“不应调用”情形。
3. **Scope**：owner、路径、卡片或状态由谁提供。
4. **Result**：成功后返回哪些后续决策真正需要的事实。

参数 description 只解释本参数：

- 它表示什么；
- 值从哪里取得；
- 与最邻近参数的区别；
- 一个必要的局部前置条件。

不要在单个参数 description 中嵌入完整课堂流程。

### 4.4 Runtime

以下规则继续由 runtime 执行，Skill 中只保留其教学含义：

- Session 绑定真实 `ownerPath`，模型不能覆盖；
- problem Block 绑定恰好一张真实题卡；
- 同一 Block 不能产生并行 active Trace；
- 更正和方法确认必须 supersede 当前 active Trace；
- 方法节点必须来自规范图谱；
- `lesson_close` 原子写入 Reflection、Summary 和关闭状态；
- Lesson 与 Plan 所有权不可被其他 Session 接管；
- 题卡搜索为空是合法结果，不能制造路径或题卡；
- Plan Lesson Index 和 Roadmap 状态由 runtime 重建。

### 4.5 Reference

Claude Code 插件继续使用现有三类 reference：

- `reveal-policy.md`：显示层级与首轮边界；
- `evidence-protocol.md`：正确性、帮助依赖、方法与纠错语义；
- `classroom-templates.md`：不同课程需求的积木默认值。

`run-lesson` 与 `prepare-next-lesson` 只负责何时读取这些 reference，不再复制正文。

Pi 当前直接加载 `coach-study` 或 `tutor-lesson`。为避免修改加载器和增加运行时
复杂度，Pi Skill 保持自包含，但只保留同一语义的压缩版，不新建多级 reference
依赖。

## 五、Skill 重写设计

### 5.1 Pi Tutor：按课堂事件组织

当前 Tutor Skill 按协议章节组织，模型容易把“完成协议”置于学生当前意图之前。
重写后使用五个事件：

#### 事件一：学生控制

- 暂停、继续思考、请求帮助、切换和结束优先于预设课堂流程。
- “继续想”表示等待，不主动给提示。
- 明确结束表示停止新的教学问题；只处理已经接受的纠错和事实落盘。

#### 事件二：形成可评价作答

- 冻结学生在 Tutor 补充前已经给出的数学内容。
- 分开判断正确性、实际帮助依赖和实际路线。
- 缺失决定性证明是 `incomplete`；学生自己的链中存在实质错误才是
  `partially_correct` 或 `incorrect`。
- 在提供会改变证据的帮助前保存当前 attempt。

#### 事件三：学生请求帮助

- `zero` 表示不主动提示，不表示拒绝学生明确请求。
- 按学生请求和当前 reveal mode 给出适量帮助。
- 完整解答必须由学生请求；示例默认使用另一张真实题卡。

#### 事件四：路线结算

- 先验证学生整条路线，再决定是否纠错、确认方法或保存另解。
- 正确的非参考路线不自动触发标准解倾倒。
- 真正另解必须让至少一整问的入口、决定性推理和收束链发生变化。
- 在离开已解决的 problem Block 前，完成尚未处理的方法确认或另解保存。
- 方法节点不贴切时允许拒绝或保持未映射，不为落盘强造节点。

这里使用“离开 Block 前的 checkpoint”，不使用要求模型跨多个自然语言回合机械
记忆的长事务脚本。

#### 事件五：推进或结束

- 切换 Block 前结算当前 Block 的证据与已接受纠错。
- 明确关课后不再追加反思问题。
- 使用已有证据生成 Reflection 与 Summary，再调用关闭工具。
- 关闭 Lesson 不等于完成 Plan。

目标篇幅：约 350–450 个英文词，不作为硬性验收数字。

### 5.2 Pi Coach：按 Plan 决策组织

Coach Skill 重写为四个决策：

1. **读取什么证据**：已知局部问题直接检索；Plan 级问题按需交给 Evidence
   Scout。具体 token、timeout、角色字段由 deep workflow 自身契约负责。
2. **当前证据意味着什么**：Plan 标准只由 active Trace 和来源支持的总结判断；
   同题练习不冒充未见迁移。
3. **下一节课为什么这样设计**：先确定活动角色，再找真实题卡，然后形成可调整
   Block。找不到合适题卡时缩小或改变课堂，不编造。
4. **何时更新 Plan**：学生决定继续、重排、replan 或 complete；最终结论写回后
   再读取。

增加一条数学来源边界：

> 作为参考答案、判断标准或 Teacher Control 结论使用的决定性数学主张，必须来自
> 题卡步骤或可定位材料。Coach 新生成的推广、猜想或变式可以作为探索问题，但在
> 验证前不能写成既定答案，也不能成为能力证据。

这条边界解决 Coach 在真实课程中自行生成错误推广的问题，但不要求建立数学
裁判器。

目标篇幅：约 300–400 个英文词。

### 5.3 Claude Code 插件

`run-lesson` 只保留：

- 读取当前 Lesson 与两个直接 reference；
- 学生控制优先；
- 一次只教学一个 Block；
- 当前事件触发 Trace、方法确认、另解或关课；
- 插件没有另解写工具时，不声称已经持久化另解。

证据细节全部留在 `evidence-protocol.md`。

`prepare-next-lesson` 只保留：

- 选择 Plan 与模板；
- 先定题目角色，再检索真实题卡；
- 使用 Lesson Designer 隔离 Plan 级检索；
- 按 reveal policy 和 classroom templates 写 Lesson；
- 由于公共插件没有 `lesson_prepare` 编译工具，保留必要的 Markdown 可执行结构说明。

Pi 与插件不强求文字相同，只要求以下核心语义相同：

- 学生控制；
- assessment 首轮无提示；
- evidence freeze；
- 实际帮助依赖；
- 一 Block 一独立 attempt；
- 方法由学生确认；
- 真正另解定义；
- 已接受纠错先于总结；
- 关闭不等于 Plan 完成。

## 六、Tool Schema 联动设计

### 6.1 Pi 写工具

| 工具 | description/schema 应补充 | Skill 中删除 |
|---|---|---|
| `trace_append` | 可评价作答的调用时机；Session 自动绑定 Lesson；各 evidence 字段的局部语义；同 attempt 修订关系；紧凑成功回执 | 字段组合教程、回执字段检查、错误码 |
| `classroom_update` | 每个 action 的效果及其必需字段；普通切换与 route 变更的区别 | Block 状态机械转换 |
| `card_alternative_append` | 已有正确 active Trace 的前置条件；题问身份、完整路线、确认节点与实际 support 的含义 | 参数顺序和保存回执教程 |
| `lesson_close` | 学生已确认结束；工具原子完成 Reflection 与关闭；输入文本的语义 | active Reflection 的底层变换和回执列表 |
| `lesson_prepare` | 当前 Plan scope；每个 Blueprint 字段；card/source/block 的关系；成功产物 | Blueprint 字段表、Markdown 标题、owner path 和错误码 |
| `plan_register` | 注册而非创作；Plan ID 来源；幂等结果 | 调用签名和完整回执 |
| `plan_update` | 最终 Plan 审计的写入时机；四个字段各自含义 | 写入字段教程 |

`lesson_prepare.primaryTemplate` 从任意非空字符串收紧为现有六个 literal：

```text
diagnostic | concept | deliberate-practice | remediation | assessment | review
```

这是工具输入约束，不是持久化 schema 变更。插件没有该工具，因此模板枚举继续由
`classroom-templates.md` 负责。

### 6.2 Pi 读工具

- `card_search` 明确返回真实题卡及其完整 active Trace；空结果有效。
- `trace_search` 明确用于从课堂证据反查题卡，并说明可组合的 scope 参数。
- `source_resolve` 明确 `fromPath` 是发起引用的学习集内文件，`target` 是其相对
  来源或 fragment。

读工具返回高信号结果。成功回执和搜索结果不重复输出同一大对象；是否进一步压缩
payload 属于后续独立性能优化，不作为本轮 Skill 重写的必要条件。

### 6.3 公共 MCP

公共 MCP 保持四个工具不变：

```text
card_search
trace_search
trace_append
source_resolve
```

改动只包括：

- 将一句式 tool description 扩展为用途、时机、scope 和结果；
- 为 Zod 参数增加 `.describe()`；
- 保留 `.strict()` 和现有 runtime 校验；
- 不增加 `card_alternative_append` 或 Lesson 编译工具；
- 不改变字段名、返回事实或工具数量。

当前 Pi `defineTool` 与 MCP `registerTool` 封装没有直接暴露 Anthropic
`input_examples` / `strict: true` 的统一开关。本轮不新增适配层。优先使用：

1. 清晰命名；
2. enum、required 与现有 JSON schema；
3. 参数 description；
4. runtime 校验与可行动错误。

如果未来运行时原生支持 grammar-constrained strict tool use，再作为独立能力启用，
不能因此删除 runtime 的状态与权限校验。

## 七、正向契约代替禁词清单

历史上防剧透规则不断列举：

```text
方法名、能力标签、识别线索、定义域提醒、变换入口、题型、母函数……
```

这种黑名单会持续遗漏新表达，也容易让专题教学变得不自然。重写为按课程类型定义
输出形状：

### assessment / diagnostic 的首次作答

学生消息只由两部分组成：

1. 当前真实题目；
2. 中性的作答邀请。

目标、方法、识别标准、提示和参考解留在 Teacher Control，直到学生作答或请求
帮助。

### concept / deliberate-practice / remediation / review

可以在教学需要时公开方法名称、活动目的和比较方向；仍不自动透露当前目标题的
决定性推导或答案。

### 备课完成公告

- assessment：只说明已备好和题目数量；
- 其他模板：可以自然说明活动角色与学习方向。

不规定固定中文句子，也不使用精确禁词测试。

## 八、四个当前问题的最终归属

### 8.1 提示影响了最终路线，却写成 `support:none`

- Tutor Skill：只保留“判断最终路线实际采用了什么帮助”的原则。
- `trace_append.support`：解释 `none`、`tutor`、`external` 的局部含义。
- Runtime：只验证枚举，不自动进行数学归因。
- Session JSONL：保留提示是否出现的原始事实。

发现阶段的方向提示只要实际塑造了最终决定性路线，也属于 Tutor support；仅仅出现
过、重复学生已有内容或未被采用的提示不属于。

### 8.2 Tutor 认定另解却没有落盘，并主动给出标准解

- Tutor Skill：路线验证后设置“离开 Block 前结算”的 checkpoint。
- `card_alternative_append`：完整定义保存输入与前置条件。
- Lesson：参考解默认留在 Teacher Control；Student View 只邀请比较。
- Tutor：学生路线正确后，除非学生请求，不自动展示标准路线。

### 8.3 Coach 生成错误数学推广

- Coach Skill：建立“来源支持的答案”与“待验证探索”边界。
- `lesson_prepare`：明确 sources、cards 和 Teacher Control 的用途。
- Runtime 不尝试判断数学正确性。

### 8.4 学生要求结束，Tutor 继续提出反思问题

- Tutor Skill：结束请求终止新的教学和反思提问。
- `lesson_close`：负责原子写入已有证据支持的 Reflection 与 Summary。
- 学生不需要为了让工具可调用而再次回答问题。

## 九、删除与保留清单

### 从 Skill 删除

- 工具字段的逐项填写教程；
- `ok`、`ownerPath`、`factId`、`status` 等回执清单；
- `LESSON_*`、ownership 和 Blueprint 错误码分支；
- deep workflow 的固定 token/timeout 参数；
- 由 runtime 已保证的 alias、owner path、唯一 active Trace 和原子关闭细节；
- assessment 防剧透的长禁词列表；
- 固定中文成功话术；
- 同一 Evidence、Reveal 或 Template 规则的第二份正文。

### 必须保留

- 学生拥有暂停、提示、切换和结束主动权；
- assessment/diagnostic 首轮无提示；
- Tutor 补充内容不能升级同一次学生证据；
- `support` 表示实际依赖而非提示暴露；
- 一次独立回答对应一个 problem Block；
- 方法节点来自学生路线并由学生确认；
- 真正另解按完整题问核心链判断；
- 已接受异议先纠正 active Trace；
- Coach 的判断使用 active Trace 和真实来源；
- Plan 完成需要学生选择并持久化。

## 十、实施边界

实施应按以下顺序进行：

1. 先改 tool description 与参数 description，使工具在没有字段教程时仍自洽。
2. 再重写 Pi Tutor 与 Coach Skill。
3. 再精简插件 `run-lesson`、`prepare-next-lesson` 及重复 reference。
4. 最后缩短 Agent prompt 和 `AGENTS.md` 中已经有其他权威的重复规则。

不能先删 Skill 再留下含义不完整的工具，也不能先扩写 tool schema 后保留 Skill
中的完整副本。

本轮与当前未提交的 Plan Markdown 回调修复相互独立。实施时必须保留：

```text
apps/pi-teaching-web/src/study/write-workspace.ts
apps/pi-teaching-web/tests/study/write-workspace.test.ts
```

中的现有用户改动。

## 十一、验收

### 静态自审

- 每条核心规则只有一个完整权威。
- Pi Tutor、Pi Coach、插件 run、插件 prepare 的总词数显著下降。
- Skill 中不再出现工具完整签名、回执字段清单或 runtime 错误码教程。
- Tool description 不依赖 Skill 才能解释基本调用。
- assessment 与专题课不再共享过度严格的首轮展示规则。

### 可执行检查

- 仅为实际 schema/runtime 修改运行既有类型检查、单元测试和构建。
- 公共 MCP 工具数量仍为四。
- `lesson_prepare.primaryTemplate` 拒绝非规范值。
- 既有 owner、Trace、alternative、close 和 Plan 更新回归继续通过。
- 不增加 Skill 固定句、标题、禁词或全文快照测试。

### 真实课程观察

后续真课只观察行为与最终事实，不要求模型复述规则：

1. 学生采用 Tutor 决定性提示时，最终 Trace 为 `support:tutor`。
2. 学生给出正确非参考路线时，Tutor 不自动倾倒标准解。
3. 真正另解在离开当前 Block 前完成保存；不贴切的方法节点可保持未映射。
4. Coach 不把无来源推广写成标准答案或能力证据。
5. 学生明确结束后，Tutor 不再要求回答新的反思问题。
6. 课堂话术保持自然，不出现工具参数、内部矩阵和协议复述。

单次模型失误只记录为观察；只有重复出现并能定位到权威缺口时，才继续修改
Skill 或 tool description。可确定的机械失败优先修 schema/runtime，不再增加
防御性提示段落。

## 十二、完成标准

- Skill、tool schema 与 runtime 的职责边界可以从文档和代码中一一对应。
- 四个当前问题各有唯一修复位置，不再向多份 Skill 平行追加文字。
- 教学语义未被删除，底层协议不再占据主要课堂上下文。
- Pi 与 Claude Code 插件保持核心教学语义一致，同时保留各自真实工具能力边界。
- 设计可以直接转写为逐文件实施计划，不需要再发明新架构。
