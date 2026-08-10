import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { CourseSnapshot, CourseTreeNode } from '../../src/shared/contracts';
import { readWorkspace } from '../../src/study/workspace';
import { CoursePage } from '../../src/client/pages/CoursePage';
import { CourseTree } from '../../src/client/components/CourseTree';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');

function renderCourse(
  value: CourseSnapshot,
  options: { running?: boolean; connected?: boolean } = {},
): string {
  return renderToStaticMarkup(
    <CoursePage
      value={value}
      items={[]}
      running={options.running ?? false}
      error={null}
      leftOpen
      rightOpen
      connected={options.connected ?? true}
      onNodeSelect={() => {}}
      onSend={async () => {}}
      onLifecycle={async () => {}}
      onToggleLeft={() => {}}
      onToggleRight={() => {}}
    />,
  );
}

test('names the three student document papers without exposing internal evidence layers', () => {
  const roadmap = renderCourse(readWorkspace(fixture, 'ROADMAP.md'));
  const plan = renderCourse(readWorkspace(fixture, 'plans/plan-001/PLAN.md'));
  const lesson = renderCourse(readWorkspace(fixture, 'plans/plan-001/lessons/lesson-001.md'));

  expect(roadmap).toContain('长期路线');
  expect(plan).toContain('阶段安排');
  expect(lesson).toContain('本课提纲');
  expect(roadmap).not.toContain('节点原文');
  expect(plan).not.toContain('节点原文');
  expect(lesson).not.toContain('课堂节点');
  expect(`${roadmap}${plan}${lesson}`).not.toMatch(/能力星图|Trace|对象记忆|证据投影/i);
});

test('renders only the exact Lessons owned by each Plan in the supplied tree', () => {
  const value = readWorkspace(fixture);
  const planOne = value.tree.children[0]!;
  const planTwo: CourseTreeNode = {
    ...planOne,
    id: 'plan-002',
    path: 'plans/plan-002/PLAN.md',
    title: '第二阶段',
    sessionKey: 'plan:plan-002',
    children: [{
      ...planOne.children[0]!,
      id: 'lesson-002',
      path: 'plans/plan-002/lessons/lesson-002.md',
      title: '第二阶段自己的课',
      sessionKey: 'lesson:plan-002:lesson-002',
    }],
  };
  const root = { ...value.tree, children: [planOne, planTwo] };
  const markup = renderToStaticMarkup(
    <CourseTree root={root} selectedPath={planTwo.children[0]!.path} onSelect={() => {}} />,
  );

  expect(markup).toContain('真实停点问诊');
  expect(markup).toContain('第二阶段自己的课');
  expect(markup).toContain('data-plan-id="plan-001"');
  expect(markup).toContain('data-plan-id="plan-002"');
  expect(markup).not.toContain('未链接课堂');
});

test('keeps lifecycle ownership and the closed-Lesson read-only gate unchanged', () => {
  const activePlan = renderCourse(readWorkspace(fixture, 'plans/plan-001/PLAN.md'));
  expect(activePlan).toContain('完成这一阶段');
  expect(activePlan).toContain('action-wash');
  expect(activePlan).not.toMatch(/class="node-primary-action action-wash"[^>]*disabled/);

  const runningPlan = renderCourse(
    readWorkspace(fixture, 'plans/plan-001/PLAN.md'),
    { running: true },
  );
  expect(runningPlan).toMatch(/class="node-primary-action action-wash"[^>]*disabled/);

  const activeValue = readWorkspace(fixture, 'plans/plan-001/lessons/lesson-001.md');
  const plan = activeValue.tree.children[0]!;
  const lesson = plan.children[0]!;
  const closedValue: CourseSnapshot = {
    ...activeValue,
    selected: activeValue.selected?.kind === 'lesson'
      ? { ...activeValue.selected, status: 'closed' }
      : activeValue.selected,
    tree: {
      ...activeValue.tree,
      children: [{ ...plan, children: [{ ...lesson, status: 'closed' }] }],
    },
  };
  const closed = renderCourse(closedValue);

  expect(closed).toContain('已结束 · 只读');
  expect(closed).toContain('<textarea');
  expect(closed).toContain('disabled=""');
  expect(closed).not.toContain('结束本课');
});
