import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import {
  renderPreparedLesson,
  validateLessonBlueprint,
  type LessonBlueprint,
} from '../study/lesson-blueprint';
import { readPlanWorkspace } from '../study/read-workspace';
import { readStudentLessonPreview } from '../study/student-plan-projection';
import { validatePreparedLessonSource } from '../study/validate-prepared-lesson';
import { createActivationInputSchema } from './activation-tool-schema';
import type { NodeAccessPolicy } from './node-access';
import { materializeChild } from './tree-mutations';

const nonempty = Type.String({ minLength: 1 });
const classroomTemplate = Type.Union([
  Type.Literal('diagnostic'),
  Type.Literal('concept'),
  Type.Literal('deliberate-practice'),
  Type.Literal('remediation'),
  Type.Literal('assessment'),
  Type.Literal('review'),
], {
  description: 'Canonical classroom template selected for this Lesson.',
});
const commonBlockFields = {
  localAlias: Type.String({
    minLength: 1,
    description: 'Blueprint-local alias. Runtime maps it to block-001, block-002, and so on.',
  }),
  required: Type.Boolean(),
  dependsOn: Type.Array(nonempty),
  studentView: nonempty,
  teacherControl: nonempty,
};
const block = Type.Union([
  Type.Object({
    kind: Type.Literal('dialogue'),
    ...commonBlockFields,
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal('material'),
    ...commonBlockFields,
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal('reflection'),
    ...commonBlockFields,
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal('problem'),
    ...commonBlockFields,
    cardAlias: Type.String({
      minLength: 1,
      description: 'Exactly one alias declared in blueprint.cards. Runtime compiles it into this problem Block\'s Uses binding.',
    }),
  }, { additionalProperties: false }),
]);
function blueprintSchema(activationSources?: readonly string[]) {
  return Type.Object({
    title: nonempty,
    publicPurpose: nonempty,
    capabilityTarget: nonempty,
    primaryTemplate: classroomTemplate,
    templateReason: nonempty,
    adjustments: Type.Optional(Type.Array(nonempty)),
    activation: createActivationInputSchema(activationSources),
    cards: Type.Array(Type.Object({
      alias: nonempty,
      cardPath: nonempty,
      role: nonempty,
    }, { additionalProperties: false })),
    sources: Type.Array(Type.Object({
      label: Type.String({
        minLength: 1,
        description: 'Student-visible label for an optional Lesson resource link.',
      }),
      target: Type.String({
        minLength: 1,
        description: 'Canonical learning-set-relative file path (optionally with an anchor) or an http(s) URL. Do not use session:, claim:, trace:, card:, block:, or memory: evidence handles here.',
      }),
      note: Type.String({
        minLength: 1,
        description: 'Student-visible note explaining how this linked resource is used.',
      }),
    }, { additionalProperties: false }), {
      description: 'Optional student-visible resource links rendered in the Lesson. Use [] when none are needed. Activation evidence belongs in activation.*.sources, while problem cards belong in cards.',
    }),
    blocks: Type.Array(block, { minItems: 1 }),
  }, { additionalProperties: false });
}

function title(body: string, ownerPath: string): string {
  const value = /^#\s+(.+?)\s*$/m.exec(body)?.[1]
    ?.replace(/^Plan[:：]\s*/, '').trim();
  if (!value) throw new Error(`PLAN_TITLE_REQUIRED: ${ownerPath}`);
  return value;
}

