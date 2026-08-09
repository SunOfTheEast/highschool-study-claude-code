# Lesson 关闭与 Reflection 解耦 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 让学生能在任意 active Tutor 对话轮次可靠结束 Lesson，同时把 Reflection 恢复为模板可调整的普通课堂 Block，并保持 Trace、Plan、关课快照和能力投影各自清晰的权威边界。

**Architecture:** `lesson_close` 只把一份 source-linked `Lesson Summary` 和 `status: closed` 原子写回当前 Session-owned Lesson，不读取或修改任何 Block。Blueprint 与 prepared admission 接受 0、1 或多个 Reflection Block；前端保留 closed Tutor replay，直到学生显式返回 Coach。Trace 更正只刷新 active-evidence 派生投影，不级联改写 Lesson Summary、Plan、另解 sidecar 或长期记忆。

**Tech Stack:** TypeScript 7、Bun 1.3.14、TypeBox、React 19、Markdown-first learning set、Playwright、Pi 0.81。

**Design:** `docs/superpowers/specs/2026-07-25-lesson-close-reflection-decoupling-design.md`

## Global Constraints

- 保持 Roadmap → Plan → Lesson 的 Markdown-first 治理结构。
- 不增加数据库、后台索引、规则引擎、新 Agent、新持久化字段或兼容分支。
- 不增加 `lesson_summary_update`、closed Lesson 纠错 UI 或第五个公共 MCP 工具。
- `lesson_close` 仍为 Tutor Session-bound；模型不能填写或覆盖 `ownerPath`、Lesson 路径、Block ID 或状态。
- `lesson_close` 的唯一模型参数是非空 `summary`；成功回执仍为 `{ ok: true, ownerPath, status: "closed" }`。
- 关闭 Lesson 不完成、跳过或重排任何 Block，也不决定 Plan 是否达标。
- Reflection Block 数量由模板提供可调整默认值，不成为 validator、配额或隐藏状态机。
- 同一次 attempt 的误记通过现有 `Supersedes` 修正；新的独立 attempt 保留为另一条 active Trace。
- 证据判断以 active Trace 为准；Plan 状态只由 Coach 调用 `plan_update` 改变。
- BKT、Planner Attention 和能力节点可以随 active Trace 重建；Lesson Summary、Plan、alternatives sidecar 和长期记忆不自动重写。
- 不测试 Skill 或 Agent 的固定措辞；只测试可执行 schema、写入、准入、投影、路由和学生视图。
- 真实模型验收只操作新复制的 learning set，不修改 `examples/derivative-demo/learning-set`。
- 不提交 Provider 凭据、Pi Session JSONL、完整私人课堂转录或 `CLAUDE.local.md`。
- 当前工作树已有两处不属于本计划的未提交修改：
  - `apps/pi-teaching-web/src/study/write-workspace.ts` 中的 replacement callback；
  - `apps/pi-teaching-web/tests/study/write-workspace.test.ts` 中的 dollar-literal 回归测试。
- 上述两处必须原样保留且不得混入本计划提交。Task 1 修改同一文件时使用 `git add -p`，并在提交前核对 staged diff。

---

## File Structure

### Lesson 关闭契约

- Modify `apps/pi-teaching-web/src/study/write-workspace.ts`
  - 删除 active Reflection 查找和 Block 完成逻辑；
  - `closeLesson` 只写 Lesson Summary 与 closed 状态；
  - 拒绝已经 `closed` 或 `abandoned` 的终态 Lesson。
- Modify `apps/pi-teaching-web/src/runtime/lesson-close.ts`
  - TypeBox 参数只保留 `summary`；
  - 更新工具说明，保持原成功回执。
- Modify executable tests under `apps/pi-teaching-web/tests/study/` and
  `apps/pi-teaching-web/tests/runtime/`.

### Lesson 结构与模板

- Modify `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
  - 允许任意数量的 Reflection Block；
  - 不再渲染固定顶层 `## Reflection`。
- Modify `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
  - 删除 `LESSON_REFLECTION_COUNT`；
  - 顶层必需 section 只保留 `Aliases`、`Lesson Summary`、`Traces`。
- Modify `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
  - 删除“恰好一个 Reflection Block”的工具描述。
- Modify `examples/derivative-demo/learning-set/lessons/lesson-003.md`
  - 删除固定顶层 `## Reflection`，保留 Reflection Block 本身。

### Trace 派生投影

- Modify `plugins/highschool-study/server/src/method-signals.ts`
  - 另解只有在其 `sourceTrace` 出现在调用方提供的 active Trace 集合中时才参与方法投影。
- Modify `plugins/highschool-study/tests/integration/method-signals.test.ts`
  - 验证 supersede 后投影刷新；
  - 验证 alternatives sidecar、Lesson Summary、Plan 和画像不被改写。

### Closed Tutor replay

- Modify `apps/pi-teaching-web/src/shared/contracts.ts`
  - `StudentNotebook` 增加只读 `lessonSummary: string | null`。
- Modify `apps/pi-teaching-web/src/study/student-notebook.ts`
  - 只向 closed Lesson 的学生投影顶层 Lesson Summary。
- Modify `apps/pi-teaching-web/src/client/components/LessonNotebook.tsx`
  - closed Lesson 的 active Block 显示“结束时所在节点”；
  - 渲染“结课时记录”。
- Modify `apps/pi-teaching-web/src/client/styles.css`
  - 为关课快照增加最小样式。
- Modify `apps/pi-teaching-web/src/client/state.ts`
  - 删除 active/paused → closed 时自动选择 Coach 的分支。
- Verify `apps/pi-teaching-web/src/client/App.tsx`
  - 现有 closed replay、只读 composer 和“返回 Coach”按钮已满足设计，预期不需要新增状态。
- Modify unit and Playwright tests plus the E2E fixture server.

### Skills 与当前功能文档

