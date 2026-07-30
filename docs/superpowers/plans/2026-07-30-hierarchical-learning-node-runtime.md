# 层级学习节点运行时重构 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把 Roadmap、Plan、Lesson 从线性 Markdown 列表升级为真正具备父子控制权、节点化上下文、全局 Trace、三层 Handoff 和长期记忆晋升路径的学习编排树，同时保留现有教学 Frame、积木式课堂和四工具公共 MCP。

**Architecture:** 共享 Markdown domain 负责节点树、全局 Trace 和 Handoff 的确定性契约；Pi Runtime 负责候选物化、原子激活、Session Owner、上下文页表、文件权限和受信任写入；Agent 只提交教学判断、候选内容和 Handoff 草稿。`ROADMAP.md / ## Plan Tree`、`plans/<id>.md / ## Lesson Tree`、`lessons/<id>.md / ## Block` 是唯一节点结构，`traces/<trace-id>.md` 是学习集级追加式事实池。父节点向下交付冻结 Activation Snapshot，子节点向上封存带来源 Handoff；前端只投影公开树、上下文页和证据下钻，不拥有学习事实。

**Tech Stack:** Bun 1.3.14、TypeScript 7、React 19、TypeBox 1.3.6、Zod 4.4、Pi 0.81、Markdown/YAML、Playwright 1.61、Claude Code plugin/MCP。

## Global Constraints

- 设计权威为 `docs/superpowers/specs/2026-07-30-hierarchical-learning-node-runtime-design.md`。
- 不增加数据库、向量库、后台索引、队列、调度器、通用 DAG 引擎、规则引擎或自动 mastery 判决。
- Claude Code 插件公共 MCP 始终只有 `card_search`、`trace_search`、`trace_append`、`source_resolve` 四个工具。
- 新运行时只读 `## Plan Tree`、`## Lesson Tree` 和全局 `traces/`；不双读、不迁移、不猜测旧 `Plan Graph`、`Lesson Index` 或 Lesson 内 `## Traces`。
- Candidate 只有父文档中的运行时句柄，没有文件和 Session；Plan、Lesson、Block、Trace、Handoff 和 Claim 的持久 ID 均由 Runtime 分配。
- 模型不能填写或覆盖 `ownerPath`、父路径、Session ID、节点路径、时间戳、Trace ID、Handoff ID 或 Claim ID。
- 已 active 的子节点由自己拥有；父节点只能修改 candidate 或 prepared 子节点。terminal 节点对 Agent 只读。
- Lesson 明确关课永远优先于 Handoff、Reflection 或格式错误；Claim 无效时关闭并生成 source-only Handoff。
- Skill 与 Agent 文本不写逐句、关键词或快照测试；只测试 schema、权限、持久化、投影和真实模型行为。
- 保留现有 Teaching Core、洞见式一次一问、六类课堂模板、多题角色、Student View / Teacher Control、`zero / ladder / worked-example` 和 Tutor 的“听懂—判断—介入—再观察”循环。
- 当前主工作区已有其他未提交改动。执行本计划前必须使用 `superpowers:using-git-worktrees` 从“包含这些既有修复的、用户确认过的干净基线”创建 `codex/hierarchical-node-runtime`；不得把现有脏文件顺手纳入本重构提交。
- 每个任务只提交该任务列出的文件；每次提交前运行定向测试和 `git diff --check`。

## Dependency Order

```text
共享 Node Tree
  ├── 全局 Trace Pool
  ├── Handoff 契约
  └── Activation Blueprint
          ↓
Markdown 读取切换
          ↓
父节点物化工具
          ↓
原子激活与 Session Owner
          ↓
Context / Allowlist / Tool 权限
          ↓
Block、Trace、关课、记忆闭环
          ↓
Prompt / Skill
          ↓
前端投影、学习集迁移、完整验收
```

---

## Task 1: 建立共享 Node Tree 契约

**Files:**

- Create: `plugins/highschool-study/server/src/learning-nodes.ts`
- Modify: `plugins/highschool-study/server/src/domain.ts`
- Create: `plugins/highschool-study/tests/unit/learning-nodes.test.ts`

- [ ] **Step 1: 先写 Candidate、Child 和拒绝旧区段的失败测试**

测试以下规范区段：

```markdown
## Lesson Tree

### Candidate lesson-candidate-001

- Public purpose: 比较两条路线的计算代价
- After:
- Depends on:
- Consider when: 学生能提出两条路线但仍无法稳定取舍
- Sources:
  - claim:lesson-002/handoff#learner-c1
- Private note: 保持题型不变，只改变路线成本差

### Child lesson-candidate-002

- Node: [陌生结构中的路线选择](../lessons/lesson-003.md)
- Public purpose: 在陌生外壳下先比较路线再计算
- After: lesson-candidate-001
- Depends on: lesson-candidate-001
- Consider when: 前一课已经完成同题型比较
- Sources:
  - claim:lesson-002/handoff#teaching-t1
- Private note: 不在课前公开候选方法名
```

断言：

```ts
const tree = parseChildTree(body, 'Lesson Tree', 'lesson', 'plans/plan-001.md');
expect(tree.entries[0]?.state).toBe('candidate');
expect(tree.entries[1]).toMatchObject({
  state: 'materialized',
  handle: 'lesson-candidate-002',
  childPath: 'lessons/lesson-003.md',
});
expect(() => parseChildTree(
  oldBody,
  'Lesson Tree',
  'lesson',
  'plans/plan-001.md',
))
  .toThrow('NODE_TREE_SECTION_REQUIRED');
```

运行：

```bash
cd plugins/highschool-study
bun test tests/unit/learning-nodes.test.ts
```

Expected: `learning-nodes.ts` 尚不存在，测试失败。

- [ ] **Step 2: 实现最小共享类型**

在 `learning-nodes.ts` 定义：

```ts
export type ChildKind = 'plan' | 'lesson';

export type CandidateContent = {
  publicPurpose: string;
  after: string | null;
  dependsOn: string[];
  considerWhen: string;
  sources: string[];
  privateNote: string;
};

export type CandidateEntry = CandidateContent & {
  state: 'candidate';
  handle: string;
};

export type MaterializedEntry = CandidateContent & {
  state: 'materialized';
  handle: string;
  childId: string;
  childPath: string;
  title: string;
};

export type ChildTreeEntry = CandidateEntry | MaterializedEntry;

export type ChildTree = {
  kind: ChildKind;
  entries: ChildTreeEntry[];
};
```

导出以下纯函数：

```ts
export function parseChildTree(
  body: string,
  heading: 'Plan Tree' | 'Lesson Tree',
  kind: ChildKind,
  parentPath: string,
): ChildTree;

export function renderChildTree(
  heading: 'Plan Tree' | 'Lesson Tree',
  tree: ChildTree,
  parentPath: string,
): string;

export function nextCandidateHandle(tree: ChildTree): string;

export function applyCandidateChanges(
  tree: ChildTree,
  changes: CandidateChange[],
): ChildTree;
```

句柄由 Runtime 按父节点局部递增分配：

```text
plan-candidate-001
lesson-candidate-001
```

`After` 只影响显示顺序；`Depends on` 只接受同一父节点下已有句柄。解析器不读取状态文字，materialized 子节点状态始终由子文件 frontmatter 投影。

- [ ] **Step 3: 覆盖结构不变量**

增加测试：

- 重复 handle 拒绝；
- `After` 或 `Depends on` 指向不存在句柄时拒绝；
- 自依赖拒绝；
- Candidate 不能携带 `Node`；
- Child 必须携带可解析的真实相对 Markdown 链接；
- render → parse 严格往返；
- `Plan Graph` / `Lesson Index` 不被当作新树输入；
- `applyCandidateChanges` 只能 add、revise、remove candidate，不能改 materialized entry。

- [ ] **Step 4: 导出共享 domain 并验证**

```bash
cd plugins/highschool-study
bun test tests/unit/learning-nodes.test.ts
bun run typecheck
git diff --check
```

Expected: 定向测试与类型检查通过。

- [ ] **Step 5: 提交**

```bash
git add plugins/highschool-study/server/src/learning-nodes.ts \
  plugins/highschool-study/server/src/domain.ts \
  plugins/highschool-study/tests/unit/learning-nodes.test.ts
git commit -m "feat: define hierarchical learning node trees"
```

---

## Task 2: 把 Trace 移入学习集级全局事实池

**Files:**

- Modify: `plugins/highschool-study/server/src/traces.ts`
- Modify: `plugins/highschool-study/server/src/trace-index.ts`
- Modify: `plugins/highschool-study/server/src/trace-search.ts`
- Modify: `plugins/highschool-study/server/src/cards.ts`
- Modify: `plugins/highschool-study/server/src/method-signals.ts`
- Modify: `plugins/highschool-study/server/src/planner-attention.ts`
- Modify: `plugins/highschool-study/server/src/domain.ts`
- Modify: `plugins/highschool-study/server/src/mcp/register-tools.ts`
- Modify: `plugins/highschool-study/tests/integration/trace-records.test.ts`
- Modify: `plugins/highschool-study/tests/integration/bidirectional-search.test.ts`
- Modify: `plugins/highschool-study/tests/integration/method-signals.test.ts`
- Modify: `plugins/highschool-study/tests/contract/mcp-tools.test.ts`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-001.md`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-002.md`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-003.md`

- [ ] **Step 1: 写“一条 Trace 一份 Markdown 文件”的失败测试**

新事实格式固定为：

```markdown
---
id: trace-11111111-1111-4111-8111-111111111111
kind: classroom-trace
plan_id: route-choice
plan_path: plans/route-choice.md
lesson_id: lesson-003
lesson_path: lessons/lesson-003.md
block_id: block-002
card_path: cards/derivative/example.card.yaml
card_step_id: null
material_path: null
occurred_at: 2026-07-30T12:00:00.000Z
assessment: correct
support: none
supersedes: null
---
# Classroom Trace

