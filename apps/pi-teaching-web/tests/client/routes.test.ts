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
