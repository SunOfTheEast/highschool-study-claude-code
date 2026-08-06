import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CourseTreeNode, NodeStatus } from '../../src/shared/contracts';
import { readWorkspace } from '../../src/study/workspace';
import {
  planProgress,
  resolveContinueTarget,
} from '../../src/client/course-navigation';
import { CourseOverviewPage } from '../../src/client/pages/CourseOverviewPage';
import {
  formatBrowserRoute,
  parseBrowserRoute,
} from '../../src/client/routes';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');

function treeNode(
  kind: CourseTreeNode['kind'],
  id: string,
  status: NodeStatus,
  children: CourseTreeNode[] = [],
): CourseTreeNode {
  return {
    kind,
    id,
    status,
    title: id,
    path: kind === 'roadmap'
      ? 'ROADMAP.md'
      : kind === 'plan'
        ? `plans/${id}/PLAN.md`
        : `plans/plan-001/lessons/${id}.md`,
    sessionKey: kind === 'lesson'
      ? `lesson:plan-001:${id}`
      : `${kind}:${id}`,
    after: null,
    dependsOn: [],
    children,
  };
}

test('round-trips the dedicated Roadmap dialogue route', () => {
  expect(parseBrowserRoute('/course/roadmap')).toEqual({ kind: 'course-roadmap' });
  expect(formatBrowserRoute({ kind: 'course-roadmap' } as never))
    .toBe('/course/roadmap');
});

test('continues to the active Lesson before any other course node', () => {
  const prepared = treeNode('lesson', 'lesson-001', 'prepared');
  const active = treeNode('lesson', 'lesson-002', 'active');
  const plan = treeNode('plan', 'plan-001', 'active', [prepared, active]);
  const root = treeNode('roadmap', 'roadmap', 'active', [plan]);

  expect(resolveContinueTarget(root).route).toEqual({
    kind: 'course-lesson',
    planId: 'plan-001',
    lessonId: 'lesson-002',
  });
});

test('continues to the first prepared Lesson inside the active Plan', () => {
  const prepared = treeNode('lesson', 'lesson-001', 'prepared');
  const plan = treeNode('plan', 'plan-001', 'active', [prepared]);
  const root = treeNode('roadmap', 'roadmap', 'active', [plan]);

  expect(resolveContinueTarget(root).route).toEqual({
    kind: 'course-lesson',
    planId: 'plan-001',
    lessonId: 'lesson-001',
  });
});

test('falls back to Roadmap dialogue for an empty Plan Tree', () => {
  const root = treeNode('roadmap', 'roadmap', 'active');

  expect(resolveContinueTarget(root).route).toEqual({ kind: 'course-roadmap' });
});

test('continues to an active Plan when it has no prepared Lesson', () => {
  const plan = treeNode('plan', 'plan-001', 'active');
  const root = treeNode('roadmap', 'roadmap', 'active', [plan]);

  expect(resolveContinueTarget(root).route).toEqual({
    kind: 'course-plan',
    planId: 'plan-001',
  });
});

test('continues to the first prepared Plan when no Plan is active', () => {
  const plan = treeNode('plan', 'plan-001', 'prepared');
  const root = treeNode('roadmap', 'roadmap', 'active', [plan]);

  expect(resolveContinueTarget(root).route).toEqual({
    kind: 'course-plan',
    planId: 'plan-001',
  });
});

test('counts progress only from directly linked closed Lessons', () => {
  const plan = treeNode('plan', 'plan-001', 'active', [
    treeNode('lesson', 'lesson-001', 'closed'),
    treeNode('lesson', 'lesson-002', 'prepared'),
  ]);

  expect(planProgress(plan)).toEqual({ settled: 1, total: 2 });
});

test('renders a stable overview without a conversation composer', () => {
  const value = readWorkspace(fixture);
  const markup = renderToStaticMarkup(
    <CourseOverviewPage value={value} onNavigate={() => {}} />,
  );

  expect(markup).toContain('导数结构学习路线');
  expect(markup).toContain('继续学习');
  expect(markup).toContain('恒成立问题选路');
  expect(markup).toContain('与老师讨论路线');
  expect(markup).not.toContain('<textarea');
});

test('renders an honest empty state without looking for orphan Lessons', () => {
  const value = readWorkspace(fixture);
  const markup = renderToStaticMarkup(
    <CourseOverviewPage
      value={{
        ...value,
        roadmap: { ...value.roadmap, plans: [] },
        tree: { ...value.tree, children: [] },
      }}
      onNavigate={() => {}}
    />,
  );

  expect(markup).toContain('尚未形成学习阶段');
  expect(markup).not.toContain('lessons/');
});
