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
import { lessonBlockIdSchema } from './lesson-tool-contracts';
import {
  roleForNode,
  type NodeSessionScope,
} from './session-scope';

function result(kind: string, value: object) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind, value },
  };
}

export type StudyToolContext = NodeSessionScope;

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
  if (active.length === 0) {
    if (supersedes !== undefined) {
      throw new Error(
        `TRACE_SUPERSEDES_WITHOUT_ACTIVE_ATTEMPT: block=${blockId}; `
        + `requested=${supersedes}`,
      );
    }
    return;
  }
  if (active.length > 1) {
    throw new Error(
      `TRACE_ATTEMPT_ACTIVE_CONFLICT: block=${blockId}; `
      + `active=${active.map((record) => record.traceId).join(',')}`,
    );
  }
  if (supersedes === active[0]!.traceId) return;
  throw new Error(
    `TRACE_ATTEMPT_ALREADY_ACTIVE: block=${blockId}; `
    + `active=${active[0]!.traceId}; `
    + '同一 problem Block 只表示一次独立作答。补全、更正或方法确认必须 '
    + 'supersede 当前 active Trace；另一题问需要新的 problem Block',
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
      description: 'Search only real problem cards in the current learning set. Use for preparation or private route verification, not to manufacture a missing exercise. Every returned card includes its complete active Trace history; an empty cards array is a valid result.',
      parameters: Type.Object({
        query: Type.String({
          description: 'Natural-language topic, method, goal, title, or source text used to rank authentic cards.',
        }),
        limit: Type.Integer({
          minimum: 1,
          maximum: 20,
          description: 'Maximum number of card candidates; it never truncates one returned card\'s active Trace history.',
        }),
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
      description: 'Search active, non-superseded classroom Trace and reverse-resolve the unique real cards it cites. Use when the evidence question starts from a Plan, Lesson, card, or remembered classroom detail; combine optional scopes to narrow the result.',
      parameters: Type.Object({
        query: Type.Optional(Type.String({
          description: 'Optional text matched against active Trace evidence.',
        })),
        planId: Type.Optional(Type.String({
          description: 'Optional exact Plan ID scope.',
        })),
        lessonId: Type.Optional(Type.String({
          description: 'Optional exact Lesson ID scope.',
        })),
        cardPath: Type.Optional(Type.String({
          description: 'Optional exact learning-set-relative card path for card-to-Trace lookup.',
        })),
        occurredAfter: Type.Optional(Type.String({
          description: 'Optional inclusive ISO timestamp lower bound.',
        })),
        occurredBefore: Type.Optional(Type.String({
          description: 'Optional inclusive ISO timestamp upper bound.',
        })),
        limit: Type.Integer({
          minimum: 1,
          maximum: 100,
          description: 'Maximum number of active Trace records returned.',
        }),
      }),
      execute: async (_id, input) => {
        const value = searchTraces(root, {
          query: input.query ?? null,
          planId: input.planId ?? null,
          lessonId: input.lessonId ?? null,
          cardPath: input.cardPath ?? null,
          occurredAfter: input.occurredAfter ?? null,
          occurredBefore: input.occurredBefore ?? null,
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
      description: 'Resolve and verify one learning-set-local source reference, optionally including a fragment. Use before relying on a relative file, heading, or card-step citation. The result reports the canonical path, fragment, and validity without changing files.',
      parameters: Type.Object({
        fromPath: Type.String({
          description: 'Learning-set-relative path of the file that contains or is making the reference.',
        }),
        target: Type.String({
          description: 'Relative or learning-set-local source target, optionally followed by a fragment.',
        }),
      }),
      execute: async (_id, input) => result('source-resolve', sourceResolve(root, input)),
    }),
  ];
}

export function createStudyTools(
  root: string,
  now: () => Date,
  context: StudyToolContext,
): ToolDefinition[] {
  const role = roleForNode(context.nodeKind);
  const ownerPath = context.nodePath;
  const methodName = Type.Enum(listCanonicalMethodNames(root), {
    description: 'Exact canonical method name from the current learning-set graph.',
  });
  const readOnly = createReadOnlyStudyTools(root, {
    compactCardPayloads: role === 'coach',
  });
  return [
    readOnly[0]!,
    readOnly[1]!,
    defineTool({
      name: 'trace_append',
      label: '记录课堂证据',
      description: 'Append or supersede one validated classroom-evidence Trace for the current Tutor Session-owned Lesson. Call when an evidence-bearing response, later completion, accepted correction, repeat, or student-confirmed method changes the active record for one Block attempt. The runtime derives Lesson and problem-card identity from the Session and Block, rejects parallel active attempts, refreshes projections, and returns the persisted fact receipt.',
      parameters: Type.Object({
        blockId: role === 'tutor'
          ? lessonBlockIdSchema(root, ownerPath)
          : Type.String({
            description: 'Exact current Lesson Block ID whose activity produced this evidence.',
          }),
        materialPath: Type.Optional(Type.String({
          description: 'Learning-set-relative source path when the evidence came from material rather than the Block\'s problem card.',
        })),
        methodStatus: Type.Union([
          Type.Literal('unmapped'),
          Type.Literal('student_confirmed'),
        ], {
          description: 'Use student_confirmed only after the student explicitly accepts one exact canonical node for this route; otherwise preserve the route as unmapped.',
        }),
        methodRoute: Type.String({
          minLength: 1,
          description: 'Plain-language account of the decisive route the student actually used, independent of any canonical label.',
        }),
        methodPrimary: Type.Optional(methodName),
        methodSecondary: Type.Optional(Type.Array(methodName, {
          description: 'Additional student-confirmed canonical nodes actually used by this route.',
        })),
        methodDecisiveStep: Type.Optional(Type.String({
          minLength: 1,
          description: 'Student-produced step that justifies the confirmed canonical method binding.',
        })),
        methodConfirmation: Type.Optional(Type.String({
          minLength: 1,
          description: 'Brief record of the student turn that confirmed the canonical method binding.',
        })),
        assessment: Type.Union([
          Type.Literal('correct'),
          Type.Literal('partially_correct'),
          Type.Literal('incorrect'),
          Type.Literal('incomplete'),
        ], {
          description: 'Mathematical completeness of the student\'s own frozen work. Missing decisive reasoning is incomplete; Tutor-generated completion cannot make the same attempt correct.',
        }),
        support: Type.Union([
          Type.Literal('none'),
          Type.Literal('tutor'),
          Type.Literal('external'),
        ], {
          description: 'Help actually used in the final route: none for independent work, tutor when Tutor-origin decisive content shaped the route, and external for other used help. Mere exposure or unused repetition is not dependence.',
        }),
        note: Type.String({
          description: 'Concise source-linked evidence note identifying the exact student-supplied claim behind the assessment and distinguishing any Tutor contribution or retracted Tutor judgment from student work. Predicted failures are not observed evidence.',
        }),
        supersedes: Type.Optional(Type.String({
          description: 'Exact active Trace ID replaced by a completion, correction, repeat, or method confirmation for this same Block attempt. A different independently judged question requires a different problem Block.',
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
        const cardAlias = cardAliasForBlock(root, ownerPath, input.blockId);
        assertProblemAttemptBoundary(
          root,
          ownerPath,
          input.blockId,
          cardAlias,
          input.supersedes,
        );
        const trace = appendTraceWithProjection(root, {
          lessonPath: ownerPath,
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
          ownerPath,
          factId: trace.traceId,
          ...trace,
        });
      },
    }),
    readOnly[2]!,
  ];
}
