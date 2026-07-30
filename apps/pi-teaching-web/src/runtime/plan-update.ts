import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import {
  candidateChangesSchema,
  updateParentDocument,
} from './tree-mutations';

const text = Type.String({ minLength: 1 });

export function createPlanUpdateTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'plan_update',
    label: '写回学习计划',
    description: 'Persist an active or replanned decision for the current Session-owned Plan and patch only its unmaterialized Lesson candidates. Plan completion is sealed through the handoff tool, not this update.',
    parameters: Type.Object({
      decision: Type.Union([
        Type.Literal('active'),
        Type.Literal('replan'),
      ]),
      currentPosition: text,
      planSummary: text,
      candidateChanges: candidateChangesSchema,
    }, { additionalProperties: false }),
    execute: async (_id, input) => {
      const plan = readMarkdownFile(root, ownerPath);
      if (
        plan.frontmatter.kind !== 'plan'
        || ownerPath !== `plans/${plan.id}.md`
      ) {
        throw new Error(`PLAN_OWNER_MISMATCH: ${ownerPath}`);
      }
      const tree = updateParentDocument(root, {
        parentId: plan.id,
        parentPath: ownerPath,
        childKind: 'lesson',
        candidateChanges: input.candidateChanges,
        sections: {
          'Current Position': input.currentPosition,
          'Plan Summary': input.planSummary,
        },
        frontmatter: { status: 'active' },
      });
      const value = {
        ok: true as const,
        ownerPath,
        decision: input.decision,
        candidateHandles: tree.entries.map((entry) => entry.handle),
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'plan-update', value },
      };
    },
  });
}
