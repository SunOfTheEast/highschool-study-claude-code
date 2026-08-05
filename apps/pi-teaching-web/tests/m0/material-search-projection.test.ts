import { describe, expect, test } from 'bun:test';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import { reduceClientState, initialClientState } from '../../src/client/state';
import {
  projectConversationEntries,
  projectLiveSessionEvent,
} from '../../src/projection/conversation';
import type {
  ConversationItem,
  MaterialSearchConversationItem,
  StudyEvent,
} from '../../src/shared/contracts';

const unsafeBrief = '绝对值 + 三次函数；只看 cards/private.card.yaml';

function conversationItem(events: StudyEvent[]): ConversationItem {
  expect(events).toHaveLength(1);
  const event = events[0]!;
  expect(event.type).toBe('conversation-item');
  if (event.type !== 'conversation-item') throw new Error('conversation item expected');
  return event.item;
}

function scoutArgs() {
  return {
    tasks: [
      { agent: 'study-material-scout', task: unsafeBrief },
      { agent: 'study-material-scout', task: '第二个内部材料 brief' },
    ],
    concurrency: 3,
    context: 'fresh',
    async: false,
    includeProgress: false,
    artifacts: false,
    agentScope: 'user',
  };
}

function runningProgress() {
  return {
    content: [{ type: 'text', text: 'candidate output' }],
    details: {
      mode: 'parallel',
      totalSteps: 2,
      progress: [
        {
          index: 0,
          agent: 'study-material-scout',
          status: 'running',
          task: unsafeBrief,
          currentTool: 'read',
          currentToolArgs: '{"path":"cards/private.card.yaml"}',
          currentPath: 'cards/private.card.yaml',
          recentTools: [],
          recentOutput: ['candidate output'],
          toolCount: 7,
          tokens: 9000,
          durationMs: 72_000,
        },
        {
          index: 1,
          agent: 'study-material-scout',
          status: 'completed',
          task: '第二个内部材料 brief',
          recentTools: [],
          recentOutput: [],
          toolCount: 16,
          tokens: 12_000,
          durationMs: 65_000,
        },
      ],
    },
  };
}

function finalResult() {
  return {
    details: {
      mode: 'parallel',
      results: [
        {
          agent: 'study-material-scout',
          task: unsafeBrief,
          exitCode: 0,
          usage: { input: 100, output: 50, reasoning: 40 },
          sessionFile: '/tmp/session-child.jsonl',
          finalOutput: 'candidate output',
          progressSummary: { toolCount: 7, tokens: 9000, durationMs: 72_000 },
        },
        {
          agent: 'study-material-scout',
          task: '第二个内部材料 brief',
          exitCode: 0,
          usage: { input: 200, output: 60, reasoning: 50 },
          sessionFile: '/tmp/session-child-2.jsonl',
          finalOutput: 'another candidate output',
          progressSummary: { toolCount: 16, tokens: 12_000, durationMs: 65_000 },
        },
      ],
      totalChildUsage: { input: 300, output: 110, reasoning: 90 },
    },
  };
}

function expectSafe(item: ConversationItem) {
  const serialized = JSON.stringify(item);
  expect(serialized).not.toContain('cards/private.card.yaml');
  expect(serialized).not.toContain('绝对值 + 三次函数');
  expect(serialized).not.toContain('session-child.jsonl');
  expect(serialized).not.toContain('candidate output');
  expect(serialized).not.toContain('tokens');
}

