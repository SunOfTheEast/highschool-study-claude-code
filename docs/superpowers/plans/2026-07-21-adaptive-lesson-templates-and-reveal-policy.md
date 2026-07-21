# 自适应课堂模板与防剧透实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Tasks 1–3 also require `superpowers:writing-skills` because they create or modify Claude Code Skills.

**Goal:** 让备课先按课堂需求选择模板和题目角色，再检索多张真实题卡，并让课堂只向学生逐步揭示当前应见内容，不在首次尝试前泄露解法主干。

**Architecture:** 保留一个 `prepare-next-lesson` Skill，在其目录下新增课堂模板目录和共享揭示策略；`lesson-designer` 只负责备课，并在确有必要时核验外部材料；`run-lesson` 按 Lesson 中的 `Student View` / `Teacher Control` 边界投影课堂。四个 MCP 工具、题卡、Trace、知识图谱和 Agent 数量不变。

**Tech Stack:** Claude Code plugin Skills and Agents、Markdown、Bun 1.3.14、TypeScript 7.0.2、`bun:test`、Claude Code CLI smoke tests。

## 全局约束

- 只修改现有 `plugins/highschool-study/`，不创建第二套插件或运行时。
- 不修改四个 MCP 工具、MCP schema、题卡 schema、Trace schema、知识图谱或长期记忆协议。
- 不增加 Agent、规则引擎、Hook、数据库、向量检索或防御性兼容层。
- 课堂模板只是 ActivityBlock 默认组合；学生仍可增删、跳过、重排、暂停或结束。
- 模板题量是默认范围，不是硬配额；真实题卡不足时缩减或调整目标，绝不编卡。
- 题目槽位必须在首次 `card_search` 前产生；备课不得在第一张合适题卡处停止。
- 每个采用的题目槽位绑定去重的真实 `cardPath` 和 Lesson-local alias，并使用候选自带的完整 active `traceHistory`。
- 本地 `materials/` 优先；外部视频只由备课 Agent 核验，必须保存真实标题、URL、片段、目的、课后问题与文字替代。
- 外部 URL 是普通链接，不交给 `source_resolve`；只有学习集内路径或别名使用现有来源解析。
- 每个题目型 ActivityBlock 明确分为 `### Student View` 与 `### Teacher Control`。
- `run-lesson` 一次只展示当前 Block 的 Student View，不倾倒整个 Lesson，也不转述 Teacher Control、题卡答案或 rubric 解法。
- 揭示模式固定为 `zero`、`ladder`、`worked-example`；不新增 Trace 字段，提示层级只在必要时写进 Trace `note`。
- `lesson-designer` 保持 persona-neutral；展示人设不能改变模板选择、题卡选择、揭示级别或能力判断。
- 先写失败 contract，再改提示词或样例；最后运行 `bun run release:check` 和真实 Claude Code smoke。

## 文件职责图

| 职责 | 文件 |
| --- | --- |
| 六类课堂模板与题量/题目角色 | `plugins/highschool-study/skills/prepare-next-lesson/references/classroom-templates.md` |
| 三种揭示模式与首轮禁区 | `plugins/highschool-study/skills/prepare-next-lesson/references/reveal-policy.md` |
| 备课编排和真实题卡检索 | `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md` |
| 备课 Agent 与外部材料核验 | `plugins/highschool-study/agents/lesson-designer.md` |
| 上课投影、提示阶梯与 Trace | `plugins/highschool-study/skills/run-lesson/SKILL.md` |
| Skill / Agent 静态 contract | `plugins/highschool-study/tests/contract/agent-and-skills.test.ts` |
| 防剧透公开回归 | `plugins/highschool-study/tests/contract/adaptive-lesson-demo.test.ts` |
| 真实样例 | `examples/derivative-demo/learning-set/lessons/lesson-003.md` |
| 用户说明 | `plugins/highschool-study/README.md`、`docs/zh-CN/完整说明书.md`、`examples/derivative-demo/README.md` |

## 与人设计划的联合执行顺序

1. 先执行 `2026-07-21-learning-set-orientation-personas.zh-CN.md` 的任务 1–3，使学习集概述、人设入口和公开试用集配置落地。
2. 再执行本计划任务 1–4。人设只进入学生可见表达；`lesson-designer` 仍保持中性。
3. 执行本计划任务 5，同时覆盖人设计划任务 4 的发布检查；无需在中途重复完整 release check 或真实模型 smoke。
4. 每个实现任务使用独立 worker；每个任务结束后先做 spec compliance review，再做 code quality review，修复后才进入下一任务。

---

### 任务 1：加入课堂模板目录与共享揭示策略

**文件：**

- 修改：`plugins/highschool-study/tests/contract/agent-and-skills.test.ts`
- 新建：`plugins/highschool-study/skills/prepare-next-lesson/references/classroom-templates.md`
- 新建：`plugins/highschool-study/skills/prepare-next-lesson/references/reveal-policy.md`

**接口：**

- 产出六个稳定模板 ID：`diagnostic`、`concept`、`deliberate-practice`、`remediation`、`assessment`、`review`。
- 产出三个稳定揭示 ID：`zero`、`ladder`、`worked-example`。
- 后续备课和上课 Skill 读取这两份参考文件，不复制第二套规则。

