import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { updatePlan, type PlanUpdateInput } from '../study/write-workspace';

const text = Type.String({ minLength: 1 });
const keyEvidenceSource = Type.String({
  minLength: 1,
  description: 'Exact active Trace anchor from this Plan. Key evidence must be '
    + 'correct, support:none, and belong to a problem Block in an assessment Lesson. '
    + 'This is objective eligibility, not an automatic completion verdict.',
});
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
    source: keyEvidenceSource,
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
    description: 'Persist the Coach\'s final audit of the current Session-owned Plan. Call after reviewing active evidence and obtaining any student choice required for completion or replanning. Child status is derived from the canonical Lesson Tree; reread the Plan before reporting the result.',
    parameters: Type.Object({
      decision: Type.Union([
        Type.Literal('active'),
        Type.Literal('replan'),
        Type.Literal('complete'),
      ], {
        description: 'Continue the Plan, reactivate it around a revised route, or complete it with student agreement.',
      }),
      currentPosition,
      nextLessonCandidate,
      planSummary: Type.Optional(Type.String({
        minLength: 1,
        description: 'Required for active or replan; compact synthesis of active evidence, decision, and unresolved work.',
      })),
      learningReview: Type.Optional(learningReview),
    }, {
      additionalProperties: false,
      oneOf: [
        {
          properties: {
            decision: { enum: ['active', 'replan'] },
          },
          required: ['planSummary'],
          not: { required: ['learningReview'] },
        },
        {
          properties: {
            decision: { const: 'complete' },
          },
          required: ['learningReview'],
          not: { required: ['planSummary'] },
        },
      ],
    }),
    execute: async (_id, input) => {
      updatePlan(root, ownerPath, input as PlanUpdateInput);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, decision: input.decision }) }],
        details: { kind: 'plan-update', planPath: ownerPath, decision: input.decision },
      };
    },
  });
}
