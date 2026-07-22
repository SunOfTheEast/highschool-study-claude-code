# Teaching Runtime Closure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把真实课程审计后仍未落地的教学协议一次收束：Session 绑定的 Tutor/Coach 写入、学生安全消息投影、实际方法证据与题卡另解、能力图实时刷新，以及 Plan/Lesson URL 恢复；已经修好的 attempt 聚合只做回归，不重复实现。

**Architecture:** 三条实现线共享 Markdown/active Trace 作为唯一事实源。运行时线把 Coach/Tutor Session 绑定到真实 owner path，并提供窄写入工具；证据线让 Trace 保存实际方法、让题卡旁挂可追溯另解；前端线只投影安全消息、完整能力快照和对象身份 URL。三线在 Tutor 最终工具/Skill 接口处汇合，最后用同一份导数学习集完成自动与真实模型验收。

**Tech Stack:** TypeScript 7、Bun 1.3.14、TypeBox 1.3.6、Zod 4.4.3、YAML 2.9、`@earendil-works/pi-*` 0.81.0、React 19、Markdown learning set、Bun Test、Playwright。

## Global Constraints

- 本文件是剩余教学闭环的唯一执行计划。`2026-07-22-session-bound-tools-and-safe-projection.md` 保留为历史细化来源，不再单独执行。
- 设计依据：
  - `docs/superpowers/specs/2026-07-22-session-bound-tutor-tools-design.md`
  - `docs/superpowers/specs/2026-07-22-multiple-solution-method-evidence-design.md`
  - `docs/superpowers/specs/2026-07-22-live-ability-refresh-and-url-restoration-design.md`
- 不新增 Agent、裁判流程、提示确认门、课堂状态机、后台队列、规则评分器或旧参数兼容层。
- 学生路线是否正确、是否属于真正另解，由当前 Tutor 结合完整推导判断；运行时只做真实性、作用域、规范节点和 active Trace 校验。
- `assessment` 只表示正确性；题卡 `graph.method` 只表示参考方法；Trace `methods` 才表示本次实际方法。
- Tutor/Coach 的文件所有权只来自 `readPlanWorkspace` 返回的真实 `plan.path` / `lesson.path`，模型不能填写或覆盖。
- Tutor 不再填写 `lessonPath`、`cardPath` 或 `cardStepId`；公共插件 MCP 仍可保留其非 Session-bound 调用所需的现有路径字段。
- 学生异议仍通过现有 `supersedes` 纠正，不增加新字段或裁判 Agent；普通读取、能力投影和另解可见性只使用 active Trace。
- 默认 `messageProjection=safe`；`raw-stream` 只作为本地诊断开关。两种模式都不修改 Pi JSONL。
- 能力事件发送完整 `AbilityProjection`，前端直接替换；不做增量 BKT、轮询、文件监听或第二套聚合。
- URL 只保存 Plan ID 与 Lesson ID；Lesson 状态、Session ID、Block、Persona、深度模式仍由 Markdown/Pi runtime 决定。
- 不引入 React Router、`localStorage` 或 `sessionStorage`。
- 保留工作区中用户已有的 `examples/derivative-demo/learning-set/plans/domain-integrity.md`、`.superpowers/` 和未跟踪三课计划；除隔离验收副本外不改真实学习运行数据。
- 每个任务先写失败测试，再做最小实现；一个任务一个提交。并行执行必须遵守本计划的 lane 文件所有权，禁止两个 worker 同时改同一文件。

---

## Current-state Baseline

| 问题 | 执行前真实状态 | 本计划处理 |
|---|---|---|
| 一次作答被多条 Trace 重复计数 | 已修复 | Task 0、6 回归；不得改回按 Trace 行计数 |
| 一题多解导致方法证据失真 | 设计完成，未实现 | Task 3、6、8 |
| Tutor 接受异议却不更正 Trace | `supersedes` 与 Prompt 已存在，尚未和最终窄工具一起验收 | Task 2、8、11；仍只靠 Skill/Prompt 驱动 |
| Tutor 否定替代解法、主动倾倒标准解 | “完整解答需请求”已存在；缺少先验证路线与正确后停止的明确协议 | Task 8、11；不加输出门 |
| Coach 更新 Plan 连续失败 | 方案完成，未实现 | Task 1、5 |
| 内部矩阵、工具旁白泄漏 | 方案完成，未实现 | Task 4 |
| Tutor 路径、step、close 参数错误 | 设计完成，未实现 | Task 1、2 |
| Trace 后能力图不刷新 | 后端事实已刷新，WebSocket 断链 | Task 7 |
| 刷新页面回 Roadmap 首页 | 服务端已有 SPA shell，客户端不读写 URL | Task 9 |

“Tutor 接受异议”和“完整解答必须由学生请求”已有文字不应先删除再重写；实现任务只补齐工具契约、缺失语句和验收。

---

## Execution Lanes and Dependency Graph

### Lane ownership

| Lane | 顺序 | 主要独占文件 |
|---|---|---|
| A — Session runtime | Task 1 → Task 2 → Task 5 → Task 8 | `runtime/session-*`、`study/write-workspace.ts`、Coach/Tutor runtime resources |
| B — Evidence domain | Task 3 → Task 6 | `plugins/highschool-study/server/src/**` 与插件 domain tests |
| C — Projection/frontend | Task 4 → Task 7 → Task 9 | `projection/**`、`server/app.ts`、`shared/contracts.ts`、`client/App.tsx` |

Task 1 完成 `WorkspaceRegistry` 的 ownerPath 改造后，把该文件所有权交给 Lane C；Lane C 此后才开始 Task 4。Task 8 是 A/B 汇合点；Task 10 是三线总屏障；Task 11 必须最后执行。

