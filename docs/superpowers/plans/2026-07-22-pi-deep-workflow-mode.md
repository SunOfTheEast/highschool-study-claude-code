# Pi 深度模式与动态工作流 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Coach 和 Tutor 的既有 Pi Session 中加入可选深度模式，让父 Agent 在确有必要时通过 `pi-subagents` 运行临时、隔离、只读的多视角任务，并在同一个教学前端中展示可取消、可恢复的任务轨道。

**Architecture:** 深度模式不是第三个顶级 Agent。每个 Coach/Tutor Session 各自拥有一个 `DeepWorkflowRuntime`：父 Agent 通过一个 Skill 和 `deep_workflow_propose` 工具提交结构化任务图；Runtime 使用 `pi-subagents/delegation` 的公开 EventBus 协议执行临时 `study-scout` 子 Session，将状态快照写入父 Pi Session 的 custom entries，并向前端投影学生安全的任务状态。正式 Lesson、Trace、画像和 Plan 写入仍只由父 Coach/Tutor 通过现有路径完成。

**Tech Stack:** 前端核心计划中的 Bun、TypeScript、Pi SDK、React 与 WebSocket；新增 `pi-subagents` 0.35.1 及其公开 `pi-subagents/delegation` API。

**Depends on:** 先完整执行 [`2026-07-22-pi-teaching-web-frontend.md`](./2026-07-22-pi-teaching-web-frontend.md)。本计划直接复用其中的 Session registry、HTTP/WebSocket、React shell、Playwright fixture、题卡/Trace 与学生安全投影，不与核心前端并行改同一批文件。

