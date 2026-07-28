import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import type {
  MemoryReviewDecision,
  MemoryReviewSnapshot,
} from '../../src/memory-review/contracts';
import type { AbilityProjection } from '../../src/shared/contracts';
import { PreparedLessonValidationError } from '../../src/study/validate-prepared-lesson';
import type { WorkflowSnapshot } from '../../src/workflows/contracts';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const learningSet = {
  title: 'Demo',
  overview: 'Overview',
  learningPrinciples: '',
  goal: 'Goal',
  plans: [],
};
const workspace = {
  learningSet,
  plan: {
    id: 'p1',
    title: 'Plan',
    path: 'plans/p1.md',
    status: 'active',
    goal: 'Goal',
    capabilityStandard: 'Can do',
  },
  coach: { sessionKey: 'coach:p1', sessionId: null },
  lessons: [],
} as const;
const roadmapWorkspace = {
  learningSet,
  coach: { sessionKey: 'coach:@roadmap', sessionId: null },
} as const;
const proposedMemoryReview = {
  id: 'review-1',
  planId: 'p1',
  status: 'proposed',
  items: [{
    id: 'item-1',
    operation: 'add',
    owner: 'student',
    currentText: null,
    proposedText: '先独立尝试。',
    sources: ['lessons/lesson-001.md#lesson-summary'],
    rationale: '多次出现。',
    counterEvidence: '暂无。',
    scope: '训练课。',
  }],
  decisions: [],
} satisfies MemoryReviewSnapshot;

test('returns learning-set, Roadmap and Plan snapshots', async () => {
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
      roadmapSnapshot: () => roadmapWorkspace,
      snapshot: () => workspace,
      send: async () => {},
      startLesson: async () => ({}),
      pauseLesson: async () => {},
      abandonForReprepare: async () => {},
      history: () => [],
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
    } as never,
  });
  expect(await (await handler(new Request('http://local/api/learning-set')))!.json())
    .toEqual(learningSet);
  expect(await (await handler(new Request('http://local/api/workspaces/roadmap')))!.json())
    .toEqual(roadmapWorkspace);
  expect(await (await handler(new Request('http://local/api/workspaces/p1')))!.json())
    .toEqual(workspace);
});

test('returns source-linked context for one Plan Coach', async () => {
  const handler = createRequestHandler({
    root: domainIntegrityFixtureRoot,
    authoring: false,
    hub: new EventHub(),
    registry: {} as never,
  });

  const response = await handler(new Request(
    'http://local/api/plans/domain-integrity/context',
  ));
  expect(response!.status).toBe(200);
  expect(await response!.json()).toMatchObject({
    currentPosition: expect.stringContaining('阶段 `1a` 已通过'),
    priorLessons: [
      expect.objectContaining({
        lessonId: 'lesson-001',
        source: 'lessons/lesson-001.md#lesson-summary',
      }),
      expect.objectContaining({ lessonId: 'lesson-002' }),
    ],
  });
});

test('exposes student-safe content search from the real Session scope', async () => {
  const handler = createRequestHandler({
    root: domainIntegrityFixtureRoot,
    authoring: false,
    hub: new EventHub(),
    registry: {} as never,
  });

  const missing = await handler(new Request(
    'http://local/api/content-search?query=&sessionKey=coach%3Adomain-integrity',
  ));
  expect(missing!.status).toBe(200);
  expect(await missing!.json()).toEqual({ query: '', hits: [] });

  const roadmap = await handler(new Request(
    'http://local/api/content-search?query=domain&sessionKey=coach%3A%40roadmap',
  ));
  expect(roadmap!.status).toBe(403);
  expect(await roadmap!.json()).toEqual({ error: 'CONTENT_SEARCH_ROADMAP_UNAVAILABLE' });

  const coach = await handler(new Request(
    'http://local/api/content-search?query=mst_p0032_ex22&sessionKey=coach%3Adomain-integrity',
  ));
  expect(coach!.status).toBe(200);
  expect(await coach!.json()).toMatchObject({
    hits: [expect.objectContaining({
      kind: 'card',
      source: 'cards/derivative/mst_p0032_ex22.card.yaml',
    })],
  });
});

test('passes the configured message projection mode to history', async () => {
  const modes: unknown[] = [];
  const calls: string[] = [];
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    messageProjection: 'raw-stream',
    hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
      openSession: async (key: string) => {
        calls.push(`open:${key}`);
        return { sessionId: 'roadmap-session' };
      },
      history: (_key: string, mode: unknown) => {
        calls.push('history');
        modes.push(mode);
        return [];
      },
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
    } as never,
  });
  const response = await handler(new Request(
    'http://local/api/sessions/coach%3A%40roadmap/history',
  ));
  expect(response!.status).toBe(200);
  expect(await response!.json()).toEqual([]);
  expect(modes).toEqual(['raw-stream']);
  expect(calls).toEqual(['open:coach:@roadmap', 'history']);
});