- [ ] **步骤 1：写失败的参考文件 contract**

在 `agent-and-skills.test.ts` 末尾增加：

```ts
test('ships adaptive classroom templates and one shared reveal policy', () => {
  const templates = read(
    'skills/prepare-next-lesson/references/classroom-templates.md',
  );
  const reveal = read(
    'skills/prepare-next-lesson/references/reveal-policy.md',
  );

  for (const id of [
    'diagnostic',
    'concept',
    'deliberate-practice',
    'remediation',
    'assessment',
    'review',
  ]) expect(templates).toContain(`## ${id}`);

  expect(templates).toContain('Derive problem-role slots before card search');
  expect(templates).toContain('Do not stop after the first suitable card');
  expect(templates).toContain('Default counts are ranges, not quotas');
  expect(templates).toContain('A video is never decorative');

  for (const mode of ['zero', 'ladder', 'worked-example']) {
    expect(reveal).toContain(`## ${mode}`);
  }
  expect(reveal).toContain('### Student View');
  expect(reveal).toContain('### Teacher Control');
  expect(reveal).toContain('one level per student-approved turn');
  expect(reveal).toContain('method recognition is itself the evidence target');
});
```

- [ ] **步骤 2：运行 contract 并确认缺失文件失败**

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

预期：FAIL，`classroom-templates.md` 尚不存在。

- [ ] **步骤 3：创建课堂模板目录**

`classroom-templates.md` 写为：

```markdown
# Classroom Templates

Read this catalog after memory recall and before the first card search. A template supplies defaults for ActivityBlocks, problem roles, material use, and reveal mode. It is not a fixed pipeline: explain the choice, let the student adjust it, and preserve safe skip and reorder choices.

## Shared preparation envelope

- Record one `Primary template` and a short reason in the Lesson.
- Derive problem-role slots before card search.
- Search separately for the required roles and deduplicate by real `cardPath`. Do not stop after the first suitable card.
- Use each candidate's complete active `traceHistory`; prefer cards without active Trace for unseen transfer or assessment.
- Default counts are ranges, not quotas. Adjust them to the capability target, student state, and real available cards, and record the reason.
- If a required role has no authentic card, expose the missing role and shrink the set, use real material or interaction, or ask the student to adjust the target. Never invent a card, alias, source, or question.
- Mark blocks required or optional, list dependencies, and state safe skip or reorder choices.
- A video is never decorative. It must prepare a later observation, question, or practice block.

## diagnostic

- Use for locating the student's current independent starting point.
- Default blocks: brief orientation, consecutive responses, reasoning probes, diagnostic summary.
- Default problem roles: 3–5 short problems with different structures.
- Default reveal: `zero`.

## concept

- Use for introducing a new concept or method.
- Default blocks: local material or verified video, interaction, worked example, separate target practice, exit quiz.
- Default problem roles: one taught example plus 2–3 student-answer problems; the example and target must be different authentic cards.
- Default reveal: `worked-example` for the example and `ladder` for target practice.

## deliberate-practice

- Use for stabilizing a method and transferring it across variations.
- Default blocks: retrieval warm-up, core set, variation, transfer, optional challenge.
- Default problem roles: 4–8 authentic problems across difficulty or structural variation.
- Default reveal: `ladder` after an initial attempt.

## remediation

- Use for repairing a stable error shown by active Trace.
- Default blocks: Trace review, contrast pair, targeted practice, unseen retest.
- Default problem roles: one contrast pair, 1–2 repair problems, one fresh retest.
- Default reveal: `ladder` during repair and `zero` on the fresh retest.

## assessment

- Use for deciding whether an observable capability standard is met.
- Default blocks: standard, consecutive unseen responses, necessary reasoning probes, evidence summary.
- Default problem roles: 2–4 representative unseen problems.
- Default reveal: `zero`. Do not place a teaching video before the assessed attempts.

## review

- Use for interleaved retrieval and comparison across knowledge points.
- Default blocks: mixed retrieval, interleaved set, method comparison, summary.
- Default problem roles: 4–6 mixed authentic problems.
- Default reveal: begin with `zero`; move to `ladder` only after the unsupported evidence has been recorded.
```

- [ ] **步骤 4：创建共享揭示策略**

`reveal-policy.md` 写为：

```markdown
# Reveal Policy

The preparation role may inspect complete cards and solutions. Student-visible teaching must follow the current block's reveal mode and must not dump the Lesson, Teacher Control, card answer, solution, or rubric.

## Lesson block format

Every problem-bearing block contains both headings:

### Student View

Store only the task, authentic problem or reference, and information allowed before the student's next attempt.

### Teacher Control

Store the problem role, evidence target, reveal mode, card-step references, and ordered hints. Prefer references to stable card steps over copied solutions.

## zero

Use for diagnosis and assessment. Before the first attempt, reveal no method name, decisive transformation, intermediate conclusion, answer, option elimination, or rubric result. If the student asks for help, first record the real unsupported or incomplete attempt, then teach. Any later unsupported validation uses a different unseen card.

## ladder

Require an initial attempt. When the student is stuck, ask whether they want a hint and reveal one level per student-approved turn:

