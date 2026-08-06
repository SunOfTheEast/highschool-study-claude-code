import type { CourseTreeNode } from '../shared/contracts';
import type { BrowserRoute } from './routes';

export type CourseContinueTarget = {
  node: CourseTreeNode;
  parentPlanId: string | null;
  route: BrowserRoute;
};

export function planProgress(_plan: CourseTreeNode): {
  settled: number;
  total: number;
} {
  const lessons = _plan.children.filter((node) => node.kind === 'lesson');
  return {
    settled: lessons.filter((node) => node.status === 'closed').length,
    total: lessons.length,
  };
}

export function resolveContinueTarget(root: CourseTreeNode): CourseContinueTarget {
  const plans = root.children.filter((node) => node.kind === 'plan');
  for (const plan of plans) {
    const lesson = plan.children.find((node) => (
      node.kind === 'lesson' && node.status === 'active'
    ));
    if (lesson) {
      return {
        node: lesson,
        parentPlanId: plan.id,
        route: { kind: 'course-lesson', planId: plan.id, lessonId: lesson.id },
      };
    }
  }

  const activePlan = plans.find((plan) => plan.status === 'active');
  const preparedLesson = activePlan?.children.find((node) => (
    node.kind === 'lesson' && node.status === 'prepared'
  ));
  if (activePlan && preparedLesson) {
    return {
      node: preparedLesson,
      parentPlanId: activePlan.id,
      route: {
        kind: 'course-lesson',
        planId: activePlan.id,
        lessonId: preparedLesson.id,
      },
    };
  }

  if (activePlan) {
    return {
      node: activePlan,
      parentPlanId: null,
      route: { kind: 'course-plan', planId: activePlan.id },
    };
  }

  const preparedPlan = plans.find((plan) => plan.status === 'prepared');
  if (preparedPlan) {
    return {
      node: preparedPlan,
      parentPlanId: null,
      route: { kind: 'course-plan', planId: preparedPlan.id },
    };
  }

  return {
    node: root,
    parentPlanId: null,
    route: { kind: 'course-roadmap' },
  };
}
