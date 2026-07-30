import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import {
  renderPreparedPlan,
  type PlanBlueprint,
} from '../study/plan-blueprint';
import { readLearningSet } from '../study/read-workspace';
import { createActivationInputSchema } from './activation-tool-schema';
import { materializeChild } from './tree-mutations';

const nonempty = Type.String({ minLength: 1 });

function blueprintSchema(activationSources?: readonly string[]) {
  return Type.Object({
    title: nonempty,
    publicPurpose: nonempty,
    goal: nonempty,
    capabilityStandard: nonempty,
    test: nonempty,
    planningBasis: nonempty,
    activation: createActivationInputSchema(activationSources),
  }, { additionalProperties: false });
}

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

export function createPlanPrepareTool(
  root: string,
  options: { activationSources?: readonly string[] } = {},
) {
  return defineTool({
    name: 'plan_prepare',
    label: '准备学习周期',
    description: 'Materialize one Roadmap-owned Plan candidate after the student-approved Roadmap milestones are complete. Runtime allocates the Plan identity, path, ownership and prepared state. Activation evidence must use canonical handles already shown in the Node Frame; for a first-cycle diagnosis, cite the current session:<id> rather than ROADMAP.md.',
    parameters: Type.Object({
      candidateHandle: nonempty,
      blueprint: blueprintSchema(options.activationSources),
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
