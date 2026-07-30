# StudyForge 三坐标学习工作台 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在节点化学习 Runtime 之上交付“课程脉络、知识山河、研习留痕”三个平级主视图和一个专注课堂子页面，让学生从课程顺序、方法骨架和来源链三个坐标理解同一组学习事实。

**Architecture:** 共享 Markdown domain 继续拥有方法资产、节点树、全局 Trace、Handoff 和长期记忆；Pi 服务端新增三个只读、安全、可重建的 view projection。前端以 URL 驱动共享选择，通过统一 App Shell 懒加载三个页面，所有写入继续经现有 Coach、Tutor 和受信任 Runtime 完成。

**Tech Stack:** Bun 1.3.14、TypeScript 7、React 19、Vite 8、现有 Pi Runtime、Markdown/YAML domain、原生 CSS/SVG、Bun test、Playwright 1.61。

**Design:** `docs/superpowers/specs/2026-07-30-three-coordinate-learning-workspace-design.md`

**Prerequisite:** `docs/superpowers/plans/2026-07-30-hierarchical-learning-node-runtime.md`

## Global Constraints

- 开始本计划前，必须先完成并验证 `docs/superpowers/plans/2026-07-30-hierarchical-learning-node-runtime.md`，尤其是公开 Node Tree、全局 Trace、三层 Handoff、Node Session Owner v2、Evidence Tree 和 Task 13 的基础组件。
- 实施时从上述 Runtime 的已验证提交创建独立 worktree；不要在当前含用户未提交修改的 `main` 上直接执行，也不要把本计划对未来 Runtime 类型的引用改回旧接口。
- 三页都是可重建投影，不成为 Roadmap、Plan、Lesson、Trace、Handoff、Profile、Session 或 Card 的第二事实所有者。
- 不增加数据库、后台索引、向量库、通用图引擎、第三方 DAG 编辑器、前端事实写入 API 或三套独立状态管理器。
- `graph/method_tree.yaml` 是开发者维护的公共学习集资产；它不是学生状态，也不由 Trace 反向更新。
- Card 的 `graph.method.primary` 和 `graph.method.secondary` 绑定正式方法节点；primary / secondary 是“题卡 → 方法”的边角色，不是方法节点自身的永久类型；`graph.method.subroute` 保持题卡局部说明，不升级成方法树节点。
- Knowledge 状态只能是“尚未观察、已有记录、在不同题卡上更稳定、来源失效”；不得显示精确 mastery 百分比或自动宣称掌握。
- 所有 URL 参数只是选择，不授予文件、Session、题卡、方法或来源的额外可见权限。
- assessment / diagnostic 的 prepared 内容、未揭示 Block、Teacher Control、私有候选路线、完整题解、Agent reasoning、子 Agent raw result 和完整 Pi JSONL 不进入学生投影。
- Memory 默认展示自然语言；Teaching Claim 不逐字进入学生页，只能投影为已发生的公开教学安排关系。
- “提出异议”只把规范 source 和安全问题带回有权限的 Coach；按钮本身不写 Markdown、不删 Trace、不改 Profile，也不声称异议已更正。
- 切换 Course、Knowledge、Memory 不暂停或关闭 Tutor Session，不复制聊天历史；只有已有课堂动作可以改变 Lesson 状态。
- 桌面端优先；窄屏必须退化为可用层级列表，不强塞完整图谱画布。
- 不保留旧 `/`、`/roadmap`、`/plan/...` 路由兼容层；Home、Replay 和继续位置统一写入新 `/course...` 路由。
- 不新增运行依赖；使用 React、原生 SVG、CSS transform、语义 HTML 和现有 KaTeX。
- 不测试 Skill 或 Agent 文本；本计划只测试可执行类型、投影、路由、权限、组件和端到端行为。
- 保留工作树中所有无关用户修改；每个任务只提交其列出的文件。

---

## Dependency Order

```text
Hierarchical Node Runtime complete
        ↓
Task 1  Method Tree asset contract
        ↓
Task 2  Shared view contracts
        ↓
Task 3  Course projection
Task 4  Knowledge projection
Task 5  Memory projection
        ↓
Task 6  HTTP endpoints + invalidation
        ↓
Task 7  Routes + ViewSelection
        ↓
Task 8  App Shell + route loader
        ↓
Task 9  Course page
Task 10 Focused classroom
Task 11 Knowledge page
Task 12 Memory page
        ↓
Task 13 Visual/responsive/accessibility
        ↓
Task 14 Cross-view E2E + docs + release check
```

Tasks 3、4、5 在 Task 2 后可以并行；Tasks 9、10、11、12 在 Task 8 后可以并行，但同一工作树执行时仍应按编号提交，避免同时编辑 `App.tsx` 和共享 CSS。

## File Structure

```text
plugins/highschool-study/server/src/
└── method-tree.ts                 # 正式方法树 YAML 的唯一解析与验证入口

apps/pi-teaching-web/src/
├── shared/
│   └── view-contracts.ts          # 三种只读 projection 的共享类型
├── study/views/
│   ├── view-query.ts              # 服务端选择参数规范化
│   ├── view-disclosure.ts         # 三页共享的学生可见性矩阵
│   ├── course-view.ts             # Roadmap/Plan/Lesson 公开课程树
│   ├── knowledge-view.ts          # 方法树 + Card + active Trace 覆盖层
│   └── memory-view.ts             # Profile/Handoff/Trace 的学生安全来源链
├── client/
│   ├── view-selection.ts          # URL 与共享选择之间的纯映射
│   ├── view-state.ts              # 当前可见 projection 的轻量加载状态
│   ├── components/
│   │   ├── AppShell.tsx
│   │   ├── PrimaryViewNav.tsx
│   │   ├── CurrentSelectionChip.tsx
│   │   ├── CourseTree.tsx
│   │   ├── PlanStage.tsx
│   │   ├── CourseInspector.tsx
│   │   ├── MethodFilters.tsx
│   │   ├── MethodLandscape.tsx
│   │   ├── MethodInspector.tsx
│   │   ├── MemoryDirectory.tsx
│   │   ├── EvidenceLineage.tsx
│   │   └── EvidenceDetail.tsx
│   ├── pages/
│   │   ├── CoursePage.tsx
│   │   ├── FocusedClassroomPage.tsx
│   │   ├── KnowledgePage.tsx
│   │   └── MemoryPage.tsx
│   └── styles/
│       ├── workspace-shell.css
│       ├── course.css
│       ├── classroom.css
│       ├── knowledge.css
│       ├── memory.css
│       └── responsive.css
└── server/
    └── app.ts                      # 只读 view endpoints 与失效通知
```

---

## Task 1: 建立正式 Method Tree 公共资产契约

**Files:**

- Create: `plugins/highschool-study/server/src/method-tree.ts`
- Modify: `plugins/highschool-study/server/src/cards.ts`
- Modify: `plugins/highschool-study/server/src/domain.ts`
- Create: `plugins/highschool-study/tests/unit/method-tree.test.ts`
- Create: `plugins/highschool-study/learning-set-template/graph/method_tree.yaml`
- Create: `plugins/highschool-study/tests/fixtures/learning-set/graph/method_tree.yaml`
- Create: `apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/graph/method_tree.yaml`
- Create: `examples/derivative-demo/learning-set/graph/method_tree.yaml`
- Modify: `plugins/highschool-study/tests/contract/package-and-template.test.ts`
- Modify: `plugins/highschool-study/tests/contract/public-demo.test.ts`

**Interfaces:**

- Consumes: `listCanonicalMethodNames(root)` and existing `CardContent.methods`.
- Durable fact boundary: this file owns only stable method-node IDs,
  parentage, root label, and curator order. Its only writer is the
  learning-set curator through ordinary files/Git; Coach, Tutor, Trace,
  Runtime, and student UI have no write surface. `readMethodTree` is the sole
  reader boundary, and all Knowledge state remains a rebuildable projection.
- Produces:

```ts
export type MethodTreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  // Derived from YAML array position; not persisted as a second ordering fact.
  order: number;
};

export type MethodTree = {
  rootId: string;
  nodes: MethodTreeNode[];
};

export type CardMaterialRef = {
  path: string;
  label: string;
  kind: 'text' | 'image' | 'media';
};

export function readMethodTree(root: string): MethodTree;
export function listCards(root: string): CardContent[];
```

- Later tasks rely only on `readMethodTree` and `listCards`; they do not parse YAML or walk `cards/` themselves.
- Persistent Method Tree fields are intentionally smaller than the reader
  projection:
  - exactly one `parent_id: null` derives `rootId`;
  - YAML array position derives `order`;
  - the root owns `root_label`;
  - every non-root owns one `method` foreign key into
    `graph/vocabulary.yaml`;
  - there is no persisted `root_id`, `order`, duplicate non-root `name`, card
    role, evidence count, or learner state.
- Add `materials: CardMaterialRef[]` to `CardContent`. It contains normalized
  `materials/...` paths from `source_evidence.source_refs` and
  `source_evidence.source_images`, deduplicated in source order. It contains
  no source excerpt, answer, rubric, or arbitrary YAML field.

- [ ] **Step 1: Write the failing method-tree contract tests**

Create `plugins/highschool-study/tests/unit/method-tree.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSetWithLesson } from '../helpers/learning-set';
import { readMethodTree } from '../../server/src/method-tree';
import { listCards } from '../../server/src/cards';

function writeTree(root: string, body: string): void {
  mkdirSync(join(root, 'graph'), { recursive: true });
  writeFileSync(join(root, 'graph/method_tree.yaml'), body);
}

test('derives root and order while resolving non-root canonical methods', () => {
  const root = makeLearningSetWithLesson();
  writeTree(root, `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 圆锥曲线方法体系, parent_id: null }
  - { id: freeze, method: 冻结变量法, parent_id: methods }
  - { id: eliminate, method: 参数化与消元, parent_id: methods }
`);

  expect(readMethodTree(root)).toEqual({
    rootId: 'methods',
    nodes: [
      { id: 'methods', name: '圆锥曲线方法体系', parentId: null, order: 0 },
      { id: 'freeze', name: '冻结变量法', parentId: 'methods', order: 1 },
      { id: 'eliminate', name: '参数化与消元', parentId: 'methods', order: 2 },
    ],
  });
});

test('rejects duplicates, missing methods, missing parents and cycles', () => {
  const invalidTrees = [
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: methods, method: 冻结变量法, parent_id: methods }`,
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: a, method: 冻结变量法, parent_id: methods }
  - { id: b, method: 冻结变量法, parent_id: methods }`,
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: a, method: 冻结变量法, parent_id: methods }`,
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: a, method: 冻结变量法, parent_id: missing }`,
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: a, method: 冻结变量法, parent_id: b }
  - { id: b, method: 参数化与消元, parent_id: a }`,
  ];
  for (const body of invalidTrees) {
    const root = makeLearningSetWithLesson();
    writeTree(root, body);
    expect(() => readMethodTree(root)).toThrow('METHOD_TREE_INVALID');
  }
});

test('does not promote card-local subroutes into formal nodes', () => {
  const root = makeLearningSetWithLesson();
  writeTree(root, `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: freeze, method: 冻结变量法, parent_id: methods }
  - { id: eliminate, method: 参数化与消元, parent_id: methods }
`);
  expect(readMethodTree(root).nodes.map((node) => node.name))
    .not.toContain('先冻结目标量再检查定义域');
});

test('normalizes card-linked materials without exposing card internals', () => {
  const root = makeLearningSetWithLesson();
  writeFileSync(join(root, 'cards/conics/material-ref.card.yaml'), `schema: highschool-study.problem-card.v1
content_item_id: material-ref
stem: 材料引用测试
graph:
  goal: { primary: 极值最值 }
  method:
    primary: 冻结变量法
    secondary: []
source_evidence:
  source_refs:
    - materials/math/conics/page_001.md:12-18
    - { path: materials/math/conics/page_001.md, role: local_context }
  source_images:
    - { path: materials/math/conics/page_001.png }
`);
  const card = listCards(root).find((item) => item.path.endsWith('material-ref.card.yaml'))!;
  expect(card.materials).toEqual([
    {
      path: 'materials/math/conics/page_001.md',
      label: 'page_001.md',
      kind: 'text',
    },
    {
      path: 'materials/math/conics/page_001.png',
      label: 'page_001.png',
      kind: 'image',
    },
  ]);
  expect(JSON.stringify(card.materials)).not.toContain('answer');
});
```

- [ ] **Step 2: Run the focused tests and confirm the missing module failure**

Run:

```bash
cd plugins/highschool-study
bun test tests/unit/method-tree.test.ts
```

Expected: FAIL because `server/src/method-tree.ts` does not exist.

- [ ] **Step 3: Implement strict parsing and card catalog enumeration**

Implement `method-tree.ts` with these rules:

```ts
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';
import { resolveInsideRoot } from './learning-set';
import { listCanonicalMethodNames } from './method-vocabulary';

export type MethodTreeNode = {
  id: string;
  name: string;
  parentId: string | null;
  order: number;
};

export type MethodTree = {
  rootId: string;
  nodes: MethodTreeNode[];
};

function invalid(): never {
  throw new Error('METHOD_TREE_INVALID');
}

const methodIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function exactKeys(
  value: Record<string, unknown>,
  allowed: string[],
): boolean {
  return Object.keys(value).sort().join('\0') === [...allowed].sort().join('\0');
}

export function readMethodTree(root: string): MethodTree {
  const path = resolveInsideRoot(root, join('graph', 'method_tree.yaml'));
  if (!existsSync(path)) invalid();
  const parsed = parse(readFileSync(path, 'utf8')) as unknown;
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) invalid();
  const raw = parsed as Record<string, unknown>;
  if (
    !exactKeys(raw, ['schema', 'nodes'])
    || raw.schema !== 'studyforge.method_tree.v1'
    || !Array.isArray(raw.nodes)
  ) invalid();
  const nodes = raw.nodes.map((value, order) => {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) invalid();
    const node = value as Record<string, unknown>;
    if (typeof node.id !== 'string') invalid();
    const parentId = node.parent_id === null
      ? null
      : typeof node.parent_id === 'string'
        ? node.parent_id.trim()
        : invalid();
    const name = parentId === null
      ? exactKeys(node, ['id', 'root_label', 'parent_id'])
        && typeof node.root_label === 'string'
        ? node.root_label.trim()
        : invalid()
      : exactKeys(node, ['id', 'method', 'parent_id'])
        && typeof node.method === 'string'
        ? node.method.trim()
        : invalid();
    return {
      id: node.id.trim(),
      name,
      parentId,
      order,
    };
  });
  const ids = new Set(nodes.map((node) => node.id));
  const names = new Set(nodes.map((node) => node.name));
  const roots = nodes.filter((node) => node.parentId === null);
  if (
    nodes.some((node) => (
      !methodIdPattern.test(node.id)
      || !node.name
    ))
    || ids.size !== nodes.length
    || names.size !== nodes.length
    || roots.length !== 1
  ) invalid();
  const rootId = roots[0]!.id;
  const canonical = new Set(listCanonicalMethodNames(root));
  const methodNames = new Set(
    nodes.filter((node) => node.id !== rootId).map((node) => node.name),
  );
  if (
    methodNames.size !== canonical.size
    || [...methodNames].some((name) => !canonical.has(name))
  ) invalid();
  for (const node of nodes) {
    if (node.parentId !== null && !ids.has(node.parentId)) invalid();
    const visited = new Set<string>();
    let current: MethodTreeNode | undefined = node;
    while (current?.parentId !== null) {
      if (visited.has(current.id)) invalid();
      visited.add(current.id);
      current = nodes.find((candidate) => candidate.id === current!.parentId);
    }
  }
  return {
    rootId,
    nodes,
  };
}
```

In `cards.ts`, export a read-only catalog using the existing private loader:

```ts
export function listCards(root: string): CardContent[] {
  return cardPaths(root)
    .map((path) => loadCard(root, path)?.card ?? null)
    .filter((card): card is CardContent => card !== null);
}
```

Extend the existing private loader once, rather than reparsing Card YAML in a
view. Accept both current source shapes:

```ts
function sourcePath(value: unknown): string | null {
  const object = record(value);
  const candidate = typeof value === 'string'
    ? value
    : typeof object?.path === 'string'
      ? object.path
      : '';
  const path = candidate.trim().replace(/:\d+(?:-\d+)?$/, '');
  return path.startsWith('materials/')
    && !path.split('/').some((segment) => (
      segment === '' || segment === '.' || segment === '..'
    ))
    ? path
    : null;
}
```

Collect `source_refs` and `source_images`, derive `kind` from the extension,
use `basename(path)` (added to the existing `node:path` import) as the public
label, and deduplicate by path. Existing card search behavior remains
unchanged.

Export `readMethodTree`, `MethodTree`, `MethodTreeNode`, and `listCards` from `domain.ts`. Do not add an MCP tool.

- [ ] **Step 4: Add the explicit derivative method tree assets**

Use this exact root and the existing 16 canonical method clusters in
`examples/derivative-demo/learning-set/graph/method_tree.yaml`:

```yaml
schema: studyforge.method_tree.v1
nodes:
  - { id: derivative-methods, root_label: 导数方法体系, parent_id: null }
  - { id: preservation, method: 保值性与分治, parent_id: derivative-methods }
  - { id: necessity, method: 充分/必要性探路, parent_id: derivative-methods }
  - { id: tangent, method: 切线放缩与凹凸性, parent_id: derivative-methods }
  - { id: parameter, method: 参变量分离, parent_id: derivative-methods }
  - { id: isomorphic, method: 同构变形与换元法, parent_id: derivative-methods }
  - { id: classification, method: 含参数分类讨论, parent_id: derivative-methods }
  - { id: symmetry-offset, method: 对称化与偏移, parent_id: derivative-methods }
  - { id: symmetry-fit, method: 对称性配凑, parent_id: derivative-methods }
  - { id: local-approximation, method: 局部逼近与找点, parent_id: derivative-methods }
  - { id: fitting, method: 拟合与夹逼, parent_id: derivative-methods }
  - { id: sequence-sum, method: 数列和转化, parent_id: derivative-methods }
  - { id: graph, method: 数形结合, parent_id: derivative-methods }
  - { id: visible-hidden, method: 显隐点探路, parent_id: derivative-methods }
  - { id: principal, method: 自由度与主元, parent_id: derivative-methods }
  - { id: reverse, method: 逆向构造法, parent_id: derivative-methods }
  - { id: recurrence, method: 递推转化, parent_id: derivative-methods }
```

The package template and small fixtures use a root plus every canonical
method in their vocabulary. Contract tests assert the file is packaged, every
Card primary/secondary resolves, and the non-root Method Tree methods equal
`listCanonicalMethodNames(root)` exactly. Thus a later Trace cannot refer to a
canonical method that has no formal Knowledge node.

- [ ] **Step 5: Run method-asset verification**

Run:

```bash
cd plugins/highschool-study
bun test tests/unit/method-tree.test.ts \
  tests/contract/package-and-template.test.ts \
  tests/contract/public-demo.test.ts
