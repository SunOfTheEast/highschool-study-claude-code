import type { SessionKey } from '../shared/contracts';

const nodeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function checkedId(kind: 'Plan' | 'Lesson', id: string): string {
  if (!nodeIdPattern.test(id)) throw new Error(`${kind.toUpperCase()}_ID_INVALID: ${id}`);
  return id;
}

export function planNodePath(planId: string): string {
  return `plans/${checkedId('Plan', planId)}/PLAN.md`;
}

export function lessonNodePath(planId: string, lessonId: string): string {
  return `plans/${checkedId('Plan', planId)}/lessons/${checkedId('Lesson', lessonId)}.md`;
}

export function lessonSessionKey(planId: string, lessonId: string): SessionKey {
  return `lesson:${checkedId('Plan', planId)}:${checkedId('Lesson', lessonId)}`;
}

export function isPlanNodePath(path: string): boolean {
  return /^plans\/[A-Za-z0-9][A-Za-z0-9._-]*\/PLAN\.md$/.test(path);
}

export function isLessonNodePath(path: string): boolean {
  return /^plans\/[A-Za-z0-9][A-Za-z0-9._-]*\/lessons\/[A-Za-z0-9][A-Za-z0-9._-]*\.md$/
    .test(path);
}