```text
Task 0 baseline
  ├─ Lane A: Task 1 → Task 2 → Task 5 ─┐
  ├─ Lane B: Task 3 → Task 6 ──────────┼→ Task 8 ─┐
  └─ Task 1 → Lane C: Task 4 → Task 7 → Task 9 ──┼→ Task 10 → Task 11
                                                  ┘
```

### Safe parallel waves

- Wave 0：Task 0，单线程。
- Wave 1：Task 1、Task 3，最多 2 线程。
- Wave 2：Task 2、Task 4、Task 6，最多 3 线程。
- Wave 3：Task 5、Task 7，最多 2 线程。
- Wave 4：Task 8、Task 9，最多 2 线程。
- Wave 5：Task 10、Task 11，单线程顺序验收。

不要把 Task 1 与 Task 4 并行：两者都会改 `workspace-registry.ts`。不要把 Task 2 与 Task 5 并行：两者都会改 `session-factory.ts`、`write-workspace.ts` 和相同 contract tests。不要把 Task 4、7、9 分给不同 worker：三者连续改 `server/app.ts` 与前端事件/恢复逻辑。

---

## File Map

### 新建

- `apps/pi-teaching-web/src/runtime/session-scope.ts`
- `apps/pi-teaching-web/src/runtime/lesson-close.ts`
- `apps/pi-teaching-web/src/runtime/plan-update.ts`
- `apps/pi-teaching-web/src/runtime/card-alternative-append.ts`
- `apps/pi-teaching-web/src/projection/message-policy.ts`
- `apps/pi-teaching-web/src/client/routes.ts`
- `apps/pi-teaching-web/tests/runtime/session-scope.test.ts`
- `apps/pi-teaching-web/tests/projection/message-policy.test.ts`
- `apps/pi-teaching-web/tests/client/routes.test.ts`
- `plugins/highschool-study/server/src/method-vocabulary.ts`
- `plugins/highschool-study/server/src/alternatives.ts`
- `plugins/highschool-study/tests/integration/method-vocabulary.test.ts`
- `plugins/highschool-study/tests/integration/card-alternatives.test.ts`
- `docs/audits/2026-07-22-teaching-runtime-closure-acceptance.md`（仅 Task 11）

### 修改

- Pi runtime：`session-factory.ts`、`resource-loader.ts`、`workspace-registry.ts`、`study-tools.ts`、`classroom-update.ts`
- Pi Markdown writer：`study/write-workspace.ts`
- Pi projection/server：`projection/projector.ts`、`server/index.ts`、`server/app.ts`、`shared/contracts.ts`
- Pi client：`client/App.tsx`、必要的 E2E fixture/spec
- Pi resources：Coach/Tutor Agent 与 Skill
- Plugin domain：`traces.ts`、`method-signals.ts`、`cards.ts`、`trace-search.ts`、`domain.ts`、`mcp/register-tools.ts`
- Plugin Skills：`skills/run-lesson/SKILL.md`、需要同步事实口径的 Coach/检查 Skill
- 对应 Bun/Playwright contract、integration 与 E2E tests

---

### Task 0: 固定已修复语义与执行基线

**Files:** Verify only.

**Purpose:** 不重新实现已经修好的 attempt 聚合；确认异议、提示和完整解答协议的现有文字确实存在，再开始并行改造。

- [ ] **Step 1: 记录基线提交与工作区例外**

Run:

```bash
git rev-parse --short HEAD
git status --short
```

Expected: HEAD 至少包含 `bcfe600`；只看到用户已有的学习集运行文件、`.superpowers/` 与未跟踪三课计划。把输出记在执行日志，不提交这些文件。

- [ ] **Step 2: 运行现有核心回归**

```bash
cd plugins/highschool-study
bun test tests/integration/method-signals.test.ts tests/integration/trace-records.test.ts

cd ../../apps/pi-teaching-web
bun test tests/runtime/session-factory.test.ts tests/runtime/study-tools.test.ts tests/server/workspace-api.test.ts
```

Expected: PASS。

- [ ] **Step 3: 固定不允许退化的文字与聚合键**

```bash
rg -n "lessonPath.*blockId.*cardPath|same-card unsupported completion|superseding Trace|Give the full solution only after an explicit student request" \
  plugins/highschool-study/server/src \
  plugins/highschool-study/skills/run-lesson/SKILL.md \
  apps/pi-teaching-web/resources
```

Expected: 找到 attempt 聚合、superseding Trace、同卡不等于迁移和完整解答请求规则。Task 0 不提交代码。

---

### Task 1: 建立统一的 Session owner scope

**Lane:** A
**Depends on:** Task 0

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Create: `apps/pi-teaching-web/tests/runtime/session-scope.test.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`

**Contract:**

```ts
export type SessionRole = 'coach' | 'tutor';

export type StudySessionScope = {
  role: SessionRole;
  ownerId: string;
  ownerPath: string;
};

export type SessionFactoryInput = StudySessionScope & {
  sessionFile: string | null;
};
```

- [ ] **Step 1: 写真实嵌套路径的失败测试**

在临时 fixture 中把 `lesson-003.md` 移到 `lessons/unit-a/custom-name.md`，同时更新 Plan 链接。断言 factory 收到：

```ts
expect(created.map(({ role, ownerId, ownerPath }) => ({ role, ownerId, ownerPath })))
  .toEqual([
    { role: 'coach', ownerId: 'domain-integrity', ownerPath: 'plans/domain-integrity.md' },
    { role: 'tutor', ownerId: 'lesson-003', ownerPath: 'lessons/unit-a/custom-name.md' },
  ]);
```

再断言注入资源包含准确行：

```text
Current Plan file: plans/domain-integrity.md
Current Lesson file: lessons/unit-a/custom-name.md
```