## Method Binding

- Primary: 冻结变量
- Secondary: ["参变量分离"]

## Observation

学生独立比较两条路线后选择较短路线，并完成关键变形。
```

测试调用：

```ts
const trace = appendTrace(root, input, now, () => uuid);
expect(trace.traceId).toBe(`trace-${uuid}`);
expect(trace.sourceRef).toBe(`trace:trace-${uuid}`);
expect(existsSync(join(root, 'traces', `trace-${uuid}.md`))).toBe(true);
expect(readFileSync(lessonPath, 'utf8')).toBe(lessonBefore);
```

运行：

```bash
cd plugins/highschool-study
bun test tests/integration/trace-records.test.ts
```

Expected: 当前实现仍把 `## Trace` 追加到 Lesson，测试失败。

- [ ] **Step 2: 改写 Trace 类型与持久化**

新核心类型：

```ts
export type TraceRecord = {
  traceId: string;
  tracePath: string;
  sourceRef: `trace:${string}`;
  planId: string;
  planPath: string;
  lessonId: string;
  lessonPath: string;
  blockId: string;
  cardPath: string | null;
  cardStepId: string | null;
  materialPath: string | null;
  assessment: TraceAssessment;
  support: TraceSupport;
  methods: TraceMethods | null;
  note: string;
  supersedes: string | null;
  occurredAt: string;
};
```

`appendTrace`：

1. 从真实 Lesson 的 `parent_id`、`parent_path` 推导 `lessonId`、`planId` 和 `planPath`；
2. 验证 Block 与题卡 alias；
3. Runtime 通过注入的 `idFactory` 分配 `trace-${randomUUID()}`；
4. `mkdirSync(traces, { recursive: true })`；
5. 使用 `writeFileSync(path, source, { flag: 'wx' })` 创建不可覆盖的新文件；
6. 不再修改 Lesson 源文件。

`readTraceRecords` 只扫描 `traces/*.md`，不读取 Lesson 内旧 `## Trace`。

本任务同时把共享插件 fixture 的 Lesson frontmatter 从旧 `plan_id` 改为：

```yaml
parent_id: max-value
parent_path: plans/max-value.md
```

不保留双字段。Plan / Roadmap 树区段在 Task 14 统一迁移。

- [ ] **Step 3: 保留并收紧 supersede**

测试：

- 新 Trace 只能 supersede 当前 active Trace；
- 目标必须具有相同 `lessonId + blockId + cardPath`；
- supersede 本身也是新文件，旧文件不修改；
- `readActiveTraces` 排除被替代记录；
- 任意普通 `card_search`、`trace_search`、`source_resolve` 都不会创建 Trace 文件。

- [ ] **Step 4: 更新双向搜索与方法聚合**

`trace_search` 增加可选时间边界，但不增加新 MCP：

```ts
export type TraceSearchInput = {
  query: string | null;
  planId: string | null;
  lessonId: string | null;
  cardPath: string | null;
  occurredAfter: string | null;
  occurredBefore: string | null;
  limit: number;
};
```

断言：

- card → 完整 active Trace history；
- Trace → 唯一真实 card；
- Lesson、Plan、时间范围过滤；
- Planner Attention 和 Ability 继续按 `lessonPath + blockId + cardPath` 聚合一次 attempt；
- `steady` 仍要求不同题卡；
- 来源链接改为 `../traces/<trace-id>.md`。

- [ ] **Step 5: 更新公共 MCP schema**

`trace_append` 仍由 Claude Code 调用者显式提供真实 `lessonPath`，但不再接收或生成 Lesson 内事件号。成功回执：

```ts
{
  ok: true,
  ownerPath: trace.lessonPath,
  factId: trace.traceId,
  sourceRef: trace.sourceRef,
}
```

`trace_search` 增加可选 `occurredAfter` 和 `occurredBefore`。公共工具名称和数量不变。

- [ ] **Step 6: 运行共享 domain 验证**

```bash
cd plugins/highschool-study
bun test tests/integration/trace-records.test.ts \
  tests/integration/bidirectional-search.test.ts \
  tests/integration/method-signals.test.ts \
  tests/contract/mcp-tools.test.ts
bun run typecheck
git diff --check
```

- [ ] **Step 7: 提交**

```bash
git add plugins/highschool-study/server/src/traces.ts \
  plugins/highschool-study/server/src/trace-index.ts \
  plugins/highschool-study/server/src/trace-search.ts \
  plugins/highschool-study/server/src/cards.ts \
  plugins/highschool-study/server/src/method-signals.ts \
  plugins/highschool-study/server/src/planner-attention.ts \
  plugins/highschool-study/server/src/domain.ts \
  plugins/highschool-study/server/src/mcp/register-tools.ts \
  plugins/highschool-study/tests/integration/trace-records.test.ts \
  plugins/highschool-study/tests/integration/bidirectional-search.test.ts \
  plugins/highschool-study/tests/integration/method-signals.test.ts \
  plugins/highschool-study/tests/contract/mcp-tools.test.ts \
  plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-001.md \
  plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-002.md \
  plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-003.md
git commit -m "refactor: move classroom traces into a global pool"
```

---

## Task 3: 建立三层 Handoff 与证据来源契约

**Files:**

- Create: `plugins/highschool-study/server/src/handoffs.ts`
- Modify: `plugins/highschool-study/server/src/domain.ts`
- Create: `plugins/highschool-study/tests/unit/handoffs.test.ts`
- Create: `apps/pi-teaching-web/src/study/evidence-tree.ts`
- Create: `apps/pi-teaching-web/tests/study/evidence-tree.test.ts`

- [ ] **Step 1: 写纯 Handoff render / parse 失败测试**

模型只提交：

```ts
export type HandoffClaimDraft = {
  statement: string;
  scope: string;
  sources: string[];
  boundary: string;
  nextUse: string;
};

export type OpenQuestionDraft = {
  question: string;
  sources: string[];
  nextCheck: string;
};

export type HandoffDraft = {
  learnerClaims: HandoffClaimDraft[];
  teachingClaims: HandoffClaimDraft[];
  openQuestions: OpenQuestionDraft[];
};
```

Runtime 绑定：

```ts
export type HandoffIdentity = {
  id: string;
  from: string;
  to: string;
  sealedAt: string;
};
```

测试 Runtime 自动生成：

- `C1`, `C2`；
- `T1`, `T2`；
- `Q1`, `Q2`；
- `<node-id>/handoff`；
- `From`、`To` 和 `Sealed at`。

模型输入中不出现这些字段。

- [ ] **Step 2: 实现规范来源句柄**

只接受以下来源：

```text
trace:<trace-id>
session:<session-id>
session:<session-id>#message:<message-id>
card:<learning-set-relative-card-path>
block:<lesson-id>/<block-id>
claim:<node-id>/handoff#learner-c1
claim:<node-id>/handoff#teaching-t1
memory:student/<profile-entry-id>
memory:teaching/<profile-entry-id>
```

`handoffs.ts` 负责格式、render、parse 和稳定锚点；不读取 Pi Session。

- [ ] **Step 3: 实现 app 侧证据解析器**

`evidence-tree.ts` 定义：

```ts
export type EvidenceState = 'active' | 'invalidated' | 'missing' | 'forbidden';

export type EvidenceNode = {
  source: string;
  label: string;
  state: EvidenceState;
  children: EvidenceNode[];
};

export function resolveEvidenceTree(
  root: string,
  source: string,
  scope: NodeSessionScope,
  sessions: SessionEvidenceReader,
): EvidenceNode;
```

解析规则：

- Trace 必须存在；被 supersede 后为 `invalidated`；
- Lesson Claim 只能供同 Plan 的 Plan 使用；
- Plan Claim 才能供 Roadmap 或长期记忆使用；
- Session message 必须属于该节点的真实 Session Owner；
- memory handle 必须解析到确认 profile 中同 ID 的当前条目；
- Claim 递归展开到 Trace / Session / Card / Block；
- 循环引用拒绝；
- 跨分支越权返回 `forbidden`。

- [ ] **Step 4: 实现 source-only Handoff 纯函数**

```ts
export function renderSourceOnlyHandoff(
  identity: HandoffIdentity,
  sources: string[],
): string;
```

source-only Handoff 只包含 `### Source Index`，没有 Claim 和 Open Question。测试它不能被当作 `claim:` 来源，也不能直接支撑长期记忆。

- [ ] **Step 5: 运行验证**

```bash
cd plugins/highschool-study
bun test tests/unit/handoffs.test.ts
bun run typecheck

cd ../../apps/pi-teaching-web
bun test tests/study/evidence-tree.test.ts
bun run typecheck
git diff --check
```

- [ ] **Step 6: 提交**

```bash
git add plugins/highschool-study/server/src/handoffs.ts \
  plugins/highschool-study/server/src/domain.ts \
  plugins/highschool-study/tests/unit/handoffs.test.ts \
  apps/pi-teaching-web/src/study/evidence-tree.ts \
  apps/pi-teaching-web/tests/study/evidence-tree.test.ts
git commit -m "feat: define hierarchical handoff evidence"
```

---

## Task 4: 定义 Activation Snapshot、Plan Blueprint 和新版 Lesson Blueprint

**Files:**

- Create: `apps/pi-teaching-web/src/study/activation-snapshot.ts`
- Create: `apps/pi-teaching-web/src/study/plan-blueprint.ts`
- Modify: `apps/pi-teaching-web/src/study/lesson-blueprint.ts`
- Create: `apps/pi-teaching-web/tests/study/activation-snapshot.test.ts`
- Create: `apps/pi-teaching-web/tests/study/plan-blueprint.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts`

