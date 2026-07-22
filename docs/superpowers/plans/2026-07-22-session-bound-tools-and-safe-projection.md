# Session-bound Tools and Safe Projection Implementation Plan

> **Execution status:** 已并入 `2026-07-22-teaching-runtime-closure-master-plan.md`。保留本文件作为 Session 工具与安全投影的细化来源；不要再把它作为独立计划执行。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 同一次改造中落地 Session-bound Tutor tools、Coach `plan_update` 与 `safe | raw-stream` 消息投影，使模型只填写教学判断，运行时绑定文件所有权，学生界面默认不显示混合工具回合文本。

**Architecture:** `WorkspaceRegistry` 从真实 Plan/Lesson 对象取得规范相对路径并注入 `StudySessionScope.ownerPath`。Tutor 与 Coach 的窄工具闭包绑定该路径；Lesson/Plan 的多区块更新都先在内存完成，再单次写文件。实时事件与 Session 历史共同调用一个消息分类器，默认 `safe`，只有显式配置 `raw-stream` 才恢复逐 token 文本投影。

**Tech Stack:** TypeScript 7、Bun 1.3.14、TypeBox 1.3.6、`@earendil-works/pi-*` 0.81.0、React 19、Markdown learning set、Bun Test、Playwright。

## Global Constraints

- 设计依据：`docs/superpowers/specs/2026-07-22-session-bound-tutor-tools-design.md` 以及已经确认的 `plan_update`、`messageProjection` 口头设计。
- 不新增 Agent、裁判流程、提示确认门、课堂状态机或旧参数兼容层。
- `ownerPath` 只能来自 `readPlanWorkspace` 的真实 `plan.path` / `lesson.path`，模型不能覆盖。
- Tutor 新调用不再填写 `lessonPath` 或 `cardStepId`；底层尚需该 nullable 字段时固定传 `null`。
- `classroom_update` 只保留 Block、Route 与 pause；结课只使用 `lesson_close`。
- Coach 保留 `write` / `edit` 用于备课文件，但最终 Plan 审计只能使用 `plan_update`，随后用 `read` 重读。
- `plan_update` 参数只含 `decision`、`lessonIndex`、`currentPosition`、`nextLessonCandidate`、`planSummary`；不含 `planPath`。
- `complete` 映射为 Plan frontmatter `status: completed`；`active` 与 `replan` 映射为 `status: active`。
- `messageProjection` 默认 `safe`；可通过 `--message-projection raw-stream` 或 `STUDYFORGE_MESSAGE_PROJECTION=raw-stream` 显式切换。
- `safe` 模式不修改 Pi Session、模型输出或工具调用，只改变学生前端的实时与历史投影；原始 JSONL 永久保留。
- `safe` 与 `raw-stream` 必须共用同一个最终消息分类器，实时显示和刷新后的历史不得出现分叉。
- 不修改一题多解、实际方法证据、BKT、attempt 聚合或历史 Trace schema。
- 不纳入工作区已有的 `examples/derivative-demo/learning-set/plans/domain-integrity.md`、`.superpowers/` 或其他未提交文件。

---

## File Map

### 新建

- `apps/pi-teaching-web/src/runtime/session-scope.ts`：定义 Session role、真实 owner ID/path 与资源上下文格式。
- `apps/pi-teaching-web/src/runtime/lesson-close.ts`：定义 Tutor-only `lesson_close` 工具。
- `apps/pi-teaching-web/src/runtime/plan-update.ts`：定义 Coach-only `plan_update` 工具。
- `apps/pi-teaching-web/src/projection/message-policy.ts`：定义投影模式解析、assistant 内容分类和历史消息投影。
- `apps/pi-teaching-web/tests/runtime/session-scope.test.ts`：验证 Coach/Tutor owner context 的准确路径。
- `apps/pi-teaching-web/tests/projection/message-policy.test.ts`：验证配置解析和实时/历史共用的可见文本规则。
- `docs/audits/2026-07-22-session-bound-tools-safe-projection-acceptance.md`：真实模型验收记录，只在验收任务中创建。

### 修改

- `apps/pi-teaching-web/src/runtime/workspace-registry.ts`：把真实 Plan/Lesson path 传入 factory；历史使用统一消息分类器。
- `apps/pi-teaching-web/src/runtime/session-factory.ts`：消费完整 scope，按角色注册 `lesson_close` / `plan_update` 并调整活动工具列表。
- `apps/pi-teaching-web/src/runtime/resource-loader.ts`：注入准确的 Current Plan/Lesson file。
- `apps/pi-teaching-web/src/runtime/study-tools.ts`：Trace 使用 `ownerPath`，删除 Tutor-facing `cardStepId`。
- `apps/pi-teaching-web/src/runtime/classroom-update.ts`：闭包绑定 `ownerPath`，移除 path、close、reflection、summary。
- `apps/pi-teaching-web/src/study/write-workspace.ts`：提供纯字符串变换、原子 Lesson close 与原子 Plan update。
- `apps/pi-teaching-web/src/projection/projector.ts`：按 mode 投影实时事件，并增加两个新工具的安全状态标签。
- `apps/pi-teaching-web/src/server/index.ts`：读取投影模式配置，默认 `safe`。
- `apps/pi-teaching-web/src/server/app.ts`：向实时投影、历史和 replay 传同一 mode。
- `apps/pi-teaching-web/README.md`：记录默认 safe、诊断用 raw-stream 与两种启动配置方法。
- `apps/pi-teaching-web/resources/agents/tutor.md`：使用准确 Lesson path、新 Trace 契约和 `lesson_close`。
- `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`：同步 Tutor 调用顺序。
- `apps/pi-teaching-web/resources/agents/coach.md`：最终审计使用 `plan_update`，不展示临时矩阵。
- `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`：同步 Plan update → reread → reply 顺序。
- `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`：验证真实 owner path 与安全历史。
- `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`：验证收窄后的 Tutor 工具。
- `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`：验证角色工具边界和 Agent/Skill 文本。
- `apps/pi-teaching-web/tests/study/write-workspace.test.ts`：验证 Lesson/Plan 单次完整写入和失败不落盘。
- `apps/pi-teaching-web/tests/projection/projector.test.ts`：验证 safe buffer、mixed tool message 隐藏和 raw stream。
- `apps/pi-teaching-web/tests/server/workspace-api.test.ts`：验证 history/replay 与实时投影使用同一 mode。

