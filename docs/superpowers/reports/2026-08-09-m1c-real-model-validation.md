# StudyForge M1c 真实模型验收报告

日期：2026-08-09  
主模型：`openai-codex/gpt-5.6-sol`，`high`  
检索模型：`openai-codex/gpt-5.6-terra`，`high`

## 结论

**M1c 的语义资产、原始资料、Meta Session、学习足迹和跨 Session 记忆合流已经完成；确定性验收通过。真实教学链路的核心行为通过，但整轮发布品质验收不是全绿。**

三个真实情境都在冻结代码与独立 learning-set 上完成过。首次完整运行暴露了两个机械缺陷：自然中文确认被误拒，以及两张旧题卡的中文 ID 令足迹接口报错。两者已在独立提交 `039e6ad` 中修复，并用新的隔离目录复验。

仍需保留两项真实问题：

1. 旧题库备课整轮耗时 251.329 秒，Scout 本身已经按数量停止，但 Coach 一次索取六个候选并逐张深核验，学生等待期间也没有持续可见进展。
2. 两次正式结课都先触发一次 `closing fact requires an active Block or completed Reflection`，模型随后补建 Reflection 才成功提交记忆，分别令结课轮耗时 44.773 秒和 86.614 秒。

因此建议判定为：**M1c 功能闭环通过；发布品质验收部分通过。是否进入发布仍由项目负责人决定。**

## 冻结运行

| 运行 | 代码身份 | 范围 | 结果 |
| --- | --- | --- | --- |
| R1 完整运行 | `fa20586a3a1996b50149b5fe5056ca3f69a213a0`，clean | 有资料、空白自由学习、正式课程三条真实模型链路 | 保留原始失败；发现自然确认和旧卡 ID 两个缺陷 |
| R2 修复复验 | `039e6ada544c341819b08aae90079b51e006bc9a`，clean | 有资料链路完整重跑；旧 519 卡资产与足迹接口定向复验 | 两个缺陷均通过；未伪装成第二次完整三情境运行 |

两轮使用相同冻结输入：

- blank seed：`0028392f059d6a9d76f4c8c3fec1c5f0c2ea396366bb8a53c8da138ce8a20110`
- course seed：`7de81bbcc129fd72737b748d91fd8125dace76eee64136762cf049f33e2efe74`
- Scout prompt：`898170eddc0a5ee010837654d2aa75998bce39980adb2aff9aed3173e55493b1`

原始证据未提交进仓库，保留在：

- R1：`/private/tmp/studyforge-m1c-validation-tGUKEY`
- R2：`/private/tmp/studyforge-m1c-validation-rerun-ZJm0bL`

每个目录均含 manifest、逐轮 HTTP 结果、事件流、原生 Pi JSONL、初末 canonical 快照和 `evidence-summary.json`。

最终代码验证（`039e6ad` + 本报告）已重新执行：

- `bun run check`：273 tests pass，0 fail；TypeScript 与 Vite build 通过；
- `bun run test:e2e -- tests/e2e/m0-cycle.spec.ts tests/e2e/m1b-cycle.spec.ts tests/e2e/m1c-cycle.spec.ts`：5/5 pass；
- 只有既有 Vite chunk-size warning，没有测试或构建错误。

## 三个真实情境

### A. 有资料的 Ksp 链路：PASS（修复后）

R1 中，教师先解释“参与反应”和“是否显式写入平衡常数”的区别，再让学生复述并检查固相耗尽边界。对象记忆只记录“讲解后同情境复述”，没有写成独立迁移能力。Meta 只问了一个会改变长期方向的问题，公开 Roadmap 级方案后才物化，最终只有 `ROADMAP.md`，Plan Tree 为空。

R1 的失败是 Runtime 把以下自然确认全部误拒：

- “可以，就按这个版本保存。”
- “确认保存。”
- “确认，就按你现在列出的这个结构保存。”
- “确认建立这条路线。”

模型没有谎称保存成功。R2 在新 learning-set 上复跑后：

- 第一次“可以，就按这个版本保存。”即成功创建 Note；
- Note 精确固定到 `material-001` revision 1、`lines-1-5`；
- core tags 为“溶度积”“纯固体活度”；
- 第一次“确认建立这条路线。”即成功创建 Roadmap；
- Roadmap 的 Current Position 明确保留“讲解后、尚未证明独立迁移”，且没有创建 Plan。

会话：

- Free Learning：`019fe2b6-f1b5-74ed-b4ba-3ae5e9d6c8ff`
- Meta：`019fe2b8-c370-710a-ae23-8405ffbcdb60`

### B. 空白阿伦尼乌斯链路：PASS

学生没有资料，也没有主动说标签或存储字段。教师先通过相对变化比较帮助学生形成解释；学生完成独立推断后，才预览并保存 Note。

