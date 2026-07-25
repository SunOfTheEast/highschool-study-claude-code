import { expect, test } from 'bun:test';
import { createEventBus, SessionManager } from '@earendil-works/pi-coding-agent';
import type { WorkflowGraph, WorkflowSnapshot } from '../../src/workflows/contracts';
import { DeepWorkflowRuntime, parseTaskResult } from '../../src/workflows/runtime';
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

const evidenceQuick: WorkflowGraph = {
  id: 'wf-evidence-scout',
  goal: '检查 domain-integrity Plan 的跨题卡证据',
  mode: 'quick',
  maxConcurrency: 1,
  tokenLimit: 12_000,
  timeoutMs: 180_000,
  tasks: [{
    id: 'evidence',
    label: '检索 Plan 证据',
    role: 'Evidence Scout',
    instruction: 'Search Plan domain-integrity across cards and Lessons.',
    dependsOn: [],
    sourceHandles: [],
    readRoots: ['plans', 'lessons', 'cards', 'graph'],
  }],
};

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

test('parses and preserves a compact evidence card index', () => {
  const result = parseTaskResult(JSON.stringify({
    card_index: [{
      cardPath: 'cards/a.yaml',
      title: '题目 A',
      goal: '求参数范围',
      methods: {
        primary: '参变量分离',
        secondary: ['同构变形与换元法'],
      },
      reason: '与当前迁移目标相关。',
      traceRefs: ['lessons/l.md#trace-event-1'],
    }],
    findings: ['跨题证据仍不足。'],
    evidence_refs: ['cards/a.yaml', 'lessons/l.md#trace-event-1'],
    recommended_action: '下一课检验陌生题迁移。',
    risks: [],
  }));

  expect(result.card_index).toEqual([{
    cardPath: 'cards/a.yaml',
    title: '题目 A',
    goal: '求参数范围',
    methods: {
      primary: '参变量分离',
      secondary: ['同构变形与换元法'],
    },
    reason: '与当前迁移目标相关。',
    traceRefs: ['lessons/l.md#trace-event-1'],
  }]);
});

test('parses one fenced compact result even when the child adds outer narration', () => {
  const result = parseTaskResult([
    'Evidence collected.',
    '```json',
    JSON.stringify({
      card_index: [],
      findings: ['证据不足。'],
      evidence_refs: ['lessons/l.md#trace-event-1'],
      recommended_action: '继续验证。',
      risks: [],
    }),
    '```',
  ].join('\n'), { requireCardIndex: true });

  expect(result).toEqual({
    card_index: [],
    findings: ['证据不足。'],
    evidence_refs: ['lessons/l.md#trace-event-1'],
    recommended_action: '继续验证。',
    risks: [],
  });
});

test('rejects a malformed evidence card index entry', () => {
  expect(() => parseTaskResult(JSON.stringify({
    card_index: [{
      cardPath: 'cards/a.yaml',
      title: '题目 A',
      goal: null,
      methods: { primary: null, secondary: 'not-an-array' },
      reason: '相关。',
      traceRefs: [],
    }],
    findings: [],
    evidence_refs: [],
    recommended_action: '',
    risks: [],
  }))).toThrow('INVALID_TASK_RESULT');
});

test('keeps card index optional for ordinary workflow tasks', () => {
  expect(parseTaskResult(JSON.stringify({
    findings: [],
    evidence_refs: [],
    recommended_action: '',
    risks: [],
  }))).toEqual({
    findings: [],
    evidence_refs: [],
    recommended_action: '',
    risks: [],
  });
});

test('requires a card index from an Evidence Scout even when it is empty', async () => {
  const subject = runtime(async (_bus: unknown, input: { requestId: string }) => (
    completed(input.requestId)
  ));

  const result = await subject.propose(evidenceQuick);

  expect(result.status).toBe('failed');
  expect(result.tasks[0]?.error).toBe('INVALID_TASK_RESULT');
});

test('tells an Evidence Scout to discover sources and return a compact card index', async () => {
  let childPrompt = '';
  const subject = runtime(async (
    _bus: unknown,
    input: { requestId: string; task: string; turnBudget?: unknown },
  ) => {
    childPrompt = input.task;
    expect(input.turnBudget).toBeUndefined();
    return completed(input.requestId, JSON.stringify({
      card_index: [],
      findings: [],
      evidence_refs: [],
      recommended_action: '',
      risks: [],
    }));
  });

  const result = await subject.propose(evidenceQuick);

  expect(result.status).toBe('completed');
  expect(childPrompt).toContain('Search Plan domain-integrity across cards and Lessons.');
  expect(childPrompt).toContain('["plans","lessons","cards","graph"]');
  expect(childPrompt).toContain('Discover authentic cards and active Trace');
  expect(childPrompt).toContain('Return card_index even when no real card qualifies');
  expect(childPrompt).toContain('Start with one trace_search');
  expect(childPrompt).toContain('"card_index":[{"cardPath"');
  expect(childPrompt).toContain('evidence_refs contains source-handle strings only');
  expect(childPrompt).not.toContain('cards/a.yaml');
});

