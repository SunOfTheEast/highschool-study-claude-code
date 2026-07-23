# 三节真实课程闭环优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复导数学习集连续三节真实课程中暴露的证据失真、备课剧透、工具链空回复和 Markdown 写坏问题，同时保留已经可用的 Coach/Tutor 双 Session、题卡—Trace 双向检索、能力刷新与课堂路由。

**Architecture:** 不增加新 Agent、规则引擎、裁判层或长期状态机。能够由确定性事实判断的完整性问题放在现有 runtime/domain 边界；教学表达和课堂节奏继续由 Coach/Tutor Skill 负责；最终用一个全新的导数学习集副本和真实模型重新跑三节课验收。

**Tech Stack:** Bun 1.3、TypeScript 7、Pi 0.81、React 19、Markdown/YAML 学习集、Vitest-compatible Bun test、Playwright。

## Global Constraints

- 不改变 Roadmap → Plan → Lesson 的 Markdown 治理结构。
- 不增加持久化 schema 字段，不引入 rubric id，不创建裁判 Agent。
- 不把能力投影升级成自动 mastery 判决；它仍只向 Coach 提供备课注意信号。
- 不给 zero/ladder 增加运行时“提示门”；提示依赖继续按学生最终解答中的实际使用情况归因。
- 题卡不存在时必须停止搜索或改课，不编造题卡。
- Coach 私有备课材料与学生可见摘要必须分开；暴露过关键结构的题卡不能再算未见题。
- 方法节点只有学生明确确认后才进入 Trace；无法贴切映射时允许保持未绑定。
- 一次 supersede 只能修订同一 Lesson、同一 Block、同一题卡的一次作答。
- 所有实现先写失败测试，再做最小修改；每个任务单独提交。
- 真实模型验收使用新复制的学习集，不修改示例学习集和用户现有学习记录。

---

## 1. 真实试跑基线

试跑基于提交 `98bee4c34e3e8b44658085893edd31f1369a5883` 的干净安装，运行时为 Pi `0.81.0`，模型为 `mimo-v2.5-pro-ultraspeed`。学习集使用独立副本：

`/tmp/studyforge-real-pilot-20260723-NCn3U6/learning-set`

| 课程 | Session | 已验证行为 | 暴露问题 |
| --- | --- | --- | --- |
| Lesson 003 | `019f8d2d-102f-721f-b8db-206d183b4bca` | 两张未见题独立正确；Tutor 在写方法证据前询问学生；学生确认后才绑定节点 | 无阻塞问题 |
| Lesson 004 | `019f8d34-b4b2-7599-8dd7-54499a697c80` | 提示依赖正确记为 `support: tutor`；无提示小测正确 | `guided-02` 错误 supersede `diagnosis-01`；未询问学生便写入两个方法节点；正确后缺少简短评价 |
| Lesson 005 | `019f8d3a-99e2-7fde-ac54-a8e4dcb501b0` | 学生可以否决不贴切的方法节点并保持未绑定；结课后前端能力图刷新 | Coach 摘要泄露关键约束；Tutor 口头认定另解但未落盘；Reflection 中 `$2/a$` 被字符串替换破坏 |
| Coach 最终审计 | `019f8d2c-a271-7f22-9570-fdc5ffe16ab4` | `trace_search` 返回完整 active Trace 和题卡 | 工具结果后连续两次生成空 assistant turn，未调用 `plan_update`，Plan 因而仍把 Lesson 005 标为 `prepared` |

原始 Pi JSONL 保留在本机 `~/.pi/agent/sessions/--tmp-studyforge-real-pilot-20260723-NCn3U6-learning-set--/`。不得把 JSONL、模型凭据或完整学生对话提交到仓库。

## 2. 根因结论与优先级

