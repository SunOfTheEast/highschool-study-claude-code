import { readCardAlternatives } from './alternatives';
import { readCard } from './cards';
import {
  readTraceRecords,
  type TraceRecord,
} from './traces';

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
  traceFactors: number[];
  traceMethods: Map<string, 'primary' | 'secondary'>;
  traceSourceRefs: string[];
  alternativeFactors: Map<string, number>;
  alternativeSourceRefs: Map<string, string[]>;
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
      traceFactors: [],
      traceMethods: new Map<string, 'primary' | 'secondary'>(),
      traceSourceRefs: [],
      alternativeFactors: new Map<string, number>(),
      alternativeSourceRefs: new Map<string, string[]>(),
    };
    attempt.traceFactors.push(assessmentFactor[trace.assessment] * supportFactor[trace.support]);
    if (trace.methods !== null) {
      const primary = trace.methods.primary;
      if (attempt.traceMethods.get(primary) !== 'primary') {
        attempt.traceMethods.set(primary, 'primary');
      }
      for (const secondary of trace.methods.secondary) {
        if (!attempt.traceMethods.has(secondary)) {
          attempt.traceMethods.set(secondary, 'secondary');
        }
      }
    }
    if (!attempt.traceSourceRefs.includes(trace.sourceAnchor)) {
      attempt.traceSourceRefs.push(trace.sourceAnchor);
    }
    attempts.set(key, attempt);
  }

  const lessonPaths = [...new Set(traces.map((trace) => trace.lessonPath))];
  const traceRecords = lessonPaths.length === 0 ? [] : readTraceRecords(root, lessonPaths);
  const tracesBySource = new Map(traceRecords.map((trace) => [trace.sourceAnchor, trace]));
  const cardPaths = [...new Set(traceRecords.flatMap((trace) =>
    trace.cardPath === null ? [] : [trace.cardPath]))];

  for (const cardPath of cardPaths) {
    for (const alternative of readCardAlternatives(root, cardPath)) {
      if (alternative.method === null) continue;
      const source = tracesBySource.get(alternative.sourceTrace);
      if (source === undefined || source.cardPath !== alternative.cardPath) continue;
      const key = `${source.lessonPath}\u0000${source.blockId}\u0000${source.cardPath}`;
      const attempt = attempts.get(key) ?? {
        cardPath: source.cardPath,
        traceFactors: [],
        traceMethods: new Map<string, 'primary' | 'secondary'>(),
        traceSourceRefs: [],
        alternativeFactors: new Map<string, number>(),
        alternativeSourceRefs: new Map<string, string[]>(),
      };
      const factor = supportFactor[alternative.support];
      attempt.alternativeFactors.set(
        alternative.method,
        Math.max(attempt.alternativeFactors.get(alternative.method) ?? 0, factor),
      );
      const sourceRefs = attempt.alternativeSourceRefs.get(alternative.method) ?? [];
      if (!sourceRefs.includes(alternative.sourceTrace)) sourceRefs.push(alternative.sourceTrace);
      attempt.alternativeSourceRefs.set(alternative.method, sourceRefs);
      attempts.set(key, attempt);
    }
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
    const methodNames = new Set([
      ...attempt.traceMethods.keys(),
      ...attempt.alternativeFactors.keys(),
    ]);
    if (!cardExists || methodNames.size === 0) continue;

    const traceFactor = attempt.traceFactors.length === 0
      ? null
      : attempt.traceFactors.reduce((sum, value) => sum + value, 0)
        / attempt.traceFactors.length;
    for (const methodName of methodNames) {
      const traceMethodRole = attempt.traceMethods.get(methodName);
      const alternativeFactor = attempt.alternativeFactors.get(methodName) ?? null;
      const factor = Math.max(
        traceMethodRole === undefined ? 0 : traceFactor ?? 0,
        alternativeFactor ?? 0,
      );
      const role = alternativeFactor !== null || traceMethodRole === 'primary'
        ? 'primary'
        : 'secondary';
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
      const sourceRefs = [
        ...(traceMethodRole === undefined ? [] : attempt.traceSourceRefs),
        ...(attempt.alternativeSourceRefs.get(methodName) ?? []),
      ];
      for (const sourceRef of sourceRefs) {
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
