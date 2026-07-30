import { randomUUID } from 'node:crypto';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';
import type { MemoryReviewItem, MemoryReviewSnapshot } from './contracts';
import { validateMemoryReviewItems } from './source-validation';
import type { MemoryReviewStore } from './store';
import { createPiSessionEvidenceReader } from '../runtime/session-owner';

const nullableText = Type.Union([
  Type.String({ minLength: 1 }),
  Type.Null(),
]);

const planClaimSource = Type.String({
  minLength: 1,
  description: 'Copy an exact Claim handle from the just-reread completed Plan Handoff: claim:<current-plan-id>/handoff#learner-cN for student memory, or claim:<current-plan-id>/handoff#teaching-tN for teaching memory. Child Lesson Claims, trace:, handoff:, session:, paths, and reconstructed IDs are invalid here.',
});

const itemSchema = Type.Object({
  id: Type.String({ minLength: 1 }),
  operation: Type.Union([
    Type.Literal('add'),
    Type.Literal('revise'),
    Type.Literal('delete'),
  ]),
  owner: Type.Union([
    Type.Literal('student'),
    Type.Literal('teaching'),
  ]),
  currentId: nullableText,
  currentText: nullableText,
  proposedText: nullableText,
  sources: Type.Array(planClaimSource, {
    minItems: 1,
    description: 'One or more canonical Claims owned by this completed Plan Handoff. The Claim kind must match owner.',
  }),
  rationale: Type.String({ minLength: 1 }),
  counterEvidence: Type.String({ minLength: 1 }),
  scope: Type.String({ minLength: 1 }),
});

export function createMemoryReviewProposeTool(
  root: string,
  planId: string,
  ownerPath: string,
  store: MemoryReviewStore,
  createId: () => string = () => `review-${randomUUID()}`,
) {
  return defineTool({
    name: 'memory_review_propose',
    label: '整理待确认长期记忆',
    description: 'After plan_update completed the Session-owned Plan, first reread that exact Plan, then propose source-linked profile changes for explicit item-by-item student review. Every source must be an exact Claim owned by the current completed Plan Handoff (claim:<plan-id>/handoff#learner-cN for student, teaching-cN for teaching); never pass child Lesson Claims, trace:, handoff:, session:, paths, or reconstructed IDs. This stores a Coach Session artifact only and does not edit profiles.',
    parameters: Type.Object({
      items: Type.Array(itemSchema, { minItems: 1 }),
    }),
    execute: async (_toolCallId, input) => {
      const plan = readMarkdownFile(root, ownerPath);
      if (plan.id !== planId || plan.frontmatter.kind !== 'plan') {
        throw new Error('MEMORY_REVIEW_OWNER_MISMATCH');
      }
      if (plan.frontmatter.status !== 'completed') {
        throw new Error('MEMORY_REVIEW_PLAN_NOT_COMPLETED');
      }
      validateMemoryReviewItems(
        root,
        planId,
        ownerPath,
        input.items as MemoryReviewItem[],
        await createPiSessionEvidenceReader(root),
      );
      const snapshot: MemoryReviewSnapshot = {
        id: createId(),
        planId,
        status: 'proposed',
        items: input.items as MemoryReviewItem[],
        decisions: [],
      };
      store.save(snapshot);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
            ok: true,
            reviewId: snapshot.id,
            itemCount: snapshot.items.length,
          }),
        }],
        details: { kind: 'memory-review', reviewId: snapshot.id },
      };
    },
  });
}