| 优先级 | 问题 | 根因 | 修复边界 |
| --- | --- | --- | --- |
| P0 | Reflection/Plan 中数学文本被破坏 | `String.replace` 的 replacement string 把 `$2`、`$&` 等解释为替换标记 | runtime 确定性修复 |
| P0 | 不同 Block 的 Trace 被互相 supersede | domain 只检查 event ID 是否存在于同一 Lesson，未检查 attempt 身份和 active 状态 | domain 确定性修复 |
| P0 | 未确认方法进入能力投影 | Skill 虽写了“学生确认”，但协议过长，模型仍在一次工具调用中自称已确认 | 精简 Tutor Skill；不增加运行时裁判 |
| P0 | 另解只口头承认、没有旁挂文件 | 两段式工具协议埋在长提示词中，模型在第一段 Trace 后直接回复 | 精简 Tutor Skill 并加入真实对话验收 |
| P0 | Coach 备课剧透，Lesson 未写入 Plan Index | 私有选题过程和学生摘要没有固定输出边界；Coach 仍可用通用 edit 改 Plan | Coach Skill 明确双输出与唯一 Plan 写回路径 |
| P0 | `trace_search` 后空回复，Plan 最终状态陈旧 | 模型在工具结果后结束了空 assistant turn；runtime 把它当成正常完成 | 一次、有限的 post-tool continuation |
| P1 | 快速填写后第一次点击偶尔未发送 | composer 从 React state 读取值且没有 sending/error 状态，接受与清空之间缺少明确事务 | 前端提交事务 |
| P1 | 一级提示规则机械且实际回复仍可能越界 | 当前 Skill 依赖禁词表约束表达，却没有围绕“学生已有对象”和实际依赖组织提示 | 精简提示语义，以 Trace 归因为准 |
| P1 | Coach 表格挤成普通段落 | Markdown renderer 未启用 GFM | 加入 `remark-gfm` |

## 3. 文件边界

### 确定性事实层

- `apps/pi-teaching-web/src/study/write-workspace.ts`：字面写回 Markdown，不解释 `$`。
- `plugins/highschool-study/server/src/traces.ts`：保证 supersede 只发生在同一 active attempt。
- `apps/pi-teaching-web/src/runtime/session-factory.ts`：只对“本轮已有工具结果但没有任何可见 assistant 文本”续跑一次。

### Agent/Skill 层

- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- `apps/pi-teaching-web/resources/agents/coach.md`
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- `apps/pi-teaching-web/resources/agents/tutor.md`
- `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- `plugins/highschool-study/skills/inspect-progress/SKILL.md`
- `plugins/highschool-study/skills/run-lesson/SKILL.md`
- `plugins/highschool-study/agents/study-coach.md`

Pi 资源和 Claude Code 插件中的同一教学协议必须同步，避免两套 runtime 产生不同证据含义。

### 前端层

- `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`：一次点击即形成可观察的提交事务。
- `apps/pi-teaching-web/src/client/components/MarkdownView.tsx`：统一支持 GFM 表格。

---

### Task 1: 数学 Markdown 字面写回

**Files:**

- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts:103-107`
- Test: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`

**Interfaces:**

- Consumes: `replaceSection(source, heading, value)`
- Produces: 保留输入 value 中 `$1`、`$2`、`$&`、`$$` 原文的 section replacement

- [ ] **Step 1: 写入会失败的回归测试**

在 `write-workspace.test.ts` 增加：

```ts
test('writes mathematical dollar sequences literally into Lesson and Plan sections', () => {
  const lesson = fixture();
  closeLesson(lesson.root, lesson.path, {
    reflection: '先由 $2/a$ 与 $&$ 检查定义域，再保留 $$ 数学块。',
    summary: '边界是 $1/e$，不是 replacement token。',
  });
  const lessonSource = readFileSync(join(lesson.root, lesson.path), 'utf8');
  expect(lessonSource).toContain('$2/a$ 与 $&$');
  expect(lessonSource).toContain('保留 $$ 数学块');

  const plan = planFixture();
  updatePlan(plan.root, plan.path, {
    decision: 'active',
    lessonIndex: 'Lesson $2。',
    currentPosition: '保留 $& 与 $1/e$。',
    nextLessonCandidate: '无。',
    planSummary: '字面 $$。',
  });
  const planSource = readFileSync(join(plan.root, plan.path), 'utf8');
  expect(planSource).toContain('Lesson $2。');
  expect(planSource).toContain('保留 $& 与 $1/e$。');
});
```

- [ ] **Step 2: 运行测试并确认当前实现失败**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts
```