1. name only the object, condition, or known information to inspect;
2. identify a structural direction without the exact transformation;
3. give one key step;
4. give the full solution only after an explicit request.

Record actual support honestly. The existing Trace `support` remains `none`, `tutor`, or `external`; when useful, put the highest revealed ladder level in `note`.

## worked-example

A complete worked example is allowed in a concept lesson. The later student target must be a different authentic card, and the example must not announce the target's decisive transformation, intermediate result, or answer.

## First-attempt forbidden content

Unless the selected mode explicitly allows it, do not reveal:

- the correct answer or option;
- a decisive substitution, divisor, factorization, or construction;
- a complete monotonic interval, parameter bound, or key intermediate expression;
- a reason that directly eliminates an option;
- the method name when method recognition is itself the evidence target.

A video that solves the target cannot appear before the target's first attempt. Use a different example or move the video after that attempt.
```

- [ ] **步骤 5：运行 contract 并确认通过**

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

预期：该文件全部测试 PASS。

- [ ] **步骤 6：提交参考文件**

```bash
git add plugins/highschool-study/skills/prepare-next-lesson/references \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "feat: add adaptive classroom templates"
```

---

### 任务 2：让备课先选模板和题目槽位，再检索多张真实卡

**文件：**

- 修改：`plugins/highschool-study/tests/contract/agent-and-skills.test.ts`
- 修改：`plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- 修改：`plugins/highschool-study/agents/lesson-designer.md`

**接口：**

- 消费：Plan 能力标准、前序摘要、active Trace、两份画像、`planner-attention.md`、两份 reference。
- 产出：主模板、选择理由、题目角色、真实去重卡片、材料、Student View / Teacher Control 和空白课后区。
- 只有 `lesson-designer` 新增 `WebSearch` / `WebFetch`；学生侧 `study-coach` 和 `run-lesson` 不新增联网工具。

- [ ] **步骤 1：写失败的备课 contract**

先把现有 `declares exact role tool boundaries` 测试中的 Designer 工具期望替换为：

```ts
  expect(toolList(designer, 'tools')).toEqual([
    'Read',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
    'Agent',
    mcp.cardSearch,
    mcp.traceSearch,
    mcp.sourceResolve,
  ]);
```

然后在 `agent-and-skills.test.ts` 末尾增加：

```ts
test('prepares from a template and role slots before searching cards', () => {
  const prepare = read('skills/prepare-next-lesson/SKILL.md');
  const designer = read('agents/lesson-designer.md');

  expectInOrder(prepare, [
    'Read `references/classroom-templates.md`',
    'Choose one primary template',
    'Derive the problem-role slots before the first `card_search`',
    'Search separately for the required slots',
    'Draft every problem-bearing block with `### Student View`',
  ]);
  expect(prepare).toContain('Do not stop at the first suitable card');
  expect(prepare).toContain('title, URL, segment, purpose, follow-up question, and fallback');
  expect(prepare).toContain('External URLs remain ordinary links');

  expect(toolList(designer, 'tools')).toEqual([
    'Read',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
    'Agent',
    mcp.cardSearch,
    mcp.traceSearch,
    mcp.sourceResolve,
  ]);
  expect(designer).toContain('Keep `lesson-designer` persona-neutral');
  expect(designer).toContain('Verify every external video');
  expect(designer).toContain('Never use an external video to solve the target before its first attempt');
});
```

- [ ] **步骤 2：运行 contract 并确认顺序或工具断言失败**

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

预期：FAIL；`prepare-next-lesson` 尚未先选择模板，`lesson-designer` 也没有 `WebSearch` / `WebFetch`。

- [ ] **步骤 3：重写 `prepare-next-lesson` 的编排流程**

将 `prepare-next-lesson/SKILL.md` 替换为：

```markdown
---
name: prepare-next-lesson
description: Prepare a source-grounded, flexible next Lesson for one eligible Plan.
allowed-tools: Read, Glob, Grep, Write, Edit, Skill, Agent(highschool-study:lesson-designer), mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
---

