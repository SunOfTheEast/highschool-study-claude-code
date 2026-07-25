import type { WorkflowGraph } from './contracts';

function required(value: string, code: string): void {
  if (!value.trim()) throw new Error(code);
}

export function validateWorkflowGraph(graph: WorkflowGraph): WorkflowGraph {
  required(graph.id, 'WORKFLOW_ID_REQUIRED');
  required(graph.goal, 'WORKFLOW_GOAL_REQUIRED');
  if (graph.tasks.length === 0) throw new Error('WORKFLOW_TASK_REQUIRED');
  if (!Number.isInteger(graph.maxConcurrency)
    || graph.maxConcurrency < 1
    || graph.maxConcurrency > 3) {
    throw new Error('INVALID_CONCURRENCY');
  }
  if (!Number.isFinite(graph.tokenLimit) || graph.tokenLimit <= 0) {
    throw new Error('INVALID_TOKEN_LIMIT');
  }
  if (!Number.isFinite(graph.timeoutMs) || graph.timeoutMs <= 0) {
    throw new Error('INVALID_TIMEOUT');
  }

  const byId = new Map<string, (typeof graph.tasks)[number]>();
  for (const task of graph.tasks) {
    required(task.id, 'TASK_ID_REQUIRED');
    required(task.role, 'TASK_ROLE_REQUIRED');
    required(task.instruction, 'TASK_INSTRUCTION_REQUIRED');
    if (byId.has(task.id)) throw new Error('DUPLICATE_TASK_ID');
    byId.set(task.id, task);
  }

  const incoming = new Map(graph.tasks.map((task) => [task.id, task.dependsOn.length]));
  const outgoing = new Map(graph.tasks.map((task) => [task.id, [] as string[]]));
  for (const task of graph.tasks) {
    for (const dependency of task.dependsOn) {
      if (!byId.has(dependency)) throw new Error('UNKNOWN_DEPENDENCY');
      outgoing.get(dependency)!.push(task.id);
    }
  }

  const queue = graph.tasks.filter((task) => incoming.get(task.id) === 0).map((task) => task.id);
  let visited = 0;
  while (queue.length > 0) {
    const id = queue.shift()!;
    visited += 1;
    for (const dependent of outgoing.get(id)!) {
      const count = incoming.get(dependent)! - 1;
      incoming.set(dependent, count);
      if (count === 0) queue.push(dependent);
    }
  }
  if (visited !== graph.tasks.length) throw new Error('CYCLIC_WORKFLOW');

  if (graph.mode === 'quick') {
    if (graph.tasks.length > 3) throw new Error('QUICK_TASK_LIMIT');
    if (graph.tasks.some((task) => task.dependsOn.length > 0)) {
      throw new Error('QUICK_REQUIRES_ONE_WAVE');
    }
    if (graph.timeoutMs > 180_000) throw new Error('QUICK_TIMEOUT_LIMIT');
  }

  return graph;
}
