import type { LessonHandout } from '../shared/contracts';
import { StudyDocumentError, readLesson, readPlan, readRoadmap } from './markdown';
import { lessonNodePath, planNodePath } from './node-paths';

export function readLessonHandout(
  root: string,
  planId: string,
  lessonId: string,
  blockIds: readonly string[],
  options: { requirePrepared?: boolean } = {},
): LessonHandout {
  if (blockIds.length === 0) {
    throw new StudyDocumentError('ROADMAP.md', 'handout requires at least one Block');
  }
  const seen = new Set<string>();
  for (const blockId of blockIds) {
    if (seen.has(blockId)) {
      throw new StudyDocumentError('ROADMAP.md', `duplicate handout Block ${blockId}`);
    }
    seen.add(blockId);
  }

  const roadmap = readRoadmap(root);
  const planReference = roadmap.plans.find((reference) => reference.id === planId);
  if (!planReference) {
    throw new StudyDocumentError(roadmap.path, `Plan is not linked by ROADMAP.md: ${planId}`);
  }
  const expectedPlanPath = planNodePath(planId);
  if (planReference.path !== expectedPlanPath) {
    throw new StudyDocumentError(
      roadmap.path,
      `Plan path must be ${expectedPlanPath}`,
    );
  }
  const plan = readPlan(root, planReference.path);
  if (
    plan.id !== planId
    || plan.parentId !== roadmap.id
    || plan.parentPath !== roadmap.path
  ) {
    throw new StudyDocumentError(plan.path, 'Plan parent does not match ROADMAP.md');
  }

  const lessonReference = plan.lessons.find((reference) => reference.id === lessonId);
  if (!lessonReference) {
    throw new StudyDocumentError(
      plan.path,
      `Lesson is not linked by the current Plan: ${lessonId}`,
    );
  }
  const expectedLessonPath = lessonNodePath(planId, lessonId);
  if (lessonReference.path !== expectedLessonPath) {
    throw new StudyDocumentError(
      plan.path,
      `Lesson path must be ${expectedLessonPath}`,
    );
  }
  const lesson = readLesson(root, lessonReference.path);
  if (
    lesson.id !== lessonId
    || lesson.parentId !== plan.id
    || lesson.parentPath !== plan.path
  ) {
    throw new StudyDocumentError(
      lesson.path,
      `Lesson parent does not match ${plan.path}`,
    );
  }
  if (options.requirePrepared === true && lesson.status !== 'prepared') {
    throw new StudyDocumentError(
      lesson.path,
      'Lesson must be prepared before handout publication',
    );
  }

  const byId = new Map(lesson.blocks.map((block) => [block.id, block]));
  const blocks = blockIds.map((blockId) => {
    const block = byId.get(blockId);
    if (!block) {
      throw new StudyDocumentError(lesson.path, `handout Block not found: ${blockId}`);
    }
    return {
      id: block.id,
      title: block.title,
      kind: block.kind,
      studentView: block.studentView,
    };
  });

  return {
    kind: 'lesson-handout',
    planId,
    lessonId,
    title: lesson.title,
    lessonGoal: lesson.lessonGoal,
    blocks,
  };
}
