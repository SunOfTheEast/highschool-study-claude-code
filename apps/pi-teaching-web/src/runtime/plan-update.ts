import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import type { SessionEvidenceReader } from '../study/evidence-tree';
import {
  handoffDraftSchema,
  sealPlanHandoff,
} from '../study/handoff-seal';
import { createPiSessionEvidenceReader } from './session-owner';
import {
  assertCandidateSourcesAllowed,
  candidateChangesSchema,
  type CandidateSourcePolicy,
  updateParentDocument,
} from './tree-mutations';

const text = Type.String({ minLength: 1 });

export type PlanUpdateOptions = {
  now?: () => Date;
  sessions?: SessionEvidenceReader;
  accessPolicy?: CandidateSourcePolicy;
};

export function createPlanUpdateTool(
  root: string,
  ownerPath: string,
  options: PlanUpdateOptions = {},
) {
  return defineTool({
    name: 'plan_update',
    label: '写回学习计划',
    description: 'Persist an active, replanned or completed decision for the current Session-owned Plan and patch only its unmaterialized Lesson candidates. Completion requires one valid source-linked Plan Handoff and is written in the same update.',
    parameters: Type.Object({
      decision: Type.Union([
        Type.Literal('active'),
        Type.Literal('replan'),
        Type.Literal('complete'),
      ]),
      currentPosition: text,
      planSummary: text,
      candidateChanges: candidateChangesSchema,
      handoff: Type.Optional(handoffDraftSchema),
    }, {
      additionalProperties: false,
      oneOf: [
        {
          properties: { decision: { enum: ['active', 'replan'] } },
          not: { required: ['handoff'] },
        },
        {
          properties: { decision: { const: 'complete' } },
          required: ['handoff'],
        },
      ],
    }),
    execute: async (_id, input) => {
      const plan = readMarkdownFile(root, ownerPath);
      if (
        plan.frontmatter.kind !== 'plan'
        || ownerPath !== `plans/${plan.id}.md`
      ) {
        throw new Error(`PLAN_OWNER_MISMATCH: ${ownerPath}`);
      }
      assertCandidateSourcesAllowed(
        input.candidateChanges,
        options.accessPolicy,
      );
      const sealed = input.decision === 'complete'
        ? sealPlanHandoff(
          root,
          ownerPath,
          input.handoff!,
          {
            now: options.now ?? (() => new Date()),
            sessions: options.sessions ?? await createPiSessionEvidenceReader(root),
          },
        )
        : null;
      const tree = updateParentDocument(root, {
        parentId: plan.id,
        parentPath: ownerPath,
        childKind: 'lesson',
        candidateChanges: input.candidateChanges,
        sections: {
          'Current Position': input.currentPosition,
          'Plan Summary': input.planSummary,
          ...(sealed === null
            ? {}
            : {
              Handoff: sealed.source.replace(/^## Handoff[ \t]*\n\n/, ''),
            }),
        },
        frontmatter: {
          status: input.decision === 'complete' ? 'completed' : 'active',
        },
      });
      const value = {
        ok: true as const,
        ownerPath,
        decision: input.decision,
        candidateHandles: tree.entries.map((entry) => entry.handle),
        ...(sealed === null
          ? {}
          : {
            handoff: {
              id: sealed.id,
              mode: sealed.mode,
              rejectedIssues: sealed.rejectedIssues,
            },
          }),
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'plan-update', value },
      };
    },
  });
}