- Modify Pi Tutor/Coach Skills、Claude plugin preparation/closure/correction Skills、
  classroom template reference、`AGENTS.md`、两个 README 和中文完整说明书。
- Create one source-linked acceptance report under `docs/audits/`.

---

### Task 1: 把 `lesson_close` 缩成独立的 Lesson 生命周期写入

**Files:**

- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-close.ts`

**Interfaces:**

- Consumes: 当前 Tutor Session 绑定的 `ownerPath` 和模型提供的非空 summary。
- Produces:

```ts
export type LessonCloseInput = {
  summary: string;
};

export function closeLesson(
  root: string,
  lessonPath: string,
  input: LessonCloseInput,
): void;
```

- Keeps:

```json
{
  "ok": true,
  "ownerPath": "lessons/lesson-xxx.md",
  "status": "closed"
}
```

- [ ] **Step 1: 用 Block 状态保持测试替换旧 Reflection 前置测试**

先从现有 `fixture()` 删除固定顶层：

```md
## Reflection

（课堂结束后填写）
```

把 `appends a sourced route change and closes the lesson` 的 close 和断言改成：

```ts
closeLesson(root, path, { summary: '独立完成诊断。' });
const source = readFileSync(join(root, path), 'utf8');
expect(source).toContain('### Route change route-001');
expect(source).toContain('- Source: #trace-event-001');
expect(source).toContain('- Status: active');
expect(source).toContain('status: closed');
expect(source).toContain('独立完成诊断。');
expect(source).not.toContain('## Reflection');
```

再增加一个独立 fixture，使不同 Block 布局都不含顶层 `## Reflection`：

```ts
function closureFixture(
  blocks: string,
  status: 'active' | 'closed' | 'abandoned' = 'active',
): { root: string; path: string } {
  const root = mkdtempSync(join(tmpdir(), 'study-close-'));
  roots.push(root);
  const path = 'lesson.md';
  writeFileSync(join(root, path), `---
id: lesson-close
kind: lesson
status: ${status}
---
# Lesson Close

${blocks}

## Lesson Summary

（课堂结束后填写）
`);
  return { root, path };
}

const closureScenarios = [
  ['active problem', `## Block problem-01

### Node State

- Kind: problem
- Required: true
- Status: active
- Depends on:
- Uses: Q-1`],
  ['completed reflection', `## Block reflection-01

### Node State

- Kind: reflection
- Required: true
- Status: completed
- Depends on:
- Uses:`],
  ['no reflection', `## Block dialogue-01

### Node State

- Kind: dialogue
- Required: true
- Status: active
- Depends on:
- Uses:`],
  ['multiple reflections', `## Block reflection-01

### Node State

- Kind: reflection
- Required: false
- Status: completed
- Depends on:
- Uses:

## Block reflection-02

### Node State

- Kind: reflection
- Required: false
- Status: active
- Depends on: reflection-01
- Uses:`],
] as const;

test.each(closureScenarios)(
  'closes from %s without changing any Block state',
  (_name, blocks) => {
    const { root, path } = closureFixture(blocks);
    const before = readFileSync(join(root, path), 'utf8')
      .match(/^- Status: .*$/gm);

    closeLesson(root, path, {
      summary: '关课时证据仍有空缺；来源见 #trace-event-001。',
    });

    const after = readFileSync(join(root, path), 'utf8');
    expect(after).toContain('status: closed');
    expect(after).toContain('关课时证据仍有空缺');
    expect(after.match(/^- Status: .*$/gm)).toEqual(before);
    expect(after).not.toContain('## Reflection');
  },
);
```

删除旧的 `LESSON_REFLECTION_NOT_ACTIVE` 断言。把缺失 Lesson Summary 的测试调用改成：

```ts
expect(() => closeLesson(root, path, {
  summary: '不会写入。',
})).toThrow('SECTION_NOT_FOUND: Lesson Summary');
```

- [ ] **Step 2: 增加终态幂等拒绝测试**

```ts
test.each(['closed', 'abandoned'] as const)(
  'rejects closing a terminal %s Lesson without changing the file',
  (status) => {
    const { root, path } = closureFixture('', status);
    const absolute = join(root, path);
    const before = readFileSync(absolute, 'utf8');

    expect(() => closeLesson(root, path, {
      summary: '不得覆盖旧快照。',
    })).toThrow(`LESSON_ALREADY_TERMINAL: ${status}`);
    expect(readFileSync(absolute, 'utf8')).toBe(before);
  },
);
```

- [ ] **Step 3: 把 runtime tool 测试改成单参数契约**

在 `study-tools.test.ts` 中删除激活 Reflection 的准备步骤，并使用：

```ts
const result = await close.execute('close-1', {
  summary: '本节课完成；仍缺一次未见题迁移证据。',
}, undefined, undefined, {} as never);
```

把 schema 断言改成：

```ts
const closeProperties = (close.parameters as {
  properties: Record<string, unknown>;
}).properties;
expect(Object.keys(closeProperties)).toEqual(['summary']);
expect(JSON.stringify(close.parameters)).not.toContain('reflection');
expect(JSON.stringify(close.parameters)).not.toContain('lessonPath');
expect(JSON.stringify(close.parameters)).not.toContain('blockId');
```

- [ ] **Step 4: 运行聚焦测试并确认 RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts tests/runtime/study-tools.test.ts
```

Expected: FAIL，因为当前 `closeLesson` 仍要求一个 active Reflection Block，且
`lesson_close` schema 仍包含 `reflection`。

- [ ] **Step 5: 实现最小 close 写入**

在 `write-workspace.ts` 删除 `activeReflectionBlockId`，并把 `closeLesson` 改为：

```ts
export type LessonCloseInput = {
  summary: string;
};