1. Select one eligible Plan from explicit dependencies and the student's approved order. Call `highschool-study:recall-study-memory` with purpose `preparation` before searching for new material.
2. Read `references/classroom-templates.md` and `references/reveal-policy.md`. Choose one primary template from the Lesson capability target, prior Lesson Summaries, active Trace, both confirmed profiles, and preparation-only planner attention. Explain the reason, proposed problem roles, materials, and reveal modes. Let the student adjust them; if the student says to prepare directly, do not force another confirmation turn.
3. Derive the problem-role slots before the first `card_search`. Search separately for the required slots, deduplicate by real `cardPath`, and Do not stop at the first suitable card. Every card_search candidate already includes its complete active traceHistory. Do not call `trace_search` to refetch a candidate's history; use it only for a cross-card evidence question or evidence not scoped to one card.
4. Bind every adopted problem slot to a real Lesson-local alias and card path. Prefer cards without active Trace for unseen transfer or assessment. If authentic cards are insufficient, expose the missing role and shrink the set, use real material or interaction, or ask the student to adjust the target. Never invent a card, problem, alias, source, or session ID.
5. Prefer real local `materials/`. If an external video has a necessary instructional role, delegate verification to `Agent(highschool-study:lesson-designer)`. Keep it only when the returned draft includes its real title, URL, segment, purpose, follow-up question, and fallback. External URLs remain ordinary links; use `source_resolve` only for learning-set-local references. Never place a video that solves a target before that target's first attempt.
6. Delegate additional preparation to `Agent(highschool-study:lesson-designer)` only when direct evidence is insufficient. Optional Agent/Dynamic Workflow remains subject to the recall Skill's parallel-search gate, and raw JSON remains in the current session.
7. Draft every problem-bearing block with `### Student View` followed by `### Teacher Control`. In Teacher Control, record the role, evidence target, reveal mode, card-step references, and ordered hints without copying a full solution when stable step references suffice. Mark required and optional blocks, dependencies, and safe skip or reorder choices.
8. Write the next indexed Lesson as prepared, with its Plan link, capability target, primary template and reason, direct sources, blocks, aliases, and empty Reflection, Lesson Summary, and Trace areas. Preparation does not append classroom evidence, assert attainment, edit either profile, or close the Lesson or Plan.
```

- [ ] **步骤 4：扩展 `lesson-designer` 的材料核验能力**

将 `agents/lesson-designer.md` 替换为：

```markdown
---
name: lesson-designer
description: Internal preparation-only role for drafting the next source-grounded Lesson.
tools: Read, Glob, Grep, WebSearch, WebFetch, Agent, mcp__plugin_highschool-study_study-markdown__card_search, mcp__plugin_highschool-study_study-markdown__trace_search, mcp__plugin_highschool-study_study-markdown__source_resolve
skills:
  - highschool-study:recall-study-memory
---

This is an internal, preparation-only role. Work only when the study coach delegates a selected Plan and preparation purpose. If invoked by a student, make no changes and redirect to the coach. Never ask the student to switch Agents.

Keep `lesson-designer` persona-neutral. Read the preparation Skill's `references/classroom-templates.md` and `references/reveal-policy.md`, recall the supplied learning set, inspect real candidates and evidence, and return a source-linked Lesson draft to the coach. You have no learner-record writer: do not teach, close a Lesson or Plan, edit profiles, or append Trace. Never invent cards, sources, URLs, or session IDs. Never persist raw Workflow JSON; keep optional Agent findings in the Claude session and return only conclusions supported by direct sources.

Derive problem roles from the chosen template before searching. Search required roles separately, deduplicate real card paths, inspect every candidate's active `traceHistory`, and report missing roles instead of fabricating cards. The returned draft separates `### Student View` from `### Teacher Control` and cites stable card steps rather than copying full solutions.

Prefer local materials. Verify every external video with WebSearch and WebFetch before adopting it. Return its exact title, canonical URL, relevant segment or timestamp, teaching purpose, student follow-up question, and a local text or diagram fallback. If any of those facts cannot be verified, omit the video. Never use an external video to solve the target before its first attempt; use a different example or place it later. External URLs are ordinary links and never go through `source_resolve`.

Only launch Agent/Dynamic Workflow when direct evidence is insufficient and at least two independent searches can run in parallel. Otherwise work directly from the recalled Markdown, candidate cards, active Trace, resolved local sources, and any verified external material.
```

- [ ] **步骤 5：运行备课 contract 和严格插件验证**

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
claude plugin validate . --strict
```

预期：contract 全部 PASS；严格验证接受 `WebSearch` 与 `WebFetch` 工具声明。

- [ ] **步骤 6：提交备课改动**

```bash
git add plugins/highschool-study/agents/lesson-designer.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "feat: prepare multi-problem adaptive lessons"
```

---

### 任务 3：让课堂只投影 Student View 并执行分级揭示

**文件：**

- 修改：`plugins/highschool-study/tests/contract/agent-and-skills.test.ts`
- 修改：`plugins/highschool-study/skills/run-lesson/SKILL.md`

**接口：**

- 消费：当前 Lesson、当前 Block 的 Student View / Teacher Control、共享揭示策略、真实题卡和 active Trace。
- 产出：当前一步学生可见任务、按需单级提示、带真实 support 的 Trace 和既有反思路由。

- [ ] **步骤 1：写失败的课堂 contract**

在 `agent-and-skills.test.ts` 末尾增加：

```ts
test('projects only Student View and enforces reveal modes', () => {
  const run = read('skills/run-lesson/SKILL.md');

  expectInOrder(run, [
    'Read the shared `reveal-policy.md`',
    'project only the current block\'s `### Student View`',
    'For `zero`',
    'For `ladder`',
    'For `worked-example`',
    'call `trace_append`',
  ]);
  expect(run).toContain('Never dump the whole Lesson');
  expect(run).toContain('never quote or paraphrase `### Teacher Control`');
  expect(run).toContain('one level in one student-approved turn');
  expect(run).toContain('use a different unseen card');
  expect(run).toContain('Task completion is not capability attainment');
  expect(toolList(run, 'allowed-tools')).not.toContain('WebSearch');
  expect(toolList(run, 'allowed-tools')).not.toContain('WebFetch');
});
```

- [ ] **步骤 2：运行 contract 并确认 Student View 断言失败**

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

预期：FAIL；现有 `run-lesson` 没有明确的双区投影与三种揭示流程。

- [ ] **步骤 3：重写 `run-lesson` 的课堂投影规则**

将 `run-lesson/SKILL.md` 替换为：

```markdown
---
name: run-lesson
description: Teach or resume one prepared Lesson while preserving evidence and student control.
allowed-tools: Read, Glob, Grep, Edit, Skill, TaskCreate, TaskUpdate, TaskList, mcp__plugin_highschool-study_study-markdown__trace_append, mcp__plugin_highschool-study_study-markdown__source_resolve
---