Expected: 新测试 FAIL，输出中 `$2/a$` 或 `$&` 被替换。

- [ ] **Step 3: 用 replacement callback 做最小修复**

把 `replaceSection` 的最后一行改为：

```ts
return source.replace(
  pattern,
  (_matched, prefix: string) => `${prefix}\n${value.trim()}\n\n`,
);
```

callback 返回值不会再次解释 `$1`、`$2` 或 `$&`。

- [ ] **Step 4: 运行目标测试和完整写回测试**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts
```

Expected: 全部 PASS，且 fixture 中的 `$2/a$` 字节不变。

- [ ] **Step 5: 提交**

```bash
git add apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts
git commit -m "fix: preserve literal math in workspace writes"
```

---

### Task 2: 把 supersede 限定为同一次 active attempt

**Files:**

- Modify: `plugins/highschool-study/server/src/traces.ts:307-312`
- Test: `plugins/highschool-study/tests/integration/trace-records.test.ts`
- Test: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`

**Interfaces:**

- Consumes: 现有 `TraceAppendInput.supersedes`
- Produces: 同 Lesson、同 Block、同 cardPath/materialPath 且仍 active 的修订链

- [ ] **Step 1: 写入跨 Block、跨题卡和陈旧目标测试**

测试先追加 `step-02 + Q-FREEZE-01` 的 `event-001`，再断言以下三种调用失败：

```ts
const now = () => new Date('2026-07-23T00:00:00Z');

expect(() => appendTrace(root, {
  ...input,
  blockId: 'step-01',
  supersedes: 'event-001',
}, now)).toThrow('SUPERSEDE_ATTEMPT_MISMATCH');

expect(() => appendTrace(root, {
  ...input,
  cardAlias: null,
  cardStepId: null,
  materialPath: 'materials/conics-notes.md',
  supersedes: 'event-001',
}, now)).toThrow('SUPERSEDE_ATTEMPT_MISMATCH');

appendTrace(root, { ...input, supersedes: 'event-001' }, now);
expect(() => appendTrace(root, {
  ...input,
  supersedes: 'event-001',
}, now)).toThrow('SUPERSEDE_TARGET_NOT_ACTIVE');
```

同时保留现有“event-002 supersede event-001、event-003 supersede event-002”的合法链测试。

- [ ] **Step 2: 运行测试并确认失败**

Run:

```bash
cd plugins/highschool-study
bun test tests/integration/trace-records.test.ts
```

Expected: 跨 Block 和陈旧目标目前不会按新错误码失败。

- [ ] **Step 3: 在 domain 层校验目标身份**

在解析出 `cardPath` 后，以 active Trace 查找 supersede 目标：

```ts
if (input.supersedes !== null) {
  const target = currentRecords.find((record) => record.eventId === input.supersedes);
  if (!target) traceError('Superseded event does not exist in this Lesson');

  const activeTarget = readActiveTraces(root, [lessonPath])
    .find((record) => record.eventId === input.supersedes);
  if (!activeTarget) traceError('SUPERSEDE_TARGET_NOT_ACTIVE');

  const sameAttempt = target.blockId === input.blockId
    && target.cardPath === cardPath
    && (cardPath !== null || target.materialPath === input.materialPath);
  if (!sameAttempt) traceError('SUPERSEDE_ATTEMPT_MISMATCH');
}
```

不增加 attempt ID；身份继续使用已有事实 `lessonPath + blockId + cardPath/materialPath`。

- [ ] **Step 4: 验证 domain 与 Pi tool**

Run:

```bash
cd plugins/highschool-study
bun test tests/integration/trace-records.test.ts tests/integration/method-signals.test.ts
cd ../../apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts tests/study/ability.test.ts
```

Expected: 全部 PASS；不同 Block 的 Trace 不再能互相关闭。

- [ ] **Step 5: 提交**

```bash
git add plugins/highschool-study/server/src/traces.ts \
  plugins/highschool-study/tests/integration/trace-records.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "fix: scope trace corrections to one attempt"
```

---

### Task 3: 精简方法确认与另解落盘协议