- [ ] **Step 1: 写 Adaptation Brief 的失败测试**

输入契约：

```ts
export type AdaptationBrief = {
  workingJudgment: string;
  sources: string[];
  designConsequence: string;
  reviseIf: string;
};

export type ActivationSnapshotDraft = {
  parentSources: string[];
  selectedMemory: string[];
  contentBoundary: string[];
  adaptation: AdaptationBrief;
};
```

断言四个 Adaptation 字段均非空、至少一个真实来源、selected memory 只保存来源句柄而不复制 profile 全文。

- [ ] **Step 2: 实现 prepared 与 frozen 两阶段渲染**

prepared 子文件包含：

```markdown
## Activation Snapshot

- Parent: plan:plan-001
- Activated at: pending

### Selected Context

- claim:lesson-002/handoff#learner-c1
- memory:student/S3

### Content Boundary

- 课前不公开候选方法名。

### Adaptation Brief

- Working judgment: 学生能提出路线，但比较代价时仍会犹豫。
- Sources:
  - claim:lesson-002/handoff#learner-c1
- Design consequence: 保持题型，只拉大两条路线的成本差。
- Revise if: 学生在陌生题型中无需比较即可稳定选路。
```

`sealActivationSnapshot` 只把 `Activated at: pending` 替换为 Runtime 时间，并拒绝二次封存。prepared 时父节点可重写；active 后由写权限阻止修改。

- [ ] **Step 3: 新增 Plan Blueprint**

```ts
export type PlanBlueprint = {
  title: string;
  publicPurpose: string;
  goal: string;
  capabilityStandard: string;
  test: string;
  planningBasis: string;
  activation: ActivationSnapshotDraft;
};
```

`renderPreparedPlan` 的规范区段固定为：

```text
Goal
Observable Capability Standard
Test
Planning Basis
Activation Snapshot
Lesson Tree
Current Position
Plan Summary
Handoff
```

`Lesson Tree` 初始为空，`Handoff` 初始为“尚未封存”。节点 ID、路径、父链接和 status 来自 render context，不属于 Blueprint。

Plan frontmatter 只使用通用父子字段：

```yaml
id: plan-001
kind: plan
status: prepared
parent_id: roadmap
parent_path: ROADMAP.md
coach_session: null
```

- [ ] **Step 4: 去掉 Lesson Blueprint 的模型 ID**

目标类型：

```ts
export type LessonBlockDraft = {
  localAlias: string;
  kind: ActivityKind;
  required: boolean;
  dependsOn: string[];
  uses: string[];
  studentView: string;
  teacherControl: string;
};

export type LessonBlueprint = {
  title: string;
  publicPurpose: string;
  capabilityTarget: string;
  primaryTemplate: ClassroomTemplate;
  templateReason: string;
  adjustments: string[];
  activation: ActivationSnapshotDraft;
  cards: LessonCardBinding[];
  sources: LessonSource[];
  blocks: LessonBlockDraft[];
};
```

Runtime 把 `localAlias` 映射为 `block-001`、`block-002`，再把 `dependsOn` 映射到真实 Block ID。Lesson 不再输出 `## Traces`，改为顶层 `## Handoff` 占位。

Lesson frontmatter 为：

```yaml
id: lesson-001
kind: lesson
status: prepared
parent_id: plan-001
parent_path: plans/plan-001.md
tutor_session: null
```

不再写重复的 `plan_id`。

- [ ] **Step 5: 验证**

```bash
cd apps/pi-teaching-web
bun test tests/study/activation-snapshot.test.ts \
  tests/study/plan-blueprint.test.ts \
  tests/study/lesson-blueprint.test.ts
bun run typecheck
git diff --check
```

- [ ] **Step 6: 提交**

```bash
git add apps/pi-teaching-web/src/study/activation-snapshot.ts \
  apps/pi-teaching-web/src/study/plan-blueprint.ts \
  apps/pi-teaching-web/src/study/lesson-blueprint.ts \
  apps/pi-teaching-web/tests/study/activation-snapshot.test.ts \
  apps/pi-teaching-web/tests/study/plan-blueprint.test.ts \
  apps/pi-teaching-web/tests/study/lesson-blueprint.test.ts
git commit -m "feat: compile prepared nodes from runtime-owned blueprints"
```

---

## Task 5: 一次性切换 Workspace 读取模型

**Files:**

- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/read-workspace.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/src/study/home.ts`
- Modify: `apps/pi-teaching-web/src/study/routes.ts`
- Modify: `apps/pi-teaching-web/src/study/replay.ts`
- Modify: `apps/pi-teaching-web/tests/study/read-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/home.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/routes-and-replay.test.ts`
- Modify: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/ROADMAP.md`
- Modify: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/plans/domain-integrity.md`
- Modify: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/lesson-001.md`
- Modify: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/lesson-002.md`
- Modify: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/lesson-003.md`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/traces/trace-fixture-001.md`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/traces/trace-fixture-002.md`

- [ ] **Step 1: 用新树重写 fixture，再确认旧 reader 失败**

Roadmap 改为 `## Plan Tree`，Plan 改为 `## Lesson Tree`，Lesson 去掉 `## Traces` 并加入 `## Activation Snapshot`、`## Handoff`。

运行：

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts
```

Expected: 旧 reader 找不到 Plan 或 Lesson。

- [ ] **Step 2: 扩展共享快照**

新增公开投影：

```ts
export type NodeLifecycleStatus =
  | 'candidate'
  | 'prepared'
  | 'active'
  | 'paused'
  | 'closed'
  | 'completed'
  | 'abandoned';

export type PublicTreeEntry = {
  handle: string;
  kind: 'plan' | 'lesson';
  nodeId: string | null;
  path: string | null;
  title: string | null;
  publicPurpose: string;
  after: string | null;
  dependsOn: string[];
  status: NodeLifecycleStatus;
};
```

`LearningSetSnapshot` 包含 Roadmap 的公开 `planTree`；`PlanWorkspaceSnapshot` 包含当前 Plan 的公开 `lessonTree` 和 materialized `lessons`。不向学生快照暴露 `Consider when`、Sources、Private note、Teacher Control 或 Adaptation Brief 原文。

- [ ] **Step 3: 改写 reader**

`readLearningSet`：

1. 只调用 `parseChildTree(ROADMAP.body, 'Plan Tree', 'plan', 'ROADMAP.md')`；
2. Candidate 直接形成公开投影；
3. Child 读取真实 Plan 文件的 status；
4. 缺文件、父链接错误或非法 status 直接报错，不回退旧区段。

`readPlanWorkspace` 同理使用当前 Plan path 只读 `Lesson Tree`。

- [ ] **Step 4: 删除旧结构写 helper**

从 `write-workspace.ts` 删除：

- `appendPlanGraphLink`；
- `syncPlanGraphStatus`；
- `appendLessonIndexLink`；
- `syncLessonIndex`；
- 任何从目录扫描后悄悄补回旧列表的逻辑。

暂时保留前面任务尚需调用的通用 frontmatter / section 原子写 helper，父子物化在 Task 6 接管。

- [ ] **Step 5: 更新 Home、路由与 Replay**

- Home 从公开节点树选择 candidate / prepared / active 入口；
- 浏览器恢复只接受真实 materialized 节点；
- candidate 没有路由和 Session；
- terminal Lesson 仍可 Replay；
- 多个 active Plan 都进入学生可选列表，不静默切换。

- [ ] **Step 6: 验证切换后没有旧输入**

```bash
cd apps/pi-teaching-web
bun test tests/study/read-workspace.test.ts \
  tests/study/write-workspace.test.ts \
  tests/study/home.test.ts \
  tests/study/routes-and-replay.test.ts
bun run typecheck
rg -n "Plan Graph|Lesson Index|## Traces" src tests/fixtures
```

Expected: 测试通过；`rg` 在运行时代码和新 fixture 中无匹配。

- [ ] **Step 7: 提交**

```bash
git add apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/study/read-workspace.ts \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/src/study/home.ts \
  apps/pi-teaching-web/src/study/routes.ts \
  apps/pi-teaching-web/src/study/replay.ts \
  apps/pi-teaching-web/tests/study/read-workspace.test.ts \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts \
  apps/pi-teaching-web/tests/study/home.test.ts \
  apps/pi-teaching-web/tests/study/routes-and-replay.test.ts \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/ROADMAP.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/plans/domain-integrity.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/lesson-001.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/lesson-002.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/lessons/lesson-003.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/traces/trace-fixture-001.md \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/traces/trace-fixture-002.md
git commit -m "refactor: read workspaces from hierarchical node trees"
```

---

## Task 6: 用受限工具管理 Candidate 与 prepared 子节点

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/tree-mutations.ts`
- Create: `apps/pi-teaching-web/src/runtime/roadmap-update.ts`
- Create: `apps/pi-teaching-web/src/runtime/plan-prepare.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-prepare.ts`
- Delete: `apps/pi-teaching-web/src/runtime/plan-register.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Create: `apps/pi-teaching-web/tests/runtime/tree-mutations.test.ts`
- Create: `apps/pi-teaching-web/tests/runtime/roadmap-update.test.ts`
- Create: `apps/pi-teaching-web/tests/runtime/plan-prepare.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/write-workspace.test.ts`

- [ ] **Step 1: 写 Candidate patch schema 失败测试**

共享输入：

```ts
export type CandidateDraft = {
  publicPurpose: string;
  after: string | null;
  dependsOn: string[];
  considerWhen: string;
  sources: string[];
  privateNote: string;
};

export type CandidateChange =
  | { action: 'add'; candidate: CandidateDraft }
  | { action: 'revise'; handle: string; candidate: CandidateDraft }
  | { action: 'remove'; handle: string };
