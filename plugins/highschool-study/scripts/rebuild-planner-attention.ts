import { writeFileSync } from 'node:fs';
import { resolveInsideRoot } from '../server/src/learning-set';
import { aggregateMethodSignals, type MethodSignal } from '../server/src/method-signals';
import { readActiveTraces } from '../server/src/traces';

function sourceLink(sourceRef: string): string {
  return `[${sourceRef}](../${sourceRef})`;
}

function renderPlannerAttention(signals: MethodSignal[]): string {
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

if (import.meta.main) {
  const root = process.env.STUDY_LEARNING_SET;
  if (!root) throw new Error('STUDY_LEARNING_SET is required');
  rebuildPlannerAttention(root);
}
