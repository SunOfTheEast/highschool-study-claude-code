import { expect, test } from 'bun:test';
import {
  renderPreparedPlan,
  validatePlanBlueprint,
  type PlanBlueprint,
  type PlanRenderContext,
} from '../../src/study/plan-blueprint';
import { parseActivationSnapshot } from '../../src/study/activation-snapshot';

const context = {
  planId: 'plan-001',
  planPath: 'plans/plan-001.md',
  parentId: 'roadmap',
  parentPath: 'ROADMAP.md',
} satisfies PlanRenderContext;

const blueprint = {
  title: '路线选择与换路',
  publicPurpose: '学会在综合题中先比较路线代价。',
  goal: '形成稳定的选路与换路意识。',
  capabilityStandard: '三分钟内说出两条路线的代价并选择其一。',
  test: '在陌生外壳中完成一次独立选路。',
  planningBasis: '学生已经能提出路线，但成本比较仍不稳定。',
  activation: {
    parentSources: ['session:roadmap-session#message:message-012'],
    selectedMemory: ['memory:student/S3'],
    contentBoundary: ['不把候选题目的方法名称写进公开目的。'],
    adaptation: {
      workingJudgment: '当前瓶颈是比较而不是方法数量。',
      sources: ['session:roadmap-session#message:message-012'],
      designConsequence: '先保持题型稳定，只改变路线成本差。',
      reviseIf: '学生在陌生题型中无需比较即可稳定选路。',
    },
  },
} satisfies PlanBlueprint;

test('renders a runtime-owned prepared Plan with the canonical section order', () => {
  validatePlanBlueprint(blueprint);
  const source = renderPreparedPlan(context, blueprint);
  expect(source).toContain(`id: plan-001
kind: plan
status: prepared
parent_id: roadmap
parent_path: ROADMAP.md
coach_session: null`);
  expect(source).not.toContain('planId:');
  expect(source).not.toContain('planPath:');
  expect(parseActivationSnapshot(source)).toMatchObject({
    parent: 'roadmap:roadmap',
    activatedAt: 'pending',
  });

  const headings = [...source.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  expect(headings).toEqual([
    'Goal',
    'Observable Capability Standard',
    'Test',
    'Planning Basis',
    'Activation Snapshot',
    'Lesson Tree',
    'Current Position',
    'Plan Summary',
    'Handoff',
  ]);
  expect(source).toContain('## Lesson Tree\n\n（尚未编排 Lesson。）');
  expect(source).toContain('## Handoff\n\n（尚未封存）');
});

test('rejects missing instructional fields and invalid runtime identity', () => {
  for (const field of [
    'title',
    'publicPurpose',
    'goal',
    'capabilityStandard',
    'test',
    'planningBasis',
  ] as const) {
    expect(() => validatePlanBlueprint({ ...blueprint, [field]: '' }))
      .toThrow('PLAN_BLUEPRINT_INVALID');
  }
  expect(() => renderPreparedPlan(
    { ...context, planId: '../plan-001' },
    blueprint,
  )).toThrow('PLAN_RENDER_CONTEXT_INVALID');
});