export function closeLesson(
  root: string,
  lessonPath: string,
  input: LessonCloseInput,
): void {
  const document = read(root, lessonPath);
  const status = readMarkdownFile(root, lessonPath).frontmatter.status;
  if (status === 'closed' || status === 'abandoned') {
    throw new Error(`LESSON_ALREADY_TERMINAL: ${status}`);
  }
  let source = replaceSection(document.source, 'Lesson Summary', input.summary);
  source = replaceFrontmatterField(source, lessonPath, 'status', 'closed');
  write(document.absolute, source);
}
```

不要修改现有 replacement callback；它是独立的未提交修复。

在 `lesson-close.ts` 把参数缩成：

```ts
parameters: Type.Object({
  summary: Type.String({
    minLength: 1,
    description: 'Student-safe close-time snapshot grounded in active Trace, direct sources, and the actual stopping point.',
  }),
}),
```

工具描述明确：学生已选择结束；工具只写 summary 和 closed 状态；不读取或完成
Reflection Block。

- [ ] **Step 6: 验证关课契约**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts tests/runtime/study-tools.test.ts
bun run typecheck
```

Expected: PASS；`lesson_close` 只有 `summary`；四类 Block 布局均保持原状态。

- [ ] **Step 7: 只提交本任务新增 hunks**

```bash
git add -p -- \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts
git add \
  apps/pi-teaching-web/src/runtime/lesson-close.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git diff --cached --check
git diff --cached
```

Expected: staged diff 不包含 replacement callback 和
`writes dollar-prefixed math literally in Plan audit sections` 测试。

```bash
git commit -m "fix: decouple lesson closure from reflection"
```

---

### Task 2: 让 Reflection 数量成为模板选择而不是结构校验

**Files:**

- Modify: `apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Modify: `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
- Modify: `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
- Modify: `examples/derivative-demo/learning-set/lessons/lesson-003.md`

**Interfaces:**

- Consumes: existing `LessonBlockBlueprint.kind: 'reflection'`.
- Produces: Blueprint and prepared admission that accept 0, 1, or multiple Reflection Blocks.
- Keeps: every problem Block still binds exactly one authentic alias; required top-level
  sections remain `Aliases`, `Lesson Summary`, and `Traces`.

- [ ] **Step 1: 为 0、1、多个 Reflection 写 Blueprint 与 admission 测试**

在 `lesson-blueprint.test.ts` 增加：

```ts
const reflection = blueprint.blocks.find((block) => block.kind === 'reflection')!;
const reflectionVariants: Array<[string, LessonBlueprint['blocks']]> = [
  ['zero', blueprint.blocks.filter((block) => block.kind !== 'reflection')],
  ['one', blueprint.blocks],
  ['multiple', [
    ...blueprint.blocks,
    {
      ...reflection,
      id: 'reflection-midway',
      required: false,
      dependsOn: ['assessment-01'],
    },
  ]],
];

