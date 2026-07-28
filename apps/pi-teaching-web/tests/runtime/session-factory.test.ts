import { expect, test } from 'bun:test';
import { Agent } from '@earendil-works/pi-agent-core';
import { SessionManager, type AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import {
  bindStudyExtensions,
  deepModeToolNames,
  memoryReviewDecisionMessage,
  roleToolNames,
  scopeToolNames,
  triggerAndWaitForAgentEnd,
} from '../../src/runtime/session-factory';
import type { MemoryReviewSnapshot } from '../../src/memory-review/contracts';
import {
  appendSessionOwner,
  readSessionOwner,
  sessionOwnerMatches,
} from '../../src/runtime/session-owner';

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

test('persists exactly one machine-readable owner on a new Pi Session', () => {
  const root = mkdtempSync(join(tmpdir(), 'study-session-owner-'));
  try {
    const manager = SessionManager.create(root, join(root, 'sessions'));
    const owner = {
      role: 'coach' as const,
      ownerId: 'isomorphic-transformation',
      ownerPath: 'plans/isomorphic-transformation.md',
    };

    appendSessionOwner(manager, owner);

    expect(readSessionOwner(manager)).toEqual(owner);
    expect(manager.getEntries().filter((entry) => (
      entry.type === 'custom'
      && entry.customType === 'studyforge.session-owner.v1'
    ))).toHaveLength(1);
    expect(sessionOwnerMatches(readSessionOwner(manager), owner)).toBe(true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rejects missing, duplicate, malformed and mismatched Session owners', () => {
  const expected = {
    role: 'tutor' as const,
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  };
  const entries: Array<{
    type: 'custom';
    customType: string;
    data: unknown;
  }> = [];
  const manager = { getEntries: () => entries };

  expect(readSessionOwner(manager)).toBeNull();
  entries.push({
    type: 'custom',
    customType: 'studyforge.session-owner.v1',
    data: { ...expected, role: 'teacher' },
  });
  expect(readSessionOwner(manager)).toBeNull();
  entries[0]!.data = expected;
  entries.push({
    type: 'custom',
    customType: 'studyforge.session-owner.v1',
    data: expected,
  });
  expect(readSessionOwner(manager)).toBeNull();
  expect(sessionOwnerMatches(
    expected,
    { ...expected, ownerPath: 'lessons/lesson-004.md' },
  )).toBe(false);
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
    'lesson_prepare',
    'plan_register',
    'plan_update',
    'memory_review_propose',
    'deep_workflow_propose',
  ]);
  expect(roleToolNames('tutor')).not.toContain('lesson_prepare');
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

test('keeps Roadmap Coach active tools global but non-instructional', () => {
  const tools = scopeToolNames({
    role: 'coach',
    ownerId: '@roadmap',
    ownerPath: 'ROADMAP.md',
  });
  expect(tools).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'write',
    'edit',
    'card_search',
    'trace_search',
    'source_resolve',
    'plan_register',
    'deep_workflow_propose',
  ]);
  expect(tools).not.toContain('plan_update');
  expect(tools).not.toContain('lesson_prepare');
  expect(tools).not.toContain('trace_append');
  expect(tools).not.toContain('memory_review_propose');
});

test('builds one hidden structured continuation for submitted memory decisions', () => {
  const submitted = {
    id: 'review-1',
    planId: 'domain-integrity',
    status: 'submitted',
    items: [{
      id: 'preference-1',
      operation: 'delete',
      owner: 'student',
      currentText: '喜欢每一步都确认。',
      proposedText: null,
      sources: ['lessons/lesson-001.md#trace-event-001'],
      rationale: '当前记录不再支持。',
      counterEvidence: '暂无。',
      scope: '导数专题。',
    }],
    decisions: [{
      itemId: 'preference-1',
      action: 'rewrite',
      text: '复杂题只在关键节点确认。',
    }],
  } satisfies MemoryReviewSnapshot;

  const message = memoryReviewDecisionMessage(submitted);
  expect(message).toMatchObject({
    customType: 'studyforge.memory-review-decisions.v1',
    display: false,
  });
  const content = JSON.parse(String(message.content)) as Record<string, unknown>;
  expect(content).toMatchObject({
    reviewId: 'review-1',
    planId: 'domain-integrity',
    items: submitted.items,
    decisions: submitted.decisions,
  });
  expect(JSON.stringify(content)).toContain('rewriting a delete means retain and replace');
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