bun run typecheck
git diff --check
```

Expected: all focused tests and typecheck PASS; public MCP tool count remains unchanged.

- [ ] **Step 6: Commit the method asset contract**

```bash
git add plugins/highschool-study/server/src/method-tree.ts \
  plugins/highschool-study/server/src/cards.ts \
  plugins/highschool-study/server/src/domain.ts \
  plugins/highschool-study/tests/unit/method-tree.test.ts \
  plugins/highschool-study/learning-set-template/graph/method_tree.yaml \
  plugins/highschool-study/tests/fixtures/learning-set/graph/method_tree.yaml \
  apps/pi-teaching-web/tests/fixtures/domain-integrity-learning-set/graph/method_tree.yaml \
  examples/derivative-demo/learning-set/graph/method_tree.yaml \
  plugins/highschool-study/tests/contract/package-and-template.test.ts \
  plugins/highschool-study/tests/contract/public-demo.test.ts
git commit -m "feat: define formal method tree assets"
```

---

## Task 2: 定义三种只读 View Contract 与选择参数

**Files:**

- Create: `apps/pi-teaching-web/src/shared/view-contracts.ts`
- Create: `apps/pi-teaching-web/src/study/views/view-query.ts`
- Create: `apps/pi-teaching-web/src/study/views/view-disclosure.ts`
- Create: `apps/pi-teaching-web/tests/study/view-query.test.ts`
- Create: `apps/pi-teaching-web/tests/study/view-disclosure.test.ts`

**Interfaces:**

- Consumes: `ActivityKind`, `NodeLifecycleStatus`, and `SessionKey`.
- Produces:

```ts
export type ViewQuery = {
  planId: string | null;
  lessonId: string | null;
  methodName: string | null;
  cardPath: string | null;
  evidenceSource: string | null;
  topicId: string | null;
  timeRange: 'lesson' | 'plan' | 'all';
};

export function readViewQuery(params: URLSearchParams): ViewQuery;
export function formatViewQuery(query: ViewQuery): string;
export function normalizeViewId(value: string | null): string | null;

export type ViewDisclosurePolicy = {
  mayExposeLessonBindings: boolean;
  visibleBlockStatuses: BlockStatus[];
  mayExposeHistoricalLineage: boolean;
  mayExposeTeachingClaimText: false;
};

export function disclosureForLesson(
  status: NodeLifecycleStatus | null,
): ViewDisclosurePolicy;
```

- Produces the exact `CourseViewProjection`, `KnowledgeViewProjection`, and
  `MemoryViewProjection` types consumed by Tasks 3–12.
- `view-disclosure.ts` is the one shared high-risk disclosure matrix. Tasks
  3–5 may add data-specific allowlists, but may not redefine prepared,
  revealed-Block, historical-lineage, or Teaching Claim visibility.

- [ ] **Step 1: Write failing query-normalization tests**

Create `apps/pi-teaching-web/tests/study/view-query.test.ts`:

```ts
import { expect, test } from 'bun:test';
import {
  formatViewQuery,
  readViewQuery,
} from '../../src/study/views/view-query';

test('normalizes the shared cross-view selection', () => {
  const query = readViewQuery(new URLSearchParams({
    plan: ' route-choice ',
    lesson: ' lesson-004 ',
    method: '同构变形与换元法',
    card: 'cards/derivative/example.card.yaml',
    source: 'trace:trace-11111111-1111-4111-8111-111111111111',
    topic: 'derivative-methods',
    range: 'plan',
  }));
  expect(query).toEqual({
    planId: 'route-choice',
    lessonId: 'lesson-004',
    methodName: '同构变形与换元法',
    cardPath: 'cards/derivative/example.card.yaml',
    evidenceSource: 'trace:trace-11111111-1111-4111-8111-111111111111',
    topicId: 'derivative-methods',
    timeRange: 'plan',
  });
  const serialized = formatViewQuery(query);
  expect(readViewQuery(new URLSearchParams(serialized.slice(1)))).toEqual(query);
});

test('drops malformed ids, paths and source handles without widening scope', () => {
  const query = readViewQuery(new URLSearchParams({
    plan: '../outside',
    lesson: 'lesson/../../secret',
    card: '../answer.yaml',
    source: 'file:/tmp/private',
    range: 'forever',
  }));
  expect(query).toEqual({
    planId: null,
    lessonId: null,
    methodName: null,
    cardPath: null,
    evidenceSource: null,
    topicId: null,
    timeRange: 'all',
  });
});
```

Create `apps/pi-teaching-web/tests/study/view-disclosure.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { disclosureForLesson } from '../../src/study/views/view-disclosure';

test('keeps prepared bindings private and reveals only occurred classroom blocks', () => {
  expect(disclosureForLesson('prepared')).toEqual({
    mayExposeLessonBindings: false,
    visibleBlockStatuses: [],
    mayExposeHistoricalLineage: false,
    mayExposeTeachingClaimText: false,
  });
  expect(disclosureForLesson('active')).toEqual({
    mayExposeLessonBindings: true,
    visibleBlockStatuses: ['active', 'completed'],
    mayExposeHistoricalLineage: true,
    mayExposeTeachingClaimText: false,
  });
  expect(disclosureForLesson('closed')).toEqual({
    mayExposeLessonBindings: true,
    visibleBlockStatuses: ['completed'],
    mayExposeHistoricalLineage: true,
    mayExposeTeachingClaimText: false,
  });
});
```

- [ ] **Step 2: Run the focused test and confirm the missing module failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/view-query.test.ts
```

Expected: FAIL because `view-query.ts` and `view-disclosure.ts` do not exist.

- [ ] **Step 3: Define the shared projection contracts**

Create `src/shared/view-contracts.ts` with these exact public shapes:

```ts
import type {
  ActivityKind,
  NodeLifecycleStatus,
  SessionKey,
} from './contracts';

export type ViewQuery = {
  planId: string | null;
  lessonId: string | null;
  methodName: string | null;
  cardPath: string | null;
  evidenceSource: string | null;
  topicId: string | null;
  timeRange: 'lesson' | 'plan' | 'all';
};

export type CourseTreeNode = {
  key: string;
  kind: 'roadmap' | 'plan' | 'lesson';
  nodeId: string | null;
  parentKey: string | null;
  handle: string;
  title: string;
  publicPurpose: string;
  status: NodeLifecycleStatus;
  after: string | null;
  dependsOn: string[];
  route: string | null;
  sessionKey: SessionKey | null;
  children: CourseTreeNode[];
};

export type PublicPlanView = {
  id: string;
  title: string;
  status: NodeLifecycleStatus;
  goal: string;
  capabilityStandard: string;
  currentPosition: string;
  closedLessons: number;
  registeredLessons: number;
};

export type PublicLessonView = {
  id: string;
  status: NodeLifecycleStatus;
  publicTitle: string;
  publicPurpose: string | null;
  blockCount: number;
  blockKinds: ActivityKind[];
  sourceNumbers: string[];
  canStart: boolean;
  canReprepare: boolean;
  canContinue: boolean;
  canReplay: boolean;
};

export type CourseViewProjection = {
  learningSet: { title: string; overview: string; goal: string };
  roadmap: CourseTreeNode;
  plans: CourseTreeNode[];
  selectedPlan: PublicPlanView | null;
  selectedLesson: PublicLessonView | null;
  continueTarget: { route: string; title: string; detail: string };
};

export type KnowledgeNodeState =
  | 'unobserved'
  | 'observed'
  | 'more-stable'
  | 'invalidated';

export type KnowledgeGraphNode = {
  id: string;
  label: string;
  parentId: string | null;
  state: KnowledgeNodeState;
  evidenceCount: number;
  distinctCardCount: number;
  selected: boolean;
  currentLesson: boolean;
};

export type KnowledgeGraphEdge = {
  id: string;
  from: string;
  to: string;
  kind: 'hierarchy';
};

export type PublicMethodCard = {
  cardPath: string;
  title: string;
  role: 'primary' | 'secondary';
};

export type PublicMaterialLink = {
  path: string;
  label: string;
  kind: 'text' | 'image' | 'media';
  viaCardPath: string | null;
};

export type PublicLessonPin = {
  lessonId: string;
  planId: string;
  title: string;
  methodIds: string[];
  route: string;
};

export type PublicMethodEvidence = {
  source: string;
  lessonId: string;
  planId: string;
  cardPath: string | null;
  materialPath: string | null;
  assessment: string;
  support: string;
  occurredAt: string;
  active: boolean;
};

export type PublicMethodDetail = {
  methodId: string;
  name: string;
  parent: { id: string; name: string } | null;
  children: Array<{ id: string; name: string }>;
  cards: PublicMethodCard[];
  materials: PublicMaterialLink[];
  lessons: PublicLessonPin[];
  evidence: PublicMethodEvidence[];
  boundary: string;
};

export type PublicKnowledgeFilters = {
  planId: string | null;
  topicId: string | null;
  timeRange: 'lesson' | 'plan' | 'all';
  availablePlans: Array<{ id: string; title: string }>;
  availableTopics: Array<{ id: string; title: string }>;
};

export type KnowledgeViewProjection = {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  lessonPins: PublicLessonPin[];
  selectedMethod: PublicMethodDetail | null;
  filters: PublicKnowledgeFilters;
};

export type PublicEvidenceState = 'active' | 'invalidated' | 'missing' | 'forbidden';

export type PublicMemoryItem = {
  id: string;
  owner: 'student' | 'teaching';
  content: string;
  scope: string;
  rationale: string;
  counterEvidence: string;
  sources: string[];
  sourceState: PublicEvidenceState;
};

export type PublicFinding = {
  id: string;
  level: 'roadmap' | 'plan' | 'lesson';
  statement: string;
  boundary: string;
  nextUse: string;
  sources: string[];
  state: PublicEvidenceState;
};

export type PublicOpenQuestion = {
  id: string;
  level: 'roadmap' | 'plan' | 'lesson';
  question: string;
  nextCheck: string;
  sources: string[];
  state: PublicEvidenceState;
};

export type PublicSourceIndex = {
  id: string;
  level: 'roadmap' | 'plan' | 'lesson';
  label: string;
  sources: string[];
  state: PublicEvidenceState;
};

export type PublicEvidenceNode = {
  source: string;
  label: string;
  kind: 'memory' | 'claim' | 'trace' | 'session' | 'card' | 'block';
  state: PublicEvidenceState;
  children: PublicEvidenceNode[];
};

export type PublicObjectionTarget = {
  source: string;
  route: string;
  sessionKey: SessionKey;
  prefill: string;
};

export type PublicEvidenceDetail = {
  source: string;
  title: string;
  summary: string;
  studentQuote: string | null;
  state: PublicEvidenceState;
  occurredAt: string | null;
  planId: string | null;
  lessonId: string | null;
  blockId: string | null;
  cardPath: string | null;
  materialPath: string | null;
  methods: string[];
  assessment: string | null;
  support: string | null;
  boundary: string | null;
  objection: PublicObjectionTarget | null;
};

export type PublicMemoryFilters = {
  timeRange: 'lesson' | 'plan' | 'all';
  planId: string | null;
  lessonId: string | null;
};

export type MemoryViewProjection = {
  confirmed: PublicMemoryItem[];
  stageFindings: PublicFinding[];
  openQuestions: PublicOpenQuestion[];
  sourceIndexes: PublicSourceIndex[];
  selectedSource: string | null;
  lineage: PublicEvidenceNode | null;
  detail: PublicEvidenceDetail | null;
  filters: PublicMemoryFilters;
};
```

Keep the file type-only. Do not add runtime validation or a second state schema.

- [ ] **Step 4: Implement strict query normalization**

Create `view-query.ts`:

```ts
import type { ViewQuery } from '../../shared/view-contracts';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const cardPattern = /^cards\/[A-Za-z0-9][A-Za-z0-9._/-]*\.ya?ml$/;
const sourcePattern =
  /^(?:trace:[A-Za-z0-9._-]+|session:[A-Za-z0-9._-]+(?:#message:[A-Za-z0-9._-]+)?|card:cards\/[A-Za-z0-9][A-Za-z0-9._/-]*\.ya?ml|block:[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+|claim:[A-Za-z0-9._/-]+#(?:learner-c\\d+|teaching-t\\d+)|memory:(?:student|teaching)\/[A-Za-z0-9._-]+)$/;

function clean(value: string | null): string | null {
  const result = value?.trim() ?? '';
  return result || null;
}

export function normalizeViewId(value: string | null): string | null {
  const result = clean(value);
  return result && idPattern.test(result) ? result : null;
}

function hasSafeSegments(value: string): boolean {
  return !value.split('/').some((segment) => (
    segment === '' || segment === '.' || segment === '..'
  ));
}

export function readViewQuery(params: URLSearchParams): ViewQuery {
  const planId = normalizeViewId(params.get('plan'));
  const lessonId = normalizeViewId(params.get('lesson'));
  const methodName = clean(params.get('method'));
  const cardPath = clean(params.get('card'));
  const evidenceSource = clean(params.get('source'));
  const topicId = clean(params.get('topic'));
  const range = params.get('range');
  return {
    planId,
    lessonId,
    methodName,
    cardPath: cardPath && cardPattern.test(cardPath) && hasSafeSegments(cardPath)
      ? cardPath
      : null,
    evidenceSource: evidenceSource
      && sourcePattern.test(evidenceSource)
      && hasSafeSegments(evidenceSource)
      ? evidenceSource
      : null,
    topicId: normalizeViewId(topicId),
    timeRange: range === 'lesson' || range === 'plan' ? range : 'all',
  };
}

export function formatViewQuery(query: ViewQuery): string {
  const params = new URLSearchParams();
  if (query.planId) params.set('plan', query.planId);
  if (query.lessonId) params.set('lesson', query.lessonId);
  if (query.methodName) params.set('method', query.methodName);
  if (query.cardPath) params.set('card', query.cardPath);
  if (query.evidenceSource) params.set('source', query.evidenceSource);
  if (query.topicId) params.set('topic', query.topicId);
  if (query.timeRange !== 'all') params.set('range', query.timeRange);
  const value = params.toString();
  return value ? `?${value}` : '';
}
```

The parser validates shape only. Each projection still resolves the selection
against the real current learning set and drops inaccessible values.

Create `view-disclosure.ts` as a pure exhaustive status switch:

```ts
import type {
  BlockStatus,
  NodeLifecycleStatus,
} from '../../shared/contracts';

export type ViewDisclosurePolicy = {
  mayExposeLessonBindings: boolean;
  visibleBlockStatuses: BlockStatus[];
  mayExposeHistoricalLineage: boolean;
  mayExposeTeachingClaimText: false;
};

export function disclosureForLesson(
  status: NodeLifecycleStatus | null,
): ViewDisclosurePolicy {
  if (status === 'active' || status === 'paused') {
    return {
      mayExposeLessonBindings: true,
      visibleBlockStatuses: ['active', 'completed'],
      mayExposeHistoricalLineage: true,
      mayExposeTeachingClaimText: false,
    };
  }
  if (status === 'closed' || status === 'completed' || status === 'abandoned') {
    return {
      mayExposeLessonBindings: true,
      visibleBlockStatuses: ['completed'],
      mayExposeHistoricalLineage: true,
      mayExposeTeachingClaimText: false,
    };
  }
  return {
    mayExposeLessonBindings: false,
    visibleBlockStatuses: [],
    mayExposeHistoricalLineage: false,
    mayExposeTeachingClaimText: false,
  };
}
```

The policy does not grant access by itself. It is combined with a verified
real Plan/Lesson owner and existing Student Projection / Evidence Tree scope.
In particular, `prepared` never becomes visible merely because a URL names
its Lesson.

- [ ] **Step 5: Verify types and query tests**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/view-query.test.ts
bun test tests/study/view-disclosure.test.ts
bun run typecheck
git diff --check
```

Expected: tests and typecheck PASS.

- [ ] **Step 6: Commit the contracts**

```bash
git add apps/pi-teaching-web/src/shared/view-contracts.ts \
  apps/pi-teaching-web/src/study/views/view-query.ts \
  apps/pi-teaching-web/src/study/views/view-disclosure.ts \
  apps/pi-teaching-web/tests/study/view-query.test.ts \
  apps/pi-teaching-web/tests/study/view-disclosure.test.ts
git commit -m "feat: define three-coordinate view contracts"
```

---

## Task 3: 实现 Course View 公开课程树投影

**Files:**

- Create: `apps/pi-teaching-web/src/study/views/course-view.ts`
- Create: `apps/pi-teaching-web/tests/study/course-view.test.ts`

**Interfaces:**

- Consumes:

```ts
readLearningSet(root: string): LearningSetSnapshot;
readPlanWorkspace(root: string, planId: string): PlanWorkspaceSnapshot;
readHomeSnapshot(root: string): HomeSnapshot;
disclosureForLesson(status: NodeLifecycleStatus | null): ViewDisclosurePolicy;
```

- Produces:

```ts
export function readCourseView(
  root: string,
  query: Pick<ViewQuery, 'planId' | 'lessonId'>,
): CourseViewProjection;
```

- Task 6 exposes this function through `GET /api/views/course`.

- [ ] **Step 1: Write the failing safe-course-projection tests**

Create `apps/pi-teaching-web/tests/study/course-view.test.ts` using the
hierarchical fixture:

```ts
import { expect, test } from 'bun:test';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';
import { readCourseView } from '../../src/study/views/course-view';

test('projects Roadmap, Plan, materialized Lesson and Candidate without private fields', () => {
  const view = readCourseView(domainIntegrityFixtureRoot, {
    planId: 'domain-integrity',
    lessonId: null,
  });
  expect(view.roadmap.kind).toBe('roadmap');
  expect(view.plans.some((node) => node.kind === 'plan')).toBe(true);
  const candidate = view.plans
    .flatMap((plan) => plan.children)
    .find((node) => node.status === 'candidate');
  expect(candidate).toMatchObject({
    nodeId: null,
    route: null,
    sessionKey: null,
    title: '可能的下一步',
  });
  expect(JSON.stringify(view)).not.toContain('Consider when');
  expect(JSON.stringify(view)).not.toContain('Private note');
  expect(JSON.stringify(view)).not.toContain('Teacher Control');
  expect(JSON.stringify(view)).not.toContain('Adaptation Brief');
});

test('uses the safe prepared preview instead of the hidden Lesson title', () => {
  const view = readCourseView(domainIntegrityFixtureRoot, {
    planId: 'domain-integrity',
    lessonId: 'lesson-003',
  });
  expect(view.selectedLesson?.status).toBe('prepared');
  expect(view.selectedLesson?.publicTitle).toBe('待开始课程');
  expect(JSON.stringify(view)).not.toContain('冻结变量法绝密诊断');
});

