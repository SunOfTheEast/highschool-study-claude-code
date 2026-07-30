import type { ViewQuery } from '../../shared/view-contracts';

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const cardPattern = /^cards\/[A-Za-z0-9][A-Za-z0-9._/-]*\.ya?ml$/;
const sourcePattern =
  /^(?:trace:[A-Za-z0-9._-]+|session:[A-Za-z0-9._-]+(?:#message:[A-Za-z0-9._-]+)?|card:cards\/[A-Za-z0-9][A-Za-z0-9._/-]*\.ya?ml|block:[A-Za-z0-9._-]+\/[A-Za-z0-9._-]+|claim:[A-Za-z0-9._/-]+#(?:learner-c\d+|teaching-t\d+)|memory:(?:student|teaching)\/[A-Za-z0-9._-]+)$/;

function clean(value: string | null): string | null {
  const result = value?.trim() ?? '';
  return result || null;
}

export function normalizeViewId(value: string | null): string | null {
  const result = clean(value);
  return result && idPattern.test(result) ? result : null;
}

function hasSafeSegments(value: string): boolean {
  return !value.split('/').some((segment) => (
    segment === '' || segment === '.' || segment === '..'
  ));
}

export function readViewQuery(params: URLSearchParams): ViewQuery {
  const planId = normalizeViewId(params.get('plan'));
  const lessonId = normalizeViewId(params.get('lesson'));
  const methodName = clean(params.get('method'));
  const cardPath = clean(params.get('card'));
  const evidenceSource = clean(params.get('source'));
  const topicId = clean(params.get('topic'));
  const range = params.get('range');
  return {
    planId,
    lessonId,
    methodName,
    cardPath: cardPath && cardPattern.test(cardPath) && hasSafeSegments(cardPath)
      ? cardPath
      : null,
    evidenceSource: evidenceSource
      && sourcePattern.test(evidenceSource)
      && hasSafeSegments(evidenceSource)
      ? evidenceSource
      : null,
    topicId: normalizeViewId(topicId),
    timeRange: range === 'lesson' || range === 'plan' ? range : 'all',
  };
}

export function formatViewQuery(query: ViewQuery): string {
  const params = new URLSearchParams();
  if (query.planId) params.set('plan', query.planId);
  if (query.lessonId) params.set('lesson', query.lessonId);
  if (query.methodName) params.set('method', query.methodName);
  if (query.cardPath) params.set('card', query.cardPath);
  if (query.evidenceSource) params.set('source', query.evidenceSource);
  if (query.topicId) params.set('topic', query.topicId);
  if (query.timeRange !== 'all') params.set('range', query.timeRange);
  const value = params.toString();
  return value ? `?${value}` : '';
}
