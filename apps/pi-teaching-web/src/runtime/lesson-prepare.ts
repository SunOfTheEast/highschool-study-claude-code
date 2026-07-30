import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import {
  lessonIdPattern,
  renderPreparedLesson,
  validateLessonBlueprint,
  type LessonBlueprint,
} from '../study/lesson-blueprint';
import { readPlanWorkspace } from '../study/read-workspace';
import { readStudentLessonPreview } from '../study/student-plan-projection';
import { validatePreparedLessonSource } from '../study/validate-prepared-lesson';
import { writePreparedLesson } from '../study/write-workspace';

const nonempty = Type.String({ minLength: 1 });
const classroomTemplate = Type.Union([
  Type.Literal('diagnostic'),
  Type.Literal('concept'),
  Type.Literal('deliberate-practice'),
  Type.Literal('remediation'),
  Type.Literal('assessment'),
  Type.Literal('review'),
], {
  description: 'Canonical classroom template selected for this Lesson. The ID chooses template defaults; adjustments record deliberate deviations.',
});
const block = Type.Object({
  localAlias: Type.String({
    minLength: 1,
    description: 'Blueprint-local Block alias used only to express dependencies. Runtime maps aliases to block-001, block-002, and so on.',
  }),
  kind: Type.Union([
    Type.Literal('dialogue'),
    Type.Literal('problem'),
    Type.Literal('material'),
    Type.Literal('reflection'),
  ], {
    description: 'Activity kind. A problem produces one independently assessed response; reflection is an optional, repeatable classroom activity selected by the template and Coach.',
  }),
  required: Type.Boolean({
    description: 'Whether the Lesson cannot complete normally without traversing this Block.',
  }),
  dependsOn: Type.Array(nonempty, {
    description: 'Earlier Blueprint-local aliases that must be resolved before this Block can activate.',
  }),
  uses: Type.Array(nonempty, {
    description: 'Lesson-local aliases used by this Block. A problem Block must use exactly one authentic problem-card alias.',
  }),
  studentView: Type.String({
    minLength: 1,
    description: 'Content that may be shown when this Block is active.',
  }),
  teacherControl: Type.String({
    minLength: 1,
    description: 'Private role, source references, reveal mode, evidence target, and ordered teaching support. Keep anticipated student reactions and failures conditional; ground mathematical judging claims in the selected card or source.',
  }),
}, {
  description: 'One adjustable Lesson activity. Put separately judged responses, including separately judged parts of one card, in separate problem Blocks.',
});

export function createLessonPrepareTool(
  root: string,
  ownerId: string,
  ownerPath: string,
) {
  return defineTool({
    name: 'lesson_prepare',
    label: '整理课堂结构',
    description: 'Compile one source-grounded Blueprint into canonical Lesson Markdown and register it under the Coach Session-owned Plan. Call after selecting a canonical template, authentic card paths, and a complete Block graph; revise only a same-Plan Lesson that is still prepared. The runtime binds Plan ownership, validates sources and aliases, writes initial state and Plan links, and returns the prepared Lesson path and block count.',
    parameters: Type.Object({
      lessonId: Type.String({
        minLength: 1,
        pattern: lessonIdPattern.source,
        description: 'New Lesson ID and lessons/<lessonId>.md filename stem. Start with lesson- and use only lowercase letters, digits, and hyphens; for example lesson-001.',
      }),
      title: Type.String({
        minLength: 1,
        description: 'Student-visible Lesson title appropriate to the selected reveal policy.',
      }),
      publicPurpose: Type.String({
        minLength: 1,
        description: 'Student-safe account of why this Lesson belongs in the current Plan.',
      }),
      capabilityTarget: Type.String({
        minLength: 1,
        description: 'Observable capability this Lesson teaches or checks; it does not assert attainment.',
      }),
      primaryTemplate: classroomTemplate,
      templateReason: Type.String({
        minLength: 1,
        description: 'Why this template fits the current evidence and capability target.',
      }),
      adjustments: Type.Optional(Type.Array(nonempty, {
        description: 'Deliberate changes from the selected template defaults.',
      })),
      activation: Type.Object({
        parentSources: Type.Array(nonempty, {
          minItems: 1,
          description: 'Canonical evidence handles selected from the parent Plan context.',
        }),
        selectedMemory: Type.Array(nonempty, {
          description: 'Confirmed memory handles only; never copy profile prose here.',
        }),
        contentBoundary: Type.Array(nonempty, {
          minItems: 1,
          description: 'Student-facing reveal and content boundaries for this Lesson.',
        }),
        adaptation: Type.Object({
          workingJudgment: nonempty,
          sources: Type.Array(nonempty, { minItems: 1 }),
          designConsequence: nonempty,
          reviseIf: nonempty,
        }, { additionalProperties: false }),
      }, { additionalProperties: false }),
      cards: Type.Array(Type.Object({
        alias: Type.String({
          minLength: 1,
          description: 'Lesson-local short name referenced by Block uses.',
        }),
        cardPath: Type.String({
          minLength: 1,
          description: 'Exact learning-set-relative path returned by authentic card retrieval.',
        }),
        role: Type.String({
          minLength: 1,
          description: 'Instructional role this card serves in the Lesson.',
        }),
      }), {
        description: 'Authentic problem cards available to this Lesson.',
      }),
      sources: Type.Array(Type.Object({
        label: Type.String({
          minLength: 1,
          description: 'Readable name for the material source.',
        }),
        target: Type.String({
          minLength: 1,
          description: 'Learning-set-local source target or source fragment.',
        }),
        note: Type.String({
          minLength: 1,
          description: 'What this source supports in the Lesson.',
        }),
      }), {
        description: 'Non-card materials cited by the Lesson.',
      }),
      blocks: Type.Array(block, {
        minItems: 1,
        description: 'Ordered, dependency-aware activity graph compiled into the Lesson.',
      }),
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
      const blueprint: LessonBlueprint = {
        title: input.title,
        publicPurpose: input.publicPurpose,
        capabilityTarget: input.capabilityTarget,
        primaryTemplate: input.primaryTemplate,
        templateReason: input.templateReason,
        adjustments: input.adjustments ?? [],
        activation: input.activation,
        cards: input.cards,
        sources: input.sources,
        blocks: input.blocks,
      };
      const context = {
        planId: ownerId,
        planPath: ownerPath,
        planTitle,
        lessonId: input.lessonId,
        lessonPath,
      };
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
      const preview = readStudentLessonPreview(root, lesson);
      const value = {
        ok: true as const,
        ownerPath,
        factId: lesson.id,
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
