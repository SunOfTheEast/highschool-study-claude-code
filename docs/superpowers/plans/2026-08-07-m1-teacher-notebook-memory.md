# StudyForge M1 教师笔记记忆系统实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task with review checkpoints.

**Goal:** 在 `apps/pi-teaching-web` 中落地学习集内的 Markdown 教师记忆，使 Tutor、Coach、Roadmap 能在各自生命周期中固化、召回和校准记忆，同时保持 M0 的层级证据边界与可回归性。

**Architecture:** `memory/INDEX.md` 是唯一常驻注入的 L0 路由；对象、能力、偏好 Markdown 是按需读取的 L1；来源 Lesson 的 Consolidated Learning Traces 与 Classroom Log 是逐级下钻的证据。模型使用现有原生 `Read` / `Grep` / `Edit` / `Write`，Runtime 仅注入契约与索引，并用 Lesson 路径守卫限制写入范围，不生成教学判断。旧 `plugins/highschool-study` 直接退役，不迁移、不兼容、不双写。

**Tech Stack:** TypeScript、Bun test、Pi coding-agent resource loader / extension hooks、Markdown + YAML frontmatter、React（只做现有回归，不新增记忆 UI）。

## Global Constraints

- 五类语义边界以设计文档为准：学习痕迹、对象记忆、能力假设、偏好、教学待办各归其位。
- 原始 Classroom Log 与既有 Trace 不回写；纠正追加新事实，只有当前判断可修订并保留流变。
- 一节 Lesson 只有一次正式课末反思；本 Session 不自动回读刚写入的记忆。
- Tutor 只留下单对象能力信号；跨对象工作能力假设由 Plan Coach 建立，跨 Plan 校准由 Roadmap 完成。
- Lesson 只能向当前 Lesson 末尾追加 Trace，并写 `memory/INDEX.md`、`memory/indexes/**`、`memory/objects/**`、`memory/preferences/**`；不能写 capability、Plan、Roadmap 或兄弟 Lesson。
- 不新增 `recall_memory`、`read_memory`、`read_evidence` 等工具，也不引入数据库、embedding、全局 Trace 池或单体学生画像。
- 不修改与本计划无关的用户改动；测试中的学习集写入必须发生在临时副本。

---

### Task 1: 让 Lesson 文档承载唯一来源 Trace

**Files:**

- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/study/markdown.ts`
- Modify: `apps/pi-teaching-web/resources/contracts/m0-document-contract.md`
- Modify: `apps/pi-teaching-web/tests/m0/markdown-domain.test.ts`
- Create: `apps/pi-teaching-web/tests/fixtures/m0-learning-set/memory/INDEX.md`
- Create: `examples/derivative-m0/learning-set/memory/INDEX.md`

**Step 1: Write the failing parser tests**

在 `markdown-domain.test.ts` 添加三组行为：

1. Lesson 最末尾存在唯一、非空 `## Consolidated Learning Traces` 时可解析，并原样暴露为 `consolidatedLearningTraces`；
2. Trace 区段出现在 Block 之前、重复出现或为空时拒绝；
3. 既有未知二级区段仍拒绝，避免把严格契约放宽成任意 Markdown。

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/markdown-domain.test.ts
```

Expected: FAIL，因为 `LessonDocument` 与解析器尚不知道 Consolidated Learning Traces。

**Step 2: Implement the smallest parser change**

给 `LessonDocument` 增加：

```ts
consolidatedLearningTraces: string | null;
```

`parseLesson` 只允许 `Lesson Goal`、`Block *` 和一个位于所有 Block 之后的 `Consolidated Learning Traces`。该区段不存在时返回 `null`，存在时必须非空。不要在 TypeScript 中结构化 Trace 的教学字段。

**Step 3: Document the Markdown contract and seed an empty L0 index**

在文档契约中增加可选末尾 Trace 示例、稳定 ASCII Trace ID、追加而非改写规则，以及 `memory/` 路径约定。给测试夹具和 derivative 示例加入紧凑初始索引：

```md
# Teacher Memory Index

## Current Learning Frontier

- 尚无已固化课堂记忆。

## Object Buckets

## Active Capability Cues