- [ ] **Step 2: 运行测试并确认因 `ownerPath` 缺失而失败**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-scope.test.ts tests/runtime/workspace-registry.test.ts
```

- [ ] **Step 3: 实现 scope 与资源上下文**

`formatSessionOwnerContext` 只格式化 runtime 已解析路径：

```ts
export function formatSessionOwnerContext(root: string, scope: StudySessionScope): string {
  const owner = scope.role === 'coach'
    ? `Current Coach: ${scope.ownerId}\nCurrent Plan file: ${scope.ownerPath}`
    : `Current Tutor: ${scope.ownerId}\nCurrent Lesson file: ${scope.ownerPath}`;
  return `Learning set root: ${root}\n${owner}`;
}
```

`WorkspaceRegistry.openCoach` 使用 `snapshot.plan.path`；`openTutor` 使用找到的 `lesson.path`。禁止从 ID 拼接 Markdown 路径。

- [ ] **Step 4: 运行定向回归并提交**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-scope.test.ts tests/runtime/workspace-registry.test.ts tests/runtime/session-factory.test.ts
bun run typecheck

git add src/runtime/session-scope.ts src/runtime/session-factory.ts src/runtime/resource-loader.ts src/runtime/workspace-registry.ts tests/runtime/session-scope.test.ts tests/runtime/workspace-registry.test.ts
git commit -m "refactor: bind sessions to workspace owner paths"
```

Expected: PASS；提交不包含学习集运行文件。

---

### Task 2: 收窄 Tutor 写入并增加原子 `lesson_close`

**Lane:** A
**Depends on:** Task 1

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/lesson-close.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/classroom-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: Tutor Agent/Skill and runtime/write tests

**Final Tutor-facing base contracts before Task 8 adds `methods`:**

```ts
trace_append({
  blockId,
  cardAlias?,
  materialPath?,
  assessment,
  support,
  note,
  supersedes?,
});

classroom_update({
  action: 'activate' | 'complete' | 'skip' | 'route' | 'pause',
  blockId?, routeAction?, before?, after?, reason?, source?,
});

lesson_close({ reflection, summary });
```

- [ ] **Step 1: 写 schema 与角色边界失败测试**

断言 Tutor 的三个 schema 均不含 `lessonPath`；`trace_append` 不含 `cardStepId`；`classroom_update` 不含 `close`、`reflection`、`summary`；`lesson_close` 只有两个非空字段。Coach 不可见 `lesson_close`。

- [ ] **Step 2: 写一次落盘的关闭测试**

正常关闭必须在一次最终 `write(...)` 前完成全部纯字符串变换：唯一 active reflection Block → completed，`## Reflection`、`## Lesson Summary` 更新，frontmatter → `closed`。任一固定 section 缺失时抛错且文件字节完全不变。

- [ ] **Step 3: 运行失败测试**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts tests/study/write-workspace.test.ts
```

- [ ] **Step 4: 把 writer 改为纯变换后单次写入**

实现内部纯函数：

```ts
replaceFrontmatterField(source, path, key, value): string;
replaceBlockStatus(source, blockId, status): string;
replaceSection(source, heading, value): string;
activeReflectionBlockId(source): string;
```

`closeLesson` 只在所有变换成功后调用一次 `write(document.absolute, source)`。不要先写 Reflection 再调用第二次 frontmatter writer。

- [ ] **Step 5: 使用闭包 ownerPath 注册窄工具**

```ts
createClassroomUpdateTool(root, scope.ownerPath);
createLessonCloseTool(root, scope.ownerPath);
```

底层 `appendTraceWithProjection` 暂时固定 `cardStepId: null`，Lesson 路径使用 `scope.ownerPath`。

- [ ] **Step 6: 同步 Tutor 关闭顺序**

Skill 明确：学生确认结束 → 如有已接受异议先写 superseding Trace → 激活/完成 Reflection Block → 调用一次 `lesson_close` → 停止。不得再通过 `classroom_update close`。

- [ ] **Step 7: 回归并提交**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts tests/study/write-workspace.test.ts tests/runtime/workspace-registry.test.ts
bun run typecheck
git add src/runtime/lesson-close.ts src/runtime/study-tools.ts src/runtime/classroom-update.ts src/runtime/session-factory.ts src/study/write-workspace.ts resources/agents/tutor.md resources/skills/tutor-lesson/SKILL.md tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts tests/study/write-workspace.test.ts
git commit -m "feat: bind tutor writes to the lesson session"
```

---

### Task 3: 让 Trace 保存规范化的实际方法

**Lane:** B
**Depends on:** Task 0

**Files:**

- Create: `plugins/highschool-study/server/src/method-vocabulary.ts`
- Create: `plugins/highschool-study/tests/integration/method-vocabulary.test.ts`
- Modify: `plugins/highschool-study/server/src/traces.ts`
- Modify: `plugins/highschool-study/server/src/domain.ts`
- Modify: `plugins/highschool-study/server/src/mcp/register-tools.ts`
- Modify: Trace/MCP/domain contract tests

**Types:**

```ts
export type TraceMethods = {
  primary: string;
  secondary: string[];
};

export type TraceMethodInput = {
  primary: string;
  secondary?: string[];
};

// TraceRecord
methods: TraceMethods | null;

// TraceAppendInput
methods?: TraceMethodInput | null;
```

- [ ] **Step 1: 写 vocabulary 解析失败测试**

覆盖两种仓库已有格式：

1. `highschool-study.taxonomy.v1` 的 `nodes[]`：接受 facet `method_cluster` / `method_subroute` 的 `canonical_name` 与节点内 aliases。
2. 导数学习集的 `method_clusters[]`：接受列表值为规范节点；`aliases.yaml` 只有在 `maps_to` 的 method 目标已经存在且唯一时才可解析。

断言：规范名原样返回；`冻元法` → `冻结变量法`；主次重复后只保留主方法；任一名称未解析时整个 methods 绑定省略并返回未解析名称，不阻断 Trace。

- [ ] **Step 2: 运行失败测试**

