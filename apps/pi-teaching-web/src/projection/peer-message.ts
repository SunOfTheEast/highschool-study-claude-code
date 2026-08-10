import type { PeerConversationItem } from '../shared/contracts';

const ACTOR = {
  actorId: 'peer-acheng',
  displayName: '阿澄',
} as const;

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validDetails(value: unknown): boolean {
  const details = object(value);
  return details?.kind === 'peer-message'
    && details.version === 1
    && details.actorType === 'peer'
    && details.actorId === ACTOR.actorId
    && details.displayName === ACTOR.displayName;
}

function resultText(value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  const block = object(value[0]);
  if (block?.type !== 'text' || typeof block.text !== 'string') return null;
  return block.text.trim() || null;
}

export function peerMessageStart(
  id: string,
  args: unknown,
  at: string,
): PeerConversationItem | null {
  if (object(args)?.peerId !== ACTOR.actorId) return null;
  return {
    id,
    kind: 'peer',
    ...ACTOR,
    status: 'running',
    text: null,
    at,
  };
}

export function peerMessageEnd(
  id: string,
  result: unknown,
  isError: boolean,
  at: string,
  started?: PeerConversationItem,
): PeerConversationItem | null {
  const base = {
    id,
    kind: 'peer' as const,
    actorId: started?.actorId ?? ACTOR.actorId,
    displayName: started?.displayName ?? ACTOR.displayName,
    at: started?.at ?? at,
  };
  if (isError) return { ...base, status: 'error', text: null };

  const outer = object(result);
  const text = resultText(outer?.content);
  if (!validDetails(outer?.details) || text === null) return null;
  return { ...base, status: 'done', text };
}
