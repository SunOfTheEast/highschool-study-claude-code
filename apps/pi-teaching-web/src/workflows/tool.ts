import { randomUUID } from 'node:crypto';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import type { DeepWorkflowRuntime } from './runtime';

const task = Type.Object({
  id: Type.String(),
  label: Type.String(),
  role: Type.String(),
  instruction: Type.String(),
  dependsOn: Type.Array(Type.String()),
  sourceHandles: Type.Array(Type.String()),
  readRoots: Type.Array(Type.String()),
});

export function createDeepWorkflowTool(
  runtime: DeepWorkflowRuntime,
  createId: () => string = () => `wf-${randomUUID()}`,
) {
  return defineTool({
    name: 'deep_workflow_propose',
    label: '发起多视角教学会诊',
    description: [
      'Use only after the deep-workflow Skill confirms two independent views could change the next teaching action.',
      'Gather authentic card and Trace handles first with card_search or trace_search.',
      'Use quick for at most three independent views; deep requires student confirmation.',
    ].join(' '),
    parameters: Type.Object({
      goal: Type.String(),
      mode: Type.Union([Type.Literal('quick'), Type.Literal('deep')]),
      maxConcurrency: Type.Integer({ minimum: 1, maximum: 3 }),
      tokenLimit: Type.Integer({ minimum: 1 }),
      timeoutMs: Type.Integer({ minimum: 1 }),
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