**Design spec:** [`docs/superpowers/specs/2026-07-21-pi-teaching-web-frontend-design.md`](../specs/2026-07-21-pi-teaching-web-frontend-design.md#146-深度模式与动态工作流)

## Global Constraints

- 只有 Coach 和 Tutor 是用户可见 Agent；临时 Subagent 不进入 Plan/Lesson 侧边栏。
- 深度模式是 Session 级许可，不是每轮强制并行。父 Agent 可直接处理、快速会诊或提议深度工作流。
- 触发门槛由父 Agent 的 Skill 判断：至少有两个可独立分析的视角，且结果可能改变下一步教学动作；不增加关键词路由器或教学相关性规则引擎。
- 快速会诊最多三个无依赖任务，默认总上限 12,000 Token、45 秒，可直接运行。
- 深度工作流必须先展示目标、任务图、最大并发、Token 上限和时间上限，由学生确认后运行。
- 所有临时任务使用同一个只读 `study-scout` runtime agent；“证据检索员、错因诊断员、防剧透审查员”等只是任务中的动态角色，不是永久 Agent 配置。
- 父 Agent 在委派前先用现有 `card_search` / `trace_search` 获得真实来源句柄；子 Session 只读取任务声明的文件范围。找不到来源就返回空结果，不生成题卡 ID、Trace 或路径。
- 子 Session 不提供 `write`、`edit`、`bash`、`trace_append`、`classroom_update` 或 `subagent` 工具，不允许嵌套委派。
- 子任务只返回结构化结论、来源、建议和风险；不把 thinking 或完整子 Session transcript 注入父对话。
- 工作流状态写入父 Pi Session JSONL 的 custom entries，不写入 learning set，也不增加 `workflows/` 目录或数据库。
- 父 Agent 是唯一正式写入者。工作流完成、部分失败或取消均不自动修改 Lesson、Trace、画像或 `planner-attention.md`。
- 首版只校验任务 ID、依赖存在、无环和 quick/deep 预算边界；不实现通用规则 DSL、任意 JavaScript、自动重试树、分布式队列、永久专家记忆或自研调度框架。
- 每个任务先写失败测试，再写最小实现；每个任务独立提交。

## File Responsibility Map

| Responsibility | Files |
|---|---|
| `pi-subagents` 装载与只读子 Agent | `package.json`、`resources/subagents/study-scout.md`、`src/runtime/subagent-path.ts` |
| 工作流公共契约与最小校验 | `src/workflows/contracts.ts`、`validate.ts` |
| Pi Session custom entry 持久化 | `src/workflows/store.ts` |
| 公开 delegation EventBus 桥 | `src/workflows/delegation-client.ts` |
| 依赖调度、取消与结果汇总 | `src/workflows/runtime.ts` |
| 父 Agent 工具与 Skill | `src/workflows/tool.ts`、`resources/skills/deep-workflow/SKILL.md` |
| Session 开关与 Runtime 接入 | `src/runtime/resource-loader.ts`、`session-factory.ts`、`workspace-registry.ts` |
| HTTP/WebSocket 学生安全投影 | `src/server/app.ts`、`src/shared/contracts.ts` |
| 前端任务轨道 | `src/client/components/DeepModeToggle.tsx`、`TaskRail.tsx` |
| 纵向验收 | `tests/workflows/`、`tests/e2e/deep-workflow.spec.ts` |

---

### Task 1: Install `pi-subagents` and expose one read-only runtime agent

**Files:**

- Modify: `apps/pi-teaching-web/package.json`
- Create: `apps/pi-teaching-web/resources/subagents/study-scout.md`
- Create: `apps/pi-teaching-web/src/runtime/subagent-path.ts`
- Create: `apps/pi-teaching-web/tests/runtime/subagent-path.test.ts`

**Interfaces:**

- Produces: exact dependency `pi-subagents@0.35.1`.
- Produces: runtime agent name `study-scout` with only `read`, `grep`, `find`, `ls`.
- Produces: `configureStudySubagentDirectory()` called once before any Pi Session is created.

- [ ] **Step 1: Write the failing read-only agent contract test**

Create `tests/runtime/subagent-path.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { delimiter } from 'node:path';
import { configureStudySubagentDirectory, studySubagentDirectory } from '../../src/runtime/subagent-path';

test('exposes one mutation-free study subagent directory', () => {
  const source = readFileSync(`${studySubagentDirectory}/study-scout.md`, 'utf8');
  expect(source).toContain('name: study-scout');
  expect(source).toContain('tools: read, grep, find, ls');
  for (const forbidden of ['tools: write', 'tools: edit', 'tools: bash', 'tools: subagent']) {
    expect(source).not.toContain(forbidden);
  }

  const previous = process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS;
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = '/tmp/existing';
  configureStudySubagentDirectory();
  expect(process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS?.split(delimiter)).toEqual([
    '/tmp/existing', studySubagentDirectory,
  ]);
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = previous;
});
```

- [ ] **Step 2: Add the dependency and read-only agent definition**

Add to `dependencies`:

```json
"pi-subagents": "0.35.1"
```

Create `resources/subagents/study-scout.md`:

```markdown
---
name: study-scout
description: Read-only, source-grounded analysis for a parent Coach or Tutor workflow
tools: read, grep, find, ls
thinking: medium
systemPromptMode: replace
inheritProjectContext: false
inheritSkills: false
completionGuard: false
---

You are a temporary read-only analyst inside a teaching workflow. Follow the task's dynamic role, goal, source handles and allowed read roots exactly. Do not modify files, create teaching facts, invent card IDs or infer missing evidence. Return only one JSON object with `findings`, `evidence_refs`, `recommended_action`, and `risks`; each field is an array of concise strings except `recommended_action`, which is one string. Return empty arrays and an empty recommendation when sources are insufficient. Do not include chain-of-thought or a transcript.
```

- [ ] **Step 3: Register the bundled directory through the supported environment hook**

Create `src/runtime/subagent-path.ts`:

```ts
import { dirname, delimiter, join } from 'node:path';
import { fileURLToPath } from 'node:url';

export const studySubagentDirectory = join(dirname(fileURLToPath(import.meta.url)), '../../resources/subagents');

export function configureStudySubagentDirectory(): void {
  process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS = [
    process.env.PI_SUBAGENT_EXTRA_AGENT_DIRS,
    studySubagentDirectory,
  ].filter(Boolean).join(delimiter);
}
```

Call `configureStudySubagentDirectory()` once in `src/server/index.ts` before `createPiSessionFactory`.

- [ ] **Step 4: Install and run the focused checks**

```bash
cd apps/pi-teaching-web
bun install
bun test tests/runtime/subagent-path.test.ts
bun run typecheck
```

Expected: dependency resolution succeeds and the agent contract proves no mutation or nested-agent tool is exposed.

- [ ] **Step 5: Commit the runtime dependency**

```bash
git add apps/pi-teaching-web/package.json apps/pi-teaching-web/bun.lock \
  apps/pi-teaching-web/resources/subagents apps/pi-teaching-web/src/runtime/subagent-path.ts \
  apps/pi-teaching-web/tests/runtime/subagent-path.test.ts apps/pi-teaching-web/src/server/index.ts
git commit -m "feat: add read-only teaching subagent runtime"
```

---

### Task 2: Define and persist the minimal workflow contract

**Files:**

- Create: `apps/pi-teaching-web/src/workflows/contracts.ts`
- Create: `apps/pi-teaching-web/src/workflows/validate.ts`
- Create: `apps/pi-teaching-web/src/workflows/store.ts`
- Create: `apps/pi-teaching-web/tests/workflows/validate.test.ts`
- Create: `apps/pi-teaching-web/tests/workflows/store.test.ts`

**Interfaces:**

- Produces: `WorkflowGraph`, `WorkflowSnapshot`, `WorkflowTaskResult`.
- Produces: `validateWorkflowGraph(graph)` with only structural and budget validation.
- Produces: `WorkflowStore` over `SessionManager.appendCustomEntry()` / `getEntries()`.

- [ ] **Step 1: Write failing graph validation tests**

Create `tests/workflows/validate.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { validateWorkflowGraph } from '../../src/workflows/validate';
import type { WorkflowGraph } from '../../src/workflows/contracts';

const quick: WorkflowGraph = {
  id: 'wf-quick', goal: '分析下一步提示', mode: 'quick', maxConcurrency: 3,
  tokenLimit: 12_000, timeoutMs: 45_000,
  tasks: [
    { id: 'diagnose', label: '错因诊断', role: '错因诊断员', instruction: '区分策略与计算问题。', dependsOn: [], sourceHandles: ['lessons/lesson-003.md#trace-event-001'], readRoots: ['lessons'] },
    { id: 'spoiler', label: '防剧透检查', role: '课堂审查员', instruction: '检查下一步是否泄露答案。', dependsOn: [], sourceHandles: ['lessons/lesson-003.md'], readRoots: ['lessons'] },
  ],
};

test('accepts a bounded single-wave quick consultation', () => {
  expect(validateWorkflowGraph(quick)).toEqual(quick);
});

test('rejects duplicate IDs, unknown dependencies, cycles and dependent quick tasks', () => {
  expect(() => validateWorkflowGraph({ ...quick, tasks: [...quick.tasks, quick.tasks[0]!] })).toThrow('DUPLICATE_TASK_ID');
  expect(() => validateWorkflowGraph({ ...quick, mode: 'deep', tasks: [{ ...quick.tasks[0]!, dependsOn: ['missing'] }] })).toThrow('UNKNOWN_DEPENDENCY');
  expect(() => validateWorkflowGraph({ ...quick, mode: 'deep', tasks: [
    { ...quick.tasks[0]!, id: 'a', dependsOn: ['b'] },
    { ...quick.tasks[1]!, id: 'b', dependsOn: ['a'] },
  ] })).toThrow('CYCLIC_WORKFLOW');
  expect(() => validateWorkflowGraph({ ...quick, tasks: [{ ...quick.tasks[0]!, dependsOn: ['spoiler'] }, quick.tasks[1]!] })).toThrow('QUICK_REQUIRES_ONE_WAVE');
});
```

- [ ] **Step 2: Define the exact runtime types**

Create `src/workflows/contracts.ts`:

```ts
import type { SessionKey } from '../shared/contracts';

export type WorkflowMode = 'quick' | 'deep';
export type WorkflowStatus = 'proposed' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
export type WorkflowTaskStatus = 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';

export type WorkflowTask = {
  id: string;
  label: string;
  role: string;
  instruction: string;
  dependsOn: string[];
  sourceHandles: string[];
  readRoots: string[];
};

export type WorkflowGraph = {
  id: string;
  goal: string;
  mode: WorkflowMode;
  maxConcurrency: number;
  tokenLimit: number;
  timeoutMs: number;
  tasks: WorkflowTask[];
};

export type WorkflowTaskResult = {
  findings: string[];
  evidence_refs: string[];
  recommended_action: string;
  risks: string[];
};

export type WorkflowTaskState = WorkflowTask & {
  status: WorkflowTaskStatus;
  runId: string | null;
  tokens: number;
  durationMs: number;
  result: WorkflowTaskResult | null;
  error: string | null;
};

export type WorkflowSnapshot = {
  id: string;
  parentSessionKey: SessionKey;
  goal: string;
  mode: WorkflowMode;
  status: WorkflowStatus;
  maxConcurrency: number;
  tokenLimit: number;
  timeoutMs: number;
  createdAt: string;
  updatedAt: string;
  tasks: WorkflowTaskState[];
};
```

- [ ] **Step 3: Implement only the essential graph checks**

Create `src/workflows/validate.ts`. Check:

1. graph/task IDs, goal, role and instruction are non-empty, and the graph has at least one task;
2. task IDs are unique;
3. every dependency names a task in the same graph;
4. Kahn's algorithm visits every task, proving the graph is acyclic;
5. `maxConcurrency` is 1–3, `tokenLimit` and `timeoutMs` are positive;
6. quick mode has at most three tasks, no dependencies, `tokenLimit <= 12_000`, `timeoutMs <= 45_000`.

Return the original typed graph on success. Do not add teaching-role enums, keyword rules, path policy objects or a generic validation framework.

- [ ] **Step 4: Write failing Session custom-entry tests**

Create `tests/workflows/store.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { WorkflowStore } from '../../src/workflows/store';
import type { WorkflowSnapshot } from '../../src/workflows/contracts';

const snapshot = { id: 'wf-1', parentSessionKey: 'coach:p1', goal: '备课检查', mode: 'deep', status: 'proposed', maxConcurrency: 2, tokenLimit: 20_000, timeoutMs: 90_000, createdAt: '2026-07-22T00:00:00.000Z', updatedAt: '2026-07-22T00:00:00.000Z', tasks: [] } satisfies WorkflowSnapshot;

test('restores latest deep-mode and workflow snapshots from Pi custom entries', () => {
  const manager = SessionManager.inMemory('/tmp/study');
  const store = new WorkflowStore(manager);
  store.setDeepMode(true);
  store.save(snapshot);
  store.save({ ...snapshot, status: 'running', updatedAt: '2026-07-22T00:01:00.000Z' });
  expect(store.deepMode()).toBe(true);
  expect(store.list()).toEqual([{ ...snapshot, status: 'running', updatedAt: '2026-07-22T00:01:00.000Z' }]);
});
```

- [ ] **Step 5: Implement the Pi-owned workflow store**

Create `src/workflows/store.ts`:

```ts
import type { CustomEntry, SessionManager } from '@earendil-works/pi-coding-agent';
import type { WorkflowSnapshot } from './contracts';

const MODE = 'studyforge.deep-mode.v1';
const WORKFLOW = 'studyforge.workflow.v1';

export class WorkflowStore {
  constructor(private readonly manager: SessionManager) {}

  setDeepMode(enabled: boolean): void {
    this.manager.appendCustomEntry(MODE, { enabled });
  }

  deepMode(): boolean {
    const entries = this.manager.getEntries().filter((entry): entry is CustomEntry<{ enabled: boolean }> =>
      entry.type === 'custom' && entry.customType === MODE);
    return entries.at(-1)?.data?.enabled ?? false;
  }

  save(snapshot: WorkflowSnapshot): void {
    this.manager.appendCustomEntry(WORKFLOW, snapshot);
  }

  list(): WorkflowSnapshot[] {
    const latest = new Map<string, WorkflowSnapshot>();
    for (const entry of this.manager.getEntries()) {
      if (entry.type !== 'custom' || entry.customType !== WORKFLOW || !entry.data) continue;
      const snapshot = entry.data as WorkflowSnapshot;
      latest.set(snapshot.id, snapshot);
    }
    return [...latest.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  }
}
```

- [ ] **Step 6: Run and commit the workflow contract**

```bash
cd apps/pi-teaching-web
bun test tests/workflows/validate.test.ts tests/workflows/store.test.ts
bun run typecheck
git add src/workflows tests/workflows
git commit -m "feat: define Pi workflow session state"
```

Expected: valid quick/deep graphs round-trip through Pi custom entries; invalid structure fails before delegation.

---

### Task 3: Bridge to the public `pi-subagents` delegation protocol

**Files:**

- Create: `apps/pi-teaching-web/src/workflows/delegation-client.ts`
- Create: `apps/pi-teaching-web/tests/workflows/delegation-client.test.ts`

**Interfaces:**

- Produces: `delegateStudyTask(eventBus, input, signal, onUpdate)`.
- Consumes only exports from `pi-subagents/delegation`; no internal imports or shell invocation.
- Uses a fresh `study-scout` child, parent learning-set cwd, explicit budgets and no acceptance workflow.

- [ ] **Step 1: Write the failing EventBus bridge test**

Create `tests/workflows/delegation-client.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { createEventBus } from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  SUBAGENT_DELEGATION_UPDATE_EVENT,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { delegateStudyTask } from '../../src/workflows/delegation-client';

test('correlates public delegation updates and response by requestId', async () => {
  const bus = createEventBus();
  const requests: SubagentDelegationRequest[] = [];
  const updates: number[] = [];
  bus.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (raw) => {
    const request = raw as SubagentDelegationRequest;
    requests.push(request);
    bus.emit(SUBAGENT_DELEGATION_UPDATE_EVENT, { version: 1, requestId: request.requestId, tokens: 321, durationMs: 50 });
    bus.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
      version: 1, requestId: request.requestId, status: 'completed', runId: 'run-1', tokens: 500,
      output: '{"findings":[],"evidence_refs":[],"recommended_action":"继续观察","risks":[]}',
    });
  });

  const response = await delegateStudyTask(bus, {
    requestId: 'request-1', cwd: '/tmp/study', task: 'Return JSON.', timeoutMs: 45_000,
    turnBudget: { maxTurns: 4 }, toolBudget: { hard: 12 },
  }, undefined, (update) => updates.push(update.tokens ?? 0));

  expect(requests[0]).toMatchObject({ version: 1, agent: 'study-scout', context: 'fresh', artifacts: true });
  expect(updates).toEqual([321]);
  expect(response.status).toBe('completed');
});
```

- [ ] **Step 2: Implement request, update, response and cancel wiring**

Create `src/workflows/delegation-client.ts`:

```ts
import type { EventBus } from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_CANCEL_EVENT,
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  SUBAGENT_DELEGATION_UPDATE_EVENT,
  type SubagentDelegationResponse,
  type SubagentDelegationUpdate,
} from 'pi-subagents/delegation';

export type StudyDelegationInput = {
  requestId: string;
  cwd: string;
  task: string;
  timeoutMs: number;
  turnBudget: { maxTurns: number; graceTurns?: number };
  toolBudget: { hard: number; soft?: number };
};

export function delegateStudyTask(
  bus: EventBus,
  input: StudyDelegationInput,
  signal: AbortSignal | undefined,
  onUpdate: (update: SubagentDelegationUpdate) => void,
): Promise<SubagentDelegationResponse> {
  return new Promise((resolve) => {
    const finish = (response: SubagentDelegationResponse) => {
      if (response.requestId !== input.requestId) return;
      offUpdate(); offResponse(); signal?.removeEventListener('abort', cancel);
      resolve(response);
    };
    const cancel = () => bus.emit(SUBAGENT_DELEGATION_CANCEL_EVENT, { version: 1, requestId: input.requestId });
    const offUpdate = bus.on(SUBAGENT_DELEGATION_UPDATE_EVENT, (raw) => {
      const update = raw as SubagentDelegationUpdate;
      if (update.requestId === input.requestId) onUpdate(update);
    });
    const offResponse = bus.on(SUBAGENT_DELEGATION_RESPONSE_EVENT, (raw) => finish(raw as SubagentDelegationResponse));
    signal?.addEventListener('abort', cancel, { once: true });
    bus.emit(SUBAGENT_DELEGATION_REQUEST_EVENT, {
      version: 1,
      requestId: input.requestId,
      agent: 'study-scout',
      task: input.task,
      context: 'fresh',
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
      turnBudget: input.turnBudget,
      toolBudget: input.toolBudget,
      artifacts: true,
      acceptance: { level: 'none', reason: 'Read-only teaching analysis; the parent owns all formal writes.' },
    });
  });
}
```

- [ ] **Step 3: Add cancellation coverage**

Extend the test with an `AbortController`. On `SUBAGENT_DELEGATION_CANCEL_EVENT`, assert the matching request ID and emit a public `cancelled` response. Expect the returned status to be `cancelled`; do not test private extension state.

- [ ] **Step 4: Run and commit the public bridge**

```bash
cd apps/pi-teaching-web
bun test tests/workflows/delegation-client.test.ts
bun run typecheck
git add src/workflows/delegation-client.ts tests/workflows/delegation-client.test.ts
git commit -m "feat: bridge Pi subagent delegation events"
```

Expected: the client delegates, updates and cancels entirely through the versioned public event family.

---

### Task 4: Execute dependency waves and preserve raw structured results

**Files:**

- Create: `apps/pi-teaching-web/src/workflows/runtime.ts`
- Create: `apps/pi-teaching-web/tests/workflows/runtime.test.ts`

**Interfaces:**

- Produces: `DeepWorkflowRuntime.propose(graph, signal)`, `confirm(id)`, `cancel(id)`, `list()`, `subscribe(listener)`.
- Runs quick graphs immediately and deep graphs only after `confirm`.
- Publishes in-memory snapshots for the UI and persists state transitions through `WorkflowStore`.
- Returns raw child JSON only to the parent runtime; the student projection is added later.

- [ ] **Step 1: Write failing dependency and partial-result tests**

Create `tests/workflows/runtime.test.ts` with an injected fake delegator. The fake must record start/finish order and return JSON without starting Pi:

```ts
import { expect, test } from 'bun:test';
import { createEventBus, SessionManager } from '@earendil-works/pi-coding-agent';
import { DeepWorkflowRuntime } from '../../src/workflows/runtime';
import { WorkflowStore } from '../../src/workflows/store';
import type { WorkflowGraph } from '../../src/workflows/contracts';

const graph: WorkflowGraph = {
  id: 'wf-deep', goal: '备课会诊', mode: 'deep', maxConcurrency: 2, tokenLimit: 20_000, timeoutMs: 90_000,
  tasks: [
    { id: 'evidence', label: '证据整理', role: '证据分析员', instruction: '整理来源。', dependsOn: [], sourceHandles: ['cards/a.yaml'], readRoots: ['cards', 'lessons'] },
    { id: 'spoiler', label: '防剧透', role: '防剧透审查员', instruction: '检查学生视图。', dependsOn: [], sourceHandles: ['lessons/l.md'], readRoots: ['lessons'] },
    { id: 'design', label: '课堂设计', role: '课堂设计员', instruction: '综合前两项。', dependsOn: ['evidence', 'spoiler'], sourceHandles: [], readRoots: ['plans', 'lessons'] },
  ],
};

test('waits for dependencies and runs only ready tasks in parallel', async () => {
  const timeline: string[] = [];
  const delegate = async (_bus: unknown, input: { requestId: string }) => {
    const id = input.requestId.split(':').at(-1)!;
    timeline.push(`start:${id}`);
    await Promise.resolve();
    timeline.push(`finish:${id}`);
    return { version: 1 as const, requestId: input.requestId, status: 'completed' as const, runId: `run-${id}`, tokens: 100,
      output: JSON.stringify({ findings: [`${id} finding`], evidence_refs: [`#${id}`], recommended_action: `${id} action`, risks: [] }) };
  };
  const runtime = new DeepWorkflowRuntime('coach:p1', '/tmp/study', createEventBus(), new WorkflowStore(SessionManager.inMemory('/tmp/study')), () => new Date('2026-07-22T00:00:00Z'), delegate as never);
  await runtime.propose(graph);
  await runtime.confirm('wf-deep');
  expect(timeline.indexOf('start:design')).toBeGreaterThan(timeline.indexOf('finish:evidence'));
  expect(timeline.indexOf('start:design')).toBeGreaterThan(timeline.indexOf('finish:spoiler'));
  expect(runtime.list()[0]?.status).toBe('completed');
});

