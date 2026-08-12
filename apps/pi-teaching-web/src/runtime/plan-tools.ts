import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { SemanticTagDraft } from '../shared/contracts';
import { formatLessonHandoutPath } from '../shared/handout-route';
import { planProblemCardSave } from '../study/learning-assets';
import { readLessonHandout } from '../study/lesson-handout';
import { parseLessonSource, readLesson, readPlan } from '../study/markdown';
import { lessonNodePath } from '../study/node-paths';
import { refreshSemanticRecallIndex } from '../study/semantic-index';
import type { LearningAssetToolSession } from './learning-asset-tools';
import {
  commitDocumentCandidates,
  type DocumentCandidate,
} from './multi-document-transaction';
import type { NodeSessionScope } from './session-scope';
import { createPlanMemoryTools } from './memory-tools';
import { createNodeFinishTool } from './node-finish-tools';
import { createPlanProblemCardProposalTool } from './learning-asset-proposal-tools';
import { createCalendarTools, type CalendarRepository } from './calendar-tools';
import { createAssetReviewCandidateQueryTool } from './asset-review-tools';

const nodeId = Type.String({
  pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
});

const semanticTag = Type.String({ minLength: 1, maxLength: 40, pattern: '^[^\\r\\n\\t]+$' });
const preparedCardParameters = Type.Object({
  lessonId: nodeId,
  blockId: nodeId,
  stem: Type.String({ minLength: 1 }),
  standardAnswer: Type.String({ minLength: 1 }),
  teacherRationale: Type.String({ minLength: 1 }),
  studentNote: Type.String(),
  tags: Type.Object({
    core: Type.Array(semanticTag, { minItems: 1, uniqueItems: true }),
    related: Type.Array(semanticTag, { uniqueItems: true }),
  }, { additionalProperties: false }),
}, { additionalProperties: false });

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function appendPreparedUse(
  path: string,
  source: string,
  blockId: string,
  cardPath: string,
): string {
  const before = parseLessonSource(path, source);
  if (before.status !== 'prepared') {
    throw new Error(`Lesson must be prepared, found ${before.status}`);
  }
  const block = before.blocks.find((candidate) => candidate.id === blockId);
  if (!block) throw new Error(`PREPARED_CARD_BLOCK_NOT_FOUND: ${blockId}`);
  if (block.kind !== 'problem') throw new Error(`PREPARED_CARD_BLOCK_NOT_PROBLEM: ${blockId}`);
  if (block.uses.includes(cardPath)) return source;

  const heading = new RegExp(
    `^## Block ${escapeRegExp(blockId)}(?:[ \\t]*[：:][ \\t]*.+)?[ \\t]*$`,
    'm',
  ).exec(source);
  if (!heading) throw new Error(`PREPARED_CARD_BLOCK_NOT_FOUND: ${blockId}`);
  const tailStart = heading.index + heading[0].length;
  const next = /^##\s+/m.exec(source.slice(tailStart));
  const end = next ? tailStart + next.index : source.length;
  const blockSource = source.slice(heading.index, end);
  const uses = /^- Uses:[ \t]*(.*?)[ \t]*$/m.exec(blockSource);
  if (!uses || uses.index === undefined) throw new Error(`PREPARED_CARD_USES_INVALID: ${blockId}`);
  const values = block.uses.length === 0 ? cardPath : `${block.uses.join(', ')}, ${cardPath}`;
  const start = heading.index + uses.index;
  const candidate = `${source.slice(0, start)}- Uses: ${values}${
    source.slice(start + uses[0].length)
  }`;
  const after = parseLessonSource(path, candidate);
  const updated = after.blocks.find((item) => item.id === blockId);
  if (!updated || !updated.uses.includes(cardPath)) {
    throw new Error(`PREPARED_CARD_ATTACH_FAILED: ${blockId}`);
  }
  return candidate;
}

