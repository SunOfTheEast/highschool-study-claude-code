import {
  readCard,
  readLessonAliases,
  readMarkdownFile,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
import { Type, type TString } from 'typebox';
import { readPreparedLessonBlocks } from '../study/validate-prepared-lesson';

function literalUnion(values: string[], description: string): TString {
  const unique = [...new Set(values)];
  if (unique.length === 0) throw new Error('LESSON_SCHEMA_VALUES_REQUIRED');
  return Type.Union(
    unique.map((value) => Type.Literal(value)),
    { description },
  ) as unknown as TString;
}

export function lessonBlockIdSchema(root: string, lessonPath: string): TString {
  const lesson = readMarkdownFile(root, lessonPath);
  const ids = readPreparedLessonBlocks(lesson.body).map((block) => block.id);
  if (ids.some((id) => !/^block-\d{3,}$/.test(id))) {
    throw new Error(`LESSON_BLOCK_ID_INVALID: ${ids.join(',')}`);
  }
  return Type.String({
    pattern: '^block-[0-9]{3,}$',
    description: `Canonical Block ID in the current Session-owned Lesson. Current IDs: ${
      ids.join(', ') || '(none)'
    }. Runtime-created IDs remain valid in this same Session and are checked against the live Lesson at execution.`,
  });
}

export function lessonPartQuestionSchema(
  root: string,
  lessonPath: string,
): TString | null {
  const lesson = readMarkdownFile(root, lessonPath);
  const labels = [...readLessonAliases(lesson.body).values()]
    .flatMap((target) => {
      const resolved = sourceResolve(root, { fromPath: lessonPath, target });
      const card = resolved.path === null ? null : readCard(root, resolved.path);
      return card?.parts ?? [];
    });
  return labels.length === 0
    ? null
    : literalUnion(
      labels,
      'Exact part label from a problem card bound to the current Lesson.',
    );
}