**Files:**

- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/agents/tutor.md`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`
- Test: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Test: `plugins/highschool-study/tests/contract/agent-and-skills.test.ts`

**Interfaces:**

- Consumes: `trace_append(methodStatus, methodRoute, ...)` 与 `card_alternative_append`
- Produces: “先记录事实 → 学生确认方法 → 必要时 supersede”；“先 Trace → 再另解旁挂 → 最后口头确认”

- [ ] **Step 1: 把关键协议写成测试要求**

两套 contract test 都断言 Tutor 文本包含以下短协议，并且不把题卡声明的方法当成确认：

```text
方法确认是一个单独的学生回合
首次正确 Trace 必须使用 methodStatus: unmapped
只有学生下一条消息明确确认后，才允许 student_confirmed
学生拒绝时继续 unmapped
未成功调用 card_alternative_append，只能称为“不同路线，尚未登记为另解”
```

另断言 Skill 仍保留：

```text
只有某一整问的核心推理链不同才是另解
```

- [ ] **Step 2: 运行 contract tests 并确认失败**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts
cd ../../plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: 至少缺少“单独学生回合”和“尚未登记为另解”的精确协议。

- [ ] **Step 3: 用短状态序列替换重复长段落**

在 Tutor Skill 前部加入以下完整协议，并删除后文重复表述：

```markdown
## 正确作答后的落盘顺序

1. 先写一次 `methodStatus: unmapped` 的正确 Trace，只记录学生真实路线。
2. 如果整问核心推理链与参考解和已有另解都不同：先用该 Trace 调用
   `card_alternative_append`。调用成功前，只能说“这是不同路线，尚未登记为另解”。
3. 简短确认答案正确，并提出至多一个方法节点候选，指出它对应学生哪一步。
4. 方法确认必须等待一个新的学生回合。只有学生明确认可后，才用
   `methodStatus: student_confirmed` supersede 同一 Block、同一题卡的 Trace。
5. 学生否定、暂缓或认为词表不贴切时，追加 unmapped 修订或保持当前
   unmapped；不选择“最接近”的节点。
6. 只有某一整问的核心推理链不同才是另解；换记号、调顺序、局部技巧不是另解。
```

Agent 摘要只保留相同顺序，不再复制多段例外条件。

- [ ] **Step 4: 验证资源同步**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts
cd ../../plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: 全部 PASS，Pi 与 Claude Code 两份协议顺序一致。

- [ ] **Step 5: 提交**

```bash
git add apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/resources/agents/tutor.md \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  plugins/highschool-study/skills/run-lesson/SKILL.md \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "docs: simplify tutor evidence closure"
```

---

### Task 4: 分开 Coach 私有备课与学生摘要，并统一 Plan 写回

**Files:**

- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/agents/coach.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/inspect-progress/SKILL.md`
- Modify: `plugins/highschool-study/agents/study-coach.md`
- Test: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Test: `plugins/highschool-study/tests/contract/agent-and-skills.test.ts`

**Interfaces:**

- Consumes: 私有 `card_search` 结果、Lesson Markdown、session-bound `plan_update`
- Produces: 不含题干/约束/方法的学生摘要，以及原子更新后的 Plan

- [ ] **Step 1: 写入备课输出边界测试**

断言 Coach 资源包含：

```text
备课产生两个输出：私有 Lesson 文件和学生可见摘要
学生可见摘要不得出现 card alias、题干、参数、关键约束、方法节点、比较对象、变形方向或答案
若候选题细节已经出现在 Coach 对话中，该题在当前 Plan 内视为 seen，必须重新选题
通用 write/edit 只用于 Lesson；Plan 只能通过 plan_update 写回
新 Lesson 写完并重读后，必须用 plan_update 把它加入 Lesson Index
```

并断言资源包含固定学生摘要模板：

```markdown
已准备 Lesson N：
- 目标：
- 环节：
- 预计用时：
```

- [ ] **Step 2: 运行 contract tests 并确认失败**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts
cd ../../plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: 当前资源未完整规定“已曝光即 seen”和“Plan 只能 plan_update”。

- [ ] **Step 3: 写入最小 Coach 协议**

在 Coach Skill 中加入：

```markdown
## 备课输出边界

