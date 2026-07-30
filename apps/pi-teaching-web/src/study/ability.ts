import {
  aggregateMethodSignals,
  readActiveTraces,
  readCard,
  readTraceRecords,
} from 'highschool-study-markdown/study-domain';
import type { AbilityProjection, EvidenceView } from '../shared/contracts';
import {
  resolveEvidenceTree,
  type NodeSessionScope,
  type SessionEvidenceReader,
} from './evidence-tree';

export function readAbilityProjection(root: string): AbilityProjection {
  const active = readActiveTraces(root);
  return {
    nodes: aggregateMethodSignals(root, active).map((signal) => ({
      method: signal.method,
      state: signal.score >= 0.75 && signal.distinctCardCount >= 2 ? 'steady' : 'unstable',
      score: signal.score,
      evidenceCount: signal.attemptCount,
      sources: signal.sourceRefs,
    })),
  };
}

export type ReadEvidenceOptions = {
  scope?: NodeSessionScope;
  sessions?: SessionEvidenceReader;
};

const roadmapScope = {
  nodeKind: 'roadmap',
  nodeId: 'roadmap',
  nodePath: 'ROADMAP.md',
  parentId: null,
  parentPath: null,
} as const satisfies NodeSessionScope;

const noSessions: SessionEvidenceReader = { read: () => null };

export function readEvidence(
  root: string,
  sourceRef: string,
  options: ReadEvidenceOptions = {},
): EvidenceView {
  const trace = readTraceRecords(root).find((item) => item.sourceRef === sourceRef);
  if (!trace) {
    if (!sourceRef.startsWith('claim:')) {
      throw new Error(`EVIDENCE_NOT_FOUND: ${sourceRef}`);
    }
    const node = resolveEvidenceTree(
      root,
      sourceRef,
      options.scope ?? roadmapScope,
      options.sessions ?? noSessions,
    );
    return {
      kind: 'handoff',
      source: sourceRef,
      state: node.state,
      node,
    };
  }
  const card = trace.cardPath ? readCard(root, trace.cardPath) : null;
  return {
    kind: 'trace',
    source: sourceRef,
    state: readActiveTraces(root).some((item) => item.sourceRef === sourceRef)
      ? 'active'
      : 'invalidated',
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