---

### Task 1: 建立统一的 Session owner scope

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Create: `apps/pi-teaching-web/tests/runtime/session-scope.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`

**Interfaces:**
- Produces: `SessionRole`, `StudySessionScope`, `formatSessionOwnerContext(root, scope)`。
- Produces: `SessionFactoryInput = StudySessionScope & { sessionFile: string | null }`。
- Consumed later by: Tutor tools、Coach `plan_update`、resource loader。

- [ ] **Step 1: 写 owner context 与 registry 路径绑定的失败测试**

在 `tests/runtime/session-scope.test.ts` 写：

```ts
import { expect, test } from 'bun:test';
import { formatSessionOwnerContext } from '../../src/runtime/session-scope';

test('formats the canonical owner file for each role', () => {
  expect(formatSessionOwnerContext('/set', {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/unit-a/custom-name.md',
  })).toContain('Current Lesson file: lessons/unit-a/custom-name.md');

  expect(formatSessionOwnerContext('/set', {
    role: 'coach',
    ownerId: 'domain-integrity',
    ownerPath: 'plans/domain-integrity.md',
  })).toContain('Current Plan file: plans/domain-integrity.md');
});
```

在 `tests/runtime/workspace-registry.test.ts` 的首个测试中让 factory 保存完整输入，并断言：

```ts
function moveLessonToNestedPath(root: string): void {
  const flat = join(root, 'lessons/lesson-003.md');
  const nestedDirectory = join(root, 'lessons/unit-a');
  const nested = join(nestedDirectory, 'custom-name.md');
  mkdirSync(nestedDirectory, { recursive: true });
  writeFileSync(
    nested,
    readFileSync(flat, 'utf8').replaceAll('../cards/', '../../cards/'),
  );
  rmSync(flat);

  const planPath = join(root, 'plans/domain-integrity.md');
  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace(
      '../lessons/lesson-003.md',
      '../lessons/unit-a/custom-name.md',
    ),
  );
}

const root = fixture();
moveLessonToNestedPath(root);
const registry = new WorkspaceRegistry(root, factory, async () => null);
await registry.openCoach('domain-integrity');
await registry.startLesson('lesson-003');

expect(created.map(({ role, ownerId, ownerPath }) => ({ role, ownerId, ownerPath })))
  .toEqual([
    {
      role: 'coach',
      ownerId: 'domain-integrity',
      ownerPath: 'plans/domain-integrity.md',
    },
    {
      role: 'tutor',
      ownerId: 'lesson-003',
      ownerPath: 'lessons/unit-a/custom-name.md',
    },
  ]);
```

补充 `mkdirSync` 与 `writeFileSync` import；不要修改共享示例目录，所有移动只发生在 `fixture()` 的临时副本。

- [ ] **Step 2: 运行定向测试并确认因接口缺失而失败**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-scope.test.ts tests/runtime/workspace-registry.test.ts
```

Expected: FAIL，错误包含缺少 `session-scope` 模块或 `ownerPath`。

- [ ] **Step 3: 实现 scope 类型与资源上下文**

创建 `src/runtime/session-scope.ts`：

```ts
export type SessionRole = 'coach' | 'tutor';

export type StudySessionScope = {
  role: SessionRole;
  ownerId: string;
  ownerPath: string;
};

export function formatSessionOwnerContext(
  root: string,
  scope: StudySessionScope,
): string {
  const owner = scope.role === 'coach'
    ? `Current Coach: ${scope.ownerId}\nCurrent Plan file: ${scope.ownerPath}`
    : `Current Tutor: ${scope.ownerId}\nCurrent Lesson file: ${scope.ownerPath}`;
  return `${owner}\nLearning set: ${root}`;
}
```

在 `resource-loader.ts` 删除本地 `SessionRole`，改为接收完整 scope：

```diff
+ import {
+   formatSessionOwnerContext,
+   type StudySessionScope,
+ } from './session-scope';