test('drops a nonexistent selection and keeps the Roadmap projection usable', () => {
  const view = readCourseView(domainIntegrityFixtureRoot, {
    planId: 'missing-plan',
    lessonId: 'missing-lesson',
  });
  expect(view.selectedPlan).toBeNull();
  expect(view.selectedLesson).toBeNull();
  expect(view.roadmap.children.length).toBeGreaterThan(0);
});
```

- [ ] **Step 2: Run the focused test and confirm the missing reader failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/course-view.test.ts
```

Expected: FAIL because `course-view.ts` does not exist.

- [ ] **Step 3: Build the course tree from public runtime projections**

Implement `readCourseView` with these deterministic mappings:

```ts
const statusTitle = {
  candidate: '可能的下一步',
  prepared: '待开始课程',
  active: '正在进行',
  paused: '已暂停课程',
  closed: '已完成课程',
  completed: '已完成阶段',
  abandoned: '历史记录',
} as const;

function lessonRoute(planId: string, lessonId: string): string {
  return `/course/plan/${encodeURIComponent(planId)}/lesson/${encodeURIComponent(lessonId)}`;
}

function planRoute(planId: string): string {
  return `/course/plan/${encodeURIComponent(planId)}`;
}
```

Build the Roadmap root with `route: '/course'` and
`sessionKey: 'coach:@roadmap'`. For each public `planTree` entry:

1. Candidate uses only `handle`, `publicPurpose`, `after`, `dependsOn`, and
   `status`; its node ID, route, title, and Session stay absent or generic.
2. Materialized Plan reads title/status from the verified child file and gets
   `/course/plan/<id>`.
3. Only the selected materialized Plan loads its `lessonTree`; do not scan
   sibling directories.
4. Materialized Lesson route comes from verified `nodeId`; Candidate has no
   route.
5. Prepared Lesson title/purpose/activity shape comes from the existing
   `StudentPlanProjection`, never raw Plan text or Teacher Control.
6. Active/paused/terminal Lessons may use their public runtime title.
7. `canStart`, `canReprepare`, `canContinue`, and `canReplay` are derived from
   status, not model text.
8. Any Lesson-bound Card/Block summary shown here must first pass
   `disclosureForLesson`; Course must not create a looser local status table.

Return the existing deterministic Home continue target rewritten to `/course`
routes. Do not mutate Home or workspace facts.

- [ ] **Step 4: Add status and action-boundary coverage**

Add assertions for:

```ts
expect(prepared).toMatchObject({
  canStart: true,
  canReprepare: true,
  canContinue: false,
  canReplay: false,
});
expect(active).toMatchObject({
  canStart: false,
  canReprepare: false,
  canContinue: true,
  canReplay: false,
});
expect(closed).toMatchObject({
  canStart: false,
  canReprepare: false,
  canContinue: false,
  canReplay: true,
});
```

Also assert Candidate never gets an action route and terminal Lesson keeps a
Replay route without reopening a writable Tutor Session.

- [ ] **Step 5: Run Course projection verification**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/course-view.test.ts \
  tests/study/home.test.ts \
  tests/study/read-workspace.test.ts
bun run typecheck
git diff --check
```

Expected: focused tests and typecheck PASS.

- [ ] **Step 6: Commit the Course projection**

```bash
git add apps/pi-teaching-web/src/study/views/course-view.ts \
  apps/pi-teaching-web/tests/study/course-view.test.ts
git commit -m "feat: project the public course tree"
```

---

## Task 4: 实现 Knowledge View 方法骨架与学习轨迹投影

**Files:**

- Create: `apps/pi-teaching-web/src/study/views/knowledge-view.ts`
- Create: `apps/pi-teaching-web/tests/study/knowledge-view.test.ts`
- Create: `apps/pi-teaching-web/tests/support/view-learning-set.ts`

**Interfaces:**

- Consumes:

```ts
readMethodTree(root: string): MethodTree;
listCards(root: string): CardContent[];
readTraceRecords(root: string): TraceRecord[];
readActiveTraces(root: string): TraceRecord[];
aggregateMethodSignals(root: string, traces: TraceRecord[]): MethodSignal[];
disclosureForLesson(status: NodeLifecycleStatus | null): ViewDisclosurePolicy;
```

- Produces:

```ts
export function readKnowledgeView(
  root: string,
  query: ViewQuery,
): KnowledgeViewProjection;
```

- The projection contains no numeric score and never mutates `method_tree.yaml`.

- [ ] **Step 1: Write failing knowledge-projection tests**

Create `apps/pi-teaching-web/tests/study/knowledge-view.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { readKnowledgeView } from '../../src/study/views/knowledge-view';
import {
  clearTracePool,
  copyViewLearningSet,
  installInvalidatedOnlyMethod,
} from '../support/view-learning-set';

const emptyQuery = {
  planId: null,
  lessonId: null,
  methodName: null,
  cardPath: null,
  evidenceSource: null,
  topicId: null,
  timeRange: 'all' as const,
};

test('keeps the complete formal method skeleton when no Trace exists', () => {
  const root = copyViewLearningSet();
  clearTracePool(root);
  const view = readKnowledgeView(root, emptyQuery);
  expect(view.nodes.length).toBeGreaterThan(1);
  expect(view.nodes.every((node) => node.state === 'unobserved')).toBe(true);
  expect(view.lessonPins).toEqual([]);
  expect(JSON.stringify(view)).not.toContain('"score"');
  expect(JSON.stringify(view)).not.toContain('"mastery"');
});

test('distinguishes observed evidence from repeated independent cards', () => {
  const root = copyViewLearningSet();
  const overview = readKnowledgeView(root, emptyQuery);
  const observed = overview.nodes.find((item) => item.evidenceCount > 0)!;
  const view = readKnowledgeView(root, {
    ...emptyQuery,
    methodName: observed.label,
  });
  const node = view.nodes.find((item) => item.id === observed.id);
  expect(node?.evidenceCount).toBeGreaterThan(0);
  expect(node?.distinctCardCount).toBeGreaterThan(0);
  expect(node?.state).toBe(
    node && node.distinctCardCount >= 2 ? 'more-stable' : 'observed',
  );
  expect(view.selectedMethod?.boundary).toContain('学习记录');
});

test('does not attach hidden prepared assessment cards or methods to the Lesson', () => {
  const view = readKnowledgeView(copyViewLearningSet(), {
    ...emptyQuery,
    planId: 'domain-integrity',
    lessonId: 'lesson-003',
  });
  expect(view.lessonPins.find((pin) => pin.lessonId === 'lesson-003')).toBeUndefined();
  expect(JSON.stringify(view)).not.toContain('Teacher Control');
});

test('keeps invalidated history visible without using it as active evidence', () => {
  const root = copyViewLearningSet();
  const methodName = installInvalidatedOnlyMethod(root);
  const view = readKnowledgeView(root, {
    ...emptyQuery,
    methodName,
  });
  const node = view.nodes.find((item) => item.label === methodName);
  expect(node?.state).toBe('invalidated');
  expect(node?.evidenceCount).toBe(0);
});

test('filters to a declared topic subtree and clears an unknown topic', () => {
  const root = copyViewLearningSet();
  const overview = readKnowledgeView(root, emptyQuery);
  const topic = overview.filters.availableTopics.find((item) => (
    overview.nodes.some((node) => node.id === item.id && node.parentId !== null)
  ))!;
  const filtered = readKnowledgeView(root, { ...emptyQuery, topicId: topic.id });
  expect(filtered.filters.topicId).toBe(topic.id);
  expect(filtered.nodes.some((node) => node.id === topic.id)).toBe(true);
  const parent = overview.nodes.find((node) => node.id === (
    overview.nodes.find((candidate) => candidate.id === topic.id)?.parentId
  ))!;
  expect(filtered.nodes.some((node) => node.id === parent.id)).toBe(false);
  expect(readKnowledgeView(root, {
    ...emptyQuery,
    topicId: topic.id,
    methodName: parent.label,
  }).selectedMethod).toBeNull();

  const cleared = readKnowledgeView(root, {
    ...emptyQuery,
    topicId: 'not-in-this-learning-set',
  });
  expect(cleared.filters.topicId).toBeNull();
  expect(cleared.nodes).toHaveLength(overview.nodes.length);
});
```

Create `tests/support/view-learning-set.ts`:

```ts
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import {
  appendTrace,
  readActiveTraces,
  readLessonAliases,
  readMarkdownFile,
} from 'highschool-study-markdown/study-domain';
import { domainIntegrityFixtureRoot } from './fixture-paths';
import { readPlanWorkspace } from '../../src/study/read-workspace';