备课产生两个输出：

1. 私有 Lesson 文件：可包含题卡 alias、Teacher Control、方法候选和答案；
2. 学生可见摘要：只使用“目标、环节、预计用时”三项。

学生可见摘要不得出现 card alias、题干、参数、关键约束、方法节点、比较对象、
变形方向或答案。若候选题细节已经出现在 Coach 对话中，该题在当前 Plan 内
视为 seen，加入 usedCardPaths 并重新搜索。

通用 write/edit 只写 Lesson。新 Lesson 写完并重读后，调用一次 `plan_update`
把真实 Lesson 状态写入 Lesson Index、Current Position、Next Lesson Candidate
和 Plan Summary。最终审计同样只通过 `plan_update` 写 Plan。
```

学生摘要固定为：

```markdown
已准备 Lesson N：
- 目标：用学生语言描述能力，不说题目结构和方法名。
- 环节：例如“独立作答 → 讨论 → 小测 → 复盘”。
- 预计用时：填写整数分钟。
```

- [ ] **Step 4: 验证同步与既有工具权限**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts tests/runtime/study-tools.test.ts
cd ../../plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts tests/contract/mcp-tools.test.ts
```

Expected: 全部 PASS；公共 MCP 仍只有原四个工具，Pi Coach 继续使用 session-bound `plan_update`。

- [ ] **Step 5: 提交**

```bash
git add apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/agents/coach.md \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  plugins/highschool-study/skills/inspect-progress/SKILL.md \
  plugins/highschool-study/agents/study-coach.md \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "docs: separate private prep from student outlines"
```

---

### Task 5: 工具结果后的单次续跑

**Files:**

- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Test: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`

**Interfaces:**

- Consumes: 一次用户 prompt 后新增的 Pi stored messages
- Produces: 最多一次隐藏 continuation；第二次仍为空时显式失败

- [ ] **Step 1: 写入空回复检测单元测试**

导出纯函数 `needsPostToolContinuation(messages)`，覆盖：

```ts
expect(needsPostToolContinuation([
  { role: 'assistant', content: [{ type: 'toolCall', name: 'trace_search' }] },
  { role: 'toolResult', content: [{ type: 'text', text: '{}' }] },
  { role: 'assistant', content: [] },
])).toBeTrue();

expect(needsPostToolContinuation([
  { role: 'assistant', content: [{ type: 'toolCall', name: 'trace_search' }] },
  { role: 'toolResult', content: [{ type: 'text', text: '{}' }] },
  { role: 'assistant', content: [{ type: 'text', text: '审计完成。' }] },
])).toBeFalse();

expect(needsPostToolContinuation([
  { role: 'assistant', content: [{ type: 'text', text: '普通回答。' }] },
])).toBeFalse();
```

再用 fake session 验证 continuation 最多触发一次。

- [ ] **Step 2: 运行测试并确认函数尚不存在**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts
```

Expected: FAIL，`needsPostToolContinuation` 未导出。

- [ ] **Step 3: 实现窄检测与一次续跑**

检测函数只在同时满足以下条件时返回 true：

1. 本轮存在 `role: toolResult`；
2. tool result 之后没有任何非空 `type: text` 的 assistant content。

在 session factory 内用同一入口包装普通 prompt：

```ts
const promptWithOneContinuation = async (text: string, images: ImageContent[]) => {
  const start = session.messages.length;
  await session.prompt(text, { images });
  if (!needsPostToolContinuation(session.messages.slice(start))) return;

  const continuationStart = session.messages.length;
  await session.sendCustomMessage({
    customType: 'studyforge.post-tool-continuation.v1',
    content: [
      'Continue the same user request now.',
      'Do not repeat completed tool calls.',
      'If the active skill requires another write or reread, perform it before replying.',
      'End with one non-empty student-facing response.',
    ].join(' '),
    display: false,
  }, { triggerTurn: true });

  if (!hasVisibleAssistantText(session.messages.slice(continuationStart))) {
    throw new Error('EMPTY_POST_TOOL_RESPONSE');
  }
};
```

