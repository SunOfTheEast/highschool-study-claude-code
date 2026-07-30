import type { SessionKey } from '../shared/contracts';

export type SessionRole = 'coach' | 'tutor';
export type NodeKind = 'roadmap' | 'plan' | 'lesson';

export type NodeSessionScope = {
  nodeKind: NodeKind;
  nodeId: string;
  nodePath: string;
  parentId: string | null;
  parentPath: string | null;
};

export const ROADMAP_COACH_SCOPE = {
  nodeKind: 'roadmap',
  nodeId: 'roadmap',
  nodePath: 'ROADMAP.md',
  parentId: null,
  parentPath: null,
} as const satisfies NodeSessionScope;

export function roleForNode(kind: NodeKind): SessionRole {
  return kind === 'lesson' ? 'tutor' : 'coach';
}

export function sessionKeyForNode(scope: NodeSessionScope): SessionKey {
  if (scope.nodeKind === 'roadmap') return 'coach:@roadmap';
  return `${roleForNode(scope.nodeKind)}:${scope.nodeId}`;
}

export function isRoadmapCoachScope(
  scope: NodeSessionScope,
): scope is typeof ROADMAP_COACH_SCOPE {
  return scope.nodeKind === ROADMAP_COACH_SCOPE.nodeKind
    && scope.nodeId === ROADMAP_COACH_SCOPE.nodeId
    && scope.nodePath === ROADMAP_COACH_SCOPE.nodePath
    && scope.parentId === null
    && scope.parentPath === null;
}

export function formatSessionOwnerContext(
  root: string,
  scope: NodeSessionScope,
): string {
  const role = roleForNode(scope.nodeKind);
  const owner = scope.nodeKind === 'roadmap'
    ? `Current Coach: ${scope.nodeId}\nCurrent Roadmap file: ${scope.nodePath}`
    : role === 'coach'
      ? `Current Coach: ${scope.nodeId}\nCurrent Plan file: ${scope.nodePath}`
      : `Current Tutor: ${scope.nodeId}\nCurrent Lesson file: ${scope.nodePath}`;
  const parent = scope.parentId === null
    ? ''
    : `\nParent node: ${scope.parentId}\nParent file: ${scope.parentPath}`;
  return `Learning set root: ${root}\n${owner}${parent}`;
}
