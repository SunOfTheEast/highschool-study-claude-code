import { Type } from '@earendil-works/pi-ai';
import { defineTool, type SessionEntry } from '@earendil-works/pi-coding-agent';
import {
  planLearningNoteSave,
  planProblemCardSave,
  type LearningNoteBlock,
} from '../study/learning-assets';
import type {
  LearningSourceReference,
  SemanticTagDraft,
} from '../shared/contracts';
import { refreshSemanticRecallIndex } from '../study/semantic-index';
import { commitDocumentCandidates } from './multi-document-transaction';

export type LearningAssetToolSession = {
  getSessionId(): string;
  getBranch(): readonly SessionEntry[];
};

export type LearningAssetSourceBinding = {
  resolve(aliases: readonly string[]): LearningSourceReference[];
};

const stableId = Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$' });
const sourceAlias = Type.String({ pattern: '^source-[1-9][0-9]*$' });
const semanticTag = Type.String({ minLength: 1, maxLength: 40, pattern: '^[^\\r\\n\\t]+$' });
const semanticTags = Type.Object({
  core: Type.Array(semanticTag, { minItems: 1, uniqueItems: true }),
  related: Type.Array(semanticTag, { uniqueItems: true }),
}, { additionalProperties: false });
const target = Type.Object({
  id: stableId,
  expectedRevision: Type.Integer({ minimum: 1 }),
}, { additionalProperties: false });

const markdownBlock = Type.Object({
  kind: Type.Literal('markdown'),
  body: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

const recallBlock = Type.Object({
  kind: Type.Literal('recall'),
  prompt: Type.String({ minLength: 1 }),
  answer: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

const noteContentParameters = {
  title: Type.String({ minLength: 1 }),
  blocks: Type.Array(Type.Union([markdownBlock, recallBlock]), { minItems: 1 }),
  sourceAliases: Type.Array(sourceAlias, { uniqueItems: true }),
};

const noteParameters = Type.Union([
  Type.Object({ ...noteContentParameters, tags: semanticTags }, { additionalProperties: false }),
  Type.Object({
    ...noteContentParameters,
    target,
    expectedTagRevision: Type.Optional(Type.Integer({ minimum: 1 })),
    tags: semanticTags,
  }, { additionalProperties: false }),
  Type.Object({ ...noteContentParameters, target }, { additionalProperties: false }),
]);

const cardContentParameters = {
  stem: Type.String({ minLength: 1 }),
  standardAnswer: Type.String({ minLength: 1 }),
  teacherRationale: Type.String({ minLength: 1 }),
  studentNote: Type.String(),
  sourceAliases: Type.Array(sourceAlias, { uniqueItems: true }),
};

const cardParameters = Type.Union([
  Type.Object({ ...cardContentParameters, tags: semanticTags }, { additionalProperties: false }),
  Type.Object({
    ...cardContentParameters,
    target,
    expectedTagRevision: Type.Optional(Type.Integer({ minimum: 1 })),
    tags: semanticTags,
  }, { additionalProperties: false }),
  Type.Object({ ...cardContentParameters, target }, { additionalProperties: false }),
]);

function assetRoute(kind: 'note' | 'problem-card', id: string): string {
  const collection = kind === 'note' ? 'notes' : 'problem-cards';
  return `/assets/${collection}/${encodeURIComponent(id)}`;
}

function toolResult(
  value: Record<string, unknown>,
  asset: {
    kind: 'note' | 'problem-card';
    id: string;
    revision: number;
    title: string;
  },
  reviewEnrolled: boolean,
) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: {
      kind: 'learning-asset-save' as const,
      version: 1 as const,
      reviewEnrolled,
      asset: {
        ...asset,
        route: assetRoute(asset.kind, asset.id),
      },
    },
  };
}

function refreshWarning(root: string): string | undefined {
  try {
    refreshSemanticRecallIndex(root);
    return undefined;
  } catch (error) {
    return `RECALL_INDEX_REFRESH_FAILED: ${error instanceof Error ? error.message : String(error)}`;
  }
}

export function createLearningAssetTools(
  root: string,
  binding: LearningAssetSourceBinding,
  session: LearningAssetToolSession,
) {
  const successful = new Map<string, ReturnType<typeof toolResult>>();
  return [
    defineTool({
      name: 'save_note',
      label: '保存学习笔记',
      description: 'Create or revise one Note only after the student has seen the proposed content and explicitly approved saving it. Flashcards are recall blocks inside a Note.',
      executionMode: 'sequential',
      parameters: noteParameters,
      execute: async (toolCallId, input) => {
        const replay = successful.get(toolCallId);
        if (replay) return replay;
        const inputTarget = 'target' in input ? input.target : undefined;
        const inputExpectedTagRevision = 'expectedTagRevision' in input
          ? input.expectedTagRevision
          : undefined;
        const planned = planLearningNoteSave(root, session.getSessionId(), {
          ...(inputTarget ? { target: inputTarget } : {}),
          ...(inputExpectedTagRevision === undefined
            ? {}
            : { expectedTagRevision: inputExpectedTagRevision }),
          title: input.title,
          blocks: input.blocks as LearningNoteBlock[],
          sources: binding.resolve(input.sourceAliases),
          ...('tags' in input ? { tags: input.tags as SemanticTagDraft } : {}),
        }, new Date().toISOString());
        const committed = commitDocumentCandidates(root, planned.candidates);
        const warning = refreshWarning(root);
        const result = toolResult({
          ok: true,
          asset: planned.receipt,
          commitId: committed.commitId,
          changedPaths: committed.changedPaths,
          ...(warning ? { warning } : {}),
        }, {
          kind: 'note',
          id: planned.note.id,
          revision: planned.note.revision,
          title: planned.note.title,
        }, inputTarget === undefined);
        successful.set(toolCallId, result);
        return result;
      },
    }),
    defineTool({
      name: 'save_problem_card',
      label: '保存题卡',
      description: 'Create or revise one canonical problem card only after the student has seen its public stem and note proposal and explicitly approved saving that proposal.',
      executionMode: 'sequential',
      parameters: cardParameters,
      execute: async (toolCallId, input) => {
        const replay = successful.get(toolCallId);
        if (replay) return replay;
        const inputTarget = 'target' in input ? input.target : undefined;
        const inputExpectedTagRevision = 'expectedTagRevision' in input
          ? input.expectedTagRevision
          : undefined;
        const planned = planProblemCardSave(root, session.getSessionId(), {
          ...(inputTarget ? { target: inputTarget } : {}),
          ...(inputExpectedTagRevision === undefined
            ? {}
            : { expectedTagRevision: inputExpectedTagRevision }),
          stem: input.stem,
          standardAnswer: input.standardAnswer,
          teacherRationale: input.teacherRationale,
          studentNote: input.studentNote,
          sources: binding.resolve(input.sourceAliases),
          ...('tags' in input ? { tags: input.tags as SemanticTagDraft } : {}),
        }, new Date().toISOString());
        const committed = commitDocumentCandidates(root, planned.candidates);
        const warning = refreshWarning(root);
        const result = toolResult({
          ok: true,
          asset: planned.receipt,
          commitId: committed.commitId,
          changedPaths: committed.changedPaths,
          ...(warning ? { warning } : {}),
        }, {
          kind: 'problem-card',
          id: planned.card.id,
          revision: planned.card.revision,
          title: planned.card.title,
        }, inputTarget === undefined);
        successful.set(toolCallId, result);
        return result;
      },
    }),
  ];
}
