# P0 / P1 教学证据语义修复实施计划

> 执行方式：在当前隔离 worktree 中顺序 inline 执行；每项都先写失败测试，再做最小实现并提交。

**目标：** 修复三节真实课程审计中确认的证据重复计数、学生纠错未传递、Coach 决策未落盘、题型分类口径错误、提示层级泄露、工具调用旁白和开课快照过早结束等问题。

**明确不做：** 不修改持久化 schema，不新增裁判 Agent，不新增提示许可门，不新增输出拦截器，不借机加入防御性框架。现有未跟踪目录 `apps/pi-teaching-web/.playwright-cli/` 保持原样。

**工作目录：** `/tmp/studyforge-pi-3lesson-audit-20260722/source`

---

## Task 1：按一次 card attempt 聚合方法证据

**涉及文件**

- 修改：`plugins/highschool-study/server/src/method-signals.ts`
- 修改：`plugins/highschool-study/server/src/planner-attention.ts`
- 修改：`plugins/highschool-study/tests/integration/method-signals.test.ts`
- 修改：`apps/pi-teaching-web/src/study/ability.ts`
- 修改：`apps/pi-teaching-web/tests/study/ability.test.ts`

### 1.1 先写失败测试

在 `method-signals.test.ts` 中把证据语义改成以下断言：

1. 同一个 `lessonPath + blockId + cardPath` 下的多条 active step Trace 只形成一次 attempt。
2. attempt 的结果取该组 active Trace 的证据因子平均值。
3. primary method 每次 attempt 的证据权重为 2，secondary method 为 1；不会因 step 数重复增加。
4. `attemptCount` 每张卡每次尝试最多加 1。
5. `distinctCardCount` 按不同 `cardPath` 统计；同卡不同 step 或同卡另一次 attempt 都不会伪造第二张独立卡。
6. `sourceRefs` 仍保留组内所有 active Trace 的来源，便于回溯原始课堂步骤。

在 `ability.test.ts` 中断言：

- 当前 fixture 中同卡同 block 的多个 step 聚合后，`evidenceCount` 为 1。
- 即使一次 attempt 得分较高，只要不同 `cardPath` 少于 2，状态仍为 `unstable`。
- 两张不同卡均提供合格证据时，得分达到阈值后才可显示 `steady`。

运行并确认 RED：

```bash
cd plugins/highschool-study && bun test tests/integration/method-signals.test.ts
cd apps/pi-teaching-web && bun test tests/study/ability.test.ts
```

预期：旧实现按 Trace 行累加，新的 attempt 数、独立卡数和 steady 条件断言失败。

### 1.2 最小实现

在 `method-signals.ts` 中：

- 先按 `lessonPath + blockId + cardPath` 分组 active、带 card 的 Trace。
- 每组计算一次 attempt factor：组内每条 Trace 的 `assessmentFactor × supportFactor` 的算术平均值。
- 再读取该卡的 `graph.method`，对每个 method 每个 attempt 只累计一次角色权重。
- `MethodSignal` 增加运行时投影字段：
  - `attemptCount`
  - `distinctCardCount`
- 不修改 Trace/Card/Plan 的持久化 schema。

在 `ability.ts` 中：

- `evidenceCount` 使用 `attemptCount`，不再使用 Trace 行数。
- `steady` 的最小条件为 `score >= 0.75 && distinctCardCount >= 2`。
- 其他有证据的节点保持 `unstable`；投影继续只是备课注意信号，不成为 mastery 判决。

在 `planner-attention.ts` 中显示 attempt 与独立卡数量，同时保留“不是 mastery claim”的说明。

### 1.3 验证并提交

```bash
cd plugins/highschool-study && bun test tests/integration/method-signals.test.ts
cd apps/pi-teaching-web && bun test tests/study/ability.test.ts
git diff --check
git add plugins/highschool-study/server/src/method-signals.ts plugins/highschool-study/server/src/planner-attention.ts plugins/highschool-study/tests/integration/method-signals.test.ts apps/pi-teaching-web/src/study/ability.ts apps/pi-teaching-web/tests/study/ability.test.ts
git commit -m "fix: aggregate learning evidence by card attempt"
```

---

## Task 2：让 Tutor 的纠错、提示和工具回合形成明确契约

**涉及文件**