test('restores an active Tutor before reading its history', async () => {
  const calls: string[] = [];
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    registry: {
      openSession: async (key: string) => {
        calls.push(`open:${key}`);
        return { sessionId: 'tutor-l1' };
      },
      history: () => {
        calls.push('history');
        return [];
      },
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
    } as never,
  });
  const response = await handler(new Request('http://local/api/sessions/tutor%3Al1/history'));
  expect(response!.status).toBe(200);
  expect(calls).toEqual(['open:tutor:l1', 'history']);
});

test('keeps memory review scoped to a Plan Coach Session', async () => {
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    registry: {
      memoryReview: async () => proposedMemoryReview,
    } as never,
  });

  const tutor = await handler(new Request(
    'http://local/api/sessions/tutor%3Alesson-1/memory-review',
  ));
  expect(tutor!.status).toBe(403);
  expect(await tutor!.json()).toEqual({ error: 'MEMORY_REVIEW_PLAN_COACH_ONLY' });

  const roadmap = await handler(new Request(
    'http://local/api/sessions/coach%3A%40roadmap/memory-review',
  ));
  expect(roadmap!.status).toBe(403);

  const coach = await handler(new Request(
    'http://local/api/sessions/coach%3Ap1/memory-review',
  ));
  expect(coach!.status).toBe(200);
  expect(await coach!.json()).toEqual(proposedMemoryReview);
});

test('rejects incomplete memory decisions before starting the Coach turn', async () => {
  let submitted = false;
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    registry: {
      memoryReview: async () => proposedMemoryReview,
      submitMemoryReview: async () => {
        submitted = true;
        return proposedMemoryReview;
      },
    } as never,
  });

  const response = await handler(new Request(
    'http://local/api/sessions/coach%3Ap1/memory-review/review-1/submit',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decisions: [] }),
    },
  ));

  expect(response!.status).toBe(400);
  expect(await response!.json()).toEqual({
    error: 'MEMORY_REVIEW_DECISIONS_INCOMPLETE',
  });
  expect(submitted).toBe(false);
});

test('accepts complete memory decisions and launches the same Coach Session once', async () => {
  const calls: unknown[] = [];
  let resolveIdle!: () => void;
  const idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  const decisions: MemoryReviewDecision[] = [{
    itemId: 'item-1',
    action: 'accept',
    text: null,
  }];
  const submitted = {
    ...proposedMemoryReview,
    status: 'submitted',
    decisions,
  } satisfies MemoryReviewSnapshot;
  const hub = new EventHub();
  hub.subscribe((event) => {
    if (event.type === 'session-run' && event.status === 'idle') resolveIdle();
  });
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    registry: {
      memoryReview: async (key: string) => {
        calls.push(['get', key]);
        return proposedMemoryReview;
      },
      submitMemoryReview: async (
        key: string,
        reviewId: string,
        input: MemoryReviewDecision[],
      ) => {
        calls.push(['submit', key, reviewId, input]);
        return submitted;
      },
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
      history: () => [],
      snapshot: () => workspace,
    } as never,
  });

  const response = await handler(new Request(
    'http://local/api/sessions/coach%3Ap1/memory-review/review-1/submit',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ decisions }),
    },
  ));

  expect(response!.status).toBe(202);
  expect(await response!.json()).toEqual(submitted);
  await idle;
  expect(calls).toEqual([
    ['get', 'coach:p1'],
    ['submit', 'coach:p1', 'review-1', decisions],
  ]);
});

test('reconciles the complete conversation after a non-retrying agent end', async () => {
  let listener: ((event: unknown) => void) | undefined;
  const items = [{
    kind: 'message',
    message: {
      id: 'coach:p1:1',
      role: 'coach',
      text: '已完成',
      complete: true,
    },
  }] as const;
  const events: unknown[] = [];
  const hub = new EventHub();
  hub.subscribe((event) => events.push(event));
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    registry: {
      openSession: async () => ({ sessionId: 'coach-p1' }),
      history: () => items,
      subscribe: (_key: string, next: (event: unknown) => void) => {
        listener = next;
        return () => {};
      },
      subscribeWorkflows: () => () => {},
    } as never,
  });
  await handler(new Request('http://local/api/sessions/coach%3Ap1/history'));

  listener?.({ type: 'agent_end', messages: [], willRetry: true });
  expect(events).toEqual([]);
  listener?.({ type: 'agent_end', messages: [], willRetry: false });
  expect(events).toEqual([{
    type: 'conversation-snapshot',
    sessionKey: 'coach:p1',
    items,
  }]);
});

