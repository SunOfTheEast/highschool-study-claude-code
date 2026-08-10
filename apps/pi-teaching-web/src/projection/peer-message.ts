import type {
  PeerConversationItem,
  PeerDelivery,
  PeerExpression,
  PeerMove,
} from '../shared/contracts';

const ACTOR = {
  actorId: 'peer-axia',
  displayName: '阿夏',
} as const;

const expressions: Record<PeerMove, PeerExpression> = {
  question: 'curious',
  association: 'neutral',
  challenge: 'skeptical',
};

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

function peerMove(value: unknown): PeerMove | null {
  return value === 'question' || value === 'association' || value === 'challenge'
    ? value
    : null;
}

function expression(move: PeerMove | null): PeerExpression {
  return move === null ? 'neutral' : expressions[move];
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
  delivery: PeerDelivery,
): PeerConversationItem | null {
  const input = object(args);
  if (input?.peerId !== ACTOR.actorId) return null;
  const move = peerMove(input.move);
  return {
    id,
    kind: 'peer',
    ...ACTOR,
    status: 'running',
    text: null,
    move,
    expression: expression(move),
    delivery,
    at,
  };
}

export function peerMessageEnd(
  id: string,
  result: unknown,
  isError: boolean,
  at: string,
  delivery: PeerDelivery,
  started?: PeerConversationItem,
): PeerConversationItem | null {
  const outer = object(result);
  const details = object(outer?.details);
  const move = peerMove(details?.move) ?? started?.move ?? null;
  const base = {
    id,
    kind: 'peer' as const,
    actorId: started?.actorId ?? ACTOR.actorId,
    displayName: started?.displayName ?? ACTOR.displayName,
    move,
    expression: expression(move),
    delivery: started?.delivery ?? delivery,
    at: started?.at ?? at,
  };
  if (isError) return { ...base, status: 'error', text: null };

  const text = resultText(outer?.content);
  if (!validDetails(outer?.details) || text === null) return null;
  return { ...base, status: 'done', text };
}
