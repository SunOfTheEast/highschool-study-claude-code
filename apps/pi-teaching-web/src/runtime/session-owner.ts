import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import {
  freeLearningSessionKey,
  isFreeLearningScope,
  isMetaScope,
  metaSessionKey,
  type FreeLearningSessionRecord,
  type FreeLearningSessionScope,
  type MetaSessionRecord,
  type NodeSessionScope,
  type StudySessionScope,
} from './session-scope';

export const SESSION_OWNER_TYPE = 'studyforge.m0.session-owner.v1';
export const FREE_LEARNING_ENDED_TYPE = 'studyforge.m1b.free-learning-ended.v1';

type SessionOwnerWriter = {
  appendCustomEntry(customType: string, data?: unknown): unknown;
};

type SessionOwnerReader = {
  getEntries(): readonly unknown[];
};

export type PiSessionFact = {
  id: string;
  title: string;
  createdAt: string;
  entryTimes: string[];
  owner: StudySessionScope;
  endedAt: string | null;
};

function nonempty(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

function validAssetReference(value: unknown): boolean {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const reference = value as Record<string, unknown>;
  return (reference.kind === 'note' || reference.kind === 'problem-card')
    && nonempty(reference.id)
    && /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(reference.id);
}

function isSessionOwner(value: unknown): value is StudySessionScope {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const owner = value as Record<string, unknown>;
  if (owner.sessionKind === 'free-learning') {
    return nonempty(owner.title)
      && nonempty(owner.createdAt)
      && !Number.isNaN(Date.parse(owner.createdAt))
      && Array.isArray(owner.selectedAssets)
      && owner.selectedAssets.every(validAssetReference);
  }
  if (owner.sessionKind === 'meta') {
    return nonempty(owner.title)
      && nonempty(owner.createdAt)
      && !Number.isNaN(Date.parse(owner.createdAt))
      && Array.isArray(owner.selectedAssets)
      && owner.selectedAssets.every(validAssetReference);
  }
  if (!['roadmap', 'plan', 'lesson'].includes(String(owner.nodeKind))) return false;
  if (!nonempty(owner.nodeId) || !nonempty(owner.nodePath)) return false;
  return owner.nodeKind === 'roadmap'
    ? owner.parentId === null && owner.parentPath === null
    : nonempty(owner.parentId) && nonempty(owner.parentPath);
}

export function appendSessionOwner(
  manager: SessionOwnerWriter,
  owner: StudySessionScope,
): void {
  manager.appendCustomEntry(SESSION_OWNER_TYPE, owner);
}

export function readSessionOwner(manager: SessionOwnerReader): StudySessionScope | null {
  const matching = manager.getEntries().flatMap((entry) => {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return [];
    const candidate = entry as Record<string, unknown>;
    if (candidate.type !== 'custom' || candidate.customType !== SESSION_OWNER_TYPE) return [];
    return isSessionOwner(candidate.data) ? [candidate.data] : [null];
  });
  return matching.length === 1 ? matching[0] ?? null : null;
}

export function sessionOwnerMatches(
  actual: StudySessionScope | null,
  expected: StudySessionScope,
): boolean {
  if (actual === null || isFreeLearningScope(actual) !== isFreeLearningScope(expected)) {
    return false;
  }
  if (isFreeLearningScope(actual) && isFreeLearningScope(expected)) {
    return actual.title === expected.title
      && actual.createdAt === expected.createdAt
      && JSON.stringify(actual.selectedAssets) === JSON.stringify(expected.selectedAssets);
  }
  if (isFreeLearningScope(actual) || isFreeLearningScope(expected)) return false;
  if (isMetaScope(actual) || isMetaScope(expected)) {
    return isMetaScope(actual) && isMetaScope(expected)
      && actual.title === expected.title
      && actual.createdAt === expected.createdAt
      && JSON.stringify(actual.selectedAssets) === JSON.stringify(expected.selectedAssets);
  }
  return actual.nodeKind === expected.nodeKind
    && actual.nodeId === expected.nodeId
    && actual.nodePath === expected.nodePath
    && actual.parentId === expected.parentId
    && actual.parentPath === expected.parentPath;
}

export function readFreeLearningEndedAt(entries: readonly unknown[]): string | null {
  let endedAt: string | null = null;
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const candidate = entry as Record<string, unknown>;
    if (candidate.type !== 'custom' || candidate.customType !== FREE_LEARNING_ENDED_TYPE) continue;
    const data = candidate.data;
    if (!data || typeof data !== 'object' || Array.isArray(data)) continue;
    const value = (data as Record<string, unknown>).endedAt;
    if (typeof value === 'string' && !Number.isNaN(Date.parse(value))) endedAt = value;
  }
  return endedAt;
}

