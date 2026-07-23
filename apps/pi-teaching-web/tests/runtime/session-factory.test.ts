import { expect, test } from 'bun:test';
import { Agent } from '@earendil-works/pi-agent-core';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  bindStudyExtensions,
  deepModeToolNames,
  roleToolNames,
  triggerAndWaitForAgentEnd,
} from '../../src/runtime/session-factory';

test('binds the headless extension context before delegated workflows run', async () => {
  let bindings: unknown = null;
  await bindStudyExtensions({
    bindExtensions: async (value) => {
      bindings = value;
    },
  });

  expect(bindings).toEqual({});
});

test('keeps the Pi coding-agent and agent-core constructor contract aligned', () => {
  const LegacyAgent = Agent as unknown as new (options: {
    streamFunction: () => never;
  }) => Agent;

  expect(() => new LegacyAgent({
    streamFunction: () => { throw new Error('not invoked during construction'); },
  })).not.toThrow();

  const codingAgentEntry = Bun.resolveSync('@earendil-works/pi-coding-agent', import.meta.dir);
  const coreEntry = Bun.resolveSync('@earendil-works/pi-agent-core', dirname(codingAgentEntry));
  const corePackage = JSON.parse(readFileSync(join(dirname(coreEntry), '../package.json'), 'utf8')) as {
    version: string;
  };
  expect(corePackage.version).toBe('0.81.0');
});

test('keeps Coach and Tutor tool boundaries distinct', () => {
  expect(roleToolNames('coach')).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'write',
    'edit',
    'card_search',
    'trace_search',
    'source_resolve',
    'plan_update',
    'deep_workflow_propose',
  ]);
  expect(roleToolNames('tutor')).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'card_search',
    'trace_search',
    'trace_append',
    'source_resolve',
    'classroom_update',
    'lesson_close',
    'card_alternative_append',
    'deep_workflow_propose',
  ]);
  for (const role of ['coach', 'tutor'] as const) {
    expect(roleToolNames(role)).not.toContain('subagent');
    expect(deepModeToolNames(roleToolNames(role), false)).not.toContain('deep_workflow_propose');
  }
});

test('adds only the workflow proposal tool while deep mode is enabled', () => {
  const ordinary = ['read', 'card_search'];
  expect(deepModeToolNames(ordinary, true)).toEqual([
    'read',
    'card_search',
    'deep_workflow_propose',
  ]);
  expect(deepModeToolNames([...ordinary, 'deep_workflow_propose'], false)).toEqual(ordinary);
  expect(deepModeToolNames(ordinary, true)).not.toContain('subagent');
});

test('keeps lesson kickoff pending until the triggered agent emits agent_end', async () => {
  let emit: ((event: AgentSessionEvent) => void) | null = null;
  let unsubscribed = false;
  const order: string[] = [];
  const source = {
    subscribe(listener: (event: AgentSessionEvent) => void) {
      order.push('subscribe');
      emit = listener;
      return () => { unsubscribed = true; };
    },
  };
  let settled = false;
  const waiting = triggerAndWaitForAgentEnd(source, async () => {
    order.push('trigger');
  }).then(() => { settled = true; });

  await Promise.resolve();
  await Promise.resolve();
  expect(order).toEqual(['subscribe', 'trigger']);
  expect(settled).toBe(false);

  emit!({ type: 'agent_end', messages: [], willRetry: true });
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(unsubscribed).toBe(false);

  emit!({ type: 'agent_end', messages: [], willRetry: false });
  await waiting;
  expect(settled).toBe(true);
  expect(unsubscribed).toBe(true);
});

test('unsubscribes and propagates a kickoff trigger error', async () => {
  let unsubscribed = false;
  const failure = new Error('kickoff failed');
  const source = {
    subscribe(_listener: (event: AgentSessionEvent) => void) {
      return () => { unsubscribed = true; };
    },
  };

  await expect(triggerAndWaitForAgentEnd(source, async () => {
    throw failure;
  })).rejects.toBe(failure);
  expect(unsubscribed).toBe(true);
});