```

测试 Runtime：

- add 时分配句柄；
- revise / remove 只能命中 candidate；
- materialized child 不能由 patch 改写或删除；
- 对 sibling 的 `After` / `Depends on` 校验；
- 回执返回 Runtime 句柄和规范树。

- [ ] **Step 2: 实现回滚安全的父子物化**

`tree-mutations.ts` 提供：

```ts
export type MaterializationResult = {
  handle: string;
  childId: string;
  childPath: string;
};

export function materializeChild(
  root: string,
  input: MaterializeChildInput,
): MaterializationResult;
```

实现顺序：

1. 读取并验证父节点和 candidate；
2. 分配全局 `plan-001` 或 `lesson-001`；
3. 在内存中渲染完整子文件和更新后的父树；
4. 两份内容均通过 parser / validator；
5. 写临时文件；
6. 提交子文件与父文件；
7. 任一步失败时父文件保持原样，未提交的子文件清理。

prepared child 再次调用同一 handle 时复用原 `childId / childPath` 并原地重备；active 或 terminal child 拒绝。

- [ ] **Step 3: 新增 `roadmap_update`**

Schema 只允许：

```ts
{
  goal?: string;
  capabilityStandard?: string;
  test?: string;
  candidateChanges: CandidateChange[];
}
```

Runtime 绑定 `ROADMAP.md`。首次物化 Plan 前，Goal、Observable Capability Standard 和 Test 必须均非占位。Roadmap checkpoint 在 Task 10 接入，不能在 Handoff validator 尚未接通时提前接受。

- [ ] **Step 4: 新增 `plan_prepare`**

输入只有：

```ts
{
  candidateHandle: string;
  blueprint: PlanBlueprint;
}
```

Runtime 分配 Plan ID、`plans/<id>.md`、父链接、prepared status 和 Activation Snapshot。成功回执返回：

```ts
{
  ok: true;
  ownerPath: 'ROADMAP.md';
  factId: 'plan-001';
  candidateHandle: 'plan-candidate-001';
  childPath: 'plans/plan-001.md';
  status: 'prepared';
}
```

- [ ] **Step 5: 改写 `lesson_prepare`**

输入改为：

```ts
{
  candidateHandle: string;
  blueprint: LessonBlueprint;
}
```

删除 `lessonId`、`lessonPath` 和 `planContext` 模型字段。Runtime 从当前 Plan Session、candidate handle 和 allocator 推导一切身份事实。

- [ ] **Step 6: 改写 `plan_update`**

本任务先切换 active / replan 分支：

```ts
type PlanUpdateInput =
  {
    decision: 'active' | 'replan';
    currentPosition: string;
    planSummary: string;
    candidateChanges: CandidateChange[];
  };
```

完成分支在 Task 10 与 Handoff 封存一起接入，避免出现“Plan 已 complete、Handoff 尚未提交”的中间协议。本任务拒绝旧 `nextLessonCandidate` / `learningReview` 输入，并把旧完成测试迁到 Task 10。

- [ ] **Step 7: 删除 `plan_register`**

Roadmap 只能通过 `plan_prepare` 物化自己的 candidate；Plan Agent 不再创建同级 Plan。删除工具、import、测试和 role tool name。

- [ ] **Step 8: 验证**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/tree-mutations.test.ts \
  tests/runtime/roadmap-update.test.ts \
  tests/runtime/plan-prepare.test.ts \
  tests/runtime/study-tools.test.ts \
  tests/study/write-workspace.test.ts
bun run typecheck
git diff --check
```

- [ ] **Step 9: 提交**

```bash
git add apps/pi-teaching-web/src/runtime/tree-mutations.ts \
  apps/pi-teaching-web/src/runtime/roadmap-update.ts \
  apps/pi-teaching-web/src/runtime/plan-prepare.ts \
  apps/pi-teaching-web/src/runtime/plan-update.ts \
  apps/pi-teaching-web/src/runtime/lesson-prepare.ts \
  apps/pi-teaching-web/src/runtime/plan-register.ts \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/tests/runtime/tree-mutations.test.ts \
  apps/pi-teaching-web/tests/runtime/roadmap-update.test.ts \
  apps/pi-teaching-web/tests/runtime/plan-prepare.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/study/write-workspace.test.ts
git commit -m "feat: materialize child nodes through parent-owned tools"
```

---

## Task 7: 实现 Node Session Owner v2 与原子激活

**Files:**

- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-owner.ts`
- Create: `apps/pi-teaching-web/src/runtime/node-activation.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-scope.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

- [ ] **Step 1: 写 v2 owner 与旧 owner 拒绝测试**

新 owner：

```ts
export type NodeSessionScope = {
  nodeKind: 'roadmap' | 'plan' | 'lesson';
  nodeId: string;
  nodePath: string;
  parentId: string | null;
  parentPath: string | null;
};
```

Session custom entry 改为 `studyforge.session-owner.v2`。`role` 由 nodeKind 推导：

```ts
export function roleForNode(kind: NodeSessionScope['nodeKind']): 'coach' | 'tutor' {
  return kind === 'lesson' ? 'tutor' : 'coach';
}
```

测试 v1、缺字段、重复 owner、父链接不匹配都不能复用 Session。

- [ ] **Step 2: 写激活失败与并发测试**

覆盖：

- Candidate 不能激活；
- prepared Plan 可激活；
- prepared / paused Lesson 可激活或恢复；
- 每 Plan 最多一个 active / paused Lesson；
- 不同 Plan 的 Lesson 可以并行；
- 同节点两个并发 start 只创建一个 Session；
- Session 创建失败时节点仍 prepared；
- 节点写入失败时没有 active 状态或错误 Session ID；
- active 后父工具拒绝修改。

- [ ] **Step 3: 实现 `NodeActivationService`**

内部 API：

```ts
export type ActivationReceipt = {
  nodeKind: 'plan' | 'lesson';
  nodeId: string;
  nodePath: string;
  sessionKey: SessionKey;
  sessionId: string;
  shouldKickoff: boolean;
};

export class NodeActivationService {
  activatePlan(planId: string): Promise<ActivationReceipt>;
  activateLesson(lessonId: string): Promise<ActivationReceipt>;
}
```

每个节点使用现有进程内 Promise 合并竞态。顺序固定：

1. 重读节点和父树；
2. 验证 status、依赖和并行边界；
3. 验证 prepared 文件和 Activation Snapshot；
4. 创建或核验唯一 Session Owner；
5. 封存 snapshot 的 `Activated at`；
6. 同次提交写入 Session ID 与 active status；
7. 发布新 workspace snapshot。

Agent 工具列表不包含 `node_activate`。

- [ ] **Step 4: 增加显式 Plan 启动入口**

新增：

```text
POST /api/plans/:planId/start
POST /api/lessons/:lessonId/start
```

`GET history`、打开页面或读取 workspace 不得隐式激活 prepared Plan / Lesson。前端只有学生点击才调用 start。

- [ ] **Step 5: terminal 只读**

- completed / abandoned Plan 只允许查看已有 Session 历史；
- closed / abandoned Lesson 只允许 Replay；
- 不能向 terminal Session 发新消息；
- Roadmap 根保持 active，并可持续管理未激活 Plan。

- [ ] **Step 6: 验证**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/session-scope.test.ts \
  tests/runtime/workspace-registry.test.ts \
  tests/server/workspace-api.test.ts
bun run typecheck
git diff --check
```

- [ ] **Step 7: 提交**

```bash
git add apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/src/runtime/session-owner.ts \
  apps/pi-teaching-web/src/runtime/node-activation.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/client/api.ts \
  apps/pi-teaching-web/tests/runtime/session-scope.test.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "feat: activate learning nodes with atomic ownership"
```

---

## Task 8: 编译节点 Context Frame 与文件 Allowlist

**Files:**

- Create: `apps/pi-teaching-web/src/runtime/node-access.ts`
- Create: `apps/pi-teaching-web/src/runtime/node-context.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Create: `apps/pi-teaching-web/tests/runtime/node-access.test.ts`
- Create: `apps/pi-teaching-web/tests/runtime/node-context.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/resource-loader.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`

- [ ] **Step 1: 写三种节点工作集测试**

断言：

```ts
expect(compileNodeContext(root, roadmapScope).pages.map((page) => page.kind))
  .toEqual(expect.arrayContaining(['resident', 'local', 'index']));

expect(compileNodeContext(root, planScope).allowlist)
  .toContain('plans/plan-001.md');
expect(compileNodeContext(root, planScope).allowlist)
  .not.toContain('plans/plan-002.md');

expect(compileNodeContext(root, lessonScope).allowlist)
  .toContain('lessons/lesson-003.md');
expect(compileNodeContext(root, lessonScope).allowlist)
  .not.toContain('lessons/lesson-002.md');
```

还要断言子节点上下文不包含父 Session 原始消息或兄弟 Session。

- [ ] **Step 2: 定义页表**

```ts
export type ContextPageKind = 'resident' | 'frozen' | 'local' | 'index';

export type ContextPage = {
  kind: ContextPageKind;
  label: string;
  source: string;
  content: string | null;
};

export type CompiledNodeContext = {
  scope: NodeSessionScope;
  pages: ContextPage[];
  allowlist: string[];
  resolvableSources: string[];
};
```

装配规则严格按设计稿第八章：

- Resident：Teaching Core、Role Prompt、学习原则、snapshot 指定的 profile 条目；
- Frozen：当前节点 Activation Snapshot；
- Local：当前 Node、Session、本层候选或 Block；
- Index：sealed Handoff、Trace 查询入口、公共资产来源句柄；
- profile 选择只读取 snapshot 中显式 `memory:*` 来源，不做语义规则引擎。

- [ ] **Step 3: 实现节点来源策略**

`NodeAccessPolicy` 允许：

