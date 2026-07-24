import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import {
  renderPreparedLesson,
  validateLessonBlueprint,
  type LessonBlueprint,
} from '../study/lesson-blueprint';
import { readPlanWorkspace } from '../study/read-workspace';
import { validatePreparedLessonSource } from '../study/validate-prepared-lesson';
import { writePreparedLesson } from '../study/write-workspace';

const nonempty = Type.String({ minLength: 1 });
const block = Type.Object({
  id: nonempty,
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
}, {
  description: 'One independently assessed response belongs in one problem Block. If separate parts of one card receive separate responses or judgments, reuse that card alias in separate problem Blocks; never combine those parts in one Block.',
});

export function createLessonPrepareTool(
  root: string,
  ownerId: string,
  ownerPath: string,
) {
  return defineTool({
    name: 'lesson_prepare',
    label: '整理课堂结构',
    description: 'Compile and publish one source-grounded prepared Lesson for the current Plan.',
    parameters: Type.Object({
      lessonId: nonempty,
      title: nonempty,
      planContext: nonempty,
      capabilityTarget: nonempty,
      primaryTemplate: nonempty,
      templateReason: nonempty,
      adjustments: Type.Array(nonempty),
      cards: Type.Array(Type.Object({
        alias: nonempty,
        cardPath: nonempty,
        role: nonempty,
      })),
      sources: Type.Array(Type.Object({
        label: nonempty,
        target: nonempty,
        note: nonempty,
      })),
      blocks: Type.Array(block, { minItems: 1 }),
    }),
    execute: async (_id, input) => {
      const lessonPath = `lessons/${input.lessonId}.md`;
      const plan = readMarkdownFile(root, ownerPath);
      if (plan.id !== ownerId || plan.frontmatter.kind !== 'plan') {
        throw new Error(`PLAN_OWNER_MISMATCH: ${ownerPath}`);
      }
      const planTitle = /^#\s+(.+)$/m.exec(plan.body)?.[1]
        ?.replace(/^Plan[:：]\s*/, '').trim();
      if (!planTitle) throw new Error(`PLAN_TITLE_REQUIRED: ${ownerPath}`);
      const blueprint = input as LessonBlueprint;
      const context = { planId: ownerId, planPath: ownerPath, planTitle, lessonPath };
      validateLessonBlueprint(root, context, blueprint);
      const source = renderPreparedLesson(context, blueprint);
      validatePreparedLessonSource(root, lessonPath, source);
      writePreparedLesson(root, ownerPath, {
        lessonId: input.lessonId,
        lessonPath,
        lessonTitle: input.title,
        source,
      });
      const lesson = readPlanWorkspace(root, ownerId).lessons
        .find((candidate) => candidate.id === input.lessonId);
      if (!lesson || lesson.path !== lessonPath || lesson.status !== 'prepared') {
        throw new Error(`LESSON_PREPARE_COMMIT_FAILED: ${input.lessonId}`);
      }
      const value = {
        ok: true as const,
        ownerPath,
        factId: lesson.id,
        status: 'prepared' as const,
        lessonPath: lesson.path,
        blockCount: lesson.blocks.length,
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'lesson-prepare', value },
      };
    },
  });
}