```bash
cd plugins/highschool-study
bun test tests/integration/method-vocabulary.test.ts tests/integration/trace-records.test.ts
```

- [ ] **Step 3: 实现最小 resolver**

```ts
export type MethodResolution = {
  methods: TraceMethods | null;
  unresolved: string[];
};

export function resolveTraceMethods(
  root: string,
  input: TraceMethodInput | null | undefined,
): MethodResolution;
```

resolver 只做 exact canonical/alias lookup、去重和规范名输出；不读学生答案、不做关键词猜测、不计算相似度。alias 同时指向多个合法 method 节点时视为 unresolved，要求 Tutor 读取 boundary 后提交具体规范名。

- [ ] **Step 4: 持久化实际方法并兼容历史空字段**

Trace Markdown 新增可选行：

```text
Primary method: 参变量分离
Secondary methods: ["导数研究单调性"]
```

历史 Trace 没有这些行时解析为 `methods: null`。二级方法使用 JSON 数组编码，禁止逗号拆分中文名称。

`appendTrace` 返回：

```ts
{
  eventId: string;
  lessonPath: string;
  sourceAnchor: string;
  methods: TraceMethods | null;
  unresolvedMethods: string[];
}
```

即使 `unresolvedMethods` 非空，assessment/support/note 仍写入，methods 为 null。

- [ ] **Step 5: 扩展公共 MCP 的可选 `methods`**

MCP 只增加：

```ts
methods: z.object({
  primary: z.string(),
  secondary: z.array(z.string()).optional(),
}).strict().optional()
```

不在此任务改变公共 MCP 的 `lessonPath` / `cardStepId`，也不新增另解写入 MCP。

- [ ] **Step 6: 覆盖错误但路线明确、历史空字段与 supersede**

测试至少包括：

- `assessment: incorrect` 仍保存合法 methods；
- 未解析方法不阻断 Trace；
- superseding Trace 的实际方法独立于旧 Trace；
- 历史 Trace 不从题卡补方法；
- MCP JSON 与 structuredContent 一致。

- [ ] **Step 7: 回归并提交**

```bash
cd plugins/highschool-study
bun test tests/integration/method-vocabulary.test.ts tests/integration/trace-records.test.ts tests/contract/mcp-tools.test.ts tests/contract/domain-export.test.ts
bun run typecheck
git add server/src/method-vocabulary.ts server/src/traces.ts server/src/domain.ts server/src/mcp/register-tools.ts tests/integration/method-vocabulary.test.ts tests/integration/trace-records.test.ts tests/contract/mcp-tools.test.ts tests/contract/domain-export.test.ts
git commit -m "feat: record actual methods on learning traces"
```

---

### Task 4: 统一 `safe | raw-stream` 实时与历史消息投影

**Lane:** C
**Depends on:** Task 0 and Task 1（Task 1 完成后接管 `workspace-registry.ts`）

**Files:**

- Create: `apps/pi-teaching-web/src/projection/message-policy.ts`
- Create: `apps/pi-teaching-web/tests/projection/message-policy.test.ts`
- Modify: `projection/projector.ts`、`runtime/workspace-registry.ts`、`server/index.ts`、`server/app.ts`、README 与 projection/server tests

**Types:**

```ts
export type MessageProjectionMode = 'safe' | 'raw-stream';

parseMessageProjectionMode(value: string | undefined): MessageProjectionMode;
visibleAssistantText(content: unknown, mode: MessageProjectionMode): string | null;
projectStoredMessage(key, raw, index, mode): ChatMessage | null;
```

- [ ] **Step 1: 写默认 safe 的失败测试**

断言：

- 未配置 → `safe`；非法值抛 `INVALID_MESSAGE_PROJECTION`；
- assistant message 同时含 text 与 toolCall 时，safe 返回 null；raw-stream 返回 text；
- 纯文本在两种模式都可见；
- safe 不投影 `text_delta`；raw-stream 保留 delta；
- tool result/arguments 永远不进入 ChatMessage。

- [ ] **Step 2: 运行 projection 失败测试**

```bash
cd apps/pi-teaching-web
bun test tests/projection/message-policy.test.ts tests/projection/projector.test.ts
```

- [ ] **Step 3: 实现同一个最终分类器**

实时 `message_end` 和 `WorkspaceRegistry.history` 必须共同调用 `visibleAssistantText`；不能各自复制判断。safe 模式只在完整 `message_end` 后投影纯文本 assistant message。

- [ ] **Step 4: 接通配置**

优先级：CLI `--message-projection` → `STUDYFORGE_MESSAGE_PROJECTION` → `safe`。`createRequestHandler`、实时 projector、history、replay 使用同一个解析结果。

- [ ] **Step 5: 增加安全 work-status 标签**

`lesson_close`、`plan_update` 以及稍后注册的 `card_alternative_append` 只显示中文状态标签，不显示参数、Reflection、Summary、另解正文或内部证据矩阵。此处提前登记另解工具 label，Task 8 不再修改 projector。

- [ ] **Step 6: 回归并提交**

```bash
cd apps/pi-teaching-web
bun test tests/projection/message-policy.test.ts tests/projection/projector.test.ts tests/runtime/workspace-registry.test.ts tests/server/workspace-api.test.ts
bun run typecheck
git add src/projection/message-policy.ts src/projection/projector.ts src/runtime/workspace-registry.ts src/server/index.ts src/server/app.ts README.md tests/projection/message-policy.test.ts tests/projection/projector.test.ts tests/runtime/workspace-registry.test.ts tests/server/workspace-api.test.ts
git commit -m "feat: add safe student message projection"
```

---

### Task 5: 增加 Session-bound Coach `plan_update`

