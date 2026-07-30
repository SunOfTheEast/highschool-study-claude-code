import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import {
  renderPreparedPlan,
  type PlanBlueprint,
} from '../study/plan-blueprint';
import { readLearningSet } from '../study/read-workspace';
import { materializeChild } from './tree-mutations';

const nonempty = Type.String({ minLength: 1 });
const activation = Type.Object({
  parentSources: Type.Array(nonempty, {
    minItems: 1,
    description: 'Canonical evidence handles copied exactly from the Node Frame or a search result. On the first Roadmap cycle, use the current Roadmap Session handle shown as session:<id>. Plain paths such as ROADMAP.md or LEARNING_GUIDE.md, and labels such as roadmap, are not evidence handles.',
  }),
  selectedMemory: Type.Array(nonempty, {
    description: 'Optional memory:<student|teaching>/<entry-id> handles copied exactly from the Node Frame.',
  }),
  contentBoundary: Type.Array(nonempty, { minItems: 1 }),
  adaptation: Type.Object({
    workingJudgment: nonempty,
    sources: Type.Array(nonempty, {
      minItems: 1,
      description: 'A non-empty subset copied exactly from activation.parentSources and activation.selectedMemory. Do not put file paths or new labels here.',
    }),
    designConsequence: nonempty,
    reviseIf: nonempty,
  }, { additionalProperties: false }),
}, { additionalProperties: false });

const blueprintSchema = Type.Object({
  title: nonempty,
  publicPurpose: nonempty,
  goal: nonempty,
  capabilityStandard: nonempty,
  test: nonempty,
  planningBasis: nonempty,
  activation,
}, { additionalProperties: false });

function section(body: string, heading: string): string {
  const pattern = new RegExp(
    `^## ${heading}[ \\t]*\\n([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`,
    'm',
  );
  return pattern.exec(body)?.[1]?.trim() ?? '';
}

function isMilestoneReady(value: string): boolean {
  const compact = value.trim().replaceAll(/\s+/g, '');
  return Boolean(compact)
    && !/^(?:[（(]?(?:尚未|待定|待填写|未设置|暂无)|TBD|TODO)/i.test(compact);
}

function assertRoadmapMilestones(root: string): void {
  const roadmap = readMarkdownFile(root, 'ROADMAP.md');
  const values = [
    section(roadmap.body, 'Goal'),
    section(roadmap.body, 'Observable Capability Standard'),
    section(roadmap.body, 'Test'),
  ];
  if (!values.every(isMilestoneReady)) {
    throw new Error('ROADMAP_MILESTONES_REQUIRED');
  }
}

export function createPlanPrepareTool(root: string) {
  return defineTool({
    name: 'plan_prepare',
    label: '准备学习周期',
    description: 'Materialize one Roadmap-owned Plan candidate after the student-approved Roadmap milestones are complete. Runtime allocates the Plan identity, path, ownership and prepared state. Activation evidence must use canonical handles already shown in the Node Frame; for a first-cycle diagnosis, cite the current session:<id> rather than ROADMAP.md.',
    parameters: Type.Object({
      candidateHandle: nonempty,
      blueprint: blueprintSchema,
    }, { additionalProperties: false }),
    execute: async (_id, input) => {
      assertRoadmapMilestones(root);
      const blueprint = input.blueprint as PlanBlueprint;
      const result = materializeChild(root, {
        parentId: 'roadmap',
        parentPath: 'ROADMAP.md',
        childKind: 'plan',
        candidateHandle: input.candidateHandle,
        title: blueprint.title,
        render: ({ childId, childPath }) => renderPreparedPlan({
          planId: childId,
          planPath: childPath,
          parentId: 'roadmap',
          parentPath: 'ROADMAP.md',
        }, blueprint),
        validate: () => {},
      });
      const plan = readLearningSet(root).plans.find(
        (candidate) => candidate.id === result.childId,
      );
      if (
        plan === undefined
        || plan.path !== result.childPath
        || plan.status !== 'prepared'
      ) {
        throw new Error(`PLAN_PREPARE_COMMIT_FAILED: ${result.childId}`);
      }
      const value = {
        ok: true as const,
        ownerPath: 'ROADMAP.md' as const,
        factId: result.childId,
        candidateHandle: result.handle,
        childPath: result.childPath,
        status: 'prepared' as const,
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'plan-prepare', value },
      };
    },
  });
}
