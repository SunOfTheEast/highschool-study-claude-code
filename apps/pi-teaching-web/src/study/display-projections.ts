import type {
  ActiveLessonSummary,
  AssetFormation,
  ConversationItem,
  CourseTreeNode,
} from '../shared/contracts';
import type { OwnedLearningSessionFact } from './learning-footprint';

function encoded(value: string): string {
  return encodeURIComponent(value);
}

export function projectActiveLesson(tree: CourseTreeNode): ActiveLessonSummary | null {
  for (const plan of tree.children) {
    if (plan.kind !== 'plan') continue;
    const lesson = plan.children.find((candidate) => (
      candidate.kind === 'lesson' && candidate.status === 'active'
    ));
    if (!lesson) continue;
    return {
      id: lesson.id,
      title: lesson.title,
      planId: plan.id,
      planTitle: plan.title,
      route: `/course/plan/${encoded(plan.id)}/lesson/${encoded(lesson.id)}`,
    };
  }
  return null;
}

function plainFirstLine(value: string): string {
  return value
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/^\s{0,3}(?:#{1,6}|>|[-+*])\s*/gm, '')
    .replace(/[`*_~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function deriveFreeLearningTitle(
  items: readonly ConversationItem[],
  limit = 32,
): string {
  const first = items.find((item) => item.kind === 'user');
  if (!first || first.kind !== 'user') return '自由学习';
  const title = plainFirstLine(first.text);
  if (!title) return '自由学习';
  const characters = [...title];
  return characters.length <= limit
    ? title
    : `${characters.slice(0, Math.max(1, limit - 1)).join('')}…`;
}

export function projectAssetFormation(
  sessions: readonly OwnedLearningSessionFact[],
  sessionId: string | null,
): AssetFormation | null {
  if (sessionId === null) return null;
  const fact = sessions.find((candidate) => candidate.id === sessionId);
  if (!fact) return null;
  if ('sessionKind' in fact.owner && fact.owner.sessionKind === 'free-learning') {
    return {
      sessionId,
      kind: 'free-learning',
      title: fact.title,
      route: `/learn/${encoded(sessionId)}`,
    };
  }
  if ('sessionKind' in fact.owner && fact.owner.sessionKind === 'meta') {
    return {
      sessionId,
      kind: 'meta',
      title: fact.title,
      route: `/meta/${encoded(sessionId)}`,
    };
  }
  if ('sessionKind' in fact.owner) return null;
  const route = fact.owner.nodeKind === 'roadmap'
    ? '/course/roadmap'
    : fact.owner.nodeKind === 'plan'
      ? `/course/plan/${encoded(fact.owner.nodeId)}`
      : fact.owner.parentId === null
        ? '/course'
        : `/course/plan/${encoded(fact.owner.parentId)}/lesson/${encoded(fact.owner.nodeId)}`;
  return {
    sessionId,
    kind: fact.owner.nodeKind,
    title: fact.title,
    route,
  };
}
