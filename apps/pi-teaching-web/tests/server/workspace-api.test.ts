import { expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import type { WorkflowSnapshot } from '../../src/workflows/contracts';

const learningSet = { title: 'Demo', overview: 'Overview', goal: 'Goal', plans: [] };
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

test('returns learning-set and Plan snapshots', async () => {
  const handler = createRequestHandler({
    root: '/tmp/demo',
    authoring: false,
    hub: new EventHub(),
    readLearningSet: () => learningSet,
    registry: {
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
  expect(await (await handler(new Request('http://local/api/workspaces/p1')))!.json())
    .toEqual(workspace);
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
      openCoach: async () => ({ sessionId: 'coach-p1' }),
      openTutor: async () => ({ sessionId: 'tutor-l1' }),
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

test('publishes the active snapshot before starting the hidden Tutor turn', async () => {
  const calls: string[] = [];
  let releaseKickoff!: () => void;
  const kickoffPending = new Promise<void>((resolve) => { releaseKickoff = resolve; });
  const hub = new EventHub();
  hub.subscribe((event) => {
    if (event.type === 'snapshot') calls.push('snapshot');
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
  expect(calls).toEqual(['start', 'bind', 'snapshot', 'kickoff']);
  releaseKickoff();
  await kickoffPending;
  await Promise.resolve();
  expect(calls).toEqual(['start', 'bind', 'snapshot', 'kickoff', 'snapshot']);
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
        openCoach: async () => ({ sessionId: 'coach-p1' }),
        openTutor: async () => ({ sessionId: 'tutor-l1' }),
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
