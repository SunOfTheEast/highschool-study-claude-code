import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { PlanWorkspaceSnapshot } from '../../src/shared/contracts';
import { SessionTree } from '../../src/client/components/SessionTree';

function workspace(status: string): PlanWorkspaceSnapshot {
  const current = {
    id: 'p1',
    title: '第一阶段 Plan',
    path: 'plans/p1.md',
    status,
    goal: '完成当前周期。',
    capabilityStandard: '可以独立完成。',
    planningBasis: '当前测试 Plan 的公开安排依据。',
    currentPosition: '当前进度。',
    planSummary: '阶段摘要。',
    learningReview: null,
  };
  return {
    learningSet: {
      title: '测试学习集',
      overview: '概述',
      learningPrinciples: '',
      goal: '总目标',
      planTree: [{
        handle: 'p1',
        kind: 'plan',
        nodeId: 'p1',
        path: 'plans/p1.md',
        title: '第一阶段 Plan',
        publicPurpose: '完成当前周期。',
        after: null,
        dependsOn: [],
        status: status === 'completed' ? 'completed' : 'active',
      }],
      plans: [
        current,
        {
          id: 'p2',
          title: '下一个 Plan',
          path: 'plans/p2.md',
          status: 'active',
          goal: '进入下一周期。',
          capabilityStandard: '完成迁移。',
          planningBasis: '当前测试 Plan 的公开安排依据。',
          currentPosition: '等待开始。',
          planSummary: '尚无。',
          learningReview: null,
        },
      ],
    },
    plan: current,
    lessonTree: [],
    coach: { sessionKey: 'coach:p1', sessionId: null },
    lessons: [],
  };
}

function render(status: string): string {
  return renderToStaticMarkup(
    <SessionTree
      workspace={workspace(status)}
      selected="coach:p1"
      onSelect={() => {}}
      onPlanSelect={() => {}}
      onHome={() => {}}
      explorerEnabled
      onExplore={() => {}}
    />,
  );
}

test('offers other Plans only after the current Plan is completed', () => {
  const active = render('active');
  expect(active).not.toContain('继续其他 Plan');
  expect(active).not.toContain('下一个 Plan');

  const completed = render('completed');
  expect(completed).toContain('继续其他 Plan');
  expect(completed).toContain('下一个 Plan');
  expect(completed.match(/第一阶段 Plan/g)).toHaveLength(1);
});

test('hides a prepared Lesson title and shows only its safe shape', () => {
  const value = workspace('active');
  value.lessonTree.push({
    handle: 'lesson-secret',
    kind: 'lesson',
    nodeId: 'lesson-secret',
    path: 'lessons/lesson-secret.md',
    title: '冻结变量法绝密综合诊断',
    publicPurpose: '完成一节公开的路线练习。',
    after: null,
    dependsOn: [],
    status: 'prepared',
  });
  value.lessons.push({
    id: 'lesson-secret',
    title: '冻结变量法绝密综合诊断',
    path: 'lessons/lesson-secret.md',
    planId: 'p1',
    status: 'prepared',
    sessionKey: 'tutor:lesson-secret',
    tutorSessionId: null,
    blocks: [
      {
        id: 'orientation',
        title: '定向',
        kind: 'dialogue',
        required: true,
        status: 'pending',
        dependsOn: [],
        uses: [],
        studentView: '',
        evidence: [],
      },
      {
        id: 'problem-01',
        title: '尝试',
        kind: 'problem',
        required: true,
        status: 'pending',
        dependsOn: ['orientation'],
        uses: [],
        studentView: '',
        evidence: [],
      },
      {
        id: 'reflection',
        title: '小结',
        kind: 'reflection',
        required: true,
        status: 'pending',
        dependsOn: ['problem-01'],
        uses: [],
        studentView: '',
        evidence: [],
      },
    ],
  });
  const html = renderToStaticMarkup(
    <SessionTree
      workspace={value}
      selected="coach:p1"
      onSelect={() => {}}
      onPlanSelect={() => {}}
      onHome={() => {}}
      explorerEnabled
      onExplore={() => {}}
    />,
  );

  expect(html).not.toContain('准备好的下一课');
  expect(html).not.toContain('完成一节公开的路线练习');
  expect(html).not.toContain('冻结变量法绝密综合诊断');
  expect(html.match(/data-session-node=/g)).toHaveLength(1);
});

test('lists only materialized Sessions and leaves course branches to CourseTree', () => {
  const value = workspace('active');
  value.lessonTree = [{
    handle: 'lesson-candidate',
    kind: 'lesson',
    nodeId: null,
    path: null,
    title: null,
    publicPurpose: '根据前课表现再决定。',
    after: null,
    dependsOn: [],
    status: 'candidate',
  }, {
    handle: 'lesson-prepared',
    kind: 'lesson',
    nodeId: 'lesson-prepared',
    path: 'lessons/lesson-prepared.md',
    title: 'SECRET_PREPARED_TITLE',
    publicPurpose: '完成一次公开检验。',
    after: null,
    dependsOn: [],
    status: 'prepared',
  }];
  value.lessons.push({
    id: 'lesson-prepared',
    title: 'SECRET_PREPARED_TITLE',
    path: 'lessons/lesson-prepared.md',
    planId: 'p1',
    status: 'prepared',
    sessionKey: 'tutor:lesson-prepared',
    tutorSessionId: null,
    blocks: [],
  }, {
    id: 'lesson-active',
    title: '正在进行的课堂',
    path: 'lessons/lesson-active.md',
    planId: 'p1',
    status: 'active',
    sessionKey: 'tutor:lesson-active',
    tutorSessionId: 'session-active',
    blocks: [],
  });

  const html = renderToStaticMarkup(
    <SessionTree
      workspace={value}
      selected="coach:p1"
      onSelect={() => {}}
      onPlanSelect={() => {}}
      onHome={() => {}}
      explorerEnabled
      onExplore={() => {}}
    />,
  );

  expect(html).not.toContain('根据前课表现再决定');
  expect(html).not.toContain('准备好的下一课');
  expect(html).toContain('正在进行的课堂');
  expect(html).not.toContain('SECRET_PREPARED_TITLE');
  expect(html.match(/data-session-node=/g)).toHaveLength(2);
});
