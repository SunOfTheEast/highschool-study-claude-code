import { expect, test } from 'bun:test';
import {
  LESSON_STATUSES,
  PLAN_STATUSES,
} from '../../src/shared/contracts';
import {
  M0_MODEL_TOOLS,
  sessionKeyForNode,
} from '../../src/runtime/session-scope';
import {
  formatBrowserRoute,
  parseBrowserRoute,
} from '../../src/client/routes';
import {
  initialViewState,
  PRIMARY_VIEWS,
} from '../../src/client/view-state';

test('exposes only the M0 node lifecycle and native model tools', () => {
  expect(PLAN_STATUSES).toEqual(['prepared', 'active', 'completed']);
  expect(LESSON_STATUSES).toEqual(['prepared', 'active', 'closed']);
  expect(M0_MODEL_TOOLS).toEqual(['read', 'grep', 'find', 'ls', 'edit', 'write']);

  expect(sessionKeyForNode({
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
  })).toBe('roadmap:roadmap');
  expect(sessionKeyForNode({
    nodeKind: 'plan',
    nodeId: 'plan-001',
    nodePath: 'plans/plan-001.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  })).toBe('plan:plan-001');
  expect(sessionKeyForNode({
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001.md',
  })).toBe('lesson:lesson-001');
});

test('keeps only Course and Knowledge as primary M0 views', () => {
  expect(PRIMARY_VIEWS).toEqual(['course', 'knowledge']);
  expect(Object.keys(initialViewState)).toEqual(['course', 'knowledge']);

  const routes = [
    { kind: 'course' as const },
    { kind: 'course-plan' as const, planId: 'plan-001' },
    {
      kind: 'course-lesson' as const,
      planId: 'plan-001',
      lessonId: 'lesson-001',
    },
    { kind: 'knowledge' as const },
  ];

  for (const route of routes) {
    const formatted = formatBrowserRoute(route);
    expect(parseBrowserRoute(formatted)).toEqual(route);
  }
  expect(parseBrowserRoute('/memory')).toBeNull();
});
