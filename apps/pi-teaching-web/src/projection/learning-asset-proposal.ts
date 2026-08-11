import type {
  ConversationItem,
  LearningAssetKind,
  LearningAssetProposalConversationItem,
  LearningAssetSavedConversationItem,
  LearningNoteBlock,
} from '../shared/contracts';

type JsonObject = Record<string, unknown>;

const saveTools = new Map<string, LearningAssetKind>([
  ['save_note', 'note'],
  ['save_problem_card', 'problem-card'],
  ['save_prepared_problem_card', 'problem-card'],
]);

function object(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function targetRevision(value: unknown): number | null {
  const target = object(value);
  return Number.isSafeInteger(target?.expectedRevision) && Number(target?.expectedRevision) > 0
    ? Number(target?.expectedRevision)
    : null;
}

function noteBlocks(value: unknown): LearningNoteBlock[] | null {
  if (!Array.isArray(value) || value.length === 0) return null;
  const blocks: LearningNoteBlock[] = [];
  for (const item of value) {
    const block = object(item);
    if (block?.kind === 'markdown') {
      const body = text(block.body);
      if (!body) return null;
      blocks.push({ kind: 'markdown', body });
      continue;
    }
    if (block?.kind === 'recall') {
      const prompt = text(block.prompt);
      const answer = text(block.answer);
      if (!prompt || !answer) return null;
      blocks.push({ kind: 'recall', prompt, answer });
      continue;
    }
    return null;
  }
  return blocks;
}

export function learningAssetProposalStart(
  id: string,
  toolName: string,
  args: unknown,
  at: string,
): LearningAssetProposalConversationItem | null {
  const input = object(args);
  if (!input) return null;
  const revision = targetRevision(input.target);
  const mode = revision === null ? 'create' as const : 'revise' as const;
  if (toolName === 'propose_note') {
    const title = text(input.title);
    const blocks = noteBlocks(input.blocks);
    return title && blocks ? {
      id,
      kind: 'learning-asset-proposal',
      assetKind: 'note',
      mode,
      targetRevision: revision,
      title,
      blocks,
      status: 'shown',
      at,
    } : null;
  }
  if (toolName === 'propose_problem_card') {
    const stem = text(input.stem);
    if (!stem || typeof input.studentNote !== 'string') return null;
    return {
      id,
      kind: 'learning-asset-proposal',
      assetKind: 'problem-card',
      mode,
      targetRevision: revision,
      stem,
      studentNote: input.studentNote.trim(),
      status: 'shown',
      at,
    };
  }
  return null;
}

export function learningAssetSaveStart(
  id: string,
  toolName: string,
  at: string,
): LearningAssetSavedConversationItem | null {
  const assetKind = saveTools.get(toolName);
  return assetKind ? {
    id,
    kind: 'learning-asset-saved',
    assetKind,
    status: 'running',
    asset: null,
    at,
  } : null;
}

export function learningAssetSaveEnd(
  id: string,
  toolName: string,
  result: unknown,
  isError: boolean,
  at: string,
  started?: LearningAssetSavedConversationItem,
): LearningAssetSavedConversationItem | null {
  const assetKind = saveTools.get(toolName);
  if (!assetKind) return null;
  if (isError) {
    return {
      id,
      kind: 'learning-asset-saved',
      assetKind,
      status: 'error',
      asset: null,
      at: started?.at ?? at,
    };
  }
  const outer = object(result);
  const details = object(outer?.details) ?? outer;
  const asset = object(details?.asset);
  if (
    details?.kind !== 'learning-asset-save'
    || details.version !== 1
    || asset?.kind !== assetKind
  ) return null;
  const assetId = text(asset.id);
  const title = text(asset.title);
  const route = text(asset.route);
  const revision = asset.revision;
  if (
    !assetId
    || !title
    || !route
    || !route.startsWith('/assets/')
    || !Number.isSafeInteger(revision)
    || Number(revision) < 1
  ) return null;
  return {
    id,
    kind: 'learning-asset-saved',
    assetKind,
    status: 'done',
    asset: {
      kind: assetKind,
      id: assetId,
      revision: Number(revision),
      title,
      route,
    },
    at: started?.at ?? at,
  };
}

export function isLearningAssetProposalTool(name: string): boolean {
  return name === 'propose_note' || name === 'propose_problem_card';
}

export function isLearningAssetSaveTool(name: string): boolean {
  return saveTools.has(name);
}

export function fallbackTool(
  id: string,
  name: string,
  status: 'running' | 'done' | 'error',
  at: string,
): Extract<ConversationItem, { kind: 'tool' }> {
  return { id, kind: 'tool', name, status, detail: null, at };
}