1. Call `highschool-study:recall-study-memory` with purpose `teaching`, then read the prepared Lesson, its direct sources, and the shared `reveal-policy.md` under `prepare-next-lesson/references/`. Do not read planner attention during teaching.
2. At entry and after every student turn, check for a transition request. Whenever the student asks to pause or close, call `highschool-study:close-lesson-reflection` immediately, regardless of capability attainment, and stop the normal sequence pending that reflection outcome. Do this before another activity or Task change. This request-triggered reflection is separate from the attainment-first reflection below.
3. If the Lesson is paused, first show its recorded pause point, remaining blocks, and active evidence. Require a fresh explicit `continue`, `adjust`, or `close` choice; the earlier pause instruction is not consent to resume. Before that choice, make no Task calls and do not teach. On continue, proceed from the saved point. On adjust, revise only the remaining blocks as requested and then proceed. On close, call `highschool-study:close-lesson-reflection` and stop without recreating Tasks.
4. Only after that choice for a paused Lesson—or immediately for an already active Lesson—project the Lesson's remaining ActivityBlocks to a coarse Task List. Tell the student which blocks are optional and let them skip, reorder, repeat, or adjust blocks when dependencies still hold. Tasks are a user-interface projection, never evidence or authority.
5. Teach one block at a time and project only the current block's `### Student View`. Never dump the whole Lesson, and never quote or paraphrase `### Teacher Control`, a card answer, solution, rubric result, or a future block. Read Teacher Control privately only to apply its evidence target and reveal mode.
6. For `zero`, reveal no method, decisive transformation, intermediate result, answer, or option elimination before the first attempt. If the student asks for help, first record the real unsupported or incomplete attempt, then teach; use a different unseen card for any later unsupported validation.
7. For `ladder`, require an initial attempt, ask whether the student wants a hint, and reveal only one level in one student-approved turn. Do not skip from a structural cue to a key step or full solution. Give the full solution only after an explicit request and record the actual support.
8. For `worked-example`, the fully explained example and the student's target must be different real cards. Do not carry the target's decisive transformation, intermediate result, or answer into the example explanation.
9. After every evidence-bearing activity, call `trace_append` with the real Plan, Lesson, block, source/card identity, observation, support level, and student evidence. When useful, record the highest ladder level in `note`; do not add a Trace field. Resolve learning-set-local source references when necessary and never invent cards, sources, session IDs, or learner statements.
10. Update Lesson working notes from appended Trace without replacing the original evidence. Keep observation, evaluation, hypothesis, and unresolved question distinct.
11. Separately, when evidence first meets a Lesson or Plan criterion, show the supporting and conflicting evidence and call `highschool-study:close-lesson-reflection`, even if the student has not requested a transition. Task completion is not capability attainment. Capability attainment does not close a Lesson or Plan automatically.

Never edit confirmed profiles during teaching. Never let Task state, time elapsed, or a correct answer without its support conditions stand in for the recorded capability test.
```

- [ ] **步骤 4：运行课堂 contract**

```bash
cd plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts
```

预期：全部 PASS，且 `run-lesson` 工具列表不包含联网工具。

- [ ] **步骤 5：提交课堂揭示规则**

```bash
git add plugins/highschool-study/skills/run-lesson/SKILL.md \
  plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "feat: enforce lesson reveal boundaries"
```

---

### 任务 4：把导数 Lesson 003 改成多题、防剧透回归样例

**文件：**

- 新建：`plugins/highschool-study/tests/contract/adaptive-lesson-demo.test.ts`
- 修改：`examples/derivative-demo/learning-set/lessons/lesson-003.md`

**接口：**

- 主模板固定为 `assessment`，因为本课目标是连续性核验和未见结构迁移。
- 两道未见验收卡：`mst_p0032_ex22`、`mst_p0030_ex16`。
- 一道只用于可选修复的已见卡：`mst_p0017_ex05`；它有历史 Trace，不作为无提示新证据。
- Student View 不出现三张卡的答案、关键变形、同构函数、参数边界或正确选项。

- [ ] **步骤 1：写失败的公开回归测试**

创建 `adaptive-lesson-demo.test.ts`：

```ts
import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dir, '../../../..');
const demo = join(repo, 'examples/derivative-demo/learning-set');
const lesson = readFileSync(join(demo, 'lessons/lesson-003.md'), 'utf8');

