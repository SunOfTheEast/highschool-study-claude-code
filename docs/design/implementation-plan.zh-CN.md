# Markdown 优先高中学习插件实施计划

> **供 Agent 执行者使用：** 必须逐任务使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans`。所有执行步骤均用复选框（`- [ ]`）跟踪。

**目标：** 在 `highschool-study-markdown/` 中从零构建一个本地 Claude Code 学习插件，以 Markdown learning set 为唯一持久化状态，并实现目录召回、题卡/Trace 双向搜索、只追加 Trace 与 Plan 结束时经学生确认的长期偏好压缩。

**架构：** Claude Code 原生 Agent、Skill、Task List、`Read`、`Glob`、`Grep` 与可选 Dynamic Workflow 负责对话和上下文召回。一个小型 Bun/TypeScript MCP 只发布 `card_search`、`trace_search`、`trace_append`、`source_resolve`；Trace 是题卡关联的唯一 owner，题卡反向 Trace 由请求内索引生成。长期偏好保存在两份短 Markdown 画像中，Plan 完成后由 Skill 汇总该 Plan 全部 Lesson 并经学生确认后做差量合并。

**技术栈：** Claude Code 插件清单、带 YAML frontmatter 的 Markdown、Bun 1.3.14、TypeScript 7.0.2、MCP SDK 1.29.0、Zod 4.4.3、YAML 2.9.0、`bun:test`。

## 全局约束

- 只新增同级目录 `highschool-study-markdown/`；冻结的 `highschool-study/` 只作为读取参考，不做修改。
- 面向用户的插件名仍为 `highschool-study`；开发和测试期间不能同时加载新旧插件。
- `learning-set/` 是唯一可变学习状态边界；MCP 不得写到该目录外。
- 公共 MCP 工具严格只有 `card_search`、`trace_search`、`trace_append`、`source_resolve`，不得实现或保留 `study_context_get`。
- 结构、Plan/Lesson 摘要与长期偏好由 `recall-study-memory` 使用 Claude Code 原生目录工具召回，不建立统一上下文编译服务。
- Roadmap、Plan、Lesson、Trace 与 memory 使用 Markdown；已有题卡和图谱可以继续使用 YAML。
- Plan/Lesson frontmatter 的 `id` 必须等于文件名 stem。
- Trace 是 `cardPath` / `cardStepId` 关系的唯一 owner；题卡文件不保存 Trace backlink。
- `card_search` 的每一张候选题卡都返回全部 active `traceHistory`；没有历史返回 `[]`。只限制候选题卡数，不截断单卡历史。
- `trace_search` 返回 active Trace；题卡内容通过去重 `cardsByPath` 返回；cardless Trace 仍可检索。
- Trace 只追加。更正写成新的 `Supersedes` Trace；被 supersede 的事件不进入搜索、投影或长期记忆压缩。
- 每条长期偏好，包括学生明确声明，都必须直接链接到真实 Lesson Block、Trace、题卡或材料。
- `student-profile.md` 与 `teaching-profile.md` 只保存当前有效且经学生确认的偏好；同一偏好只能属于一个文件。
- 长期偏好只在 Plan 达标且学生确认完成后更新。`consolidate-plan-memory` 必须先展示新增/修改/删除差量，得到明确确认后才能编辑画像。
- `planner-attention.md` 是可重建备课投影，不是长期记忆。
- 学生是否暂停/结束 Lesson 与能力是否达标分离；能力达标不得自动结课。
- Task List 只是 ActivityBlock 展示，不是事实源。
- 主方法权重为 `2`，次方法权重为 `1`；结果因子为 `correct=1`、`partially_correct=0.5`、`incorrect=0`、`incomplete=0`；支持因子为 `none=1`、`tutor=0.5`、`external=0.75`。该分数只用于备课提醒，不声称是校准 BKT。
- Dynamic Workflow 仅在 Planner 判断直接信息不足且存在可并行独立检索时启动；raw JSON 留在 Claude session，不写入 learning set。
- 不加入 SQLite、migration、持久化反向索引、向量数据库、后台服务、兼容读取器或自动 Git 提交。

## 文件职责图

| 职责 | 文件 |
| --- | --- |
| 插件外壳 | `highschool-study-markdown/.claude-plugin/plugin.json`、`.mcp.json`、`package.json`、`tsconfig.json` |
| 角色 | `agents/study-coach.md`、`agents/lesson-designer.md` |
| 目录召回与教学工作流 | `skills/*/SKILL.md` |
| Learning set 模板 | `learning-set-template/ROADMAP.md`、`memory/*.md`、空状态目录 |
| 学科资产 | `subject-packs/highschool-math/cards/**`、`graph/**` |
| 文件与来源读取 | `server/src/learning-set.ts`、`markdown.ts`、`sources.ts` |
| Trace 事实 | `server/src/traces.ts` |
| 双向题卡/Trace 查询 | `server/src/cards.ts`、`trace-search.ts`、`trace-index.ts` |
| 方法投影 | `server/src/method-signals.ts`、`scripts/rebuild-planner-attention.ts` |
| 四工具 MCP | `server/src/mcp/create-server.ts`、`register-tools.ts`、`index.ts` |
| 验证 | `tests/contract/**`、`tests/unit/**`、`tests/integration/**`、`tests/e2e/**` |

---

### 任务 1：建立插件外壳与可读 learning-set 模板

**文件：**
- 新建：`highschool-study-markdown/package.json`
- 新建：`highschool-study-markdown/tsconfig.json`
- 新建：`highschool-study-markdown/.claude-plugin/plugin.json`
- 新建：`highschool-study-markdown/.mcp.json`
- 新建：`highschool-study-markdown/learning-set-template/ROADMAP.md`
- 新建：`highschool-study-markdown/learning-set-template/memory/student-profile.md`
- 新建：`highschool-study-markdown/learning-set-template/memory/teaching-profile.md`
- 新建：`highschool-study-markdown/learning-set-template/memory/planner-attention.md`
- 新建空目录占位：`plans/.gitkeep`、`lessons/.gitkeep`、`cards/.gitkeep`、`graph/.gitkeep`、`materials/.gitkeep`
- 复制：四个已确认的圆锥曲线题卡/图谱 YAML 资产到 `subject-packs/highschool-math/`
- 测试：`highschool-study-markdown/tests/contract/package-and-template.test.ts`

**接口：**
- 产出名为 `highschool-study-markdown` 的 Bun 包和面向用户的 `highschool-study` Claude 插件。
- 产出可直接复制的 learning set，其中两份长期画像为空、`planner-attention.md` 明确可重建。

- [ ] **步骤 1：写失败的包与模板契约测试**

```ts
import { describe, expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '../..');

describe('plugin package and learning-set template', () => {
  test('ships the minimal Markdown layout', () => {
    for (const path of [
      '.claude-plugin/plugin.json',
      '.mcp.json',
      'learning-set-template/ROADMAP.md',
      'learning-set-template/memory/student-profile.md',
      'learning-set-template/memory/teaching-profile.md',
      'learning-set-template/memory/planner-attention.md',
    ]) expect(existsSync(join(root, path))).toBe(true);
  });

  test('profile templates contain confirmed preferences only', () => {
    const student = readFileSync(join(root, 'learning-set-template/memory/student-profile.md'), 'utf8');
    const teaching = readFileSync(join(root, 'learning-set-template/memory/teaching-profile.md'), 'utf8');
    expect(student).toContain('Only student-confirmed current preferences');
    expect(teaching).toContain('Only student-confirmed current tutor requirements');
    expect(student).not.toContain('[student-stated]');
  });
});
```

- [ ] **步骤 2：运行测试并确认因文件不存在而失败**

运行：`cd highschool-study-markdown && bun test tests/contract/package-and-template.test.ts`
预期：FAIL，第一条缺失路径指向 `.claude-plugin/plugin.json`。

- [ ] **步骤 3：创建包配置、插件清单和模板**

`package.json` 使用以下锁定依赖与脚本：

```json
{
  "name": "highschool-study-markdown",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "packageManager": "bun@1.3.14",
  "scripts": {
    "test": "bun test",
    "typecheck": "tsc --noEmit",
    "check": "bun run typecheck && bun test",
    "start:mcp": "bun run server/src/index.ts",
    "rebuild:attention": "bun run scripts/rebuild-planner-attention.ts",
    "validate:plugin": "claude plugin validate . --strict",
    "release:check": "bun run check && bun run validate:plugin"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "1.29.0",
    "yaml": "2.9.0",
    "zod": "4.4.3"
  },
  "devDependencies": {
    "@types/bun": "1.3.14",
    "typescript": "7.0.2"
  }
}
```

两份画像正文分别使用：

```markdown
---
id: student-profile
kind: confirmed-preferences
---
# Student Profile

Only student-confirmed current preferences belong here. Every item must link directly to original classroom evidence.

## Active Preferences
```

```markdown
---
id: teaching-profile
kind: confirmed-preferences
---
# Teaching Profile

Only student-confirmed current tutor requirements belong here. Every item must link directly to original classroom evidence.

## Active Preferences
```

`planner-attention.md` 明确写入 “This file is a rebuildable preparation projection, not long-term memory.”，`ROADMAP.md` 包含 `Goal`、`Observable Capability Standard`、`Plan Graph` 与 `Change Log`。

`.mcp.json` 从第一任务起就使用最终配置：

```json
{
  "mcpServers": {
    "study-markdown": {
      "command": "bun",
      "args": ["run", "${CLAUDE_PLUGIN_ROOT}/server/src/index.ts"],
      "env": {
        "STUDY_LEARNING_SET": "${CLAUDE_PROJECT_DIR}/learning-set"
      }
    }
  }
}
```

- [ ] **步骤 4：安装依赖并运行契约测试**

运行：`cd highschool-study-markdown && bun install && bun test tests/contract/package-and-template.test.ts && bun run typecheck`
预期：全部通过。

- [ ] **步骤 5：提交插件骨架**

```bash
git add highschool-study-markdown
git commit -m "feat: scaffold markdown study plugin"
```

---

### 任务 2：实现 learning-set 路径、Markdown 与来源解析

**文件：**
- 新建：`highschool-study-markdown/server/src/errors.ts`
- 新建：`highschool-study-markdown/server/src/learning-set.ts`
- 新建：`highschool-study-markdown/server/src/markdown.ts`
- 新建：`highschool-study-markdown/server/src/sources.ts`
- 新建：`highschool-study-markdown/tests/helpers/learning-set.ts`
- 测试：`highschool-study-markdown/tests/unit/learning-set.test.ts`
- 测试：`highschool-study-markdown/tests/integration/source-resolve.test.ts`

**接口：**
- 产出 `resolveInsideRoot(root, relativePath): string`。
- 产出 `readMarkdownFile(root, relativePath): MarkdownDocument`。
- 产出 `sourceResolve(root, input): SourceResolution`，支持 Markdown heading 与 YAML `#step=<id>`。
- 测试 helper 产出 `makeLearningSet()`，把模板复制到临时目录并写入一份真实 Lesson 与题卡来源。

- [ ] **步骤 1：写失败的路径和来源测试**

```ts
import { describe, expect, test } from 'bun:test';
import { makeLearningSet } from '../helpers/learning-set';
import { resolveInsideRoot } from '../../server/src/learning-set';
import { sourceResolve } from '../../server/src/sources';

describe('learning-set boundary', () => {
  test('rejects paths outside the learning set', () => {
    const root = makeLearningSet();
    expect(() => resolveInsideRoot(root, '../outside.md')).toThrow(/OUTSIDE_LEARNING_SET/);
  });

  test('resolves Markdown anchors and real card steps', () => {
    const root = makeLearningSet();
    expect(sourceResolve(root, {
      fromPath: 'memory/student-profile.md',
      target: '../lessons/lesson-001.md#trace-event-001',
    }).valid).toBe(true);
    expect(sourceResolve(root, {
      fromPath: 'lessons/lesson-001.md',
      target: '../cards/conics/freeze-variable-01.yaml#step=identify-freeze',
    }).valid).toBe(true);
    expect(sourceResolve(root, {
      fromPath: 'lessons/lesson-001.md',
      target: '../cards/conics/freeze-variable-01.yaml#step=missing',
    }).valid).toBe(false);
  });
});
```

- [ ] **步骤 2：运行测试并确认模块缺失**

运行：`cd highschool-study-markdown && bun test tests/unit/learning-set.test.ts tests/integration/source-resolve.test.ts`
预期：FAIL，提示找不到 `server/src/learning-set`。

- [ ] **步骤 3：实现最小类型和解析规则**

```ts
export type MarkdownDocument = {
  path: string;
  id: string;
  frontmatter: Record<string, unknown>;
  body: string;
  headings: Map<string, string>;
};

export type SourceResolution = {
  valid: boolean;
  path: string | null;
  fragment: string | null;
  excerpt: string | null;
  error: 'OUTSIDE_LEARNING_SET' | 'MISSING_FILE' | 'MISSING_FRAGMENT' | null;
};

export function resolveInsideRoot(root: string, relativePath: string): string;
export function readMarkdownFile(root: string, relativePath: string): MarkdownDocument;
export function sourceResolve(
  root: string,
  input: { fromPath: string; target: string },
): SourceResolution;
```

实现必须使用 `realpathSync` 后的 root containment；Markdown heading 使用 GitHub 风格小写连字符锚点；YAML step 只接受文件中真实存在的稳定 `id`。Plan/Lesson 的 frontmatter `id` 与 stem 不一致时抛出 `INVALID_DOCUMENT_ID`。

- [ ] **步骤 4：运行来源测试和类型检查**

运行：`cd highschool-study-markdown && bun test tests/unit/learning-set.test.ts tests/integration/source-resolve.test.ts && bun run typecheck`
预期：全部通过。

- [ ] **步骤 5：提交来源基础**

```bash
git add highschool-study-markdown/server/src highschool-study-markdown/tests
git commit -m "feat: resolve markdown study sources"
```

---

### 任务 3：实现 active Trace 读取与只追加写入

**文件：**
- 新建：`highschool-study-markdown/server/src/traces.ts`
- 修改：`highschool-study-markdown/tests/helpers/learning-set.ts`
- 测试：`highschool-study-markdown/tests/integration/trace-records.test.ts`

**接口：**
- 产出 `readTraceRecords(root, lessonPaths?): TraceRecord[]` 和 `readActiveTraces(root, lessonPaths?): TraceRecord[]`。
- 产出 `appendTrace(root, input, now): TraceAppendResult`。
- 模型输入题卡短别名；实现从 Lesson `Aliases` 解析并持久化 canonical `cardPath`。
- helper 新增 `makeLearningSetWithLesson()`，Lesson 包含 `step-01`、`step-02` 与 `Q-FREEZE-01` 的真实 alias。

- [ ] **步骤 1：写失败的 Trace 契约测试**

```ts
import { describe, expect, test } from 'bun:test';
import { makeLearningSetWithLesson } from '../helpers/learning-set';
import { appendTrace, readActiveTraces } from '../../server/src/traces';

describe('lesson Trace', () => {
  test('appends a canonical card binding and reads it back', () => {
    const root = makeLearningSetWithLesson();
    const result = appendTrace(root, {
      lessonPath: 'lessons/lesson-001.md',
      blockId: 'step-02',
      cardAlias: 'Q-FREEZE-01',
      cardStepId: 'identify-freeze',
      materialPath: null,
      assessment: 'partially_correct',
      support: 'tutor',
      note: '能够选出冻结量，但遗漏定义域。',
      supersedes: null,
    }, () => new Date('2026-07-21T10:00:00+08:00'));
    expect(result.eventId).toBe('event-001');
    expect(readActiveTraces(root)[0]).toMatchObject({
      planId: 'max-value',
      blockId: 'step-02',
      cardPath: 'cards/conics/freeze-variable-01.yaml',
      cardStepId: 'identify-freeze',
    });
  });

  test('supports cardless Trace and excludes superseded history', () => {
    const root = makeLearningSetWithLesson();
    const base = {
      lessonPath: 'lessons/lesson-001.md',
      blockId: 'step-01',
      cardAlias: null,
      cardStepId: null,
      materialPath: null,
      assessment: 'incomplete' as const,
      support: 'none' as const,
    };
    appendTrace(root, { ...base, note: '观看视频后要求换成图示讲解。', supersedes: null },
      () => new Date('2026-07-21T10:00:00+08:00'));
    appendTrace(root, { ...base, note: '希望视频更短，并非排斥视频。', supersedes: 'event-001' },
      () => new Date('2026-07-21T10:01:00+08:00'));
    expect(readActiveTraces(root).map((item) => item.eventId)).toEqual(['event-002']);
  });
});
```

- [ ] **步骤 2：运行测试并确认缺少实现**

运行：`cd highschool-study-markdown && bun test tests/integration/trace-records.test.ts`
预期：FAIL，提示找不到 `server/src/traces`。

- [ ] **步骤 3：实现 Trace 类型和只追加格式**

```ts
export type TraceAssessment = 'correct' | 'partially_correct' | 'incorrect' | 'incomplete';
export type TraceSupport = 'none' | 'tutor' | 'external';

export type TraceRecord = {
  eventId: string;
  lessonPath: string;
  lessonId: string;
  planId: string;
  blockId: string;
  cardPath: string | null;
  cardStepId: string | null;
  materialPath: string | null;
  assessment: TraceAssessment;
  support: TraceSupport;
  note: string;
  supersedes: string | null;
  sourceAnchor: string;
  recordedAt: string;
};

export type TraceAppendInput = {
  lessonPath: string;
  blockId: string;
  cardAlias: string | null;
  cardStepId: string | null;
  materialPath: string | null;
  assessment: TraceAssessment;
  support: TraceSupport;
  note: string;
  supersedes: string | null;
};

export function readTraceRecords(root: string, lessonPaths?: string[]): TraceRecord[];
export function readActiveTraces(root: string, lessonPaths?: string[]): TraceRecord[];
export function appendTrace(
  root: string,
  input: TraceAppendInput,
  now: () => Date,
): { eventId: string; lessonPath: string; sourceAnchor: string };
```

追加前验证 Lesson、Block、alias、题卡文件和可选 card step。事件号取现有 `event-NNN` 最大值加一。`Supersedes` 只允许指向同一 Lesson 已存在事件。完成全部验证后执行一次 `appendFileSync`；任何失败不得改写文件。

- [ ] **步骤 4：运行 Trace 测试和类型检查**

运行：`cd highschool-study-markdown && bun test tests/integration/trace-records.test.ts && bun run typecheck`
预期：全部通过。

- [ ] **步骤 5：提交 Trace 事实层**

```bash
git add highschool-study-markdown/server/src/traces.ts highschool-study-markdown/tests
git commit -m "feat: append canonical lesson traces"
```

---

### 任务 4：实现题卡与 Trace 双向搜索

**文件：**
- 新建：`highschool-study-markdown/server/src/trace-index.ts`
- 新建：`highschool-study-markdown/server/src/cards.ts`
- 新建：`highschool-study-markdown/server/src/trace-search.ts`
- 修改：`highschool-study-markdown/tests/helpers/learning-set.ts`
- 测试：`highschool-study-markdown/tests/integration/bidirectional-search.test.ts`

**接口：**
- 产出 `buildTraceIndex(activeTraces): TraceIndex`，至少含 `byCardPath`。
- 产出 `searchCards(root, input): { cards: CardHit[] }`。
- 产出 `searchTraces(root, input): TraceSearchResult`。
- helper 新增 `makeLearningSetWithHistory()`，包含两张候选题卡、两条同卡 active Trace、一条 superseded Trace 与一条文本可命中的 cardless Trace。

- [ ] **步骤 1：写失败的双向查询测试**

```ts
import { describe, expect, test } from 'bun:test';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { searchCards } from '../../server/src/cards';
import { searchTraces } from '../../server/src/trace-search';

describe('bidirectional card and Trace search', () => {
  test('every card candidate carries complete active Trace history', () => {
    const root = makeLearningSetWithHistory();
    const result = searchCards(root, { query: '冻结变量', limit: 3 });
    expect(result.cards.length).toBe(2);
    expect(result.cards[0]?.traceHistory.map((item) => item.eventId)).toEqual([
      'event-001',
      'event-003',
    ]);
    expect(result.cards[1]?.traceHistory).toEqual([]);
  });

  test('Trace results reverse-resolve cards once and retain cardless events', () => {
    const root = makeLearningSetWithHistory();
    const result = searchTraces(root, {
      query: '定义域',
      planId: 'max-value',
      lessonId: null,
      cardPath: null,
      limit: 20,
    });
    expect(Object.keys(result.cardsByPath)).toEqual([
      'cards/conics/freeze-variable-01.yaml',
    ]);
    expect(result.traces.some((item) => item.cardPath === null)).toBe(true);
  });
});
```

- [ ] **步骤 2：运行测试并确认模块缺失**

运行：`cd highschool-study-markdown && bun test tests/integration/bidirectional-search.test.ts`
预期：FAIL，提示找不到 `server/src/cards`。

- [ ] **步骤 3：实现请求内索引和返回类型**

```ts
import type { TraceRecord } from './traces';

export type TraceIndex = { byCardPath: Map<string, TraceRecord[]> };
export type CardHit = {
  path: string;
  title: string;
  content: string;
  goal: string;
  methods: Array<{ name: string; role: 'primary' | 'secondary' }>;
  steps: Array<{ id: string; title: string }>;
  traceHistory: TraceRecord[];
};
export type TraceSearchInput = {
  query: string | null;
  planId: string | null;
  lessonId: string | null;
  cardPath: string | null;
  limit: number;
};
export type TraceSearchResult = {
  traces: TraceRecord[];
  cardsByPath: Record<string, Omit<CardHit, 'traceHistory'>>;
};

export function buildTraceIndex(activeTraces: TraceRecord[]): TraceIndex;
export function searchCards(
  root: string,
  input: { query: string; limit: number },
): { cards: CardHit[] };
export function searchTraces(root: string, input: TraceSearchInput): TraceSearchResult;
```

`searchCards` 每次调用只执行一次 `readActiveTraces(root)`，再建立 `Map<cardPath, TraceRecord[]>`；题卡按真实文件内容与 graph 元数据匹配，空查询结果保持为空。`traceHistory` 按 `recordedAt`、`lessonPath`、`eventId` 稳定排序且不截断。`searchTraces` 先过滤 active Trace，再读取命中项引用的唯一题卡路径。

- [ ] **步骤 4：加入一次扫描回归测试并完成验证**

把 `readActiveTraces` 作为可注入依赖传入内部 `createCardSearcher`，测试断言一次调用返回三张卡时 Trace 扫描计数仍为 `1`。

运行：`cd highschool-study-markdown && bun test tests/integration/bidirectional-search.test.ts && bun run typecheck`
预期：全部通过。

- [ ] **步骤 5：提交双向查询**

```bash
git add highschool-study-markdown/server/src highschool-study-markdown/tests
git commit -m "feat: search cards and traces bidirectionally"
```

---

### 任务 5：实现方法聚合与可重建 planner attention

**文件：**
- 新建：`highschool-study-markdown/server/src/method-signals.ts`
- 新建：`highschool-study-markdown/scripts/rebuild-planner-attention.ts`
- 新建：`highschool-study-markdown/tests/fixtures/learning-set/**`
- 测试：`highschool-study-markdown/tests/integration/method-signals.test.ts`

**接口：**
- 产出 `aggregateMethodSignals(root, traces): MethodSignal[]`。
- 脚本只重写 `memory/planner-attention.md`，不修改两份长期画像。

- [ ] **步骤 1：写失败的主次方法聚合测试**

```ts
import { expect, test } from 'bun:test';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { readActiveTraces } from '../../server/src/traces';
import { aggregateMethodSignals } from '../../server/src/method-signals';

test('primary methods contribute more than secondary methods', () => {
  const root = makeLearningSetWithHistory();
  const signals = aggregateMethodSignals(root, readActiveTraces(root));
  expect(signals).toContainEqual(expect.objectContaining({
    method: '冻结变量法',
    evidenceWeight: 2,
    earnedWeight: 1,
    score: 0.5,
  }));
  expect(signals).toContainEqual(expect.objectContaining({
    method: '参数化与消元',
    evidenceWeight: 1,
    earnedWeight: 0.5,
    score: 0.5,
  }));
});
```

- [ ] **步骤 2：运行测试并确认模块缺失**

运行：`cd highschool-study-markdown && bun test tests/integration/method-signals.test.ts`
预期：FAIL，提示找不到 `server/src/method-signals`。

- [ ] **步骤 3：实现精确但未校准的聚合**

```ts
export type MethodSignal = {
  method: string;
  evidenceWeight: number;
  earnedWeight: number;
  score: number;
  sourceRefs: string[];
};

const roleWeight = { primary: 2, secondary: 1 } as const;
const assessmentFactor = {
  correct: 1,
  partially_correct: 0.5,
  incorrect: 0,
  incomplete: 0,
} as const;
const supportFactor = { none: 1, tutor: 0.5, external: 0.75 } as const;

export function aggregateMethodSignals(
  root: string,
  traces: import('./traces').TraceRecord[],
): MethodSignal[];
```

同一题卡内同名方法只取更强角色。损坏题卡、cardless Trace 和 superseded Trace 不贡献方法分数。脚本把结果写成含来源链接的 Markdown 列表，并在标题下明确 “Uncalibrated preparation signal; not a mastery claim.”。

- [ ] **步骤 4：运行聚合测试并用 fixture 执行重建脚本**

运行：`cd highschool-study-markdown && bun test tests/integration/method-signals.test.ts && STUDY_LEARNING_SET=tests/fixtures/learning-set bun run rebuild:attention`
预期：测试通过；`planner-attention.md` 只包含方法信号和 Trace 来源，两份画像字节保持不变。

- [ ] **步骤 5：提交方法投影**

```bash
git add highschool-study-markdown/server/src/method-signals.ts highschool-study-markdown/scripts highschool-study-markdown/tests
git commit -m "feat: rebuild planner attention from traces"
```

---

### 任务 6：通过 stdio 发布严格四个 MCP 工具

**文件：**
- 新建：`highschool-study-markdown/server/src/config.ts`
- 新建：`highschool-study-markdown/server/src/mcp/create-server.ts`
- 新建：`highschool-study-markdown/server/src/mcp/register-tools.ts`
- 新建：`highschool-study-markdown/server/src/index.ts`
- 修改：`highschool-study-markdown/.mcp.json`
- 测试：`highschool-study-markdown/tests/contract/mcp-tools.test.ts`

**接口：**
- `createStudyMcpServer({ learningSetRoot, now })` 返回 MCP server。
- 工具 envelope：`card_search → { cards }`、`trace_search → { traces, cardsByPath }`、`trace_append → TraceAppendResult`、`source_resolve → SourceResolution`。

- [ ] **步骤 1：写失败的真实 MCP 契约测试**

```ts
import { expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { createStudyMcpServer } from '../../server/src/mcp/create-server';

test('publishes exactly four study tools', async () => {
  const root = makeLearningSetWithHistory();
  const server = createStudyMcpServer({
    learningSetRoot: root,
    now: () => new Date('2026-07-21T10:00:00+08:00'),
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  const tools = await client.listTools();
  expect(tools.tools.map((item) => item.name).sort()).toEqual([
    'card_search',
    'source_resolve',
    'trace_append',
    'trace_search',
  ]);
  const cards = await client.callTool({
    name: 'card_search',
    arguments: { query: '冻结变量', limit: 3 },
  });
  expect(cards.structuredContent).toEqual(expect.objectContaining({
    cards: expect.arrayContaining([
      expect.objectContaining({ traceHistory: expect.any(Array) }),
    ]),
  }));
});
```

- [ ] **步骤 2：运行测试并确认 MCP 模块缺失**

运行：`cd highschool-study-markdown && bun test tests/contract/mcp-tools.test.ts`
预期：FAIL，提示找不到 `server/src/mcp/create-server`。

- [ ] **步骤 3：注册精确工具名和输入 schema**

`card_search` 输入 `{ query: string, limit: 1..20 }`；`trace_search` 输入 `{ query?, planId?, lessonId?, cardPath?, limit: 1..100 }`；`trace_append` 使用任务 3 的字段；`source_resolve` 输入 `{ fromPath, target }`。每个工具同时返回 JSON text content 与相同的 `structuredContent`。不得注册别名、兼容工具或 `study_context_get`。

`.mcp.json`：

```json
{
  "mcpServers": {
    "study-markdown": {
      "command": "bun",
      "args": ["run", "${CLAUDE_PLUGIN_ROOT}/server/src/index.ts"],
      "env": {
        "STUDY_LEARNING_SET": "${CLAUDE_PROJECT_DIR}/learning-set"
      }
    }
  }
}
```

- [ ] **步骤 4：扩展 MCP 测试覆盖 Trace 正反查和 append**

测试调用 `trace_append` 写入一条 alias 题卡 Trace，再调用 `card_search` 断言新事件进入该卡 `traceHistory`，最后调用 `trace_search` 断言 `cardsByPath` 只含一次题卡。追加一条 cardless Trace 并断言它也能通过文本查到。

- [ ] **步骤 5：运行 MCP 契约和全部核心测试**

运行：`cd highschool-study-markdown && bun test tests/unit tests/integration tests/contract/mcp-tools.test.ts && bun run typecheck`
预期：全部通过。

- [ ] **步骤 6：提交 MCP 工具面**

```bash
git add highschool-study-markdown/.mcp.json highschool-study-markdown/server/src highschool-study-markdown/tests
git commit -m "feat: expose four markdown study tools"
```

---

### 任务 7：实现角色、目录召回与 Plan 级长期记忆 Skill

**文件：**
- 新建：`highschool-study-markdown/agents/study-coach.md`
- 新建：`highschool-study-markdown/agents/lesson-designer.md`
- 新建：`highschool-study-markdown/skills/recall-study-memory/SKILL.md`
- 新建：`highschool-study-markdown/skills/consolidate-plan-memory/SKILL.md`
- 新建：`highschool-study-markdown/skills/study/SKILL.md`
- 新建：`highschool-study-markdown/skills/start-or-revise-roadmap/SKILL.md`
- 新建：`highschool-study-markdown/skills/prepare-next-lesson/SKILL.md`
- 新建：`highschool-study-markdown/skills/run-lesson/SKILL.md`
- 新建：`highschool-study-markdown/skills/close-lesson-reflection/SKILL.md`
- 新建：`highschool-study-markdown/skills/correct-learning-record/SKILL.md`
- 新建：`highschool-study-markdown/skills/inspect-progress/SKILL.md`
- 测试：`highschool-study-markdown/tests/contract/agent-and-skills.test.ts`

**接口：**
- Coach 是唯一学生入口；Designer 只负责备课。
- `recall-study-memory` 根据用途执行七类召回，不生成第二份 ContextView。
- `consolidate-plan-memory` 在 Plan 结束时产生差量，学生确认前不编辑画像。

- [ ] **步骤 1：写失败的 Agent/Skill 文本契约**

```ts
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

test('recall and consolidation prompts preserve the agreed boundaries', () => {
  const recall = read('skills/recall-study-memory/SKILL.md');
  const consolidate = read('skills/consolidate-plan-memory/SKILL.md');
  const prepare = read('skills/prepare-next-lesson/SKILL.md');
  const run = read('skills/run-lesson/SKILL.md');
  expect(recall).toContain('Read both confirmed profiles in full');
  expect(recall).toContain('prior Lesson Summaries in the same Plan');
  expect(recall).toContain('relevant earlier Plan Summaries');
  expect(recall).not.toContain('study_context_get');
  expect(consolidate).toContain('Never edit either profile before explicit student confirmation');
  expect(consolidate).toContain('add / revise / delete');
  expect(consolidate).toContain('one owner only');
  expect(prepare).toContain('An empty card_search result means stop searching');
  expect(run).toContain('trace_append');
  expect(run).toContain('Task completion is not capability attainment');
});
```

- [ ] **步骤 2：运行测试并确认 Skill 文件缺失**

运行：`cd highschool-study-markdown && bun test tests/contract/agent-and-skills.test.ts`
预期：FAIL，第一条缺失文件为 `skills/recall-study-memory/SKILL.md`。

- [ ] **步骤 3：编写角色工具边界**

`study-coach.md` 允许 `Read`、`Write`、`Edit`、`Glob`、`Grep`、`Skill`、`Agent(highschool-study:lesson-designer)`、Task List 和四个 MCP 工具。`lesson-designer.md` 允许目录读取、可选 `Agent` 和 `card_search`、`trace_search`、`source_resolve`，不直接调用 `trace_append`。

两份角色都必须写明：不得要求学生切换 Agent；不得把 Skill/Workflow raw JSON 当作持久记忆；不得编造题卡、Trace、session ID 或来源。

- [ ] **步骤 4：编写 `recall-study-memory` 七类召回顺序**

Skill 必须按以下顺序执行：

1. 用 `Glob`/`Read` 找到 Roadmap、目标 Plan 和当前 Lesson；
2. 同一 Plan 中读取前序 closed Lesson Summary；
3. 后续 Plan 读取 Roadmap 标明相关的前序 Plan Summary；
4. 备课和上课完整读取两份 confirmed profile；
5. 仅备课读取 `planner-attention.md`；
6. 题卡使用 `card_search`，证据使用 `trace_search`；
7. 仅在需要验证结论时沿链接调用 `source_resolve`。

Skill 必须写明：“Only launch Agent/Dynamic Workflow when direct evidence is insufficient and at least two independent searches can run in parallel.” 信息充足时直接返回已找到的路径和摘要，不启动分支。

- [ ] **步骤 5：编写 `consolidate-plan-memory` 确认协议**

Skill 必须执行：

1. 验证 Plan 已达到 capability standard，且学生明确选择完成该 Plan；
2. 读取该 Plan 索引中的全部 Lesson，并用 `trace_search(planId=...)` 获取 active Trace；
3. 读取两份现有画像；
4. 生成候选表：`operation` 为 add/revise/delete，`owner` 为 student/teaching，含候选文本、直接原始来源、冲突证据和适用条件；
5. 在对话中展示差量，允许学生逐项保留、改写、删除或全部拒绝；
6. 明确写入 “Never edit either profile before explicit student confirmation”；
7. 确认后用普通 Markdown Edit 合并；每条偏好只进入一个 owner 文件；
8. 把学生对错误推断的反对追加为最后一个 Plan-reflection Block 的 cardless Trace；
9. 如果确认结果为空，画像保持不变，但 Plan 仍可完成。

画像不保存候选状态、置信度、分数、被拒绝列表或旧版本。

- [ ] **步骤 6：编写其余学习闭环 Skills**

- `study`：通过目录状态路由 Roadmap、备课、上课、进度、更正；不调用 `study_context_get`。
- `start-or-revise-roadmap`：与学生确认 Roadmap/Plan 目标、依赖、并行和重排；每个里程碑末尾写 observable capability standard 与 test。
- `prepare-next-lesson`：先调用 `recall-study-memory`，再调用 `card_search`；每个 CardHit 已含完整 Trace；只有跨题卡证据问题才调用 `trace_search`。积木式组合视频、讲解、练习、互动和小测。
- `run-lesson`：将 ActivityBlock 投影到 Task List；允许学生跳过、重排和调整；有证据的步骤调用 `trace_append`。
- `close-lesson-reflection`：能力达标后展示证据并把 continue/adjust/pause/close 选择权交给学生；关闭 Lesson 不自动关闭 Plan。
- `correct-learning-record`：用 `trace_append(supersedes=...)` 保存更正；重建受影响摘要与 planner attention；不静默改写 confirmed profile。
- `inspect-progress`：区分 Roadmap/Plan/Lesson 达标、Lesson closure、方法投影和长期偏好；每个结论给来源。

- [ ] **步骤 7：运行 Skill 契约与严格插件验证**

运行：`cd highschool-study-markdown && bun test tests/contract/agent-and-skills.test.ts && claude plugin validate . --strict`
预期：全部通过，插件清单与所有 Skill frontmatter 合法。

- [ ] **步骤 8：提交角色与 Skills**

```bash
git add highschool-study-markdown/agents highschool-study-markdown/skills highschool-study-markdown/tests
git commit -m "feat: add native recall and memory consolidation"
```

---

### 任务 8：证明跨会话学习闭环并编写运行说明

**文件：**
- 新建：`highschool-study-markdown/tests/e2e/markdown-learning-loop.test.ts`
- 新建：`highschool-study-markdown/README.md`

**接口：**
- 端到端测试通过真实 MCP client 证明题卡/Trace 双向查询和更正闭包。
- fixture 证明同 Plan Lesson 摘要召回与 Plan 完成后的 confirmed profile 更新。
- README 给出安装、learning-set 初始化、Agent/Skill/MCP 分层和手动 smoke test。

- [ ] **步骤 1：写失败的端到端 MCP 流程**

测试顺序固定为：

1. 创建含 Roadmap、max-value Plan、两张真实题卡和 prepared Lesson 的 fixture；
2. `card_search` 返回两张卡，二者 `traceHistory=[]`；
3. `trace_append` 通过 alias 向第一张卡写入 event-001；
4. 再次 `card_search`，第一张卡有一条历史，第二张仍为 `[]`；
5. `trace_search(cardPath=...)` 返回 event-001 与去重题卡；
6. `trace_append` 写 event-002 并 supersede event-001；
7. 两个搜索接口只返回 event-002；
8. 运行 attention 重建，主方法信号引用 event-002；
9. 断言 fixture 内不存在 `.db`、`-wal`、`-shm` 文件。

- [ ] **步骤 2：运行端到端测试并确认尚缺整合**

运行：`cd highschool-study-markdown && bun test tests/e2e/markdown-learning-loop.test.ts`
预期：FAIL，直到四工具 server、fixture 和投影脚本全部接通。

- [ ] **步骤 3：加入 Plan 级记忆压缩验收 fixture**

fixture 包含三个 closed Lesson、直接学生偏好、相互冲突的教学观察和现有 confirmed profile。测试读取 Skill 契约与最终示例文件，证明：

- 候选差量中的每条 add/revise/delete 都链接到原始 Lesson Block/Trace；
- 未确认的候选不会出现在画像；
- 学生确认后的 learner preference 只进入 `student-profile.md`；
- tutor behavior requirement 只进入 `teaching-profile.md`；
- 用户删除的条目不留在画像；
- 下一 Plan 的 recall 示例完整读取两份画像，而不是全部旧 Lesson。

由于语义总结由 LLM 完成，测试固定验证输入边界、确认门和写入结果，不把某一句自然语言总结锁成算法输出。

- [ ] **步骤 4：编写 README 与手动 smoke test**

README 必须说明四层职责、七类召回、不存在 `study_context_get`、题卡/Trace 双向关系、请求内反向索引、Plan-gated memory consolidation、`STUDY_LEARNING_SET` 配置、空题卡结果停止编卡和 `bun run release:check`。

手动 smoke test：

```bash
cd highschool-study-markdown
bun install
bun run release:check
STUDY_LEARNING_SET="$PWD/tests/fixtures/learning-set" bun run start:mcp
```

- [ ] **步骤 5：运行最终验证**

```bash
cd highschool-study-markdown
bun run release:check
rg -n "study_context_get|\\[student-stated\\]" server agents skills learning-set-template .mcp.json
find . -type f \\( -name '*.db' -o -name '*-wal' -o -name '*-shm' \\)
git diff --check
```

预期：`release:check` 通过；`rg` 和 `find` 无输出；`git diff --check` 退出码为 `0`。

- [ ] **步骤 6：提交完成的插件**

```bash
git add highschool-study-markdown
git commit -m "test: prove markdown study learning loop"
```

## 最终验收清单

- [ ] 不运行 Claude Code 也能读懂 learning set。
- [ ] 公共 MCP 工具严格为 `card_search`、`trace_search`、`trace_append`、`source_resolve`。
- [ ] 每张题卡候选都带全部 active Trace 或空数组；Trace 可以反查去重题卡。
- [ ] Trace 绑定只存于 Trace；题卡文件没有 backlink。
- [ ] cardless Trace、alias 题卡 Trace 与 supersede 更正都可正常使用。
- [ ] 结构、层级摘要和长期画像通过 `recall-study-memory` 召回，不存在 ContextView 服务。
- [ ] 同一 Plan 的后续 Lesson 能使用前序 Lesson 摘要；后续 Plan 能使用前序相关 Plan 摘要。
- [ ] 两份长期画像在备课和上课时完整读取，`planner-attention.md` 只在备课读取。
- [ ] Plan 完成后读取本 Plan 全部课堂记录，学生确认前画像不变化。
- [ ] 学生可以保留、改写或删除候选；同一偏好只有一个 owner。
- [ ] 每条 confirmed preference 都能下钻到原始课堂来源。
- [ ] 方法聚合可由 active Trace 与题卡主次方法重新生成。
- [ ] 学生 closure 与能力达标分离，Task List 不成为事实源。
- [ ] Dynamic Workflow 可选且不产生持久化 raw JSON。
- [ ] 新插件不读取冻结插件，不创建数据库或持久化索引。
