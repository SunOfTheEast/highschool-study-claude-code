import { expect, test } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { renderHandoff } from 'highschool-study-markdown/study-domain';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import type {
  MemoryReviewDecision,
  MemoryReviewSnapshot,
} from '../../src/memory-review/contracts';
import type { AbilityProjection } from '../../src/shared/contracts';
import { readPlanWorkspace } from '../../src/study/read-workspace';
import { PreparedLessonValidationError } from '../../src/study/validate-prepared-lesson';
import type { WorkflowSnapshot } from '../../src/workflows/contracts';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const learningSet = {
  title: 'Demo',
  overview: 'Overview',
  learningPrinciples: '',
  goal: 'Goal',
  planTree: [],
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
  lessonTree: [],
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
    currentId: null,
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

test('returns one deterministic continue-first Home snapshot', async () => {
  const handler = createRequestHandler({
    root: domainIntegrityFixtureRoot,
    authoring: false,
    hub: new EventHub(),
    registry: {} as never,
  });

  const response = await handler(new Request('http://local/api/home'));
  expect(response!.status).toBe(200);
  expect(await response!.json()).toMatchObject({
    continueTarget: {
      kind: 'lesson',
      lessonId: 'lesson-003',
      route: '/plan/domain-integrity/lesson/lesson-003',
    },
    lessonProgress: { completed: 2, total: 3 },
  });
});

test('returns trace and Handoff evidence through one API', async () => {
  const root = mkdtempSync(join(tmpdir(), 'study-evidence-api-'));
  try {
    cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
    const lessonPath = join(root, 'lessons/lesson-002.md');
    const handoff = renderHandoff({
      id: 'lesson-002/handoff',
      from: 'lesson:lesson-002',
      to: 'plan:domain-integrity',
      sealedAt: '2026-08-05T12:00:00.000Z',
    }, {
      learnerClaims: [{
        statement: '学生在本课主动写出定义域。',
        scope: 'Lesson 002。',
        sources: ['trace:trace-fixture-002'],
        boundary: '尚未跨结构核验。',
        nextUse: '下一课继续检查。',
      }],
      teachingClaims: [],
      openQuestions: [],
    });
    writeFileSync(
      lessonPath,
      readFileSync(lessonPath, 'utf8').replace(/^## Handoff[\s\S]*$/m, handoff.trim()),
    );
    const handler = createRequestHandler({
      root,
      authoring: false,
      hub: new EventHub(),
      registry: {} as never,
    });

    const trace = await handler(new Request(
      'http://local/api/evidence?source=trace%3Atrace-fixture-002',
    ));
    expect(await trace!.json()).toMatchObject({
      kind: 'trace',
      state: 'active',
      trace: { lessonId: 'lesson-002' },
    });

    const claim = await handler(new Request(
      'http://local/api/evidence?source=claim%3Alesson-002%2Fhandoff%23learner-c1',
    ));
    expect(await claim!.json()).toMatchObject({
      kind: 'handoff',
      state: 'active',
      node: {
        source: 'claim:lesson-002/handoff#learner-c1',
        children: [{ source: 'trace:trace-fixture-002', state: 'active' }],
      },
    });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('uses cold-restored Tutor history for Lesson replay', async () => {
  const calls: unknown[][] = [];
  const handler = createRequestHandler({
    root: domainIntegrityFixtureRoot,
    authoring: false,
    hub: new EventHub(),
    registry: {
      snapshot: () => readPlanWorkspace(domainIntegrityFixtureRoot, 'domain-integrity'),
      replayHistory: async (...args: unknown[]) => {
        calls.push(args);
        return [{
          kind: 'message',
          message: {
            id: 'restored-student-message',
            role: 'student',
            text: '从 Pi JSONL 恢复的课堂消息',
            complete: true,
          },
        }];
      },
    } as never,
  });

  const response = await handler(new Request(
    'http://local/api/lessons/lesson-003/replay',
  ));
  const body = await response!.json();

  expect(response!.status).toBe(200);
  expect(calls).toEqual([['lesson-003', 'safe']]);
  expect(body.mode).toBe('full');
  expect(body.items).toContainEqual(expect.objectContaining({
    id: 'restored-student-message',
    kind: 'message',
    detail: '从 Pi JSONL 恢复的课堂消息',
  }));
});

test('returns source-linked context for one Plan Coach', async () => {
  const root = mkdtempSync(join(tmpdir(), 'safe-context-api-'));
  try {
    cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
    const planPath = join(root, 'plans/domain-integrity.md');
    writeFileSync(
      planPath,
      readFileSync(planPath, 'utf8')
        .replace('- [mst_p0032_ex22]', '- LEAK_NEXT_API [mst_p0032_ex22]')
        .replace('两节课显示定义域意识', 'LEAK_SUMMARY_API 两节课显示定义域意识'),
    );
    const handler = createRequestHandler({
      root,
      authoring: false,
      hub: new EventHub(),
      registry: {} as never,
    });

    const response = await handler(new Request(
      'http://local/api/plans/domain-integrity/context',
    ));
    expect(response!.status).toBe(200);
    const body = await response!.json();
    expect(body).toMatchObject({
      plan: {
        currentPosition: expect.stringContaining('阶段 `1a` 已通过'),
        nextLesson: {
          publicPurpose: '完成一次独立能力检验',
          sourceNumbers: [],
        },
      },
      priorLessons: [
        expect.objectContaining({
          lessonId: 'lesson-001',
          source: 'lessons/lesson-001.md#lesson-summary',
        }),
        expect.objectContaining({ lessonId: 'lesson-002' }),
      ],
    });
    expect(JSON.stringify(body)).not.toContain('LEAK_NEXT_API');
    expect(JSON.stringify(body)).not.toContain('LEAK_SUMMARY_API');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
      readHistory: async (_key: string, mode: unknown) => {
        calls.push('read-history');
        modes.push(mode);
        return [];
      },
      get: () => undefined,
    } as never,
  });
  const response = await handler(new Request(
    'http://local/api/sessions/coach%3A%40roadmap/history',
  ));
  expect(response!.status).toBe(200);
  expect(await response!.json()).toEqual([]);
  expect(modes).toEqual(['raw-stream']);
  expect(calls).toEqual(['read-history']);
});

test('reads active Tutor history without opening or activating an Agent', async () => {
  const calls: string[] = [];
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    registry: {
      readHistory: async () => {
        calls.push('read-history');
        return [];
      },
      get: () => undefined,
    } as never,
  });
  const response = await handler(new Request('http://local/api/sessions/tutor%3Al1/history'));
  expect(response!.status).toBe(200);
  expect(calls).toEqual(['read-history']);
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

test('returns submitted immediately, then publishes and restores the applied review', async () => {
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
  const applied = {
    ...submitted,
    status: 'applied',
    receipt: {
      reviewId: 'review-1',
      appliedItems: ['item-1'],
      unchangedItems: [],
      profilePaths: {
        student: 'memory/student-profile.md',
        teaching: 'memory/teaching-profile.md',
      },
    },
  } satisfies MemoryReviewSnapshot;
  let latest: MemoryReviewSnapshot = proposedMemoryReview;
  let listener: ((event: unknown) => void) | undefined;
  let resolveIdle!: () => void;
  const idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  const events: unknown[] = [];
  const hub = new EventHub();
  hub.subscribe((event) => {
    events.push(event);
    if (event.type === 'session-run' && event.status === 'idle') resolveIdle();
  });
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    registry: {
      memoryReview: async () => latest,
      submitMemoryReview: async () => {
        latest = submitted;
        latest = applied;
        listener?.({ type: 'agent_end', messages: [], willRetry: false });
        return latest;
      },
      subscribe: (_key: string, next: (event: unknown) => void) => {
        listener = next;
        return () => {};
      },
      subscribeWorkflows: () => () => {},
      history: () => [{ kind: 'memory-review', review: latest }],
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
  expect(events).toContainEqual({
    type: 'conversation-snapshot',
    sessionKey: 'coach:p1',
    items: [{ kind: 'memory-review', review: applied }],
  });

  const refreshed = await handler(new Request(
    'http://local/api/sessions/coach%3Ap1/memory-review',
  ));
  expect(await refreshed!.json()).toEqual(applied);
});

test('keeps a failed trusted memory application submitted instead of claiming success', async () => {
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
  let latest: MemoryReviewSnapshot = proposedMemoryReview;
  let resolveIdle!: () => void;
  const idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  const events: unknown[] = [];
  const hub = new EventHub();
  hub.subscribe((event) => {
    events.push(event);
    if (event.type === 'session-run' && event.status === 'idle') resolveIdle();
  });
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    registry: {
      memoryReview: async () => latest,
      submitMemoryReview: async () => {
        latest = submitted;
        throw new Error('MEMORY_REVIEW_APPLY_FAILED: profile install failed before receipt');
      },
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
      history: () => [{ kind: 'memory-review', review: latest }],
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
  expect(events).toContainEqual({
    type: 'session-error',
    sessionKey: 'coach:p1',
    message: '长期记忆写入失败，已确认内容尚未进入画像；可以稍后重试。',
  });
  expect(events.some((event) => (
    typeof event === 'object'
    && event !== null
    && 'type' in event
    && event.type === 'conversation-snapshot'
  ))).toBe(false);

  const refreshed = await handler(new Request(
    'http://local/api/sessions/coach%3Ap1/memory-review',
  ));
  expect(await refreshed!.json()).toEqual(submitted);
});

test('keeps an applied receipt when the later Coach explanation fails', async () => {
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
  const applied = {
    ...submitted,
    status: 'applied',
    receipt: {
      reviewId: 'review-1',
      appliedItems: ['item-1'],
      unchangedItems: [],
      profilePaths: {
        student: 'memory/student-profile.md',
        teaching: 'memory/teaching-profile.md',
      },
    },
  } satisfies MemoryReviewSnapshot;
  let latest: MemoryReviewSnapshot = proposedMemoryReview;
  let resolveIdle!: () => void;
  const idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  const events: unknown[] = [];
  const hub = new EventHub();
  hub.subscribe((event) => {
    events.push(event);
    if (event.type === 'session-run' && event.status === 'idle') resolveIdle();
  });
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    registry: {
      memoryReview: async () => latest,
      submitMemoryReview: async () => {
        latest = applied;
        throw new Error('provider stopped while explaining applied receipt');
      },
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
      history: () => [{ kind: 'memory-review', review: latest }],
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
  expect(events).toContainEqual({
    type: 'session-error',
    sessionKey: 'coach:p1',
    message: '模型调用失败，请检查 Pi 的模型与凭据配置后重试。',
  });
  const refreshed = await handler(new Request(
    'http://local/api/sessions/coach%3Ap1/memory-review',
  ));
  expect(await refreshed!.json()).toEqual(applied);
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
      readHistory: async () => items,
      get: () => ({ sessionId: 'coach-p1' }),
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

test('never publishes the free Coach final after a successful Lesson prepare in safe mode', async () => {
  let listener: ((event: unknown) => void) | undefined;
  const items = [{
    kind: 'lesson-ready',
    lesson: {
      lessonId: 'lesson-007',
      lessonPath: 'lessons/lesson-007.md',
      publicTitle: '下一节课堂',
      publicPurpose: '完成一次独立能力检验',
      blockCount: 5,
      blockKinds: ['dialogue', 'problem', 'reflection'],
      sourceNumbers: ['source-17'],
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
      readHistory: async () => items,
      get: () => ({ sessionId: 'coach-p1' }),
      history: () => items,
      subscribe: (_key: string, next: (event: unknown) => void) => {
        listener = next;
        return () => {};
      },
      subscribeWorkflows: () => () => {},
    } as never,
  });
  await handler(new Request('http://local/api/sessions/coach%3Ap1/history'));

  listener?.({
    type: 'tool_execution_end',
    toolName: 'lesson_prepare',
    toolCallId: 'prepare-1',
    isError: false,
    result: {
      details: {
        kind: 'lesson-prepare',
        value: {
          ok: true,
          factId: 'lesson-007',
          lessonPath: 'lessons/lesson-007.md',
          publicTitle: '下一节课堂',
          publicPurpose: '完成一次独立能力检验',
          blockCount: 5,
          blockKinds: ['dialogue', 'problem', 'reflection'],
          sourceNumbers: ['source-17'],
        },
      },
    },
  });
  listener?.({
    type: 'message_end',
    message: {
      role: 'assistant',
      timestamp: 126,
      content: [{ type: 'text', text: '绝密题名和冻结变量法。' }],
    },
  });
  expect(JSON.stringify(events)).not.toContain('绝密题名');

  listener?.({ type: 'agent_end', messages: [], willRetry: false });
  expect(events.at(-1)).toEqual({
    type: 'conversation-snapshot',
    sessionKey: 'coach:p1',
    items,
  });

  events.splice(0);
  listener?.({
    type: 'tool_execution_end',
    toolName: 'lesson_prepare',
    toolCallId: 'prepare-2',
    isError: true,
    result: { details: { kind: 'lesson-prepare' } },
  });
  listener?.({
    type: 'message_end',
    message: {
      role: 'assistant',
      timestamp: 127,
      content: [{ type: 'text', text: '备课失败，我们继续讨论。' }],
    },
  });
  expect(events).toContainEqual(expect.objectContaining({
    type: 'message',
    message: expect.objectContaining({ text: '备课失败，我们继续讨论。' }),
  }));
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
      planSummary: 'Summary',
      learningReview: null,
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
    expect(events.slice(-3).map((event) => (
      typeof event === 'object' && event !== null && 'type' in event
        ? (event as { type: string }).type
        : null
    ))).toEqual(['work-status', 'ability-update', 'views-invalidated']);
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

test('starts a prepared Plan only through the explicit student action', async () => {
  const calls: string[] = [];
  const events: unknown[] = [];
  const hub = new EventHub();
  hub.subscribe((event) => events.push(event));
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    readLearningSet: () => learningSet,
    registry: {
      startPlan: async (planId: string) => {
        calls.push(`start:${planId}`);
      },
      snapshot: (planId: string) => {
        calls.push(`snapshot:${planId}`);
        return workspace;
      },
      subscribe: () => {
        calls.push('bind');
        return () => {};
      },
      subscribeWorkflows: () => () => {},
    } as never,
  });

  const response = await handler(new Request(
    'http://local/api/plans/p1/start',
    { method: 'POST' },
  ));

  expect(response!.status).toBe(200);
  expect(await response!.json()).toEqual(workspace);
  expect(calls).toEqual(['start:p1', 'bind', 'snapshot:p1']);
  expect(events).toContainEqual({ type: 'snapshot', workspace });
});

test('rejects messages to a terminal node before publishing student text', async () => {
  const events: unknown[] = [];
  const hub = new EventHub();
  hub.subscribe((event) => events.push(event));
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub,
    readLearningSet: () => learningSet,
    registry: {
      openSession: async () => {
        throw new Error('PLAN_SESSION_NOT_ACTIVE: completed');
      },
    } as never,
  });

  const response = await handler(new Request(
    'http://local/api/sessions/coach%3Ap1/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '继续修改已经结束的周期' }),
    },
  ));

  expect(response!.status).toBe(409);
  expect(await response!.json()).toEqual({
    error: 'PLAN_SESSION_NOT_ACTIVE: completed',
  });
  expect(events).toEqual([]);
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
      startLesson: async () => {
        calls.push('start');
        return { shouldKickoff: true };
      },
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

test('starts the hidden Tutor turn only for the Lesson start leader', async () => {
  let startCalls = 0;
  let kickoffCalls = 0;
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
      startLesson: async () => ({
        shouldKickoff: (startCalls += 1) === 1,
      }),
      triggerLessonStart: async () => {
        kickoffCalls += 1;
      },
      snapshot: () => workspace,
      subscribe: () => () => {},
      subscribeWorkflows: () => () => {},
    } as never,
  });

  const responses = await Promise.all([
    handler(new Request('http://local/api/lessons/lesson-003/start', { method: 'POST' })),
    handler(new Request('http://local/api/lessons/lesson-003/start', { method: 'POST' })),
  ]);
  await Promise.resolve();

  expect(responses.map((response) => response?.status)).toEqual([200, 200]);
  expect(startCalls).toBe(2);
  expect(kickoffCalls).toBe(1);
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

test('returns public persona metadata and serves only a discovered local portrait', async () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-persona-api-'));
  try {
    const personaDirectory = join(root, '.claude/personas');
    const portraitDirectory = join(personaDirectory, 'assets');
    mkdirSync(portraitDirectory, { recursive: true });
    writeFileSync(join(portraitDirectory, 'custom.webp'), new Uint8Array([1, 2, 3]));
    writeFileSync(join(personaDirectory, 'custom.md'), `# Custom

- ID: \`custom\`
- Display name: 自定义
- Student preview: 一条公开简介。
- Portrait: \`.claude/personas/assets/custom.webp\`
`);
    const handler = createRequestHandler({
      root,
      authoring: false,
      hub: new EventHub(),
      registry: { personaId: () => 'custom' } as never,
    });
    const presentation = await handler(new Request(
      'http://local/api/persona?sessionKey=coach%3Ap1',
    ));
    expect(await presentation!.json()).toMatchObject({
      id: 'custom',
      choices: expect.arrayContaining([
        expect.objectContaining({
          id: 'custom',
          description: '一条公开简介。',
          portraitUrl: '/api/personas/custom/portrait',
        }),
      ]),
    });

    const portrait = await handler(new Request(
      'http://local/api/personas/custom/portrait',
    ));
    expect(portrait!.status).toBe(200);
    expect(portrait!.headers.get('content-type')).toBe('image/webp');
    expect([...new Uint8Array(await portrait!.arrayBuffer())]).toEqual([1, 2, 3]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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
