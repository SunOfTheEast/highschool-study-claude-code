import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import type { SessionKey, StudyEvent } from '../../src/shared/contracts';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m0-api-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function entries(): SessionEntry[] {
  return [
    {
      type: 'message',
      id: 'user-1',
      parentId: null,
      timestamp: '2026-08-02T10:00:00.000Z',
      message: {
        role: 'user',
        content: '我觉得恒成立问题比较棘手。',
        timestamp: 1,
      },
    },
    {
      type: 'message',
      id: 'assistant-1',
      parentId: 'user-1',
      timestamp: '2026-08-02T10:00:01.000Z',
      message: {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: 'private reasoning' },
          { type: 'text', text: '具体是哪一种结构让你最犹豫？' },
          {
            type: 'toolCall',
            id: 'tool-1',
            name: 'read',
            arguments: { path: 'plans/plan-001.md' },
          },
        ],
        api: 'openai-completions',
        provider: 'test',
        model: 'test',
        usage: {
          input: 0,
          output: 0,
          cacheRead: 0,
          cacheWrite: 0,
          totalTokens: 0,
          cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
        },
        stopReason: 'toolUse',
        timestamp: 2,
      },
    },
    {
      type: 'message',
      id: 'tool-result-1',
      parentId: 'assistant-1',
      timestamp: '2026-08-02T10:00:02.000Z',
      message: {
        role: 'toolResult',
        toolCallId: 'tool-1',
        toolName: 'read',
        content: [{ type: 'text', text: 'file content' }],
        details: { path: 'plans/plan-001.md' },
        isError: false,
        timestamp: 3,
      },
    },
  ] as SessionEntry[];
}

function fakeRegistry(overrides: Record<string, unknown> = {}) {
  return {
    readHistory: async () => entries(),
    send: async () => {},
    subscribe: async () => () => {},
    ...overrides,
  };
}

test('serves only the M0 course and static knowledge snapshots', async () => {
  const root = copyFixture();
  const handler = createRequestHandler({
    root,
    hub: new EventHub(),
    registry: fakeRegistry() as never,
  });

  const course = await handler(new Request('http://local/api/course?selected=lessons%2Flesson-001.md'));
  expect(course?.status).toBe(200);
  expect(await course?.json()).toMatchObject({
    selected: { kind: 'lesson', id: 'lesson-001' },
    tree: { kind: 'roadmap', children: [{ kind: 'plan' }] },
  });

  const knowledge = await handler(new Request('http://local/api/knowledge'));
  expect(knowledge?.status).toBe(200);
  const knowledgeBody = await knowledge?.json();
  expect(knowledgeBody.methods).toContainEqual(expect.objectContaining({
    id: 'derivative-methods',
  }));
  expect(knowledgeBody.cards).toContainEqual(expect.objectContaining({
    id: 'sample-card',
  }));

  for (const path of ['/api/views/memory', '/api/abilities', '/api/evidence']) {
    expect((await handler(new Request(`http://local${path}`)))?.status).toBe(404);
  }
});

test('returns unmodified assistant text and inspectable native tool activity', async () => {
  const root = copyFixture();
  const handler = createRequestHandler({
    root,
    hub: new EventHub(),
    registry: fakeRegistry() as never,
  });

  const response = await handler(new Request(
    'http://local/api/sessions/plan%3Aplan-001/history',
  ));
  expect(response?.status).toBe(200);
  const history = await response?.json();
  expect(history).toContainEqual(expect.objectContaining({
    kind: 'assistant',
    text: '具体是哪一种结构让你最犹豫？',
  }));
  expect(history).not.toContainEqual(expect.objectContaining({
    text: expect.stringContaining('private reasoning'),
  }));
  expect(history).toContainEqual(expect.objectContaining({
    id: 'tool-1',
    kind: 'tool',
    name: 'read',
    status: 'done',
    detail: { path: 'plans/plan-001.md' },
  }));
});

test('streams one accepted turn and invalidates course after a native edit', async () => {
  const root = copyFixture();
  const hub = new EventHub();
  const events: StudyEvent[] = [];
  hub.subscribe((event) => events.push(event));
  let listener: ((event: AgentSessionEvent) => void) | null = null;
  let sent: [SessionKey, string] | null = null;
  let resolveIdle!: () => void;
  const idle = new Promise<void>((resolve) => { resolveIdle = resolve; });
  hub.subscribe((event) => {
    if (event.type === 'session-run' && event.status === 'idle') resolveIdle();
  });
  const handler = createRequestHandler({
    root,
    hub,
    registry: fakeRegistry({
      subscribe: async (_key: SessionKey, value: (event: AgentSessionEvent) => void) => {
        listener = value;
        return () => {};
      },
      send: async (key: SessionKey, text: string) => {
        sent = [key, text];
        listener?.({
          type: 'tool_execution_start',
          toolCallId: 'edit-1',
          toolName: 'edit',
          args: { path: 'plans/plan-001.md' },
        });
        listener?.({
          type: 'tool_execution_end',
          toolCallId: 'edit-1',
          toolName: 'edit',
          result: { details: { changed: true } },
          isError: false,
        });
        listener?.({ type: 'agent_end', messages: [], willRetry: false });
      },
    }) as never,
  });

  const response = await handler(new Request(
    'http://local/api/sessions/plan%3Aplan-001/messages',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: '我想先说说具体卡点。' }),
    },
  ));
  expect(response?.status).toBe(202);
  await idle;
  expect(sent).toEqual(['plan:plan-001', '我想先说说具体卡点。']);
  expect(events).toContainEqual(expect.objectContaining({
    type: 'conversation-item',
    item: expect.objectContaining({ id: 'edit-1', kind: 'tool', status: 'running' }),
  }));
  expect(events).toContainEqual({ type: 'course-invalidated' });
});

test('routes student lifecycle actions without generating teaching messages', async () => {
  const root = copyFixture();
  const calls: string[] = [];
  const handler = createRequestHandler({
    root,
    hub: new EventHub(),
    registry: fakeRegistry() as never,
    lifecycle: {
      startPlan: async (id: string) => {
        calls.push(`start-plan:${id}`);
        return { route: `/course/plan/${id}`, sessionKey: `plan:${id}` as SessionKey };
      },
      completePlan: async (id: string) => {
        calls.push(`complete-plan:${id}`);
        return { route: '/course' as const };
      },
      startLesson: async (id: string) => {
        calls.push(`start-lesson:${id}`);
        return { route: `/course/plan/plan-001/lesson/${id}`, sessionKey: `lesson:${id}` as SessionKey };
      },
      closeLesson: async (id: string) => {
        calls.push(`close-lesson:${id}`);
        return { route: '/course/plan/plan-001' };
      },
    },
  });

  for (const path of [
    '/api/plans/plan-001/start',
    '/api/lessons/lesson-001/start',
    '/api/lessons/lesson-001/close',
    '/api/plans/plan-001/complete',
  ]) {
    expect((await handler(new Request(`http://local${path}`, { method: 'POST' })))?.status)
      .toBe(200);
  }
  expect(calls).toEqual([
    'start-plan:plan-001',
    'start-lesson:lesson-001',
    'close-lesson:lesson-001',
    'complete-plan:plan-001',
  ]);
});
