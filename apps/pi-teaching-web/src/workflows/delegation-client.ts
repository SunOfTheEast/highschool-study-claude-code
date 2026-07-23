import type { EventBus } from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_CANCEL_EVENT,
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  SUBAGENT_DELEGATION_UPDATE_EVENT,
  type SubagentDelegationResponse,
  type SubagentDelegationUpdate,
} from 'pi-subagents/delegation';

export type StudyDelegationInput = {
  requestId: string;
  cwd: string;
  task: string;
  timeoutMs: number;
  turnBudget?: { maxTurns: number; graceTurns?: number };
  toolBudget: { hard: number; soft?: number };
};

export function delegateStudyTask(
  bus: EventBus,
  input: StudyDelegationInput,
  signal: AbortSignal | undefined,
  onUpdate: (update: SubagentDelegationUpdate) => void,
): Promise<SubagentDelegationResponse> {
  return new Promise((resolve) => {
    const cancel = () => bus.emit(SUBAGENT_DELEGATION_CANCEL_EVENT, {
      version: 1,
      requestId: input.requestId,
    });
    const offUpdate = bus.on(SUBAGENT_DELEGATION_UPDATE_EVENT, (raw) => {
      const update = raw as SubagentDelegationUpdate;
      if (update.requestId === input.requestId) onUpdate(update);
    });
    const offResponse = bus.on(SUBAGENT_DELEGATION_RESPONSE_EVENT, (raw) => {
      const response = raw as SubagentDelegationResponse;
      if (response.requestId !== input.requestId) return;
      offUpdate();
      offResponse();
      signal?.removeEventListener('abort', cancel);
      resolve(response);
    });
    signal?.addEventListener('abort', cancel, { once: true });
    bus.emit(SUBAGENT_DELEGATION_REQUEST_EVENT, {
      version: 1,
      requestId: input.requestId,
      agent: 'study-scout',
      task: input.task,
      context: 'fresh',
      cwd: input.cwd,
      timeoutMs: input.timeoutMs,
      turnBudget: input.turnBudget,
      toolBudget: input.toolBudget,
      artifacts: true,
      acceptance: {
        level: 'none',
        reason: 'Read-only teaching analysis; the parent owns all formal writes.',
      },
    });
    if (signal?.aborted) cancel();
  });
}
