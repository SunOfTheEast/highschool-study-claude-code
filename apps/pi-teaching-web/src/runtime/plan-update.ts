import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { updatePlan } from '../study/write-workspace';

export function createPlanUpdateTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'plan_update',
    label: '写回学习计划',
    description: 'Persist the Coach\'s final audit of the current Session-owned Plan. Call after reviewing active evidence and obtaining any student choice required for completion or replanning. The runtime rebuilds Lesson Index and Roadmap status from real files; reread the Plan before reporting the result.',
    parameters: Type.Object({
      decision: Type.Union([
        Type.Literal('active'),
        Type.Literal('complete'),
        Type.Literal('replan'),
      ], {
        description: 'Final Plan decision: continue active, complete with student agreement, or reactivate around a revised route.',
      }),
      currentPosition: Type.String({
        minLength: 1,
        description: 'Source-linked account of met, unmet, and conflicting capability evidence.',
      }),
      nextLessonCandidate: Type.String({
        minLength: 1,
        description: 'Grounded next-Lesson direction, or an explicit statement that no next Lesson is currently proposed.',
      }),
      planSummary: Type.String({
        minLength: 1,
        description: 'Compact Plan-level synthesis of active evidence, decision, and unresolved work.',
      }),
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
