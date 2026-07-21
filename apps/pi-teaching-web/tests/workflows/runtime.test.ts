import { expect, test } from 'bun:test';
import { createEventBus, SessionManager } from '@earendil-works/pi-coding-agent';
import type { WorkflowGraph, WorkflowSnapshot } from '../../src/workflows/contracts';
import { DeepWorkflowRuntime } from '../../src/workflows/runtime';
import { WorkflowStore } from '../../src/workflows/store';

const graph: WorkflowGraph = {
  id: 'wf-deep',
  goal: '备课会诊',
  mode: 'deep',
  maxConcurrency: 2,
  tokenLimit: 20_000,
  timeoutMs: 90_000,
  tasks: [
    {
      id: 'evidence',
      label: '证据整理',
      role: '证据分析员',
      instruction: '整理来源。',
      dependsOn: [],
      sourceHandles: ['cards/a.yaml'],
      readRoots: ['cards', 'lessons'],
    },
    {
      id: 'spoiler',
      label: '防剧透',
      role: '防剧透审查员',
      instruction: '检查学生视图。',
      dependsOn: [],
      sourceHandles: ['lessons/l.md'],
      readRoots: ['lessons'],
    },
    {
      id: 'design',
      label: '课堂设计',
      role: '课堂设计员',
      instruction: '综合前两项。',
      dependsOn: ['evidence', 'spoiler'],
      sourceHandles: [],
      readRoots: ['plans', 'lessons'],
    },
  ],
};

const fixedNow = () => new Date('2026-07-22T00:00:00Z');

function runtime(delegate: unknown, store = new WorkflowStore(SessionManager.inMemory('/tmp/study'))) {
  return new DeepWorkflowRuntime(
    'coach:p1',
    '/tmp/study',
    createEventBus(),
    store,
    fixedNow,
    delegate as never,
  );
}

function completed(requestId: string, output?: string) {
  const id = requestId.split(':').at(-1)!;
  return {
    version: 1 as const,
    requestId,
    status: 'completed' as const,
    runId: `run-${id}`,
    tokens: 100,
    durationMs: 20,
    output: output ?? JSON.stringify({
      findings: [`${id} finding`],
      evidence_refs: [`#${id}`],
      recommended_action: `${id} action`,
      risks: [],
    }),
  };
}

test('waits for dependencies and runs only ready tasks in parallel', async () => {
  const timeline: string[] = [];
  const delegate = async (_bus: unknown, input: { requestId: string }) => {
    const id = input.requestId.split(':').at(-1)!;
    timeline.push(`start:${id}`);
    await Promise.resolve();
    timeline.push(`finish:${id}`);
    return completed(input.requestId);
  };
  const subject = runtime(delegate);
  await subject.propose(graph);
  await subject.confirm('wf-deep');
  expect(timeline.indexOf('start:design')).toBeGreaterThan(timeline.indexOf('finish:evidence'));
  expect(timeline.indexOf('start:design')).toBeGreaterThan(timeline.indexOf('finish:spoiler'));
  expect(subject.list()[0]?.status).toBe('completed');
});

test('keeps independent successes when one branch fails', async () => {
  const delegate = async (_bus: unknown, input: { requestId: string }) => {
    const id = input.requestId.split(':').at(-1)!;
    if (id === 'spoiler') return {
      version: 1 as const,
      requestId: input.requestId,
      status: 'failed' as const,
      error: 'review unavailable',
    };
    return completed(input.requestId, JSON.stringify({
      findings: ['real evidence'],
      evidence_refs: ['cards/a.yaml'],
      recommended_action: 'retain evidence',
      risks: [],
    }));
  };
  const subject = runtime(delegate);
  await subject.propose(graph);
  const result = await subject.confirm('wf-deep');
  expect(result.status).toBe('partial');
  expect(result.tasks.find((task) => task.id === 'evidence')?.result?.evidence_refs)
    .toEqual(['cards/a.yaml']);
  expect(result.tasks.find((task) => task.id === 'spoiler')?.status).toBe('failed');
  expect(result.tasks.find((task) => task.id === 'design')?.status).toBe('blocked');
});

