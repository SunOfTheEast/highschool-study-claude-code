import type { CourseTreeNode } from '../shared/contracts';
import {
  formatLessonHandoutPath,
  parseHandoutBlockSegment,
} from '../shared/handout-route';

export type BrowserRoute =
  | { kind: 'home' }
  | { kind: 'calendar' }
  | { kind: 'assets'; view?: 'sources' }
  | { kind: 'free-learning'; sessionId: string }
  | { kind: 'meta'; sessionId: string }
  | { kind: 'footprint' }
  | { kind: 'note'; id: string }
  | { kind: 'problem-card'; id: string }
  | { kind: 'material'; id: string }
  | { kind: 'book'; id: string }
  | { kind: 'book-reader'; id: string; revision: number; locator: string }
  | { kind: 'course' }
  | { kind: 'course-roadmap' }
  | { kind: 'course-plan'; planId: string }
  | { kind: 'course-lesson'; planId: string; lessonId: string }
  | {
    kind: 'lesson-handout';
    planId: string;
    lessonId: string;
    blockIds: string[];
  }
  | { kind: 'knowledge' };

function decodeId(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function bookLocator(value: string): string | null {
  const page = /^page-([0-9]{4})$/.exec(value);
  if (page && Number(page[1]) > 0) return value;
  const range = /^pages-([0-9]{4})-([0-9]{4})$/.exec(value);
  if (!range) return null;
  const start = Number(range[1]);
  const end = Number(range[2]);
  return start > 0 && end >= start ? value : null;
}

export function parseBrowserRoute(pathname: string, search = ''): BrowserRoute | null {
  if (pathname === '/' || pathname === '/home') return { kind: 'home' };
  if (pathname === '/calendar') return { kind: 'calendar' };
  if (pathname === '/assets') {
    return new URLSearchParams(search).get('view') === 'sources'
      ? { kind: 'assets', view: 'sources' }
      : { kind: 'assets' };
  }
  if (pathname === '/footprint') return { kind: 'footprint' };
  if (pathname === '/course') return { kind: 'course' };
  if (pathname === '/course/roadmap') return { kind: 'course-roadmap' };
  if (pathname === '/knowledge') return { kind: 'knowledge' };
  if (!pathname.startsWith('/') || pathname.endsWith('/')) return null;

  const parts = pathname.slice(1).split('/');
  if (parts.length === 2 && parts[0] === 'learn') {
    const sessionId = decodeId(parts[1]!);
    return sessionId ? { kind: 'free-learning', sessionId } : null;
  }
  if (parts.length === 2 && parts[0] === 'meta') {
    const sessionId = decodeId(parts[1]!);
    return sessionId ? { kind: 'meta', sessionId } : null;
  }
  if (parts.length === 3 && parts[0] === 'assets' && parts[1] === 'notes') {
    const id = decodeId(parts[2]!);
    return id ? { kind: 'note', id } : null;
  }
  if (parts.length === 3 && parts[0] === 'assets' && parts[1] === 'problem-cards') {
    const id = decodeId(parts[2]!);
    return id ? { kind: 'problem-card', id } : null;
  }
  if (parts.length === 3 && parts[0] === 'assets' && parts[1] === 'materials') {
    const id = decodeId(parts[2]!);
    return id ? { kind: 'material', id } : null;
  }
  if (parts.length === 3 && parts[0] === 'assets' && parts[1] === 'books') {
    const id = decodeId(parts[2]!);
    return id ? { kind: 'book', id } : null;
  }
  if (
    parts.length === 6
    && parts[0] === 'assets'
    && parts[1] === 'books'
    && parts[3] === 'read'
  ) {
    const id = decodeId(parts[2]!);
    const revision = Number(parts[4]);
    const locator = bookLocator(parts[5]!);
    return id && Number.isSafeInteger(revision) && revision > 0 && locator
      ? { kind: 'book-reader', id, revision, locator }
      : null;
  }
  if (parts.length === 3 && parts[0] === 'course' && parts[1] === 'plan') {
    const planId = decodeId(parts[2]!);
    return planId ? { kind: 'course-plan', planId } : null;
  }
  if (
    parts.length === 7
    && parts[0] === 'course'
    && parts[1] === 'plan'
    && parts[3] === 'lesson'
    && parts[5] === 'handout'
  ) {
    const planId = decodeId(parts[2]!);
    const lessonId = decodeId(parts[4]!);
    const blockIds = parseHandoutBlockSegment(parts[6]!);
    return planId && lessonId && blockIds
      ? { kind: 'lesson-handout', planId, lessonId, blockIds }
      : null;
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
  if (route.kind === 'home') return '/home';
  if (route.kind === 'calendar') return '/calendar';
  if (route.kind === 'assets') return route.view === 'sources' ? '/assets?view=sources' : '/assets';
  if (route.kind === 'free-learning') return `/learn/${encodeURIComponent(route.sessionId)}`;
  if (route.kind === 'meta') return `/meta/${encodeURIComponent(route.sessionId)}`;
  if (route.kind === 'footprint') return '/footprint';
  if (route.kind === 'note') return `/assets/notes/${encodeURIComponent(route.id)}`;
  if (route.kind === 'problem-card') {
    return `/assets/problem-cards/${encodeURIComponent(route.id)}`;
  }
  if (route.kind === 'material') return `/assets/materials/${encodeURIComponent(route.id)}`;
  if (route.kind === 'book') return `/assets/books/${encodeURIComponent(route.id)}`;
  if (route.kind === 'book-reader') {
    return `/assets/books/${encodeURIComponent(route.id)}/read/${route.revision}/${route.locator}`;
  }
  if (route.kind === 'course') return '/course';
  if (route.kind === 'course-roadmap') return '/course/roadmap';
  if (route.kind === 'knowledge') return '/knowledge';
  if (route.kind === 'course-plan') {
    return `/course/plan/${encodeURIComponent(route.planId)}`;
  }
  if (route.kind === 'lesson-handout') {
    return formatLessonHandoutPath(route.planId, route.lessonId, route.blockIds);
  }
  return `/course/plan/${encodeURIComponent(route.planId)}/lesson/${
    encodeURIComponent(route.lessonId)
  }`;
}

export function routeForCourseNode(
  node: Pick<CourseTreeNode, 'kind' | 'id'>,
  parentPlanId: string | null,
): BrowserRoute | null {
  if (node.kind === 'roadmap') return { kind: 'course-roadmap' };
  if (node.kind === 'plan') return { kind: 'course-plan', planId: node.id };
  return parentPlanId === null
    ? null
    : { kind: 'course-lesson', planId: parentPlanId, lessonId: node.id };
}