`hasVisibleAssistantText` 只检查 assistant 的非空 `type: text` content。将
StudySession 的 `prompt` 实现改成调用该 wrapper。不得循环重试。

- [ ] **Step 4: 验证 kickoff、普通消息和空回复分支**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts tests/server/workspace-api.test.ts
```

Expected: 全部 PASS；fake session 记录最多一个 `studyforge.post-tool-continuation.v1`。

- [ ] **Step 5: 提交**

```bash
git add apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts
git commit -m "fix: continue one empty post-tool turn"
```

---

### Task 6: 让发送成为一次明确事务

**Files:**

- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Create: `apps/pi-teaching-web/tests/e2e/chat-send.spec.ts`

**Interfaces:**

- Consumes: textarea 当前 DOM 值、已完成上传的图片路径、`onSend`
- Produces: accepted 后才清空；失败保留草稿；发送中禁止重复提交

- [ ] **Step 1: 写入快速 fill + click E2E**

测试连续执行：

```ts
await page.getByPlaceholder('写下你的想法或解题过程…').fill('快速提交');
await page.getByRole('button', { name: /发送/ }).click();
await expect(page.getByText('快速提交')).toBeVisible();
await expect(page.getByPlaceholder('写下你的想法或解题过程…')).toHaveValue('');
```

服务端 fixture 延迟 100ms，再补充断言发送期间按钮 disabled，失败响应时 textarea 保留原文且显示错误。

- [ ] **Step 2: 运行 E2E 并确认至少一个新断言失败**

Run:

```bash
cd apps/pi-teaching-web
bunx playwright test tests/e2e/chat-send.spec.ts
```

Expected: 当前组件没有 sending 状态或局部错误，相关断言 FAIL。

- [ ] **Step 3: 实现提交事务**

给 textarea 增加 `name="message"`，并在组件中加入：

```ts
const [sending, setSending] = useState(false);
const [sendError, setSendError] = useState('');
```

submit 时从表单当前元素读取值：

```ts
const form = event.currentTarget;
const field = form.elements.namedItem('message') as HTMLTextAreaElement;
const value = field.value.trim();
if (sending || uploading || (!value && imagePaths.length === 0)) return;

setSending(true);
setSendError('');
void onSend(value || '请查看我附上的图片。', imagePaths)
  .then(() => {
    setText('');
    clearImages();
  })
  .catch(() => setSendError('消息未发送，草稿已保留。'))
  .finally(() => setSending(false));
```

按钮使用 `disabled={uploading || sending}`，错误放入现有 `aria-live` 区域。

- [ ] **Step 4: 验证**

Run:

```bash
cd apps/pi-teaching-web
bunx playwright test tests/e2e/chat-send.spec.ts
bun run typecheck
```

Expected: E2E 与 typecheck 全部 PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/tests/e2e/chat-send.spec.ts
git commit -m "fix: make chat submission transactional"
```

---

### Task 7: 把提示阶梯改成有用但诚实的教学协议

**Files:**

- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`
- Test: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Test: `plugins/highschool-study/tests/contract/agent-and-skills.test.ts`

**Interfaces:**

- Consumes: 学生已写内容、学生请求的提示级别、现有 A+C support 归因
- Produces: 有意义的单步帮助、正确的 support、每个活动后的短反馈

- [ ] **Step 1: 写入新语义测试**

断言两套 Tutor Skill 包含：

```text
Level 1 只把注意力指回学生已经写出的一个对象或条件，并提出一个可回答的检查问题
Level 2 可以给出一个操作或方法方向
Level 3 可以给出一个关键中间式
提示是否计入 support 取决于最终解答是否实际使用，而不是提示是否出现
正确后先给出“判断 + 一条证据”，再进行方法确认或推进
```

并断言删除现有“数学动作动词禁词表”。

- [ ] **Step 2: 运行 contract tests 并确认失败**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts
cd ../../plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: 新语义尚未存在，旧禁词表仍存在。

- [ ] **Step 3: 替换提示段落**

使用以下短协议：

```markdown
## 提示阶梯

