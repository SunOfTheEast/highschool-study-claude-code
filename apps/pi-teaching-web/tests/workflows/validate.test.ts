import { expect, test } from 'bun:test';
import type { WorkflowGraph } from '../../src/workflows/contracts';
import { validateWorkflowGraph } from '../../src/workflows/validate';

const quick: WorkflowGraph = {
  id: 'wf-quick',
  goal: '分析下一步提示',
  mode: 'quick',
  maxConcurrency: 3,
  tokenLimit: 50_000,
  timeoutMs: 45_000,
  tasks: [
    {
      id: 'diagnose',
      label: '错因诊断',
      role: '错因诊断员',
      instruction: '区分策略与计算问题。',
      dependsOn: [],
      sourceHandles: ['lessons/lesson-003.md#trace-event-001'],
      readRoots: ['lessons'],
    },
    {
      id: 'spoiler',
      label: '防剧透检查',
      role: '课堂审查员',
      instruction: '检查下一步是否泄露答案。',
      dependsOn: [],
      sourceHandles: ['lessons/lesson-003.md'],
      readRoots: ['lessons'],
    },
  ],
};

test('accepts a bounded single-wave quick consultation', () => {
  expect(validateWorkflowGraph(quick)).toEqual(quick);
});

test('rejects duplicate IDs, unknown dependencies, cycles and dependent quick tasks', () => {
  expect(() => validateWorkflowGraph({
    ...quick,
    tasks: [...quick.tasks, quick.tasks[0]!],
  })).toThrow('DUPLICATE_TASK_ID');
  expect(() => validateWorkflowGraph({
    ...quick,
    mode: 'deep',
    tasks: [{ ...quick.tasks[0]!, dependsOn: ['missing'] }],
  })).toThrow('UNKNOWN_DEPENDENCY');
  expect(() => validateWorkflowGraph({
    ...quick,
    mode: 'deep',
    tasks: [
      { ...quick.tasks[0]!, id: 'a', dependsOn: ['b'] },
      { ...quick.tasks[1]!, id: 'b', dependsOn: ['a'] },
    ],
  })).toThrow('CYCLIC_WORKFLOW');
  expect(() => validateWorkflowGraph({
    ...quick,
    tasks: [{ ...quick.tasks[0]!, dependsOn: ['spoiler'] }, quick.tasks[1]!],
  })).toThrow('QUICK_REQUIRES_ONE_WAVE');
});

test('rejects empty fields and budgets outside the minimal boundary', () => {
  expect(() => validateWorkflowGraph({ ...quick, id: '' })).toThrow('WORKFLOW_ID_REQUIRED');
  expect(() => validateWorkflowGraph({ ...quick, tasks: [] })).toThrow('WORKFLOW_TASK_REQUIRED');
  expect(() => validateWorkflowGraph({ ...quick, maxConcurrency: 4 })).toThrow('INVALID_CONCURRENCY');
  expect(() => validateWorkflowGraph({ ...quick, tokenLimit: 0 })).toThrow('INVALID_TOKEN_LIMIT');
  expect(() => validateWorkflowGraph({ ...quick, timeoutMs: 45_001 })).toThrow('QUICK_TIMEOUT_LIMIT');
});