test('publishes a fresh learning-set snapshot after a Roadmap Coach turn', async () => {
  const events: unknown[] = [];
  let resolveIdle!: () => void;
  const idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  const updated = {
    ...learningSet,
    plans: [{
      id: 'p1',
      title: 'Plan',
      path: 'plans/p1.md',
      status: 'active',
      goal: 'Goal',
      capabilityStandard: 'Can do',
      planningBasis: 'Student confirmed',
      currentPosition: 'Current',
      nextLessonCandidate: 'Next',
      planSummary: 'Summary',
    }],
  };
  const hub = new EventHub();
  hub.subscribe((event) => {
    events.push(event);
    if (event.type === 'session-run' && event.status === 'idle') resolveIdle();
  });
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    readLearningSet: () => updated,
    registry: {
      openSession: async () => ({ sessionId: 'roadmap-session' }),
      send: async () => {},
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
    } as never,
  });

  const response = await handler(new Request(
    'http://local/api/sessions/coach%3A%40roadmap/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '我确认建立这个学习周期' }),
    },
  ));
  expect(response!.status).toBe(202);
  await idle;

  expect(events).toContainEqual({ type: 'learning-set', value: updated });
  expect(events.some((event) => (
    typeof event === 'object'
    && event !== null
    && 'type' in event
    && (event as { type: string }).type === 'snapshot'
  ))).toBe(false);
});

function traceProjectionHandler(events: unknown[], reader: () => AbilityProjection) {
  let listener: ((event: unknown) => void) | undefined;
  const hub = new EventHub();
  hub.subscribe((event) => events.push(event));
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    readLearningSet: () => learningSet,
    readAbilityProjection: reader,
    registry: {
      snapshot: () => workspace,
      openSession: async () => ({ sessionId: 'tutor-l1' }),
      send: async () => {},
      subscribe: (_key: string, next: (event: unknown) => void) => {
        listener = next;
        return () => {};
      },
      subscribeWorkflows: () => () => {},
    } as never,
  });
  return {
    handler,
    emit: (event: unknown) => listener?.(event),
  };
}

test('publishes one complete ability snapshot after each successful ability fact write', async () => {
  const projection = {
    nodes: [{
      method: '链式求导',
      state: 'unstable',
      score: 0.7,
      evidenceCount: 2,
      sources: ['traces/trace-1.json'],
    }],
  } satisfies AbilityProjection;
  for (const toolName of ['trace_append', 'card_alternative_append']) {
    const events: unknown[] = [];
    const { handler, emit } = traceProjectionHandler(events, () => projection);
    await handler(new Request('http://local/api/sessions/tutor%3Al1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '继续' }),
    }));

    emit({
      type: 'tool_execution_end',
      toolName,
      isError: false,
    });
    expect(events.filter((event) => (
      typeof event === 'object' && event !== null && 'type' in event
        && (event as { type: string }).type === 'ability-update'
    ))).toEqual([{
      type: 'ability-update',
      projection,
    }]);
    expect(events.slice(-2).map((event) => (
      typeof event === 'object' && event !== null && 'type' in event
        ? (event as { type: string }).type
        : null
    ))).toEqual(['work-status', 'ability-update']);
  }
});

test('does not publish an ability snapshot for failed or non-trace tools', async () => {
  for (const event of [
    { type: 'tool_execution_end', toolName: 'trace_append', isError: true },
    { type: 'tool_execution_end', toolName: 'card_alternative_append', isError: true },
    { type: 'tool_execution_end', toolName: 'classroom_update', isError: false },
  ]) {
    const events: unknown[] = [];
    const { handler, emit } = traceProjectionHandler(events, () => ({ nodes: [] }));
    await handler(new Request('http://local/api/sessions/tutor%3Al1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '继续' }),
    }));
    emit(event);
    expect(events.some((item) => (
      typeof item === 'object' && item !== null && 'type' in item
        && (item as { type: string }).type === 'ability-update'
    ))).toBe(false);
  }
});

test('routes a message to the selected Session key', async () => {
  const sent: unknown[] = [];
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
      snapshot: () => workspace,
      send: async (...args: unknown[]) => {
        sent.push(args);
      },
      startLesson: async () => ({}),
      pauseLesson: async () => {},
      abandonForReprepare: async () => {},
      openSession: async () => ({ sessionId: 'coach-p1' }),
      history: () => [],
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
    } as never,
  });
  const response = await handler(new Request('http://local/api/sessions/coach%3Ap1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '继续学习' }),
  }));
  expect(response!.status).toBe(202);
  expect(sent).toEqual([['coach:p1', '继续学习', []]]);
});