## Active Preference Cues
```

**Step 4: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m0/markdown-domain.test.ts tests/m0/derivative-demo.test.ts
git add apps/pi-teaching-web/src/shared/contracts.ts apps/pi-teaching-web/src/study/markdown.ts apps/pi-teaching-web/resources/contracts/m0-document-contract.md apps/pi-teaching-web/tests/m0/markdown-domain.test.ts apps/pi-teaching-web/tests/fixtures/m0-learning-set/memory/INDEX.md examples/derivative-m0/learning-set/memory/INDEX.md
git commit -m "feat: let lessons preserve consolidated learning traces"
```

---

### Task 2: 注入 L0，并给 Lesson 原生写入加机械边界

**Files:**

- Create: `apps/pi-teaching-web/resources/contracts/m1-memory-contract.md`
- Create: `apps/pi-teaching-web/src/runtime/lesson-memory-guard.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-scope.ts`
- Modify: `apps/pi-teaching-web/tests/m0/native-session.test.ts`
- Create: `apps/pi-teaching-web/tests/m1/lesson-memory-guard.test.ts`

**Step 1: Write failing resource and guard tests**

测试以下边界：

- Roadmap、Plan、Lesson 都恰好注入一次 `m1-memory-contract.md` 和当前学习集的 `memory/INDEX.md`；不注入任何 L1 / L2 文件；
- Lesson 工具列表增加原生 `edit`、`write`，但没有任何 memory 专用工具；
- 当前 Lesson 的纯末尾 Trace 追加允许；修改 frontmatter、Block、Classroom Log 或用 `write` 覆盖当前 Lesson 拒绝；
- `memory/INDEX.md`、`memory/indexes/**/*.md`、`memory/objects/**/*.md`、`memory/preferences/**/*.md` 允许；
- `memory/capabilities/**`、Plan、Roadmap、兄弟 Lesson、绝对路径和 `..` 越界拒绝。

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts tests/m1/lesson-memory-guard.test.ts
```

Expected: FAIL，因为索引尚未注入，Lesson 没有原生写工具，也没有路径守卫。

**Step 2: Add a compact always-on memory contract**

契约只保留五类语义边界、所有权、披露顺序、追加边界和文件路径。它不得复制完整 Skill 工作流，也不得把教学待办写进 memory。

**Step 3: Implement `validateLessonMemoryWrite`**

导出纯验证函数供测试，并由扩展工厂调用。核心接口：

```ts
export type LessonMemoryWriteCall = {
  toolName: 'edit' | 'write';
  input: unknown;
};

export function validateLessonMemoryWrite(
  root: string,
  scope: NodeSessionScope,
  call: LessonMemoryWriteCall,
): void;

export function lessonMemoryGuard(
  root: string,
  scope: NodeSessionScope,
): ExtensionFactory;
```

路径先解析为学习集内规范相对路径。对当前 Lesson，只接受单个 edit 产生的 `原文 + 非空后缀`，并用 `parseLessonSource` 复验完整候选文档。对 memory 文件允许 edit/write，但按上述目录白名单限制，且 Tutor 不可写 capability。错误使用稳定前缀 `LESSON_MEMORY_WRITE_BLOCKED`。

**Step 4: Wire resources and extension**

- `modelToolsForNode('lesson')` 增加 `edit`、`write`；
- `loadStaticNodeResources` 在 `memory/INDEX.md` 存在时把其内容作为单独 agents file 注入；缺失时保持 M0 可启动，不伪造内容；
- 所有角色注入 M1 memory contract；
- `createRoleResourceLoader` 给 Lesson 注册 closure-based guard，Plan 的 subagent guard 保持不变。

**Step 5: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m0/native-session.test.ts tests/m1/lesson-memory-guard.test.ts
git add apps/pi-teaching-web/resources/contracts/m1-memory-contract.md apps/pi-teaching-web/src/runtime/lesson-memory-guard.ts apps/pi-teaching-web/src/runtime/resource-loader.ts apps/pi-teaching-web/src/runtime/session-scope.ts apps/pi-teaching-web/tests/m0/native-session.test.ts apps/pi-teaching-web/tests/m1/lesson-memory-guard.test.ts
git commit -m "feat: inject and guard markdown teacher memory"
```