test('lesson 003 is a multi-card assessment with private teacher control', () => {
  expect(lesson).toContain('- Primary template: `assessment`');
  expect(lesson.match(/^### Student View$/gm)).toHaveLength(5);
  expect(lesson.match(/^### Teacher Control$/gm)).toHaveLength(5);

  for (const path of [
    'cards/derivative/mst_p0017_ex05.card.yaml',
    'cards/derivative/mst_p0032_ex22.card.yaml',
    'cards/derivative/mst_p0030_ex16.card.yaml',
  ]) expect(existsSync(join(demo, path))).toBe(true);

  expect(lesson).toContain(
    '- Q-DOMAIN-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml',
  );
  expect(lesson).toContain(
    '- Q-DOMAIN-EX16: ../cards/derivative/mst_p0030_ex16.card.yaml',
  );
  expect(lesson).toContain(
    '- Q-DOMAIN-EX05: ../cards/derivative/mst_p0017_ex05.card.yaml',
  );

  const studentViews = [...lesson.matchAll(
    /### Student View\n\n([\s\S]*?)(?=\n### Teacher Control)/g,
  )].map((match) => match[1]).join('\n');

  for (const spoiler of [
    '同除',
    'f(t)=',
    'ae^x>x',
    'a\\ge\\frac{1}{e}',
    '选 D',
    '选 C',
  ]) expect(studentViews).not.toContain(spoiler);

  expect(lesson).toContain('- Reveal: `zero`');
  expect(lesson).toContain('Q-DOMAIN-EX22 `step_1` and `step_5`');
  expect(lesson).toContain('Q-DOMAIN-EX16 `step_1` and `step_7`');
  expect(lesson).toContain('not independent assessment evidence');
});
```

- [ ] **步骤 2：运行回归并确认旧 Lesson 失败**

```bash
cd plugins/highschool-study
bun test tests/contract/adaptive-lesson-demo.test.ts
```

预期：FAIL；旧 Lesson 没有模板声明和双区结构，并在学生可见正文中泄露关键路线。

- [ ] **步骤 3：重写 Lesson 003**

将 `examples/derivative-demo/learning-set/lessons/lesson-003.md` 替换为：

```markdown
---
id: lesson-003
kind: lesson
plan_id: domain-integrity
status: prepared
---
# Lesson 003：阶段 1b — 定义域连续性与跨结构迁移核验

## Plan Link

[定义域完整性的系统加固](../plans/domain-integrity.md) — 阶段 `1b`：用两道未见结构核验定义域能否连续独立无遗漏，并观察它是否真正参与边界判断。

## Capability Target

面对含参数对数和开区间边界的恒成立不等式，在无提示下先写全定义域与正负条件，并在变形、参数分离和端点判断中主动使用这些条件。

## Lesson Configuration

- Primary template: `assessment`
- Reason: 本课需要确认阶段 `1b` 是否达标，并用第二种未见结构观察迁移；教学和提示不能先于验收证据。
- Adjustment: 保留一个可选的历史题修复 Block；只有首题出现缺口或学生主动求助时使用。
- Required unseen roles: continuity check、cross-structure transfer。
- Optional seen role: trace-grounded remediation。

## Sources

- Continuity check: [mst_p0032_ex22](../cards/derivative/mst_p0032_ex22.card.yaml)
- Transfer check: [mst_p0030_ex16](../cards/derivative/mst_p0030_ex16.card.yaml)
- Optional remediation: [mst_p0017_ex05](../cards/derivative/mst_p0017_ex05.card.yaml) and [Lesson 002 Trace](lesson-002.md#trace-event-001)
- Public source policy: [demo notes](../materials/demo-notes.md#source-policy)

## Dependencies and control

- `orientation` precedes both assessment Blocks.
- `assessment-01` precedes `assessment-02`; `repair-optional` may be inserted between them.
- `repair-optional` is skipped when the first response is independently complete.
- The student may pause or close at any time. `reflection` may move earlier only after at least one evidence-bearing attempt.

---

## Block orientation（必做）

### Student View

本课先做两道不同结构的未见题。每题请先单独写出定义域、恒正或恒负条件，再开始等价变形；两题首次尝试都不提供提示。你可以随时暂停或结束。

### Teacher Control

- Role: capability-standard orientation。
- Evidence target: 学生理解“先列合法域并在后续真正使用”，但不提前获知任何目标卡的方法。
- Reveal: `zero`。
- Do not name the target method or preview either card's transformation.

---

## Block assessment-01（必做）

### Student View

请独立完成题卡 `Q-DOMAIN-EX22`。教练只呈现真实题干和选项；请先写出所有合法性与符号条件，再给出完整理由和结论。

### Teacher Control

- Role: continuity check for Plan stage `1b`。
- Evidence target: 定义域是否无提示写全，并在关键变形和开区间边界中被主动使用。
- Reveal: `zero`。
- Card evidence: Q-DOMAIN-EX22 `step_1` and `step_5`; inspect the remaining card steps privately only after the student's attempt.
- If help is requested, record the unsupported or incomplete attempt, then offer `repair-optional`. Do not count the supported completion as independent `1b` evidence.

---

## Block repair-optional（可选）

### Student View

如果你希望先修复卡点，我们回看已经做过的 `Q-DOMAIN-EX05`：只比较“哪些量必须先保证有意义或为正，以及这些条件后来在哪一步真正被使用”。不把旧题结果当成新验收证据。

### Teacher Control

- Role: trace-grounded remediation using a seen card.
- Evidence target: connect the Lesson 002 domain success to the gap just observed.
- Reveal: `ladder`.
- Source: Lesson 002 Trace event-001 and Q-DOMAIN-EX05 `step_1`–`step_2`.
- Reveal one level per consented turn. This block is not independent assessment evidence.

---

## Block assessment-02（必做）

### Student View

请独立完成另一张未见题卡 `Q-DOMAIN-EX16`。教练只呈现真实题干和选项；仍然先写合法域和符号条件，再决定如何推进。

### Teacher Control

- Role: cross-structure transfer; if repair ran, this is also the fresh unsupported retest.
- Evidence target: 定义域、正量与开区间边界能否迁移到不同外壳，而不是复述上一题路线。
- Reveal: `zero`.
- Card evidence: Q-DOMAIN-EX16 `step_1` and `step_7`; inspect the remaining card steps privately only after the student's attempt.
- Do not reuse a hint, intermediate result, or answer from assessment-01.

---

## Block reflection（必做）

### Student View

比较两次首次尝试：哪一个定义域或符号条件真正改变了你的变形合法性、参数边界或端点取舍？如果你认为今天已经够了，也可以在这里结束课程。

### Teacher Control

- Role: evidence summary and student-controlled closure.
- Evidence target: distinguish an independently used condition from a condition added only during checking.
- Reveal: `zero`; summarize only evidence already produced by the student and active Trace.
- Task completion is not capability attainment. Show supporting and conflicting evidence before reflection routing.

## Reflection

（课堂结束后填写）

## Lesson Summary

（课堂结束后填写）

## Aliases

- Q-DOMAIN-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml
- Q-DOMAIN-EX16: ../cards/derivative/mst_p0030_ex16.card.yaml
- Q-DOMAIN-EX05: ../cards/derivative/mst_p0017_ex05.card.yaml

## Traces

（课堂中通过 trace_append 追加）
```

- [ ] **步骤 4：运行公开回归和全部 contract**

```bash
cd plugins/highschool-study
bun test tests/contract/adaptive-lesson-demo.test.ts
bun test tests/contract
```

预期：全部 PASS；Student View 提取结果不包含列出的首轮剧透字符串。

- [ ] **步骤 5：提交回归样例**

```bash
git add examples/derivative-demo/learning-set/lessons/lesson-003.md \
  plugins/highschool-study/tests/contract/adaptive-lesson-demo.test.ts
git commit -m "test: add multi-card anti-spoiler lesson"
```

---

### 任务 5：补充说明并完成两项功能的合并验收

**文件：**

- 修改：`plugins/highschool-study/tests/contract/adaptive-lesson-demo.test.ts`
- 修改：`plugins/highschool-study/README.md`
- 修改：`docs/zh-CN/完整说明书.md`
- 修改：`examples/derivative-demo/README.md`

**接口：**

- 产出学生可读的模板选择、多题槽位、视频核验和防剧透说明。
- 产出同时覆盖“学习集概述/人设”和“自适应课堂/揭示策略”的 release 与真实会话证据。

- [ ] **步骤 1：写失败的文档 contract**

在 `adaptive-lesson-demo.test.ts` 末尾增加：

```ts
test('documents adaptive templates and reveal boundaries', () => {
  const pluginReadme = readFileSync(
    join(repo, 'plugins/highschool-study/README.md'), 'utf8',
  );
  const manual = readFileSync(
    join(repo, 'docs/zh-CN/完整说明书.md'), 'utf8',
  );
  const demoReadme = readFileSync(
    join(repo, 'examples/derivative-demo/README.md'), 'utf8',
  );

  for (const doc of [pluginReadme, manual, demoReadme]) {
    expect(doc).toContain('诊断课');
    expect(doc).toContain('专项训练课');
    expect(doc).toContain('能力验收课');
    expect(doc).toContain('Student View');
    expect(doc).toContain('Teacher Control');
    expect(doc).toContain('zero');
    expect(doc).toContain('ladder');
    expect(doc).toContain('worked-example');
  }
});
```

- [ ] **步骤 2：运行文档 contract 并确认失败**

```bash
cd plugins/highschool-study
bun test tests/contract/adaptive-lesson-demo.test.ts
```

预期：FAIL；三份说明尚未同时写明模板与揭示语义。

- [ ] **步骤 3：在三份说明中加入同一组核心语义**

三份文档各加入一节“自适应课堂与防剧透”，保留各自上下文，但必须完整表达下面这段：

```markdown
### 自适应课堂与防剧透

备课会根据当前目标和 Trace 选择一个主模板：诊断课、概念新授课、专项训练课、错因修复课、能力验收课或复习整合课。模板只是 ActivityBlock 的默认组合，学生仍可增删、跳过和重排。

Planner 先确定热身、核心、变式、迁移、补救或挑战等题目角色，再分别搜索真实题卡；不会找到第一题就停止。真实卡片不足时会缩减题组或调整课堂目标，不会临时编卡。

题目 Block 分为 `Student View` 与 `Teacher Control`。Coach 只展示当前 Student View，并按三种模式揭示：`zero` 在诊断和验收首次尝试前不给提示；`ladder` 在学生尝试并同意后每轮只给一级提示；`worked-example` 可以完整讲示例，但学生目标题必须是另一张真实卡。Teacher Control、题卡答案和解法步骤不会被整段转述给学生。

视频优先使用本地 `materials/`。外部视频只有在备课侧核验真实标题、链接、相关片段、教学目的和文字替代后才会加入；解决目标题的视频不会放在首次尝试之前。
```

- [ ] **步骤 4：运行全部自动验证**

```bash
cd plugins/highschool-study
bun run release:check
```

预期：dist 重建、TypeScript 检查、全部 `bun:test` 和 `claude plugin validate . --strict` 都成功。

- [ ] **步骤 5：准备四个隔离的真实备课 smoke 学习集**

```bash
REPO="$(git rev-parse --show-toplevel)"
for kind in diagnostic concept practice assessment; do
  rm -rf "/tmp/highschool-study-$kind-smoke"
  cp -R "$REPO/examples/derivative-demo" "/tmp/highschool-study-$kind-smoke"
done
```

预期：四个目录都包含独立的导数试用集副本，不会改写仓库样例。

- [ ] **步骤 6：验证四类需求产生不同模板和题目角色**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"

cd /tmp/highschool-study-diagnostic-smoke
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits --max-budget-usd 1 \
  '/highschool-study:study 直接为当前 Plan 备一节诊断课，用不同结构短题确认起点；只用真实题卡。'

cd /tmp/highschool-study-concept-smoke
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits --max-budget-usd 1 \
  '/highschool-study:study 直接为当前 Plan 备一节概念新授课，示例与学生目标题必须分开；本地材料足够就不要找视频，若加入外部视频必须可核验并带文字替代。'

cd /tmp/highschool-study-practice-smoke
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits --max-budget-usd 1 \
  '/highschool-study:study 直接为当前 Plan 备一节专项训练课，安排热身、核心、变式和迁移；只用去重真实题卡。'

cd /tmp/highschool-study-assessment-smoke
claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits --max-budget-usd 1 \
  '/highschool-study:study 直接为当前 Plan 备一节能力验收课，使用两道以上未见代表题，首次尝试零提示且不要教学视频。'
```

预期：新 Lesson 分别记录 `diagnostic`、`concept`、`deliberate-practice`、`assessment` 主模板；题量和角色符合对应默认；每张采用卡都是真实、去重路径并带双区 Block。

- [ ] **步骤 7：验证 Lesson 003 首轮输出不剧透**

```bash
REPO="$(git rev-parse --show-toplevel)"
PLUGIN="$REPO/plugins/highschool-study"
SMOKE="/tmp/highschool-study-run-smoke"
rm -rf "$SMOKE"
cp -R "$REPO/examples/derivative-demo" "$SMOKE"
cd "$SMOKE"
output="$(claude -p --plugin-dir "$PLUGIN" --permission-mode acceptEdits \
  --max-budget-usd 1 \
  '/highschool-study:study 开始 Lesson 003，只展示第一道验收题的首次任务；我还没有作答，不要提示、讲方法或给答案。')"
printf '%s\n' "$output"
printf '%s\n' "$output" | rg 'mst_p0032_ex22|Q-DOMAIN-EX22|x\^2'
if printf '%s\n' "$output" | rg -q 'a.?≥.?1/e|选.?D|ln.?t.?/.?t|同除.*xae'; then exit 1; fi
```

预期：输出呈现真实第一题任务，但不命中参数答案、正确选项、目标同构函数或决定性除量。

- [ ] **步骤 8：复跑人设 smoke 的核心组合**

按 `2026-07-21-learning-set-orientation-personas.zh-CN.md` 任务 4 的步骤 2–8 执行：首次概述、默认人设、临时切换、持久切换、新 Session 继承、本地同名覆盖、关闭人设和已有 Trace 不重复概述。

预期：所有人设行为通过，并且同一学习集中的模板选择、题卡路径、Lesson 003 Student View 和能力标准不随人设改变。

- [ ] **步骤 9：提交文档与 contract**

```bash
git add plugins/highschool-study/tests/contract/adaptive-lesson-demo.test.ts \
  plugins/highschool-study/README.md docs/zh-CN/完整说明书.md \
  examples/derivative-demo/README.md
git commit -m "docs: explain adaptive lesson delivery"
```

- [ ] **步骤 10：验证最终工作区和提交历史**

```bash
git status --short
git diff --check
git log --oneline -12
```

预期：没有未解释的产品文件、空白错误或 MCP/题卡/Trace/图谱改动；计划文档与两项功能的独立提交均可见。

## 最终验收清单

- [ ] 学习集概述与当前人设在 `study` 路由前解析，persona 只影响学生可见表达。
- [ ] 备课从六种主模板中选择，并允许学生调整 ActivityBlock。
- [ ] 题目角色先于检索产生，多题课堂绑定多张去重真实卡和各自 traceHistory。
- [ ] 外部视频只由备课侧核验，缺任一必要字段就不采用。
- [ ] 每个题目 Block 分开 Student View 与 Teacher Control，上课不主动泄露教师区。
- [ ] `zero`、`ladder`、`worked-example` 的首次尝试和支持证据语义可区分。
- [ ] Lesson 003 使用两道未见验收卡和一张可选历史修复卡，Student View 不含解法主干。
- [ ] 四个 MCP 工具、题卡、Trace、图谱、Agent 数量和长期记忆协议未改变。
- [ ] `bun run release:check`、自适应课堂 smoke 和人设 smoke 全部通过。