test.each(reflectionVariants)(
  'accepts %s Reflection Blocks and emits no top-level Reflection section',
  (_name, blocks) => {
    const value = { ...blueprint, blocks };
    expect(() => validateLessonBlueprint(root, context, value)).not.toThrow();
    const source = renderPreparedLesson(context, value);
    expect(source).not.toMatch(/^## Reflection$/m);
    expect(source).toMatch(/^## Lesson Summary$/m);
    expect(() => validatePreparedLessonSource(
      root,
      context.lessonPath,
      source,
    )).not.toThrow();
  },
);
```

从“duplicate Blocks...”测试中删除 `expect(issues).toContain('恰好一个 reflection')`。
保留 duplicate ID、alias authenticity 和 structural heading 断言。

- [ ] **Step 2: 保留真正的 prepared admission 失败边界**

在 `workspace-registry.test.ts` 的 admission 失败表中删除
`LESSON_REFLECTION_COUNT` case。增加成功用例，证明把唯一 Reflection 改为 dialogue
后仍可启动：

```ts
test('starts a prepared Lesson with zero Reflection Blocks', async () => {
  const root = fixture();
  editLesson(root, (source) => source.replace(
    '## Block reflection（必做）\n\n### Node State\n\n- Kind: reflection',
    '## Block reflection（必做）\n\n### Node State\n\n- Kind: dialogue',
  ));
  let factoryCalls = 0;
  const factory: StudySessionFactory = async ({ role, ownerId }) => {
    factoryCalls += 1;
    return {
      sessionId: `${role}-${ownerId}`,
      sessionFile: `/tmp/${role}-${ownerId}.jsonl`,
      messages: [],
      isStreaming: false,
      personaId: () => null,
      setPersona: async () => {},
      ...idleWorkflowMethods(),
      prompt: async () => {},
      abort: async () => {},
      subscribe: () => () => {},
      dispose: () => {},
    };
  };
  const registry = new WorkspaceRegistry(root, factory, async () => null);

  await registry.startLesson('lesson-003');

  expect(factoryCalls).toBe(1);
  expect(registry.snapshot('domain-integrity').lessons[2]?.status).toBe('active');
});
```

- [ ] **Step 3: 运行聚焦测试并确认 RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/lesson-blueprint.test.ts tests/runtime/workspace-registry.test.ts
```

Expected: zero 和 multiple variants 因 Reflection count 校验失败，且渲染结果仍含
顶层 `## Reflection`。

- [ ] **Step 4: 删除全局 Reflection 数量规则**

在 `lesson-blueprint.ts` 删除：

```ts
const reflections = blueprint.blocks.filter((block) => block.kind === 'reflection');
if (reflections.length !== 1) {
  issues.push(`需要恰好一个 reflection，当前为 ${reflections.length}`);
}
```

并从 `renderPreparedLesson` 模板中删除：

```md
## Reflection

（课堂结束后填写）
```

在 `validate-prepared-lesson.ts`：

```ts
export type PreparedLessonIssue = {
  code:
    | 'LESSON_SECTION_MISSING'
    | 'LESSON_ALIAS_MISSING'
    | 'LESSON_ALIAS_INVALID'
    | 'LESSON_PROBLEM_CARD_COUNT';
  message: string;
};
```

顶层 section 循环改为：

```ts
for (const section of ['Aliases', 'Lesson Summary', 'Traces']) {
```

删除 `LESSON_REFLECTION_COUNT` 聚合和抛错逻辑。

在 `lesson-prepare.ts` 把 Block kind 描述改为：

```ts
description: 'Activity kind. A problem produces one independently assessed response; reflection is an optional, repeatable classroom activity selected by the template and Coach.',
```

- [ ] **Step 5: 把公开示例直接迁移到新结构**

从 `examples/derivative-demo/learning-set/lessons/lesson-003.md` 删除固定顶层：

```md
## Reflection

（课堂结束后填写）
```

保留 `## Block reflection（必做）`，因为它仍是本课真实的模板安排。

- [ ] **Step 6: 验证生成、准入和示例**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/lesson-blueprint.test.ts \
  tests/runtime/workspace-registry.test.ts \
  tests/runtime/study-tools.test.ts
bun run typecheck
```

Run:

```bash
rg -n "^## Reflection$|LESSON_REFLECTION_COUNT|exactly one reflection Block" \
  apps/pi-teaching-web/src \
  apps/pi-teaching-web/tests \
  examples/derivative-demo/learning-set/lessons
```

Expected: tests PASS；第二条命令没有命中。

- [ ] **Step 7: 提交**

```bash
git add \
  apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts \
  apps/pi-teaching-web/src/study/lesson-blueprint.ts \
  apps/pi-teaching-web/src/study/validate-prepared-lesson.ts \
  apps/pi-teaching-web/src/runtime/lesson-prepare.ts \
  examples/derivative-demo/learning-set/lessons/lesson-003.md
git diff --cached --check
git commit -m "refactor: make reflection blocks template-owned"
```

---

### Task 3: 只投影 active 来源 Trace 对应的另解

**Files:**

- Modify: `plugins/highschool-study/tests/integration/method-signals.test.ts`
- Modify: `plugins/highschool-study/server/src/method-signals.ts`

**Interfaces:**

- Consumes:

```ts
aggregateMethodSignals(root: string, traces: TraceRecord[]): MethodSignal[];
```

调用方传入的 `traces` 是本次投影的 active evidence 集合。

- Produces: 只有 `alternative.sourceTrace` 存在于该集合中，另解方法才进入对应
attempt 的 `MethodSignal`。
- Keeps: `readCardAlternatives` 继续返回完整历史 sidecar；本任务不删除或改写
alternative 条目。

- [ ] **Step 1: 把旧的“supersede 后仍贡献”测试改成新权威边界**

在 `method-signals.test.ts`：

```ts
import { readFileSync, writeFileSync } from 'node:fs';
import {
  appendCardAlternativeWithProjection,
  appendTraceWithProjection,
} from '../../server/src/planner-attention';
```

用下面的测试替换
`keeps alternative method evidence after its source Trace is superseded`：

```ts
test('keeps a superseded-source alternative in its sidecar but removes its projection', () => {
  const root = makeLearningSetWithLesson();
  const lessonPath = join(root, 'lessons/lesson-001.md');
  writeFileSync(
    lessonPath,
    `${readFileSync(lessonPath, 'utf8').trimEnd()}\n\n## Lesson Summary\n\n关课快照不变。\n`,
  );
  const planPath = join(root, 'plans/max-value.md');
  writeFileSync(planPath, `---
id: max-value
kind: plan
status: active
---
# Plan：最值

## Current Position

Coach 上次确认的位置。

## Next Lesson Candidate

保持原候选。

## Plan Summary

Coach 上次确认的决定。
`);
  const input = {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-FREEZE-01',
    cardStepId: null,
    materialPath: null,
    assessment: 'correct' as const,
    support: 'none' as const,
    note: 'Completed an alternative route.',
    supersedes: null,
    methods: null,
  };
  appendTraceWithProjection(root, input, () => new Date('2026-07-21T02:00:00Z'));
  appendCardAlternativeWithProjection(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '参数化与消元的完整路线。',
    method: '参数化与消元',
    support: 'none',
  }, () => new Date('2026-07-21T02:01:00Z'));

  const sidecarPath = join(root, 'cards/conics/freeze-variable-01.alternatives.md');
  const studentPath = join(root, 'memory/student-profile.md');
  const teachingPath = join(root, 'memory/teaching-profile.md');
  const sidecarBefore = readFileSync(sidecarPath);
  const planBefore = readFileSync(planPath);
  const studentBefore = readFileSync(studentPath);
  const teachingBefore = readFileSync(teachingPath);
  expect(readFileSync(join(root, 'memory/planner-attention.md'), 'utf8'))
    .toContain('参数化与消元');

  appendTraceWithProjection(root, {
    ...input,
    note: 'Corrected the same attempt and withdrew the recorded route.',
    supersedes: 'event-001',
  }, () => new Date('2026-07-21T02:02:00Z'));

  const lesson = readFileSync(lessonPath, 'utf8');
  expect(aggregateMethodSignals(root, readActiveTraces(root))).toEqual([]);
  expect(readFileSync(join(root, 'memory/planner-attention.md'), 'utf8'))
    .not.toContain('参数化与消元');
  expect(readFileSync(sidecarPath)).toEqual(sidecarBefore);
  expect(readFileSync(planPath)).toEqual(planBefore);
  expect(readFileSync(studentPath)).toEqual(studentBefore);
  expect(readFileSync(teachingPath)).toEqual(teachingBefore);
  expect(lesson).toContain('## Lesson Summary\n\n关课快照不变。');
});
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
cd plugins/highschool-study
bun test tests/integration/method-signals.test.ts
```

Expected: FAIL，因为当前 `method-signals.ts` 会重新读取全部 Trace，并继续找到已经
superseded 的 alternative source。

- [ ] **Step 3: 只用调用方提供的 active Trace 解析另解来源**

在 `method-signals.ts` 删除 `readTraceRecords` import，并把重新读取全部 Trace 的
部分改为：

```ts
const tracesBySource = new Map(
  traces.map((trace) => [trace.sourceAnchor, trace]),
);
const cardPaths = [...new Set(traces.flatMap((trace) =>
  trace.cardPath === null ? [] : [trace.cardPath]))];
```

保留现有过滤：

```ts
const source = tracesBySource.get(alternative.sourceTrace);
if (source === undefined || source.cardPath !== alternative.cardPath) continue;
```

不要编辑 `alternatives.ts`，也不要删除 sidecar 中的历史条目。

- [ ] **Step 4: 验证投影与无级联边界**

Run:

```bash
cd plugins/highschool-study
bun test tests/integration/method-signals.test.ts \
  tests/integration/card-alternatives.test.ts \
  tests/e2e/markdown-learning-loop.test.ts
bun run typecheck
```

Expected: PASS；Planner Attention 会刷新，sidecar、Plan、Lesson Summary 和两份画像
保持原值。

- [ ] **Step 5: 提交**

```bash
git add \
  plugins/highschool-study/server/src/method-signals.ts \
  plugins/highschool-study/tests/integration/method-signals.test.ts
git diff --cached --check
git commit -m "fix: project alternatives from active trace sources"
```

---

### Task 4: 把 Lesson Summary 加入 closed Student Notebook

**Files:**

- Modify: `apps/pi-teaching-web/tests/study/student-notebook.test.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/student-notebook.ts`
- Modify: `apps/pi-teaching-web/src/client/components/LessonNotebook.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`

**Interfaces:**

- Produces:

```ts
export type StudentNotebook = {
  lesson: Omit<LessonNode, 'blocks'> & { blocks: ActivityBlock[] };
  cards: Record<string, StudentProblemCard>;
  lessonSummary: string | null;
  authoring?: { source: string };
};
```

- `lessonSummary` 只在 Lesson status 为 `closed` 且顶层 section 非空时返回。
- `abandoned`、`prepared`、`active`、`paused` 返回 `null`。

- [ ] **Step 1: 写学生安全摘要投影测试**

在 `student-notebook.test.ts` 增加：

```ts
test('projects the close-time Lesson Summary only for a closed Lesson', () => {
  const root = fixture();
  const path = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace(
      '（课堂结束后填写）',
      '完成一题；另一题尚未进行。来源：#trace-event-001。',
    ),
  );

  expect(readStudentNotebook(root, 'lesson-003', false).lessonSummary).toBeNull();

  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'closed');
  expect(readStudentNotebook(root, 'lesson-003', false).lessonSummary)
    .toBe('完成一题；另一题尚未进行。来源：#trace-event-001。');
});
```

确保替换目标是 `## Lesson Summary` 下的 placeholder；若示例中存在同文占位符，
使用 section-aware regex：