export function copyViewLearningSet(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-view-'));
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

export function clearTracePool(root: string): void {
  rmSync(join(root, 'traces'), { recursive: true, force: true });
  mkdirSync(join(root, 'traces'), { recursive: true });
}

export function installInvalidatedOnlyMethod(root: string): string {
  const workspace = readPlanWorkspace(root, 'domain-integrity');
  const activeKeys = new Set(readActiveTraces(root).map((trace) => (
    `${trace.lessonId}:${trace.blockId}:${trace.cardPath ?? ''}`
  )));
  const candidate = workspace.lessons.flatMap((lesson) => {
    const source = readMarkdownFile(root, lesson.path).body;
    const aliases = readLessonAliases(source);
    return lesson.blocks.flatMap((block) => block.kind === 'problem'
      ? block.uses.flatMap((alias) => {
          const cardPath = aliases.get(alias) ?? null;
          const key = `${lesson.id}:${block.id}:${cardPath ?? ''}`;
          return cardPath && !activeKeys.has(key)
            ? [{ lesson, block, alias }]
            : [];
        })
      : []);
  })[0];
  if (!candidate) throw new Error('VIEW_FIXTURE_UNUSED_ATTEMPT_REQUIRED');
  const original = appendTrace(root, {
    lessonPath: candidate.lesson.path,
    blockId: candidate.block.id,
    cardAlias: candidate.alias,
    cardStepId: null,
    materialPath: null,
    assessment: 'incorrect',
    support: 'none',
    note: '最初错误地把这一作答绑定为递推转化。',
    supersedes: null,
    methods: { primary: '递推转化', secondary: [] },
  }, () => new Date('2026-07-30T08:00:00.000Z'), () => (
    '11111111-1111-4111-8111-111111111111'
  ));
  appendTrace(root, {
    lessonPath: candidate.lesson.path,
    blockId: candidate.block.id,
    cardAlias: candidate.alias,
    cardStepId: null,
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: '复核后绑定到学生实际使用的同构方法。',
    supersedes: original.traceId,
    methods: { primary: '同构变形与换元法', secondary: [] },
  }, () => new Date('2026-07-30T08:01:00.000Z'), () => (
    '22222222-2222-4222-8222-222222222222'
  ));
  return '递推转化';
}
```

- [ ] **Step 2: Run the focused test and confirm the missing reader failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/knowledge-view.test.ts
```

Expected: FAIL because `knowledge-view.ts` does not exist.

- [ ] **Step 3: Build the immutable method skeleton and evidence states**

Implement the state mapping exactly as:

```ts
function knowledgeState(
  activeAttemptCount: number,
  distinctCardCount: number,
  historicalAttemptCount: number,
): KnowledgeNodeState {
  if (activeAttemptCount > 0 && distinctCardCount >= 2) return 'more-stable';
  if (activeAttemptCount > 0) return 'observed';
  if (historicalAttemptCount > 0) return 'invalidated';
  return 'unobserved';
}
```

For every Method Tree node:

1. Preserve the asset's parent and order.
2. Aggregate only active Trace into `evidenceCount` and `distinctCardCount`.
3. Use all Trace records only to determine the `invalidated` empty-active
   state.
4. Never return `MethodSignal.score`.
5. Build edges only from `parentId`; Trace and cards cannot create method
   hierarchy edges.
6. Resolve `query.methodName` only by exact canonical name.
7. If only `query.cardPath` is selected, select that real card's primary
   method; an unknown card clears the selection.
8. `availableTopics` contains each formal root and its direct children, in
   Method Tree order. A valid `query.topicId` projects only that node and its
   descendants; an unknown topic clears only `topicId` and returns the full
   skeleton.
9. After topic filtering, a selected method/card outside the projected
   subtree is cleared; the server never returns a detached inspector for an
   invisible node.

Do not add an intrinsic `primary` / `secondary` field to
`KnowledgeGraphNode`: the same formal method can be primary on one Card and
secondary on another. Preserve that relationship in
`PublicMethodCard.role`, and use it to style Card-to-method bindings in the
inspector.

- [ ] **Step 4: Apply topic/Plan/time/reveal filters without leaking hidden aliases**

Use the verified Trace fields `planId`, `lessonId`, and `occurredAt`:

```ts
function traceInQuery(trace: TraceRecord, query: ViewQuery): boolean {
  if (query.timeRange === 'lesson') {
    return query.lessonId !== null && trace.lessonId === query.lessonId;
  }
  if (query.timeRange === 'plan') {
    return query.planId !== null && trace.planId === query.planId;
  }
  return true;
}
```

Resolve the real selected Lesson, call `disclosureForLesson` once, and use its
result for all Lesson-bound cards, materials, methods, and pins:

- prepared/candidate: `mayExposeLessonBindings` is false, so return no Lesson
  pin and no alias/card/material/method binding;
- active/paused: map only statuses in `visibleBlockStatuses` and their visible
  aliases;
- closed/abandoned: map completed Blocks plus methods/materials actually
  present in active Trace and public replay, not Teacher Control;
- missing Lesson: clear the Lesson selection.

Read the Lesson's verified alias map server-side only to exclude hidden cards
from `selectedMethod.cards`. Never return the hidden alias, path, or method.
Global method nodes remain visible because they are public learning-set assets;
the projection must not mark a public node as belonging to the hidden Lesson.

Build `PublicMethodDetail.cards` from real cards only. Primary and secondary
roles retain their card meaning; `subroute` is never read into the graph.
Build `PublicMethodDetail.materials` from:

- `CardContent.materials` for Cards that survived the same reveal filter; and
- active Trace `materialPath` whose actual method binding is the selected
  method and whose Lesson/Block is already public.

Deduplicate by normalized path. Return label/kind/path and `viaCardPath` only;
never read or serialize material bodies here. A prepared hidden Card cannot
leak its material link.

- [ ] **Step 5: Run Knowledge projection verification**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/knowledge-view.test.ts \
  tests/study/ability.test.ts \
  tests/study/student-notebook.test.ts
bun run typecheck
git diff --check
```

Expected: focused tests and typecheck PASS; no exact mastery field appears in
the serialized projection.

- [ ] **Step 6: Commit the Knowledge projection**

```bash
git add apps/pi-teaching-web/src/study/views/knowledge-view.ts \
  apps/pi-teaching-web/tests/study/knowledge-view.test.ts \
  apps/pi-teaching-web/tests/support/view-learning-set.ts
git commit -m "feat: project method landscape evidence"
```

---

## Task 5: 实现 Memory View 长期记忆与证据来源链投影

**Files:**

- Create: `apps/pi-teaching-web/src/study/views/memory-view.ts`
- Modify: `apps/pi-teaching-web/src/study/evidence-tree.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Create: `apps/pi-teaching-web/tests/study/memory-view.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/evidence-tree.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Create: `apps/pi-teaching-web/tests/support/session-evidence.ts`
- Modify: `apps/pi-teaching-web/tests/support/view-learning-set.ts`

**Interfaces:**

- Consumes:

```ts
parseProfileDocument(source: string, owner: ProfileOwner): ProfileEntry[];
resolveEvidenceTree(
  root: string,
  source: string,
  scope: NodeSessionScope,
  sessions: SessionEvidenceReader,
): EvidenceNode;
```

- Also consumes the hierarchical runtime's sealed Roadmap/Plan/Lesson Handoff
  readers, verified Node Session Owner metadata, and
  `disclosureForLesson(...)`.
- Produces:

```ts
export function readMemoryView(
  root: string,
  query: ViewQuery,
  sessions: SessionEvidenceReader,
): MemoryViewProjection;

export function projectHandoffFindings(
  handoffs: PublicHandoffInput[],
): Pick<
  MemoryViewProjection,
  'stageFindings' | 'openQuestions' | 'sourceIndexes'
>;

export function projectObjectionTarget(
  source: string,
  owner: { planId: string | null; planWritable: boolean },
): PublicObjectionTarget;

WorkspaceRegistry.sessionEvidenceReader(): Promise<SessionEvidenceReader>;
```

- Task 6 supplies the real Session reader; tests use a deterministic fake.

- [ ] **Step 1: Write failing memory-projection tests**

Create `apps/pi-teaching-web/tests/study/memory-view.test.ts`:

```ts
import { expect, test } from 'bun:test';
import {
  readActiveTraces,
  readTraceRecords,
} from 'highschool-study-markdown/study-domain';
import {
  projectHandoffFindings,
  projectObjectionTarget,
  readMemoryView,
} from '../../src/study/views/memory-view';
import { fakeSessionEvidenceReader } from '../support/session-evidence';
import { copyViewLearningSet } from '../support/view-learning-set';

const query = {
  planId: 'domain-integrity',
  lessonId: null,
  methodName: null,
  cardPath: null,
  evidenceSource: null,
  topicId: null,
  timeRange: 'plan' as const,
};

test('separates confirmed memory, learner findings and open questions', () => {
  const root = copyViewLearningSet();
  const view = readMemoryView(root, query, fakeSessionEvidenceReader());
  expect(view.confirmed.some((item) => item.id.startsWith('S'))).toBe(true);
  expect(view.stageFindings.every((item) => item.statement.length > 0)).toBe(true);
  expect(view.openQuestions.every((item) => item.question.length > 0)).toBe(true);
});

test('does not expose raw Teaching Claims or private runtime text', () => {
  const value = JSON.stringify(projectHandoffFindings([{
    id: 'lesson-001/handoff',
    level: 'lesson',
    state: 'active',
    learnerClaims: [{
      id: 'C1',
      statement: '学生会先比较路线代价。',
      scope: '导数综合题。',
      boundary: '仅在综合题中观察到。',
      nextUse: '下一课继续检查。',
      sources: ['trace:trace-active'],
    }],
    teachingClaims: [{
      id: 'T1',
      statement: 'PRIVATE_TEACHING_CLAIM_TEXT',
      scope: '下一节课。',
      boundary: 'SYSTEM_PROMPT_SENTINEL',
      nextUse: 'SUBAGENT_RAW_SENTINEL',
      sources: ['trace:trace-active'],
    }],
    openQuestions: [{
      id: 'Q1',
      question: '换题型后能否继续选路？',
      nextCheck: '用一题迁移题检查。',
      sources: ['trace:trace-active'],
    }],
    sourceIndex: ['trace:trace-active'],
  }]));
  expect(value).not.toContain('PRIVATE_TEACHING_CLAIM_TEXT');
  expect(value).not.toContain('SYSTEM_PROMPT_SENTINEL');
  expect(value).not.toContain('SUBAGENT_RAW_SENTINEL');
  expect(value).toContain('学生会先比较路线代价');
  expect(value).toContain('换题型后能否继续选路');
});

test('keeps a source-only Handoff as an index without inventing a finding', () => {
  const projected = projectHandoffFindings([{
    id: 'lesson-004/handoff',
    level: 'lesson',
    state: 'active',
    learnerClaims: [],
    teachingClaims: [],
    openQuestions: [],
    sourceIndex: ['trace:trace-source-only'],
  }]);
  expect(projected.stageFindings).toEqual([]);
  expect(projected.openQuestions).toEqual([]);
  expect(projected.sourceIndexes).toEqual([{
    id: 'lesson-004/handoff#sources',
    level: 'lesson',
    label: '本阶段只保留了来源记录',
    sources: ['trace:trace-source-only'],
    state: 'active',
  }]);
});

test('preserves invalidated lineage but excludes it from current findings', () => {
  const root = copyViewLearningSet();
  const activeRefs = new Set(readActiveTraces(root).map((trace) => trace.sourceRef));
  const invalidated = readTraceRecords(root)
    .find((trace) => !activeRefs.has(trace.sourceRef))!;
  const view = readMemoryView(
    root,
    { ...query, evidenceSource: invalidated.sourceRef },
    fakeSessionEvidenceReader(),
  );
  expect(view.lineage?.state).toBe('invalidated');
});

test('routes objections to a writable Plan Coach or falls back to Roadmap Coach', () => {
  const source = 'trace:trace-active';
  expect(projectObjectionTarget(source, {
    planId: 'domain-integrity',
    planWritable: true,
  })).toMatchObject({
    route: '/course/plan/domain-integrity',
    sessionKey: 'coach:domain-integrity',
    source,
  });

  expect(projectObjectionTarget(source, {
    planId: 'domain-integrity',
    planWritable: false,
  })).toMatchObject({
    route: '/course',
    sessionKey: 'coach:@roadmap',
  });
});
```

Lock the prerequisite reader to this minimal read-only interface in
`study/evidence-tree.ts`:

```ts
export type SessionEvidenceReader = {
  readSession(source: `session:${string}`): {
    sessionId: string;
    ownerId: string;
    ownerPath: string;
  } | null;
  readMessage(source: `session:${string}#message:${string}`): {
    role: 'student' | 'coach' | 'tutor';
    text: string;
  } | null;
};
```

It exposes only evidence needed by a source handle, never full JSONL. Update
the existing Evidence Tree test fake to satisfy this interface.

Add `WorkspaceRegistry.sessionEvidenceReader()` without opening or creating an
Agent Session:

1. enumerate verified Roadmap, Plan, and Lesson owners and their persisted
   Session IDs;
2. reuse a cached `StudySession.entries` when already open;
3. otherwise use the injected owner-checked `lookup` and
   `readSessionBranch`;
4. run entries through `projectConversationEntries(..., 'safe')`;
5. build an in-memory reader keyed by canonical `session:` and
   `session:#message:` handles;
6. retain only owner metadata and safe projected message
   `{ role, text }`, never tools, custom entries, reasoning, or full JSONL.

The method is read-only and request-scoped. It does not save the map, start a
Session, or append ownership metadata. Add registry tests proving a historical
Lesson message can be resolved and a mismatched owner Session is absent.

Create `tests/support/session-evidence.ts`. The fake returns no Session body
and no message unless a test explicitly registers one:

```ts
import type { SessionEvidenceReader } from '../../src/study/evidence-tree';

export function fakeSessionEvidenceReader(
  messages: Record<string, { role: 'student' | 'coach' | 'tutor'; text: string }> = {},
): SessionEvidenceReader {
  return {
    readSession: () => null,
    readMessage: (source) => messages[source] ?? null,
  };
}
```

- [ ] **Step 2: Run the focused test and confirm the missing reader failure**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/memory-view.test.ts
```

Expected: FAIL because `memory-view.ts` does not exist.

- [ ] **Step 3: Project confirmed profiles and student-safe Handoff content**

Implement these allowlists:

```ts
const publicEvidenceKinds = new Set([
  'memory',
  'claim',
  'trace',
  'session',
  'card',
  'block',
] as const);

function objectionPrefill(source: string): string {
  return `我对这条学习记录有异议。请先核对来源 ${source}，再和我确认哪里不准确；在更正真正落盘前，不要说已经修正。`;
}
```

Projection rules:

1. `confirmed` reads only `memory/student-profile.md` and
   `memory/teaching-profile.md / ## Active Preferences`.
2. Confirmed teaching preferences are shown as “系统怎样配合我”，because they
   were explicitly confirmed by the student.
3. `stageFindings` includes active Learner Claims only.
4. `openQuestions` includes active Handoff Open Questions only.
5. Raw Teaching Claim statements and `nextUse` never enter the student
   projection.
6. A Teaching Claim may create only a structural explanation such as
   “这条阶段记录曾影响 Lesson 004 的教学安排”，using verified public node
   links; do not paraphrase its private statement.
7. source-only Handoff contributes its Source Index to lineage but creates no
   finding.
8. Invalidated claims remain in a selected lineage with
   `state: 'invalidated'`, but are absent from active findings and new planning
   summaries.
9. Confirmed profile text remains confirmed until the normal review flow
   changes it; if one of its current sources is invalidated,
   `sourceState: 'invalidated'` asks the student to review the basis without
   silently deleting or rewriting the profile item.
10. Raw Teaching Claim text stays excluded through the shared
    `mayExposeTeachingClaimText: false` policy; Memory must not create a local
    exception.

Time filtering is projection-only:

- confirmed profile entries remain visible at every range because they are
  already cross-cycle memory;
- `lesson` keeps Lesson Handoffs and sources owned by the verified
  `query.lessonId`;
- `plan` keeps Plan Handoffs plus descendant Lesson Handoffs owned by the
  verified `query.planId`;
- `all` keeps Roadmap, Plan, and Lesson stage records;
- a requested source outside the filtered visible set is cleared unless it is
  a source of a still-visible confirmed profile entry.

Missing Plan/Lesson IDs produce an empty stage slice for that range, not an
implicit widening to `all`.

For a confirmed item with multiple sources, aggregate `sourceState` by the
most cautionary current state: `forbidden` → `missing` → `invalidated` →
`active`. The label describes its source health, not whether the confirmed
profile text has already been deleted.

Define `PublicHandoffInput` inside `memory-view.ts` as the normalized output of
the prerequisite Handoff parser. Import `HandoffClaimDraft` and
`OpenQuestionDraft` from `highschool-study-markdown/study-domain`; do not
redeclare their field shapes:

```ts
export type PublicHandoffInput = {
  id: string;
  level: 'roadmap' | 'plan' | 'lesson';
  state: PublicEvidenceState;
  learnerClaims: Array<HandoffClaimDraft & { id: string }>;
  teachingClaims: Array<HandoffClaimDraft & { id: string }>;
  openQuestions: Array<OpenQuestionDraft & { id: string }>;
  sourceIndex: string[];
};
```

`projectHandoffFindings` maps `learnerClaims`, `openQuestions`, and a
source-only Handoff's Source Index. It creates `sourceIndexes` only when the
Handoff has no learner claim and no open question. Teaching claims are
deliberately not present in any student-facing return field.

- [ ] **Step 4: Resolve safe evidence details and objection owners**

Map the runtime's `EvidenceNode` recursively into `PublicEvidenceNode`.
For a Teaching Claim node, replace its label with `阶段教学安排记录`; retain its
children and state.

Build `PublicEvidenceDetail` with an explicit allowlist:

- Trace: occurredAt, planId, lessonId, blockId, cardPath, materialPath,
  methods, assessment, support, Observation summary.
- Student Session message: studentQuote and message source.
- Card: path, public title, goal, and canonical method names; never answer or
  rubric.
- Block: public Block title and status.
- Claim: learner statement/boundary only; Teaching Claim receives a generic
  arrangement summary.
- Memory: content, scope, rationale, counter-evidence, and sources.

Do not serialize arbitrary objects or full Markdown sections.

Resolve objection target:

```ts
export function projectObjectionTarget(
  source: string,
  owner: { planId: string | null; planWritable: boolean },
): PublicObjectionTarget {
  if (owner.planId && owner.planWritable) {
    return {
      source,
      route: `/course/plan/${encodeURIComponent(owner.planId)}`,
      sessionKey: `coach:${owner.planId}`,
      prefill: objectionPrefill(source),
    };
  }
  return {
    source,
    route: '/course',
    sessionKey: 'coach:@roadmap',
    prefill: objectionPrefill(source),
  };
}
```

The target is a discussion entry only. It does not call a correction API.

- [ ] **Step 5: Run Memory projection verification**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/study/memory-view.test.ts \
  tests/study/evidence-tree.test.ts \
  tests/runtime/workspace-registry.test.ts \
  tests/memory-review/profile-document.test.ts
bun run typecheck
git diff --check
```

Expected: focused tests and typecheck PASS; Teaching Claim sentinels do not
appear in JSON.

- [ ] **Step 6: Commit the Memory projection**

```bash
git add apps/pi-teaching-web/src/study/views/memory-view.ts \
  apps/pi-teaching-web/src/study/evidence-tree.ts \
  apps/pi-teaching-web/src/runtime/workspace-registry.ts \
  apps/pi-teaching-web/tests/study/memory-view.test.ts \
  apps/pi-teaching-web/tests/study/evidence-tree.test.ts \
  apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts \
  apps/pi-teaching-web/tests/support/session-evidence.ts \
  apps/pi-teaching-web/tests/support/view-learning-set.ts
git commit -m "feat: project student-safe memory lineage"
```

---

## Task 6: 接入三个只读 View Endpoint 与实时失效通知

**Files:**

- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Create: `apps/pi-teaching-web/tests/server/view-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`

**Interfaces:**

- Consumes `readCourseView`, `readKnowledgeView`, `readMemoryView`, and
  `readViewQuery`.
- Produces:

```text
GET /api/views/course
GET /api/views/knowledge
GET /api/views/memory
```

- Produces one new event:

```ts
{
  type: 'views-invalidated';
  views: Array<'course' | 'knowledge' | 'memory'>;
}
```

The event contains no facts; the visible page refetches its projection.

- [ ] **Step 1: Write failing endpoint and invalidation tests**

Create `tests/server/view-api.test.ts`:

```ts
import { expect, mock, test } from 'bun:test';
import type { AppDependencies } from '../../src/server/app';
import { createRequestHandler } from '../../src/server/app';
import type { StudyViewEvent } from '../../src/shared/contracts';

function testDependencies() {
  const events: StudyViewEvent[] = [];
  const readCourseView = mock(() => ({ learningSet: { title: 'Demo' } } as never));
  const readKnowledgeView = mock(() => ({ nodes: [], edges: [] } as never));
  const readMemoryView = mock(() => ({ confirmed: [] } as never));
  const workspace = {
    plan: { id: 'domain-integrity' },
    lessons: [{ id: 'lesson-001', status: 'active' }],
  } as never;
  const deps = {
    root: '/tmp/view-test',
    authoring: false,
    hub: { publish: (event: StudyViewEvent) => events.push(event) },
    readCourseView,
    readKnowledgeView,
    readMemoryView,
    registry: {
      sessionEvidenceReader: async () => ({
        readSession: () => null,
        readMessage: () => null,
      }),
      snapshot: () => workspace,
      pauseLesson: async () => {},
    },
  } as unknown as AppDependencies;
  return {
    deps,
    events,
    readCourseView,
    readKnowledgeView,
    readMemoryView,
  };
}

test('serves each safe view with one normalized query', async () => {
  const fixture = testDependencies();
  const handler = createRequestHandler(fixture.deps);
  for (const view of ['course', 'knowledge', 'memory'] as const) {
    const response = await handler(new Request(
      `http://local/api/views/${view}?plan=domain-integrity&lesson=lesson-003`,
    ));
    expect(response?.status).toBe(200);
  }
  expect(fixture.readCourseView).toHaveBeenCalledTimes(1);
  expect(fixture.readKnowledgeView).toHaveBeenCalledTimes(1);
  expect(fixture.readMemoryView).toHaveBeenCalledTimes(1);
});

test('does not turn malformed URL selection into file access', async () => {
  const fixture = testDependencies();
  const handler = createRequestHandler(fixture.deps);
  const response = await handler(new Request(
    'http://local/api/views/memory?source=file%3A%2Ftmp%2Fsecret',
  ));
  expect(response?.status).toBe(200);
  expect(fixture.readMemoryView.mock.calls[0]?.[1].evidenceSource).toBeNull();
});

test('returns one safe view error without exposing an internal path', async () => {
  const fixture = testDependencies();
  fixture.readKnowledgeView.mockImplementation(() => {
    throw new Error('METHOD_TREE_INVALID: /tmp/private/graph/method_tree.yaml');
  });
  const handler = createRequestHandler(fixture.deps);
  const response = await handler(new Request('http://local/api/views/knowledge'));
  expect(response?.status).toBe(422);
  expect(await response?.json()).toEqual({ error: 'VIEW_UNAVAILABLE' });
});

test('publishes one lightweight invalidation after a successful Lesson action', async () => {
  const fixture = testDependencies();
  const handler = createRequestHandler(fixture.deps);
  const response = await handler(new Request(
    'http://local/api/lessons/lesson-001/pause',
    { method: 'POST' },
  ));
  expect(response?.status).toBe(200);
  expect(fixture.events).toContainEqual({
    type: 'views-invalidated',
    views: ['course', 'knowledge', 'memory'],
  });
  expect(JSON.stringify(fixture.events)).not.toContain('Trace Observation');
});
```

- [ ] **Step 2: Run the focused tests and confirm missing route failures**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/server/view-api.test.ts
```

Expected: FAIL with 404 or missing dependency fields.

- [ ] **Step 3: Add dependency-injected readers and read-only routes**

Extend `AppDependencies`:

```ts
readCourseView?: typeof readCourseView;
readKnowledgeView?: typeof readKnowledgeView;
readMemoryView?: typeof readMemoryView;
```

Add one route block before the dynamic workspace routes:

```ts
const viewMatch = /^\/api\/views\/(course|knowledge|memory)$/.exec(url.pathname);
if (request.method === 'GET' && viewMatch) {
  const query = readViewQuery(url.searchParams);
  try {
    if (viewMatch[1] === 'course') {
      return json((deps.readCourseView ?? readCourseView)(deps.root, query));
    }
    if (viewMatch[1] === 'knowledge') {
      return json((deps.readKnowledgeView ?? readKnowledgeView)(deps.root, query));
    }
    const sessions = await deps.registry.sessionEvidenceReader();
    return json((deps.readMemoryView ?? readMemoryView)(
      deps.root,
      query,
      sessions,
    ));
  } catch {
    return json({ error: 'VIEW_UNAVAILABLE' }, 422);
  }
}
```

The routes accept GET only. They do not accept an owner path, Session ID,
arbitrary file path, or projection mode.

Add API methods using `formatViewQuery` from Task 2:

```ts
courseView: (query: ViewQuery) =>
  json<CourseViewProjection>(`/api/views/course${formatViewQuery(query)}`),
knowledgeView: (query: ViewQuery) =>
  json<KnowledgeViewProjection>(`/api/views/knowledge${formatViewQuery(query)}`),
memoryView: (query: ViewQuery) =>
  json<MemoryViewProjection>(`/api/views/memory${formatViewQuery(query)}`),
```

- [ ] **Step 4: Publish invalidation without duplicating facts**

Add to `StudyViewEvent`:

```ts
| {
    type: 'views-invalidated';
    views: Array<'course' | 'knowledge' | 'memory'>;
}
```

In `app.ts`, define the post-runtime writer set:

```ts
const viewWriters = new Set([
  'plan_prepare',
  'plan_update',
  'lesson_prepare',
  'classroom_update',
  'trace_append',
  'card_alternative_append',
  'lesson_close',
  'memory_review_propose',
]);
```

Inside the existing bound Session `tool_execution_end` callback, publish only
when `viewWriters.has(event.toolName) && !event.isError`. Also publish after a
successful trusted memory-review submit and after successful
start/pause/reprepare actions. These cover node materialization,
activation/closure, Trace and Handoff writes without modifying each writer.
Publish:

```ts
deps.hub.publish({
  type: 'views-invalidated',
  views: ['course', 'knowledge', 'memory'],
});
```

Do not compute three projections inside the writer callback. Do not include
projection JSON in the event. Existing conversation, workflow, ability, and
workspace events remain unchanged until Task 8 routes the visible page to the
new event.

- [ ] **Step 5: Verify endpoints, event typing, and existing server behavior**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/server/view-api.test.ts \
  tests/server/workspace-api.test.ts \
  tests/client/state.test.ts
bun run typecheck
git diff --check
```

Expected: all focused tests PASS; GET endpoints are read-only; invalidation
contains no facts.

- [ ] **Step 6: Commit the view API**

```bash
git add apps/pi-teaching-web/src/server/app.ts \
  apps/pi-teaching-web/src/shared/contracts.ts \
  apps/pi-teaching-web/src/client/api.ts \
  apps/pi-teaching-web/tests/server/view-api.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts \
  apps/pi-teaching-web/tests/client/state.test.ts
git commit -m "feat: serve three-coordinate view projections"
```

---

## Task 7: 迁移到三坐标路由并建立共享 ViewSelection

**Files:**

- Modify: `apps/pi-teaching-web/src/client/routes.ts`
- Create: `apps/pi-teaching-web/src/client/view-selection.ts`
- Modify: `apps/pi-teaching-web/src/study/routes.ts`
- Modify: `apps/pi-teaching-web/src/study/home.ts`
- Modify: `apps/pi-teaching-web/src/shared/home.ts`
- Modify: `apps/pi-teaching-web/tests/client/routes.test.ts`
- Create: `apps/pi-teaching-web/tests/client/view-selection.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/home.test.ts`
- Modify: `apps/pi-teaching-web/tests/study/routes-and-replay.test.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`

**Interfaces:**

- Produces:

```ts
export type BrowserRoute =
  | { kind: 'course' }
  | { kind: 'course-plan'; planId: string }
  | { kind: 'course-lesson'; planId: string; lessonId: string }
  | { kind: 'knowledge'; query: ViewQuery }
  | { kind: 'memory'; query: ViewQuery };

export type ViewSelection = {
  planId: string | null;
  lessonId: string | null;
  methodName: string | null;
  cardPath: string | null;
  evidenceSource: string | null;
  courseReturnRoute: string;
};

export function parseBrowserRoute(
  pathname: string,
  search: string,
): BrowserRoute | null;

export function formatBrowserRoute(route: BrowserRoute): string;
export function selectionFromRoute(route: BrowserRoute): ViewSelection;
export function routeForPrimaryView(
  view: 'course' | 'knowledge' | 'memory',
  selection: ViewSelection,
): BrowserRoute;
```

- Existing Home and Replay route producers must return only the new Course
  routes.

- [ ] **Step 1: Replace route tests with the normative URL set**

Update `tests/client/routes.test.ts`:

```ts
import { expect, test } from 'bun:test';
import {
  formatBrowserRoute,
  parseBrowserRoute,
} from '../../src/client/routes';

test('round-trips course, focused lesson, knowledge and memory routes', () => {
  const routes = [
    { kind: 'course' as const },
    { kind: 'course-plan' as const, planId: 'route-choice' },
    {
      kind: 'course-lesson' as const,
      planId: 'route-choice',
      lessonId: 'lesson-004',
    },
    {
      kind: 'knowledge' as const,
      query: {
        planId: 'route-choice',
        lessonId: 'lesson-004',
        methodName: '同构变形与换元法',
        cardPath: null,
        evidenceSource: null,
        topicId: 'derivative-methods',
        timeRange: 'plan' as const,
      },
    },
    {
      kind: 'memory' as const,
      query: {
        planId: 'route-choice',
        lessonId: 'lesson-004',
        methodName: null,
        cardPath: null,
        evidenceSource: 'trace:trace-001',
        topicId: null,
        timeRange: 'lesson' as const,
      },
    },
  ];
  for (const route of routes) {
    const formatted = formatBrowserRoute(route);
    const url = new URL(formatted, 'http://local');
    expect(parseBrowserRoute(url.pathname, url.search)).toEqual(route);
  }
});

test('rejects legacy and malformed routes', () => {
  for (const path of [
    '/',
    '/roadmap',
    '/plan/route-choice',
    '/plan/route-choice/lesson/lesson-004',
    '/course/',
    '/course/plan/',
    '/course/plan/route%20choice',
    '/course/plan/route-choice/lesson/',
    '/course/plan/%E0%A4%A',
  ]) {
    expect(parseBrowserRoute(path, '')).toBeNull();
  }
});
```

Create `tests/client/view-selection.test.ts`:

```ts
import { expect, test } from 'bun:test';
import {
  routeForPrimaryView,
  selectionFromRoute,
} from '../../src/client/view-selection';

test('derives the classroom return route from shared selection', () => {
  const selection = selectionFromRoute({
    kind: 'knowledge',
    query: {
      planId: 'p1',
      lessonId: 'l2',
      methodName: '冻结变量法',
      cardPath: null,
      evidenceSource: null,
      topicId: null,
      timeRange: 'all',
    },
  });
  expect(selection.courseReturnRoute).toBe('/course/plan/p1/lesson/l2');
  expect(routeForPrimaryView('memory', selection)).toMatchObject({
    kind: 'memory',
    query: {
      planId: 'p1',
      lessonId: 'l2',
      methodName: '冻结变量法',
    },
  });
});
```

- [ ] **Step 2: Run route tests and confirm old behavior fails**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/routes.test.ts \
  tests/client/view-selection.test.ts
```

Expected: FAIL because the parser still accepts `/`, `/roadmap`, and `/plan`.

- [ ] **Step 3: Implement the new route parser and formatter**

Use `readViewQuery` for Knowledge and Memory query parsing. Decode Course
segments inside `try/catch`, then pass each segment through Task 2's
`normalizeViewId`; never send an unvalidated segment to a workspace reader.
Course paths accept only:

```text
/course
/course/plan/<plan-id>
/course/plan/<plan-id>/lesson/<lesson-id>
```

Implement Course formatting:

```ts
if (route.kind === 'course') return '/course';
if (route.kind === 'course-plan') {
  return `/course/plan/${encodeURIComponent(route.planId)}`;
}
if (route.kind === 'course-lesson') {
  return `/course/plan/${encodeURIComponent(route.planId)}/lesson/${
    encodeURIComponent(route.lessonId)
  }`;
}
```

Knowledge and Memory use Task 2's pure `formatViewQuery(route.query)` and the
paths `/knowledge` and `/memory`; `api.ts` uses that same serializer. Reject
trailing slashes, empty or malformed decoded IDs, invalid URI encoding, and
extra path segments.

- [ ] **Step 4: Implement selection mapping without browser-local learning state**

Create `view-selection.ts`:

```ts
import type { ViewQuery } from '../shared/view-contracts';
import type { BrowserRoute } from './routes';

export type ViewSelection = {
  planId: string | null;
  lessonId: string | null;
  methodName: string | null;
  cardPath: string | null;
  evidenceSource: string | null;
  courseReturnRoute: string;
};

function courseRoute(planId: string | null, lessonId: string | null): string {
  if (planId && lessonId) {
    return `/course/plan/${encodeURIComponent(planId)}/lesson/${encodeURIComponent(lessonId)}`;
  }
  if (planId) return `/course/plan/${encodeURIComponent(planId)}`;
  return '/course';
}

export function selectionFromRoute(route: BrowserRoute): ViewSelection {
  if (route.kind === 'course') {
    return {
      planId: null,
      lessonId: null,
      methodName: null,
      cardPath: null,
      evidenceSource: null,
      courseReturnRoute: '/course',
    };
  }
  if (route.kind === 'course-plan') {
    return {
      planId: route.planId,
      lessonId: null,
      methodName: null,
      cardPath: null,
      evidenceSource: null,
      courseReturnRoute: courseRoute(route.planId, null),
    };
  }
  if (route.kind === 'course-lesson') {
    return {
      planId: route.planId,
      lessonId: route.lessonId,
      methodName: null,
      cardPath: null,
      evidenceSource: null,
      courseReturnRoute: courseRoute(route.planId, route.lessonId),
    };
  }
  return {
    planId: route.query.planId,
    lessonId: route.query.lessonId,
    methodName: route.query.methodName,
    cardPath: route.query.cardPath,
    evidenceSource: route.query.evidenceSource,
    courseReturnRoute: courseRoute(route.query.planId, route.query.lessonId),
  };
}

export function routeForPrimaryView(
  view: 'course' | 'knowledge' | 'memory',
  selection: ViewSelection,
): BrowserRoute {
  if (view === 'course') {
    if (selection.planId && selection.lessonId) {
      return {
        kind: 'course-lesson',
        planId: selection.planId,
        lessonId: selection.lessonId,
      };
    }
    if (selection.planId) {
      return { kind: 'course-plan', planId: selection.planId };
    }
    return { kind: 'course' };
  }
  const query: ViewQuery = {
    planId: selection.planId,
    lessonId: selection.lessonId,
    methodName: selection.methodName,
    cardPath: selection.cardPath,
    evidenceSource: selection.evidenceSource,
    topicId: null,
    timeRange: 'all',
  };
  return view === 'knowledge'
    ? { kind: 'knowledge', query }
    : { kind: 'memory', query };
}
```

Page-local `timeRange` defaults to `all` when crossing into a different main
view.

Use these event-to-selection rules in App; components emit IDs/paths/sources
from their projection and never edit URLs themselves:

| Event | Shared selection patch |
|---|---|
| select Course Plan | set Plan; clear Lesson/method/card/source |
| select materialized Lesson | set Plan + Lesson; clear method/card/source |
| Course → Knowledge / Memory | retain current Plan + Lesson |
| select Knowledge method | set method; clear card/source |
| select Knowledge card | set card + its method; clear source |
| Knowledge evidence → Memory | set source + evidence Plan/Lesson/card/method |
| select Memory lineage node | set source only |
| Memory → Course | use detail Plan/Lesson, falling back to `courseReturnRoute` |
| Memory → Knowledge | use detail canonical method/card; if absent, retain only Plan/Lesson |

Changing to a different Plan or Lesson clears stale lower-level selections.
These are navigation coordinates only and are never written as learning
facts.

- [ ] **Step 5: Rewrite all deterministic route producers**

Update server-side Home/Replay routing:

- Roadmap continuation → `/course`;
- Plan Coach → `/course/plan/<plan-id>`;
- Lesson → `/course/plan/<plan-id>/lesson/<lesson-id>`;
- saved unfinished route allowlist recognizes only these routes;
- closed/abandoned/stale routes still fall back to the deterministic Course
  target;
- leaving a route does not call pause or close.

Remove legacy positive-route expectations rather than keeping aliases. Keep
the single explicit rejection table in `routes.test.ts`.

- [ ] **Step 6: Verify routing and Home recovery**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/routes.test.ts \
  tests/client/view-selection.test.ts \
  tests/study/home.test.ts \
  tests/study/routes-and-replay.test.ts \
  tests/server/workspace-api.test.ts
bun run typecheck
git diff --check
```

Expected: all focused tests PASS; no runtime route producer returns `/plan/` or
`/roadmap`.

- [ ] **Step 7: Commit the route migration**

```bash
git add apps/pi-teaching-web/src/client/routes.ts \
  apps/pi-teaching-web/src/client/view-selection.ts \
  apps/pi-teaching-web/src/study/routes.ts \
  apps/pi-teaching-web/src/study/home.ts \
  apps/pi-teaching-web/src/shared/home.ts \
  apps/pi-teaching-web/tests/client/routes.test.ts \
  apps/pi-teaching-web/tests/client/view-selection.test.ts \
  apps/pi-teaching-web/tests/study/home.test.ts \
  apps/pi-teaching-web/tests/study/routes-and-replay.test.ts \
  apps/pi-teaching-web/tests/server/workspace-api.test.ts
git commit -m "refactor: route the app through three coordinates"
```

---

## Task 8: 拆出统一 App Shell 与路由级 Projection Loader

**Files:**

- Create: `apps/pi-teaching-web/src/client/view-state.ts`
- Create: `apps/pi-teaching-web/src/client/components/AppShell.tsx`
- Create: `apps/pi-teaching-web/src/client/components/PrimaryViewNav.tsx`
- Create: `apps/pi-teaching-web/src/client/components/CurrentSelectionChip.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/CoursePage.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/FocusedClassroomPage.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx`
- Create: `apps/pi-teaching-web/src/client/pages/MemoryPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Create: `apps/pi-teaching-web/tests/client/view-state.test.ts`
- Create: `apps/pi-teaching-web/tests/client/app-shell.test.tsx`
- Create: `apps/pi-teaching-web/tests/support/view-fixtures.tsx`

**Interfaces:**

- Produces one reducer:

```ts
export type PrimaryView = 'course' | 'knowledge' | 'memory';

export type ViewProjectionState = {
  course: ViewSlot<CourseViewProjection>;
  knowledge: ViewSlot<KnowledgeViewProjection>;
  memory: ViewSlot<MemoryViewProjection>;
};

export function reduceViewState(
  state: ViewProjectionState,
  action: ViewAction,
): ViewProjectionState;

export type AppShellProps = {
  title: string;
  activeView: PrimaryView;
  viewHrefs: Record<PrimaryView, string>;
  selectionLabel: string;
  connection: 'open' | 'connecting' | 'closed';
  viewLoading: boolean;
  viewError: string | null;
  personaControl: ReactNode;
  onNavigate(view: PrimaryView): void;
  onReturnCourse(): void;
  children: ReactNode;
};
```

`AppShell.tsx` imports `ReactNode` with `import type { ReactNode } from
'react'`.

- `AppShell` owns only the persistent
  header/navigation/selection/persona/connection shell.
- Existing Agent Session, conversation, workflow, persona, memory-review, and
  Tutor action state remains in the existing runtime controller.

- [ ] **Step 1: Write failing reducer and App Shell tests**

Create `tests/client/view-state.test.ts`:

```ts
import { expect, test } from 'bun:test';
import {
  initialViewState,
  reduceViewState,
} from '../../src/client/view-state';

test('invalidates only named projections and preserves loaded values', () => {
  const loaded = reduceViewState(initialViewState, {
    type: 'loaded',
    view: 'course',
    value: { learningSet: { title: '导数', overview: '', goal: '' } } as never,
  });
  const invalidated = reduceViewState(loaded, {
    type: 'invalidated',
    views: ['course', 'memory'],
  });
  expect(invalidated.course.stale).toBe(true);
  expect(invalidated.course.value).not.toBeNull();
  expect(invalidated.knowledge.stale).toBe(false);
  expect(invalidated.memory.stale).toBe(true);
});
```

Create `tests/client/app-shell.test.tsx`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { AppShell } from '../../src/client/components/AppShell';

test('keeps the three equal primary views visible during loading', () => {
  const html = renderToStaticMarkup(
    <AppShell
      title="高阶导数学习集"
      activeView="knowledge"
      viewHrefs={{
        course: '/course/plan/domain-integrity/lesson/lesson-004',
        knowledge: '/knowledge?plan=domain-integrity&lesson=lesson-004',
        memory: '/memory?plan=domain-integrity&lesson=lesson-004',
      }}
      selectionLabel="Lesson 004"
      connection="connecting"
      viewLoading={true}
      viewError={null}
      personaControl={<button type="button">陪伴风格</button>}
      onNavigate={() => {}}
      onReturnCourse={() => {}}
    >
      <p>正在整理知识山河…</p>
    </AppShell>,
  );
  expect(html).toContain('课程脉络');
  expect(html).toContain('知识山河');
  expect(html).toContain('研习留痕');
  expect(html).toContain('Lesson 004');
  expect(html).toContain('陪伴风格');
  expect(html).toContain('正在整理当前页面');
  expect(html).toContain('正在整理知识山河');
});
```

- [ ] **Step 2: Run focused tests and confirm missing modules**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/view-state.test.ts \
  tests/client/app-shell.test.tsx
```

Expected: FAIL because the reducer and shell do not exist.

- [ ] **Step 3: Implement one lightweight projection reducer**

Create `view-state.ts`:

```ts
export type PrimaryView = 'course' | 'knowledge' | 'memory';

export type ViewSlot<T> = {
  value: T | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
};

export type ViewProjectionState = {
  course: ViewSlot<CourseViewProjection>;
  knowledge: ViewSlot<KnowledgeViewProjection>;
  memory: ViewSlot<MemoryViewProjection>;
};

export type ViewAction =
  | { type: 'loading'; view: PrimaryView }
  | { type: 'loaded'; view: 'course'; value: CourseViewProjection }
  | { type: 'loaded'; view: 'knowledge'; value: KnowledgeViewProjection }
  | { type: 'loaded'; view: 'memory'; value: MemoryViewProjection }
  | { type: 'failed'; view: PrimaryView; error: string }
  | { type: 'invalidated'; views: PrimaryView[] };

const emptySlot = {
  value: null,
  loading: false,
  stale: true,
  error: null,
};

export const initialViewState: ViewProjectionState = {
  course: { ...emptySlot },
  knowledge: { ...emptySlot },
  memory: { ...emptySlot },
};

export function reduceViewState(
  state: ViewProjectionState,
  action: ViewAction,
): ViewProjectionState {
  if (action.type === 'invalidated') {
    let next = state;
    for (const view of action.views) {
      if (view === 'course') {
        next = { ...next, course: { ...next.course, stale: true } };
      } else if (view === 'knowledge') {
        next = { ...next, knowledge: { ...next.knowledge, stale: true } };
      } else {
        next = { ...next, memory: { ...next.memory, stale: true } };
      }
    }
    return next;
  }
  if (action.type === 'loading') {
    if (action.view === 'course') {
      return {
        ...state,
        course: { ...state.course, loading: true, error: null },
      };
    }
    if (action.view === 'knowledge') {
      return {
        ...state,
        knowledge: { ...state.knowledge, loading: true, error: null },
      };
    }
    return {
      ...state,
      memory: { ...state.memory, loading: true, error: null },
    };
  }
  if (action.type === 'failed') {
    if (action.view === 'course') {
      return {
        ...state,
        course: { ...state.course, loading: false, error: action.error },
      };
    }
    if (action.view === 'knowledge') {
      return {
        ...state,
        knowledge: { ...state.knowledge, loading: false, error: action.error },
      };
    }
    return {
      ...state,
      memory: { ...state.memory, loading: false, error: action.error },
    };
  }
  const loaded = <T,>(value: T): ViewSlot<T> => ({
    value,
    loading: false,
    stale: false,
    error: null,
  });
  if (action.view === 'course') {
    return { ...state, course: loaded(action.value) };
  }
  if (action.view === 'knowledge') {
    return { ...state, knowledge: loaded(action.value) };
  }
  return { ...state, memory: loaded(action.value) };
}
```

Actions are `loading`, `loaded`, `failed`, and `invalidated`. `failed` preserves
the previous value; `invalidated` marks named slots stale without loading them.
This is one view cache, not three state managers and not learning state.

- [ ] **Step 4: Implement the persistent shell and minimal real page surfaces**

`AppShell` renders:

```tsx
<div className="workspace-shell" data-primary-view={activeView}>
  <header className="workspace-header">
    <a
      className="workspace-brand"
      href={viewHrefs.course}
      onClick={(event) => {
        event.preventDefault();
        onNavigate('course');
      }}
    >
      StudyForge · {title}
    </a>
    <PrimaryViewNav
      active={activeView}
      hrefs={viewHrefs}
      onNavigate={onNavigate}
    />
    <CurrentSelectionChip
      label={selectionLabel}
      onClick={onReturnCourse}
    />
    <div className="persona-control">{personaControl}</div>
    <span className="connection-state" data-state={connection}>
      {connection === 'open' ? '已连接' : connection === 'connecting' ? '连接中' : '正在重连'}
    </span>
  </header>
  {viewError ? (
    <p className="workspace-notice" role="alert">{viewError}</p>
  ) : viewLoading ? (
    <p className="workspace-notice" role="status">正在整理当前页面…</p>
  ) : null}
  {children}
</div>
```

`CurrentSelectionChip` is a real button. From Knowledge or Memory it returns
to `selection.courseReturnRoute`; on Course it keeps the current Course
route. `personaControl` mounts the existing Presentation Persona selector and
does not duplicate or relocate its state.
`viewHrefs` comes from `routeForPrimaryView + formatBrowserRoute`; the active
view uses the exact current URL so its page-local topic/time filter is not
dropped. Nav items are real anchors for copy/open-in-new-tab semantics, while
same-window clicks prevent default and use the existing SPA `navigate`
callback so the active Session stays mounted.
`viewLoading` and `viewError` come only from the active `ViewSlot`; the shell
does not merge hidden-page errors or create another request state.

The four route page files created in this task render their actual semantic
page roots and loading/empty messages:

```tsx
<main className="coordinate-page course-page" aria-label="课程脉络" />
<main className="focused-classroom" aria-label="专注课堂" />
<main className="coordinate-page knowledge-page" aria-label="知识山河" />
<main className="coordinate-page memory-page" aria-label="研习留痕" />
```

They accept typed projections now; Tasks 9–12 fill the layouts. Do not render
Lorem Ipsum or fake learning facts. Each module exports both its named page
component for Bun render tests and `default` for `React.lazy`.

Create `tests/support/view-fixtures.tsx` as the single typed UI fixture source:

```ts
import type {
  CourseTreeNode,
  CourseViewProjection,
  KnowledgeViewProjection,
  MemoryViewProjection,
} from '../../src/shared/view-contracts';

export function courseProjectionFixture(): CourseViewProjection {
  const lesson: CourseTreeNode = {
    key: 'lesson:lesson-003',
    kind: 'lesson',
    nodeId: 'lesson-003',
    parentKey: 'plan:domain-integrity',
    handle: 'lesson-candidate-001',
    title: '待开始课程',
    publicPurpose: '比较两条可行路线的计算代价。',
    status: 'prepared',
    after: null,
    dependsOn: [],
    route: '/course/plan/domain-integrity/lesson/lesson-003',
    sessionKey: null,
    children: [],
  };
  const candidate: CourseTreeNode = {
    key: 'candidate:lesson-candidate-002',
    kind: 'lesson',
    nodeId: null,
    parentKey: 'plan:domain-integrity',
    handle: 'lesson-candidate-002',
    title: '可能的下一步',
    publicPurpose: '换一种题型检查路线迁移。',
    status: 'candidate',
    after: 'lesson-candidate-001',
    dependsOn: ['lesson-candidate-001'],
    route: null,
    sessionKey: null,
    children: [],
  };
  const plan: CourseTreeNode = {
    key: 'plan:domain-integrity',
    kind: 'plan',
    nodeId: 'domain-integrity',
    parentKey: 'roadmap:@roadmap',
    handle: 'plan-candidate-001',
    title: '综合题选路',
    publicPurpose: '学会比较路线代价。',
    status: 'active',
    after: null,
    dependsOn: [],
    route: '/course/plan/domain-integrity',
    sessionKey: 'coach:domain-integrity',
    children: [lesson, candidate],
  };
  const roadmap: CourseTreeNode = {
    key: 'roadmap:@roadmap',
    kind: 'roadmap',
    nodeId: '@roadmap',
    parentKey: null,
    handle: '@roadmap',
    title: '高阶导数学习集',
    publicPurpose: '建立稳定的导数综合题解题能力。',
    status: 'active',
    after: null,
    dependsOn: [],
    route: '/course',
    sessionKey: 'coach:@roadmap',
    children: [plan],
  };
  return {
    learningSet: {
      title: '高阶导数学习集',
      overview: '围绕导数综合题的方法选择。',
      goal: '能独立比较并切换合理路线。',
    },
    roadmap,
    plans: [plan],
    selectedPlan: {
      id: 'domain-integrity',
      title: '综合题选路',
      status: 'active',
      goal: '比较路线代价。',
      capabilityStandard: '能在三到五分钟内说明选择理由。',
      currentPosition: '正在检查跨题型迁移。',
      closedLessons: 2,
      registeredLessons: 3,
    },
    selectedLesson: {
      id: 'lesson-003',
      status: 'prepared',
      publicTitle: '待开始课程',
      publicPurpose: '比较两条可行路线的计算代价。',
      blockCount: 4,
      blockKinds: ['dialogue', 'problem', 'problem', 'reflection'],
      sourceNumbers: ['mst-32'],
      canStart: true,
      canReprepare: true,
      canContinue: false,
      canReplay: false,
    },
    continueTarget: {
      route: '/course/plan/domain-integrity/lesson/lesson-003',
      title: '继续综合题选路',
      detail: '下一节课已经准备好。',
    },
  };
}

export function knowledgeProjectionFixture(): KnowledgeViewProjection {
  return {
    nodes: [
      {
        id: 'derivative-methods',
        label: '导数方法体系',
        parentId: null,
        state: 'unobserved',
        evidenceCount: 0,
        distinctCardCount: 0,
        selected: false,
        currentLesson: false,
      },
      {
        id: 'isomorphic',
        label: '同构变形与换元法',
        parentId: 'derivative-methods',
        state: 'more-stable',
        evidenceCount: 3,
        distinctCardCount: 2,
        selected: true,
        currentLesson: true,
      },
    ],
    edges: [{
      id: 'derivative-methods:isomorphic',
      from: 'derivative-methods',
      to: 'isomorphic',
      kind: 'hierarchy',
    }],
    lessonPins: [{
      lessonId: 'lesson-003',
      planId: 'domain-integrity',
      title: '待开始课程',
      methodIds: ['isomorphic'],
      route: '/course/plan/domain-integrity/lesson/lesson-003',
    }],
    selectedMethod: {
      methodId: 'isomorphic',
      name: '同构变形与换元法',
      parent: { id: 'derivative-methods', name: '导数方法体系' },
      children: [],
      cards: [{
        cardPath: 'cards/derivative/mst-32.card.yaml',
        title: '比较两条路线',
        role: 'primary',
      }],
      materials: [{
        path: 'materials/math/derivative/page_0032.md',
        label: 'page_0032.md',
        kind: 'text',
        viaCardPath: 'cards/derivative/mst-32.card.yaml',
      }],
      lessons: [{
        lessonId: 'lesson-003',
        planId: 'domain-integrity',
        title: '待开始课程',
        methodIds: ['isomorphic'],
        route: '/course/plan/domain-integrity/lesson/lesson-003',
      }],
      evidence: [{
        source: 'trace:trace-active',
        lessonId: 'lesson-002',
        planId: 'domain-integrity',
        cardPath: 'cards/derivative/mst-19.card.yaml',
        materialPath: null,
        assessment: 'correct',
        support: 'none',
        occurredAt: '2026-07-30T08:00:00.000Z',
        active: true,
      }],
      boundary: '来自两张不同题卡的学习记录，仍需继续观察迁移。',
    },
    filters: {
      planId: 'domain-integrity',
      topicId: 'derivative-methods',
      timeRange: 'plan',
      availablePlans: [{ id: 'domain-integrity', title: '综合题选路' }],
      availableTopics: [{ id: 'derivative-methods', title: '导数方法体系' }],
    },
  };
}

export function memoryProjectionFixture(): MemoryViewProjection {
  return {
    confirmed: [{
      id: 'S1',
      owner: 'student',
      content: '多条路线可行时，先比较计算代价。',
      scope: '导数综合题。',
      rationale: '在不同题型中重复出现。',
      counterEvidence: '限时压力下仍需观察。',
      sources: ['claim:domain-integrity/handoff#learner-c1'],
      sourceState: 'active',
    }],
    stageFindings: [{
      id: 'lesson-002/handoff#learner-c1',
      level: 'lesson',
      statement: '能够说出两条路线各自的代价。',
      boundary: '尚未证明能在新题型中切换。',
      nextUse: '下一课只改变题型。',
      sources: ['trace:trace-active'],
      state: 'active',
    }],
    openQuestions: [{
      id: 'lesson-002/handoff#q1',
      level: 'lesson',
      question: '换题型后能否继续选路？',
      nextCheck: '使用一题迁移诊断。',
      sources: ['trace:trace-active'],
      state: 'active',
    }],
    sourceIndexes: [],
    selectedSource: 'memory:student/S1',
    lineage: {
      source: 'memory:student/S1',
      label: '多条路线可行时，先比较计算代价。',
      kind: 'memory',
      state: 'active',
      children: [
        {
          source: 'trace:trace-invalidated',
          label: '较早的课堂记录',
          kind: 'trace',
          state: 'invalidated',
          children: [],
        },
        {
          source: 'session:missing',
          label: '课堂原话',
          kind: 'session',
          state: 'missing',
          children: [],
        },
      ],
    },
    detail: {
      source: 'memory:student/S1',
      title: '已确认的学习特点',
      summary: '多条路线可行时，先比较计算代价。',
      studentQuote: null,
      state: 'active',
      occurredAt: null,
      planId: 'domain-integrity',
      lessonId: null,
      blockId: null,
      cardPath: null,
      materialPath: null,
      methods: [],
      assessment: null,
      support: null,
      boundary: '适用于导数综合题。',
      objection: {
        source: 'memory:student/S1',
        route: '/course',
        sessionKey: 'coach:@roadmap',
        prefill: '我对这条学习记录有异议。请先核对来源 memory:student/S1。',
      },
    },
    filters: {
      timeRange: 'all',
      planId: 'domain-integrity',
      lessonId: null,
    },
  };
}
```

- [ ] **Step 5: Refactor App route loading without resetting Sessions**

Use `React.lazy` for the four page modules. On route change:

1. Parse `pathname + search`; on initial invalid/legacy URL, use
   `history.replaceState` once to `/course` and do not translate old route
   parameters.
2. Derive `ViewSelection`.
3. For Course overview/Plan, fetch Course projection and open the appropriate
   existing Coach Session.
4. For Course Lesson, fetch Course projection and open the existing
   prepared/active/paused/terminal Lesson flow.
5. For Knowledge, fetch only Knowledge projection.
6. For Memory, fetch only Memory projection.
7. Knowledge/Memory navigation does not clear `client.conversations`,
   `workflows`, `persona`, `notebook`, or the current Session.

Handle the invalidation event:

```ts
if (event.type === 'views-invalidated') {
  setViews((current) => reduceViewState(current, {
    type: 'invalidated',
    views: event.views,
  }));
  setVisibleRevision((value) => value + 1);
  return;
}
```

The visible page refetches after `visibleRevision` changes. Hidden pages remain
stale until visited. WebSocket disconnect keeps the last loaded projection.
If a route-level request fails, keep App Shell and the last successful value,
show that page's `ViewSlot.error`, and leave the other two slots untouched.
After WebSocket reconnect, reparse the current URL and refetch only its view.

- [ ] **Step 6: Verify shell, reducer, typecheck, and production build**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/view-state.test.ts \
  tests/client/app-shell.test.tsx \
  tests/client/state.test.ts
bun run typecheck
bun run build
git diff --check
```

Expected: tests, typecheck, and build PASS; all four route modules are emitted
as lazy chunks.

- [ ] **Step 7: Commit the App Shell**

```bash
git add apps/pi-teaching-web/src/client/view-state.ts \
  apps/pi-teaching-web/src/client/components/AppShell.tsx \
  apps/pi-teaching-web/src/client/components/PrimaryViewNav.tsx \
  apps/pi-teaching-web/src/client/components/CurrentSelectionChip.tsx \
  apps/pi-teaching-web/src/client/pages/CoursePage.tsx \
  apps/pi-teaching-web/src/client/pages/FocusedClassroomPage.tsx \
  apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx \
  apps/pi-teaching-web/src/client/pages/MemoryPage.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/state.ts \
  apps/pi-teaching-web/tests/client/view-state.test.ts \
  apps/pi-teaching-web/tests/client/app-shell.test.tsx \
  apps/pi-teaching-web/tests/support/view-fixtures.tsx
git commit -m "refactor: establish the three-coordinate app shell"
```

---

## Task 9: 完成课程脉络页、Coach 入口和节点详情

**Files:**

- Create: `apps/pi-teaching-web/src/client/components/CourseTree.tsx`
- Create: `apps/pi-teaching-web/src/client/components/PlanStage.tsx`
- Create: `apps/pi-teaching-web/src/client/components/CourseInspector.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/CoursePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/SessionTree.tsx`
- Delete: `apps/pi-teaching-web/src/client/components/LearningTree.tsx`
- Delete: `apps/pi-teaching-web/src/client/components/LearningSetHome.tsx`
- Create: `apps/pi-teaching-web/tests/client/course-tree.test.tsx`
- Create: `apps/pi-teaching-web/tests/client/course-page.test.tsx`
- Delete: `apps/pi-teaching-web/tests/client/learning-tree.test.tsx`
- Delete: `apps/pi-teaching-web/tests/client/learning-set-home.test.tsx`
- Modify: `apps/pi-teaching-web/tests/client/session-tree.test.tsx`

**Interfaces:**

- `CoursePage` consumes `CourseViewProjection`, current Coach panel, and
  callbacks for node navigation, Lesson actions, Knowledge, and Memory.
- `CourseTree` never invents a route; it emits the selected
  `CourseTreeNode`.
- `SessionTree` continues to list materialized Sessions only; Candidate appears
  only in `CourseTree`.

- [ ] **Step 1: Write failing Course tree and page tests**

Create `tests/client/course-tree.test.tsx`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CourseTree } from '../../src/client/components/CourseTree';
import { courseProjectionFixture } from '../support/view-fixtures';

test('renders candidate as a non-actionable future branch', () => {
  const html = renderToStaticMarkup(
    <CourseTree
      root={courseProjectionFixture().roadmap}
      selectedKey="lesson-candidate-001"
      onSelect={() => {}}
    />,
  );
  expect(html).toContain('可能的下一步');
  expect(html).toContain('data-status="candidate"');
  expect(html).not.toContain('data-action="start-candidate"');
  expect(html).not.toContain('Consider when');
});
```

Create `tests/client/course-page.test.tsx`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { CoursePage } from '../../src/client/pages/CoursePage';
import { courseProjectionFixture } from '../support/view-fixtures';

test('keeps one course tree, one stage and one inspector', () => {
  const html = renderToStaticMarkup(
    <CoursePage
      value={courseProjectionFixture()}
      coachPanel={<p>COACH_PANEL</p>}
      selectedKey="plan:domain-integrity"
      onNodeSelect={() => {}}
      onLessonAction={() => {}}
      onKnowledge={() => {}}
      onMemory={() => {}}
    />,
  );
  expect(html.match(/class="course-tree"/g)).toHaveLength(1);
  expect(html.match(/class="plan-stage"/g)).toHaveLength(1);
  expect(html.match(/class="course-inspector"/g)).toHaveLength(1);
  expect(html).toContain('COACH_PANEL');
});
```

- [ ] **Step 2: Run focused tests and confirm missing components**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/course-tree.test.tsx \
  tests/client/course-page.test.tsx
```

Expected: FAIL because Course components do not exist.

- [ ] **Step 3: Implement semantic tree navigation**

`CourseTree` recursively renders nested lists:

```tsx
function Branch({
  node,
  selectedKey,
  onSelect,
}: {
  node: CourseTreeNode;
  selectedKey: string | null;
  onSelect(node: CourseTreeNode): void;
}) {
  return (
    <li data-kind={node.kind} data-status={node.status}>
      <button
        type="button"
        aria-current={node.key === selectedKey ? 'page' : undefined}
        onClick={() => onSelect(node)}
      >
        <small>{node.status === 'candidate' ? '可能的下一步' : node.publicPurpose}</small>
        <strong>{node.title}</strong>
      </button>
      {node.children.length > 0 && (
        <ol>
          {node.children.map((child) => (
            <Branch
              key={child.key}
              node={child}
              selectedKey={selectedKey}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </li>
  );
}
```

Use text labels in addition to color. Candidate can be selected locally to
read its public purpose, but `route: null` means selection never opens a
Session or start action. Dependencies render as labeled connectors or text,
not as clickable guessed routes.

- [ ] **Step 4: Implement PlanStage and CourseInspector**

`PlanStage` shows:

- selected Plan goal, observable capability standard, current position, and
  closed/registered count;
- Lesson sequence with completed → current → prepared/candidate order;
- the existing Roadmap or Plan Coach `ChatPanel` as the dominant central
  surface when the corresponding Coach route is open;
- no Tutor history.

`CourseInspector` shows:

- public purpose and activity shape;
- status-specific actions from `PublicLessonView`;
- prepared: start and request reprepare;
- active/paused: continue;
- closed/abandoned: Replay;
- Plan: open Coach, Knowledge, and Memory;
- Roadmap: Roadmap Coach and cross-cycle Memory.

Action buttons call supplied callbacks only:

```tsx
{lesson.canStart && <button onClick={() => onLessonAction('start')}>开始这节课</button>}
{lesson.canReprepare && <button onClick={() => onLessonAction('reprepare')}>重新备课</button>}
{lesson.canContinue && <button onClick={() => onLessonAction('continue')}>继续课堂</button>}
{lesson.canReplay && <button onClick={() => onLessonAction('replay')}>查看课堂回放</button>}
```

Explicit Course empty/failure states:

- no Plan: Roadmap inquiry and Roadmap Coach remain the primary entry;
- Candidate but no prepared Lesson: explain that the next step is still being
  discussed;
- prepared start failure: keep the node visible and show the safe admission
  error;
- removed selected node: return to its nearest real parent, never guess a
  sibling.

- [ ] **Step 5: Retire the old Home/tree duplication**

Replace `LearningSetHome` with `/course` and replace Task 13's basic
`LearningTree` with `CourseTree`. Keep `SessionTree` only inside Coach
diagnostics/Session navigation, where it lists materialized owner Sessions and
never Candidate.

Update App callbacks so:

- Roadmap root opens the existing Roadmap Coach;
- Plan opens its existing Plan Coach;
- Lesson delegates to status-specific behavior;
- cross-view actions use `routeForPrimaryView`;
- no tree click edits a node.

- [ ] **Step 6: Verify Course behavior**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/course-tree.test.tsx \
  tests/client/course-page.test.tsx \
  tests/client/session-tree.test.tsx
bun run typecheck
bun run build
git diff --check
```

Expected: tests, typecheck, and build PASS; Candidate has no start action.

- [ ] **Step 7: Commit the Course page**

```bash
git add apps/pi-teaching-web/src/client/components/CourseTree.tsx \
  apps/pi-teaching-web/src/client/components/PlanStage.tsx \
  apps/pi-teaching-web/src/client/components/CourseInspector.tsx \
  apps/pi-teaching-web/src/client/pages/CoursePage.tsx \
  apps/pi-teaching-web/src/client/components/SessionTree.tsx \
  apps/pi-teaching-web/src/client/components/LearningTree.tsx \
  apps/pi-teaching-web/src/client/components/LearningSetHome.tsx \
  apps/pi-teaching-web/tests/client/course-tree.test.tsx \
  apps/pi-teaching-web/tests/client/course-page.test.tsx \
  apps/pi-teaching-web/tests/client/learning-tree.test.tsx \
  apps/pi-teaching-web/tests/client/learning-set-home.test.tsx \
  apps/pi-teaching-web/tests/client/session-tree.test.tsx
git commit -m "feat: build the course lineage workspace"
```

---

## Task 10: 完成专注课堂子页面并保持 Session 连续性

**Files:**

- Modify: `apps/pi-teaching-web/src/client/pages/FocusedClassroomPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ChatPanel.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/ContextStack.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/LessonNotebook.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Create: `apps/pi-teaching-web/tests/client/focused-classroom-page.test.tsx`
- Modify: `apps/pi-teaching-web/tests/support/view-fixtures.tsx`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`

**Interfaces:**

- `FocusedClassroomPage` receives the already-owned Tutor Session state and
  existing classroom callbacks; it performs no workspace reads.
- Primary nav remains in `AppShell`.
- Navigating away emits no Lesson action.

- [ ] **Step 1: Write failing focused-classroom rendering tests**

Create `tests/client/focused-classroom-page.test.tsx`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { FocusedClassroomPage } from '../../src/client/pages/FocusedClassroomPage';
import { classroomPageFixture } from '../support/view-fixtures';

test('prioritizes Lesson navigation, Tutor dialogue and the safe notebook', () => {
  const html = renderToStaticMarkup(
    <FocusedClassroomPage
      {...classroomPageFixture()}
      onStart={() => {}}
      onPause={() => {}}
      onReprepare={() => {}}
    />,
  );
  expect(html).toContain('class="classroom-navigation"');
  expect(html).toContain('class="classroom-dialogue"');
  expect(html).toContain('class="classroom-notebook"');
  expect(html).not.toContain('class="course-tree"');
  expect(html).not.toContain('class="method-landscape"');
  expect(html).not.toContain('class="evidence-lineage"');
});
```

Export this prop contract from `FocusedClassroomPage.tsx`:

```ts
export type FocusedClassroomPageProps = {
  lesson: LessonNode;
  notebook: StudentNotebook | null;
  replay: LessonReplay | null;
  stage: ReactNode;
  chatPanel: ReactNode;
  onStart(): void;
  onPause(): void;
  onReprepare(): void;
};
```

Extend `tests/support/view-fixtures.tsx`:

```tsx
import type {
  LessonNode,
  StudentNotebook,
} from '../../src/shared/contracts';
import type {
  FocusedClassroomPageProps,
} from '../../src/client/pages/FocusedClassroomPage';

export function classroomPageFixture(): Omit<
  FocusedClassroomPageProps,
  'onStart' | 'onPause' | 'onReprepare'
> {
  const lesson: LessonNode = {
    id: 'lesson-001',
    title: '路线比较',
    path: 'lessons/lesson-001.md',
    planId: 'domain-integrity',
    status: 'active',
    sessionKey: 'tutor:lesson-001',
    tutorSessionId: 'session-local',
    blocks: [{
      id: 'block-001',
      title: '先独立观察',
      kind: 'problem',
      required: true,
      status: 'active',
      dependsOn: [],
      uses: ['Q1'],
      studentView: '比较两条路线的第一步。',
      evidence: [],
    }],
  };
  const notebook: StudentNotebook = {
    lesson,
    cards: {},
    recentRecords: [],
    lessonSummary: null,
  };
  return {
    lesson,
    notebook,
    replay: null,
    stage: <p>当前节点 · 先独立观察</p>,
    chatPanel: <div className="chat">TUTOR_DIALOGUE</div>,
  };
}
```

- [ ] **Step 2: Run the focused test and confirm the minimal page is incomplete**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/focused-classroom-page.test.tsx
```

Expected: FAIL because the Task 8 page does not yet render the three classroom
regions.

- [ ] **Step 3: Compose existing classroom components into the focused layout**

Render:

```tsx
<main className="focused-classroom" data-lesson-status={lesson.status}>
  <aside className="classroom-navigation" aria-label="课堂节点">
    <CurrentActivityStage lesson={lesson} notebook={notebook} />
  </aside>
  <section className="classroom-dialogue" aria-label="课堂对话">
    {chatPanel}
  </section>
  <aside className="classroom-notebook" aria-label="当前课堂本">
    <LessonNotebook
      lesson={lesson}
      notebook={notebook}
      replay={replay}
      showCards
    />
  </aside>
</main>
```

Use the existing prepared gate, active Tutor composer, paused state, terminal
Replay, image upload, structured events, persona, workflow rail, and memory
review behavior. Do not copy ChatPanel logic into the page.

- [ ] **Step 4: Separate navigation from Lesson lifecycle actions**

Refactor App navigation so these calls have distinct names:

```ts
navigate(route: BrowserRoute): Promise<void>;
startLesson(lessonId: string): Promise<void>;
pauseLesson(lessonId: string): Promise<void>;
reprepareLesson(lessonId: string): Promise<void>;
```

Only the final three may call `api.lessonAction`. `navigate` to Knowledge,
Memory, Course Plan, browser back, or browser forward must not call
`pauseLesson`, `lesson_close`, or Session creation.

When returning to the classroom:

- reuse the same Tutor Session key;
- prefer live conversation over fetched history;
- refetch notebook and visible projection;
- keep unsent Composer text/images component-local; they are not learning
  facts and are not persisted by this plan;
- closed/abandoned routes render Replay and no writable composer.

- [ ] **Step 5: Add E2E coverage for cross-view classroom continuity**

Extend `tests/e2e/workspace.spec.ts`:

```ts
test('leaving the classroom for Knowledge does not pause or recreate it', async ({ page }) => {
  await page.goto('/course/plan/domain-integrity/lesson/lesson-001');
  await expect(page.getByLabel('课堂对话')).toBeVisible();
  const session = await page.getByTestId('session-owner').getAttribute('data-session-key');
  await page.getByRole('link', { name: '知识山河' }).click();
  await page.getByRole('link', { name: '课程脉络' }).click();
  await expect(page).toHaveURL('/course/plan/domain-integrity/lesson/lesson-001');
  await expect(page.getByTestId('session-owner')).toHaveAttribute('data-session-key', session!);
  await expect(page.getByText('已暂停，可以继续')).toHaveCount(0);
});
```

Expose `data-testid="session-owner"` only on the existing student-safe Session
label; do not expose the raw Pi Session ID.

- [ ] **Step 6: Verify classroom behavior**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/focused-classroom-page.test.tsx \
  tests/client/current-activity-stage.test.tsx \
  tests/study/student-notebook.test.ts \
  tests/study/routes-and-replay.test.ts
bun run typecheck
bun run build
bunx playwright test tests/e2e/workspace.spec.ts
git diff --check
```

Expected: unit, build, and focused E2E PASS; cross-view navigation performs no
pause or new Session action.

- [ ] **Step 7: Commit the focused classroom**

```bash
git add apps/pi-teaching-web/src/client/pages/FocusedClassroomPage.tsx \
  apps/pi-teaching-web/src/client/components/ChatPanel.tsx \
  apps/pi-teaching-web/src/client/components/ContextStack.tsx \
  apps/pi-teaching-web/src/client/components/LessonNotebook.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/tests/client/focused-classroom-page.test.tsx \
  apps/pi-teaching-web/tests/support/view-fixtures.tsx \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts
git commit -m "feat: add the focused classroom route"
```

---

## Task 11: 完成知识山河页与可缩放方法骨架

**Files:**

- Create: `apps/pi-teaching-web/src/client/method-layout.ts`
- Create: `apps/pi-teaching-web/src/client/components/MethodFilters.tsx`
- Create: `apps/pi-teaching-web/src/client/components/MethodLandscape.tsx`
- Create: `apps/pi-teaching-web/src/client/components/MethodInspector.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/components/AbilityMap.tsx`
- Create: `apps/pi-teaching-web/tests/client/method-layout.test.ts`
- Create: `apps/pi-teaching-web/tests/client/knowledge-page.test.tsx`

**Interfaces:**

- Produces:

```ts
export type PositionedMethodNode = KnowledgeGraphNode & {
  depth: number;
  x: number;
  y: number;
};

export function layoutMethodTree(
  nodes: KnowledgeGraphNode[],
): PositionedMethodNode[];
```

- `KnowledgePage` consumes one `KnowledgeViewProjection` and emits only route
  selection/filter callbacks.

- [ ] **Step 1: Write failing layout and page tests**

Create `tests/client/method-layout.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { layoutMethodTree } from '../../src/client/method-layout';
import { knowledgeProjectionFixture } from '../support/view-fixtures';

test('places children to the right of their parent in deterministic order', () => {
  const positioned = layoutMethodTree(knowledgeProjectionFixture().nodes);
  const byId = new Map(positioned.map((node) => [node.id, node]));
  for (const node of positioned) {
    if (!node.parentId) continue;
    expect(node.x).toBeGreaterThan(byId.get(node.parentId)!.x);
  }
  expect(layoutMethodTree(knowledgeProjectionFixture().nodes)).toEqual(positioned);
});
```

Create `tests/client/knowledge-page.test.tsx`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { KnowledgePage } from '../../src/client/pages/KnowledgePage';
import { knowledgeProjectionFixture } from '../support/view-fixtures';

test('renders one landscape, filters and method inspector without mastery scores', () => {
  const html = renderToStaticMarkup(
    <KnowledgePage
      value={knowledgeProjectionFixture()}
      onSelectMethod={() => {}}
      onSelectCard={() => {}}
      onSelectMaterial={() => {}}
      onFilter={() => {}}
      onCourse={() => {}}
      onMemory={() => {}}
    />,
  );
  expect(html.match(/class="method-landscape"/g)).toHaveLength(1);
  expect(html).toContain('方法分区');
  expect(html).toContain('导数方法体系');
  expect(html).toContain('方法详情');
  expect(html).toContain('page_0032.md');
  expect(html).toContain('在不同题卡上更稳定');
  expect(html).not.toContain('%');
  expect(html).not.toContain('已掌握');
});
```

- [ ] **Step 2: Run focused tests and confirm missing components**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/method-layout.test.ts \
  tests/client/knowledge-page.test.tsx
```

Expected: FAIL because the layout and components do not exist.

- [ ] **Step 3: Implement a small deterministic tree layout**

Use input order as the stable vertical order and fixed geometry:

```ts
const columnWidth = 260;
const rowHeight = 88;

export function layoutMethodTree(
  nodes: KnowledgeGraphNode[],
): PositionedMethodNode[] {
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const depth = (node: KnowledgeGraphNode): number => {
    let result = 0;
    let parent = node.parentId ? byId.get(node.parentId) : undefined;
    const visited = new Set([node.id]);
    while (parent) {
      if (visited.has(parent.id)) throw new Error('KNOWLEDGE_GRAPH_CYCLE');
      visited.add(parent.id);
      result += 1;
      parent = parent.parentId ? byId.get(parent.parentId) : undefined;
    }
    return result;
  };
  return nodes.map((node, index) => {
    const nodeDepth = depth(node);
    return {
      ...node,
      depth: nodeDepth,
      x: 72 + nodeDepth * columnWidth,
      y: 56 + index * rowHeight,
    };
  });
}
```

Do not add force simulation, canvas, graph database, layout worker, or
third-party graph package.

- [ ] **Step 4: Implement the Method Landscape and filters**

`MethodLandscape` renders one scrollable SVG connector layer and semantic
buttons positioned over it. Toolbar controls:

```tsx
<button type="button" onClick={() => setScale((value) => Math.max(.7, value - .1))}>
  缩小
</button>
<button type="button" onClick={() => setScale(1)}>复位</button>
<button type="button" onClick={() => setScale((value) => Math.min(1.5, value + .1))}>
  放大
</button>
```

The transform applies only to the internal canvas. The scroll container
provides pan; keyboard users can tab through every node. Each node includes:

- method name;
- textual state label;
- distinct-card count when nonzero;
- current-Lesson marker;
- selected state.

State labels:

```ts
const stateLabel = {
  unobserved: '尚未观察',
  observed: '已有学习记录',
  'more-stable': '在不同题卡上更稳定',
  invalidated: '来源后来被修正',
} as const;
```

`MethodFilters` updates topic/Plan/time query only. The topic selector is
populated from `filters.availableTopics`, and its selected value is
`filters.topicId`; changing it replaces the Knowledge URL and lets the server
project that formal subtree. It never recomputes evidence in the browser.
Topic is page-local: switching to Course or Memory preserves the shared
Plan/Lesson/method/card/evidence selection but resets the topic filter.

- [ ] **Step 5: Implement the method inspector and cross-view links**

`MethodInspector` shows:

- parent/child position;
- primary and secondary card groups;
- public material links attached through a visible Card or revealed Trace;
- relevant Lessons;
- active/invalidated evidence with assessment/support boundary;
- “回到课程” using the runtime-provided Lesson route;
- “查看学习依据” using the evidence source.

Technical card paths and source handles live inside closed `<details>`.
Material paths also live inside closed `<details>`; their public label can be
shown in the main inspector and opens the existing scoped Content Explorer.
Do not show Card answers, rubrics, material bodies, Trace note beyond the
public detail, or numeric scores.

Reduce `AbilityMap` to an embeddable compact evidence summary for Coach/Replay;
it must not compete with the full Knowledge page and must stop rendering a
percentage.

Explicit Knowledge empty/failure states:

- no Trace: full Method Tree remains visible with an empty personal trail;
- method without Card: keep the method node and say no Card is attached;
- invalid selected method/card: clear only that selection;
- projection error: keep App Shell and offer Course navigation; do not replace
  it with inferred neighboring methods.

- [ ] **Step 6: Verify Knowledge UI**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/method-layout.test.ts \
  tests/client/knowledge-page.test.tsx \
  tests/study/knowledge-view.test.ts \
  tests/study/ability.test.ts
bun run typecheck
bun run build
git diff --check
```

Expected: tests, typecheck, and build PASS; no student-facing percentage or
mastery claim remains.

- [ ] **Step 7: Commit the Knowledge page**

```bash
git add apps/pi-teaching-web/src/client/method-layout.ts \
  apps/pi-teaching-web/src/client/components/MethodFilters.tsx \
  apps/pi-teaching-web/src/client/components/MethodLandscape.tsx \
  apps/pi-teaching-web/src/client/components/MethodInspector.tsx \
  apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx \
  apps/pi-teaching-web/src/client/components/AbilityMap.tsx \
  apps/pi-teaching-web/tests/client/method-layout.test.ts \
  apps/pi-teaching-web/tests/client/knowledge-page.test.tsx
git commit -m "feat: render the method landscape"
```

---

## Task 12: 完成研习留痕页、来源下钻和异议回流

**Files:**

- Create: `apps/pi-teaching-web/src/client/components/MemoryDirectory.tsx`
- Create: `apps/pi-teaching-web/src/client/components/EvidenceLineage.tsx`
- Create: `apps/pi-teaching-web/src/client/components/EvidenceDetail.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/MemoryPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Delete: `apps/pi-teaching-web/src/client/components/HandoffTree.tsx`
- Delete: `apps/pi-teaching-web/src/client/components/EvidenceLens.tsx`
- Create: `apps/pi-teaching-web/tests/client/evidence-lineage.test.tsx`
- Create: `apps/pi-teaching-web/tests/client/memory-page.test.tsx`
- Delete: `apps/pi-teaching-web/tests/client/handoff-tree.test.tsx`

**Interfaces:**

- `MemoryDirectory` selects confirmed memory, stage findings, open questions,
  source-only indexes, and time range.
- `EvidenceLineage` recursively selects a runtime-provided source node.
- `EvidenceDetail` emits `onObject(PublicObjectionTarget)`; it performs no
  write.

- [ ] **Step 1: Write failing lineage and page tests**

Create `tests/client/evidence-lineage.test.tsx`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { EvidenceLineage } from '../../src/client/components/EvidenceLineage';
import { memoryProjectionFixture } from '../support/view-fixtures';

test('keeps invalidated and missing sources visible with text labels', () => {
  const lineage = memoryProjectionFixture().lineage!;
  const html = renderToStaticMarkup(
    <EvidenceLineage value={lineage} selectedSource={lineage.source} onSelect={() => {}} />,
  );
  expect(html).toContain('来源后来被修正');
  expect(html).toContain('来源暂时不可读');
  expect(html).toContain('aria-current="true"');
});
```

Create `tests/client/memory-page.test.tsx`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryPage } from '../../src/client/pages/MemoryPage';
import { memoryProjectionFixture } from '../support/view-fixtures';

test('shows conclusions first and keeps technical source details collapsed', () => {
  const html = renderToStaticMarkup(
    <MemoryPage
      value={memoryProjectionFixture()}
      onSelectSource={() => {}}
      onFilter={() => {}}
      onCourse={() => {}}
      onKnowledge={() => {}}
      onObject={() => {}}
    />,
  );
  expect(html.indexOf('已确认长期记忆')).toBeLessThan(html.indexOf('来源详情'));
  expect(html).toContain('<details');
  expect(html).toContain('提出异议');
  expect(html).not.toContain('PRIVATE_TEACHING_CLAIM_TEXT');
});

test('labels source-only Handoffs without promoting them to findings', () => {
  const value = memoryProjectionFixture();
  value.sourceIndexes = [{
    id: 'lesson-004/handoff#sources',
    level: 'lesson',
    label: '本阶段只保留了来源记录',
    sources: ['trace:trace-source-only'],
    state: 'active',
  }];
  const html = renderToStaticMarkup(
    <MemoryPage
      value={value}
      onSelectSource={() => {}}
      onFilter={() => {}}
      onCourse={() => {}}
      onKnowledge={() => {}}
      onObject={() => {}}
    />,
  );
  expect(html).toContain('仅有来源记录');
  expect(html).toContain('本阶段只保留了来源记录');
  expect(html).not.toContain('由来源推断出的结论');
});
```

- [ ] **Step 2: Run focused tests and confirm missing components**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/evidence-lineage.test.tsx \
  tests/client/memory-page.test.tsx
```

Expected: FAIL because the final Memory components do not exist.

- [ ] **Step 3: Implement the conclusion-first three-column page**

`MemoryDirectory` renders three explicit groups:

```text
已确认长期记忆
阶段性发现
还需要再看看
```

A source-only Handoff is not a fourth conclusion category. Render its
`sourceIndexes` in a subdued, collapsed section named `仅有来源记录` below the
three groups; selecting one opens its real lineage.

Confirmed student profile uses “我的学习特点”；confirmed teaching profile
uses “系统怎样配合我”. Empty confirmed memory renders exactly:

```text
尚未形成经你确认的长期记录。
```

The middle column renders `EvidenceLineage`; no selected source renders a
short instruction instead of an invented lineage. Timeline controls are
secondary filters for Lesson/Plan/all, not the main structure.

Explicit Memory empty/failure states:

- Handoff without Profile appears only under stage findings;
- source-only Handoff displays `sourceIndexes` and no conclusion;
- invalidated source stays visible with its state;
- unreadable source renders `来源暂时不可读` and does not borrow adjacent text.

- [ ] **Step 4: Implement semantic recursive lineage and safe details**

Use an ordered list:

```tsx
function EvidenceBranch({
  node,
  selectedSource,
  onSelect,
}: {
  node: PublicEvidenceNode;
  selectedSource: string | null;
  onSelect(source: string): void;
}) {
  return (
    <li data-state={node.state}>
      <button
        type="button"
        aria-current={node.source === selectedSource || undefined}
        onClick={() => onSelect(node.source)}
      >
        <strong>{node.label}</strong>
        <small>{evidenceStateLabel[node.state]}</small>
      </button>
      {node.children.length > 0 && (
        <ol>{node.children.map((child) => (
          <EvidenceBranch
            key={child.source}
            node={child}
            selectedSource={selectedSource}
            onSelect={onSelect}
          />
        ))}</ol>
      )}
    </li>
  );
}
```

`EvidenceDetail` shows natural-language title, summary, student quote,
boundary, and state first. Put source handle, occurredAt, IDs, card/material
path, assessment, support, and methods inside a closed `<details>`. Do not
render unknown object keys.

Replace the old modal `EvidenceLens` and basic `HandoffTree` with these page
components; update all old “查看来源” callbacks to navigate to
`/memory?source=<handle>` instead of opening a second evidence UI.

- [ ] **Step 5: Route “提出异议” back to the projected Coach**

In App:

```ts
async function openObjection(target: PublicObjectionTarget): Promise<void> {
  const url = new URL(target.route, window.location.origin);
  const route = parseBrowserRoute(url.pathname, url.search);
  if (!route) throw new Error('OBJECTION_ROUTE_INVALID');
  await navigate(route);
  setComposerPrefill({
    id: crypto.randomUUID(),
    text: target.prefill,
  });
}
```

Before prefill, verify that the loaded Coach Session key equals
`target.sessionKey`; otherwise show a safe page error and do not prefill. The
student must still press Send. No request is made by clicking the objection
button, and the page continues to display the original active/invalidated
state until a real fact receipt triggers projection invalidation.

- [ ] **Step 6: Verify Memory UI and objection flow**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/evidence-lineage.test.tsx \
  tests/client/memory-page.test.tsx \
  tests/study/memory-view.test.ts \
  tests/client/state.test.ts
bun run typecheck
bun run build
git diff --check
```

Expected: tests, typecheck, and build PASS; objection click has no write API.

- [ ] **Step 7: Commit the Memory page**

```bash
git add apps/pi-teaching-web/src/client/components/MemoryDirectory.tsx \
  apps/pi-teaching-web/src/client/components/EvidenceLineage.tsx \
  apps/pi-teaching-web/src/client/components/EvidenceDetail.tsx \
  apps/pi-teaching-web/src/client/pages/MemoryPage.tsx \
  apps/pi-teaching-web/src/client/App.tsx \
  apps/pi-teaching-web/src/client/components/HandoffTree.tsx \
  apps/pi-teaching-web/src/client/components/EvidenceLens.tsx \
  apps/pi-teaching-web/tests/client/evidence-lineage.test.tsx \
  apps/pi-teaching-web/tests/client/memory-page.test.tsx \
  apps/pi-teaching-web/tests/client/handoff-tree.test.tsx
git commit -m "feat: render traceable student memory"
```

---

## Task 13: 落实留白新中式视觉、响应式与可访问性

**Files:**

- Modify: `apps/pi-teaching-web/src/client/theme-liubai.css`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Create: `apps/pi-teaching-web/src/client/styles/workspace-shell.css`
- Create: `apps/pi-teaching-web/src/client/styles/course.css`
- Create: `apps/pi-teaching-web/src/client/styles/classroom.css`
- Create: `apps/pi-teaching-web/src/client/styles/knowledge.css`
- Create: `apps/pi-teaching-web/src/client/styles/memory.css`
- Create: `apps/pi-teaching-web/src/client/styles/responsive.css`
- Modify: `apps/pi-teaching-web/src/client/main.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/CoursePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/MemoryPage.tsx`
- Modify: `apps/pi-teaching-web/src/client/pages/FocusedClassroomPage.tsx`
- Modify: `apps/pi-teaching-web/tests/client/liubai-theme.test.ts`
- Create: `apps/pi-teaching-web/tests/client/responsive-layout.test.ts`

**Interfaces:**

- Theme tokens remain global; page files own layout-specific CSS.
- Medium-width Inspector drawers use page-local UI state only.
- Narrow-width Knowledge uses the same projection through a semantic list
  fallback, not a second graph model.

- [ ] **Step 1: Extend the theme and responsive contract tests**

Update `tests/client/liubai-theme.test.ts` to load all files under
`src/client/styles/` and assert:

```ts
expect(theme).toContain('--paper: #faf7f1;');
expect(theme).toContain('--ink: #1b1916;');
expect(theme).toContain('--accent: #3f5b54;');
expect(theme).toContain('--cinnabar: #9c493f;');
expect(theme).toContain('--attention: #b6a06a;');
expect(allLayoutStyles).not.toContain('#b86c28');
expect(allLayoutStyles).not.toContain('radial-gradient');
expect(allLayoutStyles).not.toContain('particle');
```

Create `tests/client/responsive-layout.test.ts`:

```ts
import { expect, test } from 'bun:test';

const css = await Promise.all([
  'workspace-shell.css',
  'course.css',
  'classroom.css',
  'knowledge.css',
  'memory.css',
  'responsive.css',
].map((name) => Bun.file(
  new URL(`../../src/client/styles/${name}`, import.meta.url),
).text())).then((parts) => parts.join('\n'));

test('defines medium drawers, narrow lists and reduced motion', () => {
  expect(css).toContain('@media (max-width: 1100px)');
  expect(css).toContain('@media (max-width: 720px)');
  expect(css).toContain('.method-list-fallback');
  expect(css).toContain('@media (prefers-reduced-motion: reduce)');
});
```

- [ ] **Step 2: Run focused CSS contract tests and confirm missing files**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/liubai-theme.test.ts \
  tests/client/responsive-layout.test.ts
```

Expected: FAIL because the page CSS files and cinnabar token do not exist.

- [ ] **Step 3: Split visual responsibilities and import order**

Keep semantic tokens in `theme-liubai.css`:

```css
:root {
  --paper: #faf7f1;
  --paper-deep: #f1ece1;
  --ink: #1b1916;
  --ink-soft: #4a463d;
  --ink-faint: #9a917f;
  --accent: #3f5b54;
  --accent-deep: #314a44;
  --cinnabar: #9c493f;
  --attention: #b6a06a;
  --danger: #a8674f;
  --rule: rgba(27, 25, 22, .09);
  --font-ui: Inter, "Noto Sans SC", "PingFang SC", sans-serif;
  --font-display: "LXGW WenKai", "Kaiti SC", "STKaiti", "KaiTi", ui-serif, serif;
  --font-reading: "Noto Serif SC", "Songti SC", ui-serif, serif;
}
```

Import in `main.tsx` in this exact order:

```ts
import './theme-liubai.css';
import './styles.css';
import './styles/workspace-shell.css';
import './styles/course.css';
import './styles/classroom.css';
import './styles/knowledge.css';
import './styles/memory.css';
import './styles/responsive.css';
```

Move only new workspace rules into page files. Do not mechanically duplicate
existing ChatPanel, persona, task rail, or Markdown rules.

- [ ] **Step 4: Implement the three spatial metaphors**

Desktop layout:

```css
.course-workspace,
.knowledge-workspace,
.memory-workspace {
  display: grid;
  grid-template-columns: minmax(15rem, .8fr) minmax(30rem, 2fr) minmax(18rem, 1fr);
  min-height: calc(100dvh - var(--workspace-header-height));
}

.focused-classroom {
  display: grid;
  grid-template-columns: minmax(13rem, .65fr) minmax(32rem, 2fr) minmax(18rem, .9fr);
  min-height: calc(100dvh - var(--workspace-header-height));
}
```

Visual language:

- Course uses quiet vertical rules, branch lines, paper slips for Candidate,
  cinnabar current marker, and stable ink for terminal nodes.
- Knowledge uses generous open canvas, jade hierarchy lines, larger root/main
  method labels, and a single cinnabar selected path.
- Memory uses archival hierarchy, serif conclusions, student quote blocks,
  faded invalidated branches, and no dashboard metric cards.
- Classroom resembles a quiet desk; dialogue is dominant and side columns are
  visibly secondary.

Motion is limited to structural reveal, focus movement, lineage expansion, and
state fading.

- [ ] **Step 5: Implement medium and narrow fallbacks**

At `max-width: 1100px`:

- left rail narrows;
- right Inspector becomes a page-local drawer;
- each page exposes one button with `aria-expanded` and `aria-controls`;
- closing the drawer changes only browser UI state.

At `max-width: 720px`:

- Course uses a single indented tree and selected detail below it;
- Knowledge hides the positioned canvas and displays
  `.method-list-fallback` with the same nodes;
- Memory uses one ordered source chain;
- Classroom shows dialogue and current activity; notebook becomes a drawer;
- no horizontal page overflow.

Add:

```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    scroll-behavior: auto !important;
    animation-duration: .01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: .01ms !important;
  }
}
```

- [ ] **Step 6: Verify visual contracts and production build**

Run:

```bash
cd apps/pi-teaching-web
bun test tests/client/liubai-theme.test.ts \
  tests/client/responsive-layout.test.ts \
  tests/client/app-shell.test.tsx \
  tests/client/course-page.test.tsx \
  tests/client/knowledge-page.test.tsx \
  tests/client/memory-page.test.tsx \
  tests/client/focused-classroom-page.test.tsx
