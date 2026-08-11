import type {
  PaperResearchConversationItem,
  PaperResearchPhase,
} from '../shared/contracts';

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonObject
    : null;
}

function details(value: unknown): JsonObject | null {
  const outer = object(value);
  return object(outer?.details) ?? outer;
}

function phase(value: unknown): PaperResearchPhase | null {
  const valueDetails = details(value);
  if (valueDetails?.kind !== 'paper-research' || valueDetails.version !== 1) return null;
  const candidate = valueDetails.phase;
  return candidate === 'searching'
    || candidate === 'checking'
    || candidate === 'done'
    || candidate === 'unavailable'
    ? candidate
    : null;
}

export function paperResearchStart(
  id: string,
  at: string,
): PaperResearchConversationItem {
  return {
    id,
    kind: 'paper-research',
    status: 'running',
    phase: 'searching',
    at,
    updatedAt: at,
  };
}

export function paperResearchUpdate(
  id: string,
  partialResult: unknown,
  at: string,
  started?: PaperResearchConversationItem,
): PaperResearchConversationItem | null {
  const next = phase(partialResult);
  if (next !== 'searching' && next !== 'checking') return null;
  return {
    id,
    kind: 'paper-research',
    status: 'running',
    phase: next,
    at: started?.at ?? at,
    updatedAt: at,
  };
}

export function paperResearchEnd(
  id: string,
  result: unknown,
  isError: boolean,
  at: string,
  started?: PaperResearchConversationItem,
): PaperResearchConversationItem | null {
  const projected = isError ? 'unavailable' : phase(result);
  if (projected !== 'done' && projected !== 'unavailable') return null;
  return {
    id,
    kind: 'paper-research',
    status: isError ? 'error' : 'done',
    phase: projected,
    at: started?.at ?? at,
    updatedAt: at,
  };
}

export function mergePaperResearchItem(
  existing: PaperResearchConversationItem,
  incoming: PaperResearchConversationItem,
): PaperResearchConversationItem {
  return { ...incoming, at: existing.at };
}