---

### Task 3: 落地 Tutor 的课末固化与课堂按需召回

**Files:**

- Modify: `apps/pi-teaching-web/resources/agents/lesson-node.md`
- Modify: `apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md`
- Create: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-recall.md`
- Create: `apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md`
- Create: `apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts`

**Step 1: Write failing skill-contract tests**

以结构断言而非整段措辞快照验证：

- Tutor 根 Skill 路由到“现场异常表现召回”和“唯一课末反思固化”两份 reference；
- 召回亮线是 INDEX → L1 → Trace → 必要时 Log，且当前证据优先；
- 固化亮线是自然回顾 → 听学生 → 有边界判断 → 静默写入 → 自然总结 → 纠正追加；
- reference 明确禁止教学待办、跨对象能力定论、类别配额和当前 Session 回读新写记忆；
- Lesson role 不再声称完全没有 edit/write，但仍禁止修改父节点、生命周期和非记忆文件。

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/memory-skill-tree.test.ts
```

Expected: FAIL，因为路由和 reference 尚不存在。

**Step 2: Implement the two bright-line references**

`memory-recall.md` 只在预案外错误、停点或旧判断冲突会改变眼前教学动作时读取；禁止例行画像展开和目录遍历。

`memory-consolidation.md` 给出可直接使用但不过度字段化的 Markdown 模板：

- 来源 Lesson 尾部 Trace；
- 对象文件包含 Current Judgment、Evolution Overview、Trace Timeline、Boundaries / Not Yet Demonstrated；
- 偏好文件保留最小原话、时间、范围与来源；
- 局部更新 INDEX / bucket；
- 单对象能力信号只留在 Trace。

对象 ID 与分桶由模型基于现有 INDEX 稳定复用；新对象必要时才创建，不追求一次性完美本体。

**Step 3: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m1/memory-skill-tree.test.ts tests/m0/native-session.test.ts
git add apps/pi-teaching-web/resources/agents/lesson-node.md apps/pi-teaching-web/resources/skills/tutor-lesson/SKILL.md apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-recall.md apps/pi-teaching-web/resources/skills/tutor-lesson/references/memory-consolidation.md apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts
git commit -m "feat: teach tutors to consolidate and recall memory"
```

---

### Task 4: 让 Plan 与 Roadmap 在正确时间尺度消费和校准记忆

**Files:**

- Modify: `apps/pi-teaching-web/resources/agents/plan-node.md`
- Modify: `apps/pi-teaching-web/resources/agents/roadmap-node.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-dialogue/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-dialogue/references/post-lesson-review.md`
- Modify: `apps/pi-teaching-web/resources/skills/plan-dialogue/references/plan-closure.md`
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-dialogue/SKILL.md`
- Modify: `apps/pi-teaching-web/resources/skills/roadmap-dialogue/references/next-plan.md`
- Modify: `apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts`

**Step 1: Extend failing lifecycle tests**

验证：

- Plan 课后先读本课 Trace 和相关 L1，不默认重读完整 Lesson，也不重复采访“哪里顺 / 不踏实”；
- 缺失、冲突、学生纠正或高影响判断才下钻 Log / 定向追问；
- 同模式跨对象后 Plan 才可创建或校准 `memory/capabilities/**`；
- Roadmap 先读 Plan 总结和受影响记忆，只在冲突 / 高影响时下钻 Lesson，并在跨 Plan 尺度校准同一 capability 文件；
- `PLAN.md Current Position` 与 `ROADMAP.md` 的教学安排保持自包含，待办不进入 memory；
- 所有下一课 / 下一 Plan 的物化仍经过原有“公开提案 → 学生明确确认 → 写父文档 → 才 prepare”批准门。

**Step 2: Implement lifecycle-specific references**

不另造通用 memory Skill。把规则放在行为实际发生的阶段 reference 中：Plan post-lesson、Plan closure、Roadmap next-plan。根 Skill 只保留路由与尺度。