bun run typecheck
bun run build
git diff --check
```

Expected: all focused tests, typecheck, and build PASS.

- [ ] **Step 7: Commit the visual system**

```bash
git add apps/pi-teaching-web/src/client/theme-liubai.css \
  apps/pi-teaching-web/src/client/styles.css \
  apps/pi-teaching-web/src/client/styles/workspace-shell.css \
  apps/pi-teaching-web/src/client/styles/course.css \
  apps/pi-teaching-web/src/client/styles/classroom.css \
  apps/pi-teaching-web/src/client/styles/knowledge.css \
  apps/pi-teaching-web/src/client/styles/memory.css \
  apps/pi-teaching-web/src/client/styles/responsive.css \
  apps/pi-teaching-web/src/client/main.tsx \
  apps/pi-teaching-web/src/client/pages/CoursePage.tsx \
  apps/pi-teaching-web/src/client/pages/KnowledgePage.tsx \
  apps/pi-teaching-web/src/client/pages/MemoryPage.tsx \
  apps/pi-teaching-web/src/client/pages/FocusedClassroomPage.tsx \
  apps/pi-teaching-web/tests/client/liubai-theme.test.ts \
  apps/pi-teaching-web/tests/client/responsive-layout.test.ts
git commit -m "feat: style the three-coordinate workspace"
```

---

## Task 14: 完成跨页 E2E、视觉验收、当前文档和发布检查

**Files:**

- Create: `apps/pi-teaching-web/tests/e2e/three-coordinate-workspace.spec.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/deep-workflow.spec.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/workspace.spec.ts`
- Modify: `docs/zh-CN/完整说明书.md`
- Modify: `AGENTS.md`

**Interfaces:**

- Uses only the public browser surface and real local view endpoints.
- Produces no new runtime or UI contract.

- [ ] **Step 1: Write the complete cross-view E2E before final fixes**

Create `tests/e2e/three-coordinate-workspace.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('keeps one Lesson selected through Course, Knowledge, Memory and classroom', async ({ page }) => {
  await page.goto('/course');
  await expect(page.getByRole('navigation', { name: '主视图' })).toBeVisible();
  await page.getByRole('button', { name: /Lesson 003/ }).click();
  await page.getByRole('link', { name: '知识山河' }).click();
  await expect(page).toHaveURL(/\/knowledge\?.*lesson=lesson-003/);
  await expect(page.getByLabel('知识山河')).toBeVisible();

  await page.getByRole('link', { name: '研习留痕' }).click();
  await expect(page).toHaveURL(/\/memory\?.*lesson=lesson-003/);
  await page.getByRole('button', { name: /安排依据/ }).click();
  await expect(page.getByText('来源详情')).toBeVisible();

  await page.getByRole('link', { name: '课程脉络' }).click();
  await expect(page).toHaveURL('/course/plan/domain-integrity/lesson/lesson-003');
  await page.getByRole('button', { name: '开始这节课' }).click();
  await expect(page.getByLabel('专注课堂')).toBeVisible();
});

