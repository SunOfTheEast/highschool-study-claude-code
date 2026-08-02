import type { CourseTreeNode } from '../shared/contracts';

export type BrowserRoute =
  | { kind: 'course' }
  | { kind: 'course-plan'; planId: string }
  | { kind: 'course-lesson'; planId: string; lessonId: string }
  | { kind: 'knowledge' };

function decodeId(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

export function parseBrowserRoute(pathname: string): BrowserRoute | null {
  if (pathname === '/course') return { kind: 'course' };
  if (pathname === '/knowledge') return { kind: 'knowledge' };
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
  if (route.kind === 'knowledge') return '/knowledge';
  if (route.kind === 'course-plan') {
    return `/course/plan/${encodeURIComponent(route.planId)}`;
  }
  return `/course/plan/${encodeURIComponent(route.planId)}/lesson/${
    encodeURIComponent(route.lessonId)
  }`;
}

export function routeForCourseNode(
  node: Pick<CourseTreeNode, 'kind' | 'id'>,
  parentPlanId: string | null,
): BrowserRoute | null {
  if (node.kind === 'roadmap') return { kind: 'course' };
  if (node.kind === 'plan') return { kind: 'course-plan', planId: node.id };
  return parentPlanId === null
    ? null
    : { kind: 'course-lesson', planId: parentPlanId, lessonId: node.id };
}