test('keeps independent successes when one branch fails', async () => {
  const delegate = async (_bus: unknown, input: { requestId: string }) => {
    const id = input.requestId.split(':').at(-1)!;
    if (id === 'spoiler') return {
      version: 1 as const, requestId: input.requestId, status: 'failed' as const, error: 'review unavailable',
    };
    return {
      version: 1 as const, requestId: input.requestId, status: 'completed' as const, tokens: 100,
      output: JSON.stringify({ findings: ['real evidence'], evidence_refs: ['cards/a.yaml'], recommended_action: 'retain evidence', risks: [] }),
    };
  };
  const runtime = new DeepWorkflowRuntime('coach:p1', '/tmp/study', createEventBus(), new WorkflowStore(SessionManager.inMemory('/tmp/study')), () => new Date('2026-07-22T00:00:00Z'), delegate as never);
  await runtime.propose(graph);
  const result = await runtime.confirm('wf-deep');
  expect(result.status).toBe('partial');
  expect(result.tasks.find((task) => task.id === 'evidence')?.result?.evidence_refs).toEqual(['cards/a.yaml']);
  expect(result.tasks.find((task) => task.id === 'spoiler')?.status).toBe('failed');
  expect(result.tasks.find((task) => task.id === 'design')?.status).toBe('blocked');
});