- Level 1：只把注意力指回学生已经写出的一个对象或条件，并提出一个可回答的
  检查问题；不新造比较对象，不给关键中间式。
- Level 2：给出一个操作或方法方向，但不完成变形。
- Level 3：给出一个关键中间式，后续推导仍交给学生。
- 学生可以直接请求任一级，不强迫逐级解锁。
- 提示是否计入 `support` 取决于最终解答是否实际使用；按 A+C 归因，
  不能因为提示出现就自动惩罚，也不能因为学生补完其余步骤就抹去依赖。
- 每个证据活动结束后先回复“判断 + 一条学生证据”，再询问方法节点或推进。
```

- [ ] **Step 4: 验证**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts
cd ../../plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

Expected: 全部 PASS；A+C support 协议仍存在。

- [ ] **Step 5: 提交**

```bash
git add apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  plugins/highschool-study/skills/run-lesson/SKILL.md \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "docs: make tutor hints useful and attributable"
```

---

### Task 8: 支持 Coach 的 Markdown 表格

**Files:**

- Modify: `apps/pi-teaching-web/package.json`
- Modify: `apps/pi-teaching-web/bun.lock`
- Modify: `apps/pi-teaching-web/src/client/components/MarkdownView.tsx`
- Create: `apps/pi-teaching-web/tests/client/markdown-view.test.tsx`

**Interfaces:**

- Consumes: Coach/Tutor Markdown
- Produces: GFM table AST，同时保留 remark-math 与 KaTeX

- [ ] **Step 1: 写入 renderer 测试**

渲染：

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MarkdownView } from '../../src/client/components/MarkdownView';

test('renders GFM tables without breaking math', () => {
  const html = renderToStaticMarkup(
    <MarkdownView>{[
      '| 标准 | 状态 |',
      '| --- | --- |',
      '| 嵌套迁移 | $a>0$ |',
    ].join('\n')}</MarkdownView>,
  );
  expect(html).toContain('<table>');
  expect(html).toContain('<thead>');
  expect(html).toContain('<tbody>');
  expect(html).toContain('katex');
});
```

该测试断言输出含 `table`、`thead`、`tbody`，并保留 `$a>0$` 的 KaTeX 节点。

- [ ] **Step 2: 运行测试并确认表格尚未解析**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/markdown-view.test.tsx
```

Expected: `table` 断言 FAIL。

- [ ] **Step 3: 安装并启用 GFM**

Run:

```bash
cd apps/pi-teaching-web
bun add remark-gfm@4.0.1
```

组件改为：

```tsx
import remarkGfm from 'remark-gfm';

<ReactMarkdown
  remarkPlugins={[remarkGfm, remarkMath]}
  rehypePlugins={[rehypeKatex]}
>
  {children}
</ReactMarkdown>
```

- [ ] **Step 4: 验证**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/markdown-view.test.tsx
bun run build
```

Expected: 测试和 build PASS。

- [ ] **Step 5: 提交**

```bash
git add apps/pi-teaching-web/package.json \
  apps/pi-teaching-web/bun.lock \
  apps/pi-teaching-web/src/client/components/MarkdownView.tsx \
  apps/pi-teaching-web/tests/client/markdown-view.test.tsx
git commit -m "feat: render gfm tables in study chat"
```

---

### Task 9: 全量检查与三节真实课程复验

**Files:**

- Create: `docs/audits/2026-07-23-three-lesson-rerun.md`
- Verify only: `examples/derivative-demo/learning-set/**`

**Interfaces:**

- Consumes: Task 1–8 的实现、干净导数学习集、真实 Pi 模型
- Produces: 可审计的第二轮三课证据报告；不把试跑学习记录并入示例

- [ ] **Step 1: 运行静态和自动测试**

Run:

```bash
cd plugins/highschool-study
bun run release:check
cd ../../apps/pi-teaching-web
bun run check
```

Expected:

- plugin contract/integration/e2e 全部 PASS；
- Pi typecheck、unit tests、build 全部 PASS；
- 公共 MCP 工具仍为 `card_search`、`trace_search`、`trace_append`、`source_resolve`。

- [ ] **Step 2: 从当前提交复制全新学习集**

Run:

