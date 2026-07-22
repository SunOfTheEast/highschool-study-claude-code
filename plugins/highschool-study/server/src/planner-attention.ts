import { writeFileSync } from 'node:fs';
import { resolveInsideRoot } from './learning-set';
import { aggregateMethodSignals, type MethodSignal } from './method-signals';
import {
  appendTrace,
  readActiveTraces,
  type TraceAppendInput,
} from './traces';

function sourceLink(sourceRef: string): string {
  return `[${sourceRef}](../${sourceRef})`;
}

export function renderPlannerAttention(signals: MethodSignal[]): string {
  const lines = [
    '---',
    'id: planner-attention',
    'kind: preparation-projection',
    '---',
    '# Planner Attention',
    '',
    'Uncalibrated preparation signal; not a mastery claim.',
    '',
    '## Method Signals',
    '',
  ];
  for (const signal of signals) {
    lines.push(
      `- ${signal.method}: ${signal.score.toFixed(3)} (earned ${signal.earnedWeight} / evidence ${signal.evidenceWeight})`,
      `  Sources: ${signal.sourceRefs.map(sourceLink).join(', ')}`,
    );
  }
  lines.push('');
  return lines.join('\n');
}

export function rebuildPlannerAttention(root: string): void {
  const signals = aggregateMethodSignals(root, readActiveTraces(root));
  writeFileSync(
    resolveInsideRoot(root, 'memory/planner-attention.md'),
    renderPlannerAttention(signals),
    'utf8',
  );
}

export function appendTraceWithProjection(
  root: string,
  input: TraceAppendInput,
  now: () => Date,
) {
  const result = appendTrace(root, input, now);
  rebuildPlannerAttention(root);
  return result;
}
