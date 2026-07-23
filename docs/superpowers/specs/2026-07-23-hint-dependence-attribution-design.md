# 提示依赖归因设计

日期：2026-07-23  
状态：已确认，待实施计划

## 1. 背景

当前 `support` 同时被当成两种不同概念：

- Tutor 是否在本次 attempt 中发出过提示；
- 学生的最终解答是否实际依赖了 Tutor 提供的内容。

这两个概念不能共用同一判断口径。提示是否出现是 Session 中的客观事件，提示是否构成解题依赖则是教学语义。能力投影和 BKT 应惩罚实际依赖，而不是单纯的提示暴露。

因此，先前“只要发过任何提示，最终 Trace 就必须是 `support:tutor`”的验收标准不成立。若提示只重复学生已经写出的内容，而学生随后自行产生决定性步骤，`support:none` 是合理结果。

## 2. 目标与非目标

### 目标

- 让 `support` 只表达最终解答对帮助来源的实际依赖。
- 对明确依赖和明确不依赖的情况直接归因。
- 对只能判断方向影响、无法从数学内容确认的情况，让学生进行一次中性确认。
- 保留现有 Trace schema、MCP 工具、Session 边界和投影逻辑。

### 非目标

- 不记录“是否见过提示”的新持久字段；原始 Session 已保留该事实。
- 不新增裁判 Agent、归因 subagent 或运行时数学规则。
- 不让运行时拒绝、覆盖或修正 Tutor 的工具参数。
- 不改变 `assessment`、方法节点确认、另解写入或 BKT 聚合结构。

## 3. 语义定义

### 3.1 提示暴露

Tutor 在当前 card-and-Block attempt 中发送过提示。该事实保留在原始 Session 消息中，但不会自动把 `support` 改为 `tutor`。

### 3.2 决定性内容

最终证明或作答链中不可缺少的以下内容之一：

- 方法或操作类别；
- 新的比较对象、函数、代换或构造；
- 关键变形；
- 中间表达式、结论或边界判断。

仅复述学生已经给出的式子、条件或结论，不算 Tutor 首次提供决定性内容。

### 3.3 实际依赖

- `support:tutor`：最终解答采用了至少一项由 Tutor 首次提供的决定性内容。
- `support:none`：最终解答的决定性内容均已由学生先前提出，或由学生在提示后自行产生；Tutor 只重复、定位或确认了已有内容。
- `support:external`：沿用现有外部帮助语义，本设计不修改。

## 4. A + C 判定阶梯

Tutor 在最终 evidence-bearing response 后、写最终 Trace 前按以下顺序判断：

1. 提取学生最终解答中的决定性内容。
2. 回看当前 active Trace 之后 Tutor 实际发送的提示。
3. 若学生采用了 Tutor 首次提供的决定性内容，直接写 `support:tutor`。
4. 若 Tutor 只重复学生已有内容，且决定性内容由学生自行产生，直接写 `support:none`。
5. 若提示只提供方向，无法从内容来源判断它是否促成关键步骤，进入学生确认。

学生确认使用一条中性问题：

> 刚才的提示是否对你最终使用的关键步骤起了作用？

- 学生确认起作用：写 `support:tutor`。
- 学生确认未起作用：写 `support:none`。
- 学生没有回答：保留当前 active Trace，不写最终 correct Trace；不把归因未知伪装成 `none` 或 `tutor`。

学生确认只解决帮助来源，不改变数学正确性判断，也不会被写成新的数学证据。

## 5. 课堂数据流

```text
初次作答
  → 写真实的 incomplete / partially_correct Trace
  → 学生请求提示
  → Tutor 发送提示，不因提示本身追加数学 Trace
  → 学生提交完整作答
  → 比较最终决定性内容与 Tutor 提示来源
      ├─ 明确依赖 → superseding Trace: correct + tutor
      ├─ 明确不依赖 → superseding Trace: correct + none
      └─ 方向影响不明 → 询问学生
                           ├─ 是 → correct + tutor
                           └─ 否 → correct + none
  → 按既有流程判断另解与方法节点
```

如果存在 active incomplete 或 partially-correct Trace，最终 Trace 仍必须使用其准确 event ID 作为 `supersedes`。A+C 只决定 `support`，不改变 supersession 规则。

## 6. 文本修改范围

规范只改变提示契约文本，不增加执行分支：

- Pi Tutor Skill：`apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- 公开插件 Skill：`plugins/highschool-study/skills/run-lesson/SKILL.md`

同时删除或改写两个与新语义冲突的旧提示文本：

- `apps/pi-teaching-web/resources/agents/tutor.md` 中“任何编号提示都持续要求 tutor support”的重复规则；Agent 只保留加载 Tutor Skill 的短指令。
- `apps/pi-teaching-web/src/runtime/study-tools.ts` 中 `support` 参数的旧描述；仅调整提供给模型的文字，不改变枚举、schema 形状或 `execute` 行为。

Skill 是唯一完整规则来源。Agent 和工具参数不再复制另一套可能漂移的归因逻辑。

## 7. Trace note

最终 Trace 的 `note` 应简短记录归因依据，但不新增字段：

- Tutor 依赖示例：`Tutor 二级提示首次提出 ln x<x-1，学生最终证明采用该关键不等式。`
- 无 Tutor 依赖示例：`一级提示只定位学生已写出的偏导；关键放缩由学生随后自行提出。`
- 学生确认示例：`方向性提示的作用无法从内容判断；学生确认其对关键步骤起作用。`

该说明用于审计，不参与方法节点证据。

## 8. 验收设计

### 8.1 文本契约测试

- 两份 Tutor Skill 都包含 A+C 判定阶梯。
- 不再包含“任何 Tutor hint 都必须写 `support:tutor`”的旧规则。
- Agent 与工具参数中不存在与 Skill 相反的归因规则。
- schema 快照保持不变。

### 8.2 三条真实模型路径

1. **提示未被采用**
   - Tutor 只重复学生已有的偏导或边界。
   - 学生自行提出新的关键不等式并完成证明。
   - 期望：`correct + support:none + supersedes`，不询问学生。

2. **关键内容由 Tutor 提供并被采用**
   - Tutor 首次明确给出关键不等式、变形或中间结果。
   - 学生最终证明采用该内容。
   - 期望：`correct + support:tutor + supersedes`，不询问学生。

3. **方向影响不明确**
   - Tutor 只给出可能改变搜索方向的提示，没有提供可直接匹配的决定性内容。
   - 学生随后完成证明。
   - 期望：Tutor 先询问一次中性归因问题；学生回答前不写最终 correct Trace，回答后按 yes/no 写入。

### 8.3 既有样本重解释

`/tmp/studyforge-evidence-freeze-hint-final2-20260723-kOY6wU` 中，Tutor 的一级提示只指向学生已写出的偏导和边界，学生最终自行提出 `ln x<x-1` 放缩。因此该样本的 `support:none` 不再视为失败；它应作为“提示未被采用”路径的候选通过证据。是否满足完整验收仍需在新 Skill 文本下重新运行固定路径确认。

## 9. 完成标准

- 三条真实模型路径分别得到 `none`、`tutor` 和学生确认分支。
- 每条最终 Trace 都正确 supersede 当前 attempt 的 active Trace。
- 学生确认前不会制造归因不明的 correct Trace。
- 自动回归保持通过。
- 验收报告按“实际依赖”口径更新，不再把提示暴露本身当作 Tutor support。
