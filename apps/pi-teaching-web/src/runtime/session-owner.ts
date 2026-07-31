import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import { projectConversationEntries } from '../projection/conversation-projector';
import type { SessionKey } from '../shared/contracts';
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

function sessionKey(owner: NodeSessionScope): SessionKey {
  return owner.nodeKind === 'roadmap'
    ? 'coach:@roadmap'
    : owner.nodeKind === 'plan'
      ? `coach:${owner.nodeId}`
      : `tutor:${owner.nodeId}`;
}

export function createSessionEvidenceReader(
  records: Array<{
    sessionId: string;
    owner: NodeSessionScope;
    entries: readonly SessionEntry[];
  }>,
): SessionEvidenceReader {
  const sessions = new Map<
    `session:${string}`,
    { sessionId: string; ownerId: string; ownerPath: string }
  >();
  const messages = new Map<
    `session:${string}#message:${string}`,
    { role: 'student' | 'coach' | 'tutor'; text: string }
  >();
  for (const record of records) {
    const source = `session:${record.sessionId}` as const;
    sessions.set(source, {
      sessionId: record.sessionId,
      ownerId: record.owner.nodeId,
      ownerPath: record.owner.nodePath,
    });
    const key = sessionKey(record.owner);
    for (const item of projectConversationEntries(key, record.entries, 'safe')) {
      if (item.kind !== 'message') continue;
      const prefix = `${key}:`;
      if (!item.message.id.startsWith(prefix)) continue;
      const indexSource = item.message.id.slice(prefix.length);
      if (!/^\d+$/.test(indexSource)) continue;
      const entry = record.entries[Number(indexSource)];
      if (!entry || typeof entry.id !== 'string') continue;
      messages.set(`${source}#message:${entry.id}`, {
        role: item.message.role,
        text: item.message.text,
      });
    }
  }
  return {
    readSession: (source) => sessions.get(source) ?? null,
    readMessage: (source) => messages.get(source) ?? null,
  };
}

export async function createPiSessionEvidenceReader(
  root: string,
): Promise<SessionEvidenceReader> {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  const records: Array<{
    sessionId: string;
    owner: NodeSessionScope;
    entries: readonly SessionEntry[];
  }> = [];
  for (const item of await SessionManager.list(root)) {
    try {
      const manager = SessionManager.open(item.path, undefined, root);
      const owner = readSessionOwner(manager);
      if (owner === null) continue;
      records.push({
        sessionId: item.id,
        owner,
        entries: manager.getBranch(),
      });
    } catch {
      continue;
    }
  }
  return createSessionEvidenceReader(records);
}
