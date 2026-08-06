const nodeIdPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

function checkedId(label: string, value: string): string {
  if (!nodeIdPattern.test(value)) throw new Error(`${label}_INVALID: ${value}`);
  return value;
}

function checkedBlockIds(blockIds: readonly string[]): string[] {
  if (blockIds.length === 0) throw new Error('HANDOUT_BLOCK_IDS_REQUIRED');
  const values = blockIds.map((id) => checkedId('HANDOUT_BLOCK_ID', id));
  if (new Set(values).size !== values.length) {
    throw new Error('HANDOUT_BLOCK_ID_DUPLICATE');
  }
  return values;
}

function encodedParts(
  planId: string,
  lessonId: string,
  blockIds: readonly string[],
): { plan: string; lesson: string; blocks: string } {
  return {
    plan: encodeURIComponent(checkedId('PLAN_ID', planId)),
    lesson: encodeURIComponent(checkedId('LESSON_ID', lessonId)),
    blocks: checkedBlockIds(blockIds).map(encodeURIComponent).join(','),
  };
}

export function parseHandoutBlockSegment(value: string): string[] | null {
  try {
    const decoded = decodeURIComponent(value);
    if (decoded.length === 0) return null;
    const blockIds = decoded.split(',');
    if (
      blockIds.some((id) => !nodeIdPattern.test(id))
      || new Set(blockIds).size !== blockIds.length
    ) {
      return null;
    }
    return blockIds;
  } catch {
    return null;
  }
}

export function formatLessonHandoutPath(
  planId: string,
  lessonId: string,
  blockIds: readonly string[],
): string {
  const value = encodedParts(planId, lessonId, blockIds);
  return `/course/plan/${value.plan}/lesson/${value.lesson}/handout/${value.blocks}`;
}

export function formatLessonHandoutApiPath(
  planId: string,
  lessonId: string,
  blockIds: readonly string[],
): string {
  const value = encodedParts(planId, lessonId, blockIds);
  return `/api/plans/${value.plan}/lessons/${value.lesson}/handout/${value.blocks}`;
}
