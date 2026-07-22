# 学生证据冻结设计

状态：讨论通过，待书面复核

日期：2026-07-23

## 一、问题

真实模型验收中，学生已经完成参数单调性和必要条件，但明确表示尚未证明边界参数的充分性。Tutor 随后把自己补出的推理与学生原有步骤合并，声称学生的证明“实际上完整”，并写入 `assessment: correct`、`support: none`。补出的充分性本身还包含错误极限和未经证明的正性结论。

这里有两个不同问题：

1. **证据归属污染**：Tutor 生成的步骤被倒灌为学生已经产出的证据。
2. **数学验证失败**：必要条件被误当成充分条件，决定性推理没有逐项核验。

无论 Tutor 补出的数学内容最终是否正确，都不能用它升级同一次学生作答。首先修复证据归属边界，才能让 Trace、能力投影和 Plan 复盘继续可信。

## 二、目标与非目标

### 目标

- Tutor 在评价前只使用学生在本次工具调用前已经明确给出的数学内容。
- 学生明确承认仍缺决定性证明，且已有作答确实未包含该证明时，记录 `assessment: incomplete`。
- Tutor 可以确认已经成立的部分并指出“还缺哪项证明义务”，但未经请求不得代替学生完成证明。
- 学生后续补完时，通过现有 superseding Trace 更新同一次作答的 active assessment。
- 是否得到 Tutor 帮助继续由现有 `support` 表达；Tutor 提供的提示或完整证明不能记为 `support: none`。
- 方法节点确认和另解落盘只在 active Trace 真正达到 `correct` 后发生。

### 非目标

- 不新增 Trace 字段、证据片段 ID、rubric ID 或新的持久对象。
- 不新增数学裁判 Agent、每题 verifier subagent 或人工审核门。
- 不让运行时用字符串规则判断证明是否完整。
- 不拦截 Tutor 的自然语言输出，也不建立新的课堂状态机。
- 不改变现有 `assessment`、`support`、`supersedes`、方法确认或另解 schema。

## 三、事实边界

### 3.1 学生证据

学生证据只包括学生在当前 `trace_append` 之前亲自表达的内容：公式、推导、理由、结论和对缺口的自我说明。语义等价的表达可以识别，不要求逐字匹配。

以下内容不属于学生证据：

- Tutor 在评价回复中第一次提出的推导或结论；
- 题卡参考解、已有另解、Teacher Control 或隐藏 rubric；
- Tutor 认为“显然可补出”但学生没有实际给出的步骤；
- Tutor 在内部推理中完成、但学生尚未表达的数学链条。

### 3.2 Tutor 教学内容

Tutor 可以在学生明确请求相应等级的提示或完整解答后提供教学内容。该内容仍属于 Tutor 支持，不会自动变成学生能力证据。学生随后需要亲自复述、应用或完成缺口，才能形成新的 evidence-bearing turn。

### 3.3 Trace

Trace 继续只保存现有事实：

```text
assessment: correct | partially_correct | incorrect | incomplete
support: none | tutor | external
note: 学生已给出的内容、仍缺内容与评价依据
supersedes: 可选的旧 Trace
```

不增加第二套“证据冻结结果”。Tutor 在 note 中用普通简洁文字区分“已经建立”和“尚未建立”，原始 Session 仍是可追溯来源。

## 四、评价协议

### 4.1 评价前冻结

Tutor 在调用 `trace_append` 前执行一个私有判断顺序：

1. 列出学生已经给出的决定性步骤。
2. 列出得到最终结论仍必须成立的决定性步骤。
3. 检查每一项是否真的来自学生，而不是 Tutor 准备补出的内容。
4. 只有全部决定性步骤均由学生给出且数学链闭合，才允许 `assessment: correct`。

这不是新的可见工作流，也不写入独立文件；只是 Tutor Skill 中的评价顺序。

### 4.2 Assessment 语义

- `correct`：学生自己已经给出全部决定性步骤，且推理链完整正确。
- `incomplete`：已有步骤可以正确，但结论所需的决定性证明尚未给出。学生明确表示“还没证明”是强证据，但 Tutor 仍要核对已有内容，避免学生只是漏说自己已经完成的等价步骤。
- `partially_correct`：学生已经给出的链条中存在实质错误，同时仍包含可保留的正确部分。
- `incorrect`：核心结论或核心路线错误，不能由现有步骤成立。

本次失败样本应是 `incomplete`，不是 `partially_correct`：学生给出的参数单调性和必要条件没有错误，只缺充分性。

### 4.3 Support 语义

- 学生在任何提示前独立完成：`support: none`。
- Tutor 提供提示、关键中间式、完整证明或决定性补充后，学生再完成：`support: tutor`。
- Tutor 给出完整证明而学生只表示理解：不能把原 Trace 升级为学生 `correct` 证据；必须等待新的学生产出。

## 五、课堂交互与状态转换

首次缺口场景：