export function createLessonPrepareTool(
  root: string,
  ownerId: string,
  ownerPath: string,
  options: {
    activationSources?: readonly string[];
    accessPolicy?: Pick<NodeAccessPolicy, 'wasResolved'>;
  } = {},
) {
  return defineTool({
    name: 'lesson_prepare',
    label: '整理课堂结构',
    description: 'Materialize or reprepare one candidate owned by the current Plan. Runtime allocates Lesson identity and path, binds parent ownership, compiles block aliases, and returns the canonical prepared receipt. Activation evidence must use canonical handles copied from the current Node Frame or a real retrieval result.',
    parameters: Type.Object({
      candidateHandle: nonempty,
      blueprint: blueprintSchema(options.activationSources),
    }, { additionalProperties: false }),
    execute: async (_id, input) => {
      const plan = readMarkdownFile(root, ownerPath);
      if (
        plan.id !== ownerId
        || plan.frontmatter.kind !== 'plan'
        || ownerPath !== `plans/${ownerId}.md`
      ) {
        throw new Error(`PLAN_OWNER_MISMATCH: ${ownerPath}`);
      }
      if (plan.frontmatter.status === 'completed') {
        throw new Error(`PLAN_PREPARATION_REQUIRES_REACTIVATION: ${ownerId}`);
      }
      const blueprint: LessonBlueprint = {
        title: input.blueprint.title,
        publicPurpose: input.blueprint.publicPurpose,
        capabilityTarget: input.blueprint.capabilityTarget,
        primaryTemplate: input.blueprint.primaryTemplate,
        templateReason: input.blueprint.templateReason,
        adjustments: input.blueprint.adjustments ?? [],
        activation: input.blueprint.activation as LessonBlueprint['activation'],
        cards: input.blueprint.cards,
        sources: input.blueprint.sources,
        blocks: input.blueprint.blocks.map((candidate) => ({
          localAlias: candidate.localAlias,
          kind: candidate.kind,
          required: candidate.required,
          dependsOn: candidate.dependsOn,
          uses: candidate.kind === 'problem' ? [candidate.cardAlias] : [],
          studentView: candidate.studentView,
          teacherControl: candidate.teacherControl,
        })),
      };
      if (options.accessPolicy !== undefined) {
        const cardPaths = new Map(
          blueprint.cards.map((card) => [card.alias, card.cardPath]),
        );
        for (const candidate of blueprint.blocks) {
          if (candidate.kind !== 'problem') continue;
          const cardPath = cardPaths.get(candidate.uses[0]!);
          if (cardPath === undefined) continue;
          const source = `card:${cardPath}`;
          if (!options.accessPolicy.wasResolved(source)) {
            throw new Error(`LESSON_CARD_NOT_RESOLVED: ${source}`);
          }
        }
      }
      const planTitle = title(plan.body, ownerPath);
      const result = materializeChild(root, {
        parentId: ownerId,
        parentPath: ownerPath,
        childKind: 'lesson',
        candidateHandle: input.candidateHandle,
        title: blueprint.title,
        render: ({ childId, childPath }) => {
          const context = {
            planId: ownerId,
            planPath: ownerPath,
            planTitle,
            lessonId: childId,
            lessonPath: childPath,
          };
          validateLessonBlueprint(root, context, blueprint);
          return renderPreparedLesson(context, blueprint);
        },
        validate: (childPath, source) => {
          validatePreparedLessonSource(root, childPath, source);
        },
      });
      const lesson = readPlanWorkspace(root, ownerId).lessons.find(
        (candidate) => candidate.id === result.childId,
      );
      if (
        lesson === undefined
        || lesson.path !== result.childPath
        || lesson.status !== 'prepared'
      ) {
        throw new Error(`LESSON_PREPARE_COMMIT_FAILED: ${result.childId}`);
      }
      const preview = readStudentLessonPreview(root, lesson);
      const value = {
        ok: true as const,
        ownerPath,
        factId: lesson.id,
        candidateHandle: result.handle,
        status: 'prepared' as const,
        lessonPath: lesson.path,
        publicTitle: preview.publicTitle,
        publicPurpose: preview.publicPurpose,
        blockCount: preview.blockCount,
        blockKinds: preview.blockKinds,
        sourceNumbers: preview.sourceNumbers,
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'lesson-prepare', value },
      };
    },
  });
}
