import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { updatePlan } from '../study/write-workspace';

export function createPlanUpdateTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'plan_update',
    label: '写回学习计划',
    description: 'Atomically persist the Coach final audit to the current Plan.',
    parameters: Type.Object({
      decision: Type.Union([
        Type.Literal('active'),
        Type.Literal('complete'),
        Type.Literal('replan'),
      ]),
      currentPosition: Type.String({ minLength: 1 }),
      nextLessonCandidate: Type.String({ minLength: 1 }),
      planSummary: Type.String({ minLength: 1 }),
    }),
    execute: async (_id, input) => {
      updatePlan(root, ownerPath, input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, decision: input.decision }) }],
        details: { kind: 'plan-update', planPath: ownerPath, decision: input.decision },
      };
    },
  });
}
