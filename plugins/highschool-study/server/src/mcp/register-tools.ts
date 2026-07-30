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
  query: z.string().describe(
    'Natural-language topic, method, goal, title, or source text used to rank authentic cards.',
  ),
  limit: z.number().int().min(1).max(20).describe(
    'Maximum card candidates; one returned card still includes its complete active Trace history.',
  ),
}).strict();

const traceSearchInput = z.object({
  query: z.string().optional().describe(
    'Optional text matched against active, non-superseded Trace.',
  ),
  planId: z.string().optional().describe('Optional exact Plan ID scope.'),
  lessonId: z.string().optional().describe('Optional exact Lesson ID scope.'),
  cardPath: z.string().optional().describe(
    'Optional exact learning-set-relative card path for card-to-Trace lookup.',
  ),
  occurredAfter: z.iso.datetime().optional().describe(
    'Optional inclusive lower ISO timestamp boundary.',
  ),
  occurredBefore: z.iso.datetime().optional().describe(
    'Optional inclusive upper ISO timestamp boundary.',
  ),
  limit: z.number().int().min(1).max(100).describe(
    'Maximum number of active Trace records returned.',
  ),
}).strict();

const traceAppendInput = z.object({
  lessonPath: z.string().describe(
    'Exact learning-set-relative Lesson path that owns this classroom event.',
  ),
  blockId: z.string().describe(
    'Exact Lesson Block ID whose activity produced the evidence.',
  ),
  cardAlias: z.string().nullable().describe(
    'Exact alias declared by that Lesson, or null only for evidence not bound to a problem card.',
  ),
  cardStepId: z.string().nullable().describe(
    'Exact stable step ID on the resolved card, or null when the event is not step-specific.',
  ),
  materialPath: z.string().nullable().describe(
    'Learning-set-relative material source for non-card evidence, otherwise null.',
  ),
  assessment: z.enum([
    'correct',
    'partially_correct',
    'incorrect',
    'incomplete',
  ]).describe(
    'Completeness of the student-authored evidence; Tutor-generated work cannot upgrade the same attempt.',
  ),
  support: z.enum(['none', 'tutor', 'external']).describe(
    'Help actually used in the final route, not mere exposure to a hint.',
  ),
  methods: z.object({
    primary: z.string().describe(
      'Student-confirmed canonical primary method actually used.',
    ),
    secondary: z.array(z.string()).optional().describe(
      'Student-confirmed canonical secondary methods actually used.',
    ),
  }).strict().optional().describe(
    'Confirmed method evidence; omit when no exact canonical binding has been confirmed.',
  ),
  note: z.string().describe(
    'Concise source-linked account identifying the exact student-supplied claim behind the assessment and separating Tutor contributions or retracted Tutor judgments from student work. Predicted failures are not observed evidence.',
  ),
  supersedes: z.string().nullable().describe(
    'Exact earlier Trace ID corrected or replaced within the same Lesson and Block, otherwise null.',
  ),
}).strict();

const sourceResolveInput = z.object({
  fromPath: z.string().describe(
    'Learning-set-relative path of the file making the reference.',
  ),
  target: z.string().describe(
    'Relative or learning-set-local source target, optionally including a fragment.',
  ),
}).strict();

export function registerStudyTools(server: McpServer, deps: StudyMcpDependencies): void {
  server.registerTool('card_search', {
    description: 'Search only real problem cards in the current learning set. Use for preparation or private route verification. Every card includes its complete active Trace history; an empty result is valid and must not be replaced with an invented card.',
    inputSchema: cardSearchInput,
  }, async (input) => output(searchCards(deps.learningSetRoot, input)));

  server.registerTool('trace_search', {
    description: 'Search active, non-superseded classroom Trace by optional Plan, Lesson, card, and text scopes, then reverse-resolve the unique authentic cards cited by the result.',
    inputSchema: traceSearchInput,
  }, async (input) => output(searchTraces(deps.learningSetRoot, {
    query: input.query ?? null,
    planId: input.planId ?? null,
    lessonId: input.lessonId ?? null,
    cardPath: input.cardPath ?? null,
    occurredAfter: input.occurredAfter ?? null,
    occurredBefore: input.occurredBefore ?? null,
    limit: input.limit,
  })));

  server.registerTool('trace_append', {
    description: 'Append one validated evidence Trace to an explicit real Lesson. Use for an evidence-bearing activity or a later correction that supersedes an earlier event; runtime validation checks Lesson, Block, aliases, card steps, and provenance before returning the persisted fact.',
    inputSchema: traceAppendInput,
  }, async (input) => {
    const trace = appendTraceWithProjection(deps.learningSetRoot, input, deps.now);
    return output({
      ok: true,
      ownerPath: trace.lessonPath,
      factId: trace.traceId,
      sourceRef: trace.sourceRef,
    });
  });

  server.registerTool('source_resolve', {
    description: 'Resolve and verify one learning-set-local source target or fragment relative to the file that cites it. This is read-only and returns canonical validity information.',
    inputSchema: sourceResolveInput,
  }, async (input) => output(sourceResolve(deps.learningSetRoot, input)));
}