- 当前节点；
- snapshot 明示的来源；
- 本层合法 sealed Handoff；
- 当前节点范围内的 Trace；
- `cards/`、`graph/`、`materials/`、`LEARNING_GUIDE.md` 公共资产；
- 当前 Node Session 的消息来源。

拒绝：

- 任意绝对路径；
- `..` 逃逸；
- 父或兄弟原始 Session；
- 其他 Plan / Lesson 学习文件；
- 根 profile 全文被 Lesson 任意遍历。

- [ ] **Step 4: 移除不受限原生文件工具**

从三种 scope 工具列表删除：

```text
read
grep
find
ls
write
edit
```

Pi `source_resolve` 改为 Session-bound wrapper：

```ts
{
  source: string;
}
```

它只解析 NodeAccessPolicy 允许的规范来源句柄。公共 Claude MCP 的 `source_resolve({ fromPath, target })` 保持原签名。

- [ ] **Step 5: 约束搜索范围**

- Roadmap `trace_search` 可以查询当前学习集聚合；
- Plan 自动强制当前 `planId`；
- Lesson 自动强制当前 `lessonId`；
- card_search 可搜索公共真实题卡，但返回路径均规范为 `card:<path>` 来源；
- search 不写“访问事实”，只有 active Lesson 的 `trace_append` 才记录实际使用。

- [ ] **Step 6: 验证工具权限**

```ts
expect(scopeToolNames(roadmapScope)).toEqual([
  'card_search',
  'trace_search',
  'source_resolve',
  'roadmap_update',
  'plan_prepare',
  'deep_workflow_propose',
]);

expect(scopeToolNames(planScope)).toEqual([
  'card_search',
  'trace_search',
  'source_resolve',
  'plan_update',
  'lesson_prepare',
  'memory_review_propose',
  'deep_workflow_propose',
]);
```

Lesson 列表只包含三个读取工具、四个课堂写工具和可选 deep workflow。任何列表都不包含 `node_activate` 或 `memory_review_apply`。

- [ ] **Step 7: 运行验证**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/node-access.test.ts \
  tests/runtime/node-context.test.ts \
  tests/runtime/resource-loader.test.ts \
  tests/runtime/session-factory.test.ts \
  tests/runtime/study-tools.test.ts
bun run typecheck
git diff --check
```

- [ ] **Step 8: 提交**

```bash
git add apps/pi-teaching-web/src/runtime/node-access.ts \
  apps/pi-teaching-web/src/runtime/node-context.ts \
  apps/pi-teaching-web/src/runtime/resource-loader.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/src/runtime/session-scope.ts \
  apps/pi-teaching-web/tests/runtime/node-access.test.ts \
  apps/pi-teaching-web/tests/runtime/node-context.test.ts \
  apps/pi-teaching-web/tests/runtime/resource-loader.test.ts \
  apps/pi-teaching-web/tests/runtime/session-factory.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts
git commit -m "feat: compile node-scoped context and capabilities"
```

---

## Task 9: 让 active Lesson 管理 pending Block 并写入全局 Trace

**Files:**

- Modify: `apps/pi-teaching-web/src/runtime/classroom-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-tool-contracts.ts`
- Modify: `apps/pi-teaching-web/src/runtime/study-tools.ts`
- Modify: `apps/pi-teaching-web/src/study/classroom-transition.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/src/study/validate-prepared-lesson.ts`
- Modify: `apps/pi-teaching-web/src/study/ability.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/lesson-tool-contracts.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/classroom-transition.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/ability.test.ts`

- [ ] **Step 1: 写 Block 物化和不可变边界测试**

覆盖：

- Tutor 可在当前 Lesson 目标内追加 pending dialogue、material、problem Block；
- Runtime 分配下一个 `block-###`；
- 新 problem 必须绑定 `card_search` 返回的真实 `card:<path>`；
- Runtime 生成或复用 Lesson alias；
- active / completed Block 不能换 kind、card 或 Student View；
- pending Block 可 skip、move、repeat；
- 同时最多一个 active Block；
- 每个 problem Block 恰好一张卡；
- 每次独立评价恰好一个 problem Block。

- [ ] **Step 2: 把 `classroom_update` 改成严格决定联合**

```ts
type ClassroomUpdateInput =
  | { action: 'activate' | 'complete' | 'skip'; blockId: string }
  | {
      action: 'route';
      routeAction: 'skip' | 'move' | 'repeat';
      blockId: string;
      before?: string;
      after?: string;
      reason: string;
      source: string;
    }
  | {
      action: 'insert';
      after: string | null;
      block: DynamicBlockDraft;
      reason: string;
      source: string;
    }
  | { action: 'pause' };
```

`DynamicBlockDraft` 没有 ID。problem 分支使用 `cardSource: card:<path>`；dialogue / material / reflection 分支不接受 cardSource。

- [ ] **Step 3: 改写 Pi `trace_append`**

Lesson 工具参数只保留模型无法推导的判断：

```ts
{
  blockId: string;
  cardStepId: string | null;
  assessment: 'correct' | 'partially_correct' | 'incorrect' | 'incomplete';
  support: 'none' | 'tutor' | 'external';
  methods?: {
    primary: string;
    secondary?: string[];
  };
  note: string;
  supersedes: string | null;
}
```

Runtime 从 Session-owned Lesson 和 Block 推导：

- lesson / plan；
- card alias / card path；
- material path；
- occurredAt；
- traceId。

第二条并行 active attempt 继续拒绝；completion、correction、repeat 和方法确认通过 supersede 形成新事实。

- [ ] **Step 4: 刷新全部 Trace 投影**

成功写入或 supersede 后，同一调用内重建：

- Planner Attention；
- Ability projection；
- card trace history；
- 当前 workspace snapshot；
- Evidence Lens 数据。

投影失败不能回滚已写 Trace，但回执必须区分 `factPersisted: true` 与 `projectionRefreshed: false`，下一次读取可重建；不得重复写同一事实。

- [ ] **Step 5: 验证**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/lesson-tool-contracts.test.ts \
  tests/runtime/study-tools.test.ts \
  tests/study/classroom-transition.test.ts \
  tests/study/ability.test.ts
bun run typecheck
git diff --check
```

- [ ] **Step 6: 提交**

```bash
git add apps/pi-teaching-web/src/runtime/classroom-update.ts \
  apps/pi-teaching-web/src/runtime/lesson-tool-contracts.ts \
  apps/pi-teaching-web/src/runtime/study-tools.ts \
  apps/pi-teaching-web/src/study/classroom-transition.ts \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/src/study/validate-prepared-lesson.ts \
  apps/pi-teaching-web/src/study/ability.ts \
  apps/pi-teaching-web/tests/runtime/lesson-tool-contracts.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/study/classroom-transition.test.ts \
  apps/pi-teaching-web/tests/study/ability.test.ts
git commit -m "feat: let active lessons adapt pending blocks"
```

---

## Task 10: 封存 Lesson、Plan、Roadmap Handoff 并处理来源失效

**Files:**

- Create: `apps/pi-teaching-web/src/study/handoff-seal.ts`
- Modify: `apps/pi-teaching-web/src/runtime/lesson-close.ts`
- Modify: `apps/pi-teaching-web/src/runtime/plan-update.ts`
- Modify: `apps/pi-teaching-web/src/runtime/roadmap-update.ts`
- Modify: `apps/pi-teaching-web/src/study/evidence-tree.ts`
- Modify: `apps/pi-teaching-web/src/study/write-workspace.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/ability.ts`
- Create: `apps/pi-teaching-web/tests/study/handoff-seal.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/study-tools.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/evidence-tree.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

- [ ] **Step 1: 写 Lesson 关课优先测试**

三种输入：

1. 合法 Claims；
2. Claim 来源无效；
3. 不提供 Claims。

后两种都必须：

```ts
expect(readLessonStatus(root, lessonPath)).toBe('closed');
expect(readHandoff(root, lessonPath).mode).toBe('source-only');
```

合法输入封存 claims。所有分支都保留原 Block 状态，不强制完成 Reflection。

- [ ] **Step 2: 扩展 `lesson_close`**

输入：

```ts
{
  summary: string;
  handoff?: HandoffDraft;
}
```

Runtime 自动收集：

- 当前 Lesson 全部 active Trace source ref；
- 当前 Tutor Session source ref。

合法 draft 封存完整 Handoff；无效或缺失 draft 封存 source-only。成功回执：

```ts
{
  ok: true;
  ownerPath: 'lessons/lesson-003.md';
  status: 'closed';
  handoff: {
    id: 'lesson-003/handoff';
    mode: 'claims' | 'source-only';
    rejectedIssues: string[];
  };
}
```

- [ ] **Step 3: 完成 Plan 时强制合法 Handoff**

`plan_update(decision: complete)`：

1. 验证所有来源属于本 Plan；
2. 允许引用 sealed Lesson Claim 或本 Plan active Trace；
3. source-only Lesson Handoff 本身不能作为 Claim，但可沿 Source Index 回读；
4. 任何来源无效都拒绝 complete，Plan 保持 active；
5. 成功后封存 Plan Handoff、写 summary 和 completed status。

Task 6 的 active / replan 联合在此扩为：

```ts
type PlanCompleteInput = {
  decision: 'complete';
  currentPosition: string;
  planSummary: string;
  candidateChanges: CandidateChange[];
  handoff: HandoffDraft;
};
```

`complete` 必须同时携带 Handoff，不存在无 Handoff 的旧完成分支。

- [ ] **Step 4: Roadmap checkpoint**

本任务向 `roadmap_update` 增加可选 `checkpoint: HandoffDraft`。它只能引用 sealed Plan Claim 或根级已确认 memory source。无效来源拒绝 checkpoint，但不影响已有 Plan 状态。Checkpoint 追加在 `ROADMAP.md / ## Handoff Checkpoints`，ID 与时间由 Runtime 分配。