test('cancels active requests and never starts queued dependents', async () => {
  const started: string[] = [];
  const delegate = (
    _bus: unknown,
    input: { requestId: string },
    signal?: AbortSignal,
  ) => new Promise<object>((resolve) => {
    started.push(input.requestId.split(':').at(-1)!);
    signal?.addEventListener('abort', () => resolve({
      version: 1,
      requestId: input.requestId,
      status: 'cancelled',
    }), { once: true });
  });
  const subject = runtime(delegate);
  await subject.propose(graph);
  const running = subject.confirm('wf-deep');
  await Promise.resolve();
  subject.cancel('wf-deep');
  const result = await running;
  expect(started.sort()).toEqual(['evidence', 'spoiler']);
  expect(result.status).toBe('cancelled');
  expect(result.tasks.find((task) => task.id === 'design')?.status).toBe('cancelled');
});

test('stops queued work when aggregate token updates reach the workflow budget', async () => {
  const started: string[] = [];
  const limited = { ...graph, tokenLimit: 1_000 };
  const delegate = (
    _bus: unknown,
    input: { requestId: string },
    signal: AbortSignal,
    onUpdate: (value: { requestId: string; tokens: number; durationMs: number }) => void,
  ) => new Promise<object>((resolve) => {
    started.push(input.requestId.split(':').at(-1)!);
    onUpdate({ requestId: input.requestId, tokens: 600, durationMs: 10 });
    signal.addEventListener('abort', () => resolve({
      version: 1,
      requestId: input.requestId,
      status: 'cancelled',
      tokens: 600,
    }), { once: true });
  });
  const subject = runtime(delegate);
  await subject.propose(limited);
  const result = await subject.confirm(limited.id);
  expect(started.sort()).toEqual(['evidence', 'spoiler']);
  expect(result.status).toBe('failed');
  expect(result.tasks.find((task) => task.id === 'design')?.status).toBe('cancelled');
});

test('fails malformed child output without a repair call', async () => {
  let calls = 0;
  const subject = runtime(async (_bus: unknown, input: { requestId: string }) => {
    calls += 1;
    return completed(input.requestId, 'not json');
  });
  const quick = {
    ...graph,
    id: 'wf-quick',
    mode: 'quick' as const,
    timeoutMs: 45_000,
    tokenLimit: 12_000,
    tasks: [graph.tasks[0]!],
  };
  const result = await subject.propose(quick);
  expect(result.status).toBe('failed');
  expect(result.tasks[0]?.error).toBe('INVALID_TASK_RESULT');
  expect(calls).toBe(1);
});

test('restores interrupted running work as a terminal partial snapshot', () => {
  const manager = SessionManager.inMemory('/tmp/study');
  const store = new WorkflowStore(manager);
  const restored: WorkflowSnapshot = {
    id: 'wf-restored',
    parentSessionKey: 'coach:p1',
    goal: '恢复检查',
    mode: 'deep',
    status: 'running',
    maxConcurrency: 2,
    tokenLimit: 20_000,
    timeoutMs: 90_000,
    createdAt: '2026-07-21T00:00:00Z',
    updatedAt: '2026-07-21T00:01:00Z',
    tasks: [
      {
        ...graph.tasks[0]!,
        status: 'completed',
        runId: 'run-evidence',
        tokens: 100,
        durationMs: 10,
        result: {
          findings: ['kept'],
          evidence_refs: ['cards/a.yaml'],
          recommended_action: 'keep',
          risks: [],
        },
        error: null,
      },
      {
        ...graph.tasks[1]!,
        status: 'running',
        runId: 'run-spoiler',
        tokens: 20,
        durationMs: 5,
        result: null,
        error: null,
      },
    ],
  };
  store.save(restored);
  const subject = runtime(async () => completed('unused'), store);
  expect(subject.list()[0]?.status).toBe('partial');
  expect(subject.list()[0]?.tasks[1]?.status).toBe('cancelled');
});
