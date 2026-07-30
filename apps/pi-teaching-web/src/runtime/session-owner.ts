import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type { SessionEvidenceReader } from '../study/evidence-tree';
import type { NodeSessionScope } from './session-scope';

export const SESSION_OWNER_TYPE = 'studyforge.session-owner.v2';

type SessionOwnerWriter = {
  appendCustomEntry(customType: string, data?: unknown): unknown;
};

type SessionOwnerReader = {
  getEntries(): readonly unknown[];
};

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

function hasValidParent(
  owner: Record<string, unknown>,
  kind: NodeSessionScope['nodeKind'],
): boolean {
  if (kind === 'roadmap') {
    return owner.parentId === null && owner.parentPath === null;
  }
  return nonempty(owner.parentId) && nonempty(owner.parentPath);
}

function isSessionOwner(value: unknown): value is NodeSessionScope {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const owner = value as Record<string, unknown>;
  const kind = owner.nodeKind;
  return (
    (kind === 'roadmap' || kind === 'plan' || kind === 'lesson')
    && nonempty(owner.nodeId)
    && nonempty(owner.nodePath)
    && hasValidParent(owner, kind)
  );
}

export function appendSessionOwner(
  manager: SessionOwnerWriter,
  owner: NodeSessionScope,
): void {
  manager.appendCustomEntry(SESSION_OWNER_TYPE, owner);
}

export function readSessionOwner(
  manager: SessionOwnerReader,
): NodeSessionScope | null {
  const owners = manager.getEntries().flatMap((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) {
      return [];
    }
    const value = entry as Record<string, unknown>;
    return value.type === 'custom'
      && value.customType === SESSION_OWNER_TYPE
      && isSessionOwner(value.data)
      ? [value.data]
      : value.type === 'custom' && value.customType === SESSION_OWNER_TYPE
        ? [null]
        : [];
  });
  return owners.length === 1 ? owners[0] ?? null : null;
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
  const path = (await SessionManager.list(root))
    .find((item) => item.id === sessionId)?.path;
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

export async function createPiSessionEvidenceReader(
  root: string,
): Promise<SessionEvidenceReader> {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  const sessions = new Map<
    string,
    NonNullable<ReturnType<SessionEvidenceReader['read']>>
  >();
  for (const item of await SessionManager.list(root)) {
    try {
      const manager = SessionManager.open(item.path, undefined, root);
      const owner = readSessionOwner(manager);
      if (owner === null) continue;
      const messages = new Set(manager.getBranch().flatMap((entry) => (
        typeof entry.id === 'string' ? [entry.id] : []
      )));
      sessions.set(item.id, {
        owner,
        messages,
        label: `${owner.nodeId} session`,
      });
    } catch {
      continue;
    }
  }
  return { read: (sessionId) => sessions.get(sessionId) ?? null };
}
