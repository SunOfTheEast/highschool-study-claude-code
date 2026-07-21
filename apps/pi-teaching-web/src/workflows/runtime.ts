import type { EventBus } from '@earendil-works/pi-coding-agent';
import type { SubagentDelegationResponse } from 'pi-subagents/delegation';
import type { SessionKey } from '../shared/contracts';
import { delegateStudyTask } from './delegation-client';
import type {
  WorkflowGraph,
  WorkflowSnapshot,
  WorkflowTaskResult,
  WorkflowTaskState,
} from './contracts';
import type { WorkflowStore } from './store';
import { validateWorkflowGraph } from './validate';

export type WorkflowListener = (snapshot: WorkflowSnapshot) => void;
export type WorkflowDelegator = typeof delegateStudyTask;

const terminalTaskStatuses = new Set(['completed', 'failed', 'blocked', 'cancelled']);

function clone<T>(value: T): T {
  return structuredClone(value);
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

export function parseTaskResult(output: string | undefined): WorkflowTaskResult {
  if (!output) throw new Error('INVALID_TASK_RESULT');
  const trimmed = output.trim();
  const fenced = /^```json\s*\n([\s\S]*?)\n```$/.exec(trimmed);
  let value: unknown;
  try {
    value = JSON.parse(fenced?.[1] ?? trimmed);
  } catch {
    throw new Error('INVALID_TASK_RESULT');
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('INVALID_TASK_RESULT');
  }
  const candidate = value as Record<string, unknown>;
  if (!isStringArray(candidate.findings)
    || !isStringArray(candidate.evidence_refs)
    || typeof candidate.recommended_action !== 'string'
    || !isStringArray(candidate.risks)) {
    throw new Error('INVALID_TASK_RESULT');
  }
  return {
    findings: candidate.findings,
    evidence_refs: candidate.evidence_refs,
    recommended_action: candidate.recommended_action,
    risks: candidate.risks,
  };
}

export class DeepWorkflowRuntime {
  private readonly snapshots = new Map<string, WorkflowSnapshot>();
  private readonly listeners = new Set<WorkflowListener>();
  private readonly controllers = new Map<string, Map<string, AbortController>>();
  private readonly explicitlyCancelled = new Set<string>();
  private synthesisSink: ((snapshot: WorkflowSnapshot) => Promise<void>) | null = null;

  constructor(
    private readonly parentSessionKey: SessionKey,
    private readonly root: string,
    private readonly eventBus: EventBus,
    private readonly store: WorkflowStore,
    private readonly now: () => Date,
    private readonly delegate: WorkflowDelegator = delegateStudyTask,
  ) {
    for (const stored of store.list()) {
      const snapshot = clone(stored);
      if (snapshot.status === 'running') {
        for (const task of snapshot.tasks) {
          if (task.status === 'queued' || task.status === 'running') task.status = 'cancelled';
        }
        snapshot.status = snapshot.tasks.some((task) => task.status === 'completed')
          ? 'partial'
          : 'failed';
        snapshot.updatedAt = this.now().toISOString();
        this.store.save(clone(snapshot));
      }
      this.snapshots.set(snapshot.id, snapshot);
    }
  }

  enabled(): boolean {
    return this.store.deepMode();
  }

  setEnabled(enabled: boolean): void {
    this.store.setDeepMode(enabled);
  }

  list(): WorkflowSnapshot[] {
    return [...this.snapshots.values()]
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone);
  }

  subscribe(listener: WorkflowListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async propose(graph: WorkflowGraph, signal?: AbortSignal): Promise<WorkflowSnapshot> {
    validateWorkflowGraph(graph);
    const timestamp = this.now().toISOString();
    const snapshot: WorkflowSnapshot = {
      id: graph.id,
      parentSessionKey: this.parentSessionKey,
      goal: graph.goal,
      mode: graph.mode,
      status: graph.mode === 'deep' ? 'proposed' : 'running',
      maxConcurrency: graph.maxConcurrency,
      tokenLimit: graph.tokenLimit,
      timeoutMs: graph.timeoutMs,
      createdAt: timestamp,
      updatedAt: timestamp,
      tasks: graph.tasks.map((task): WorkflowTaskState => ({
        ...clone(task),
        status: 'queued',
        runId: null,
        tokens: 0,
        durationMs: 0,
        result: null,
        error: null,
      })),
    };
    this.snapshots.set(snapshot.id, snapshot);
    this.commit(snapshot);
    if (graph.mode === 'deep') return clone(snapshot);

    const abort = () => this.cancel(snapshot.id);
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) abort();
    try {
      return await this.execute(snapshot);
    } finally {
      signal?.removeEventListener('abort', abort);
    }
  }

  async confirm(workflowId: string): Promise<WorkflowSnapshot> {
    const snapshot = this.require(workflowId);
    if (snapshot.mode !== 'deep' || snapshot.status !== 'proposed') {
      throw new Error('WORKFLOW_NOT_PROPOSED');
    }
    snapshot.status = 'running';
    this.commit(snapshot);
    const terminal = await this.execute(snapshot);
    if ((terminal.status === 'completed' || terminal.status === 'partial') && this.synthesisSink) {
      await this.synthesisSink(clone(terminal));
    }
    return terminal;
  }

  cancel(workflowId: string): void {
    const snapshot = this.require(workflowId);
    if (snapshot.status === 'completed'
      || snapshot.status === 'partial'
      || snapshot.status === 'failed'
      || snapshot.status === 'cancelled') return;
    this.explicitlyCancelled.add(workflowId);
    for (const task of snapshot.tasks) {
      if (task.status === 'queued' || task.status === 'running') task.status = 'cancelled';
    }
    snapshot.status = 'cancelled';
    this.commit(snapshot);
    for (const controller of this.controllers.get(workflowId)?.values() ?? []) controller.abort();
  }

  setSynthesisSink(sink: (snapshot: WorkflowSnapshot) => Promise<void>): void {
    this.synthesisSink = sink;
  }

  private require(id: string): WorkflowSnapshot {
    const snapshot = this.snapshots.get(id);
    if (!snapshot) throw new Error('WORKFLOW_NOT_FOUND');
    return snapshot;
  }

  private commit(snapshot: WorkflowSnapshot, persist = true): void {
    snapshot.updatedAt = this.now().toISOString();
    this.snapshots.set(snapshot.id, snapshot);
    if (persist) this.store.save(clone(snapshot));
    const published = clone(snapshot);
    for (const listener of this.listeners) listener(clone(published));
  }

  private promptFor(snapshot: WorkflowSnapshot, task: WorkflowTaskState): string {
    const dependencies = task.dependsOn.map((id) => {
      const dependency = snapshot.tasks.find((candidate) => candidate.id === id)!;
      return { taskId: id, result: dependency.result };
    });
    return [
      `Dynamic role: ${task.role}`,
      `Workflow goal: ${snapshot.goal}`,
      `Task instruction: ${task.instruction}`,
      `Source handles: ${JSON.stringify(task.sourceHandles)}`,
      `Allowed read roots: ${JSON.stringify(task.readRoots)}`,
      `Direct dependency results: ${JSON.stringify(dependencies)}`,
      'Read only the declared roots and use only authentic source handles. If evidence is insufficient, return empty findings instead of inventing facts.',
      'Return only one JSON object with string-array fields findings, evidence_refs, risks and string field recommended_action. Do not include thinking or a transcript.',
    ].join('\n');
  }

  private totalTokens(snapshot: WorkflowSnapshot): number {
    return snapshot.tasks.reduce((total, task) => total + task.tokens, 0);
  }

  private async execute(snapshot: WorkflowSnapshot): Promise<WorkflowSnapshot> {
    const deadline = this.now().getTime() + snapshot.timeoutMs;
    const active = new Map<string, AbortController>();
    this.controllers.set(snapshot.id, active);
    let budgetStopped = false;
    const stopForBudget = () => {
      if (budgetStopped || this.explicitlyCancelled.has(snapshot.id)) return;
      budgetStopped = true;
      queueMicrotask(() => {
        for (const controller of active.values()) controller.abort();
      });
    };
    const deadlineTimer = setTimeout(stopForBudget, snapshot.timeoutMs);

    try {
      while (snapshot.tasks.some((task) => !terminalTaskStatuses.has(task.status))) {
        if (this.explicitlyCancelled.has(snapshot.id)) break;
        if (this.totalTokens(snapshot) >= snapshot.tokenLimit
          || this.now().getTime() >= deadline) {
          stopForBudget();
        }
        if (budgetStopped) {
          for (const task of snapshot.tasks) {
            if (task.status === 'queued') task.status = 'cancelled';
          }
          this.commit(snapshot);
          break;
        }

        let blocked = false;
        for (const task of snapshot.tasks) {
          if (task.status !== 'queued') continue;
          const dependencies = task.dependsOn.map((id) => (
            snapshot.tasks.find((candidate) => candidate.id === id)!
          ));
          if (dependencies.some((dependency) => (
            dependency.status === 'failed'
            || dependency.status === 'blocked'
            || dependency.status === 'cancelled'
          ))) {
            task.status = 'blocked';
            blocked = true;
          }
        }
        if (blocked) this.commit(snapshot);

        const ready = snapshot.tasks.filter((task) => (
          task.status === 'queued'
          && task.dependsOn.every((id) => (
            snapshot.tasks.find((candidate) => candidate.id === id)?.status === 'completed'
          ))
        ));
        if (ready.length === 0) break;
        const wave = ready.slice(0, snapshot.maxConcurrency);
        await Promise.all(wave.map(async (task) => {
          const controller = new AbortController();
          active.set(task.id, controller);
          task.status = 'running';
          task.error = null;
          this.commit(snapshot);
          const remainingMs = Math.max(1, deadline - this.now().getTime());
          let response: SubagentDelegationResponse;
          try {
            response = await this.delegate(this.eventBus, {
              requestId: `${snapshot.id}:${task.id}`,
              cwd: this.root,
              task: this.promptFor(snapshot, task),
              timeoutMs: remainingMs,
              turnBudget: { maxTurns: 4 },
              toolBudget: { hard: 12 },
            }, controller.signal, (update) => {
              if (task.status !== 'running') return;
              task.tokens = update.tokens ?? task.tokens;
              task.durationMs = update.durationMs ?? task.durationMs;
              this.commit(snapshot, false);
              if (this.totalTokens(snapshot) >= snapshot.tokenLimit) stopForBudget();
            });
          } catch (error) {
            response = {
              version: 1,
              requestId: `${snapshot.id}:${task.id}`,
              status: 'failed',
              error: error instanceof Error ? error.message : String(error),
            };
          } finally {
            active.delete(task.id);
          }

          task.tokens = response.tokens ?? task.tokens;
          task.durationMs = response.durationMs ?? task.durationMs;
          task.runId = response.runId ?? task.runId;
          if (this.explicitlyCancelled.has(snapshot.id)) {
            task.status = 'cancelled';
          } else if (response.status === 'completed') {
            try {
              task.result = parseTaskResult(response.output);
              task.status = 'completed';
              task.error = null;
            } catch {
              task.status = 'failed';
              task.error = 'INVALID_TASK_RESULT';
            }
          } else if (response.status === 'cancelled') {
            task.status = 'cancelled';
            task.error = response.error ?? null;
          } else {
            task.status = 'failed';
            task.error = response.error ?? response.status;
          }
          this.commit(snapshot);
        }));
      }

      if (budgetStopped) {
        for (const task of snapshot.tasks) {
          if (task.status === 'queued' || task.status === 'running') task.status = 'cancelled';
        }
      }
      if (this.explicitlyCancelled.has(snapshot.id)) {
        snapshot.status = 'cancelled';
      } else {
        const completed = snapshot.tasks.filter((task) => task.status === 'completed').length;
        snapshot.status = completed === snapshot.tasks.length
          ? 'completed'
          : completed > 0
            ? 'partial'
            : 'failed';
      }
      this.commit(snapshot);
      return clone(snapshot);
    } finally {
      clearTimeout(deadlineTimer);
      this.controllers.delete(snapshot.id);
    }
  }
}
