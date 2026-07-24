import { defineTool } from '@earendil-works/pi-coding-agent';
import {
  appendCardAlternativeWithProjection,
  listCanonicalMethodNames,
} from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';

export function createCardAlternativeAppendTool(
  root: string,
  ownerPath: string,
  now: () => Date,
) {
  const methodName = Type.Enum(listCanonicalMethodNames(root), {
    description: 'Exact canonical method name from the current learning-set graph.',
  });
  return defineTool({
    name: 'card_alternative_append',
    label: '整理可追溯另解',
    description: 'Persist one verified genuinely different complete route beside its real problem card. Call only after the current Lesson has a correct active Trace for the route and the whole changed question or part has been checked against the reference and stored alternatives. The runtime binds the Lesson and source card and returns the stored alternative.',
    parameters: Type.Object({
      sourceTraceId: Type.String({
        minLength: 1,
        description: 'Event ID of the correct active Trace that proves this route occurred in the current Lesson.',
      }),
      question: Type.String({
        minLength: 1,
        description: 'Exact scope whose complete route differs: use `整题` for a card without parts, otherwise the exact changed part label rather than the stem.',
      }),
      solution: Type.String({
        minLength: 1,
        description: 'Complete entry, decisive reasoning, and closing chain of the verified alternative route.',
      }),
      method: Type.Union([methodName, Type.Null()], {
        description: 'One student-confirmed exact canonical node for the alternative, or null after rejection, deferral, or no exact match.',
      }),
      support: Type.Union([
        Type.Literal('none'),
        Type.Literal('tutor'),
        Type.Literal('external'),
      ], {
        description: 'Help actually used in this alternative route, using the same dependence meaning as classroom Trace.',
      }),
    }),
    execute: async (_id, input) => {
      const alternative = appendCardAlternativeWithProjection(root, ownerPath, input, now);
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