- 修改：`apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- 修改：`apps/pi-teaching-web/resources/agents/tutor.md`
- 修改：`apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- 修改：`plugins/highschool-study/tests/contract/agent-and-skills.test.ts`
- 修改：`plugins/highschool-study/skills/run-lesson/SKILL.md`
- 修改：`plugins/highschool-study/skills/run-lesson/references/reveal-policy.md`

### 2.1 先写失败的 Skill/Agent 契约测试

加入正向、可执行的文本契约并断言其存在：

1. Tutor 接受学生对评价的异议时，先追加 superseding Trace，再写 Reflection 或 Lesson Summary。
2. Level 1 只指向学生当前作答中已经出现的一处位置或条件；不得引入新运算、比较对象、函数、代换、除式或中间表达式。
3. Level 2 可以给出一个运算方向或方法类别，但不给变形结果。
4. Level 3 可以给出一个关键中间表达式。
5. 完整解答只在学生明确要求时提供。
6. 工具回合只包含工具调用；工具结果返回后，另发一条面向学生的中文消息。

运行并确认 RED：

```bash
cd apps/pi-teaching-web && bun test tests/runtime/session-factory.test.ts
cd plugins/highschool-study && bun test tests/contract/agent-and-skills.test.ts
```

### 2.2 最小修改提示契约

- 在 app 的 Tutor Agent 与 Tutor Skill 中写入同一套正向操作顺序。
- 在插件 `run-lesson` Skill 及 reveal policy 中写入相同的四级提示定义。
- 复用现有 `supersedes` 机制；不新增字段、不新增裁判 Agent。
- 不实现 request-hint 门或 UI 拦截器；学生仍可自然要求提示。
- 不在 projector 中吞掉模型输出；通过 Agent/Skill 的回合格式消除工具旁白。

### 2.3 验证并提交

```bash
cd apps/pi-teaching-web && bun test tests/runtime/session-factory.test.ts
cd plugins/highschool-study && bun test tests/contract/agent-and-skills.test.ts
git diff --check
git add apps/pi-teaching-web/tests/runtime/session-factory.test.ts apps/pi-teaching-web/resources/agents/tutor.md apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md plugins/highschool-study/tests/contract/agent-and-skills.test.ts plugins/highschool-study/skills/run-lesson/SKILL.md plugins/highschool-study/skills/run-lesson/references/reveal-policy.md
git commit -m "fix: clarify tutor evidence and hint contracts"
```

---

## Task 3：修正 Coach 的题型口径与 Plan 写回闭环

**涉及文件**

