import { randomUUID } from 'node:crypto';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { DeepWorkflowRuntime } from './runtime';

const task = Type.Object({
  id: Type.String(),
  label: Type.String(),
  role: Type.String({
    description: 'Use the exact role `Evidence Scout` for isolated cross-card, cross-Lesson or Plan-scale evidence recall.',
  }),
  instruction: Type.String({
    description: 'State the evidence question and real Plan/Lesson scope. The child performs the broad search itself.',
  }),
  dependsOn: Type.Array(Type.String()),
  sourceHandles: Type.Array(Type.String(), {
    description: 'Known narrow scope handles only. Use an empty array when the Evidence Scout must discover sources; do not prefetch broad card or Trace payloads.',
  }),
  readRoots: Type.Array(Type.String(), {
    description: 'Roots under the learning-set that the child may read, such as plans, lessons, cards and graph.',
  }),
});

export function createDeepWorkflowTool(
  runtime: DeepWorkflowRuntime,
  createId: () => string = () => `wf-${randomUUID()}`,
) {
  return defineTool({
    name: 'deep_workflow_propose',
    label: '发起隔离式教学工作流',
    description: [
      'Use one Quick Evidence Scout for cross-card, cross-Lesson or Plan-scale recall when keeping broad results out of the parent context is useful.',
      'Pass the evidence question and known scope only; the child discovers authentic cards and active Trace.',
      'Use multiple tasks only for genuinely independent questions. Deep workflows require student confirmation.',
    ].join(' '),
    parameters: Type.Object({
      goal: Type.String(),
      mode: Type.Union([Type.Literal('quick'), Type.Literal('deep')]),
      maxConcurrency: Type.Integer({ minimum: 1, maximum: 3 }),
      tokenLimit: Type.Integer({
        minimum: 1,
        description: 'Total child budget, including card and Trace tool results. Use 50,000 for one Plan-scale Evidence Scout.',
      }),
      timeoutMs: Type.Integer({
        minimum: 1,
        description: 'Quick mode must use at most 45,000 ms. Deep mode may use a longer timeout.',
      }),
      tasks: Type.Array(task),
    }),
    execute: async (_toolCallId, input, signal) => {
      const snapshot = await runtime.propose({ ...input, id: createId() }, signal);
      const value = {
        workflowId: snapshot.id,
        status: snapshot.status,
        requires_confirmation: input.mode === 'deep' && snapshot.status === 'proposed',
        results: snapshot.tasks
          .filter((item) => item.result !== null)
          .map((item) => ({ taskId: item.id, role: item.role, result: item.result })),
      };
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: snapshot,
      };
    },
  });
}
