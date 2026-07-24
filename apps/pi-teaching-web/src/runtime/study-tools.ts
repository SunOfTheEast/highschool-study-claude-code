import { defineTool, type ToolDefinition } from '@earendil-works/pi-coding-agent';
import {
  appendTraceWithProjection,
  listCanonicalMethodNames,
  readActiveTraces,
  readMarkdownFile,
  searchCards,
  searchTraces,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';
import { readPreparedLessonBlocks } from '../study/validate-prepared-lesson';
import type { StudySessionScope } from './session-scope';

function result(kind: string, value: object) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind, value },
  };
}

export type StudyToolContext = StudySessionScope;

export type ReadOnlyStudyToolOptions = {
  compactCardPayloads?: boolean;
};

type SearchCard = ReturnType<typeof searchCards>['cards'][number];

function compactCard(card: SearchCard) {
  return {
    path: card.path,
    title: card.title,
    goal: card.goal,
    methods: card.methods,
    traceHistory: card.traceHistory,
  };
}

function cardAliasForBlock(
  root: string,
  lessonPath: string,
  blockId: string,
): string | null {
  const lesson = readMarkdownFile(root, lessonPath);
  const block = readPreparedLessonBlocks(lesson.body)
    .find((candidate) => candidate.id === blockId);
  if (block?.kind !== 'problem') return null;
  if (block.uses.length !== 1) {
    throw new Error(
      `LESSON_PROBLEM_CARD_COUNT: block=${blockId}; count=${block.uses.length}; `
      + '请返回 Coach 修正源文件',
    );
  }
  return block.uses[0]!;
}

function assertProblemAttemptBoundary(
  root: string,
  lessonPath: string,
  blockId: string,
  cardAlias: string | null,
  supersedes: string | undefined,
): void {
  if (cardAlias === null) return;
  const active = readActiveTraces(root, [lessonPath])
    .filter((record) => record.blockId === blockId);
  if (active.length === 0 || active.some((record) => record.eventId === supersedes)) return;
  throw new Error(
    `TRACE_ATTEMPT_ALREADY_ACTIVE: block=${blockId}; `
    + `active=${active.map((record) => record.eventId).join(',')}; `
    + '同一 problem Block 只表示一次独立作答。若是本次作答的补全或更正，'
    + '请用 supersedes 修订当前 active Trace；若是另一题问，请返回 Coach 创建新的 problem Block',
  );
}

export function createReadOnlyStudyTools(
  root: string,
  options: ReadOnlyStudyToolOptions = {},
): ToolDefinition[] {
  return [
    defineTool({
      name: 'card_search',
      label: '搜索真实题卡',
      description: 'Search real problem cards and include every card\'s complete active Trace history.',
      parameters: Type.Object({
        query: Type.String(),
        limit: Type.Integer({ minimum: 1, maximum: 20 }),
      }),
      execute: async (_id, input) => {
        const value = searchCards(root, input);
        return result('card-search', options.compactCardPayloads
          ? { cards: value.cards.map(compactCard) }
          : value);
      },
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
      execute: async (_id, input) => {
        const value = searchTraces(root, {
          query: input.query ?? null,
          planId: input.planId ?? null,
          lessonId: input.lessonId ?? null,
          cardPath: input.cardPath ?? null,
          limit: input.limit,
        });
        return result('trace-search', options.compactCardPayloads
          ? {
              traces: value.traces,
              cardsByPath: Object.fromEntries(
                Object.entries(value.cardsByPath).map(([path, card]) => [
                  path,
                  compactCard(card),
                ]),
              ),
            }
          : value);
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

export function createStudyTools(
  root: string,
  now: () => Date,
  context: StudyToolContext,
): ToolDefinition[] {
  const methodName = Type.Enum(listCanonicalMethodNames(root));
  const readOnly = createReadOnlyStudyTools(root);
  return [
    readOnly[0]!,
    readOnly[1]!,
    defineTool({
      name: 'trace_append',
      label: '记录课堂证据',
      description: 'Append one validated Trace to its owning Lesson.',
      parameters: Type.Object({
        blockId: Type.String(),
        materialPath: Type.Optional(Type.String()),
        methodStatus: Type.Union([
          Type.Literal('unmapped'),
          Type.Literal('student_confirmed'),
        ], {
          description: 'Use student_confirmed only after an explicit student confirmation turn. The same call must include methodPrimary, methodDecisiveStep and methodConfirmation; otherwise use unmapped.',
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
          description: 'Required whenever the same card-and-Block attempt already has an active Trace, including later completion, correction or method confirmation. Set it to that exact active event ID. A different question or part requires a different problem Block.',
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
        const cardAlias = cardAliasForBlock(root, context.ownerPath, input.blockId);
        assertProblemAttemptBoundary(
          root,
          context.ownerPath,
          input.blockId,
          cardAlias,
          input.supersedes,
        );
        const trace = appendTraceWithProjection(root, {
          lessonPath: context.ownerPath,
          blockId: input.blockId,
          cardAlias,
          cardStepId: null,
          materialPath: input.materialPath ?? null,
          methods,
          assessment: input.assessment,
          support: input.support,
          note: input.note,
          supersedes: input.supersedes ?? null,
        }, now);
        return result('trace-append', {
          ok: true,
          ownerPath: context.ownerPath,
          factId: trace.eventId,
          ...trace,
        });
      },
    }),
    readOnly[2]!,
  ];
}