describe('safe material-search projection', () => {
  test('projects native start and progress updates without private child details', () => {
    const start = conversationItem(projectLiveSessionEvent(
      'plan:plan-001',
      {
        type: 'tool_execution_start',
        toolCallId: 'scout-1',
        toolName: 'subagent',
        args: scoutArgs(),
      } as AgentSessionEvent,
      '2026-08-05T10:00:00.000Z',
    ));
    expect(start).toEqual({
      id: 'scout-1',
      kind: 'material-search',
      status: 'running',
      phase: 'starting',
      completed: 0,
      total: 2,
      toolCount: 0,
      elapsedMs: 0,
      at: '2026-08-05T10:00:00.000Z',
      updatedAt: '2026-08-05T10:00:00.000Z',
    });
    expectSafe(start);

    const update = conversationItem(projectLiveSessionEvent(
      'plan:plan-001',
      {
        type: 'tool_execution_update',
        toolCallId: 'scout-1',
        toolName: 'subagent',
        args: scoutArgs(),
        partialResult: runningProgress(),
      } as AgentSessionEvent,
      '2026-08-05T10:01:12.000Z',
    ));
    expect(update).toEqual({
      id: 'scout-1',
      kind: 'material-search',
      status: 'running',
      phase: 'inspecting',
      completed: 1,
      total: 2,
      toolCount: 23,
      elapsedMs: 72_000,
      at: '2026-08-05T10:01:12.000Z',
      updatedAt: '2026-08-05T10:01:12.000Z',
    });
    expectSafe(update);
  });

  test('projects final child summaries without usage, paths, or output', () => {
    const item = conversationItem(projectLiveSessionEvent(
      'plan:plan-001',
      {
        type: 'tool_execution_end',
        toolCallId: 'scout-1',
        toolName: 'subagent',
        result: finalResult(),
        isError: false,
      } as AgentSessionEvent,
      '2026-08-05T10:01:22.000Z',
    ));

    expect(item).toMatchObject({
      id: 'scout-1',
      kind: 'material-search',
      status: 'done',
      phase: 'done',
      completed: 2,
      total: 2,
      toolCount: 23,
    });
    expectSafe(item);
  });

  test('reconstructs exact parent wall time from persisted history', () => {
    const entries = [
      {
        type: 'message',
        id: 'assistant-1',
        parentId: null,
        timestamp: '2026-08-05T10:00:10.000Z',
        message: {
          role: 'assistant',
          content: [{
            type: 'toolCall',
            id: 'scout-1',
            name: 'subagent',
            arguments: scoutArgs(),
          }],
        },
      },
      {
        type: 'message',
        id: 'result-1',
        parentId: 'assistant-1',
        timestamp: '2026-08-05T10:01:22.000Z',
        message: {
          role: 'toolResult',
          toolCallId: 'scout-1',
          toolName: 'subagent',
          content: [{ type: 'text', text: 'private parent result' }],
          details: finalResult().details,
          isError: false,
        },
      },
    ] as unknown as SessionEntry[];

    const items = projectConversationEntries('plan:plan-001', entries);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      kind: 'material-search',
      status: 'done',
      elapsedMs: 72_000,
      at: '2026-08-05T10:00:10.000Z',
      updatedAt: '2026-08-05T10:01:22.000Z',
    });
    expectSafe(items[0]!);
  });

  test('merges live updates by id while preserving the original start time', () => {
    const start: MaterialSearchConversationItem = {
      id: 'scout-1',
      kind: 'material-search',
      status: 'running',
      phase: 'starting',
      completed: 0,
      total: 2,
      toolCount: 0,
      elapsedMs: 0,
      at: '2026-08-05T10:00:00.000Z',
      updatedAt: '2026-08-05T10:00:00.000Z',
    };
    const update: MaterialSearchConversationItem = {
      ...start,
      phase: 'inspecting',
      completed: 1,
      toolCount: 23,
      elapsedMs: 60_000,
      at: '2026-08-05T10:01:12.000Z',
      updatedAt: '2026-08-05T10:01:12.000Z',
    };
    let state = reduceClientState(initialClientState, {
      type: 'conversation-item',
      sessionKey: 'plan:plan-001',
      item: start,
    });
    state = reduceClientState(state, {
      type: 'conversation-item',
      sessionKey: 'plan:plan-001',
      item: update,
    });

    expect(state.conversations['plan:plan-001']).toEqual([{
      ...update,
      at: '2026-08-05T10:00:00.000Z',
      elapsedMs: 72_000,
    }]);
  });

  test('sanitizes non-execution subagent activity but preserves native tool details', () => {
    const management = conversationItem(projectLiveSessionEvent(
      'plan:plan-001',
      {
        type: 'tool_execution_start',
        toolCallId: 'list-1',
        toolName: 'subagent',
        args: { action: 'list', secret: unsafeBrief },
      } as AgentSessionEvent,
      '2026-08-05T10:00:00.000Z',
    ));
    expect(management).toMatchObject({
      kind: 'tool',
      name: 'subagent',
      detail: null,
    });
    expectSafe(management);

    const read = conversationItem(projectLiveSessionEvent(
      'plan:plan-001',
      {
        type: 'tool_execution_start',
        toolCallId: 'read-1',
        toolName: 'read',
        args: { path: 'plans/plan-001.md' },
      } as AgentSessionEvent,
      '2026-08-05T10:00:00.000Z',
    ));
    expect(read).toMatchObject({
      kind: 'tool',
      name: 'read',
      detail: { path: 'plans/plan-001.md' },
    });
  });
});
