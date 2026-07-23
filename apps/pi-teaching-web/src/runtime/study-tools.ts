import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  appendTraceWithProjection,
  listCanonicalMethodNames,
  searchCards,
  searchTraces,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';
import type { StudySessionScope } from './session-scope';

function result(kind: string, value: object) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind, value },
  };
}

export type StudyToolContext = StudySessionScope;

export function createStudyTools(
  root: string,
  now: () => Date,
  context: StudyToolContext,
): ToolDefinition[] {
  const methodName = Type.Enum(listCanonicalMethodNames(root));
  return [
    defineTool({
      name: 'card_search',
      label: '搜索真实题卡',
      description: 'Search real problem cards and include every card\'s complete active Trace history.',
      parameters: Type.Object({
        query: Type.String(),
        limit: Type.Integer({ minimum: 1, maximum: 20 }),
      }),
      execute: async (_id, input) => result('card-search', searchCards(root, input)),
    }),
    defineTool({
      name: 'trace_search',
      label: '搜索课堂 Trace',
      description: 'Search active Trace and reverse-resolve unique real cards.',
      parameters: Type.Object({
        query: Type.Optional(Type.String()),
        planId: Type.Optional(Type.String()),
        lessonId: Type.Optional(Type.String()),
        cardPath: Type.Optional(Type.String()),
        limit: Type.Integer({ minimum: 1, maximum: 100 }),
      }),
      execute: async (_id, input) => result('trace-search', searchTraces(root, {
        query: input.query ?? null,
        planId: input.planId ?? null,
        lessonId: input.lessonId ?? null,
        cardPath: input.cardPath ?? null,
        limit: input.limit,
      })),
    }),
    defineTool({
      name: 'trace_append',
      label: '记录课堂证据',
      description: 'Append one validated Trace to its owning Lesson.',
      parameters: Type.Object({
        blockId: Type.String(),
        cardAlias: Type.Optional(Type.String()),
        materialPath: Type.Optional(Type.String()),
        methodStatus: Type.Union([
          Type.Literal('unmapped'),
          Type.Literal('student_confirmed'),
        ], {
          description: 'Use student_confirmed only after an explicit student confirmation turn; otherwise use unmapped.',
        }),
        methodRoute: Type.String({
          minLength: 1,
          description: 'Describe the student\'s decisive route without inventing a canonical label.',
        }),
        methodPrimary: Type.Optional(methodName),
        methodSecondary: Type.Optional(Type.Array(methodName)),
        methodDecisiveStep: Type.Optional(Type.String({ minLength: 1 })),
        methodConfirmation: Type.Optional(Type.String({ minLength: 1 })),
        assessment: Type.Union([
          Type.Literal('correct'),
          Type.Literal('partially_correct'),
          Type.Literal('incorrect'),
          Type.Literal('incomplete'),
        ], {
          description: "correct requires every decisive implication to be present in the student's own work before this tool call. Tutor-generated completions never count as student evidence.",
        }),
        support: Type.Union([
          Type.Literal('none'),
          Type.Literal('tutor'),
          Type.Literal('external'),
        ], {
          description: 'Record actual dependence on help used in this completed attempt, not whether a hint merely appeared in the Session. Resolve ambiguous directional influence with the student before this tool call.',
        }),
        note: Type.String(),
        supersedes: Type.Optional(Type.String({
          description: 'This field is required when this is a later revision of the same card-and-Block attempt. Set it to the exact active incomplete or partially_correct event ID.',
        })),
      }),
      execute: async (_id, input) => {
        const methods = input.methodStatus === 'student_confirmed'
          ? (() => {
              if (
                input.methodPrimary === undefined
                || input.methodDecisiveStep?.trim() === ''
                || input.methodDecisiveStep === undefined
                || input.methodConfirmation?.trim() === ''
                || input.methodConfirmation === undefined
              ) {
                throw new Error(
                  'INVALID_METHOD_CONFIRMATION: student_confirmed requires methodPrimary, methodDecisiveStep and methodConfirmation',
                );
              }
              return {
                primary: input.methodPrimary,
                secondary: input.methodSecondary ?? [],
              };
            })()
          : null;
        return result('trace-append', appendTraceWithProjection(root, {
          lessonPath: context.ownerPath,
          blockId: input.blockId,
          cardAlias: input.cardAlias ?? null,
          cardStepId: null,
          materialPath: input.materialPath ?? null,
          methods,
          assessment: input.assessment,
          support: input.support,
          note: input.note,
          supersedes: input.supersedes ?? null,
        }, now));
      },
    }),
    defineTool({
      name: 'source_resolve',
      label: '核验来源',
      description: 'Resolve a learning-set-local source and optional fragment.',
      parameters: Type.Object({ fromPath: Type.String(), target: Type.String() }),
      execute: async (_id, input) => result('source-resolve', sourceResolve(root, input)),
    }),
  ];
}
