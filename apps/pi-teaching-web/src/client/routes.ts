import type { PublicTreeEntry } from '../shared/contracts';
import type { ViewQuery } from '../shared/view-contracts';
import {
  formatViewQuery,
  normalizeViewId,
  readViewQuery,
} from '../study/views/view-query';

export type BrowserRoute =
  | { kind: 'course' }
  | { kind: 'course-plan'; planId: string }
  | { kind: 'course-lesson'; planId: string; lessonId: string }
  | { kind: 'knowledge'; query: ViewQuery }
  | { kind: 'memory'; query: ViewQuery };

function decodeId(value: string): string | null {
  try {
    return normalizeViewId(decodeURIComponent(value));
  } catch {
    return null;
  }
}

export function parseBrowserRoute(
  pathname: string,
  search = '',
): BrowserRoute | null {
  if (pathname === '/course') return { kind: 'course' };
  if (pathname === '/knowledge' || pathname === '/memory') {
    const query = readViewQuery(new URLSearchParams(search));
    return pathname === '/knowledge'
      ? { kind: 'knowledge', query }
      : { kind: 'memory', query };
  }
  if (!pathname.startsWith('/') || pathname.endsWith('/')) return null;
  const parts = pathname.slice(1).split('/');
  if (parts.length === 3 && parts[0] === 'course' && parts[1] === 'plan') {
    const planId = decodeId(parts[2]!);
    return planId ? { kind: 'course-plan', planId } : null;
  }
  if (
    parts.length === 5
    && parts[0] === 'course'
    && parts[1] === 'plan'
    && parts[3] === 'lesson'
  ) {
    const planId = decodeId(parts[2]!);
    const lessonId = decodeId(parts[4]!);
    return planId && lessonId
      ? { kind: 'course-lesson', planId, lessonId }
      : null;
  }
  return null;
}

export function formatBrowserRoute(route: BrowserRoute): string {
  if (route.kind === 'course') return '/course';
  if (route.kind === 'course-plan') {
    return `/course/plan/${encodeURIComponent(route.planId)}`;
  }
  if (route.kind === 'course-lesson') {
    return `/course/plan/${encodeURIComponent(route.planId)}/lesson/${
      encodeURIComponent(route.lessonId)
    }`;
  }
  const path = route.kind === 'knowledge' ? '/knowledge' : '/memory';
  return `${path}${formatViewQuery(route.query)}`;
}

export function routeForPublicTreeEntry(
  entry: PublicTreeEntry,
  parentPlanId: string | null,
): BrowserRoute | null {
  if (entry.status === 'candidate' || entry.nodeId === null) return null;
  if (entry.kind === 'plan') {
    return { kind: 'course-plan', planId: entry.nodeId };
  }
  return parentPlanId === null
    ? null
    : {
      kind: 'course-lesson',
      planId: parentPlanId,
      lessonId: entry.nodeId,
    };
}
