import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { searchCards } from '../cards';
import { appendTraceWithProjection } from '../planner-attention';
import { sourceResolve } from '../sources';
import { searchTraces } from '../trace-search';

export type StudyMcpDependencies = {
  learningSetRoot: string;
  now: () => Date;
};

const output = <T extends object>(value: T) => ({
  content: [{ type: 'text' as const, text: JSON.stringify(value) }],
  structuredContent: value as Record<string, unknown>,
});

const cardSearchInput = z.object({
  query: z.string(),
  limit: z.number().int().min(1).max(20),
}).strict();

const traceSearchInput = z.object({
  query: z.string().optional(),
  planId: z.string().optional(),
  lessonId: z.string().optional(),
  cardPath: z.string().optional(),
  limit: z.number().int().min(1).max(100),
}).strict();

const traceAppendInput = z.object({
  lessonPath: z.string(),
  blockId: z.string(),
  cardAlias: z.string().nullable(),
  cardStepId: z.string().nullable(),
  materialPath: z.string().nullable(),
  assessment: z.enum(['correct', 'partially_correct', 'incorrect', 'incomplete']),
  support: z.enum(['none', 'tutor', 'external']),
  methods: z.object({
    primary: z.string(),
    secondary: z.array(z.string()).optional(),
  }).strict().optional(),
  note: z.string(),
  supersedes: z.string().nullable(),
}).strict();

const sourceResolveInput = z.object({
  fromPath: z.string(),
  target: z.string(),
}).strict();

export function registerStudyTools(server: McpServer, deps: StudyMcpDependencies): void {
  server.registerTool('card_search', {
    description: 'Search real problem cards with complete active Trace history',
    inputSchema: cardSearchInput,
  }, async (input) => output(searchCards(deps.learningSetRoot, input)));

  server.registerTool('trace_search', {
    description: 'Search active Trace and reverse-resolve its unique problem cards',
    inputSchema: traceSearchInput,
  }, async (input) => output(searchTraces(deps.learningSetRoot, {
    query: input.query ?? null,
    planId: input.planId ?? null,
    lessonId: input.lessonId ?? null,
    cardPath: input.cardPath ?? null,
    limit: input.limit,
  })));

  server.registerTool('trace_append', {
    description: 'Append one validated evidence Trace to its owning Lesson',
    inputSchema: traceAppendInput,
  }, async (input) => {
    const trace = appendTraceWithProjection(deps.learningSetRoot, input, deps.now);
    return output({
      ok: true,
      ownerPath: trace.lessonPath,
      factId: trace.eventId,
      ...trace,
    });
  });

  server.registerTool('source_resolve', {
    description: 'Resolve a learning-set source and optional fragment',
    inputSchema: sourceResolveInput,
  }, async (input) => output(sourceResolve(deps.learningSetRoot, input)));
}