```ts
source.replace(
  /(^## Lesson Summary\s*$\n)([\s\S]*?)(?=^## |$(?![\s\S]))/m,
  '$1\n完成一题；另一题尚未进行。来源：#trace-event-001。\n\n',
)
```

- [ ] **Step 2: 运行测试并确认 RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/student-notebook.test.ts
```

Expected: FAIL，因为 `StudentNotebook` 尚无 `lessonSummary`。

- [ ] **Step 3: 实现只读 Lesson Summary 投影**

在 `student-notebook.ts` 增加：

```ts
function topLevelSection(source: string, heading: string): string {
  return new RegExp(
    `^## ${heading}\\s*$\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`,
    'm',
  ).exec(source)?.[1]?.trim() ?? '';
}
```

在返回值中加入：

```ts
lessonSummary: lesson.status === 'closed'
  ? topLevelSection(source, 'Lesson Summary') || null
  : null,
```

同时在 `shared/contracts.ts` 增加必需的 `lessonSummary: string | null`。

- [ ] **Step 4: 渲染关课快照和真实关闭位置**

在 `LessonNotebook.tsx` 增加：

```ts
function blockStatusLabel(
  lessonStatus: LessonNode['status'],
  blockStatus: keyof typeof statusLabel,
): string {
  return lessonStatus === 'closed' && blockStatus === 'active'
    ? '结束时所在节点'
    : statusLabel[blockStatus];
}
```

替换 Block 标签：

```tsx
<small>{blockStatusLabel(notebook.lesson.status, block.status)}</small>
```

在 activity list 后、cards 前加入：

```tsx
{notebook.lessonSummary && (
  <section className="lesson-close-summary">
    <span>结课时记录</span>
    <MarkdownView>{notebook.lessonSummary}</MarkdownView>
  </section>
)}
```

在 `styles.css` 的 notebook styles 附近加入：

```css
.lesson-close-summary {
  margin: 1.8rem .35rem 0;
  padding: 1.2rem 0;
  border-top: 1px solid var(--ink);
  border-bottom: 1px solid var(--rule);
  color: var(--ink-soft);
  font-family: var(--font-reading);
  font-size: .78rem;
  line-height: 1.75;
}
.lesson-close-summary > span {
  color: var(--accent);
  font-family: var(--font-ui);
  font-size: .62rem;
  font-weight: 750;
  letter-spacing: .13em;
}
.lesson-close-summary > :last-child { margin-bottom: 0; }
```

- [ ] **Step 5: 验证数据契约和构建**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/student-notebook.test.ts
bun run typecheck
bun run build
```

Expected: PASS；active Lesson 不暴露 placeholder；closed Lesson 投影并渲染 summary。

- [ ] **Step 6: 提交**

```bash
git add \
  apps/pi-teaching-web/tests/study/student-notebook.test.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/study/student-notebook.ts \
  apps/pi-teaching-web/src/client/components/LessonNotebook.tsx \
  apps/pi-teaching-web/src/client/styles.css
git diff --cached --check
git commit -m "feat: show close-time lesson summary in replay"
```

---

### Task 5: 关闭后留在 Tutor replay，直到学生返回 Coach

**Files:**

- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Verify: `apps/pi-teaching-web/src/client/App.tsx`