test('cancels active requests and never starts queued dependents', async () => {
  const started: string[] = [];
  const delegate = (_bus: unknown, input: { requestId: string }, signal?: AbortSignal) => new Promise<object>((resolve) => {
    started.push(input.requestId.split(':').at(-1)!);
    signal?.addEventListener('abort', () => resolve({
      version: 1, requestId: input.requestId, status: 'cancelled',
    }), { once: true });
  });
  const runtime = new DeepWorkflowRuntime('coach:p1', '/tmp/study', createEventBus(), new WorkflowStore(SessionManager.inMemory('/tmp/study')), () => new Date('2026-07-22T00:00:00Z'), delegate as never);
  await runtime.propose(graph);
  const running = runtime.confirm('wf-deep');
  await Promise.resolve();
  runtime.cancel('wf-deep');
  const result = await running;
  expect(started.sort()).toEqual(['evidence', 'spoiler']);
  expect(result.status).toBe('cancelled');
  expect(result.tasks.find((task) => task.id === 'design')?.status).toBe('cancelled');
});
```

- [ ] **Step 2: Implement strict final-output parsing**

In `runtime.ts`, add `parseTaskResult(output)` that accepts a plain JSON object or one fenced `json` block. It must require string arrays for `findings`, `evidence_refs`, `risks` and a string `recommended_action`; malformed output makes that task `failed`. Do not attempt natural-language repair or a second model call.

- [ ] **Step 3: Implement the runtime state machine**

Use this public class surface:

```ts
export type WorkflowListener = (snapshot: WorkflowSnapshot) => void;
export type WorkflowDelegator = typeof delegateStudyTask;

export class DeepWorkflowRuntime {
  constructor(
    private readonly parentSessionKey: SessionKey,
    private readonly root: string,
    private readonly eventBus: EventBus,
    private readonly store: WorkflowStore,
    private readonly now: () => Date,
    private readonly delegate: WorkflowDelegator = delegateStudyTask,
  ) {}