- export type SessionRole = 'coach' | 'tutor';

  export async function createRoleResourceLoader(
    root: string,
-   role: SessionRole,
-   ownerId: string,
+   scope: StudySessionScope,
    eventBus: EventBus,
  ) {
+   const { role } = scope;
    const skillName = role === 'coach' ? 'coach-study' : 'tutor-lesson';

        {
          path: `/virtual/studyforge-${role}.md`,
-         content: `${roleContext}\n\nCurrent ${role}: ${ownerId}\nLearning set: ${root}`,
+         content: `${roleContext}\n\n${formatSessionOwnerContext(root, scope)}`,
        },
```

skill path、persona resource、event bus 和 `loader.reload()` 不改变。

在 `session-factory.ts` 固定接口：

```diff
- import { createRoleResourceLoader, type SessionRole } from './resource-loader';
+ import { createRoleResourceLoader } from './resource-loader';
+ import type { SessionRole, StudySessionScope } from './session-scope';

- export type SessionFactoryInput = {
-   role: SessionRole;
-   ownerId: string;
-   sessionFile: string | null;
- };
+ export type SessionFactoryInput = StudySessionScope & {
+   sessionFile: string | null;
+ };

- return async ({ role, ownerId, sessionFile }) => {
+ return async ({ role, ownerId, ownerPath, sessionFile }) => {
+   const scope = { role, ownerId, ownerPath } satisfies StudySessionScope;

-   const loader = await createRoleResourceLoader(root, role, ownerId, eventBus);
+   const loader = await createRoleResourceLoader(root, scope, eventBus);

-     ...createStudyTools(root, now, { role, ownerId }),
+     ...createStudyTools(root, now, scope),
```

把 `SessionRole` 的旧 import 从 `resource-loader` 删除。此任务只增加 scope 传递；`classroom_update` 的新签名和角色专用工具留到 Tasks 2–3 按测试驱动修改。

- [ ] **Step 4: 由 WorkspaceRegistry 传真实对象路径**

在 `openCoach` 中传 `snapshot.plan.path`：

```ts
const session = await this.factory({
  role: 'coach',
  ownerId: planId,
  ownerPath: snapshot.plan.path,
  sessionFile,
});
```

在 `openTutor` 中传 `lesson.path`：

```ts
const session = await this.factory({
  role: 'tutor',
  ownerId: lessonId,
  ownerPath: lesson.path,
  sessionFile,
});
```

不得在 factory 内重新生成 `plans/${ownerId}.md` 或 `lessons/${ownerId}.md`。

- [ ] **Step 5: 运行 scope、registry 与类型检查**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-scope.test.ts tests/runtime/workspace-registry.test.ts
bun run typecheck
```

Expected: 两组测试 PASS；typecheck exit 0。

- [ ] **Step 6: 提交共享 scope**

```bash
git add apps/pi-teaching-web/src/runtime/session-scope.ts apps/pi-teaching-web/src/runtime/session-factory.ts apps/pi-teaching-web/src/runtime/resource-loader.ts apps/pi-teaching-web/src/runtime/workspace-registry.ts apps/pi-teaching-web/tests/runtime/session-scope.test.ts apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts
git commit -m "refactor: bind sessions to workspace owner paths"
```

---

### Task 2: 收窄 Tutor Trace/Classroom 工具并增加原子 `lesson_close`

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/lesson-close.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/classroom-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/resources/agents/tutor.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`

**Interfaces:**
- Consumes: `StudySessionScope.ownerPath` from Task 1。
- Produces: `createClassroomUpdateTool(root, ownerPath)`。
- Produces: `createLessonCloseTool(root, ownerPath)`。
- Produces: application-atomic `closeLesson(root, lessonPath, { reflection, summary })`。

- [ ] **Step 1: 写收窄 contract 的失败测试**

在 `tests/runtime/study-tools.test.ts` 增加：

```ts
test('keeps runtime authority out of Tutor tool schemas', () => {
  const context = {
    role: 'tutor' as const,
    ownerId: 'not-the-file-name',
    ownerPath: 'lessons/lesson-003.md',
  };
  const trace = createStudyTools(root, () => new Date('2026-07-22T00:00:00Z'), context)
    .find((tool) => tool.name === 'trace_append')!;
  const classroom = createClassroomUpdateTool(root, context.ownerPath);
  const close = createLessonCloseTool(root, context.ownerPath);

  expect(JSON.stringify(trace.parameters)).not.toContain('cardStepId');
  expect(JSON.stringify(trace.parameters)).not.toContain('lessonPath');
  expect(JSON.stringify(classroom.parameters)).not.toContain('lessonPath');
  expect(JSON.stringify(classroom.parameters)).not.toContain('reflection');
  expect(JSON.stringify(classroom.parameters)).not.toContain('summary');
  expect(JSON.stringify(classroom.parameters)).not.toContain('"close"');
  const closeProperties = (close.parameters as {
    properties: Record<string, unknown>;
  }).properties;
  expect(Object.keys(closeProperties)).toEqual(['reflection', 'summary']);
});
```

更新现有 Trace 测试：调用中删除 `cardStepId`，期望持久记录的 `cardStepId` 为 `null`，同时保持真实 `lessonPath` 与 `cardPath`。

- [ ] **Step 2: 写 Lesson 单次完整关闭的失败测试**

把 `tests/study/write-workspace.test.ts` fixture 补成含 active Reflection Block 的合法 Lesson：

```md
## Block reflection（必做）

### Node State

- Kind: reflection
- Required: true
- Status: active
- Depends on: orientation
- Uses:

### Student View

复盘。

## Reflection

（课堂结束后填写）

## Lesson Summary

（课堂结束后填写）
```

断言正常关闭：

```ts
closeLesson(root, path, {
  reflection: '我会先检查定义域。',
  summary: '独立完成两次作答。',
});
const source = readFileSync(join(root, path), 'utf8');
expect(source).toContain('- Status: completed');
expect(source).toContain('status: closed');
expect(source).toContain('我会先检查定义域。');
expect(source).toContain('独立完成两次作答。');
```

再创建缺少 `## Lesson Summary` 的 fixture，保存调用前字节，断言抛错后字节完全相同。

- [ ] **Step 3: 运行定向测试并确认旧 contract 失败**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts tests/study/write-workspace.test.ts tests/runtime/session-factory.test.ts
```

Expected: FAIL，原因包括仍存在 `cardStepId` / `lessonPath`、缺少 `lesson_close` 或关闭不是一次完整变换。

- [ ] **Step 4: 把 Markdown 写入改成纯变换后单次落盘**

在 `write-workspace.ts` 抽出纯函数，现有 `setFrontmatterField` 与 `setBlockStatus` 也复用它们：

```ts
function replaceFrontmatterField(
  source: string,
  path: string,
  key: string,
  value: string,
): string {
  const match = /^(---\s*\n)([\s\S]*?)(\n---\s*\n)/.exec(source);
  if (!match) throw new Error(`FRONTMATTER_REQUIRED: ${path}`);
  const line = new RegExp(`^${key}:.*$`, 'm');
  const body = line.test(match[2]!)
    ? match[2]!.replace(line, `${key}: ${value}`)
    : `${match[2]}\n${key}: ${value}`;
  return source.replace(match[0], `${match[1]}${body}${match[3]}`);
}

function replaceBlockStatus(
  source: string,
  blockId: string,
  status: 'pending' | 'active' | 'completed' | 'skipped',
): string {
  const heading = new RegExp(`^## Block ${blockId}(?:（[^）]+）)?\\s*$`, 'm');
  const match = heading.exec(source);
  if (!match) throw new Error(`BLOCK_NOT_FOUND: ${blockId}`);
  const next = source.indexOf('\n## Block ', match.index + match[0].length);
  const end = next < 0 ? source.length : next;
  const block = source.slice(match.index, end);
  const state = /### Node State\s*\n([\s\S]*?)(?=\n### |\n## |$)/.exec(block);
  const replacement = state
    ? block.replace(state[0], state[0].replace(/^- Status:.*$/m, `- Status: ${status}`))
    : block.replace(
      match[0],
      `${match[0]}\n\n### Node State\n\n- Kind: dialogue\n- Required: true\n- Status: ${status}\n- Depends on:\n- Uses:`,
    );
  return source.slice(0, match.index) + replacement + source.slice(end);
}

function activeReflectionBlockId(source: string): string {
  const headings = [...source.matchAll(/^## Block ([^（\s]+)(?:（[^）]+）)?\s*$/gm)];
  const active = headings.flatMap((heading, index) => {
    const body = source.slice(heading.index!, headings[index + 1]?.index ?? source.length);
    return /^- Kind:\s*reflection\s*$/m.test(body)
      && /^- Status:\s*active\s*$/m.test(body)
      ? [heading[1]!]
      : [];
  });
  if (active.length !== 1) throw new Error('ACTIVE_REFLECTION_REQUIRED');
  return active[0]!;
}
```

用这些纯函数重写 `closeLesson`，只调用一次现有 `write(...)`：

```ts
export function closeLesson(
  root: string,
  lessonPath: string,
  input: { reflection: string; summary: string },
): void {
  const document = read(root, lessonPath);
  const reflectionBlockId = activeReflectionBlockId(document.source);
  let source = replaceBlockStatus(document.source, reflectionBlockId, 'completed');
  source = replaceSection(source, 'Reflection', input.reflection);
  source = replaceSection(source, 'Lesson Summary', input.summary);
  source = replaceFrontmatterField(source, lessonPath, 'status', 'closed');
  write(document.absolute, source);
}
```

- [ ] **Step 5: 实现 Session-bound Tutor 工具**

在 `study-tools.ts` 把 context 改为 `StudySessionScope`。`trace_append` schema 删除 `cardStepId`，execute 固定：

```ts
appendTraceWithProjection(root, {
  lessonPath: context.ownerPath,
  blockId: input.blockId,
  cardAlias: input.cardAlias ?? null,
  cardStepId: null,
  materialPath: input.materialPath ?? null,
  assessment: input.assessment,
  support: input.support,
  note: input.note,
  supersedes: input.supersedes ?? null,
}, now)
```

在 `classroom-update.ts` 改为：

```ts
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  appendRouteChange,
  setBlockStatus,
  setFrontmatterField,
} from '../study/write-workspace';

const action = Type.Union([
  Type.Literal('activate'),
  Type.Literal('complete'),
  Type.Literal('skip'),
  Type.Literal('route'),
  Type.Literal('pause'),
]);

export function createClassroomUpdateTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'classroom_update',
    label: '推进课堂节点',
    description: 'Update the current Lesson block, route, or pause state.',
    parameters: Type.Object({
      action,
      blockId: Type.Optional(Type.String()),
      routeAction: Type.Optional(Type.Union([
        Type.Literal('insert'),
        Type.Literal('skip'),
        Type.Literal('move'),
        Type.Literal('repeat'),
      ])),
      before: Type.Optional(Type.String()),
      after: Type.Optional(Type.String()),
      reason: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
    }),
    execute: async (_id, input) => {
      if (input.action === 'pause') {
        setFrontmatterField(root, ownerPath, 'status', 'paused');
      } else if (input.action === 'route') {
        if (!input.blockId || !input.routeAction || !input.reason || !input.source) {
          throw new Error('ROUTE_FIELDS_REQUIRED');
        }
        appendRouteChange(root, ownerPath, {
          action: input.routeAction,
          blockId: input.blockId,
          reason: input.reason,
          source: input.source,
          ...(input.before ? { before: input.before } : {}),
          ...(input.after ? { after: input.after } : {}),
        });
      } else {
        if (!input.blockId) throw new Error('BLOCK_ID_REQUIRED');
        const status = input.action === 'activate'
          ? 'active'
          : input.action === 'complete' ? 'completed' : 'skipped';
        setBlockStatus(root, ownerPath, input.blockId, status);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, action: input.action }) }],
        details: { kind: 'classroom-update', lessonPath: ownerPath, action: input.action },
      };
    },
  });
}
```

创建 `lesson-close.ts`：

```ts
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { closeLesson } from '../study/write-workspace';

