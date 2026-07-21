import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  appendTrace,
  searchCards,
  searchTraces,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';

function result(kind: string, value: object) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind, value },
  };
}

export function createStudyTools(root: string, now: () => Date): ToolDefinition[] {
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
        lessonPath: Type.String(),
        blockId: Type.String(),
        cardAlias: Type.Union([Type.String(), Type.Null()]),
        cardStepId: Type.Union([Type.String(), Type.Null()]),
        materialPath: Type.Union([Type.String(), Type.Null()]),
        assessment: Type.Union([
          Type.Literal('correct'),
          Type.Literal('partially_correct'),
          Type.Literal('incorrect'),
          Type.Literal('incomplete'),
        ]),
        support: Type.Union([
          Type.Literal('none'),
          Type.Literal('tutor'),
          Type.Literal('external'),
        ]),
        note: Type.String(),
        supersedes: Type.Union([Type.String(), Type.Null()]),
      }),
      execute: async (_id, input) => result('trace-append', appendTrace(root, input, now)),
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