  enabled(): boolean;
  setEnabled(enabled: boolean): void;
  list(): WorkflowSnapshot[];
  subscribe(listener: WorkflowListener): () => void;
  propose(graph: WorkflowGraph, signal?: AbortSignal): Promise<WorkflowSnapshot>;
  confirm(workflowId: string): Promise<WorkflowSnapshot>;
  cancel(workflowId: string): void;
  setSynthesisSink(sink: (snapshot: WorkflowSnapshot) => Promise<void>): void;
}
```

Implement these exact transitions:

1. `propose` calls `validateWorkflowGraph`, creates queued task states, saves and publishes `proposed` for deep mode.
2. Quick mode saves/publishes `running`, executes immediately, then returns the terminal snapshot without calling the asynchronous synthesis sink; its tool result will give the parent the outputs.
3. `confirm` accepts only a `proposed` deep workflow, marks it `running`, executes it and calls the synthesis sink once on `completed` or `partial`.
4. A task is ready only when every dependency is `completed`. If any dependency is `failed`, `blocked` or `cancelled`, mark the task `blocked`.
5. Start at most `maxConcurrency` ready tasks at once. Give each task a request ID `${workflowId}:${taskId}` and its own `AbortController`.
6. Build the child prompt from the task role, workflow goal, task instruction, source handles, allowed read roots and the parsed results of direct dependencies. End with the exact JSON output contract. Never include the parent transcript.
7. On delegation update, replace that task's latest Token/duration counters and publish an in-memory snapshot. Persist only task start and terminal transitions, not every Token update.
8. Compute one workflow deadline at start. Pass only the remaining milliseconds to each delegation request; when no time remains, stop launching and cancel active requests.
9. Sum each task's latest Token count. Once the workflow limit is reached, stop launching tasks, cancel active requests, and leave already completed results intact.
10. A successful public response with valid JSON becomes `completed`; any other terminal response becomes `failed` or `cancelled` using its public status and error.
11. Overall status is `completed` when every task completes, `partial` when at least one result completes and another task fails/blocks or a budget stops the run, and `failed` when none completes. An explicit student `cancel()` always sets overall status `cancelled` while retaining completed task results.

Store `AbortController`s and subscribers only in memory. On construction, load `store.list()`; convert snapshots left in `running` by a previous process into `partial` when they contain a completed result, otherwise `failed`, with unfinished tasks marked `cancelled`. Do not build automatic resume or retry logic in this phase.

- [ ] **Step 4: Run scheduler tests and current workflow suite**

```bash
cd apps/pi-teaching-web
bun test tests/workflows/runtime.test.ts
bun test tests/workflows
bun run typecheck
```

Expected: dependency order, max concurrency, partial success, cancellation, Token stopping and Session restoration are deterministic with no model.

- [ ] **Step 5: Commit the workflow runtime**

```bash
git add apps/pi-teaching-web/src/workflows/runtime.ts apps/pi-teaching-web/tests/workflows/runtime.test.ts
git commit -m "feat: run bounded teaching workflows"
```

---

### Task 5: Add the parent tool and wire deep mode into Coach/Tutor Sessions

**Files:**

- Create: `apps/pi-teaching-web/src/workflows/tool.ts`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/src/runtime/session-factory.ts`
- Modify: `apps/pi-teaching-web/src/runtime/workspace-registry.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/session-factory.test.ts`
- Modify: `apps/pi-teaching-web/tests/runtime/workspace-registry.test.ts`
- Create: `apps/pi-teaching-web/tests/workflows/tool.test.ts`

**Interfaces:**

- Produces: inactive-by-default custom tool `deep_workflow_propose`.
- Produces: `StudySession` methods for toggling, listing, confirming, cancelling and subscribing to workflows.
- Loads the official `pi-subagents` extension into each parent Session with the same Pi EventBus used by `DeepWorkflowRuntime`.

- [ ] **Step 1: Write failing tool behavior tests**

Create `tests/workflows/tool.test.ts` using a fake runtime:

```ts
import { expect, test } from 'bun:test';
import { createDeepWorkflowTool } from '../../src/workflows/tool';

test('runs quick mode inline but leaves deep mode proposed', async () => {
  const calls: string[] = [];
  const runtime = {
    propose: async (graph: { mode: string }) => {
      calls.push(graph.mode);
      return { id: `wf-${graph.mode}`, status: graph.mode === 'quick' ? 'completed' : 'proposed', tasks: [] };
    },
  } as never;
  const tool = createDeepWorkflowTool(runtime, () => 'wf-generated');
  const base = { goal: '检查', maxConcurrency: 2, tokenLimit: 10_000, timeoutMs: 40_000, tasks: [] };
  const quick = await tool.execute('call-1', { ...base, mode: 'quick' }, undefined, undefined, {} as never);
  const deep = await tool.execute('call-2', { ...base, mode: 'deep' }, undefined, undefined, {} as never);
  expect(calls).toEqual(['quick', 'deep']);
  expect(JSON.stringify(quick.content)).toContain('completed');
  expect(JSON.stringify(deep.content)).toContain('requires_confirmation');
});
```

- [ ] **Step 2: Define the model-facing workflow tool**

Create `src/workflows/tool.ts` with TypeBox parameters matching `WorkflowGraph` except `id`. Each task contains `id`, `label`, `role`, `instruction`, `dependsOn`, `sourceHandles`, and `readRoots`. Use `Type.Union([Type.Literal('quick'), Type.Literal('deep')])` for mode.

`execute` must:

1. generate `wf-${crypto.randomUUID()}`;
2. call `runtime.propose({...input, id}, signal)`;
3. return text JSON containing `workflowId`, `status`, `requires_confirmation`, and completed task results only;
4. keep the full snapshot in `details`, which remains server-side.

The tool description must say: use only after the deep-workflow Skill's two-view gate; gather authentic card/Trace handles first; use quick for at most three independent views; deep requires student confirmation. It must not mention arbitrary code or fixed role routing.

- [ ] **Step 3: Share one EventBus with the official extension**

Change `createRoleResourceLoader` to accept an `EventBus`. Construct it with:

```ts
const loader = new DefaultResourceLoader({
  cwd: root,
  eventBus,
  additionalExtensionPaths: [fileURLToPath(import.meta.resolve('pi-subagents'))],
  // retain the existing skillsOverride and agentsFilesOverride
});
```

Do not import the extension's internal files. Keep `subagent` out of `roleToolNames`; the parent model interacts only with `deep_workflow_propose`.

- [ ] **Step 4: Construct one Runtime beside each Pi Session**

In `createPiSessionFactory`, for each Session:

1. create `const eventBus = createEventBus()`;
2. create/open the existing `SessionManager`;
3. create `WorkflowStore(manager)` and `DeepWorkflowRuntime(sessionKey, root, eventBus, store, now)`;
4. pass `eventBus` into `createRoleResourceLoader` so `pi-subagents` listens on the same bus;
5. add `createDeepWorkflowTool(runtime)` to `customTools` but not the initial tool-name allowlist;
6. after `createAgentSession`, register a synthesis sink that sends one hidden parent message:

```ts
runtime.setSynthesisSink((workflow) => session.sendCustomMessage({
  customType: 'studyforge.workflow-result.v1',
  content: JSON.stringify({
    workflowId: workflow.id,
    goal: workflow.goal,
    results: workflow.tasks.filter((task) => task.result).map((task) => ({
      taskId: task.id, role: task.role, result: task.result,
    })),
  }),
  display: false,
}, { triggerTurn: true }));
```

This sends structured child conclusions, not child transcripts or thinking. The parent turn must synthesize and decide whether to use existing write tools.

- [ ] **Step 5: Extend `StudySession` and toggle only one tool**

Add these methods:

```ts
deepModeEnabled(): boolean;
setDeepMode(enabled: boolean): void;
workflows(): WorkflowSnapshot[];
confirmWorkflow(id: string): Promise<WorkflowSnapshot>;
cancelWorkflow(id: string): void;
subscribeWorkflows(listener: (snapshot: WorkflowSnapshot) => void): () => void;
```

Implement `setDeepMode` by saving the custom entry and changing Pi's active tools:

```ts
const names = session.getActiveToolNames().filter((name) => name !== 'deep_workflow_propose');
session.setActiveToolsByName(enabled ? [...names, 'deep_workflow_propose'] : names);
```

Apply the stored mode once immediately after Session construction. Extend the fake sessions in existing tests with the six methods. Assert `roleToolNames('coach')` and `roleToolNames('tutor')` still omit both `subagent` and `deep_workflow_propose`; the latter appears only after `setDeepMode(true)`.

- [ ] **Step 6: Route workflow controls through `WorkspaceRegistry`**

Add methods that open the selected Coach or active Tutor exactly as existing message routing does:

```ts
setDeepMode(key: SessionKey, enabled: boolean): Promise<void>;
deepMode(key: SessionKey): Promise<boolean>;
workflows(key: SessionKey): Promise<WorkflowSnapshot[]>;
confirmWorkflow(key: SessionKey, id: string): Promise<WorkflowSnapshot>;
cancelWorkflow(key: SessionKey, id: string): Promise<void>;
subscribeWorkflows(key: SessionKey, listener: (snapshot: WorkflowSnapshot) => void): () => void;
```

Do not create a Tutor Session for a `prepared`, `closed` or `abandoned` Lesson merely to toggle deep mode; return `LESSON_NOT_OPEN` through the existing boundary.

- [ ] **Step 7: Run Session/tool tests and commit**

```bash
cd apps/pi-teaching-web
bun test tests/workflows/tool.test.ts tests/runtime/session-factory.test.ts tests/runtime/workspace-registry.test.ts
bun run typecheck
git add src/runtime src/workflows/tool.ts tests/runtime tests/workflows/tool.test.ts
git commit -m "feat: attach deep workflows to Pi sessions"
```

Expected: deep mode changes one parent Session's available tool without exposing `subagent` or changing another Session.

---

### Task 6: Teach Coach and Tutor when to use dynamic workflows

**Files:**

- Create: `apps/pi-teaching-web/resources/skills/deep-workflow/SKILL.md`
- Modify: `apps/pi-teaching-web/src/runtime/resource-loader.ts`
- Modify: `apps/pi-teaching-web/resources/agents/coach.md`
- Modify: `apps/pi-teaching-web/resources/agents/tutor.md`
- Create: `apps/pi-teaching-web/tests/runtime/deep-workflow-skill.test.ts`

**Interfaces:**

- Produces one Skill shared by Coach and Tutor.
- The Skill controls semantic triggering; TypeScript validates only graph structure and budgets.
- Dynamic roles live in task prompts and cannot change the read-only runtime profile.

- [ ] **Step 1: Write the failing Skill contract test**

Create `tests/runtime/deep-workflow-skill.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(import.meta.dir, '../../resources/skills/deep-workflow/SKILL.md'), 'utf8');

test('gates delegation and preserves parent-only writes', () => {
  for (const required of [
    'two independent lenses', 'could change the next teaching action',
    'card_search', 'trace_search', 'quick', 'deep', 'student confirmation',
    'parent remains the only writer',
  ]) expect(source).toContain(required);
  expect(source).toContain('return an empty result');
  expect(source).not.toContain('always delegate');
});
```

- [ ] **Step 2: Create the shared dynamic-workflow Skill**

Create `resources/skills/deep-workflow/SKILL.md`:

```markdown
---
name: deep-workflow
description: Decide whether a Coach or Tutor needs a bounded multi-view consultation and, when useful, propose it through deep_workflow_propose.
---

# Deep Workflow

Use this Skill only while the current Session's deep-mode toggle is enabled.

1. First decide whether there are **two independent lenses** and whether their outputs **could change the next teaching action**. If either condition is false, answer directly and do not call the workflow tool.
2. Before delegation, use `card_search` for authentic candidate cards with bound Trace. Use `trace_search` only for cross-card evidence. Convert real hits, Lesson summaries and material links into source handles. If search is empty, return an empty result or change the plan; never invent a card, Trace, alias or path.
3. Choose dynamic roles that match this decision. Coach examples: evidence analysis, learner-state analysis, activity design, no-spoiler review, adversarial Plan review. Tutor examples: response analysis, misconception diagnosis, hint design, alternate explanation, classroom review. Roles are task labels, not new permanent agents.
4. Use `quick` only for at most three independent, single-wave tasks under 12,000 Token and 45 seconds. The tool may run it immediately.
5. Use `deep` for dependency waves, adversarial checks or larger budgets. The tool only records a proposal; wait for explicit **student confirmation** in the frontend before it runs.
6. Give each task only its goal, current Lesson/Plan position, real source handles, allowed read roots, dependency results and JSON output contract. Do not pass the full parent transcript.
7. Treat child results as advice. Check evidence references, explain missing or conflicting views, and synthesize the next action yourself. The **parent remains the only writer** of Lesson, Trace, Plan, profiles and planner attention.
8. Do not expose child transcript, hidden reasoning, answer-bearing intermediate output or unreviewed suggestions to the student. On cancellation or partial failure, use completed evidence if useful and name the missing view.
```

- [ ] **Step 3: Register the Skill for both roles**

Add `deep-workflow` to the `skillsOverride` list alongside the existing role Skill. Add one sentence to Coach and Tutor role contexts: when the tool is enabled, load `deep-workflow`; ordinary direct responses remain preferred when its two-view gate is not met.

Do not create separate role files for every temporary expert and do not hard-code a workflow graph in either Agent prompt.

- [ ] **Step 4: Run and commit Skill tests**

```bash
cd apps/pi-teaching-web
bun test tests/runtime/deep-workflow-skill.test.ts
bun run typecheck
git add resources src/runtime/resource-loader.ts tests/runtime/deep-workflow-skill.test.ts
git commit -m "feat: add dynamic teaching workflow skill"
```

Expected: both parents can load one shared gate/assembly Skill while all execution permissions remain in TypeScript.

---

### Task 7: Expose safe workflow state over HTTP and WebSocket

**Files:**

- Modify: `apps/pi-teaching-web/src/shared/contracts.ts`
- Create: `apps/pi-teaching-web/src/projection/workflow-projector.ts`
- Modify: `apps/pi-teaching-web/src/server/app.ts`
- Modify: `apps/pi-teaching-web/tests/server/workspace-api.test.ts`
- Create: `apps/pi-teaching-web/tests/projection/workflow-projector.test.ts`

**Interfaces:**

- Produces: `WorkflowView` with graph/status/source counts but no raw findings or child output.
- `GET /api/sessions/:sessionKey/deep` returns toggle plus current workflows.
- `POST /api/sessions/:sessionKey/deep` accepts `{ enabled }`.
- `POST /api/sessions/:sessionKey/workflows/:workflowId/confirm|cancel` applies the student action and returns the safe workflow projection.
- WebSocket publishes `StudyViewEvent { type: 'workflow'; sessionKey; workflow }`.

- [ ] **Step 1: Add student-safe view contracts**

Append to `src/shared/contracts.ts`:

```ts
export type WorkflowTaskView = {
  id: string;
  label: string;
  role: string;
  dependsOn: string[];
  status: 'queued' | 'running' | 'completed' | 'failed' | 'blocked' | 'cancelled';
  sourceCount: number;
  progress: string;
};

export type WorkflowView = {
  id: string;
  goal: string;
  mode: 'quick' | 'deep';
  status: 'proposed' | 'running' | 'completed' | 'partial' | 'failed' | 'cancelled';
  maxConcurrency: number;
  tokenLimit: number;
  timeoutMs: number;
  tasks: WorkflowTaskView[];
};
```

Add this arm to `StudyViewEvent`:

```ts
| { type: 'workflow'; sessionKey: SessionKey; workflow: WorkflowView }
```

- [ ] **Step 2: Write the failing no-spoiler projection test**

Create `tests/projection/workflow-projector.test.ts`:

