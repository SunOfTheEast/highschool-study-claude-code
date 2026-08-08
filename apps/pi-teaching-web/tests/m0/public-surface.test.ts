import { expect, test } from 'bun:test';
import {
  LESSON_STATUSES,
  PLAN_STATUSES,
} from '../../src/shared/contracts';
import {
  LESSON_MODEL_TOOLS,
  M0_MODEL_TOOLS,
  modelToolsForNode,
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

test('exposes only the M0 node lifecycle and role-scoped model tools', () => {
  expect(PLAN_STATUSES).toEqual(['prepared', 'active', 'completed']);
  expect(LESSON_STATUSES).toEqual(['prepared', 'active', 'closed']);
  expect(M0_MODEL_TOOLS).toEqual(['read', 'grep', 'find', 'ls', 'edit', 'write']);
  expect(modelToolsForNode('roadmap')).toEqual(M0_MODEL_TOOLS);
  expect(modelToolsForNode('lesson')).toEqual(LESSON_MODEL_TOOLS);
  expect(LESSON_MODEL_TOOLS).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'classroom_log_append',
    'classroom_update',
  ]);
  expect(modelToolsForNode('plan')).toEqual([
    ...M0_MODEL_TOOLS,
    'subagent',
    'artifact_export',
  ]);
  expect(modelToolsForNode('lesson', true)).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'classroom_log_append',
    'classroom_update',
    'lesson_memory_commit',
  ]);
  expect(modelToolsForNode('plan', true)).toEqual([
    ...M0_MODEL_TOOLS,
    'subagent',
    'artifact_export',
    'memory_route_resolve',
  ]);

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
    nodePath: 'plans/plan-001/PLAN.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  })).toBe('plan:plan-001');
  expect(sessionKeyForNode({
    nodeKind: 'lesson',
    nodeId: 'lesson-001',
    nodePath: 'plans/plan-001/lessons/lesson-001.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001/PLAN.md',
  })).toBe('lesson:plan-001:lesson-001');
});

test('keeps M0 Course and Knowledge projections behind the M1b primary navigation', () => {
  expect(PRIMARY_VIEWS).toEqual(['home', 'assets', 'course']);
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

test('round-trips a utility handout route without making it a primary view', () => {
  const route = {
    kind: 'lesson-handout' as const,
    planId: 'plan-001',
    lessonId: 'lesson-001',
    blockIds: ['block-002', 'block-001'],
  };
  const path = '/course/plan/plan-001/lesson/lesson-001/handout/block-002,block-001';
  expect(formatBrowserRoute(route)).toBe(path);
  expect(parseBrowserRoute(path)).toEqual(route);
  for (const invalid of [
    `${path}/`,
    '/course/plan/plan-001/lesson/lesson-001/handout/',
    '/course/plan/plan-001/lesson/lesson-001/handout/block-001,block-001',
    '/course/plan/plan-001/lesson/lesson-001/handout/block-001,,block-002',
  ]) {
    expect(parseBrowserRoute(invalid)).toBeNull();
  }
  expect(PRIMARY_VIEWS).toEqual(['home', 'assets', 'course']);
});
