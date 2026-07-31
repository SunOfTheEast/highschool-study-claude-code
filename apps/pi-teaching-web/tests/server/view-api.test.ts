import { expect, mock, test } from 'bun:test';
import type { AppDependencies } from '../../src/server/app';
import { createRequestHandler } from '../../src/server/app';
import type { StudyViewEvent } from '../../src/shared/contracts';
import type { ViewQuery } from '../../src/shared/view-contracts';
import type { SessionEvidenceReader } from '../../src/study/evidence-tree';

function testDependencies() {
  const events: StudyViewEvent[] = [];
  const readCourseView = mock((_root: string, _query: ViewQuery) => ({
    learningSet: { title: 'Demo' },
  } as never));
  const readKnowledgeView = mock((_root: string, _query: ViewQuery) => ({
    nodes: [],
    edges: [],
  } as never));
  const readMemoryView = mock((
    _root: string,
    _query: ViewQuery,
    _sessions: SessionEvidenceReader,
  ) => ({
    confirmed: [],
  } as never));
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
  expect(fixture.readCourseView.mock.calls[0]?.[1]).toMatchObject({
    planId: 'domain-integrity',
    lessonId: 'lesson-003',
  });
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