**Step 3: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m1/memory-skill-tree.test.ts tests/m0/native-session.test.ts
git add apps/pi-teaching-web/resources/agents/plan-node.md apps/pi-teaching-web/resources/agents/roadmap-node.md apps/pi-teaching-web/resources/skills/plan-dialogue apps/pi-teaching-web/resources/skills/roadmap-dialogue apps/pi-teaching-web/tests/m1/memory-skill-tree.test.ts
git commit -m "feat: align memory with plan and roadmap cycles"
```

---

### Task 5: 退役旧插件与旧支持面

**Files:**

- Delete: `plugins/highschool-study/**`
- Delete: `.claude-plugin/marketplace.json`
- Delete: `docs/design/architecture.en.md`
- Delete: `docs/design/architecture.zh-CN.md`
- Delete: `docs/design/implementation-plan.en.md`
- Delete: `docs/design/implementation-plan.zh-CN.md`
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify: `apps/pi-teaching-web/README.md`
- Create: `apps/pi-teaching-web/tests/m1/retired-plugin-surface.test.ts`

**Step 1: Write the failing retirement test**

断言旧插件目录、旧 marketplace manifest 和四份当前式旧架构文档不存在；根 README 不再把旧插件描述为可用实现；核心 App README 明确 Markdown memory 与无兼容层。保留带日期的历史 spec / audit 和知识卡 schema 名称，它们不是运行入口。

Run:

```bash
cd apps/pi-teaching-web
bun test tests/m1/retired-plugin-surface.test.ts
```

Expected: FAIL，因为旧支持面仍存在。

**Step 2: Delete only the obsolete implementation surface**

删除前用 `git ls-files` 枚举精确 tracked targets 并确认没有 worktree 内用户改动；只删除上述范围。不要扫除历史设计、题卡或用户未提交文件。

**Step 3: Update current documentation**

README / AGENTS 只描述 `apps/pi-teaching-web` 的 Roadmap → Plan → Lesson 核心、学习集内 Markdown memory、原生文件召回和测试命令；删除“旧插件仍保留”的模糊表述。

**Step 4: Verify and commit**

```bash
cd apps/pi-teaching-web
bun test tests/m1/retired-plugin-surface.test.ts
git add -A plugins/highschool-study .claude-plugin/marketplace.json docs/design/architecture.en.md docs/design/architecture.zh-CN.md docs/design/implementation-plan.en.md docs/design/implementation-plan.zh-CN.md README.md AGENTS.md apps/pi-teaching-web/README.md apps/pi-teaching-web/tests/m1/retired-plugin-surface.test.ts
git commit -m "refactor: retire the obsolete study plugin"
```

---

### Task 6: 完整回归与交付审阅

**Files:**

- Modify only if failures reveal an in-scope defect.

**Step 1: Install the locked dependency graph**

```bash
cd apps/pi-teaching-web
bun install --frozen-lockfile
```

**Step 2: Run focused M1 and complete checks**

```bash
cd apps/pi-teaching-web
bun test tests/m1
bun run check
```

Expected: all tests and type checks pass.

**Step 3: Run the established M0 browser cycle regression**

```bash
cd apps/pi-teaching-web
bun run test:e2e -- tests/e2e/m0-cycle.spec.ts
```

Expected: Roadmap → Plan → Lesson 的既有闭环仍通过；M1 不改变课程树、批准门或课堂工具的原子行为。

**Step 4: Inspect the final surface**

```bash
git status --short
git diff --check
git log --oneline --decorate -8
git diff --stat main...HEAD
rg -n "recall_memory|read_memory|read_evidence|student-profile|planner-attention" apps/pi-teaching-web README.md AGENTS.md
```

Expected: 只有计划内改动；无 whitespace error；无通用记忆工具或旧画像入口。

**Step 5: Request code review and resolve only verified findings**

使用 `superpowers:requesting-code-review` 检查 Runtime 边界、Skill 行为负担、证据所有权和删除面。对明确缺陷补测试后修复；不为“看起来更完整”增加新抽象或约束。

**Step 6: Final verification commit if needed**

若审阅产生修复，单独提交：

```bash
git add <exact reviewed files>
git commit -m "fix: close m1 memory review findings"
```

最后重新运行 Step 2–4，再按 `superpowers:finishing-a-development-branch` 汇报分支与集成选择，不自动覆盖主 worktree 中用户未提交的改动。