```ts
import { expect, test } from 'bun:test';
import { projectWorkflow } from '../../src/projection/workflow-projector';

test('projects lifecycle and source count without raw child conclusions', () => {
  const view = projectWorkflow({
    id: 'wf-1', parentSessionKey: 'tutor:l1', goal: '分析下一步提示', mode: 'quick', status: 'completed',
    maxConcurrency: 2, tokenLimit: 12_000, timeoutMs: 45_000,
    createdAt: '2026-07-22T00:00:00Z', updatedAt: '2026-07-22T00:00:10Z',
    tasks: [{
      id: 'hint', label: '提示审查', role: '提示设计员', instruction: 'private instruction', dependsOn: [],
      sourceHandles: ['cards/secret.card.yaml'], readRoots: ['cards'], status: 'completed', runId: 'run-1',
      tokens: 500, durationMs: 1000,
      result: { findings: ['答案是 D'], evidence_refs: ['cards/a.yaml', 'lessons/l.md#trace-event-1'], recommended_action: '直接说 D', risks: [] }, error: null,
    }],
  });
  expect(view.tasks[0]).toMatchObject({ status: 'completed', sourceCount: 2, progress: '分析完成' });
  const text = JSON.stringify(view);
  expect(text).not.toContain('答案是 D');
  expect(text).not.toContain('直接说 D');
  expect(text).not.toContain('private instruction');
  expect(text).not.toContain('run-1');
});
```

- [ ] **Step 3: Implement deterministic workflow projection**

Create `src/projection/workflow-projector.ts`:

```ts
import type { WorkflowSnapshot } from '../workflows/contracts';
import type { WorkflowView } from '../shared/contracts';

const progress = {
  queued: '等待前序任务', running: '正在分析', completed: '分析完成',
  failed: '分析失败', blocked: '前序结果缺失', cancelled: '已取消',
} as const;

export function projectWorkflow(snapshot: WorkflowSnapshot): WorkflowView {
  return {
    id: snapshot.id,
    goal: snapshot.goal,
    mode: snapshot.mode,
    status: snapshot.status,
    maxConcurrency: snapshot.maxConcurrency,
    tokenLimit: snapshot.tokenLimit,
    timeoutMs: snapshot.timeoutMs,
    tasks: snapshot.tasks.map((task) => ({
      id: task.id,
      label: task.label,
      role: task.role,
      dependsOn: task.dependsOn,
      status: task.status,
      sourceCount: task.result?.evidence_refs.length ?? task.sourceHandles.length,
      progress: progress[task.status],
    })),
  };
}
```

- [ ] **Step 4: Add Session-scoped API routes**

In `app.ts`, add:

- `GET /api/sessions/:key/deep` → `{ enabled, workflows: projectWorkflow(...)[] }`;
- `POST /api/sessions/:key/deep` → parse `{ enabled: boolean }`, call `registry.setDeepMode`, bind workflow events, return the same DTO;
- `POST /api/sessions/:key/workflows/:id/confirm` → call `registry.confirmWorkflow` and return its safe projection;
- `POST /api/sessions/:key/workflows/:id/cancel` → call `registry.cancelWorkflow`, read the updated snapshot and return its safe projection.

Extend the existing per-Session `bind(key)` so it subscribes once to both Pi events and `registry.subscribeWorkflows`. Every workflow callback publishes:

```ts
deps.hub.publish({ type: 'workflow', sessionKey: key, workflow: projectWorkflow(snapshot) });
```

No route returns `WorkflowTaskResult`, delegation output, output path, Session file, child run ID, child error text or Token-by-Token logs.

- [ ] **Step 5: Extend fake registry API tests**

In `workspace-api.test.ts`, add workflow methods to the fake registry and verify:

1. enabling `coach:p1` calls `setDeepMode('coach:p1', true)`;
2. confirming a proposed workflow calls `confirmWorkflow('coach:p1', 'wf-1')`;
3. the HTTP response and published WebSocket event omit a seeded answer-bearing finding.

- [ ] **Step 6: Run and commit the safe API**

```bash
cd apps/pi-teaching-web
bun test tests/projection/workflow-projector.test.ts tests/server/workspace-api.test.ts
bun run typecheck
git add src/shared/contracts.ts src/projection/workflow-projector.ts src/server/app.ts \
  tests/projection/workflow-projector.test.ts tests/server/workspace-api.test.ts
git commit -m "feat: expose student-safe workflow progress"
```

Expected: the browser can control and observe a workflow but cannot receive raw subagent conclusions.

---

### Task 8: Render the Session toggle and collapsible task rail

**Files:**

- Modify: `apps/pi-teaching-web/src/client/api.ts`
- Modify: `apps/pi-teaching-web/src/client/state.ts`
- Modify: `apps/pi-teaching-web/src/client/App.tsx`
- Create: `apps/pi-teaching-web/src/client/components/DeepModeToggle.tsx`
- Create: `apps/pi-teaching-web/src/client/components/TaskRail.tsx`
- Modify: `apps/pi-teaching-web/src/client/styles.css`
- Modify: `apps/pi-teaching-web/tests/client/state.test.ts`
- Create: `apps/pi-teaching-web/tests/client/task-rail.test.tsx`

**Interfaces:**

- Toggle always applies to the currently selected Coach/Tutor Session.
- Task rail is separate from chat messages and grouped by Session key.
- Deep proposals show exact budgets and a confirmation action; quick workflows show immediately.
- Cancel remains visible while any task is queued/running.

- [ ] **Step 1: Extend client API and reducer tests**

Add to `api.ts`:

```ts
deep: (key: SessionKey) => json<{ enabled: boolean; workflows: WorkflowView[] }>(`/api/sessions/${encodeURIComponent(key)}/deep`),
setDeep: (key: SessionKey, enabled: boolean) => json<{ enabled: boolean; workflows: WorkflowView[] }>(`/api/sessions/${encodeURIComponent(key)}/deep`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ enabled }),
}),
workflowAction: (key: SessionKey, id: string, action: 'confirm' | 'cancel') =>
  json<WorkflowView>(`/api/sessions/${encodeURIComponent(key)}/workflows/${encodeURIComponent(id)}/${action}`, { method: 'POST' }),
```

Extend `ClientState`:

```ts
deepMode: Partial<Record<SessionKey, boolean>>;
workflows: Partial<Record<SessionKey, WorkflowView[]>>;
```

Initialize both maps to `{}` in `initialClientState`. In `reduceClientState`, replace a workflow with the same ID only inside `event.sessionKey`. Extend `state.test.ts` to dispatch one Coach and one Tutor workflow and assert they never mix.

- [ ] **Step 2: Write the failing task-rail component test**

Create `tests/client/task-rail.test.tsx` using `react-dom/server`:

```tsx
import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import { TaskRail } from '../../src/client/components/TaskRail';

test('renders dependencies and budgets without child output', () => {
  const html = renderToStaticMarkup(<TaskRail workflows={[{
    id: 'wf-1', goal: '备课会诊', mode: 'deep', status: 'proposed', maxConcurrency: 2,
    tokenLimit: 20_000, timeoutMs: 90_000,
    tasks: [
      { id: 'evidence', label: '整理证据', role: '证据分析员', dependsOn: [], status: 'queued', sourceCount: 4, progress: '等待前序任务' },
      { id: 'design', label: '设计课堂', role: '课堂设计员', dependsOn: ['evidence'], status: 'queued', sourceCount: 0, progress: '等待前序任务' },
    ],
  }]} onAction={async () => {}} />);
  expect(html).toContain('备课会诊');
  expect(html).toContain('20,000 Token');
  expect(html).toContain('确认运行');
  expect(html).toContain('依赖 evidence');
});
```

- [ ] **Step 3: Implement compact controls**