**Interfaces:**

- Consumes: `StudyViewEvent` snapshot whose selected Tutor Lesson changes from
  `active` or `paused` to `closed`.
- Produces: the same `tutor:<lessonId>` selection and browser Lesson route.
- Student explicitly invokes the existing “返回 Coach” button to select the Plan Coach Session.

- [ ] **Step 1: 反转自动返回 Coach 的 reducer 测试**

把 `state.test.ts` 的旧测试替换为：

```ts
test('keeps Tutor replay selected when the current Lesson closes', () => {
  const state = reduceClientState({
    ...initialClientState,
    workspace: workspaceWithLesson('active'),
    selected: 'tutor:l1',
  }, { type: 'snapshot', workspace: workspaceWithLesson('closed') });

  expect(state.selected).toBe('tutor:l1');
});
```

保留“已经 closed 时下一份 snapshot 仍保留”的测试。

- [ ] **Step 2: 运行 reducer 测试并确认 RED**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/state.test.ts
```

Expected: FAIL，当前 reducer 会把 selection 改成 `coach:p1`。

- [ ] **Step 3: 删除 snapshot reducer 的自动切换分支**

把 `state.ts` 的 snapshot 分支缩成：

```ts
if (event.type === 'snapshot') {
  return {
    ...state,
    workspace: event.workspace,
    selected: state.selected,
  };
}
```

不要新增 closed-route 状态。`App.tsx` 现有逻辑已经满足：

- closed/abandoned 时 `view === 'replay'`；
- composer 不渲染；
- final Session messages 仍在原 `SessionKey` 下；
- “返回 Coach”通过 `selectSession` 显式导航。

- [ ] **Step 4: 给 E2E fixture 增加可复原的 close 事件**

在 `fixture-server.ts`：

```ts
import { cpSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import {
  closeLesson,
  registerPlan,
  setBlockStatus,
  setFrontmatterField,
  updatePlan,
} from '../../src/study/write-workspace';
```

复制 learning set 后保存：

```ts
const lesson003Path = join(root, 'lessons/lesson-003.md');
const lesson003Baseline = readFileSync(lesson003Path, 'utf8');
```

在 test endpoints 中加入：

```ts
if (request.method === 'POST' && url.pathname === '/__test/close-lesson') {
  closeLesson(root, 'lessons/lesson-003.md', {
    summary: '完成第一项核验；第二项尚未进行。来源：#trace-event-001。',
  });
  hub.publish({
    type: 'message',
    sessionKey: 'tutor:lesson-003',
    message: {
      id: 'fixture-close-message',
      role: 'tutor',
      text: '这节课先停在这里。第一项已完成，第二项留到下次。',
      complete: true,
    },
  });
  hub.publish({
    type: 'snapshot',
    workspace: readPlanWorkspace(root, 'domain-integrity'),
  });
  return Response.json({ ok: true });
}
if (request.method === 'POST' && url.pathname === '/__test/reset-close-lesson') {
  writeFileSync(lesson003Path, lesson003Baseline);
  return Response.json({ ok: true });
}
```

- [ ] **Step 5: 添加 Playwright closed replay 验收**

在 `workspace.spec.ts` 增加：

```ts
test('keeps the closed Tutor replay until the student returns to Coach', async ({ page }) => {
  try {
    await page.goto('/plan/domain-integrity/lesson/lesson-003');
    const start = page.getByRole('button', { name: /开始上课|继续上课/ });
    if (await start.count()) await start.click();
    await page.request.post('http://127.0.0.1:65000/__test/close-lesson');

    await expect(page).toHaveURL(/\/plan\/domain-integrity\/lesson\/lesson-003$/);
    await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'replay');
    await expect(page.getByText('这节课先停在这里。')).toBeVisible();
    await expect(page.getByText('完成第一项核验；第二项尚未进行。')).toBeVisible();
    await expect(page.getByText('结束时所在节点')).toBeVisible();
    await expect(page.locator('form.composer')).toHaveCount(0);

    await page.getByRole('button', { name: /返回 Coach/ }).click();
    await expect(page).toHaveURL(/\/plan\/domain-integrity$/);
    await expect(page.locator('.app-root')).toHaveAttribute('data-view', 'coach');
  } finally {
    await page.request.post('http://127.0.0.1:65000/__test/reset-close-lesson');
  }
});
```

- [ ] **Step 6: 验证 reducer、路由和 replay**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/state.test.ts tests/study/student-notebook.test.ts
bun run test:e2e
```

Expected: PASS；关闭 snapshot 不改变 URL 或 selection；只有点击按钮才回 Coach。

- [ ] **Step 7: 提交**

```bash
git add \
  apps/pi-teaching-web/tests/client/state.test.ts \
  apps/pi-teaching-web/src/client/state.ts \
  apps/pi-teaching-web/tests/e2e/fixture-server.ts \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts
git diff --cached --check
git commit -m "fix: keep closed lessons in tutor replay"
```

---

### Task 6: 对齐 Tutor、Coach、模板和当前功能文档

**Files:**

- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/references/classroom-templates.md`
- Modify: `plugins/highschool-study/skills/close-lesson-reflection/SKILL.md`
- Modify: `plugins/highschool-study/skills/correct-learning-record/SKILL.md`
- Modify: `AGENTS.md`
- Modify: `plugins/highschool-study/README.md`
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `docs/zh-CN/完整说明书.md`

**Interfaces:**

- Tutor owns current Lesson facts and calls `lesson_close(summary)` once.
- Coach owns Plan decisions and calls `plan_update` only during normal review.
- Skills describe teaching semantics; tool schema describes exact parameters.
- No executable interface is added in this task.

- [ ] **Step 1: 精简 Tutor 的关课顺序**

把 Tutor Skill 的 `Transition and closure` 改成以下语义，不复制 Runtime 错误分支：

```markdown
Settle accepted corrections and facts that must precede the close-time snapshot. When the student chooses to end during any active Tutor turn, stop new teaching and new reflection questions. Build one student-safe Lesson Summary from active Trace, direct sources, completed work, evidence gaps, and the actual stopping point. Call `lesson_close` once with that summary; it does not complete or skip any Block. Only claim formal closure after the receipt has `ok: true`, the current `ownerPath`, and `status: closed`. Give a natural final recap in the same Tutor Session; the student returns to Coach explicitly after reading it.
```

保留“首次准确写 Trace”“异议先 supersede”“新的独立 attempt 不覆盖旧证据”的现有
语义。

- [ ] **Step 2: 明确 Coach 的证据权威和 Plan 决策权**

在 Coach Skill 的 evidence/review 段落表达：

```markdown
Treat Lesson Summary as a close-time snapshot and retrieval entry, not the latest evidence. Use active Trace for claims about the student's attempts. New evidence may show that the current Plan needs review, but only a normal Coach review followed by `plan_update` changes Plan status, Current Position, Next Lesson Candidate, or Plan Summary.
```

- [ ] **Step 3: 修改 Claude plugin 的备课、关课和更正 Skills**

`prepare-next-lesson/SKILL.md` 第 8 步改为：

```markdown
Write the next indexed Lesson as `prepared` with top-level `## Aliases`, `## Lesson Summary`, and `## Traces`. Add zero, one, or multiple reflection Blocks according to the chosen template and recorded adjustments; never add a fixed top-level `## Reflection`. Every used alias resolves to a real problem card. Reread the file before reporting it prepared.
```

`close-lesson-reflection/SKILL.md` 的 close 分支改为：

```markdown
On close, preserve every Block's real state and write one source-linked Lesson Summary that records completed work, active evidence, gaps, student intent, and the stopping point. Reflection Blocks remain ordinary classroom activities; closure neither requires nor completes one.
```

`correct-learning-record/SKILL.md` 第 3 步改为：

```markdown
Re-query active evidence after the superseding Trace. Planner Attention and other derived evidence projections may rebuild. Report which Lesson Summary, Plan decision, alternative sidecar, or confirmed profile may now be stale, but do not rewrite any of them in this correction flow.
```

- [ ] **Step 4: 把六种模板的 Reflection 默认值写入参考表**

在每个 template 下增加：

```markdown
- Reflection default:
  - `diagnostic`: 0; add one only when student self-report changes the diagnosis.
  - `concept`: 1 adjustable closing reflection; remove it when the exit quiz already closes the loop.
  - `deliberate-practice`: no shared closing reflection; optional local reflections may follow key practice groups.
  - `remediation`: 1 after the unseen retest by default.
  - `assessment`: 0, so independent responses gain no extra teaching requirement.
  - `review`: 1 method-comparison or summary reflection by default.
```

实际文件中把对应一行放到各自 template 小节，不创建全局 quota。

- [ ] **Step 5: 更新当前架构和用户文档**

在 `AGENTS.md` 与中文说明书统一以下事实：

```text
Prepared admission:
  required top-level = Aliases + Lesson Summary + Traces
  reflection Block count = 0..n

lesson_close(summary):
  writes Lesson Summary + status: closed
  preserves every Block state

Evidence authority:
  active Trace drives evidence claims and derived projections
  Coach + plan_update owns Plan decisions

Correction:
  derived projections may rebuild
  Lesson Summary / Plan / alternatives sidecar / confirmed memory do not auto-rewrite

Closed experience:
  stay in the Tutor replay
  student explicitly returns to Coach
```

同时修正中文说明书和 `plugins/highschool-study/README.md` 中“来源 Trace 被
supersede 后另解仍参与能力投影”的旧说法：

```text
另解条目仍保留在 sidecar 供审计和检索；只有来源 Trace 仍 active 时，它的方法
才进入当前能力投影。
```

`apps/pi-teaching-web/README.md` 补充 closed replay 与单一 Lesson Summary。

- [ ] **Step 6: 做语义一致性扫描**

Run:

```bash
rg -ni "exactly one reflection|恰好一个.*reflection|^## Reflection$|LESSON_REFLECTION_COUNT|lesson_close.*completes the active reflection|lesson_close.*reflection and summary|lesson_close.*Reflection、Lesson Summary|写 Reflection 与 Lesson Summary|自动.*返回.*Coach|重建受影响的摘要|supersede 后另解仍.*投影" \
  AGENTS.md \
  apps/pi-teaching-web/src \
  apps/pi-teaching-web/resources \
  apps/pi-teaching-web/README.md \
  plugins/highschool-study/skills \
  plugins/highschool-study/README.md \
  examples/derivative-demo/learning-set \
  docs/zh-CN/完整说明书.md
```

Expected: 没有旧契约命中。文件名 `close-lesson-reflection` 和对历史设计的说明不计入
扫描失败；当前运行说明不得继续要求固定 Reflection。

Run:

```bash
git diff --check
```

Expected: PASS。

- [ ] **Step 7: 提交**

```bash
git add \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/references/classroom-templates.md \
  plugins/highschool-study/skills/close-lesson-reflection/SKILL.md \
  plugins/highschool-study/skills/correct-learning-record/SKILL.md \
  AGENTS.md \
  plugins/highschool-study/README.md \
  apps/pi-teaching-web/README.md \
  docs/zh-CN/完整说明书.md
git diff --cached --check
git commit -m "docs: align reflection and lesson closure semantics"
```

---

### Task 7: 完整回归与真实模型闭环验收

**Files:**

- Create: `docs/audits/2026-07-25-lesson-close-reflection-decoupling-acceptance.md`
- Verify: all implementation files from Tasks 1–6.

**Interfaces:**

- Consumes: clean committed implementation plus a copied derivative learning set.
- Produces: source-linked PASS/FAIL audit without credentials or full private transcripts.
- Execution requirement: load `studyclaw-e2e-validation` before starting the real-model run.

- [ ] **Step 1: 运行两个包的完整发布检查**

Run:

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check
```