test('routes an objection to Coach with a draft but performs no write', async ({ page }) => {
  await page.goto('/memory?plan=domain-integrity&source=trace%3Atrace-active');
  const writesBefore = await page.request.get('/api/test/fact-write-count').then((r) => r.json());
  await page.getByRole('button', { name: '提出异议' }).click();
  await expect(page).toHaveURL('/course/plan/domain-integrity');
  await expect(page.getByRole('textbox')).toHaveValue(/trace:trace-active/);
  const writesAfter = await page.request.get('/api/test/fact-write-count').then((r) => r.json());
  expect(writesAfter).toEqual(writesBefore);
});

test('does not leak prepared assessment bindings through Knowledge', async ({ page }) => {
  await page.goto('/knowledge?plan=domain-integrity&lesson=lesson-003');
  await expect(page.getByText('HIDDEN_ASSESSMENT_CARD')).toHaveCount(0);
  await expect(page.getByText('PRIVATE_TEACHING_CLAIM_TEXT')).toHaveCount(0);
  await expect(page.getByText('Teacher Control')).toHaveCount(0);
});
```

The test-only fact count endpoint exists only in `fixture-server.ts`; do not add
it to production `server/app.ts`.

- [ ] **Step 2: Run the new E2E and fix only contract gaps**

Run:

```bash
cd apps/pi-teaching-web
bunx playwright test tests/e2e/three-coordinate-workspace.spec.ts
```

Expected: PASS. Any failure is an integration gap; fix the production
implementation or selector semantics without weakening the safety assertions.

- [ ] **Step 3: Add viewport and keyboard acceptance without pixel snapshots**

Add parameterized checks for:

```ts
const viewports = [
  { name: 'desktop', width: 1440, height: 1000 },
  { name: 'medium', width: 1024, height: 900 },
  { name: 'narrow', width: 390, height: 844 },
];
```

For each main page assert:

- App Shell remains visible;
- page `scrollWidth <= clientWidth`;
- the selected node is keyboard reachable;
- state has visible text, not color only;
- Inspector drawer works at medium width;
- narrow Knowledge displays `.method-list-fallback`;
- reduced-motion emulation does not block navigation.

Capture non-golden screenshots with:

```ts
await page.screenshot({
  path: test.info().outputPath(`${viewName}-${viewport.name}.png`),
  fullPage: true,
});
```

Inspect the 12 generated images during execution for overlap, hierarchy,
contrast, excessive card density, and whether the three spatial metaphors are
visibly distinct. Do not commit screenshots or add brittle pixel comparison.

- [ ] **Step 4: Update the current product contract**

Update `docs/zh-CN/完整说明书.md` with:

- three equal main views and their student purpose;
- Course as default entry and focused classroom as a child route;
- Candidate/prepared/active/terminal behavior;
- formal method tree versus personal active Trace overlay;
- confirmed memory, stage finding, open question, source-only, invalidated;
- objection-to-Coach behavior and the fact that clicking does not correct;
- safe versus raw-stream boundaries;
- refresh and Session continuity;
- narrow-screen fallback.

Update `AGENTS.md` repository map and student-view invariants:

```text
Three-coordinate views:
  src/study/views/
  src/shared/view-contracts.ts
  src/client/pages/
  GET /api/views/{course,knowledge,memory}