export function createLessonCloseTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'lesson_close',
    label: '结束本节课',
    description: 'Close the current Lesson after student confirmation and persist reflection and summary.',
    parameters: Type.Object({
      reflection: Type.String({ minLength: 1 }),
      summary: Type.String({ minLength: 1 }),
    }),
    execute: async (_id, input) => {
      closeLesson(root, ownerPath, input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, status: 'closed' }) }],
        details: { kind: 'lesson-close', lessonPath: ownerPath },
      };
    },
  });
}
```

- [ ] **Step 6: 注册新 Tutor 工具并同步提示词**

在 `session-factory.ts`：

```ts
const tools: ToolDefinition[] = [
  ...createStudyTools(root, now, scope),
  ...(role === 'tutor'
    ? [
      createClassroomUpdateTool(root, ownerPath),
      createLessonCloseTool(root, ownerPath),
    ]
    : []),
  createDeepWorkflowTool(workflowRuntime),
];
```

Tutor 活动工具末尾固定为：

```ts
'trace_append',
'source_resolve',
'classroom_update',
'lesson_close',
```

在 Tutor Agent/Skill 写明以下顺序，不保留旧 `classroom_update` close 表述：

```text
Read the exact Current Lesson file from the injected resource context.
Never supply lessonPath or cardStepId to Trace or classroom tools.
Use classroom_update only for Block, Route and pause changes.
After student-confirmed closure, activate the reflection Block and call lesson_close once with reflection and summary.
When an objection is accepted, append the superseding Trace before lesson_close.
```

- [ ] **Step 7: 运行 Tutor 全部相关测试**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts tests/study/write-workspace.test.ts tests/runtime/session-factory.test.ts tests/runtime/workspace-registry.test.ts
bun run typecheck
```

Expected: PASS；typecheck exit 0；工具 schema 中不存在 `lessonPath` / `cardStepId` / classroom `close`。

- [ ] **Step 8: 提交 Tutor 工具改造**

```bash
git add apps/pi-teaching-web/src/runtime/lesson-close.ts apps/pi-teaching-web/src/runtime/study-tools.ts apps/pi-teaching-web/src/runtime/classroom-update.ts apps/pi-teaching-web/src/runtime/session-factory.ts apps/pi-teaching-web/src/study/write-workspace.ts apps/pi-teaching-web/resources/agents/tutor.md apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/tests/runtime/study-tools.test.ts apps/pi-teaching-web/tests/runtime/session-factory.test.ts apps/pi-teaching-web/tests/study/write-workspace.test.ts
git commit -m "feat: bind tutor writes to the lesson session"
```

---