最终产物：

- `notes/note-001.note.yaml`
- `semantics/assets/note/note-001.tags.yaml`
- 无伪造 source；
- 对象记忆只支持“能据此推断相对温度敏感性”，并保留绝对速率、真实机理等未知边界；
- Note 的成熟度没有自动变成掌握判断。

会话：`019fe297-6254-7578-b15b-7ee97a6804ca`

### C. 正式课程与旧题库：PARTIAL

Roadmap、一个 Plan 和两节 Lesson 均真实完成。起点记忆只说学生曾在提示后识别共同结构；两节课后，对象记忆演化为：学生能在切线几何和含参指对不等式的真实外壳下自主抓住控制结构，但第二题的 `F(t)=te^t` 非全域单调边界仍由教师提醒，不能写成全面掌握。

教学质量通过的主要证据：

- 第一课中学生无提示拆出绝对值外壳、识别参数展开中的整体结构；
- 第二课第一题独立利用垂直切线关系完成分支、截距与面积判断；
- 第二课第二题独立识别 `F(t)=te^t`，教师只在全域单调性边界处提醒；
- 结课记忆准确区分“选路启动已进步”和“方法合法性检查尚未稳定”。

旧题库检索也守住了新分工：

- Scout A：匹配 14，浅读 3，返回 3；
- Scout B：匹配 3，浅读 3，返回 3；
- 两个 Terra Scout 并行，约 48.4 秒和 46.9 秒；
- 输出只有路径、metadata fit、风险和 search boundary，没有答案、学生记忆或路线级代做；
- 达到 brief 数量后立即结束，没有遍历全家族；
- Coach 随后自行深读并选中 `mst_p0078_tangent_ex08` 与 `mst_p0016_ex01`。

但本情境仍有三项非全绿结果：

1. 整个旧题库备课轮耗时 251.329 秒。事件粗分约为：Scout 前 80 秒、并行 Scout 51 秒、Coach 收到候选后的深核验与物化 121 秒。Scout 已不再追求最优，当前最大重复工作来自 Coach 要求每个 slot 各 3 张，最终深读六张只取两张。
2. 学生可见的检索进展只在 Scout 活跃的约 51 秒内连续；前后仍有明显静默段，因此“等待期间持续可见进展”判为 FAIL。
3. 这次真实课程没有发生“学生确认保存现场自编题/Note”，所以正式 Lesson 的资产保存行为标为 NOT OBSERVED；确定性工具与 Skill 验收已通过，不能拿自动测试冒充真实行为证据。

R1 末尾 `/api/footprint` 因旧卡 ID `mst_p0201_exp2x_ln恒成立_param_ch6_exp_ex07` 被误判非法而返回 400。R2 使用原样 519 卡定向复验：资产列表 519、足迹 519、该中文 ID 可直接打开、答案仍受门控、seed 初末哈希一致。该机械缺陷判为已修复；修复后没有再次重跑整条高成本课程链路。

## Spec §16.1 确定性验收映射

| # | 状态 | 证据摘要 |
| --- | --- | --- |
| 1 | PASS | Note/题卡内容、pinned sources 与 tag sidecar 原子创建；Material 可无标签入库并机械 Search/Read。 |
| 2 | PASS | tag metadata revision 独立递增，资产 revision、attempt 与答案门不变。 |
| 3 | PASS | 519 张旧卡原样进入统一索引；R2 用真实 519 卡再次验证。 |
| 4 | PASS | legacy-unpinned 可见但不冒充当前 revision；新来源校验 revision、locator 与环。 |
| 5 | PASS | Note/题卡旧 revision 保存精确 bytes；不存在的 M1c 前历史只报告 unresolved。 |
| 6 | PASS | tag、反向来源和邻居投影可删除重建，canonical 内容不依赖投影。 |
| 7 | PASS | Material 导入及 PDF/文本投影不创建 Note、题卡、记忆、Roadmap 或掌握字段。 |
| 8 | PASS | Meta 未确认不物化；确认后只创建 `ROADMAP.md`。R2 自然确认首击通过。 |
| 9 | PASS | 空白入口和已有 Ksp 证据入口都跑通，未知信息保持未知。 |
| 10 | PASS | 自由学习、Meta 与正式课程共享对象记忆，但 Session 类型与事实来源未转换。 |
| 11 | PASS | 足迹从 canonical 来源重建且不暴露判断正文；旧中文卡 ID 修复后真实 519 卡通过。 |
| 12 | PASS | 两个真实 Scout 均使用短词/索引浅读，并在 brief 数量满足后停止。 |
| 13 | PASS | 拒绝/确认保存 prepared card 的原子边界有自动测试；本轮真实模型行为 NOT OBSERVED。 |
| 14 | PASS | Lesson 资产保存与对象记忆提交互不触发，有自动测试；真实 Free Learning 证明该分离，正式 Lesson 保存 NOT OBSERVED。 |