**Lane:** A
**Depends on:** Task 2

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/plan-update.ts`
- Modify: `session-factory.ts`、`study/write-workspace.ts`、Coach Agent/Skill 与相关 tests

**Contract:**

```ts
plan_update({
  decision: 'active' | 'complete' | 'replan',
  lessonIndex: string,
  currentPosition: string,
  nextLessonCandidate: string,
  planSummary: string,
});
```

- [ ] **Step 1: 写扁平 schema 与原子写入失败测试**

断言 schema 只有上述五个字段，不含 `planPath`、`edits`、`oldText`。缺少任一固定 Plan section 时文件字节不变。`complete` → frontmatter `completed`；`active/replan` → `active`。

- [ ] **Step 2: 运行失败测试**

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts
```

- [ ] **Step 3: 实现一次写入的 `updatePlan`**

```ts
export type PlanUpdateInput = {
  decision: 'active' | 'complete' | 'replan';
  lessonIndex: string;
  currentPosition: string;
  nextLessonCandidate: string;
  planSummary: string;
};
```

先在内存替换 `Lesson Index`、`Current Position`、`Next Lesson Candidate`、`Plan Summary` 和 frontmatter，全部成功后只写一次。

- [ ] **Step 4: 注册 Coach-only 工具**

`createPlanUpdateTool(root, scope.ownerPath)`；Coach 保留 `write/edit` 用于备课，但最终审计必须调用 `plan_update`。Tutor 不可见此工具。

- [ ] **Step 5: 固定写后重读协议**

Agent 与 Skill 必须按顺序包含：private evidence matrix → `plan_update once` → `read` injected Current Plan file → 只依据重读结果回复。不得把内部矩阵发给学生。

- [ ] **Step 6: 回归并提交**

```bash
cd apps/pi-teaching-web
bun test tests/study/write-workspace.test.ts tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts tests/runtime/workspace-registry.test.ts
bun run typecheck
git add src/runtime/plan-update.ts src/runtime/session-factory.ts src/study/write-workspace.ts resources/agents/coach.md resources/skills/coach-study/SKILL.md tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts tests/study/write-workspace.test.ts
git commit -m "feat: add session-bound plan updates"
```

---

### Task 6: 用实际方法投影能力并实现 active Trace 题卡另解

**Lane:** B
**Depends on:** Task 3

**Files:**

- Create: `plugins/highschool-study/server/src/alternatives.ts`
- Create: `plugins/highschool-study/tests/integration/card-alternatives.test.ts`
- Modify: `method-signals.ts`、`cards.ts`、`trace-search.ts`、`domain.ts` 与相关 tests

- [ ] **Step 1: 先把 method-signal 测试改成实际方法事实**

fixture Trace 显式带 `methods`。新增断言：

- 题卡声明“同构变形与换元法”，Trace 主方法“参变量分离”时，只投影后者；
- 无 methods 的历史 Trace 产生零个方法信号；
- incorrect + 明确 methods 产生 earnedWeight 0 的失败证据；
- 同 attempt 多条 Trace 的同节点只计一次；任一 Trace 作为 primary 时按 primary 权重；
- `attemptCount` 每个 `lessonPath + blockId + cardPath` 最多加 1；`distinctCardCount` 仍按不同 cardPath。

- [ ] **Step 2: 运行失败测试**

```bash
cd plugins/highschool-study
bun test tests/integration/method-signals.test.ts
```

- [ ] **Step 3: 改写 attempt 的方法集合**

```ts
type CardAttempt = {
  cardPath: string;
  factors: number[];
  methods: Map<string, 'primary' | 'secondary'>;
  sourceRefs: string[];
};
```

不再调用 `readCard(...).methods` 补全方法。每条 Trace 的 primary 覆盖同 attempt 中该节点的 secondary；每个节点每 attempt 只生成一次信号。保留现有 assessment/support factor 与权重常量。

- [ ] **Step 4: 写另解真实性 fence 的失败测试**

覆盖：

- active + correct + card-bound Trace 可写；
- inactive、incorrect、cardless Trace 拒绝；
- 单问题只接受“整题”；多问题接受可解析具体 part，保存时使用规范题问；
- 同 `(sourceAnchor, question)` 重试原地更新，不重复章节；
- methods 为空时标题为“未归类方法”；
- supersede 后文件仍保留历史章节，但普通读取不返回旧另解。

- [ ] **Step 5: 实现旁挂 Markdown**

```ts
export type CardAlternative = {
  cardPath: string;
  sourceTrace: string;
  question: string;
  primaryMethod: string | null;
  secondaryMethods: string[];
  solution: string;
  recordedAt: string;
};

export function appendCardAlternative(
  root: string,
  lessonPath: string,
  input: { sourceTraceId: string; question: string; solution: string },
  now: () => Date,
): CardAlternative;

export function readActiveCardAlternatives(
  root: string,
  cardPath: string,
  activeTraces?: TraceRecord[],
): CardAlternative[];
```

旁挂路径把 `.card.yaml`、`.card.yml`、`.yaml` 或 `.yml` 结尾替换为 `.alternatives.md`。每节使用 runtime 生成的 source Trace + question 作为机器身份，可用稳定 HTML comment 保存这两个值；不得让模型填写额外 ID。

可读正文格式：

```markdown
# 生成另解

<!-- studyforge-alternative source="lessons/lesson-003.md#trace-event-006" question="整题" -->
## 参变量分离

来源：[lesson-003 / event-006](../../lessons/lesson-003.md#trace-event-006)

题问：整题
方法：参变量分离
次方法：导数研究单调性

### 解法

完整推导……
```

- [ ] **Step 6: 扩展 CardContent 与双向读取**

`CardContent` 增加从顶层 `parts[].part_id` 读取的 `parts: string[]`。`CardHit` 增加 `alternatives`。`trace_search.cardsByPath[path]` 返回与 `card_search` 同结构的 CardHit：原始题卡、完整 active traceHistory、active alternatives。

读取时一次构建 active Trace index；不要为每张卡重复扫描全部 Lesson。

