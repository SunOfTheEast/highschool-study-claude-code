import type {
  LessonNode,
  NodeLifecycleStatus,
  PublicTreeEntry,
} from '../../shared/contracts';
import type {
  CourseTreeNode,
  CourseViewProjection,
  PublicLessonView,
  ViewQuery,
} from '../../shared/view-contracts';
import { readHomeSnapshot } from '../home';
import { readLearningSet, readPlanWorkspace } from '../read-workspace';
import { readStudentLessonPreview } from '../student-plan-projection';
import { disclosureForLesson } from './view-disclosure';

const statusTitle: Record<NodeLifecycleStatus, string> = {
  candidate: '可能的下一步',
  prepared: '待开始课程',
  active: '正在进行',
  paused: '已暂停课程',
  closed: '已完成课程',
  completed: '已完成阶段',
  abandoned: '历史记录',
};

function lessonRoute(planId: string, lessonId: string): string {
  return `/course/plan/${encodeURIComponent(planId)}/lesson/${
    encodeURIComponent(lessonId)
  }`;
}

function planRoute(planId: string): string {
  return `/course/plan/${encodeURIComponent(planId)}`;
}

function publicLesson(
  root: string,
  entry: PublicTreeEntry,
  lesson: LessonNode,
): PublicLessonView {
  const preview = readStudentLessonPreview(root, lesson);
  const policy = disclosureForLesson(entry.status);
  const publicTitle = entry.status === 'prepared'
    ? statusTitle.prepared
    : lesson.title;
  return {
    id: lesson.id,
    status: entry.status,
    publicTitle,
    publicPurpose: entry.status === 'prepared'
      ? preview.publicPurpose
      : entry.publicPurpose || preview.publicPurpose,
    blockCount: lesson.blocks.length,
    blockKinds: [...new Set(lesson.blocks.map((block) => block.kind))],
    sourceNumbers: entry.status === 'prepared'
      ? preview.sourceNumbers
      : policy.mayExposeLessonBindings
        ? preview.sourceNumbers
        : [],
    canStart: entry.status === 'prepared',
    canReprepare: entry.status === 'prepared',
    canContinue: entry.status === 'active' || entry.status === 'paused',
    canReplay: entry.status === 'closed' || entry.status === 'abandoned',
  };
}

function candidateNode(
  entry: PublicTreeEntry,
  parentKey: string,
): CourseTreeNode {
  return {
    key: `candidate:${entry.handle}`,
    kind: entry.kind,
    nodeId: null,
    parentKey,
    handle: entry.handle,
    title: statusTitle.candidate,
    publicPurpose: entry.publicPurpose,
    status: 'candidate',
    after: entry.after,
    dependsOn: [...entry.dependsOn],
    route: null,
    sessionKey: null,
    children: [],
  };
}

function lessonNode(
  root: string,
  planId: string,
  parentKey: string,
  entry: PublicTreeEntry,
  lesson: LessonNode,
): CourseTreeNode {
  const view = publicLesson(root, entry, lesson);
  return {
    key: `lesson:${lesson.id}`,
    kind: 'lesson',
    nodeId: lesson.id,
    parentKey,
    handle: entry.handle,
    title: view.publicTitle,
    publicPurpose: view.publicPurpose ?? '',
    status: entry.status,
    after: entry.after,
    dependsOn: [...entry.dependsOn],
    route: lessonRoute(planId, lesson.id),
    sessionKey: entry.status === 'prepared' || lesson.tutorSessionId === null
      ? null
      : lesson.sessionKey,
    children: [],
  };
}

function continueRoute(
  target: ReturnType<typeof readHomeSnapshot>['continueTarget'],
): string {
  if (target.kind === 'lesson' && target.planId && target.lessonId) {
    return lessonRoute(target.planId, target.lessonId);
  }
  if (target.kind === 'coach' && target.planId) return planRoute(target.planId);
  return '/course';
}

