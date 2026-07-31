import type { ViewQuery } from '../shared/view-contracts';
import type { BrowserRoute } from './routes';

export type ViewSelection = {
  planId: string | null;
  lessonId: string | null;
  methodName: string | null;
  cardPath: string | null;
  evidenceSource: string | null;
  courseReturnRoute: string;
};

function courseRoute(planId: string | null, lessonId: string | null): string {
  if (planId && lessonId) {
    return `/course/plan/${encodeURIComponent(planId)}/lesson/${
      encodeURIComponent(lessonId)
    }`;
  }
  if (planId) return `/course/plan/${encodeURIComponent(planId)}`;
  return '/course';
}

export function selectionFromRoute(route: BrowserRoute): ViewSelection {
  if (route.kind === 'course') {
    return {
      planId: null,
      lessonId: null,
      methodName: null,
      cardPath: null,
      evidenceSource: null,
      courseReturnRoute: '/course',
    };
  }
  if (route.kind === 'course-plan') {
    return {
      planId: route.planId,
      lessonId: null,
      methodName: null,
      cardPath: null,
      evidenceSource: null,
      courseReturnRoute: courseRoute(route.planId, null),
    };
  }
  if (route.kind === 'course-lesson') {
    return {
      planId: route.planId,
      lessonId: route.lessonId,
      methodName: null,
      cardPath: null,
      evidenceSource: null,
      courseReturnRoute: courseRoute(route.planId, route.lessonId),
    };
  }
  return {
    planId: route.query.planId,
    lessonId: route.query.lessonId,
    methodName: route.query.methodName,
    cardPath: route.query.cardPath,
    evidenceSource: route.query.evidenceSource,
    courseReturnRoute: courseRoute(route.query.planId, route.query.lessonId),
  };
}

export function routeForPrimaryView(
  view: 'course' | 'knowledge' | 'memory',
  selection: ViewSelection,
): BrowserRoute {
  if (view === 'course') {
    if (selection.planId && selection.lessonId) {
      return {
        kind: 'course-lesson',
        planId: selection.planId,
        lessonId: selection.lessonId,
      };
    }
    if (selection.planId) {
      return { kind: 'course-plan', planId: selection.planId };
    }
    return { kind: 'course' };
  }
  const query: ViewQuery = {
    planId: selection.planId,
    lessonId: selection.lessonId,
    methodName: selection.methodName,
    cardPath: selection.cardPath,
    evidenceSource: selection.evidenceSource,
    topicId: null,
    timeRange: 'all',
  };
  return view === 'knowledge'
    ? { kind: 'knowledge', query }
    : { kind: 'memory', query };
}