- [ ] **Step 5: 实现非级联失效投影**

当 Trace 被 supersede：

- 历史 Handoff 文本不改；
- `resolveEvidenceTree` 把相关叶子和上层 Claim 标记为 `invalidated`；
- Planner Attention / Ability 只使用 active Trace；
- 新 Plan Handoff、Roadmap Checkpoint 和 memory candidate 不能引用 invalidated Claim；
- UI 可以继续展开当时判断及其失效原因。

- [ ] **Step 6: 扩展 Evidence API**

现有 `/api/evidence?source=` 返回联合：

```ts
export type EvidenceView =
  | { kind: 'trace'; source: string; state: EvidenceState; trace: TraceEvidence }
  | { kind: 'handoff'; source: string; state: EvidenceState; node: EvidenceNode };
```

不新增第二套事实 API。

- [ ] **Step 7: 验证**

```bash
cd apps/pi-teaching-web
bun test tests/study/handoff-seal.test.ts \
  tests/study/evidence-tree.test.ts \
  tests/runtime/study-tools.test.ts \
  tests/server/workspace-api.test.ts
bun run typecheck
git diff --check
```

- [ ] **Step 8: 提交**

```bash
git add apps/pi-teaching-web/src/study/handoff-seal.ts \
  apps/pi-teaching-web/src/runtime/lesson-close.ts \
  apps/pi-teaching-web/src/runtime/plan-update.ts \
  apps/pi-teaching-web/src/runtime/roadmap-update.ts \
  apps/pi-teaching-web/src/study/evidence-tree.ts \
  apps/pi-teaching-web/src/study/write-workspace.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/study/ability.ts \
  apps/pi-teaching-web/tests/study/handoff-seal.test.ts \
  apps/pi-teaching-web/tests/study/evidence-tree.test.ts \
  apps/pi-teaching-web/tests/runtime/study-tools.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "feat: seal node handoffs without blocking lesson closure"
```

---

## Task 11: 把长期记忆晋升收口到受信任 Runtime

**Files:**

- Modify: `apps/pi-teaching-web/src/memory-review/contracts.ts`
- Modify: `apps/pi-teaching-web/src/memory-review/source-validation.ts`
- Modify: `apps/pi-teaching-web/src/memory-review/store.ts`
- Create: `apps/pi-teaching-web/src/memory-review/apply-service.ts`
- Delete: `apps/pi-teaching-web/src/memory-review/apply-tool.ts`
- Modify: `apps/pi-teaching-web/src/memory-review/tool.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/tests/memory-review/source-validation.test.ts`
- Create: `apps/pi-teaching-web/tests/memory-review/apply-service.test.ts`
- Delete: `apps/pi-teaching-web/tests/memory-review/apply-tool.test.ts`
- Modify: `apps/pi-teaching-web/tests/memory-review/store.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

- [ ] **Step 1: 写 Handoff-only 晋升测试**

断言：

- 单个 Lesson Claim 不能直接提出长期记忆；
- source-only Handoff 不能直接提出；
- active Plan 不能提出；
- completed Plan 的有效 Plan Learner Claim 可支持 student candidate；
- 有效 Plan Teaching Claim 可支持 teaching candidate；
- invalidated Claim 拒绝；
- 学生逐项 accept / rewrite / delete 后才写 profile。

- [ ] **Step 2: 收紧 `memory_review_propose` 来源**

候选 sources 只接受：

```text
claim:<completed-plan-id>/handoff#learner-cN
claim:<completed-plan-id>/handoff#teaching-tN
```

新增 student 条目必须有 Learner Claim；teaching 条目必须有 Teaching Claim。revise / delete 还必须匹配当前 profile 中真实条目 ID 和 Content。

- [ ] **Step 3: 移除模型可调用的 `memory_review_apply`**

- 从 `scopeToolNames` 和 owner tools 删除；
- 删除 `apply-tool.ts`，把纯受信任写入逻辑移入 `apply-service.ts`；
- UI submit 后由 `WorkspaceRegistry.submitMemoryReview` 直接调用 service；
- 两份 profile 仍使用现有 rollback-safe 原子安装；
- apply receipt 写回同一 Plan Session custom entry；
- Runtime 再向 Coach 发送只读 receipt，让 Coach 重读并解释，不能再次决定内容。

- [ ] **Step 4: 保持 item-by-item UX**

`proposed → submitted → applied` 状态不变。学生拒绝的条目不写入；rewrite 使用学生提交文本；前端不能把 submitted 伪装成 applied。

- [ ] **Step 5: 验证**

```bash
cd apps/pi-teaching-web
bun test tests/memory-review/source-validation.test.ts \
  tests/memory-review/apply-service.test.ts \
  tests/memory-review/store.test.ts \
  tests/runtime/workspace-registry.test.ts \
  tests/server/workspace-api.test.ts
bun run typecheck
git diff --check
```

- [ ] **Step 6: 提交**

```bash
git add apps/pi-teaching-web/src/memory-review/contracts.ts \
  apps/pi-teaching-web/src/memory-review/source-validation.ts \
  apps/pi-teaching-web/src/memory-review/store.ts \
  apps/pi-teaching-web/src/memory-review/apply-service.ts \
  apps/pi-teaching-web/src/memory-review/apply-tool.ts \
  apps/pi-teaching-web/src/memory-review/tool.ts \
  apps/pi-teaching-web/src/runtime/session-factory.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/tests/memory-review/source-validation.test.ts \
  apps/pi-teaching-web/tests/memory-review/apply-service.test.ts \
  apps/pi-teaching-web/tests/memory-review/apply-tool.test.ts \
  apps/pi-teaching-web/tests/memory-review/store.test.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "refactor: promote long-term memory through trusted runtime"
```

---

## Task 12: 重组 Prompt Compiler 与三种 Node Role Prompt

**Files:**

- Create: `apps/pi-teaching-web/resources/agents/roadmap-node.md`
- Create: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Create: `apps/pi-teaching-web/resources/agents/lesson-node.md`
- Delete: `apps/pi-teaching-web/resources/agents/roadmap-coach.md`
- Delete: `apps/pi-teaching-web/resources/agents/coach.md`
- Delete: `apps/pi-teaching-web/resources/agents/tutor.md`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/coach-study/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md`
- Modify: `apps/pi-teaching-web/tests/runtime/resource-loader.test.ts`

- [ ] **Step 1: 先写结构测试，不写文案测试**

只断言：

- 三种 nodeKind 选择正确 Role Prompt 文件；
- Teaching Core 始终第一层；
- Dynamic Node Frame 在 Role Prompt 之后；
- Skill 路径按 nodeKind 装载；
- Persona 最后一层且标记 presentation-only；
- 未注入父 / 兄弟 Session 原文。

- [ ] **Step 2: 实现五层编译**

```text
Teaching Core
+ Node Role Prompt
+ Dynamic Node Frame
+ On-demand Skills
+ Presentation Persona
```

`resource-loader.ts` 使用 `compileNodeContext` 生成虚拟 frame 文件；不再用自由路径字符串拼接 owner context。

- [ ] **Step 3: 写 Roadmap Role Prompt**

只写：

- 长期方向、跨 Plan 复诊、一次一问；
- 管理 Plan candidate / prepared；
- 形成 Roadmap → Plan Adaptation Brief；
- 封存 checkpoint；
- 不备 Lesson、不教学、不改 active / terminal Plan、不把单课升级为长期结论。

- [ ] **Step 4: 写 Plan Role Prompt**

只写：

- 阶段问题、Lesson Handoff / Trace 综合；
- 备课前追问真正会改变选材与节奏的问题；
- 管理 Lesson candidate / prepared；
- 写 Plan → Lesson Adaptation Brief；
- 完成 Plan Handoff 和 memory candidates；
- 不教学、不写 active Lesson、不改 Roadmap、不直接写 profile。

- [ ] **Step 5: 写 Lesson Role Prompt**

只写：

- 当前 Lesson / active Block；
- “听懂—判断—介入—再观察”；
- 保留学生正确部分；
- 帮助前保留独立尝试；
- 正确记录 support、另解、更正；
- 调整 pending Block；
- 学生结束后立即关课并提交 Handoff 草稿；
- 不改 Plan / Roadmap / profile，不展示 Teacher Control。

- [ ] **Step 6: 更新 Skills**

Skills 负责 workflow，而不是复制 schema：

- Roadmap / Plan 问诊继续一次一问、洞见优先；
- prepare workflow 必须形成有来源的 Adaptation Brief；
- Tutor 可以增删重排 pending Block，但不能偏离 Lesson 目标；
- Handoff 同时考虑 Learner Claim 和 Teaching Claim；
- 决定性帮助必须记录 support，后续独立证据另开 problem Block；
- 找不到真实题卡就不物化 problem Block；
- 不复制工具参数、错误码或 Runtime 权限表。

- [ ] **Step 7: 验证**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/resource-loader.test.ts \
  tests/runtime/session-factory.test.ts
bun run typecheck
git diff --check
```

不增加任何 Skill 精确词句测试。

- [ ] **Step 8: 提交**

```bash
git add apps/pi-teaching-web/resources/agents/roadmap-node.md \
  apps/pi-teaching-web/resources/agents/plan-node.md \
  apps/pi-teaching-web/resources/agents/lesson-node.md \
  apps/pi-teaching-web/resources/agents/roadmap-coach.md \
  apps/pi-teaching-web/resources/agents/coach.md \
  apps/pi-teaching-web/resources/agents/tutor.md \
  apps/pi-teaching-web/resources/skills/roadmap-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/coach-study/SKILL.md \
  apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md \
  apps/pi-teaching-web/resources/skills/plan-next-cycle/SKILL.md \
  apps/pi-teaching-web/src/runtime/resource-loader.ts \
  apps/pi-teaching-web/tests/runtime/resource-loader.test.ts