- [ ] **Step 7: 回归并提交**

```bash
cd plugins/highschool-study
bun test tests/integration/method-signals.test.ts tests/integration/card-alternatives.test.ts tests/integration/bidirectional-search.test.ts tests/contract/mcp-tools.test.ts tests/e2e/markdown-learning-loop.test.ts
bun run typecheck
git add server/src/alternatives.ts server/src/method-signals.ts server/src/cards.ts server/src/trace-search.ts server/src/domain.ts tests/integration/card-alternatives.test.ts tests/integration/method-signals.test.ts tests/integration/bidirectional-search.test.ts tests/contract/mcp-tools.test.ts tests/e2e/markdown-learning-loop.test.ts
git commit -m "feat: project actual methods and attach trace alternatives"
```

---

### Task 7: 成功 Trace 后推送完整能力快照

**Lane:** C
**Depends on:** Task 4

**Files:**

- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: server/client/E2E fixture tests

**Event:**

```ts
| {
    type: 'ability-update';
    projection: AbilityProjection;
  }
```

- [ ] **Step 1: 写事件顺序失败测试**

在 server test 捕获 `registry.subscribe` listener，分别注入：

1. 成功 `trace_append` tool end；期望 `work-status: done` 后恰好一个完整 `ability-update`，含 score/evidenceCount/sources。
2. 失败 `trace_append`；无能力事件。
3. 成功非 Trace 工具；无能力事件。

为测试给 `AppDependencies` 增加可选 `readAbilityProjection` 注入；生产默认仍使用真实 reader。

- [ ] **Step 2: 运行失败测试**

```bash
cd apps/pi-teaching-web
bun test tests/server/workspace-api.test.ts tests/client/state.test.ts
```

- [ ] **Step 3: 在同一订阅回调发布快照**

顺序必须是：

```ts
for (const projected of projectSessionEvent(key, event, mode)) hub.publish(projected);
if (
  event.type === 'tool_execution_end'
  && event.toolName === 'trace_append'
  && !event.isError
) {
  hub.publish({ type: 'ability-update', projection: abilityReader(root) });
}
```

supersede 仍走相同 `trace_append` 成功路径。

- [ ] **Step 4: 客户端直接替换独立 state**

WebSocket handler 在调用通用 reducer 外增加：

```ts
if (event.type === 'ability-update') setAbilities(event.projection);
```

打开 Plan 时保留一次 `GET /api/abilities` 初始读取；不把 abilities 搬进聊天 reducer。

- [ ] **Step 5: E2E 证明 Tutor 页面收到、返回 Coach 可见**

fixture 在模拟成功 Trace 后发布一个含测试方法节点的完整 projection。测试在 Tutor 页面触发后返回 Coach，无刷新即可看到新节点和 evidenceCount。

- [ ] **Step 6: 回归并提交**

```bash
cd apps/pi-teaching-web
bun test tests/server/workspace-api.test.ts tests/study/ability.test.ts
bun run test:e2e -- --grep "ability"
bun run typecheck
git add src/shared/contracts.ts src/server/app.ts src/client/App.tsx tests/server/workspace-api.test.ts tests/e2e/fixture-server.ts tests/e2e/workspace.spec.ts
git commit -m "feat: refresh ability projection after traces"
```

---

### Task 8: 接通 Tutor 实际方法、另解与替代路线教学协议

**Lane:** A/B integration
**Depends on:** Task 4, Task 5 and Task 6

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/card-alternative-append.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: Pi Tutor Agent/Skill
- Modify: Plugin `skills/run-lesson/SKILL.md` 与相关 contract tests

- [ ] **Step 1: 写最终 Tutor schema 失败测试**

`trace_append` 在 Task 2 基础上增加当前学习集动态规范方法枚举：

```ts
const methodName = Type.Enum(listCanonicalMethodNames(root));
methods: Type.Optional(Type.Object({
  primary: methodName,
  secondary: Type.Optional(Type.Array(methodName)),
}))
```

新增 Tutor-only：

```ts
card_alternative_append({
  sourceTraceId: string,
  question: string,
  solution: string,
});
```

断言两个工具都使用 Session `ownerPath`，模型不填写 lesson/card/graph path；Coach 不可见另解写入工具。

