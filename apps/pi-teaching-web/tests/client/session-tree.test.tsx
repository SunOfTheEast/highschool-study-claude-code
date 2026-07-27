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
  };
  return {
    learningSet: {
      title: '测试学习集',
      overview: '概述',
      learningPrinciples: '',
      goal: '总目标',
      plans: [
        current,
        {
          id: 'p2',
          title: '下一个 Plan',
          path: 'plans/p2.md',
          status: 'active',
          goal: '进入下一周期。',
          capabilityStandard: '完成迁移。',
        },
      ],
    },
    plan: current,
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
