import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import type { SessionEvidenceReader } from '../study/evidence-tree';
import {
  createHandoffDraftSchema,
  sealRoadmapCheckpoint,
} from '../study/handoff-seal';
import { createPiSessionEvidenceReader } from './session-owner';
import {
  assertCandidateSourcesAllowed,
  candidateChangesSchema,
  type CandidateSourcePolicy,
  updateParentDocument,
} from './tree-mutations';

const milestone = Type.String({ minLength: 1 });

export type RoadmapUpdateOptions = {
  now?: () => Date;
  sessions?: SessionEvidenceReader;
  accessPolicy?: CandidateSourcePolicy;
};

function sectionBody(source: string, heading: string): string {
  const match = new RegExp(
    `^## ${heading}[ \\t]*$\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`,
    'm',
  ).exec(source);
  return match?.[1]?.trim() ?? '';
}

export function createRoadmapUpdateTool(
  root: string,
  options: RoadmapUpdateOptions = {},
) {
  return defineTool({
    name: 'roadmap_update',
    label: '更新长期学习路径',
    description: 'Update Roadmap milestones and still-unmaterialized Plan candidates. On first-cycle planning, omit checkpoint entirely. A checkpoint is only for cross-cycle conclusions backed by completed Plan claims or confirmed memory. Runtime owns ROADMAP.md and candidate handles; materialized Plans are immutable from this tool.',
    parameters: Type.Object({
      goal: Type.Optional(milestone),
      capabilityStandard: Type.Optional(milestone),
      test: Type.Optional(milestone),
      candidateChanges: candidateChangesSchema,
      checkpoint: Type.Optional(createHandoffDraftSchema(
        'Use only exact claim: handles from completed Plan Handoffs or confirmed memory: handles available to this Roadmap.',
        'Cross-cycle evidence only. On first-cycle planning, or whenever no completed Plan claim is available, omit checkpoint entirely; never send an empty checkpoint draft.',
      )),
    }, { additionalProperties: false }),
    execute: async (_id, input) => {
      assertCandidateSourcesAllowed(
        input.candidateChanges,
        options.accessPolicy,
      );
      const sections: Record<string, string> = {};
      if (input.goal !== undefined) sections.Goal = input.goal;
      if (input.capabilityStandard !== undefined) {
        sections['Observable Capability Standard'] = input.capabilityStandard;
      }
      if (input.test !== undefined) sections.Test = input.test;
      const checkpoint = input.checkpoint === undefined
        ? null
        : sealRoadmapCheckpoint(root, input.checkpoint, {
          now: options.now ?? (() => new Date()),
          sessions: options.sessions ?? await createPiSessionEvidenceReader(root),
        });
      if (checkpoint !== null) {
        const current = sectionBody(
          readMarkdownFile(root, 'ROADMAP.md').body,
          'Handoff Checkpoints',
        );
        sections['Handoff Checkpoints'] = [
          current,
          checkpoint.source.trim(),
        ].filter(Boolean).join('\n\n');
      }
      const tree = updateParentDocument(root, {
        parentId: 'roadmap',
        parentPath: 'ROADMAP.md',
        childKind: 'plan',
        candidateChanges: input.candidateChanges,
        sections,
        appendMissingSections: ['Handoff Checkpoints'],
        frontmatter: {},
      });
      const value = {
        ok: true as const,
        candidateHandles: tree.entries.map((entry) => entry.handle),
        ...(checkpoint === null ? {} : { checkpoint: { id: checkpoint.id } }),
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'roadmap-update', value },
      };
    },
  });
}