### Task 3: 增加 Session-bound Coach `plan_update`

**Files:**
- Create: `apps/pi-teaching-web/src/runtime/plan-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/resources/agents/coach.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`

**Interfaces:**
- Consumes: Coach `StudySessionScope.ownerPath` from Task 1。
- Produces: `PlanDecision = 'active' | 'complete' | 'replan'`。
- Produces: `updatePlan(root, planPath, input)` and `createPlanUpdateTool(root, ownerPath)`。

- [ ] **Step 1: 写原子 Plan 更新与工具 schema 的失败测试**

在 `tests/study/write-workspace.test.ts` 用临时 Plan fixture 调用：

```ts
updatePlan(root, 'plans/p1.md', {
  decision: 'replan',
  lessonIndex: '1. [Lesson 001](../lessons/lesson-001.md) — closed。',
  currentPosition: '- 已满足标准一。\n- 标准二仍缺证据。',
  nextLessonCandidate: '- 使用另一问题类别的真实题卡。',
  planSummary: '决定：继续，但重新安排下一课。',
});
```

断言四个 section 全部替换且 frontmatter 为 `status: active`。再用 `decision: complete` 断言映射为 `status: completed`。缺少任一固定 section 时，断言文件字节不变。

在 `tests/runtime/study-tools.test.ts` 增加：

```ts
test('exposes one flat Coach plan_update contract without path authority', () => {
  const tool = createPlanUpdateTool(root, 'plans/domain-integrity.md');
  const properties = (tool.parameters as {
    properties: Record<string, unknown>;
  }).properties;
  expect(Object.keys(properties)).toEqual([
    'decision',
    'lessonIndex',
    'currentPosition',
    'nextLessonCandidate',
    'planSummary',
  ]);
  expect(JSON.stringify(tool.parameters)).not.toContain('planPath');
});
```

- [ ] **Step 2: 运行定向测试并确认缺少实现**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts
```

Expected: FAIL，错误包含缺少 `updatePlan` / `createPlanUpdateTool` 或 Coach 工具列表不含 `plan_update`。

- [ ] **Step 3: 实现一次写入的 Plan section 更新**

在 `write-workspace.ts` 增加：

```ts
export type PlanDecision = 'active' | 'complete' | 'replan';

export type PlanUpdateInput = {
  decision: PlanDecision;
  lessonIndex: string;
  currentPosition: string;
  nextLessonCandidate: string;
  planSummary: string;
};

export function updatePlan(
  root: string,
  planPath: string,
  input: PlanUpdateInput,
): void {
  const document = read(root, planPath);
  const status = input.decision === 'complete' ? 'completed' : 'active';
  let source = replaceSection(document.source, 'Lesson Index', input.lessonIndex);
  source = replaceSection(source, 'Current Position', input.currentPosition);
  source = replaceSection(source, 'Next Lesson Candidate', input.nextLessonCandidate);
  source = replaceSection(source, 'Plan Summary', input.planSummary);
  source = replaceFrontmatterField(source, planPath, 'status', status);
  write(document.absolute, source);
}
```

四个字段均使用非空 TypeBox 字符串；不解析或重新生成 Coach 提供的 Markdown body，不增加额外 schema。

- [ ] **Step 4: 实现并注册 `plan_update`**

创建 `runtime/plan-update.ts`：

```ts
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { updatePlan } from '../study/write-workspace';

export function createPlanUpdateTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'plan_update',
    label: '写回学习计划',
    description: 'Atomically persist the Coach final audit to the current Plan.',
    parameters: Type.Object({
      decision: Type.Union([
        Type.Literal('active'),
        Type.Literal('complete'),
        Type.Literal('replan'),
      ]),
      lessonIndex: Type.String({ minLength: 1 }),
      currentPosition: Type.String({ minLength: 1 }),
      nextLessonCandidate: Type.String({ minLength: 1 }),
      planSummary: Type.String({ minLength: 1 }),
    }),
    execute: async (_id, input) => {
      updatePlan(root, ownerPath, input);
      const status = input.decision === 'complete' ? 'completed' : 'active';
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, status }) }],
        details: { kind: 'plan-update', planPath: ownerPath, decision: input.decision },
      };
    },
  });
}
```

Session factory 只在 Coach role 注册此工具，并在 Coach `roleToolNames` 的 `source_resolve` 后加入 `plan_update`。Tutor 列表不得出现它；Coach 的 `write` / `edit` 保持原样。

- [ ] **Step 5: 同步 Coach Agent/Skill 与 contract 测试**

把最终审计步骤改成严格顺序：

```text
Build the private evidence matrix.
Call plan_update once with the final decision and the complete bodies of Lesson Index, Current Position, Next Lesson Candidate and Plan Summary.
Read the exact Current Plan file from the injected resource context.
Derive the student-facing conclusion only from that reread.
Do not use generic edit for the final Plan audit; keep write/edit for Lesson preparation.
```

更新 `session-factory.test.ts`：

- Coach 工具列表包含 `plan_update`，仍包含 `write` / `edit`；
- Tutor 工具列表不包含 `plan_update`；
- Coach Agent 与 Skill 同时包含 `plan_update once`、`Reread the exact Current Plan file` 和禁止用 generic edit 完成最终审计的文字。

- [ ] **Step 6: 运行 Coach 定向回归**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts tests/runtime/workspace-registry.test.ts
bun run typecheck
```

Expected: PASS；Coach/Tutor 工具边界准确；Plan 缺 section 时无部分写入。

- [ ] **Step 7: 提交 Coach 写回工具**

```bash
git add apps/pi-teaching-web/src/runtime/plan-update.ts apps/pi-teaching-web/src/runtime/session-factory.ts apps/pi-teaching-web/src/study/write-workspace.ts apps/pi-teaching-web/resources/agents/coach.md apps/pi-teaching-web/resources/skills/coach-study/SKILL.md apps/pi-teaching-web/tests/runtime/study-tools.test.ts apps/pi-teaching-web/tests/runtime/session-factory.test.ts apps/pi-teaching-web/tests/study/write-workspace.test.ts
git commit -m "feat: add session-bound plan updates"
```

---

### Task 4: 统一实时与历史的 `safe | raw-stream` 消息投影

