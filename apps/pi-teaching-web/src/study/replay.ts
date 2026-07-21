import { readActiveTraces } from 'highschool-study-markdown/study-domain';
import type { ChatMessage, LessonNode, LessonReplay, ReplayItem } from '../shared/contracts';
import { applyRouteChanges, readRouteChanges } from './routes';

export function buildReplay(
  root: string,
  lesson: LessonNode,
  history: ChatMessage[],
): LessonReplay {
  const traces = readActiveTraces(root, [lesson.path]);
  const routes = readRouteChanges(root, lesson.path);
  const items: ReplayItem[] = [
    ...history.map((message) => ({
      id: message.id,
      kind: 'message' as const,
      label: message.role,
      detail: message.text,
      source: null,
    })),
    ...traces.map((trace) => ({
      id: trace.eventId,
      kind: 'trace' as const,
      label: `${trace.assessment} · ${trace.support}`,
      detail: trace.note,
      source: trace.sourceAnchor,
    })),
    ...routes.map((route) => ({
      id: route.id,
      kind: 'route' as const,
      label: `${route.action} ${route.blockId}`,
      detail: route.reason,
      source: route.source,
    })),
  ];
  const initial = lesson.blocks.map((block) => block.id);
  return {
    mode: history.length > 0 ? 'full' : 'evidence-only',
    items,
    route: { initial, effective: applyRouteChanges(initial, routes) },
  };
}
