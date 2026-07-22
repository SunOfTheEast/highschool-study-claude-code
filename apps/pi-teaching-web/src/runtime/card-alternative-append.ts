import { defineTool } from '@earendil-works/pi-coding-agent';
import { appendCardAlternative } from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';

export function createCardAlternativeAppendTool(
  root: string,
  ownerPath: string,
  now: () => Date,
) {
  return defineTool({
    name: 'card_alternative_append',
    label: '整理可追溯另解',
    description: 'Persist a verified alternative route against the current Lesson Trace.',
    parameters: Type.Object({
      sourceTraceId: Type.String({ minLength: 1 }),
      question: Type.String({ minLength: 1 }),
      solution: Type.String({ minLength: 1 }),
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