test('publishes running state until an accepted Session message finishes', async () => {
  const calls: string[] = [];
  let releaseSend!: () => void;
  let resolveIdle!: () => void;
  const sendPending = new Promise<void>((resolve) => { releaseSend = resolve; });
  const idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  const hub = new EventHub();
  hub.subscribe((event) => {
    if (event.type === 'session-run') calls.push(`run:${event.status}`);
    if (event.type === 'session-run' && event.status === 'idle') resolveIdle();
  });
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    readLearningSet: () => learningSet,
    registry: {
      snapshot: () => workspace,
      send: async () => {
        calls.push('send');
        await sendPending;
      },
      openSession: async () => ({ sessionId: 'coach-p1' }),
      history: () => [],
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
    } as never,
  });

  const response = await handler(new Request('http://local/api/sessions/coach%3Ap1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '继续学习' }),
  }));
  expect(response!.status).toBe(202);
  expect(calls).toEqual(['run:running', 'send']);

  releaseSend();
  await idle;
  expect(calls).toEqual(['run:running', 'send', 'run:idle']);
});

test('publishes the active snapshot before starting the hidden Tutor turn', async () => {
  const calls: string[] = [];
  let releaseKickoff!: () => void;
  let resolveIdle!: () => void;
  const kickoffPending = new Promise<void>((resolve) => { releaseKickoff = resolve; });
  const idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  const hub = new EventHub();
  hub.subscribe((event) => {
    if (event.type === 'snapshot') calls.push('snapshot');
    if (event.type === 'session-run') calls.push(`run:${event.status}`);
    if (event.type === 'session-run' && event.status === 'idle') resolveIdle();
  });
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    readLearningSet: () => learningSet,
    registry: {
      startLesson: async () => { calls.push('start'); },
      triggerLessonStart: async () => {
        calls.push('kickoff');
        await kickoffPending;
      },
      snapshot: () => workspace,
      subscribe: () => {
        calls.push('bind');
        return () => {};
      },
      subscribeWorkflows: () => () => {},
    } as never,
  });

  const response = await handler(new Request('http://local/api/lessons/lesson-003/start', {
    method: 'POST',
  }));
  expect(response!.status).toBe(200);
  expect(calls).toEqual(['start', 'bind', 'snapshot', 'run:running', 'kickoff']);
  releaseKickoff();
  await idle;
  expect(calls).toEqual([
    'start',
    'bind',
    'snapshot',
    'run:running',
    'kickoff',
    'snapshot',
    'run:idle',
  ]);
});

test('returns actionable prepared Lesson issues without starting Tutor', async () => {
  let subscribed = false;
  const issue = {
    code: 'LESSON_ALIAS_MISSING' as const,
    message: 'Block Uses 引用了未声明的 alias：Q-MISSING',
  };
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    registry: {
      startLesson: async () => {
        throw new PreparedLessonValidationError([issue]);
      },
      snapshot: () => workspace,
      subscribe: () => {
        subscribed = true;
        return () => {};
      },
      subscribeWorkflows: () => () => {},
    } as never,
  });

  const response = await handler(new Request('http://local/api/lessons/lesson-003/start', {
    method: 'POST',
  }));

  expect(response!.status).toBe(422);
  expect(await response!.json()).toEqual({
    error: 'PREPARED_LESSON_INVALID',
    issues: [issue],
  });
  expect(subscribed).toBe(false);
});

