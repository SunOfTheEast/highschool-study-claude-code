import { readActiveTraces } from 'highschool-study-markdown/study-domain';
import type {
  HomeContinueTarget,
  HomeSnapshot,
  LessonNode,
  PlanWorkspaceSnapshot,
} from '../shared/contracts';
import { resolveContinuePath } from '../shared/home';
import { readAbilityProjection } from './ability';
import { readLearningSet, readPlanWorkspace } from './read-workspace';

export { resolveContinuePath };

const lessonPriority = ['active', 'paused', 'prepared'] as const;

function lessonRoute(planId: string, lessonId: string): string {
  return `/plan/${encodeURIComponent(planId)}/lesson/${encodeURIComponent(lessonId)}`;
}

function coachRoute(planId: string): string {
  return `/plan/${encodeURIComponent(planId)}`;
}

function prioritizedLesson(workspace: PlanWorkspaceSnapshot): LessonNode | null {
  for (const status of lessonPriority) {
    const lesson = workspace.lessons.find((candidate) => candidate.status === status);
    if (lesson) return lesson;
  }
  return null;
}

function lessonTarget(planId: string, lesson: LessonNode): HomeContinueTarget {
  const detail = lesson.status === 'active'
    ? '课堂进行中，从当前节点继续。'
    : lesson.status === 'paused'
      ? '课堂已暂停，当前节点和 Session 都已保留。'
      : lesson.status === 'prepared'
        ? '课程已备好，确认后开始课堂。'
        : '继续这节课。';
  return {
    route: lessonRoute(planId, lesson.id),
    kind: 'lesson',
    planId,
    lessonId: lesson.id,
    title: lesson.title,
    detail,
  };
}

export function readHomeSnapshot(root: string): HomeSnapshot {
  const learningSet = readLearningSet(root);
  const workspaces = learningSet.plans.map((plan) => readPlanWorkspace(root, plan.id));
  const unfinished = workspaces.filter((workspace) => workspace.plan.status !== 'completed');
  const currentWorkspace = unfinished.find((workspace) => prioritizedLesson(workspace))
    ?? unfinished[0]
    ?? null;
  const currentPlan = currentWorkspace?.plan ?? null;

  let continueTarget: HomeContinueTarget;
  const lesson = currentWorkspace ? prioritizedLesson(currentWorkspace) : null;
  if (currentWorkspace && lesson) {
    continueTarget = lessonTarget(currentWorkspace.plan.id, lesson);
  } else if (currentWorkspace) {
    continueTarget = {
      route: coachRoute(currentWorkspace.plan.id),
      kind: 'coach',
      planId: currentWorkspace.plan.id,
      lessonId: null,
      title: currentWorkspace.plan.title,
      detail: '回到学习顾问，复盘当前位置并决定下一步。',
    };
  } else {
    continueTarget = {
      route: '/roadmap',
      kind: 'roadmap',
      planId: null,
      lessonId: null,
      title: learningSet.plans.length === 0 ? '建立第一个学习周期' : '规划下一阶段',
      detail: learningSet.plans.length === 0
        ? '先和学习总览明确目标与第一个 Plan。'
        : '现有学习周期已经完成，回到学习总览选择下一阶段。',
    };
  }

  const eligibleContinueRoutes = unfinished.flatMap((workspace) => [
    coachRoute(workspace.plan.id),
    ...workspace.lessons
      .filter((candidate) => lessonPriority.includes(
        candidate.status as typeof lessonPriority[number],
      ))
      .map((candidate) => lessonRoute(workspace.plan.id, candidate.id)),
  ]);
  const progressLessons = currentWorkspace?.lessons
    .filter((candidate) => candidate.status !== 'abandoned') ?? [];
  const traces = readActiveTraces(root)
    .sort((left, right) => right.recordedAt.localeCompare(left.recordedAt));
  const abilities = readAbilityProjection(root).nodes;
  const signals: HomeSnapshot['signals'] = [];
  const newestTrace = traces[0];
  if (newestTrace) {
    signals.push({
      label: '最近学习记录',
      value: newestTrace.note,
      source: newestTrace.sourceAnchor,
    });
  }
  const ability = abilities[0];
  if (ability) {
    signals.push({
      label: '方法进展',
      value: `${ability.method} · ${
        ability.state === 'steady' ? '较稳' : ability.state === 'unstable' ? '仍需巩固' : '待观察'
      }`,
      source: ability.sources[0] ?? null,
    });
  }
  const closed = workspaces.flatMap((workspace) => workspace.lessons
    .filter((candidate) => candidate.status === 'closed')
    .map((candidate) => ({ workspace, lesson: candidate })));
  const latestClosed = closed.at(-1);

  return {
    learningSet,
    currentPlan,
    eligibleContinueRoutes,
    continueTarget,
    lessonProgress: {
      completed: progressLessons.filter((candidate) => candidate.status === 'closed').length,
      total: progressLessons.length,
    },
    coachNote: currentPlan
      ? currentPlan.nextLessonCandidate || currentPlan.currentPosition || currentPlan.planSummary
      : '',
    signals: signals.slice(0, 2),
    recentReplay: latestClosed ? {
      lessonId: latestClosed.lesson.id,
      title: latestClosed.lesson.title,
      route: lessonRoute(latestClosed.workspace.plan.id, latestClosed.lesson.id),
    } : null,
  };
}