git commit -m "refactor: compile prompts around learning node roles"
```

---

## Task 13: 把前端改为公开学习树、页表和证据下钻

**Files:**

- Create: `apps/pi-teaching-web/src/client/components/LearningTree.tsx`
- Create: `apps/pi-teaching-web/src/client/components/HandoffTree.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/SessionTree.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ContextStack.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/EvidenceLens.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/LessonReadyCard.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Create: `apps/pi-teaching-web/tests/client/learning-tree.test.tsx`
- Create: `apps/pi-teaching-web/tests/client/handoff-tree.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/learning-set-home.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/session-tree.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/context-stack.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/routes.test.ts`

- [ ] **Step 1: 写学生公开树测试**

页面展示：

- Roadmap 根；
- 多个 Plan 分支；
- 当前 Plan 的 Lesson 分支；
- candidate / prepared / active / paused / completed；
- 依赖线和 After 顺序；
- candidate 无“开始”按钮；
- prepared 节点由学生点击启动；
- active 节点进入原 Session；
- terminal 节点进入总结或 Replay。

页面不展示：

- `Consider when`；
- Private note；
- Adaptation Brief 原文；
- Teacher Control；
- card path；
- Handoff 内部教学判断；
- 父 / 兄弟 Session 内容。

- [ ] **Step 2: 实现树布局**

沿用当前前端视觉语言，使用一棵管理树而非通用流程图：

```text
Roadmap
├── Plan A
│   ├── Lesson 001
│   └── Lesson 002
└── Plan B
    └── Lesson 003
```

桌面端显示横向层级与柔和连接线；窄屏退化为缩进树。不要引入 canvas 图引擎或第三方 DAG 库。

- [ ] **Step 3: 改写 SessionTree**

SessionTree 只列 materialized 且拥有 Session 的节点。Candidate 只在 LearningTree 出现。Plan Coach 和 Tutor 仍使用同一个聊天界面，切换节点时不复制历史。

- [ ] **Step 4: 扩展 Context Stack**

显示四类页：

- 常驻；
- 冻结交接；
- 当前节点；
- 按需来源。

学生只看到页名、用途、来源数量和可公开来源，不显示私有内容。Coach / raw-stream 仍可通过现有本地诊断路径检查完整编译结果。

- [ ] **Step 5: 扩展 Evidence Lens**

`HandoffTree` 递归展示：

```text
Roadmap Claim
  → Plan Claim
    → Lesson Claim
      → Trace / Session / Card / Block
```

active、invalidated、missing 使用不同视觉状态；invalidated 解释“底层记录后来被更正”，但保留历史文本。

- [ ] **Step 6: 保持安全投影**

- assessment / diagnostic 继续使用泛化目的；
- 普通专题课可显示题号或 content item ID；
- prepared Lesson 真标题在开始前按现有策略隐藏；
- 刷新只从公开节点树与真实 status 恢复；
- safe / raw-stream 语义不变。

- [ ] **Step 7: 验证**

```bash
cd apps/pi-teaching-web
bun test tests/client/learning-tree.test.tsx \
  tests/client/handoff-tree.test.tsx \
  tests/client/learning-set-home.test.tsx \
  tests/client/session-tree.test.tsx \
  tests/client/context-stack.test.tsx \
  tests/client/state.test.ts \
  tests/client/routes.test.ts
bun run typecheck
bun run build
git diff --check
```

- [ ] **Step 8: 提交**

```bash
git add apps/pi-teaching-web/src/client/components/LearningTree.tsx \
  apps/pi-teaching-web/src/client/components/HandoffTree.tsx \
  apps/pi-teaching-web/src/client/components/LearningSetHome.tsx \
  apps/pi-teaching-web/src/client/components/SessionTree.tsx \
  apps/pi-teaching-web/src/client/components/ContextStack.tsx \
  apps/pi-teaching-web/src/client/components/EvidenceLens.tsx \
  apps/pi-teaching-web/src/client/components/LessonReadyCard.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/api.ts \
  apps/pi-teaching-web/src/client/state.ts \
  apps/pi-teaching-web/src/client/routes.ts \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/tests/client/learning-tree.test.tsx \
  apps/pi-teaching-web/tests/client/handoff-tree.test.tsx \
  apps/pi-teaching-web/tests/client/learning-set-home.test.tsx \
  apps/pi-teaching-web/tests/client/session-tree.test.tsx \
  apps/pi-teaching-web/tests/client/context-stack.test.tsx \
  apps/pi-teaching-web/tests/client/state.test.ts \
  apps/pi-teaching-web/tests/client/routes.test.ts
git commit -m "feat: render learning nodes and evidence trees"
```

---

## Task 14: 迁移插件语义、模板和导数示范学习集

**Files:**

