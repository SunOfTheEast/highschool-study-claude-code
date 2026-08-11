import type {
  CalendarReviewCandidate,
  LearningAssetHandle,
  LearningContextReference,
} from '../shared/contracts';

export function calendarReviewSelection(
  candidates: readonly CalendarReviewCandidate[],
): { learningSetPath: string; contexts: LearningContextReference[] } {
  if (candidates.length === 0) throw new Error('CALENDAR_REVIEW_SELECTION_EMPTY');
  if (candidates.some((candidate) => candidate.unavailable)) {
    throw new Error('CALENDAR_REVIEW_SELECTION_UNAVAILABLE');
  }
  const learningSetPath = candidates[0]!.learningSetPath;
  if (candidates.some((candidate) => candidate.learningSetPath !== learningSetPath)) {
    throw new Error('CALENDAR_REVIEW_SELECTION_MIXED_SETS');
  }
  const seen = new Set<string>();
  const contexts = candidates.map((candidate): LearningAssetHandle => {
    const key = `${candidate.asset.kind}:${candidate.asset.id}`;
    if (seen.has(key)) throw new Error('CALENDAR_REVIEW_SELECTION_DUPLICATE');
    seen.add(key);
    return { ...candidate.asset };
  });
  return { learningSetPath, contexts };
}