```

Do not duplicate the entire design spec or teaching protocol.

- [ ] **Step 5: Run static boundary searches**

Run:

```bash
cd apps/pi-teaching-web
rg -n "Teacher Control|PRIVATE_TEACHING_CLAIM_TEXT|SYSTEM_PROMPT_SENTINEL|SUBAGENT_RAW_SENTINEL" \
  src/client src/shared/view-contracts.ts src/study/views
rg -n "['\\\"]/(?:roadmap|plan/)" src
rg -n "['\\\"]/(?:roadmap|plan/)" tests \
  -g '!routes.test.ts'
rg -n "mastery|score.*100|Math\\.round\\(.*score" src/client src/study/views
```

Expected:

- private sentinels appear only in negative tests, not production projection or
  client rendering;
- no legacy route producer remains; explicit rejection inputs in
  `tests/client/routes.test.ts` are the only retained legacy route literals;
- no student-facing mastery percentage remains;
- references in historical docs are not part of this search.

- [ ] **Step 6: Run complete release verification**

Run:

```bash
cd plugins/highschool-study
bun install --frozen-lockfile
bun run release:check

cd ../../apps/pi-teaching-web
bun install --frozen-lockfile
bun run check
bun run test:e2e

cd ../..
git diff --check
git status --short
```

Expected:

- plugin release check PASS and public MCP count remains four;
- Pi typecheck, all unit tests, production build, and all Playwright tests PASS;
- only files intentionally changed by this plan are staged for the final
  commit;
- no credentials, Pi Session JSONL, generated screenshots, copied classroom
  transcripts, or local learning history are staged.

- [ ] **Step 7: Commit final acceptance and current documentation**

```bash
git add apps/pi-teaching-web/tests/e2e/three-coordinate-workspace.spec.ts \
  apps/pi-teaching-web/tests/e2e/fixture-server.ts \
  apps/pi-teaching-web/tests/e2e/deep-workflow.spec.ts \
  apps/pi-teaching-web/tests/e2e/workspace.spec.ts \
  docs/zh-CN/完整说明书.md \
  AGENTS.md
