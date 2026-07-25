import { expect, test } from 'bun:test';
import { createDeepWorkflowTool } from '../../src/workflows/tool';

test('runs one Evidence Scout inline without parent prefetch', async () => {
  const calls: string[] = [];
  let proposed: Record<string, unknown> | null = null;
  const runtime = {
    propose: async (graph: { mode: string; tasks: unknown[] }) => {
      calls.push(graph.mode);
      proposed = graph as Record<string, unknown>;
      return {
        id: `wf-${graph.mode}`,
        status: 'completed',
        tasks: [{
          id: 'evidence',
          role: 'Evidence Scout',
          result: {
            card_index: [{
              cardPath: 'cards/a.yaml',
              title: null,
              goal: null,
              methods: { primary: null, secondary: [] },
              reason: 'active Trace 命中。',
              traceRefs: ['lessons/l.md#trace-event-1'],
            }],
            findings: [],
            evidence_refs: ['cards/a.yaml'],
            recommended_action: '',
            risks: [],
          },
        }],
      };
    },
  } as never;
  const tool = createDeepWorkflowTool(runtime, () => 'wf-generated');
  const quick = await tool.execute(
    'call-1',
    {
      goal: '检查跨题卡证据',
      mode: 'quick',
      maxConcurrency: 1,
      tokenLimit: 10_000,
      timeoutMs: 40_000,
      tasks: [{
        id: 'evidence',
        label: '检索 Plan 证据',
        role: 'Evidence Scout',
        instruction: 'Search the current Plan.',
        dependsOn: [],
        sourceHandles: [],
        readRoots: ['plans', 'lessons', 'cards', 'graph'],
      }],
    },
    undefined,
    undefined,
    {} as never,
  );

  expect(calls).toEqual(['quick']);
  expect(proposed).toMatchObject({
    id: 'wf-generated',
    mode: 'quick',
    tasks: [{
      role: 'Evidence Scout',
      sourceHandles: [],
    }],
  });
  const content = JSON.stringify(quick.content);
  expect(content).toContain('wf-quick');
  expect(content).toContain('cards/a.yaml');
  expect(content).not.toContain('solution');
  expect(content).not.toContain('transcript');
});

test('leaves deep mode proposed for student confirmation', async () => {
  const calls: string[] = [];
  const runtime = {
    propose: async (graph: { mode: string }) => {
      calls.push(graph.mode);
      return {
        id: `wf-${graph.mode}`,
        status: 'proposed',
        tasks: [],
      };
    },
  } as never;
  const tool = createDeepWorkflowTool(runtime, () => 'wf-generated');
  const deep = await tool.execute(
    'call-2',
    {
      goal: '检查',
      mode: 'deep',
      maxConcurrency: 2,
      tokenLimit: 20_000,
      timeoutMs: 90_000,
      tasks: [],
    },
    undefined,
    undefined,
    {} as never,
  );

  expect(calls).toEqual(['deep']);
  expect(JSON.stringify(deep.content)).toContain('requires_confirmation');
  expect(JSON.stringify(deep.content)).toContain('true');
});

test('describes one-Scout recall without a parent prefetch gate', () => {
  const tool = createDeepWorkflowTool({ propose: async () => ({}) } as never);
  const parameters = tool.parameters as {
    properties: {
      tokenLimit: { description?: string };
      timeoutMs: { description?: string };
      tasks: {
        items: {
          properties: {
            role: { description?: string };
            instruction: { description?: string };
            sourceHandles: { description?: string };
            readRoots: { description?: string };
          };
        };
      };
    };
  };
  const taskFields = parameters.properties.tasks.items.properties;
  const schemaText = JSON.stringify(parameters);

  expect(tool.description).toContain('one Quick Evidence Scout');
  expect(tool.description).toContain('child discovers');
  expect(tool.description).not.toContain('two independent views');
  expect(tool.description).not.toContain('Gather authentic card and Trace handles first');
  expect(taskFields.role.description).toContain('Evidence Scout');
  expect(taskFields.instruction.description).toContain('evidence question');
  expect(taskFields.sourceHandles.description).toContain('empty');
  expect(taskFields.sourceHandles.description).toContain('do not prefetch');
  expect(taskFields.readRoots.description).toContain('learning-set');
  expect(parameters.properties.tokenLimit.description).toContain('card and Trace tool results');
  expect(parameters.properties.tokenLimit.description).toContain('50,000');
  expect(parameters.properties.tokenLimit.description).not.toContain('12,000');
  expect(parameters.properties.timeoutMs.description).toContain('180,000');
  expect(schemaText).not.toContain('two independent views');
});
