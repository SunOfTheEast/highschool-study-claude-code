import { readCard, type CardContent } from './cards';
import type { TraceRecord } from './traces';

export type MethodSignal = {
  method: string;
  evidenceWeight: number;
  earnedWeight: number;
  score: number;
  sourceRefs: string[];
};

const roleWeight = { primary: 2, secondary: 1 } as const;
const assessmentFactor = {
  correct: 1,
  partially_correct: 0.5,
  incorrect: 0,
  incomplete: 0,
} as const;
const supportFactor = { none: 1, tutor: 0.5, external: 0.75 } as const;

type MutableSignal = Omit<MethodSignal, 'score'>;

export function aggregateMethodSignals(root: string, traces: TraceRecord[]): MethodSignal[] {
  const cards = new Map<string, CardContent | null>();
  const signals = new Map<string, MutableSignal>();

  for (const trace of traces) {
    if (trace.cardPath === null) continue;
    let card = cards.get(trace.cardPath);
    if (card === undefined) {
      try {
        card = readCard(root, trace.cardPath);
      } catch {
        card = null;
      }
      cards.set(trace.cardPath, card);
    }
    if (card === null) continue;

    const factor = assessmentFactor[trace.assessment] * supportFactor[trace.support];
    for (const method of card.methods) {
      const weight = roleWeight[method.role];
      const signal = signals.get(method.name) ?? {
        method: method.name,
        evidenceWeight: 0,
        earnedWeight: 0,
        sourceRefs: [],
      };
      signal.evidenceWeight += weight;
      signal.earnedWeight += weight * factor;
      if (!signal.sourceRefs.includes(trace.sourceAnchor)) signal.sourceRefs.push(trace.sourceAnchor);
      signals.set(method.name, signal);
    }
  }

  return [...signals.values()]
    .map((signal) => ({
      ...signal,
      score: signal.earnedWeight / signal.evidenceWeight,
    }))
    .sort((left, right) => left.method < right.method ? -1 : left.method > right.method ? 1 : 0);
}