export function readCourseView(
  root: string,
  query: Pick<ViewQuery, 'planId' | 'lessonId'>,
): CourseViewProjection {
  const learningSet = readLearningSet(root);
  const selectedPlanSummary = query.planId
    ? learningSet.plans.find((plan) => plan.id === query.planId) ?? null
    : null;
  const selectedWorkspace = selectedPlanSummary
    ? readPlanWorkspace(root, selectedPlanSummary.id)
    : null;

  const planNodes = learningSet.planTree.map((entry): CourseTreeNode => {
    if (entry.nodeId === null) return candidateNode(entry, 'roadmap:@roadmap');
    const plan = learningSet.plans.find((candidate) => (
      candidate.id === entry.nodeId
    ));
    if (!plan) throw new Error(`COURSE_PLAN_MISSING: ${entry.nodeId}`);
    const key = `plan:${plan.id}`;
    const children = selectedWorkspace?.plan.id === plan.id
      ? selectedWorkspace.lessonTree.map((lessonEntry) => {
          if (lessonEntry.nodeId === null) return candidateNode(lessonEntry, key);
          const lesson = selectedWorkspace.lessons.find((candidate) => (
            candidate.id === lessonEntry.nodeId
          ));
          if (!lesson) {
            throw new Error(`COURSE_LESSON_MISSING: ${lessonEntry.nodeId}`);
          }
          return lessonNode(root, plan.id, key, lessonEntry, lesson);
        })
      : [];
    return {
      key,
      kind: 'plan',
      nodeId: plan.id,
      parentKey: 'roadmap:@roadmap',
      handle: entry.handle,
      title: plan.title,
      publicPurpose: entry.publicPurpose,
      status: entry.status,
      after: entry.after,
      dependsOn: [...entry.dependsOn],
      route: planRoute(plan.id),
      sessionKey: `coach:${plan.id}`,
      children,
    };
  });

  const roadmap: CourseTreeNode = {
    key: 'roadmap:@roadmap',
    kind: 'roadmap',
    nodeId: '@roadmap',
    parentKey: null,
    handle: '@roadmap',
    title: learningSet.title,
    publicPurpose: learningSet.goal,
    status: 'active',
    after: null,
    dependsOn: [],
    route: '/course',
    sessionKey: 'coach:@roadmap',
    children: planNodes,
  };

  const selectedLessonEntry = selectedWorkspace && query.lessonId
    ? selectedWorkspace.lessonTree.find((entry) => (
      entry.nodeId === query.lessonId
    )) ?? null
    : null;
  const selectedLessonNode = selectedWorkspace && selectedLessonEntry?.nodeId
    ? selectedWorkspace.lessons.find((lesson) => (
      lesson.id === selectedLessonEntry.nodeId
    )) ?? null
    : null;
  const selectedLesson = selectedLessonEntry && selectedLessonNode
    ? publicLesson(root, selectedLessonEntry, selectedLessonNode)
    : null;
  const studentPlan = selectedWorkspace
    ? {
        closedLessons: selectedWorkspace.lessons.filter((lesson) => (
          lesson.status === 'closed'
        )).length,
        registeredLessons: selectedWorkspace.lessons.filter((lesson) => (
          lesson.status !== 'abandoned'
        )).length,
      }
    : null;
  const home = readHomeSnapshot(root);

  return {
    learningSet: {
      title: learningSet.title,
      overview: learningSet.overview,
      goal: learningSet.goal,
    },
    roadmap,
    plans: planNodes,
    selectedPlan: selectedWorkspace && studentPlan ? {
      id: selectedWorkspace.plan.id,
      title: selectedWorkspace.plan.title,
      status: selectedWorkspace.plan.status as NodeLifecycleStatus,
      goal: selectedWorkspace.plan.goal,
      capabilityStandard: selectedWorkspace.plan.capabilityStandard,
      currentPosition: selectedWorkspace.plan.currentPosition,
      closedLessons: studentPlan.closedLessons,
      registeredLessons: studentPlan.registeredLessons,
    } : null,
    selectedLesson,
    continueTarget: {
      route: continueRoute(home.continueTarget),
      title: home.continueTarget.title,
      detail: home.continueTarget.detail,
    },
  };
}