**Files:**
- Create: `apps/pi-teaching-web/src/projection/message-policy.ts`
- Create: `apps/pi-teaching-web/tests/projection/message-policy.test.ts`
- Modify: `apps/pi-teaching-web/src/projection/projector.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/server/index.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `apps/pi-teaching-web/tests/projection/projector.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**
- Produces: `MessageProjectionMode = 'safe' | 'raw-stream'`。
- Produces: `parseMessageProjectionMode(value: string | undefined): MessageProjectionMode`。
- Produces: `visibleAssistantText(content: unknown, mode: MessageProjectionMode): string | null`。
- Produces: `projectStoredMessage(sessionKey, raw, index, mode): ChatMessage | null`。
- Changes: `projectSessionEvent(sessionKey, event, mode = 'safe')`。
- Changes: `WorkspaceRegistry.history(key, mode = 'safe')`。

- [ ] **Step 1: 写消息分类与模式解析的失败测试**

创建 `tests/projection/message-policy.test.ts`：

```ts
import { expect, test } from 'bun:test';
import {
  parseMessageProjectionMode,
  visibleAssistantText,
} from '../../src/projection/message-policy';

const mixed = [
  { type: 'text', text: '现在构建内部矩阵。' },
  { type: 'toolCall', id: 'call-1', name: 'plan_update', arguments: {} },
];

test('defaults to safe and accepts only the two configured modes', () => {
  expect(parseMessageProjectionMode(undefined)).toBe('safe');
  expect(parseMessageProjectionMode('safe')).toBe('safe');
  expect(parseMessageProjectionMode('raw-stream')).toBe('raw-stream');
  expect(() => parseMessageProjectionMode('raw')).toThrow('INVALID_MESSAGE_PROJECTION');
});

test('hides all text from a mixed tool message only in safe mode', () => {
  expect(visibleAssistantText(mixed, 'safe')).toBeNull();
  expect(visibleAssistantText(mixed, 'raw-stream')).toBe('现在构建内部矩阵。');
  expect(visibleAssistantText([{ type: 'text', text: '给学生的结论。' }], 'safe'))
    .toBe('给学生的结论。');
});
```

- [ ] **Step 2: 改写 projector 测试，固定 safe 与 raw 行为**

在 `projector.test.ts` 覆盖：

```ts
expect(projectSessionEvent('coach:plan', textDeltaEvent, 'safe')).toEqual([]);
expect(projectSessionEvent('coach:plan', textDeltaEvent, 'raw-stream'))
  .toEqual([expect.objectContaining({ type: 'message-delta', delta: '下一课' })]);

expect(projectSessionEvent('coach:plan', mixedMessageEnd, 'safe')).toEqual([]);
expect(projectSessionEvent('coach:plan', mixedMessageEnd, 'raw-stream'))
  .toEqual([expect.objectContaining({
    type: 'message',
    message: expect.objectContaining({ text: '现在构建内部矩阵。' }),
  })]);

expect(projectSessionEvent('coach:plan', pureTextMessageEnd, 'safe'))
  .toEqual([expect.objectContaining({ type: 'message' })]);
```

同时断言 `plan_update` 与 `lesson_close` 只投影中文 `work-status` label，不投影参数或 tool result。

- [ ] **Step 3: 运行 projection 测试并确认当前即时 delta 行为失败**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/projection/message-policy.test.ts tests/projection/projector.test.ts
```

Expected: FAIL，原因是缺少 policy 模块且默认 projector 仍直接发送 `text_delta`。

- [ ] **Step 4: 实现唯一消息分类器**

创建 `src/projection/message-policy.ts`：

```ts
import type { ChatMessage, SessionKey } from '../shared/contracts';

export type MessageProjectionMode = 'safe' | 'raw-stream';

type ContentPart = { type?: unknown; text?: unknown };
type StoredMessage = { role?: unknown; content?: unknown };

export function parseMessageProjectionMode(value: string | undefined): MessageProjectionMode {
  const mode = value ?? 'safe';
  if (mode === 'safe' || mode === 'raw-stream') return mode;
  throw new Error(`INVALID_MESSAGE_PROJECTION: ${mode}`);
}

function textFromContent(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.flatMap((part) => {
    const item = part as ContentPart;
    return item?.type === 'text' ? [String(item.text ?? '')] : [];
  }).join('');
}

export function visibleAssistantText(
  content: unknown,
  mode: MessageProjectionMode,
): string | null {
  const hasToolCall = Array.isArray(content)
    && content.some((part) => (part as ContentPart)?.type === 'toolCall');
  if (mode === 'safe' && hasToolCall) return null;
  return textFromContent(content) || null;
}

export function projectStoredMessage(
  sessionKey: SessionKey,
  raw: unknown,
  index: number,
  mode: MessageProjectionMode,
): ChatMessage | null {
  const message = raw as StoredMessage;
  if (message.role !== 'user' && message.role !== 'assistant') return null;
  const text = message.role === 'assistant'
    ? visibleAssistantText(message.content, mode)
    : textFromContent(message.content) || null;
  if (!text) return null;
  return {
    id: `${sessionKey}:${index}`,
    role: message.role === 'user'
      ? 'student'
      : sessionKey.startsWith('coach:') ? 'coach' : 'tutor',
    text,
    complete: true,
  };
}
```

该分类只看最终 assistant message 是否含 `toolCall`。它不读取关键词、不分析自然语言，也不修改原始 message。

- [ ] **Step 5: 让实时 projector 使用 mode**

修改 `projectSessionEvent`：

```ts
import {
  visibleAssistantText,
  type MessageProjectionMode,
} from './message-policy';

