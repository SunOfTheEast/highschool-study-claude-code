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
const block = Type.Object({
  localAlias: Type.String({
    minLength: 1,
    description: 'Blueprint-local alias. Runtime maps it to block-001, block-002, and so on.',
  }),
  kind: Type.Union([
    Type.Literal('dialogue'),
    Type.Literal('problem'),
    Type.Literal('material'),
    Type.Literal('reflection'),
  ]),
  required: Type.Boolean(),
  dependsOn: Type.Array(nonempty),
  uses: Type.Array(nonempty),
  studentView: nonempty,
  teacherControl: nonempty,
}, { additionalProperties: false });
const activation = Type.Object({
  parentSources: Type.Array(nonempty, { minItems: 1 }),
  selectedMemory: Type.Array(nonempty),
  contentBoundary: Type.Array(nonempty, { minItems: 1 }),
  adaptation: Type.Object({
    workingJudgment: nonempty,
    sources: Type.Array(nonempty, { minItems: 1 }),
    designConsequence: nonempty,
    reviseIf: nonempty,
  }, { additionalProperties: false }),
}, { additionalProperties: false });
const blueprintSchema = Type.Object({
  title: nonempty,
  publicPurpose: nonempty,
  capabilityTarget: nonempty,
  primaryTemplate: classroomTemplate,
  templateReason: nonempty,
  adjustments: Type.Optional(Type.Array(nonempty)),
  activation,
  cards: Type.Array(Type.Object({
    alias: nonempty,
    cardPath: nonempty,
    role: nonempty,
  }, { additionalProperties: false })),
  sources: Type.Array(Type.Object({
    label: nonempty,
    target: nonempty,
    note: nonempty,
  }, { additionalProperties: false })),
  blocks: Type.Array(block, { minItems: 1 }),
}, { additionalProperties: false });

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
) {
  return defineTool({
    name: 'lesson_prepare',
    label: '整理课堂结构',
    description: 'Materialize or reprepare one candidate owned by the current Plan. Runtime allocates Lesson identity and path, binds parent ownership, compiles block aliases, and returns the canonical prepared receipt.',
    parameters: Type.Object({
      candidateHandle: nonempty,
      blueprint: blueprintSchema,
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
        ...input.blueprint,
        adjustments: input.blueprint.adjustments ?? [],
      };
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