git commit -m "docs: finalize three-coordinate workspace"
```

---

## Final Acceptance Checklist

- [ ] Course、Knowledge、Memory 是三个平级主视图，并共享当前 Plan、Lesson、方法、题卡和来源定位。
- [ ] `/course` 是默认入口；真实课堂使用 `/course/plan/<plan>/lesson/<lesson>` 专注子页面。
- [ ] App Shell 在加载、错误、课堂和三页切换时始终保留。
- [ ] Candidate 没有文件、Session、开始按钮或私有字段；prepared/active/terminal 行为与 Runtime 状态一致。
- [ ] 页面切换不暂停、不关闭、不重建 Tutor Session，也不复制聊天历史。
- [ ] Knowledge 底图只来自正式 Method Tree；Card subroute 没有被升级为图节点。
- [ ] primary / secondary 保持题卡到方法的边角色；可见题卡及材料引用能在方法详情中定位，隐藏 prepared 资产不能旁路泄露。
- [ ] Knowledge 只显示状态文字和 distinct-card 语义，不显示 score、百分比或自动掌握结论。
- [ ] prepared assessment、未揭示 Block 和 Teacher Control 无法通过 Knowledge 或跨页 URL 泄露。
- [ ] Memory 将 confirmed、stage finding、open question 和 raw source 分开。
- [ ] source-only Handoff 只显示“仅有来源记录”和真实 Source Index，不生成阶段结论。
- [ ] Teaching Claim 不逐字显示；source-only 不生成结论；invalidated 保留历史但不参与当前判断。
- [ ] 所有 Memory 结论可以沿 Handoff → Trace / Session / Card / Block 回溯。
- [ ] “提出异议”只跳转并预填正确 Coach；学生未发送、Coach 未复核、事实未回执前，页面不声称已更正。
- [ ] URL 选择不能扩大 Node、Session、Card、Trace 或来源范围。
- [ ] 三个 view endpoint 全部只读，WebSocket 只发送失效通知，不复制事实。
- [ ] 没有数据库、后台索引、向量库、通用图引擎、第三方 DAG 库或新运行依赖。
- [ ] 桌面三栏、中等宽度 Inspector 抽屉、窄屏层级退化均可用且无横向页面溢出。
- [ ] 状态不只靠颜色，键盘可导航，reduced motion 生效，数学公式继续由 KaTeX 渲染。
- [ ] 三页视觉分别呈现学习卷轴、方法山河和研习档案，但共享同一留白新中式设计语言。
- [ ] 导数示范学习集完成 Course → Knowledge → Memory → Classroom → 新 Handoff 的真实闭环。
- [ ] `bun run release:check`、`bun run check`、`bun run test:e2e` 和 `git diff --check` 全部通过。
