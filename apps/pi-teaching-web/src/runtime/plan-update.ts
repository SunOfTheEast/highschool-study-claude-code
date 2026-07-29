import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { updatePlan } from '../study/write-workspace';

const text = Type.String({ minLength: 1 });
const currentPosition = Type.String({
  minLength: 1,
  description: 'Source-linked account of met, unmet, and conflicting capability evidence.',
});
const nextLessonCandidate = Type.String({
  minLength: 1,
  description: 'Grounded next-Lesson direction, or an explicit statement that no next Lesson is currently proposed.',
});
const learningReview = Type.Object({
  conclusion: text,
  boundary: text,
  nextStep: text,
  keyEvidence: Type.Array(Type.Object({
    claim: text,
    source: text,
  }, { additionalProperties: false }), { minItems: 1 }),
  supportingEvidence: Type.Array(Type.Object({
    claim: text,
    source: text,
    limitation: text,
  }, { additionalProperties: false })),
  openQuestions: Type.Array(Type.Object({
    question: text,
    nextCheck: text,
  }, { additionalProperties: false })),
}, { additionalProperties: false });

export function createPlanUpdateTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'plan_update',
    label: '写回学习计划',
    description: 'Persist the Coach\'s final audit of the current Session-owned Plan. Call after reviewing active evidence and obtaining any student choice required for completion or replanning. The runtime rebuilds Lesson Index and Roadmap status from real files; reread the Plan before reporting the result.',
    parameters: Type.Union([
      Type.Object({
        decision: Type.Union([
          Type.Literal('active'),
          Type.Literal('replan'),
        ], {
          description: 'Continue the Plan or reactivate it around a revised route.',
        }),
        currentPosition,
        nextLessonCandidate,
        planSummary: Type.String({
          minLength: 1,
          description: 'Compact Plan-level synthesis of active evidence, decision, and unresolved work.',
        }),
      }, { additionalProperties: false }),
      Type.Object({
        decision: Type.Literal('complete', {
          description: 'Complete the Plan with student agreement and a bounded review.',
        }),
        currentPosition,
        nextLessonCandidate,
        learningReview,
      }, { additionalProperties: false }),
    ]),
    execute: async (_id, input) => {
      updatePlan(root, ownerPath, input);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, decision: input.decision }) }],
        details: { kind: 'plan-update', planPath: ownerPath, decision: input.decision },
      };
    },
  });
}
