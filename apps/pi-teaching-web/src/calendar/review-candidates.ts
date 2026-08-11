import { resolve } from 'node:path';
import type {
  CalendarReviewCandidate,
} from '../shared/contracts';
import {
  currentReviewAsset,
  readReviewAssetSummaryIndex,
} from '../runtime/asset-review-context';
import { ensureAssetReviewIndex } from '../study/asset-review-index';
import { readLearningSetGuide } from '../study/markdown';

export { calendarReviewSelection } from './review-selection';

export function readCalendarReviewCandidates(
  roots: readonly string[],
): CalendarReviewCandidate[] {
  const candidates: CalendarReviewCandidate[] = [];
  for (const root of [...new Set(roots.map((candidate) => resolve(candidate)))]) {
    let learningSetName: string;
    let projections: ReturnType<typeof ensureAssetReviewIndex>;
    let summaries: ReturnType<typeof readReviewAssetSummaryIndex>;
    try {
      learningSetName = readLearningSetGuide(root).title;
      projections = ensureAssetReviewIndex(root);
      summaries = readReviewAssetSummaryIndex(root);
    } catch {
      continue;
    }
    for (const projection of projections) {
      if (!projection.active || projection.dueOn === null) continue;
      const summary = summaries.get(`${projection.asset.kind}:${projection.asset.id}`);
      let unavailable = false;
      let title = summary?.title ?? projection.asset.id;
      try {
        title = currentReviewAsset(root, projection.asset).title;
      } catch {
        unavailable = true;
      }
      candidates.push({
        learningSetPath: root,
        learningSetName,
        asset: { ...projection.asset },
        title,
        dueOn: projection.dueOn,
        stage: projection.stage,
        lastResult: projection.lastResult,
        unavailable,
      });
    }
  }
  return candidates.sort((left, right) => (
    left.dueOn.localeCompare(right.dueOn)
    || left.learningSetName.localeCompare(right.learningSetName)
    || left.asset.kind.localeCompare(right.asset.kind)
    || left.asset.id.localeCompare(right.asset.id)
  ));
}
