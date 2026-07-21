import {
  aggregateMethodSignals,
  readActiveTraces,
  readCard,
} from 'highschool-study-markdown/study-domain';
import type { AbilityProjection, EvidenceView } from '../shared/contracts';

export function readAbilityProjection(root: string): AbilityProjection {
  const active = readActiveTraces(root);
  const counts = new Map<string, number>();
  for (const trace of active) {
    if (!trace.cardPath) continue;
    const card = readCard(root, trace.cardPath);
    for (const method of card?.methods ?? []) {
      counts.set(method.name, (counts.get(method.name) ?? 0) + 1);
    }
  }
  return {
    nodes: aggregateMethodSignals(root, active).map((signal) => ({
      method: signal.method,
      state: signal.score >= 0.75 ? 'steady' : 'unstable',
      score: signal.score,
      evidenceCount: counts.get(signal.method) ?? 0,
      sources: signal.sourceRefs,
    })),
  };
}

export function readEvidence(root: string, sourceAnchor: string): EvidenceView {
  const trace = readActiveTraces(root).find((item) => item.sourceAnchor === sourceAnchor);
  if (!trace) throw new Error(`TRACE_NOT_FOUND: ${sourceAnchor}`);
  const card = trace.cardPath ? readCard(root, trace.cardPath) : null;
  return {
    source: sourceAnchor,
    trace: {
      lessonId: trace.lessonId,
      blockId: trace.blockId,
      assessment: trace.assessment,
      support: trace.support,
      note: trace.note,
    },
    card: card
      ? {
        path: card.path,
        title: card.title,
        goal: card.goal,
        methods: card.methods,
      }
      : null,
  };
}
