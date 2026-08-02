import type { NodeKind, SessionKey } from '../shared/contracts';

export type SessionRole = 'roadmap' | 'planner' | 'tutor';

export type NodeSessionScope = {
  nodeKind: NodeKind;
  nodeId: string;
  nodePath: string;
  parentId: string | null;
  parentPath: string | null;
};

export const M0_MODEL_TOOLS = [
  'read',
  'grep',
  'find',
  'ls',
  'edit',
  'write',
] as const;

export const ROADMAP_SCOPE = {
  nodeKind: 'roadmap',
  nodeId: 'roadmap',
  nodePath: 'ROADMAP.md',
  parentId: null,
  parentPath: null,
} as const satisfies NodeSessionScope;

export function roleForNode(kind: NodeKind): SessionRole {
  if (kind === 'roadmap') return 'roadmap';
  return kind === 'plan' ? 'planner' : 'tutor';
}

export function sessionKeyForNode(scope: NodeSessionScope): SessionKey {
  return `${scope.nodeKind}:${scope.nodeId}`;
}

export function formatSessionOwnerContext(
  root: string,
  scope: NodeSessionScope,
): string {
  const parent = scope.parentPath === null
    ? ''
    : `\nParent node: ${scope.parentId}\nParent file: ${scope.parentPath}`;
  return [
    `Learning set root: ${root}`,
    `Current node kind: ${scope.nodeKind}`,
    `Current node ID: ${scope.nodeId}`,
    `Current node file: ${scope.nodePath}${parent}`,
  ].join('\n');
}
