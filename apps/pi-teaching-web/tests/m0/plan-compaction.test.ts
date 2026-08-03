import { expect, test } from 'bun:test';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import {
  createPlanCompactionPrompt,
  PLAN_COMPACTION_INSTRUCTIONS,
  PLAN_COMPACTION_THRESHOLD_TOKENS,
} from '../../src/runtime/plan-compaction';
import type { NodeSessionScope } from '../../src/runtime/session-scope';

const PLAN_SCOPE = {
  nodeKind: 'plan',
  nodeId: 'plan-001',
  nodePath: 'plans/plan-001.md',
  parentId: 'roadmap',
  parentPath: 'ROADMAP.md',
} as const satisfies NodeSessionScope;

const LESSON_SCOPE = {
  nodeKind: 'lesson',
  nodeId: 'lesson-001',
  nodePath: 'lessons/lesson-001.md',
  parentId: 'plan-001',
  parentPath: 'plans/plan-001.md',
} as const satisfies NodeSessionScope;

type Listener = (event: AgentSessionEvent) => void;

type FakeSessionOptions = {
  tokens: number | null;
  onPrompt?: (emit: Listener) => void;
  onUsage?: () => void;
  onCompact?: (instructions: string | undefined) => void;
  promptError?: Error;
  compactError?: Error;
};

function fakeNativeSession(options: FakeSessionOptions) {
  const listeners = new Set<Listener>();
  const compactCalls: Array<string | undefined> = [];
  return {
    compactCalls,
    session: {
      prompt: async () => {
        options.onPrompt?.((event) => {
          for (const listener of listeners) listener(event);
        });
        if (options.promptError) throw options.promptError;
      },
      subscribe: (listener: Listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getContextUsage: () => {
        options.onUsage?.();
        return {
          tokens: options.tokens,
          contextWindow: 1_000_000,
          percent: options.tokens === null ? null : options.tokens / 10_000,
        };
      },
      compact: async (instructions?: string) => {
        compactCalls.push(instructions);
        options.onCompact?.(instructions);
        if (options.compactError) throw options.compactError;
        return {};
      },
    },
  };
}

function successfulMutation(
  emit: Listener,
  path = 'lessons/lesson-002.md',
  toolName = 'write',
) {
  emit({
    type: 'tool_execution_start',
    toolCallId: 'lesson-mutation',
    toolName,
    args: { path },
  });
  emit({
    type: 'tool_execution_end',
    toolCallId: 'lesson-mutation',
    toolName,
    result: { content: [] },
    isError: false,
  });
}

test('compacts a Plan only after a settled successful Lesson mutation at the threshold', async () => {
  const order: string[] = [];
  const { session } = fakeNativeSession({
    tokens: PLAN_COMPACTION_THRESHOLD_TOKENS,
    onPrompt(emit) {
      order.push('prompt:start');
      successfulMutation(emit);
      order.push('prompt:settled');
    },
    onUsage: () => order.push('usage'),
    onCompact: (instructions) => {
      order.push('compact');
      expect(instructions).toBe(PLAN_COMPACTION_INSTRUCTIONS);
    },
  });
  const wrapped = createPlanCompactionPrompt(session, PLAN_SCOPE, () => {});

  await wrapped.prompt('准备下一课');

  expect(order).toEqual(['prompt:start', 'prompt:settled', 'usage', 'compact']);
});

test('does not compact below the threshold', async () => {
  const { session, compactCalls } = fakeNativeSession({
    tokens: PLAN_COMPACTION_THRESHOLD_TOKENS - 1,
    onPrompt: successfulMutation,
  });
  const wrapped = createPlanCompactionPrompt(session, PLAN_SCOPE, () => {});

  await wrapped.prompt('准备下一课');

  expect(compactCalls).toHaveLength(0);
});

test('does not compact a Lesson-owned Session', async () => {
  const { session, compactCalls } = fakeNativeSession({
    tokens: PLAN_COMPACTION_THRESHOLD_TOKENS,
    onPrompt: successfulMutation,
  });
  const wrapped = createPlanCompactionPrompt(session, LESSON_SCOPE, () => {});

  await wrapped.prompt('继续上课');

  expect(compactCalls).toHaveLength(0);
});

test('does not compact after a Plan-file mutation', async () => {
  const { session, compactCalls } = fakeNativeSession({
    tokens: PLAN_COMPACTION_THRESHOLD_TOKENS,
    onPrompt: (emit) => successfulMutation(emit, 'plans/plan-001.md', 'edit'),
  });
  const wrapped = createPlanCompactionPrompt(session, PLAN_SCOPE, () => {});

  await wrapped.prompt('更新计划');

  expect(compactCalls).toHaveLength(0);
});

test('does not compact after a failed Lesson mutation', async () => {
  const { session, compactCalls } = fakeNativeSession({
    tokens: PLAN_COMPACTION_THRESHOLD_TOKENS,
    onPrompt(emit) {
      emit({
        type: 'tool_execution_start',
        toolCallId: 'failed-write',
        toolName: 'write',
        args: { path: 'lessons/lesson-002.md' },
      });
      emit({
        type: 'tool_execution_end',
        toolCallId: 'failed-write',
        toolName: 'write',
        result: { content: [] },
        isError: true,
      });
    },
  });
  const wrapped = createPlanCompactionPrompt(session, PLAN_SCOPE, () => {});

  await wrapped.prompt('准备下一课');

  expect(compactCalls).toHaveLength(0);
});

test('reports compaction failure without failing the completed prompt', async () => {
  const compactError = new Error('provider unavailable');
  const reported: unknown[] = [];
  const { session } = fakeNativeSession({
    tokens: PLAN_COMPACTION_THRESHOLD_TOKENS,
    onPrompt: successfulMutation,
    compactError,
  });
  const wrapped = createPlanCompactionPrompt(session, PLAN_SCOPE, (error) => {
    reported.push(error);
  });

  await expect(wrapped.prompt('准备下一课')).resolves.toBeUndefined();
  expect(reported).toEqual([compactError]);
});

test('propagates prompt failure without attempting compaction', async () => {
  const promptError = new Error('model request failed');
  const { session, compactCalls } = fakeNativeSession({
    tokens: PLAN_COMPACTION_THRESHOLD_TOKENS,
    onPrompt: successfulMutation,
    promptError,
  });
  const wrapped = createPlanCompactionPrompt(session, PLAN_SCOPE, () => {});

  await expect(wrapped.prompt('准备下一课')).rejects.toBe(promptError);
  expect(compactCalls).toHaveLength(0);
});
