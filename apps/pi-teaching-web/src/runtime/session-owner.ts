import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type { NodeSessionScope } from './session-scope';

export const SESSION_OWNER_TYPE = 'studyforge.m0.session-owner.v1';

type SessionOwnerWriter = {
  appendCustomEntry(customType: string, data?: unknown): unknown;
};

type SessionOwnerReader = {
  getEntries(): readonly unknown[];
};

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function isSessionOwner(value: unknown): value is NodeSessionScope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const owner = value as Record<string, unknown>;
  if (!['roadmap', 'plan', 'lesson'].includes(String(owner.nodeKind))) return false;
  if (!nonempty(owner.nodeId) || !nonempty(owner.nodePath)) return false;
  return owner.nodeKind === 'roadmap'
    ? owner.parentId === null && owner.parentPath === null
    : nonempty(owner.parentId) && nonempty(owner.parentPath);
}

export function appendSessionOwner(
  manager: SessionOwnerWriter,
  owner: NodeSessionScope,
): void {
  manager.appendCustomEntry(SESSION_OWNER_TYPE, owner);
}

export function readSessionOwner(manager: SessionOwnerReader): NodeSessionScope | null {
  const matching = manager.getEntries().flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    if (candidate.type !== 'custom' || candidate.customType !== SESSION_OWNER_TYPE) return [];
    return isSessionOwner(candidate.data) ? [candidate.data] : [null];
  });
  return matching.length === 1 ? matching[0] ?? null : null;
}

export function sessionOwnerMatches(
  actual: NodeSessionScope | null,
  expected: NodeSessionScope,
): boolean {
  return actual !== null
    && actual.nodeKind === expected.nodeKind
    && actual.nodeId === expected.nodeId
    && actual.nodePath === expected.nodePath
    && actual.parentId === expected.parentId
    && actual.parentPath === expected.parentPath;
}

export async function findOwnedPiSessionFile(
  root: string,
  sessionId: string,
  expected: NodeSessionScope,
): Promise<string | null> {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  const path = (await SessionManager.list(root)).find((item) => item.id === sessionId)?.path;
  if (!path) return null;
  const manager = SessionManager.open(path, undefined, root);
  return sessionOwnerMatches(readSessionOwner(manager), expected) ? path : null;
}

export async function readPiSessionBranch(
  root: string,
  sessionFile: string,
): Promise<readonly SessionEntry[]> {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  return SessionManager.open(sessionFile, undefined, root).getBranch();
}
