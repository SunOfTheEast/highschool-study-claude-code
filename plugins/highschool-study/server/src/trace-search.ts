import { readActiveCardAlternatives } from './alternatives';
import { readCard, type CardHit } from './cards';
import { readActiveTraces, type TraceRecord } from './traces';

export type TraceSearchInput = {
  query: string | null;
  planId: string | null;
  lessonId: string | null;
  cardPath: string | null;
  limit: number;
};

export type TraceSearchResult = {
  traces: TraceRecord[];
  cardsByPath: Record<string, CardHit>;
};

function compareTrace(left: TraceRecord, right: TraceRecord): number {
  return left.recordedAt < right.recordedAt ? -1
    : left.recordedAt > right.recordedAt ? 1
      : left.lessonPath < right.lessonPath ? -1
        : left.lessonPath > right.lessonPath ? 1
          : left.eventId < right.eventId ? -1
            : left.eventId > right.eventId ? 1
              : 0;
}

function matchesQuery(trace: TraceRecord, query: string | null): boolean {
  if (query === null) return true;
  const terms = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (terms.length === 0) return true;
  const searchable = Object.values(trace).filter((value) => typeof value === 'string').join('\n').toLowerCase();
  return terms.every((term) => searchable.includes(term));
}

export function searchTraces(root: string, input: TraceSearchInput): TraceSearchResult {
  const activeTraces = readActiveTraces(root);
  const traces = activeTraces
    .filter((trace) => input.planId === null || trace.planId === input.planId)
    .filter((trace) => input.lessonId === null || trace.lessonId === input.lessonId)
    .filter((trace) => input.cardPath === null || trace.cardPath === input.cardPath)
    .filter((trace) => matchesQuery(trace, input.query))
    .sort(compareTrace)
    .slice(0, input.limit);
  const cardsByPath: Record<string, CardHit> = {};
  const paths = [...new Set(traces.flatMap((trace) => trace.cardPath === null ? [] : [trace.cardPath]))].sort();
  for (const path of paths) {
    const card = readCard(root, path);
    if (card !== null) {
      cardsByPath[path] = {
        ...card,
        traceHistory: activeTraces.filter((trace) => trace.cardPath === path),
        alternatives: readActiveCardAlternatives(root, path),
      };
    }
  }
  return { traces, cardsByPath };
}