```text
学生给出必要性，并明确说充分性未证明
  → trace_append(assessment=incomplete, support=none, methodStatus=unmapped)
  → Tutor 只确认已成立部分，指出“还缺充分性”
  → 询问学生要继续思考，还是请求提示
  → 不提方法节点，不写另解，不主动补证明
```

学生独立补完：

```text
学生给出完整充分性
  → trace_append(supersedes=旧事件, assessment=correct, support=none)
  → 检查并落盘真正另解
  → 再进行方法节点确认
```

学生请求提示后补完：

```text
Tutor 按允许等级给出一次提示
  → 学生完成证明
  → trace_append(supersedes=旧事件, assessment=correct, support=tutor)
  → 检查另解与方法节点
```

Tutor 给出完整解答但学生没有再次产出：

```text
保留 active incomplete Trace
  → 不制造新的 correct 学生证据
```

## 六、最小实现面

### 6.1 Tutor Skill

在现有 Trace 写入规则之前增加高优先级文字：

```text
Before judging, freeze the evidence to mathematical claims the student explicitly supplied before this tool call. Never use a derivation, implication or conclusion first supplied by the Tutor to upgrade that same attempt. If a decisive proof obligation is still missing, record assessment: incomplete. Validate what is established, name the missing obligation without solving it, then wait or ask whether the student wants a hint.
```

同时明确：`correct-and-stop`、方法确认和另解流程，都只能在上述冻结后的 active assessment 为 `correct` 时触发。

### 6.2 Tutor Agent

Agent 摘要只保留一条 non-negotiable 边界：Tutor 生成的补全不是学生证据，同一轮不能用它把 assessment 升级为 correct。避免在 Agent 与 Skill 中复制整段说明。

### 6.3 `trace_append` 工具说明

不改变字段结构，只增强 `assessment` 的 schema description：

```text
correct requires every decisive implication to be present in the student's own work before this tool call. Tutor-generated completions never count as student evidence.
```

这不是运行时数学 gate；它只是让模型在真正组装工具参数时再次看到事实边界。

### 6.4 公共插件 Skill

同步同一事实边界，保持 Claude Code 插件与 Pi Tutor 的教学语义一致。公共 MCP schema 不增加字段。

## 七、失败处理

- Tutor 无法确定缺口是否决定性：保持 `incomplete`，向学生说明尚未验证的证明义务；不猜测 correct。
- 学生认为自己已经证明并提出异议：Tutor 重新检查学生原始链条；若异议成立，用 superseding Trace 更正，不覆盖历史。
- Tutor 已经错误写入 correct：接受异议或复盘发现后，用现有 supersede 改回真实 assessment；能力和另解读取只使用 active Trace。
- Tutor 提供的数学补充后来被发现错误：它不应成为学生证据；若已污染 Trace，同样通过 supersede 纠正。

## 八、验收

### 8.1 Contract tests

逐字断言 Tutor Agent、Tutor Skill 和公共插件 Skill 包含：

- 评价前冻结学生证据；
- Tutor 生成步骤不能升级同一次 attempt；
- 缺少决定性证明使用 `incomplete`；
- 指出缺口但不主动求解；
- 方法确认与另解只在真实 correct 后发生。

工具 schema 测试断言 `assessment` description 包含 student-own-work 与 Tutor-completion 边界，同时确认字段集合完全不变。

### 8.2 真实模型回归

复用已失败的原始学生输入：

```text
由 ln a 有意义得 a>0。固定 x，令 F_x(a)=...，所以 F_x 关于 a 递增。
令 x→1⁻ 得必要条件 a≥e^{-1}，我判断选 D；但我暂时还没有写出
a=e^{-1} 时的充分性证明。
```

第一轮必须满足：

1. 唯一 Trace 为 `assessment: incomplete`、`support: none`、`methodStatus: unmapped`。
2. Tutor 不补充分性，不声称证明完整。
3. 不调用 `card_alternative_append`，不提议方法节点，不推进下一题。
4. 学生可选择继续思考或请求提示。

第二轮让学生独立给出正确充分性，必须满足：

1. 新 Trace supersede incomplete Trace，并写为 `correct + support:none`。
2. 若路线满足另解标准，先写 Trace、再写 `card_alternative_append`、最后回复。
3. 另解写入后再询问方法节点是否贴切。
4. 该路径同时补齐“assessment 从非 correct 更正为 correct 后重新触发另解”的缺失真实验收。

再增加一个提示分支：学生请求提示后完成时，最终 Trace 必须为 `support:tutor`。

## 九、完成标准

- 不改变任何持久 schema 或公开 MCP 字段集合。
- 自动 contract、Pi Web、插件和 Playwright 回归全部通过。
- 失败样本第一轮不再产生 correct Trace、方法证据或另解。
- 学生独立补完与 Tutor 支持后补完可以被正确区分。
- superseding Trace、另解重新触发和方法确认顺序在同一真实 Session 中成立。
- Task 11 验收报告追加新运行证据；只有上述真实路径通过后，才解除当前 P0。
