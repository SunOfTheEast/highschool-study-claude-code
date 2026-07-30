import type { TraceRecord } from './traces';

export type TraceIndex = { byCardPath: Map<string, TraceRecord[]> };

function compareTrace(left: TraceRecord, right: TraceRecord): number {
  return left.occurredAt < right.occurredAt ? -1
    : left.occurredAt > right.occurredAt ? 1
      : left.lessonPath < right.lessonPath ? -1
        : left.lessonPath > right.lessonPath ? 1
          : left.traceId < right.traceId ? -1
            : left.traceId > right.traceId ? 1
              : 0;
}

export function buildTraceIndex(activeTraces: TraceRecord[]): TraceIndex {
  const byCardPath = new Map<string, TraceRecord[]>();
  for (const trace of activeTraces) {
    if (trace.cardPath === null) continue;
    const history = byCardPath.get(trace.cardPath) ?? [];
    history.push(trace);
    byCardPath.set(trace.cardPath, history);
  }
  for (const history of byCardPath.values()) history.sort(compareTrace);
  return { byCardPath };
}