export function isFreeLearningEnded(entries: readonly unknown[]): boolean {
  return readFreeLearningEndedAt(entries) !== null;
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

function freeRecord(
  info: {
    path: string;
    id: string;
    created: Date;
    modified: Date;
    name?: string;
  },
  manager: SessionOwnerReader,
): FreeLearningSessionRecord | null {
  const scope = readSessionOwner(manager);
  if (!scope || !isFreeLearningScope(scope)) return null;
  const endedAt = readFreeLearningEndedAt(manager.getEntries());
  return {
    id: info.id,
    sessionKey: freeLearningSessionKey(info.id),
    title: info.name?.trim() || scope.title,
    createdAt: scope.createdAt || info.created.toISOString(),
    updatedAt: endedAt ?? info.modified.toISOString(),
    status: endedAt === null ? 'active' : 'ended',
    sessionFile: info.path,
    scope,
  };
}

export async function findFreeLearningPiSession(
  root: string,
  sessionId: string,
): Promise<FreeLearningSessionRecord | null> {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  const info = (await SessionManager.list(root)).find((item) => item.id === sessionId);
  if (!info) return null;
  const manager = SessionManager.open(info.path, undefined, root);
  return freeRecord(info, manager);
}

export async function listFreeLearningPiSessions(
  root: string,
): Promise<FreeLearningSessionRecord[]> {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  const records: FreeLearningSessionRecord[] = [];
  for (const info of await SessionManager.list(root)) {
    const manager = SessionManager.open(info.path, undefined, root);
    const record = freeRecord(info, manager);
    if (record) records.push(record);
  }
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

function metaRecord(
  info: {
    path: string;
    id: string;
    created: Date;
    modified: Date;
    name?: string;
  },
  manager: SessionOwnerReader,
): MetaSessionRecord | null {
  const scope = readSessionOwner(manager);
  if (!scope || !isMetaScope(scope)) return null;
  return {
    id: info.id,
    sessionKey: metaSessionKey(info.id),
    title: info.name?.trim() || scope.title,
    createdAt: scope.createdAt || info.created.toISOString(),
    updatedAt: info.modified.toISOString(),
    sessionFile: info.path,
    scope,
  };
}

export async function findMetaPiSession(
  root: string,
  sessionId: string,
): Promise<MetaSessionRecord | null> {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  const info = (await SessionManager.list(root)).find((item) => item.id === sessionId);
  if (!info) return null;
  const manager = SessionManager.open(info.path, undefined, root);
  return metaRecord(info, manager);
}

export async function listMetaPiSessions(root: string): Promise<MetaSessionRecord[]> {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  const records: MetaSessionRecord[] = [];
  for (const info of await SessionManager.list(root)) {
    const manager = SessionManager.open(info.path, undefined, root);
    const record = metaRecord(info, manager);
    if (record) records.push(record);
  }
  return records.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function listPiSessionFacts(root: string): Promise<PiSessionFact[]> {
  const { SessionManager } = await import('@earendil-works/pi-coding-agent');
  const facts: PiSessionFact[] = [];
  for (const info of await SessionManager.list(root)) {
    const manager = SessionManager.open(info.path, undefined, root);
    const owner = readSessionOwner(manager);
    if (!owner) continue;
    const entryTimes = [...new Set(manager.getBranch().flatMap((entry) => (
      entry.type === 'message'
      && typeof entry.timestamp === 'string'
      && !Number.isNaN(Date.parse(entry.timestamp))
        ? [entry.timestamp]
        : []
    )))].sort();
    const createdAt = isFreeLearningScope(owner) || isMetaScope(owner)
      ? owner.createdAt
      : info.created.toISOString();
    const fallbackTitle = isFreeLearningScope(owner) || isMetaScope(owner)
      ? owner.title
      : `${owner.nodeKind} · ${owner.nodeId}`;
    facts.push({
      id: info.id,
      title: info.name?.trim() || fallbackTitle,
      createdAt,
      entryTimes,
      owner,
      endedAt: isFreeLearningScope(owner) ? readFreeLearningEndedAt(manager.getEntries()) : null,
    });
  }
  return facts.sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}