Expected: exit 0；public MCP tool count remains four；strict plugin validation passes。

Run:

```bash
cd ../../apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e
```

Expected: all type checks, unit tests, production build, and Playwright tests pass。

- [ ] **Step 2: 建立不会污染示例的验收副本**

从仓库根目录运行：

```bash
ACCEPT_ROOT="$(mktemp -d /tmp/studyforge-reflection-decouple-XXXXXX)"
cp -R examples/derivative-demo/learning-set "$ACCEPT_ROOT/learning-set"
```

记录 `ACCEPT_ROOT`，但审计报告只记录去标识化的临时根和 Session ID，不提交
JSONL。

- [ ] **Step 3: 启动复制学习集上的 Pi runtime**

使用本机已经配置好的 Provider，不在命令行写 API key：

```bash
cd apps/pi-teaching-web
bun run start -- \
  --learning-set "$ACCEPT_ROOT/learning-set" \
  --port 65020
```

Expected: `/api/health` 返回 `{ ok: true, runtime: "pi" }`，页面能打开 Coach 和
Tutor Session。

- [ ] **Step 4: 覆盖四种结构性关课路径**

在副本中由 Coach 准备并运行四个独立 Lesson：

1. 一个 Reflection Block，学生在回答 Reflection 的同一轮要求结束；
2. 一个已经 completed 的 Reflection Block，学生下一轮才要求结束；
3. 零个 Reflection Block，学生在 active problem Block 中提前结束；
4. 两个局部 Reflection Block，学生在第一个之后、第二个之前结束。

每个 case 都核对：

```text
- lesson_close 只调用一次；
- 参数只有 summary；
- receipt ownerPath 与当前 Tutor Session owner 匹配；
- Lesson status = closed；
- 关闭前后的所有 Block Status 完全一致；
- 文件只有一个顶层 Lesson Summary，没有顶层 Reflection；
- Lesson Summary 含必要来源和停止位置，不含 Teacher Control、隐藏 rubric、未公开
  答案或 Planner 内部判断；
- 页面留在原 Tutor replay，显示最终消息与“结课时记录”；
- composer 只读，点击“返回 Coach”后才切换。
```

- [ ] **Step 5: 覆盖纠错与独立 attempt 的证据边界**

再运行两个 case：

1. 学生对同一次 attempt 的 assessment 或方法节点提出异议，Tutor 接受后先写
   superseding Trace，再生成 summary 并关闭；
2. 学生后来在新的 problem Block 重新做同卡且表现不同，Tutor 写新的 active
   Trace，不 supersede 先前独立 attempt。

核对：

```text
- 普通 Trace 搜索只返回 active Trace；
- 第一种 case 的旧 Trace 保留但不进入 Planner Attention；
- 来源旧 Trace 的 alternative sidecar 仍在，但不进入能力投影；
- 第二种 case 的两次独立 attempt 都保持 active，并投影为不稳定；
- Lesson Summary 保留关课时快照；
- Plan 在 Coach 调用 plan_update 前不自动变化；
- student-profile.md 与 teaching-profile.md 不自动变化。
```

- [ ] **Step 6: 写验收报告**

`docs/audits/2026-07-25-lesson-close-reflection-decoupling-acceptance.md` 必须包含：

```markdown
# Lesson Close / Reflection Decoupling 验收报告

## 结论

PASS 或 FAIL，以及任何未通过 case。

## 运行身份

- Git commit
- Pi version
- Provider / model name（不含 key）
- copied learning-set root

## 自动验证

| Command | Result |
| --- | --- |
| plugin release:check | PASS/FAIL |
| Pi check | PASS/FAIL |
| Playwright E2E | PASS/FAIL |

## 真实路径

逐项列出六个 case 的 Lesson ID、Tutor Session ID、lesson_close 次数、最终
Block 状态、Trace/summary/Plan 证据链接和结论。只摘录必要事实，不复制完整对话。

## 残余问题

只记录真实发生且能复现的问题；偶发 Provider 延迟与教学设计偏好分开描述。
```

- [ ] **Step 7: 做最终禁区与工作树检查**

Run:

```bash
rg -n "sk-[A-Za-z0-9]|api[_-]?key|Authorization: Bearer" \
  docs/audits/2026-07-25-lesson-close-reflection-decoupling-acceptance.md
```

Expected: no matches。

Run:

```bash
git diff --check
git status --short
```

Expected: 只有验收报告以及最初两处明确保留的 user-owned dirty hunks；没有 Session
JSONL、凭据或验收 learning set。

- [ ] **Step 8: 提交验收报告**

```bash
git add docs/audits/2026-07-25-lesson-close-reflection-decoupling-acceptance.md
git diff --cached --check
git commit -m "docs: record lesson closure acceptance"
```

---

## Final Completion Gate

只有同时满足以下条件才宣告实现完成：

- `lesson_close` schema 只有 `summary`，并保持 Session-bound owner receipt；
- active problem、completed Reflection、无 Reflection、多个 Reflection 均能一次关闭；
- 关闭只改变 Lesson Summary 和 Lesson status；
- Blueprint、prepared admission 和示例都没有固定顶层 `## Reflection`；
- Reflection Block 数量为 0..n，六种模板只给可调整默认值；
- closed snapshot 保留当前 Tutor Session、URL、消息、总结和真实 Block 状态；
- 学生显式点击后才返回 Coach；
- superseded-source alternative 仍保留在 sidecar，但不进入当前能力投影；
- active Trace 更正会刷新派生投影，不改写 Summary、Plan、sidecar 或长期记忆；
- Plan 只在 Coach 调用 `plan_update` 后改变；
- Plugin release check、Pi check、Playwright 和六条真实路径全部通过；
- public MCP tool count 仍为四；
- 没有新增工具、Agent、持久化字段、规则引擎或兼容层；
- 原有两处 user-owned dirty hunks未被改写或误提交。
