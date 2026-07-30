import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PublicTreeEntry } from '../../src/shared/contracts';
import { LearningTree } from '../../src/client/components/LearningTree';

const planTree: PublicTreeEntry[] = [
  {
    handle: 'plan-current',
    kind: 'plan',
    nodeId: 'plan-current',
    path: 'plans/plan-current.md',
    title: '当前学习周期',
    publicPurpose: '形成稳定的路线比较能力。',
    after: null,
    dependsOn: [],
    status: 'active',
  },
  {
    handle: 'plan-future',
    kind: 'plan',
    nodeId: null,
    path: null,
    title: null,
    publicPurpose: '进入下一阶段的迁移练习。',
    after: 'plan-current',
    dependsOn: ['plan-current'],
    status: 'candidate',
  },
];

const lessonTree: PublicTreeEntry[] = [
  {
    handle: 'lesson-001',
    kind: 'lesson',
    nodeId: 'lesson-001',
    path: 'lessons/lesson-001.md',
    title: '已完成的选路课',
    publicPurpose: '比较两条可行路线。',
    after: null,
    dependsOn: [],
    status: 'closed',
  },
  {
    handle: 'lesson-002',
    kind: 'lesson',
    nodeId: 'lesson-002',
    path: 'lessons/lesson-002.md',
    title: 'SECRET_PREPARED_TITLE',
    publicPurpose: '完成一次公开的独立检验。',
    after: 'lesson-001',
    dependsOn: ['lesson-001'],
    status: 'prepared',
  },
  {
    handle: 'lesson-003',
    kind: 'lesson',
    nodeId: null,
    path: null,
    title: null,
    publicPurpose: '根据本课表现决定是否安排迁移。',
    after: 'lesson-002',
    dependsOn: ['lesson-002'],
    status: 'candidate',
  },
];

test('renders Roadmap, Plan and current Plan Lesson branches with public ordering', () => {
  const html = renderToStaticMarkup(
    <LearningTree
      roadmapTitle="导数进阶"
      planTree={planTree}
      currentPlanId="plan-current"
      lessonTree={lessonTree}
      selectedKey="lesson:lesson-002"
      onRoadmap={() => {}}
      onPlan={() => {}}
      onLesson={() => {}}
    />,
  );

  expect(html).toContain('导数进阶');
  expect(html).toContain('当前学习周期');
  expect(html).toContain('已完成的选路课');
  expect(html).toContain('完成一次公开的独立检验');
  expect(html).toContain('接续 lesson-001');
  expect(html).toContain('依赖 lesson-001');
  expect(html).toContain('data-status="prepared"');
  expect(html).toContain('data-status="candidate"');
});

test('keeps candidate non-actionable and hides a prepared Lesson true title', () => {
  const html = renderToStaticMarkup(
    <LearningTree
      roadmapTitle="导数进阶"
      planTree={planTree}
      currentPlanId="plan-current"
      lessonTree={lessonTree}
      selectedKey={null}
      onRoadmap={() => {}}
      onPlan={() => {}}
      onLesson={() => {}}
    />,
  );

  expect(html).not.toContain('SECRET_PREPARED_TITLE');
  expect(html).toContain('准备好的下一课');
  expect(html).not.toContain('data-action="start-candidate"');
  expect(html).not.toMatch(/<button[^>]+data-node="plan-future"/);
  expect(html).not.toMatch(/<button[^>]+data-node="lesson-003"/);
  expect(html).not.toContain('Consider when');
  expect(html).not.toContain('Private note');
  expect(html).not.toContain('Teacher Control');
});
