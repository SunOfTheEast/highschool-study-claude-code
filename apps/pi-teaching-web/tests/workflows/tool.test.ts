import { expect, test } from 'bun:test';
import { createDeepWorkflowTool } from '../../src/workflows/tool';

test('runs quick mode inline but leaves deep mode proposed', async () => {
  const calls: string[] = [];
  const runtime = {
    propose: async (graph: { mode: string }) => {
      calls.push(graph.mode);
      return {
        id: `wf-${graph.mode}`,
        status: graph.mode === 'quick' ? 'completed' : 'proposed',
        tasks: [],
      };
    },
  } as never;
  const tool = createDeepWorkflowTool(runtime, () => 'wf-generated');
  const base = {
    goal: '检查',
    maxConcurrency: 2,
    tokenLimit: 10_000,
    timeoutMs: 40_000,
    tasks: [],
  };
  const quick = await tool.execute(
    'call-1',
    { ...base, mode: 'quick' },
    undefined,
    undefined,
    {} as never,
  );
  const deep = await tool.execute(
    'call-2',
    { ...base, mode: 'deep' },
    undefined,
    undefined,
    {} as never,
  );
  expect(calls).toEqual(['quick', 'deep']);
  expect(JSON.stringify(quick.content)).toContain('completed');
  expect(JSON.stringify(deep.content)).toContain('requires_confirmation');
  expect(JSON.stringify(deep.content)).toContain('true');
});