test('uploads classroom images and attaches them to a Session message', async () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-images-'));
  const sent: unknown[] = [];
  try {
    const handler = createRequestHandler({
      root,
      authoring: false,
      hub: new EventHub(),
      readLearningSet: () => learningSet,
      registry: {
        snapshot: () => workspace,
        send: async (...args: unknown[]) => { sent.push(args); },
        openSession: async () => ({ sessionId: 'coach-p1' }),
        history: () => [],
        subscribe: () => () => {},
        subscribeWorkflows: () => () => {},
      } as never,
    });
    const form = new FormData();
    form.set('image', new File([new Uint8Array([1, 2, 3])], 'work.png', { type: 'image/png' }));
    const upload = await handler(new Request('http://local/api/lessons/lesson-003/images', {
      method: 'POST',
      body: form,
    }));
    const { path } = await upload!.json() as { path: string };
    expect(path).toMatch(/^materials\/classroom\/lesson-003\/.+\.png$/);
    expect([...readFileSync(join(root, path))]).toEqual([1, 2, 3]);

    const response = await handler(new Request('http://local/api/sessions/coach%3Ap1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '这是我的草稿', imagePaths: [path] }),
    }));
    expect(response!.status).toBe(202);
    expect(sent).toEqual([[
      'coach:p1',
      '这是我的草稿',
      [{ type: 'image', data: 'AQID', mimeType: 'image/png' }],
    ]]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('keeps persona selection scoped to the requested Session', async () => {
  let selected = 'calm-senpai';
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
      personaId: () => selected,
      setPersona: async (_key: string, id: string) => { selected = id; },
    } as never,
  });
  const before = await handler(new Request('http://local/api/persona?sessionKey=coach%3Ap1'));
  expect(await before!.json()).toMatchObject({ id: 'calm-senpai' });
  const changed = await handler(new Request('http://local/api/sessions/coach%3Ap1/persona', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ id: 'energetic-classmate' }),
  }));
  expect(await changed!.json()).toMatchObject({ id: 'energetic-classmate' });
});

test('controls deep mode and projects workflow progress without child conclusions', async () => {
  const calls: unknown[] = [];
  let enabled = false;
  let listener = (_snapshot: unknown) => {};
  let workflow: WorkflowSnapshot = {
    id: 'wf-1',
    parentSessionKey: 'coach:p1',
    goal: '备课检查',
    mode: 'deep',
    status: 'proposed',
    maxConcurrency: 2,
    tokenLimit: 20_000,
    timeoutMs: 90_000,
    createdAt: '2026-07-22T00:00:00Z',
    updatedAt: '2026-07-22T00:00:00Z',
    tasks: [{
      id: 'review',
      label: '防剧透审查',
      role: '审查员',
      instruction: 'private prompt',
      dependsOn: [],
      sourceHandles: ['cards/a.yaml'],
      readRoots: ['cards'],
      status: 'completed',
      runId: 'child-run-secret',
      tokens: 100,
      durationMs: 20,
      toolCount: 1,
      currentTool: null,
      result: {
        findings: ['答案是 D'],
        evidence_refs: ['cards/a.yaml'],
        recommended_action: '直接说 D',
        risks: [],
      },
      error: null,
    }],
  };
  const hub = new EventHub();
  const events: unknown[] = [];
  hub.subscribe((event) => events.push(event));
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    registry: {
      setDeepMode: async (key: string, value: boolean) => {
        calls.push(['set', key, value]);
        enabled = value;
      },
      deepMode: async () => enabled,
      workflows: async () => [workflow],
      confirmWorkflow: async (key: string, id: string) => {
        calls.push(['confirm', key, id]);
        workflow = { ...workflow, status: 'completed' };
        listener(workflow);
        return workflow;
      },
      cancelWorkflow: async () => {},
      subscribe: () => () => {},
      subscribeWorkflows: (_key: string, next: (snapshot: unknown) => void) => {
        listener = next;
        return () => {};
      },
    } as never,
  });

  const toggled = await handler(new Request('http://local/api/sessions/coach%3Ap1/deep', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled: true }),
  }));
  expect(await toggled!.json()).toMatchObject({ enabled: true });
  const confirmed = await handler(new Request(
    'http://local/api/sessions/coach%3Ap1/workflows/wf-1/confirm',
    { method: 'POST' },
  ));
  const text = await confirmed!.text();
  expect(calls).toEqual([
    ['set', 'coach:p1', true],
    ['confirm', 'coach:p1', 'wf-1'],
  ]);
  expect(text).toContain('分析完成');
  expect(text).not.toContain('答案是 D');
  expect(text).not.toContain('直接说 D');
  expect(text).not.toContain('private prompt');
  expect(JSON.stringify(events)).not.toContain('child-run-secret');
  expect(JSON.stringify(events)).not.toContain('答案是 D');
});

test('serves the built client shell for local browser routes', async () => {
  const staticRoot = mkdtempSync(join(tmpdir(), 'studyforge-static-'));
  try {
    writeFileSync(join(staticRoot, 'index.html'), '<main>StudyForge shell</main>');
    const handler = createRequestHandler({
      root: '/tmp/demo',
      authoring: false,
      staticRoot,
      hub: new EventHub(),
      registry: {} as never,
    });
    const response = await handler(new Request('http://local/plan/domain-integrity'));
    expect(response!.status).toBe(200);
    expect(await response!.text()).toContain('StudyForge shell');
  } finally {
    rmSync(staticRoot, { recursive: true, force: true });
  }
});