function lessonCandidate(
  root: string,
  scope: NodeSessionScope,
  lessonId: string,
  blockId: string,
  cardPath: string,
): DocumentCandidate {
  const plan = readPlan(root, scope.nodePath);
  const reference = plan.lessons.find((item) => item.id === lessonId);
  const expectedPath = lessonNodePath(scope.nodeId, lessonId);
  if (!reference || reference.path !== expectedPath) {
    throw new Error(`Lesson is not linked by current Plan: ${lessonId}`);
  }
  const lesson = readLesson(root, reference.path);
  if (
    lesson.id !== lessonId
    || lesson.parentId !== scope.nodeId
    || lesson.parentPath !== scope.nodePath
  ) {
    throw new Error(`PREPARED_CARD_LESSON_BOUNDARY_INVALID: ${lessonId}`);
  }
  const after = appendPreparedUse(reference.path, lesson.raw, blockId, cardPath);
  return {
    path: reference.path,
    before: lesson.raw,
    after,
    validate: (source) => {
      const parsed = parseLessonSource(reference.path, source);
      if (parsed.status !== 'prepared') throw new Error(`Lesson must be prepared, found ${parsed.status}`);
    },
  };
}

function result(value: Record<string, unknown>, kind: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind },
  };
}

export function createPlanTools(
  root: string,
  scope: NodeSessionScope,
  session?: LearningAssetToolSession,
  calendar?: CalendarRepository,
) {
  const exportTool = defineTool({
    name: 'artifact_export',
    label: '整理可打印讲义',
    description: 'Publish selected Student View Blocks from one prepared Lesson owned by this Plan.',
    executionMode: 'sequential',
    parameters: Type.Object({
      kind: Type.Literal('lesson-handout'),
      lessonId: nodeId,
      blockIds: Type.Array(nodeId, {
        minItems: 1,
        uniqueItems: true,
      }),
    }, { additionalProperties: false }),
    execute: async (_toolCallId, { lessonId, blockIds }) => {
      const handout = readLessonHandout(
        root,
        scope.nodeId,
        lessonId,
        blockIds,
        { requirePrepared: true },
      );
      const details = {
        kind: 'lesson-handout' as const,
        planId: scope.nodeId,
        lessonId,
        blockIds: [...blockIds],
        title: handout.title,
        url: formatLessonHandoutPath(scope.nodeId, lessonId, blockIds),
      };
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: true, title: details.title, url: details.url }),
        }],
        details,
      };
    },
  });

  const successful = new Map<string, ReturnType<typeof result>>();
  const savePreparedCard = session ? defineTool({
    name: 'save_prepared_problem_card',
    label: '保存备课中的自编题卡',
    description: 'After the prepared Lesson is fully delivered, persist one teacher-authored problem card that the student separately approved and attach it to one exact problem Block.',
    executionMode: 'sequential',
    parameters: preparedCardParameters,
    execute: async (toolCallId, input) => {
      const replay = successful.get(toolCallId);
      if (replay) return replay;
      const planned = planProblemCardSave(root, session.getSessionId(), {
        stem: input.stem,
        standardAnswer: input.standardAnswer,
        teacherRationale: input.teacherRationale,
        studentNote: input.studentNote,
        sources: [],
        tags: input.tags as SemanticTagDraft,
      }, new Date().toISOString());
      const attached = lessonCandidate(
        root,
        scope,
        input.lessonId,
        input.blockId,
        planned.receipt.path,
      );
      const committed = commitDocumentCandidates(root, [...planned.candidates, attached]);
      let warning: string | undefined;
      try {
        refreshSemanticRecallIndex(root);
      } catch (error) {
        warning = `RECALL_INDEX_REFRESH_FAILED: ${error instanceof Error ? error.message : String(error)}`;
      }
      const receipt = {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({
          ok: true,
          asset: planned.receipt,
          lesson: { id: input.lessonId, blockId: input.blockId, path: attached.path },
          commitId: committed.commitId,
          changedPaths: committed.changedPaths,
          ...(warning ? { warning } : {}),
          }),
        }],
        details: {
          kind: 'learning-asset-save' as const,
          version: 1 as const,
          reviewEnrolled: true,
          asset: {
            kind: 'problem-card' as const,
            id: planned.card.id,
            revision: planned.card.revision,
            title: planned.card.title,
            route: `/assets/problem-cards/${encodeURIComponent(planned.card.id)}`,
          },
        },
      };
      successful.set(toolCallId, receipt);
      return receipt;
    },
  }) : null;

  return [
    exportTool,
    createAssetReviewCandidateQueryTool(root),
    createPlanProblemCardProposalTool(),
    ...(savePreparedCard ? [savePreparedCard] : []),
    ...createPlanMemoryTools(root),
    ...(calendar ? createCalendarTools(calendar, root, scope) : []),
    createNodeFinishTool(root, 'plan', scope.nodePath),
  ];
}
