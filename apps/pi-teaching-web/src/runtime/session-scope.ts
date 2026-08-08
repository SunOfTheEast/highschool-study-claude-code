import type {
  FreeLearningSessionKey,
  FreeLearningSessionSummary,
  LearningAssetReference,
  NodeKind,
  SessionKey,
} from '../shared/contracts';
import { lessonSessionKey } from '../study/node-paths';

export type SessionRole = 'roadmap' | 'planner' | 'tutor';

export type NodeSessionScope = {
  nodeKind: NodeKind;
  nodeId: string;
  nodePath: string;
  parentId: string | null;
  parentPath: string | null;
};

export type FreeLearningSessionScope = {
  sessionKind: 'free-learning';
  title: string;
  createdAt: string;
  selectedAssets: readonly LearningAssetReference[];
};

export type StudySessionScope = NodeSessionScope | FreeLearningSessionScope;

export type FreeLearningSessionRecord = FreeLearningSessionSummary & {
  sessionFile: string;
  scope: FreeLearningSessionScope;
};

export const M0_MODEL_TOOLS = [
  'read',
  'grep',
  'find',
  'ls',
  'edit',
  'write',
] as const;

export const PLAN_MODEL_TOOLS = [
  ...M0_MODEL_TOOLS,
  'subagent',
  'artifact_export',
  'save_prepared_problem_card',
] as const;

export const LESSON_MODEL_TOOLS = [
  'read',
  'grep',
  'find',
  'ls',
  'classroom_log_append',
  'classroom_update',
  'save_note',
  'save_problem_card',
] as const;

export const FREE_LEARNING_MODEL_TOOLS = [
  'read',
  'grep',
  'find',
  'ls',
  'save_note',
  'save_problem_card',
] as const;

export function modelToolsForFreeLearning(hasMemory: boolean): readonly string[] {
  return hasMemory
    ? [...FREE_LEARNING_MODEL_TOOLS, 'free_learning_memory_commit']
    : FREE_LEARNING_MODEL_TOOLS;
}

export function isFreeLearningScope(
  scope: StudySessionScope,
): scope is FreeLearningSessionScope {
  return 'sessionKind' in scope && scope.sessionKind === 'free-learning';
}

export function isNodeSessionScope(scope: StudySessionScope): scope is NodeSessionScope {
  return !isFreeLearningScope(scope);
}

export function modelToolsForNode(kind: NodeKind, hasMemory = false): readonly string[] {
  if (kind === 'lesson') {
    return hasMemory ? [...LESSON_MODEL_TOOLS, 'lesson_memory_commit'] : LESSON_MODEL_TOOLS;
  }
  if (kind === 'plan') {
    return hasMemory ? [...PLAN_MODEL_TOOLS, 'memory_route_resolve'] : PLAN_MODEL_TOOLS;
  }
  return M0_MODEL_TOOLS;
}

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
  if (scope.nodeKind === 'lesson') {
    if (scope.parentId === null) throw new Error('LESSON_PARENT_ID_REQUIRED');
    return lessonSessionKey(scope.parentId, scope.nodeId);
  }
  return `${scope.nodeKind}:${scope.nodeId}`;
}

const sessionIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function freeLearningSessionKey(sessionId: string): FreeLearningSessionKey {
  if (!sessionIdPattern.test(sessionId)) {
    throw new Error(`FREE_LEARNING_SESSION_ID_INVALID: ${sessionId}`);
  }
  return `free:${sessionId}`;
}

export function freeLearningSessionId(key: SessionKey): string | null {
  if (!key.startsWith('free:')) return null;
  const id = key.slice('free:'.length);
  return sessionIdPattern.test(id) ? id : null;
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

export function formatFreeLearningOwnerContext(
  root: string,
  scope: FreeLearningSessionScope,
): string {
  const assets = scope.selectedAssets.length === 0
    ? '- none'
    : scope.selectedAssets.map((asset) => `- ${asset.kind}:${asset.id}`).join('\n');
  return [
    `Learning set root: ${root}`,
    'Current session kind: free-learning',
    `Session title: ${scope.title}`,
    'Selected asset handles:',
    assets,
    '',
    'This Session is not a Roadmap, Plan, Lesson, Light Lesson, or course-tree node.',
    'Its native Pi Session is the only conversation record.',
  ].join('\n');
}
