import { expect, test } from 'bun:test';
import { createEventBus } from '@earendil-works/pi-coding-agent';
import {
  SUBAGENT_DELEGATION_CANCEL_EVENT,
  SUBAGENT_DELEGATION_REQUEST_EVENT,
  SUBAGENT_DELEGATION_RESPONSE_EVENT,
  SUBAGENT_DELEGATION_UPDATE_EVENT,
  type SubagentDelegationCancel,
  type SubagentDelegationRequest,
} from 'pi-subagents/delegation';
import { delegateStudyTask } from '../../src/workflows/delegation-client';

test('correlates public delegation updates and response by requestId', async () => {
  const bus = createEventBus();
  const requests: SubagentDelegationRequest[] = [];
  const updates: number[] = [];
  bus.on(SUBAGENT_DELEGATION_REQUEST_EVENT, (raw) => {
    const request = raw as SubagentDelegationRequest;
    requests.push(request);
    bus.emit(SUBAGENT_DELEGATION_UPDATE_EVENT, {
      version: 1,
      requestId: request.requestId,
      tokens: 321,
      durationMs: 50,
    });
    bus.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
      version: 1,
      requestId: request.requestId,
      status: 'completed',
      runId: 'run-1',
      tokens: 500,
      output: '{"findings":[],"evidence_refs":[],"recommended_action":"继续观察","risks":[]}',
    });
  });

  const response = await delegateStudyTask(bus, {
    requestId: 'request-1',
    cwd: '/tmp/study',
    task: 'Return JSON.',
    timeoutMs: 45_000,
    turnBudget: { maxTurns: 4 },
    toolBudget: { hard: 12 },
  }, undefined, (update) => updates.push(update.tokens ?? 0));

  expect(requests[0]).toMatchObject({
    version: 1,
    agent: 'study-scout',
    context: 'fresh',
    artifacts: true,
  });
  expect(updates).toEqual([321]);
  expect(response.status).toBe('completed');
});

test('cancels only the correlated public delegation request', async () => {
  const bus = createEventBus();
  const cancelled: string[] = [];
  bus.on(SUBAGENT_DELEGATION_CANCEL_EVENT, (raw) => {
    const event = raw as SubagentDelegationCancel;
    cancelled.push(event.requestId);
    bus.emit(SUBAGENT_DELEGATION_RESPONSE_EVENT, {
      version: 1,
      requestId: event.requestId,
      status: 'cancelled',
    });
  });
  const controller = new AbortController();
  const response = delegateStudyTask(bus, {
    requestId: 'request-cancel',
    cwd: '/tmp/study',
    task: 'Return JSON.',
    timeoutMs: 45_000,
    turnBudget: { maxTurns: 4 },
    toolBudget: { hard: 12 },
  }, controller.signal, () => {});

  controller.abort();
  expect((await response).status).toBe('cancelled');
  expect(cancelled).toEqual(['request-cancel']);
});
