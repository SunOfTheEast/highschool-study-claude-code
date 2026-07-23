import type { StudySessionScope } from './session-scope';

export const SESSION_OWNER_TYPE = 'studyforge.session-owner.v1';

type SessionOwnerWriter = {
  appendCustomEntry(customType: string, data?: unknown): unknown;
};

type SessionOwnerReader = {
  getEntries(): readonly unknown[];
};

function isSessionOwner(value: unknown): value is StudySessionScope {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false;
  const owner = value as Record<string, unknown>;
  return (owner.role === 'coach' || owner.role === 'tutor')
    && typeof owner.ownerId === 'string'
    && owner.ownerId.length > 0
    && typeof owner.ownerPath === 'string'
    && owner.ownerPath.length > 0;
}

export function appendSessionOwner(
  manager: SessionOwnerWriter,
  owner: StudySessionScope,
): void {
  manager.appendCustomEntry(SESSION_OWNER_TYPE, owner);
}

export function readSessionOwner(manager: SessionOwnerReader): StudySessionScope | null {
  const owners = manager.getEntries().flatMap((entry) => {
    if (entry === null || typeof entry !== 'object' || Array.isArray(entry)) return [];
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
  actual: StudySessionScope | null,
  expected: StudySessionScope,
): boolean {
  return actual !== null
    && actual.role === expected.role
    && actual.ownerId === expected.ownerId
    && actual.ownerPath === expected.ownerPath;
}