```bash
pilot_root="$(mktemp -d /tmp/studyforge-rerun-20260723-XXXXXX)"
cp -R examples/derivative-demo/learning-set "$pilot_root/learning-set"
printf '%s\n' "$pilot_root/learning-set"
```

Expected: 输出唯一临时路径；仓库中的示例目录保持 clean。

- [ ] **Step 3: 真实运行三节课**

三节课分别覆盖：

1. 两张未见题、无提示作答、学生确认或否决方法节点；
2. 一张需要提示的题，验证 A+C support 和同 attempt supersede；
3. 一条真正不同的整问解法、另解落盘，以及 Coach 最终 Plan 审计。

每节课保留 session ID，不复制学生完整文本到报告。

- [ ] **Step 4: 检查九项硬验收**

报告必须逐项记录 PASS/FAIL：

1. 学生首次看到题目前，Coach 对话中没有题干、参数、关键约束、方法或答案；
2. Lesson 创建后立即出现在 Plan Lesson Index；
3. 每个 supersede 的目标与新 Trace 具有相同 Block 和 cardPath/materialPath；
4. `student_confirmed` 前存在独立的学生确认回合；
5. 学生拒绝方法时 active Trace 保持 methods null；
6. Tutor 说“另解”前，题卡 sidecar 已出现绑定 active Trace 的章节；
7. Reflection/Plan 中 `$2/a$`、`$&` 和普通 LaTeX 均未损坏；
8. Coach 最终审计在 `trace_search` 后继续调用 `plan_update`、重读 Plan 并给出非空结论；
9. 页面单击发送成功，Lesson 关闭后能力投影刷新且停留在正确路由。

- [ ] **Step 5: 写审计报告**

`docs/audits/2026-07-23-three-lesson-rerun.md` 只记录：

- 被测 commit、Pi 版本、模型名；
- 三个 session ID；
- 九项 PASS/FAIL；
- 每个 FAIL 的最短复现步骤和对应文件；
- 学习集最终 `git diff --no-index --stat`；
- 明确声明能力投影只是 Coach 信号，不是 mastery 裁决。

- [ ] **Step 6: 验证仓库和报告**

Run:

```bash
git diff --check
git status --short
```

Expected: 只有计划内代码、测试和审计报告发生变化；`examples/derivative-demo/learning-set/**` 无改动。

- [ ] **Step 7: 提交**

```bash
git add docs/audits/2026-07-23-three-lesson-rerun.md
git commit -m "docs: record three-lesson teaching rerun"
```

---

## 4. 执行顺序与并行边界

推荐顺序：

```text
Task 1 ─┐
Task 2 ─┼─→ Task 9
Task 3 ─┤
Task 4 ─┤
Task 5 ─┤
Task 6 ─┤
Task 7 ─┤
Task 8 ─┘
```

Task 1–8 修改边界基本独立，但 Task 3 与 Task 7 都编辑 Tutor Skill，Task 4 编辑相邻 Agent 资源。若并行执行，必须让同一 worker 顺序完成 Task 3 和 Task 7，避免文本冲突。Task 9 必须最后执行。

## 5. 本轮明确不做

- 不自动判定学生是否“真的确认”某方法；这仍由独立学生回合和真实模型验收约束。
- 不新增 seen-card 数据库；当前 Plan 内的 `usedCardPaths` 和 Coach Session 历史足够。
- 不增加内容泄漏分类器或关键词 fence。
- 不给每个工具调用增加通用重试；只处理“已有 tool result、没有可见答复”的单次续跑。
- 不修补本轮临时学习集中的错误 Trace 或陈旧 Plan，以免覆盖原始故障证据。
- 不把本轮被剧透的 Lesson 005 首题计入未见迁移证据。

## 6. 完成定义

只有同时满足以下条件，才可以说本轮优化完成：

1. Task 1–8 的目标测试与完整检查全部通过；
2. 新副本上的三节真实课程完成；
3. 九项真实验收全部 PASS；
4. 最终 Plan 文件与 Lesson 实际状态一致；
5. 能力投影只读取合法 active Trace；
6. 示例学习集和用户原始学习记录未被试跑改写。