export function projectSessionEvent(
  sessionKey: SessionKey,
  event: AgentSessionEvent,
  mode: MessageProjectionMode = 'safe',
): StudyViewEvent[] {
  if (event.type === 'message_update') {
    return mode === 'raw-stream' && event.assistantMessageEvent.type === 'text_delta'
      ? [{
        type: 'message-delta',
        sessionKey,
        messageId: `${sessionKey}:${event.message.timestamp}`,
        delta: event.assistantMessageEvent.delta,
      }]
      : [];
  }
  if (event.type === 'message_end' && event.message.role === 'assistant') {
    const text = visibleAssistantText(event.message.content, mode);
    return text ? [{
      type: 'message',
      sessionKey,
      message: {
        id: `${sessionKey}:${event.message.timestamp}`,
        role: sessionKey.startsWith('coach:') ? 'coach' : 'tutor',
        text,
        complete: true,
      },
    }] : [];
  }
  if (event.type === 'tool_execution_start') {
    return [{
      type: 'work-status',
      sessionKey,
      tool: event.toolName,
      status: 'running',
      label: labels[event.toolName] ?? '正在处理',
    }];
  }
  if (event.type === 'tool_execution_end') {
    return [{
      type: 'work-status',
      sessionKey,
      tool: event.toolName,
      status: event.isError ? 'failed' : 'done',
      label: labels[event.toolName] ?? '处理完成',
    }];
  }
  return [];
}
```

在 `labels` 增加：

```ts
lesson_close: '正在整理课堂总结',
plan_update: '正在写回学习计划',
```

- [ ] **Step 6: 让历史、replay 与实时订阅共享同一 mode**

将 `WorkspaceRegistry.history` 改成：

```ts
import {
  projectStoredMessage,
  type MessageProjectionMode,
} from '../projection/message-policy';

history(
  key: SessionKey,
  mode: MessageProjectionMode = 'safe',
): ChatMessage[] {
  const session = this.sessions.get(key);
  if (!session) return [];
  return session.messages.flatMap((raw, index) => {
    const message = projectStoredMessage(key, raw, index, mode);
    return message ? [message] : [];
  });
}
```

在 `server/app.ts`：

```ts
import type { MessageProjectionMode } from '../projection/message-policy';

export type AppDependencies = {
  root: string;
  authoring: boolean;
  staticRoot?: string;
  registry: WorkspaceRegistry;
  hub: EventHub;
  readLearningSet?: typeof readLearningSet;
  messageProjection?: MessageProjectionMode;
};

const projectionMode = deps.messageProjection ?? 'safe';

for (const projected of projectSessionEvent(key, event, projectionMode)) {
  deps.hub.publish(projected);
}

const replayMessages = deps.registry.history(lesson.sessionKey, projectionMode);
const historyMessages = deps.registry.history(key, projectionMode);
```

把 `projectionMode` 声明放在 `if (!deps) return new Response('Not found', { status: 404 });` 之后。把 `replayMessages` 传给 `buildReplay`，把 `historyMessages` 作为 history endpoint 的 JSON body；不要保留任何不传 mode 的 server 调用。

更新 server API 测试，用 fake registry 捕获 `history(key, mode)`，分别断言 history endpoint 与 replay 都收到配置的 `raw-stream`；未提供配置时收到 `safe`。

- [ ] **Step 7: 接入启动参数与环境变量**

在 `server/index.ts`：

```ts
import { parseMessageProjectionMode } from '../projection/message-policy';

const messageProjection = parseMessageProjectionMode(
  valueAfter('--message-projection') ?? process.env.STUDYFORGE_MESSAGE_PROJECTION,
);

const fetch = createRequestHandler({
  root,
  authoring,
  messageProjection,
  registry,
  hub,
  staticRoot,
});
```

不把 mode 写进 learning set，也不增加前端切换按钮；这是 runtime 启动配置。

在 `apps/pi-teaching-web/README.md` 增加：

```markdown
## Message projection

Student sessions default to `safe`: assistant text is shown only after a pure-text
message finishes, while messages containing tool calls are represented by structured
work status. Pi's raw session JSONL is not modified.

Use `raw-stream` only for local diagnostics because mixed tool-call text can be visible:

`bun run start -- --message-projection raw-stream`

The equivalent environment setting is
`STUDYFORGE_MESSAGE_PROJECTION=raw-stream`.
```

- [ ] **Step 8: 运行投影与服务器回归**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/projection/message-policy.test.ts tests/projection/projector.test.ts tests/runtime/workspace-registry.test.ts tests/server/workspace-api.test.ts tests/client/state.test.ts
bun run typecheck
```

Expected: PASS；默认 safe 不产生 `message-delta`，纯文本在 `message_end` 出现一次；mixed tool message 在实时和历史均不可见；raw-stream 保持原即时文本行为。

- [ ] **Step 9: 提交安全消息投影**

```bash
git add apps/pi-teaching-web/src/projection/message-policy.ts apps/pi-teaching-web/src/projection/projector.ts apps/pi-teaching-web/src/runtime/workspace-registry.ts apps/pi-teaching-web/src/server/index.ts apps/pi-teaching-web/src/server/app.ts apps/pi-teaching-web/README.md apps/pi-teaching-web/tests/projection/message-policy.test.ts apps/pi-teaching-web/tests/projection/projector.test.ts apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "feat: add safe student message projection"
```

---

### Task 5: 全量自动验证

**Files:**
- Verify only; no production file should be changed by this task.

**Interfaces:**
- Consumes: Tasks 1–4 的全部 public contracts。
- Produces: 一组无失败的静态、单元、构建与浏览器回归结果。

- [ ] **Step 1: 运行 Pi Web 全量检查**

Run:

```bash
cd apps/pi-teaching-web
bun run typecheck
bun run test
bun run build
bun run test:e2e
```

Expected: 四条命令 exit 0；无 TypeScript error、Bun test failure、Vite build failure 或 Playwright failure。

- [ ] **Step 2: 运行学习插件回归**

Run:

```bash
cd plugins/highschool-study
bun run check
bun run validate:plugin
```

Expected: 两条命令 exit 0；Trace reader、projection 与插件 manifest 均通过。

- [ ] **Step 3: 检查工具 schema 与旧路径残留**

Run:

```bash
rg -n "lessonPath|cardStepId|action.*close|CLOSE_REQUIRES_REFLECTION" apps/pi-teaching-web/src/runtime apps/pi-teaching-web/resources/agents apps/pi-teaching-web/resources/skills/tutor-lesson
```

Expected: `lessonPath` / `cardStepId` 只允许出现在底层持久化 adapter、result details 或说明历史字段的上下文中；Tutor-facing TypeBox parameters 与 Tutor prompt 不再要求它们；不存在 classroom close 分支或旧错误码。

Run:

```bash
rg -n "plan_update|lesson_close|messageProjection|raw-stream" apps/pi-teaching-web/src apps/pi-teaching-web/resources apps/pi-teaching-web/tests
```

Expected: 两个新工具均有 factory 注册、角色边界、prompt 与测试；投影 mode 同时连接 live、history、replay 和 server config。

