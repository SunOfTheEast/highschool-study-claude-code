import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  candidateChangesSchema,
  updateParentDocument,
} from './tree-mutations';

const milestone = Type.String({ minLength: 1 });

export function createRoadmapUpdateTool(root: string) {
  return defineTool({
    name: 'roadmap_update',
    label: '更新长期学习路径',
    description: 'Update the Roadmap milestones and its still-unmaterialized Plan candidates. Runtime owns ROADMAP.md and candidate handles; materialized Plans are immutable from this tool.',
    parameters: Type.Object({
      goal: Type.Optional(milestone),
      capabilityStandard: Type.Optional(milestone),
      test: Type.Optional(milestone),
      candidateChanges: candidateChangesSchema,
    }, { additionalProperties: false }),
    execute: async (_id, input) => {
      const sections: Record<string, string> = {};
      if (input.goal !== undefined) sections.Goal = input.goal;
      if (input.capabilityStandard !== undefined) {
        sections['Observable Capability Standard'] = input.capabilityStandard;
      }
      if (input.test !== undefined) sections.Test = input.test;
      const tree = updateParentDocument(root, {
        parentId: 'roadmap',
        parentPath: 'ROADMAP.md',
        childKind: 'plan',
        candidateChanges: input.candidateChanges,
        sections,
        frontmatter: {},
      });
      const value = {
        ok: true as const,
        candidateHandles: tree.entries.map((entry) => entry.handle),
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'roadmap-update', value },
      };
    },
  });
}