主要自动证据位于 `tests/m1c/` 的 11 个聚焦测试文件，以及 `tests/e2e/m1c-cycle.spec.ts`。

## Spec §16.2 真实模型行为

| 观察项 | 状态 | 结论 |
| --- | --- | --- |
| 先教学，不为标签/存储/建课打断学习 | PASS | Ksp 与阿伦尼乌斯均先完成解释和学生动作，之后才谈保存。 |
| Meta 用普通语言谈长期方向，并把首个 Plan 留给 Roadmap | PASS | 有资料情境只生成 Roadmap；空 Plan Tree。 |
| 区分资产、记忆与当前表现 | PASS | Note 内容成熟但对象记忆持续保留帮助条件和未证明边界。 |
| Scout 得到所需数量后结束 | PASS | 两个 Scout 各检查三张即返回；未出现语义穷尽。 |
| 学生无需理解 revision、sidecar、投影 | PASS | 对外只出现资料范围、笔记预览、保存与长期路线。 |
| 新语义层缩短检索且不产生长时间无反馈 | FAIL | Scout 阶段已收敛，但整轮备课仍为 251.329 秒，且前后存在静默段。 |

额外行为项：正式 Lesson 保存现场资产为 **NOT OBSERVED**；修复后完整三情境重跑为 **NOT OBSERVED**，只有有资料链路完整重跑与旧库接口定向复验。

## 响应时间与模型负担

R1 共 33 个真实学生回合：

| 指标 | 首次可见响应 | 回合完全结束 |
| --- | ---: | ---: |
| 中位数 | 8.100 s | 20.039 s |
| P90 | 18.355 s | 65.412 s |
| 最大值 | 32.451 s | 251.329 s |

高延迟集中在备课和结课，而不是普通教学问答：

- 首个自编题 Lesson 备课：183.482 秒，首次可见 9.050 秒；
- 旧库检索 Lesson 备课：251.329 秒，首次可见 32.451 秒；
- Lesson 1 结课：44.773 秒；
- Lesson 2 结课：86.614 秒。

R1 provider-reported usage（`totalTokens` 含 cache read，不能直接当成付费 token）：

| 模型 | input | output | reasoning | cache read | provider total |
| --- | ---: | ---: | ---: | ---: | ---: |
| Sol | 332,430 | 42,888 | 17,911 | 2,119,680 | 2,494,998 |
| Terra | 56,658 | 3,816 | 3,061 | 33,280 | 93,754 |

这组数据不支持“Scout 本身仍在漫无目的地搜索”。相反，它说明当前成本主体已经转移到父 Coach：检索前组织、超额索取候选、收到候选后的重复深核验，以及长课程上下文。Scout 的窄化方向有效，但还没有自动把整条备课链压短。

## 已修复问题

### 1. 自然确认误拒

根因是确认门只接受少量精确短语，没有在“模型刚公开完整候选”的上下文里识别自然中文肯定句。修复后仍先拒绝明确否定，再要求肯定开头和可见候选上下文；沉默、继续操作或“我懂了”仍不算批准。

### 2. 旧题卡中文 ID

根因是新 API 用 ASCII ID 规则重新约束已有 canonical 卡。修复只把 problem-card ID 放宽为 Unicode 字母/数字及 `._-`，仍拒绝空格、斜杠和路径逃逸；Note、Material、Session 等 ID 规则未被无关放宽。

## 保留问题与下一步

1. **Coach brief 数量应等于真实需要量。** 本轮需要两张、两个 slot 各取一张，却要求两个 Scout 各返回三张。下一次只需调整 Coach/Prepare 的 brief 原则：每个 slot 请求实际所需数量，只有确有比较需求才多取；不要改变 Scout 的停止契约。
2. **结课工具契约需要单独处理。** 两次相同的 closing-fact 前置失败说明当前 Tutor 对“普通 Block 已完成后该把结课事实写到哪里”理解不稳定。应先决定是修改 Skill 顺序，还是让 Runtime 提供不篡改已完成课堂事实的窄结课原语；不应靠叠加防御性提示临时掩盖。
3. **备课等待可见性未达标。** Scout 活跃期已有真实 material-search 事件，但 Coach 前后推理没有等价的学生可见进度。M1c 报告保留 FAIL，交由后续性能切片处理。
4. **补一条短真实课程复验。** 在处理前两项后，只需跑“检索两张题 → 备课 → 上课 → 结课 → 可选保存资产”的最短链，不必重跑无关的 Material 与空白情境。

本轮没有为了消除这些残余项继续增加 schema、状态机、图数据库、冗余日志或大段防御性测试。