test('publishes only safe telemetry while an Evidence Scout is running', async () => {
  const published: WorkflowSnapshot[] = [];
  const subject = runtime(async (
    _bus: unknown,
    input: { requestId: string },
    _signal: AbortSignal,
    onUpdate: (value: {
      version: 1;
      requestId: string;
      durationMs: number;
      tokens: number;
      toolCount: number;
      currentTool: string;
      currentToolArgs: string;
      recentOutput: string;
    }) => void,
  ) => {
    onUpdate({
      version: 1,
      requestId: input.requestId,
      durationMs: 42_000,
      tokens: 3_777,
      toolCount: 4,
      currentTool: 'card_search',
      currentToolArgs: '{"query":"hidden"}',
      recentOutput: 'private partial answer',
    });
    return completed(input.requestId, JSON.stringify({
      card_index: [],
      findings: [],
      evidence_refs: [],
      recommended_action: '',
      risks: [],
    }));
  });
  subject.subscribe((snapshot) => published.push(snapshot));

  await subject.propose(evidenceQuick);

  const running = published.find((snapshot) => (
    snapshot.tasks[0]?.status === 'running'
    && snapshot.tasks[0]?.durationMs === 42_000
  ));
  expect(running?.tasks[0]).toMatchObject({
    tokens: 3_777,
    durationMs: 42_000,
    toolCount: 4,
    currentTool: 'card_search',
  });
  const serialized = JSON.stringify(running);
  expect(serialized).not.toContain('hidden');
  expect(serialized).not.toContain('private partial answer');
});

test('drops unapproved card payload and transcript fields from parsed results', () => {
  const result = parseTaskResult(JSON.stringify({
    card_index: [{
      cardPath: 'cards/a.yaml',
      title: '题目 A',
      goal: null,
      methods: { primary: null, secondary: [] },
      reason: '与当前问题相关。',
      traceRefs: ['lessons/l.md#trace-event-1'],
      content: 'full card yaml',
      solution: 'hidden solution',
    }],
    findings: ['证据不足。'],
    evidence_refs: ['cards/a.yaml'],
    recommended_action: '换一张卡验证。',
    risks: [],
    transcript: 'raw child transcript',
  }));

  expect(result).toEqual({
    card_index: [{
      cardPath: 'cards/a.yaml',
      title: '题目 A',
      goal: null,
      methods: { primary: null, secondary: [] },
      reason: '与当前问题相关。',
      traceRefs: ['lessons/l.md#trace-event-1'],
    }],
    findings: ['证据不足。'],
    evidence_refs: ['cards/a.yaml'],
    recommended_action: '换一张卡验证。',
    risks: [],
  });
  expect(JSON.stringify(result)).not.toContain('hidden solution');
  expect(JSON.stringify(result)).not.toContain('raw child transcript');
});

test('persists and restores a completed compact evidence result', async () => {
  const manager = SessionManager.inMemory('/tmp/study');
  const store = new WorkflowStore(manager);
  const subject = runtime(async (_bus: unknown, input: { requestId: string }) => (
    completed(input.requestId, JSON.stringify({
      card_index: [{
        cardPath: 'cards/a.yaml',
        title: null,
        goal: null,
        methods: { primary: null, secondary: [] },
        reason: 'active Trace 命中。',
        traceRefs: ['lessons/l.md#trace-event-1'],
      }],
      findings: [],
      evidence_refs: ['cards/a.yaml'],
      recommended_action: '',
      risks: [],
    }))
  ), store);
  const quick = {
    ...graph,
    id: 'wf-card-index',
    mode: 'quick' as const,
    tokenLimit: 12_000,
    timeoutMs: 45_000,
    tasks: [graph.tasks[0]!],
  };

  await subject.propose(quick);
  const restored = runtime(async () => completed('unused'), store);

  expect(restored.list()[0]?.tasks[0]?.result?.card_index?.[0]?.cardPath)
    .toBe('cards/a.yaml');
});

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
        toolCount: 2,
        currentTool: null,
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
        toolCount: 1,
        currentTool: 'read',
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
