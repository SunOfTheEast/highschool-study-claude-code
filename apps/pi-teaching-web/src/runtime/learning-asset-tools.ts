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

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.flatMap((item) => {
    if (!item || typeof item !== 'object' || Array.isArray(item)) return [];
    const value = item as Record<string, unknown>;
    return value.type === 'text' && typeof value.text === 'string' ? [value.text] : [];
  }).join('');
}

function dialogueMessages(entries: readonly SessionEntry[]): Array<{
  role: 'user' | 'assistant';
  text: string;
}> {
  return entries.flatMap((entry) => {
    if (entry.type !== 'message') return [];
    const message = entry.message as unknown as Record<string, unknown>;
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    return [{
      role: message.role as 'user' | 'assistant',
      text: contentText(message.content).trim(),
    }];
  }).filter((message) => message.text.length > 0);
}

function saveWords(kind: 'note' | 'problem-card'): RegExp {
  return kind === 'note'
    ? /(笔记|闪卡|记忆卡|note|flashcard)/i
    : /(题卡|卡片|这道题|problem\s*card)/i;
}

function proposesSave(text: string, kind: 'note' | 'problem-card'): boolean {
  return /(保存|存下|存一?下|记下|做成|整理成|留作)/i.test(text) && saveWords(kind).test(text);
}

function refusesSave(text: string): boolean {
  return /(不保存|不要保存|先别保存|暂不保存|不用保存|别存|不做成|不要做成)/i.test(text);
}

function startsWithAffirmation(text: string): boolean {
  return /^(?:嗯+|可以|好(?:的)?|行|确认|同意|存吧|保存吧|就这样)(?=$|[，。！？!?、,.\s]|建立|创建|保存|存下|按|这)/i
    .test(text.trim());
}

export function latestStudentApprovedAssetSave(
  entries: readonly SessionEntry[],
  kind: 'note' | 'problem-card',
): boolean {
  const messages = dialogueMessages(entries);
  const latestUserIndex = messages.findLastIndex((message) => message.role === 'user');
  if (latestUserIndex < 0) return false;
  const latest = messages[latestUserIndex]!.text.trim();
  if (refusesSave(latest)) return false;
  if (proposesSave(latest, kind)) return true;

  if (!startsWithAffirmation(latest)) return false;
  const previousAssistant = [...messages.slice(0, latestUserIndex)]
    .reverse()
    .find((message) => message.role === 'assistant');
  return previousAssistant ? proposesSave(previousAssistant.text, kind) : false;
}

function toolResult(value: Record<string, unknown>) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind: 'learning-asset-save' },
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
        if (!latestStudentApprovedAssetSave(session.getBranch(), 'note')) {
          throw new Error('ASSET_SAVE_NOT_CONFIRMED: note');
        }
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
        });
        successful.set(toolCallId, result);
        return result;
      },
    }),
    defineTool({
      name: 'save_problem_card',
      label: '保存题卡',
      description: 'Create or revise one canonical problem card only after the student has seen the proposed stem and answer and explicitly approved saving it.',
      executionMode: 'sequential',
      parameters: cardParameters,
      execute: async (toolCallId, input) => {
        const replay = successful.get(toolCallId);
        if (replay) return replay;
        if (!latestStudentApprovedAssetSave(session.getBranch(), 'problem-card')) {
          throw new Error('ASSET_SAVE_NOT_CONFIRMED: problem-card');
        }
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
        });
        successful.set(toolCallId, result);
        return result;
      },
    }),
  ];
}
