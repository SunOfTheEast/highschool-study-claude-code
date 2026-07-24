import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readLearningSet } from '../study/read-workspace';
import { registerPlan, setFrontmatterField } from '../study/write-workspace';
import { findOwnedPiSessionFile } from './session-owner';

export function createPlanRegisterTool(root: string) {
  return defineTool({
    name: 'plan_register',
    label: '注册学习计划',
    description: 'Validate an already written Plan file and register it idempotently in ROADMAP.md. Call after the Plan content exists; this tool does not author the Plan. It verifies the canonical Plan, repairs a foreign Coach Session link when necessary, and returns the registered Plan receipt.',
    parameters: Type.Object({
      planId: Type.String({
        minLength: 1,
        description: 'Exact ID from the Plan frontmatter and plans/<planId>.md filename stem.',
      }),
    }),
    execute: async (_id, input) => {
      let plan = registerPlan(root, input.planId);
      if (plan.coachSessionId !== null) {
        const owned = await findOwnedPiSessionFile(root, plan.coachSessionId, {
          role: 'coach',
          ownerId: plan.id,
          ownerPath: plan.path,
        });
        if (owned === null) {
          setFrontmatterField(root, plan.path, 'coach_session', 'null');
          plan = registerPlan(root, input.planId);
        }
      }
      const canonical = readLearningSet(root).plans.find((item) => item.id === plan.id);
      if (!canonical) throw new Error(`PLAN_REGISTRATION_FAILED: ${plan.id}`);
      const value = {
        ok: true,
        ownerPath: canonical.path,
        factId: canonical.id,
        status: 'registered',
        plan: canonical,
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'plan-register', value },
      };
    },
  });
}