- [ ] **Step 4: 检查工作区隔离**

Run:

```bash
git status --short
```

Expected: 只保留用户原有的未提交文件；Tasks 1–4 的代码均已分别提交，没有误提交学习集运行状态。

---

### Task 6: 导数学习集真实模型验收

**Files:**
- Create: `docs/audits/2026-07-22-session-bound-tools-safe-projection-acceptance.md`
- Do not modify: repository `examples/derivative-demo/learning-set/**` during the run。

**Interfaces:**
- Consumes: 默认 `safe` runtime、Tutor tools、Coach `plan_update`。
- Produces: 可回溯到临时 learning set、Coach/Tutor Session JSONL 与 Markdown 文件的验收报告。

- [ ] **Step 1: 创建隔离的真实运行副本**

执行以下命令创建唯一临时目录并复制当前仓库；只在副本的 `examples/derivative-demo/learning-set` 中运行课程。使用本机已经配置的 Pi provider 凭据；命令、报告和日志中不得打印 API key。

启动默认 safe runtime：

```bash
RUNTIME_ROOT="$(mktemp -d /tmp/studyforge-session-tools-20260722-XXXXXX)"
rsync -a --exclude .git /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/ "$RUNTIME_ROOT/"
cd "$RUNTIME_ROOT/apps/pi-teaching-web"
bun run start -- --learning-set ../../examples/derivative-demo/learning-set --port 65001
```

Expected: 控制台显示 `StudyForge Pi Web: http://127.0.0.1:65001`，没有 projection mode 错误。

- [ ] **Step 2: 完成 Tutor 的真实闭环**

在导数学习集开启一节 prepared Lesson，连续完成：

1. Tutor 从资源上下文的 `Current Lesson file` 直接读取正确文件；
2. 学生提交至少两次有证据作答；
3. Tutor 写入两条 `trace_append`，至少执行一次 Block 推进；
4. 学生明确确认结束；
5. Tutor 激活 Reflection Block，并仅调用一次 `lesson_close`。

检查 Tutor JSONL，必须满足：

- 不出现错误 Lesson 猜路径；
- `trace_append` arguments 不含 `lessonPath` 或 `cardStepId`；
- `classroom_update` arguments 不含 `lessonPath`、`reflection` 或 `summary`；
- 只有一个成功的 `lesson_close`，没有旧 `close` action；
- 相关工具错误与参数重试数均为 0。

检查 Lesson Markdown，必须同时满足：Reflection Block 为 completed、顶层 Reflection/Lesson Summary 已写入、frontmatter 为 closed、两条 Trace 均能反查真实题卡。

- [ ] **Step 3: 完成 Coach Plan 写回闭环**

返回同一 Plan 的 Coach Session，请 Coach 复盘刚结束的 Lesson 并给出最终 `active | complete | replan` 决定，不要求备下一课。

检查 Coach JSONL，必须满足：

- 只调用一次 `plan_update` 完成最终审计；
- arguments 只有五个已定字段，不含 `planPath`、嵌套 edits 或 oldText；
- `plan_update` 后调用 `read` 重读准确的 Current Plan file；
- 学生可见结论位于重读之后；
- 不出现 stringified edits、引号不匹配或 exact-text retry。

检查 Plan Markdown，确认 Lesson Index、Current Position、Next Lesson Candidate、Plan Summary 和 frontmatter status 与 Coach 最终结论一致。

- [ ] **Step 4: 验证默认 safe 的实时与刷新后投影**

在浏览器实时观察 Tutor 与 Coach 两段会话，然后刷新页面并重新打开相同 Session history。必须满足：

- 含 `toolCall` 的 assistant message 即使带有文本，也不在聊天区出现；
- 工具运行时仍显示结构化 `work-status`；
- 纯文本学生回复在对应 `message_end` 后完整出现；
- 刷新后被隐藏的 mixed tool message 不会从历史重新出现；
- Pi 原始 JSONL 仍完整包含 thinking、text、toolCall 和 tool result。

`raw-stream` 的行为由 Task 4 自动测试覆盖，本次真实学生验收保持默认 safe，避免主动把内部文字展示到课堂界面。

- [ ] **Step 5: 写验收报告**

创建 `docs/audits/2026-07-22-session-bound-tools-safe-projection-acceptance.md`，包含以下确定结构和真实运行值：

- `Run Identity`：写入 `git rev-parse HEAD` 的结果、`$RUNTIME_ROOT`、learning set 绝对路径、实际 Coach/Tutor Session ID 与 `Projection mode: safe`；
- `Contract Results` 表：固定七行 `Tutor ownerPath`、`Trace parameters`、`Lesson close`、`Plan update`、`Live safe projection`、`History safe projection`、`Raw JSONL preservation`；每行依据 Steps 2–4 写入单一 `PASS` 或 `FAIL` 和具体文件/事件证据；
- `Retries and Errors`：写入 wrong path、Trace parameter、Lesson close、Plan update 和全部 tool error 的实际整数；
- `Conclusion`：只有七项均为 `PASS` 且五个错误计数均为 `0` 时写 `PASS`，否则写 `FAIL` 并列出失败 contract。

报告只记录路径、Session ID、工具名、结果和必要证据，不复制 API key、完整模型 thinking 或学生不需要看到的内部矩阵。

- [ ] **Step 6: 提交验收报告**

```bash
git add docs/audits/2026-07-22-session-bound-tools-safe-projection-acceptance.md
git commit -m "test: record session tool acceptance"
```

---

## Final Completion Gate

实施只有在以下条件全部成立后才算完成：

- 共享 `ownerPath`、Tutor tools、Coach `plan_update` 与 safe projection 均有独立提交和通过测试；
- Tutor 完成“开始 → 两条 Trace → 关闭”且相关参数重试为 0；
- Coach 完成“审计 → `plan_update` → 重读 → 回复”且 edit/path 重试为 0；
- 默认 safe 在实时和历史中都隐藏 mixed tool messages，同时保留 work-status 和原始 Pi JSONL；
- Pi Web 全量 test/typecheck/build/e2e 与学习插件 check/validate 全部通过；
- 一题多解、能力投影刷新和页面路由恢复没有被伪装成已解决，也没有被顺手扩进本轮代码。
