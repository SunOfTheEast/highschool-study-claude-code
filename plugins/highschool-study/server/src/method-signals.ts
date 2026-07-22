import { readCard } from './cards';
import type { TraceRecord } from './traces';

export type MethodSignal = {
  method: string;
  evidenceWeight: number;
  earnedWeight: number;
  score: number;
  attemptCount: number;
  distinctCardCount: number;
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

type MutableSignal = Omit<MethodSignal, 'score' | 'distinctCardCount'> & {
  cardPaths: Set<string>;
};

type CardAttempt = {
  cardPath: string;
  factors: number[];
  methods: Map<string, 'primary' | 'secondary'>;
  sourceRefs: string[];
};

export function aggregateMethodSignals(root: string, traces: TraceRecord[]): MethodSignal[] {
  const cards = new Map<string, boolean>();
  const signals = new Map<string, MutableSignal>();
  const attempts = new Map<string, CardAttempt>();

  for (const trace of traces) {
    if (trace.cardPath === null) continue;
    const key = `${trace.lessonPath}\u0000${trace.blockId}\u0000${trace.cardPath}`;
    const attempt = attempts.get(key) ?? {
      cardPath: trace.cardPath,
      factors: [],
      methods: new Map<string, 'primary' | 'secondary'>(),
      sourceRefs: [],
    };
    attempt.factors.push(assessmentFactor[trace.assessment] * supportFactor[trace.support]);
    if (trace.methods !== null) {
      const primary = trace.methods.primary;
      if (attempt.methods.get(primary) !== 'primary') attempt.methods.set(primary, 'primary');
      for (const secondary of trace.methods.secondary) {
        if (!attempt.methods.has(secondary)) attempt.methods.set(secondary, 'secondary');
      }
    }
    if (!attempt.sourceRefs.includes(trace.sourceAnchor)) attempt.sourceRefs.push(trace.sourceAnchor);
    attempts.set(key, attempt);
  }

  for (const attempt of attempts.values()) {
    let cardExists = cards.get(attempt.cardPath);
    if (cardExists === undefined) {
      try {
        cardExists = readCard(root, attempt.cardPath) !== null;
      } catch {
        cardExists = false;
      }
      cards.set(attempt.cardPath, cardExists);
    }
    if (!cardExists || attempt.methods.size === 0) continue;

    const factor = attempt.factors.reduce((sum, value) => sum + value, 0) / attempt.factors.length;
    for (const [methodName, role] of attempt.methods) {
      const weight = roleWeight[role];
      const signal = signals.get(methodName) ?? {
        method: methodName,
        evidenceWeight: 0,
        earnedWeight: 0,
        attemptCount: 0,
        cardPaths: new Set<string>(),
        sourceRefs: [],
      };
      signal.evidenceWeight += weight;
      signal.earnedWeight += weight * factor;
      signal.attemptCount += 1;
      signal.cardPaths.add(attempt.cardPath);
      for (const sourceRef of attempt.sourceRefs) {
        if (!signal.sourceRefs.includes(sourceRef)) signal.sourceRefs.push(sourceRef);
      }
      signals.set(methodName, signal);
    }
  }

  return [...signals.values()]
    .map((signal) => ({
      method: signal.method,
      evidenceWeight: signal.evidenceWeight,
      earnedWeight: signal.earnedWeight,
      score: signal.earnedWeight / signal.evidenceWeight,
      attemptCount: signal.attemptCount,
      distinctCardCount: signal.cardPaths.size,
      sourceRefs: signal.sourceRefs,
    }))
    .sort((left, right) => left.method < right.method ? -1 : left.method > right.method ? 1 : 0);
}