Create `DeepModeToggle.tsx` as a labeled checkbox/button pair displaying `普通模式` or `深度模式已允许`. It must not imply a workflow is currently running.

Create `TaskRail.tsx` with:

- one `<details>` per workflow, open while `proposed` or `running`;
- header showing goal, completed/total count and running count;
- budget row for mode, concurrency, formatted Token limit and seconds;
- one task row with status glyph, label, role, dependencies, progress and source count;
- `确认运行` only for `deep + proposed`;
- `取消` only when proposed/running;
- no renderer for raw findings, prompts, output paths, errors or child transcripts.

Use ordinary buttons and CSS grid; do not add a graph library or animation runtime.

- [ ] **Step 4: Integrate with the selected Session**

In `App`:

1. load `api.deep(selected)` whenever selected Session changes and that Session can accept messages;
2. place `DeepModeToggle` in the chat header;
3. place `TaskRail` between the header and message timeline, not inside the message array;
4. dispatch WebSocket `workflow` events through the reducer;
5. after confirm/cancel, replace the matching workflow with the returned state;
6. for prepared/closed/abandoned Lesson previews, hide the toggle because no live Tutor Session exists.

- [ ] **Step 5: Add restrained workflow styling**

Add `.deep-toggle`, `.task-rail`, `.workflow`, `.workflow-summary`, `.workflow-budget`, `.workflow-task` and status data-attribute styles. Use the existing amber accent for running, green for complete and muted ink for queued. Animate only a small running indicator and task-row position; preserve reduced-motion preferences through a single media query.

- [ ] **Step 6: Run and commit the task rail**

```bash
cd apps/pi-teaching-web
bun test tests/client/state.test.ts tests/client/task-rail.test.tsx
bun run typecheck
bun run build
git add src/client tests/client
git commit -m "feat: render deep workflow task rail"
```

Expected: switching Coach/Tutor changes both deep-mode state and workflow list without adding child messages or sidebar Agent nodes.

---

### Task 9: Validate quick, confirmed-deep, partial and cancelled flows

**Files:**

- Modify: `apps/pi-teaching-web/playwright.config.ts`
- Modify: `apps/pi-teaching-web/tests/e2e/fixture-server.ts`
- Create: `apps/pi-teaching-web/tests/e2e/deep-workflow.spec.ts`
- Modify: `apps/pi-teaching-web/README.md`
- Modify: `docs/zh-CN/Pi教学前端设计说明.md`

**Interfaces:**

- Deterministic browser test uses fake workflow state and no model credentials.
- Real smoke uses `pi-subagents` with the derivative demo and one configured Pi model.
- Verification confirms child work never writes learning-set files.

- [ ] **Step 1: Seed deterministic workflow fixtures**

Extend `tests/e2e/fixture-server.ts` with an in-memory map keyed by `SessionKey`. Seed one proposed `备课多视角检查` workflow and one running `可取消会诊` workflow whose first task is already completed. Implement toggle, list, confirm and cancel methods matching `WorkspaceRegistry`'s public surface. Confirm transitions the proposed graph from `proposed` to `running` and then `completed`; cancel preserves the completed task and marks unfinished tasks cancelled. Publish every snapshot through `EventHub`. Keep all child result data out of its API DTO.

- [ ] **Step 2: Add the browser workflow test**

Create `tests/e2e/deep-workflow.spec.ts`:

```ts
import { expect, test } from '@playwright/test';

test('toggles deep mode and confirms a workflow without adding sidebar agents', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  await page.getByRole('button', { name: /深度模式/ }).click();
  await expect(page.getByText('深度模式已允许')).toBeVisible();
  await expect(page.getByText('备课多视角检查')).toBeVisible();
  await expect(page.getByText('20,000 Token')).toBeVisible();
  await page.getByRole('button', { name: '确认运行' }).click();
  await expect(page.getByText('3/3 已完成')).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Plan sessions' })).not.toContainText('证据分析员');
  await expect(page.locator('.message')).not.toContainText('子 Session');
});

test('cancels unfinished work and keeps a completed branch visible', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /定义域完整性的系统加固/ }).click();
  const workflow = page.locator('.workflow').filter({ hasText: '可取消会诊' });
  await expect(workflow.getByText('分析完成')).toBeVisible();
  await workflow.getByRole('button', { name: '取消' }).click();
  await expect(workflow.getByText('已取消')).toBeVisible();
  await expect(workflow.getByText('分析完成')).toBeVisible();
});
```

- [ ] **Step 3: Document the operational boundary**

In `apps/pi-teaching-web/README.md`, document:

- deep mode is opt-in per Coach/Tutor Session;
- direct response remains normal behavior;
- quick limits are three tasks / 12,000 Token / 45 seconds;
- deep graphs require confirmation and can be cancelled;
- task state belongs to Pi Session JSONL, while formal learning state stays in Markdown;
- raw child artifacts are for parent/runtime inspection, not Student View;
- no account isolation or OS-level sandbox is claimed in local MVP.

Update the Chinese design explanation only where implementation differs: interrupted runs restore as terminal partial/failed state and can be proposed again manually; automatic resume is deferred.

- [ ] **Step 4: Run all deterministic verification**

```bash
cd apps/pi-teaching-web
bun run check
bunx playwright test tests/e2e/workspace.spec.ts tests/e2e/deep-workflow.spec.ts
cd ../../plugins/highschool-study
bun run release:check
```

Expected: unit/integration/type/build/E2E and the original plugin checks all PASS without a model.

- [ ] **Step 5: Run one real-model quick consultation**

With the derivative demo copied to a temporary directory:

1. start the app with a configured Pi model;
2. open `coach:domain-integrity`, enable deep mode and ask for a multi-view review of the next Lesson;
3. verify Coach first calls authentic card/Trace search, then uses quick mode for at most three independent tasks;
4. verify the task rail updates, no temporary Agent appears in the sidebar, and the final Coach answer cites real source handles;
5. diff the learning-set directory before/after the consultation and confirm the read-only children made no change. A later explicit Coach preparation write is a separate action.

- [ ] **Step 6: Run one real-model confirmed and cancelled deep workflow**

1. ask Coach for an evidence-analysis → activity-design → no-spoiler-review dependency graph;
2. verify the UI shows graph and limits before running;
3. confirm once, then inspect dependency order and final parent synthesis;
4. start a second graph, cancel it while running, and verify completed results remain while no formal file write occurs;
5. restart the local server and verify custom entries restore terminal workflow rows without auto-retrying.

Fix only failures that block these normal flows. Do not add retries, daemon supervision, compatibility adapters, generalized policies or distribution security during this task.

- [ ] **Step 7: Commit the vertical slice**

```bash
git add apps/pi-teaching-web docs/zh-CN/Pi教学前端设计说明.md
git commit -m "feat: complete Pi deep teaching workflow"
```

## Deferred Distribution Hardening

Keep the following out of this local implementation:

- multi-user workflow ownership, authentication and per-student process isolation;
- OS sandboxing of child reads and hostile learning-set protection;
- compatibility adapters for future `pi-subagents` protocols or other runtimes;
- automatic retry, resume, checkpoint migration and crash reconciliation;
- provider-wide rate limiting, cost billing, audit export and centralized policy;
- remote queues, worker pools, workflow databases and distributed cancellation;
- arbitrary workflow code, user-authored execution DSLs and permanent expert memory;
- polished artifact browsers for raw child transcripts.

Create a separate hardening plan only when the local learning loop is ready for external distribution.
