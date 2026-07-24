import { defineTool } from '@earendil-works/pi-coding-agent';
import {
  appendCardAlternative,
  listCanonicalMethodNames,
} from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';

export function createCardAlternativeAppendTool(
  root: string,
  ownerPath: string,
  now: () => Date,
) {
  const methodName = Type.Enum(listCanonicalMethodNames(root));
  return defineTool({
    name: 'card_alternative_append',
    label: '整理可追溯另解',
    description: 'Persist a verified alternative route against the current Lesson Trace.',
    parameters: Type.Object({
      sourceTraceId: Type.String({ minLength: 1 }),
      question: Type.String({
        minLength: 1,
        description: 'For a card without parts, pass exactly `整题`; for multipart, pass the exact changed part label and never the stem.',
      }),
      solution: Type.String({ minLength: 1 }),
      method: Type.Union([methodName, Type.Null()], {
        description: 'Pass one student-confirmed canonical node, or null when no exact node is confirmed.',
      }),
      support: Type.Union([
        Type.Literal('none'),
        Type.Literal('tutor'),
        Type.Literal('external'),
      ]),
    }),
    execute: async (_id, input) => {
      const alternative = appendCardAlternative(root, ownerPath, input, now);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(alternative) }],
        details: {
          kind: 'card-alternative-append',
          lessonPath: ownerPath,
          question: alternative.question,
        },
      };
    },
  });
}