- [ ] **Step 2: 运行失败测试**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts
```

- [ ] **Step 3: 接通 domain adapter**

`trace_append` 原样把 optional methods 传给 `appendTraceWithProjection`，并把 `unresolvedMethods` 返回 Tutor。合法 primary 不因非法 secondary 丢失；若存在未解析项，Tutor 只能在语义确证时用规范名称写 superseding Trace，否则保持未绑定。`card_alternative_append` 闭包调用：

```ts
appendCardAlternative(root, scope.ownerPath, input, now);
```

工具错误只阻断另解沉淀，不回滚来源 Trace。Task 4 已为此工具登记“正在整理可追溯另解”的 work-status；不得投影 solution。

- [ ] **Step 4: 把“先验证替代路线”写成字面 contract**

Pi Tutor Skill 与插件 `run-lesson` 都必须包含并由测试逐字断言以下语义：

```text
Before rejecting a non-reference route, reconstruct the student's complete chain and verify every decisive implication.
If the route is complete and correct, state that it is correct and stop; do not automatically present, compare, or pivot to the reference solution.
Give a hint, compare methods, or show a complete reference solution only when the student explicitly requests that action.
```

这只强化 Prompt；不得新增拦截器或“学生同意”字段。

- [ ] **Step 5: 写实际方法与真正另解协议**

Tutor 必须分别判断 correctness/support/actual methods。路线清楚但做错也写 methods；无法匹配规范节点时省略 methods，不歪曲 assessment。

只有某一问的入口、决定性推理和收束链条形成一条完整、正确且与原解和已有 active alternatives 完全不同的核心推理链，才写另解。以下明确不算：换记号、改写措辞、拆并步骤、等价步骤重排、局部计算技巧、只换方法名。多问题只保存发生变化的那一问。

顺序：先写 Trace → 使用返回 eventId 调用 `card_alternative_append` → 再向学生确认这是另解。若到后续比较轮次才确认，也必须补写后再回复。学生首次作答前不得显示 methods、另解标题、摘要或推导。

- [ ] **Step 6: 保留异议 supersede 协议并增强测试**

断言 Agent/Skill 仍含：接受学生异议后先写 superseding Trace，再写 Reflection/Summary；后续只依据 active evidence。不要增加运行时裁判。

- [ ] **Step 7: 同步 Coach 事实边界**

Coach Skill 不得把题卡参考方法当作学生实际方法。题卡 methods 只用于备课结构；能力与学生表现必须来自 Trace methods 的 projection。Coach 可私下读取 active alternatives，但不得放入学生的无剧透 Lesson outline。

- [ ] **Step 8: 回归并提交**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/study-tools.test.ts tests/runtime/session-factory.test.ts tests/projection/projector.test.ts
bun run typecheck

cd ../../plugins/highschool-study
bun test tests/contract/agent-and-skills.test.ts tests/contract/domain-export.test.ts
bun run typecheck

cd ../..
git add apps/pi-teaching-web/src/runtime/card-alternative-append.ts apps/pi-teaching-web/src/runtime/study-tools.ts apps/pi-teaching-web/src/runtime/session-factory.ts apps/pi-teaching-web/resources/agents/tutor.md apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/resources/agents/coach.md apps/pi-teaching-web/resources/skills/coach-study/SKILL.md apps/pi-teaching-web/tests/runtime/study-tools.test.ts apps/pi-teaching-web/tests/runtime/session-factory.test.ts plugins/highschool-study/skills/run-lesson/SKILL.md plugins/highschool-study/tests/contract/agent-and-skills.test.ts
git commit -m "feat: teach and preserve verified alternative methods"
```

---

### Task 9: 用浏览器 URL 恢复 Plan/Lesson 与 Session

**Lane:** C
**Depends on:** Task 7

**Files:**

- Create: `apps/pi-teaching-web/src/client/routes.ts`
- Create: `apps/pi-teaching-web/tests/client/routes.test.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: server/client/E2E tests

**Routes:**

```ts
export type BrowserRoute =
  | { kind: 'home' }
  | { kind: 'coach'; planId: string }
  | { kind: 'lesson'; planId: string; lessonId: string };

parseBrowserRoute(pathname: string): BrowserRoute | null;
formatBrowserRoute(route: BrowserRoute): string;
```

- [ ] **Step 1: 写纯路由 round-trip 失败测试**

覆盖 `/`、Coach、Lesson；中文/空格 ID；空 ID、多余片段、非法 URI decode 返回 null。

- [ ] **Step 2: 运行失败测试**

```bash
cd apps/pi-teaching-web
bun test tests/client/routes.test.ts
```

- [ ] **Step 3: 实现窄 parser/formatter**

只接受三种完整路径，使用 `encodeURIComponent` / `decodeURIComponent`。不要容忍尾随垃圾或猜测对象。

- [ ] **Step 4: 让 history endpoint 恢复 live Session**

`GET /api/sessions/:key/history` 在读取前：Coach 调 `openCoach(planId)`；Tutor 调 `openTutor(lessonId)`，因此只适用于 active/paused Tutor。随后 `bind(key)` 并使用 Task 4 的同一 projection mode 返回 history。prepared 不调用 history；closed/abandoned 继续走 replay。

- [ ] **Step 5: 统一一个异步 `openRoute`**

App 首次加载、点击导航和 `popstate` 都调用同一加载函数：

- home：清空 workspace/selection；
- coach：读 workspace + Coach history；
- lesson：先读 URL 指定 Plan workspace，确认 Lesson 属于此 Plan；prepared 只显示 gate，active/paused 读 history，closed/abandoned 走现有 replay effect。

只有目标数据成功加载后，用户点击才 `pushState`。初始恢复/popstate 不写 history。

- [ ] **Step 6: 处理自动关闭与无效深链**

手动返回 Coach 使用 push。若 websocket snapshot 自动把已关闭 Tutor 选择收束为 Coach，而当前 URL 仍是 lesson，则 effect 使用 `replaceState('/plan/:planId')`，避免后退重新进入已关闭活动课堂。

无效 shape/Plan/Lesson/跨 Plan Lesson：清空 workspace，`replaceState('/')`，显示短错误，保留学习集首页。不自动打开第一项。

- [ ] **Step 7: 写浏览器恢复验收**

Playwright 覆盖：

- 首页 → Plan → prepared/active/closed Lesson 的 URL；
- 三类页面刷新后视图不变；
- back/forward 与侧边栏等价；
- 自动关闭 replace 为 Coach；
- 无效和跨 Plan 深链回首页；
- 现有 `/plan/...` shell 测试继续通过。

- [ ] **Step 8: 回归并提交**

```bash
cd apps/pi-teaching-web
bun test tests/client/routes.test.ts tests/server/workspace-api.test.ts tests/runtime/workspace-registry.test.ts
bun run test:e2e
bun run typecheck
git add src/client/routes.ts src/client/App.tsx src/server/app.ts src/runtime/workspace-registry.ts tests/client/routes.test.ts tests/server/workspace-api.test.ts tests/runtime/workspace-registry.test.ts tests/e2e/fixture-server.ts tests/e2e/workspace.spec.ts
git commit -m "feat: restore teaching sessions from browser routes"
```

---

### Task 10: 三线全量自动验证与静态审计

**Depends on:** Task 8 and Task 9

- [ ] **Step 1: Pi Web 全量检查**

```bash
cd apps/pi-teaching-web
bun run typecheck
bun run test
bun run build
bun run test:e2e
```

Expected: 全部 exit 0。

- [ ] **Step 2: Plugin 全量检查**

```bash
cd plugins/highschool-study
bun run check
bun run validate:plugin
```

Expected: 全部 exit 0。

- [ ] **Step 3: 审计旧 Tutor 参数与错误能力来源**

```bash
rg -n "lessonPath|cardStepId|action.*close|CLOSE_REQUIRES" \
  apps/pi-teaching-web/src/runtime \
  apps/pi-teaching-web/resources/agents \
  apps/pi-teaching-web/resources/skills/tutor-lesson

