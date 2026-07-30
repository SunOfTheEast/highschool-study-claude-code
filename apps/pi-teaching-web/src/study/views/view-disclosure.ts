import type {
  BlockStatus,
  NodeLifecycleStatus,
} from '../../shared/contracts';

export type ViewDisclosurePolicy = {
  mayExposeLessonBindings: boolean;
  visibleBlockStatuses: BlockStatus[];
  mayExposeHistoricalLineage: boolean;
  mayExposeTeachingClaimText: false;
};

export function disclosureForLesson(
  status: NodeLifecycleStatus | null,
): ViewDisclosurePolicy {
  if (status === 'active' || status === 'paused') {
    return {
      mayExposeLessonBindings: true,
      visibleBlockStatuses: ['active', 'completed'],
      mayExposeHistoricalLineage: true,
      mayExposeTeachingClaimText: false,
    };
  }
  if (status === 'closed' || status === 'completed' || status === 'abandoned') {
    return {
      mayExposeLessonBindings: true,
      visibleBlockStatuses: ['completed'],
      mayExposeHistoricalLineage: true,
      mayExposeTeachingClaimText: false,
    };
  }
  return {
    mayExposeLessonBindings: false,
    visibleBlockStatuses: [],
    mayExposeHistoricalLineage: false,
    mayExposeTeachingClaimText: false,
  };
}