- 修改：`apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- 修改：`apps/pi-teaching-web/resources/agents/coach.md`
- 修改：`apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- 修改：`plugins/highschool-study/tests/contract/agent-and-skills.test.ts`
- 修改：`plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- 修改：`plugins/highschool-study/skills/close-lesson-reflection/SKILL.md`

### 3.1 先写失败的映射与事务顺序测试

测试必须能确认：

- `problem category = card_search.goal (graph.goal.primary)`。
- `method shell = card_search.methods (graph.method)`。
- 证据矩阵同时展示 problem category 与 method shell 两列。
- 多题型比较使用 goal，而不是把 method 名称当题型。
- 下一课需要另一题型时，先排除已经覆盖的 goal，再从真实题卡中选择候选。
- Coach 最终判定 `active / complete / replan` 后，依次更新：
  1. Lesson Index
  2. Current Position
  3. Next Lesson Candidate
  4. Plan Summary
- `replan` 仍写作 Plan 的 `status: active`，不发明新 schema 值。
- 写完后重新读取 Plan，学生端结论只能依据重读后的内容陈述。

运行并确认 RED：

```bash
cd apps/pi-teaching-web && bun test tests/runtime/session-factory.test.ts
cd plugins/highschool-study && bun test tests/contract/agent-and-skills.test.ts
```

### 3.2 最小修改 Coach/备课 Skill

- 在 Coach Agent 与 Coach Skill 中把 card search 返回的 goal 和 methods 明确映射到两个不同维度。
- 让备课证据矩阵同时显示这两个维度；跨题型搜索以 goal 的覆盖情况为筛选依据。
- 把最终审计改写为“判定 → 写 Plan → 重读 Plan → 对学生回复”的单向流程。
- 同步更新插件的备课与课后复盘 Skill，确保 Claude Code/Pi 两个入口遵循同一协议。
- 若写回失败，只陈述“尚未持久化”，不在聊天里宣称状态已经改变。

### 3.3 验证并提交

```bash
cd apps/pi-teaching-web && bun test tests/runtime/session-factory.test.ts
cd plugins/highschool-study && bun test tests/contract/agent-and-skills.test.ts
git diff --check
git add apps/pi-teaching-web/tests/runtime/session-factory.test.ts apps/pi-teaching-web/resources/agents/coach.md apps/pi-teaching-web/resources/skills/coach-study/SKILL.md plugins/highschool-study/tests/contract/agent-and-skills.test.ts plugins/highschool-study/skills/prepare-next-lesson/SKILL.md plugins/highschool-study/skills/close-lesson-reflection/SKILL.md
git commit -m "fix: persist coach decisions into plans"
```

---

## Task 4：让开课完成信号跟随真实 `agent_end`

**涉及文件**

- 修改：`apps/pi-teaching-web/src/runtime/session-factory.ts`
- 修改：`apps/pi-teaching-web/tests/runtime/session-factory.test.ts`

### 4.1 先写失败的时序测试

新增纯时序测试：

- 在触发隐藏开课消息前先订阅 session event。
- `sendCustomMessage(..., { triggerTurn: true })` 即使已经 resolve，只要还没有 `agent_end`，开课 Promise 仍不得 resolve。
- 收到 `agent_end` 后 Promise resolve 并取消订阅。
- 触发函数抛错时传播原错误并取消订阅。

运行并确认 RED：

```bash
cd apps/pi-teaching-web && bun test tests/runtime/session-factory.test.ts
```

### 4.2 最小实现

在 `session-factory.ts` 增加一个很小的 `triggerAndWaitForAgentEnd` helper：

1. 先订阅事件。
2. 再执行触发函数。
3. 只在 `agent_end` 时完成。
4. 完成或报错时取消订阅。

`StudySession.triggerLessonStart` 使用该 helper 包装现有 `sendCustomMessage`。服务端已有的“先发布 active 快照、触发完成后再发布快照”流程不改；其第二次快照会自然变成真实课堂首轮完成后的快照。

### 4.3 验证并提交

```bash
cd apps/pi-teaching-web && bun test tests/runtime/session-factory.test.ts
git diff --check
git add apps/pi-teaching-web/src/runtime/session-factory.ts apps/pi-teaching-web/tests/runtime/session-factory.test.ts
git commit -m "fix: wait for tutor agent end before kickoff snapshot"
```

---

## Task 5：全量回归与真实模型验收

### 5.1 静态与自动化回归

```bash
cd plugins/highschool-study && bun run check
cd apps/pi-teaching-web && bun run check
git diff --check
git status --short
```

通过标准：

- 插件测试、类型检查全部通过。
- 前端测试、类型检查、生产构建全部通过。
- 唯一允许的未跟踪内容仍是原有 `apps/pi-teaching-web/.playwright-cli/`。

### 5.2 聚焦真实模型验收

用导数学习集跑两节最小但真实的 Coach + Tutor 验收：第一节覆盖多 step 与学生异议，第二节覆盖不同 `graph.goal.primary`。检查：

1. Coach 从 `goal` 说题型、从 `methods` 说方法，不再混用。
2. Coach 做出最终决定后，Plan 文件四个指定区域已经改变；刷新后结论仍存在。
3. Tutor Level 1 不提供新操作或中间式，Level 2/3 逐级增加信息。
4. 工具调用前不出现英文执行旁白。
5. 接受学生异议后能看到 superseding Trace，旧 Trace 不再进入 active 投影。
6. 开课 loading/工作流状态持续到 `agent_end`，首轮内容不会在后续“突然补上”。
7. 同一次 card attempt 的多个 step 在 Planner Attention 中只计一次，且单卡不会显示 steady。

若真实模型仍违反提示协议，记录具体 transcript 和触发条件；只修直接命中的 prompt/Skill，不引入通用防御框架。

### 5.3 最终提交（仅在验收产生必要的小修时）

```bash
# 逐项 git add 本轮验收直接修改的文件，排除 .playwright-cli/
git commit -m "test: validate p0 p1 teaching flow"
```

最终交付应报告：变更提交、自动化证据、真实验收证据、仍然属于模型概率行为而非程序强保证的边界。