rg -n "readCard\(|card\.methods" plugins/highschool-study/server/src/method-signals.ts
```

Expected: Tutor-facing TypeBox/Prompt 不要求路径、step 或 classroom close；底层 details/adapter 的真实路径允许存在；method signal 不从 card methods 归因学生。

- [ ] **Step 4: 审计所有新契约均有 writer、reader 与测试**

```bash
rg -n "ownerPath|lesson_close|plan_update|messageProjection|raw-stream|methods|card_alternative_append|ability-update|popstate|pushState|replaceState" \
  apps/pi-teaching-web/src apps/pi-teaching-web/resources apps/pi-teaching-web/tests \
  plugins/highschool-study/server/src plugins/highschool-study/tests
```

Expected: 每个契约都有生产路径和测试；不存在只声明未消费的 `ability-update`。

- [ ] **Step 5: 检查提交与用户文件隔离**

```bash
git log --oneline -12
git status --short
```

Expected: Tasks 1–9 各自提交；status 只保留用户原有未提交文件。Task 10 不创建“修测试”混合提交；若发现失败，回到所属 Task lane 修复并追加该 lane 的小提交。

---

### Task 11: 导数学习集真实模型闭环验收

**Depends on:** Task 10

**Files:**

- Create: `docs/audits/2026-07-22-teaching-runtime-closure-acceptance.md`
- Do not modify: repository `examples/derivative-demo/learning-set/**`

- [ ] **Step 1: 创建隔离副本并启动默认 safe runtime**

```bash
RUNTIME_ROOT="$(mktemp -d /tmp/studyforge-runtime-closure-20260722-XXXXXX)"
rsync -a --exclude .git /Users/yangrundong/Documents/GitHub/highschool-study-claude-code/ "$RUNTIME_ROOT/"
cd "$RUNTIME_ROOT/apps/pi-teaching-web"
bun run start -- --learning-set ../../examples/derivative-demo/learning-set --port 65001
```

不得在命令、日志或报告打印 provider key。

- [ ] **Step 2: 验收 Session-bound Tutor 与异议纠正**

完成一节真实 Lesson：至少两次证据作答、一次学生异议被 Tutor 接受、一次 superseding Trace、一次 Block 推进、学生确认结束、一次 `lesson_close`。

必须满足：Tutor arguments 无 `lessonPath/cardStepId`；accepted objection 先 supersede 后 Summary；工具参数错误/重试为 0；Lesson 一次关闭后 Reflection Block、Reflection、Summary 和 frontmatter 一致。

- [ ] **Step 3: 验收替代路线教学行为**

让学生提交一条不同于参考解的路线。分别覆盖：

1. 路线正确：Tutor 先验证并承认，未被请求时不主动倾倒标准解或比较方法。
2. 学生随后明确请求比较：Tutor 才私下读取参考/active alternatives 并比较。
3. 只做同链改写：不写另解。
4. 至少一问核心链完全不同：Trace 写实际 methods，随后写对应题问另解，最后才向学生确认；后续比较轮次才确认时同样补写。

- [ ] **Step 4: 验收能力归因与实时刷新**

目标场景：题卡参考主方法“同构变形与换元法”，学生实际主方法“参变量分离”，次方法为真实使用节点，assessment correct/support none。

必须满足：只给实际节点加证据；题卡参考方法不自动加分；同 attempt 多 Trace 只计一次；无需刷新，返回 Coach 即看到新 ability projection。

- [ ] **Step 5: 验收 Coach 写回与 safe projection**

Coach 最终审计只调用一次 `plan_update`，随后 read 当前 Plan，再回复。页面不显示内部矩阵、工具旁白、另解 solution 或 stringified arguments；Pi JSONL 仍完整保存原始事件。

- [ ] **Step 6: 验收 URL 恢复**

在 Coach、prepared Lesson、active/paused Tutor、closed replay 页面分别刷新；前进/后退；自动结课返回 Coach；测试无效和跨 Plan 深链。结果须符合 Task 9。

- [ ] **Step 7: 写来源可追溯的验收报告并提交**

报告记录：临时 root、使用的 Plan/Lesson/Card、Session JSONL 路径、Trace anchors、旁挂另解路径、Plan/Lesson 最终路径、每项 pass/fail 与发现的问题。不得粘贴凭据或完整私密 chain-of-thought。

```bash
git add docs/audits/2026-07-22-teaching-runtime-closure-acceptance.md
git commit -m "docs: verify teaching runtime closure"
```

---

## Final Completion Gate

只有同时满足以下条件才可宣告计划完成：

- attempt 聚合仍按一次真实 card attempt，而非 Trace 行；
- 学生正确性、实际方法、题卡参考方法、生成另解各有唯一事实来源；
- accepted objection 的 superseding Trace 能立即影响能力与另解可见性；
- Tutor 无路径/step/close 参数猜测，Coach 无多段 edit 重试；
- 正确替代路线不会触发未请求的标准解倾倒；
- safe 页面不泄漏内部矩阵/工具旁白，raw JSONL 保留；
- Trace 后能力图无需刷新页面；
- URL 刷新、深链、前进/后退均恢复正确 Plan/Lesson；
- Pi Web、插件、Playwright 与真实模型验收全部通过；
- 用户原有学习集运行文件未被计划提交污染。