- Modify: `plugins/highschool-study/agents/study-coach.md`
- Modify: `plugins/highschool-study/agents/lesson-designer.md`
- Modify: `plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md`
- Modify: `plugins/highschool-study/skills/plan-next-cycle/SKILL.md`
- Modify: `plugins/highschool-study/skills/prepare-next-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/run-lesson/SKILL.md`
- Modify: `plugins/highschool-study/skills/close-lesson-reflection/SKILL.md`
- Modify: `plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md`
- Modify: `plugins/highschool-study/skills/recall-study-memory/SKILL.md`
- Modify: `plugins/highschool-study/skills/inspect-progress/SKILL.md`
- Modify: `plugins/highschool-study/learning-set-template/ROADMAP.md`
- Create: `plugins/highschool-study/learning-set-template/traces/.gitkeep`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/ROADMAP.md`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/plans/max-value.md`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/plans/transfer.md`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-001.md`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-002.md`
- Modify: `plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-003.md`
- Create: `plugins/highschool-study/tests/fixtures/learning-set/traces/.gitkeep`
- Modify: `examples/derivative-demo/learning-set/ROADMAP.md`
- Create: `examples/derivative-demo/learning-set/traces/.gitkeep`
- Modify: `plugins/highschool-study/tests/contract/package-and-template.test.ts`
- Modify: `plugins/highschool-study/tests/contract/public-demo.test.ts`
- Modify: `plugins/highschool-study/tests/e2e/markdown-learning-loop.test.ts`
- Modify: `plugins/highschool-study/dist/mcp-server.js`

- [ ] **Step 1: 迁移 Claude Code workflow 语义**

公共 MCP 不增加工具。Claude Code Agent 通过现有文件能力遵守同一事实协议：

- Roadmap 写 `Plan Tree`；
- Plan 写 `Lesson Tree`；
- Trace 写全局 `traces/`；
- Handoff 使用统一 Claim 契约；
- active 子节点不由父流程改写；
- 长期记忆仍需 Plan 汇总和学生逐项确认。

不要把 Pi 内部工具名、Session Owner 或错误码复制到 Claude Skills。

- [ ] **Step 2: 迁移模板**

空模板必须包含：

```text
ROADMAP.md / Plan Tree
plans/
lessons/
traces/
memory/
cards/
graph/
materials/
```

Roadmap 的 Goal、Capability Standard 和 Test 保留占位，但 `Plan Tree` 是唯一计划入口。

- [ ] **Step 3: 迁移测试 fixture**

把旧 Lesson 内 Trace 变为 `traces/*.md`；所有 Handoff source 改为规范句柄；Plan 和 Roadmap 使用新树。测试不得为旧结构保留 fixture。

- [ ] **Step 4: 迁移干净导数示范学习集**

示范集继续保持无个性化历史：

- Roadmap 使用空 `Plan Tree`；
- `plans/`、`lessons/`、`traces/` 为空；
- 519 张题卡、方法图谱、材料和空白 profiles 保持不变；
- 不从旧验收记录生成新 Plan。

- [ ] **Step 5: 验证插件边界**

```bash
cd plugins/highschool-study
bun test tests/contract/package-and-template.test.ts \
  tests/contract/public-demo.test.ts \
  tests/e2e/markdown-learning-loop.test.ts
bun run typecheck
bun run build:dist
node -e "const fs=require('fs'); const s=fs.readFileSync('server/src/mcp/register-tools.ts','utf8'); const names=[...s.matchAll(/registerTool\\('([^']+)'/g)].map(m=>m[1]); if(JSON.stringify(names)!==JSON.stringify(['card_search','trace_search','trace_append','source_resolve'])) process.exit(1)"
git diff --check
```

- [ ] **Step 6: 提交**

```bash
git add plugins/highschool-study/agents/study-coach.md \
  plugins/highschool-study/agents/lesson-designer.md \
  plugins/highschool-study/skills/start-or-revise-roadmap/SKILL.md \
  plugins/highschool-study/skills/plan-next-cycle/SKILL.md \
  plugins/highschool-study/skills/prepare-next-lesson/SKILL.md \
  plugins/highschool-study/skills/run-lesson/SKILL.md \
  plugins/highschool-study/skills/close-lesson-reflection/SKILL.md \
  plugins/highschool-study/skills/consolidate-plan-memory/SKILL.md \
  plugins/highschool-study/skills/recall-study-memory/SKILL.md \
  plugins/highschool-study/skills/inspect-progress/SKILL.md \
  plugins/highschool-study/learning-set-template/ROADMAP.md \
  plugins/highschool-study/learning-set-template/traces/.gitkeep \
  plugins/highschool-study/tests/fixtures/learning-set/ROADMAP.md \
  plugins/highschool-study/tests/fixtures/learning-set/plans/max-value.md \
  plugins/highschool-study/tests/fixtures/learning-set/plans/transfer.md \
  plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-001.md \
  plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-002.md \
  plugins/highschool-study/tests/fixtures/learning-set/lessons/lesson-003.md \
  plugins/highschool-study/tests/fixtures/learning-set/traces/.gitkeep \
  plugins/highschool-study/tests/contract/package-and-template.test.ts \
  plugins/highschool-study/tests/contract/public-demo.test.ts \
  plugins/highschool-study/tests/e2e/markdown-learning-loop.test.ts \
  plugins/highschool-study/dist/mcp-server.js \
  examples/derivative-demo/learning-set/ROADMAP.md \
  examples/derivative-demo/learning-set/traces/.gitkeep
git commit -m "refactor: migrate learning sets to hierarchical nodes"
```

---

## Task 15: 补齐端到端节点生命周期测试

**Files:**

- Create: `apps/pi-teaching-web/tests/e2e/hierarchical-runtime.spec.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/domain-integrity-fixture.test.ts`

- [ ] **Step 1: 建立完整无模型 fixture 流程**

通过 Runtime / HTTP 完成：

```text
Roadmap add Plan candidate
→ plan_prepare
→ 学生 start Plan
→ Plan add two Lesson candidates
→ lesson_prepare
→ 学生 start Lesson
→ insert / activate / complete Blocks
→ trace_append
→ lesson_close
→ 回 Plan
→ prepare and close second Lesson
→ complete Plan Handoff
→ propose memory
→ 学生逐项确认
→ Runtime apply
→ 回 Roadmap checkpoint
```

- [ ] **Step 2: 覆盖权责与恢复**

E2E 断言：

- active child 后父工具拒绝；
- 多 Plan 并行；
- 同 Plan 第二 active Lesson 拒绝；
- 刷新恢复当前 Plan / Lesson；
- terminal 只能 Replay；
- Context Stack 不泄露兄弟；
- Handoff 可下钻到 Trace；
- supersede 后上层 Claim 显示 invalidated；
- source-only 关课仍成功。

- [ ] **Step 3: 覆盖公开投影**

截图 / DOM 断言：

- 树形关系正确；
- candidate 没有 Session；
- prepared 有学生启动入口；
- 安全摘要不显示 Teacher Control、答案、方法候选或私有 note；
- Evidence Lens 能解释来源层级。

- [ ] **Step 4: 运行自动化验证**

```bash
cd apps/pi-teaching-web
bun test tests/server/workspace-api.test.ts \
  tests/study/domain-integrity-fixture.test.ts
bunx playwright test tests/e2e/hierarchical-runtime.spec.ts \
  tests/e2e/workspace.spec.ts
git diff --check
```

- [ ] **Step 5: 提交**

```bash
git add apps/pi-teaching-web/tests/e2e \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts \
  apps/pi-teaching-web/tests/study/domain-integrity-fixture.test.ts
git commit -m "test: cover hierarchical learning runtime end to end"
```

---

## Task 16: 更新当前功能文档与仓库权威说明

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `plugins/highschool-study/README.md`
- Modify: `docs/zh-CN/完整说明书.md`
- Create: `docs/zh-CN/学习节点树与证据继承.md`

- [ ] **Step 1: 更新事实层级**

`AGENTS.md` 明确：

- Plan Tree / Lesson Tree；
- Candidate / prepared / active / terminal；
- `traces/*.md` 全局池；
- Handoff 证据树；
- Runtime-only activation / memory apply；
- Node-scoped context and allowlist；
- 公共四 MCP。

删除旧 `Plan Graph`、`Lesson Index`、Lesson 内 Trace 和 Roadmap generic write/edit 权威描述。

- [ ] **Step 2: 更新用户说明**

中文说明书用学生能理解的语言解释：

- Roadmap 是长期方向；
- Plan 是阶段分支；
- Lesson 是当前课堂；
- 学生点击才激活；
- 父节点如何根据前课结果准备下一课；
- Trace、Handoff 和长期记忆分别是什么；
- 如何查看证据来源与更正；
- 如何重新备课、暂停、结束和回放。

- [ ] **Step 3: 增加开发者协议页**

`学习节点树与证据继承.md` 给出：

- 目录树；
- 三种 Markdown 最小示例；
- Trace 文件示例；
- Handoff Claim 示例；
- Context 四页；
- 读写权限表；
- 节点生命周期图；
- 不兼容旧结构的说明。

- [ ] **Step 4: 文档自检**

```bash
rg -n "Plan Graph|Lesson Index|Lesson 内.*Trace|memory_review_apply.*模型" \
  AGENTS.md README.md plugins/highschool-study/README.md docs/zh-CN
git diff --check
```

Expected: 只允许在明确标注“旧版不再支持”的迁移说明中出现。

- [ ] **Step 5: 提交**

```bash
git add AGENTS.md README.md plugins/highschool-study/README.md \
  docs/zh-CN/完整说明书.md docs/zh-CN/学习节点树与证据继承.md
git commit -m "docs: document hierarchical learning node runtime"
```

---

## Task 17: 真实模型对照验收与最终发布检查

**Files:**

- Create: `docs/audits/2026-08-01-hierarchical-node-runtime-acceptance.md`
- Modify only if a verified defect is found: files named by the defect

- [ ] **Step 1: 使用专用验收 Skill**

执行者必须读取并使用 `studyclaw-e2e-validation`。在导数学习集副本和独立 Pi 凭据目录运行，不修改公开示范集事实。

- [ ] **Step 2: 跑生命周期 Smoke**

至少覆盖：

- Roadmap 问诊后生成两个 Plan candidate；
- 只物化近期 Plan；
- 学生激活 Plan；
- Plan 问诊后生成至少两个 Lesson candidate；
- 只物化下一课；
- Lesson 完成后返回原 Plan Session；
- Plan 根据 Handoff 调整未激活 sibling；
- 完成 Plan 后返回 Roadmap，并保留另一个可选 Plan。

- [ ] **Step 3: 跑个性化对照**

资产、目标和题卡相同，只改变历史：

**Student A**

- 会标准方法；
- 多次在两条路线都可行时犹豫；
- 比较路线成本后改善。

**Student B**

- 选路迅速；
- 反复遗漏定义域或取等条件；
- 把条件检查提前后改善。

验收：

- 两份 Adaptation Brief 引用不同真实来源；
- 目标、题目角色、活动顺序或介入方式至少一项有实质差异；
- 差异可沿 Handoff → Trace / Session 回溯；
- 不是只换开场话术后继续同一课堂。

- [ ] **Step 4: 跑 Tutor 真实情境**

至少模拟：

- 完全答错；
- 部分正确；
- 只写半句；
- 卡住并请求提示；
- 提示后完成；
- 提出另解；
- 反驳 Tutor；
- 疲劳并主动提前结束。

检查 support、Block、Trace、Handoff 和关课主动权是否正确。

- [ ] **Step 5: 只修验收证实的问题**

若真实模型失败：

1. 先定位是 domain、runtime、tool schema、context、skill、model 还是 provider；
2. 不因单次偶发工具错误增加通用重试框架；
3. 不用提示词掩盖 Runtime 身份或权限缺陷；
4. Skill 文案问题只改 Skill，不写脆弱文本测试；
5. 每个修复单独定向测试、提交并在同一情境重跑。

- [ ] **Step 6: 写验收报告**

报告必须记录：

- 运行基线 commit；
- 模型与 provider，不记录密钥；
- 学习集副本路径；
- 每个 Node Session；
- Activation Snapshot 来源；
- Handoff 证据树；
- Trace 写入和 supersede；
- 长期记忆确认；
- 通过、失败、边界和未证明内容。

- [ ] **Step 7: 最终自动验证**

```bash
cd plugins/highschool-study
bun run release:check

cd ../../apps/pi-teaching-web
bun run check
bun run test:e2e

cd ../..
git diff --check
git status --short
```

Expected:

- plugin release check 全绿；
- app typecheck、unit、build、E2E 全绿；
- 公共 MCP 恰好四个；
- 没有旧结构运行时分支；
- 没有计划外文件；
- 验收报告不含 API key、完整系统 prompt 或逐字私人课堂记录。

- [ ] **Step 8: 提交**

```bash
git add docs/audits/2026-08-01-hierarchical-node-runtime-acceptance.md
git commit -m "docs: record hierarchical node runtime acceptance"
```

---

## Final Acceptance Checklist

- [ ] Roadmap、Plan、Lesson 是真实控制权树，不是线性列表换皮。
- [ ] Candidate 没有文件和 Session；prepared 才有完整子文件。
- [ ] 学生点击后原子激活；父节点不能修改 active child。
- [ ] 多 Plan 可并行；每 Plan 最多一个 active / paused Lesson；每 Lesson 最多一个 active Block。
- [ ] Node、Block、Trace、Handoff、Claim、路径、时间和 Session Owner 均由 Runtime 绑定。
- [ ] 子 Session 只拿 Resident / Frozen / Local / Index 页，不复制父或兄弟 Session。
- [ ] 文件读取受 NodeAccessPolicy 约束，不再暴露学习集级原生 read / grep / find / ls / write / edit。
- [ ] `traces/*.md` 可按 card、Plan、Lesson、Block 和时间双向查询。
- [ ] Handoff 可从 Roadmap Claim 回溯到 Plan、Lesson、Trace、Session、Card 和 Block。
- [ ] supersede 不级联重写历史，但会让依赖来源确定失效。
- [ ] Lesson 关课不被 Reflection 或 Claim 格式阻塞。
- [ ] 长期记忆只经 completed Plan Handoff、学生逐项确认和 Runtime 原子应用产生。
- [ ] Adaptation Brief 说明历史如何具体改变目标、任务、顺序或介入。
- [ ] Tutor 仍可灵活调整 pending Block，并如实记录提示依赖。
- [ ] 前端只展示公开学习树、安全上下文页和可解释证据。
- [ ] Claude Code plugin 仍只有四个公共 MCP。
- [ ] 没有数据库、向量库、规则引擎、后台调度器、兼容层或 Skill 文案测试。
