import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SessionManager } from '@earendil-works/pi-coding-agent';
import { createLessonMemoryTool } from '../../src/runtime/memory-tools';
import {
  readPendingToolResult,
  reconcilePendingMemoryToolResults,
} from '../../src/runtime/pending-tool-results';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-pending-result-'));
  cpSync(fixture, root, { recursive: true });
  mkdirSync(join(root, 'memory/objects'), { recursive: true });
  mkdirSync(join(root, 'memory/indexes'), { recursive: true });
  mkdirSync(join(root, 'memory/preferences'), { recursive: true });
  roots.push(root);
  return root;
}

function commitInput() {
  return {
    objects: [{
      target: { kind: 'new' as const, key: 'target-distance', title: '函数表示与目标之间的距离' },
      currentJudgment: '开始注意目标与原式的形式差异。',
      evolutionOverview: '由直接计算转向比较目标形式。',
      boundaries: ['尚未证明能独立选路。'],
      learningHistoryEntry: {
        change: '开始比较目标形式，但对象归属仍不明确。',
        evidenceBlockIds: ['block-001'],
      },
      routing: { kind: 'defer' as const, reason: '需要阶段视角判断应归入哪种选路对象。' },
    }],
    preferences: [],
  };
}

function appendToolCall(
  manager: SessionManager,
  toolCallId: string,
  args: Record<string, unknown>,
): void {
  manager.appendMessage({
    role: 'assistant',
    content: [{
      type: 'toolCall',
      id: toolCallId,
      name: 'lesson_memory_commit',
      arguments: args,
    }],
    api: 'openai-responses',
    provider: 'openai',
    model: 'test-model',
    usage: {
      input: 0,
      output: 0,
      cacheRead: 0,
      cacheWrite: 0,
      totalTokens: 0,
      cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
    },
    stopReason: 'toolUse',
    timestamp: Date.now(),
  });
}

function toolResults(manager: SessionManager) {
  return manager.getBranch().flatMap((entry) => (
    entry.type === 'message' && entry.message.role === 'toolResult'
      ? [entry.message]
      : []
  ));
}

async function execute(
  tool: NonNullable<ReturnType<typeof createLessonMemoryTool>>,
  toolCallId: string,
  input: ReturnType<typeof commitInput>,
) {
  return tool.execute(toolCallId, input as never, undefined, undefined, {} as never);
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('restores one committed orphan tool result after reopening the Pi session', async () => {
  const root = copyFixture();
  const manager = SessionManager.create(root, join(root, '.pi-sessions'));
  const input = commitInput();
  appendToolCall(manager, 'memory-call-1', input);
  const tool = createLessonMemoryTool(root, lessonPath, manager)!;

  await execute(tool, 'memory-call-1', input);
  expect(readPendingToolResult(root, manager.getSessionId(), 'memory-call-1')).not.toBeNull();

  const reopened = SessionManager.open(manager.getSessionFile()!, undefined, root);
  reconcilePendingMemoryToolResults(root, reopened);

  expect(toolResults(reopened)).toHaveLength(1);
  expect(toolResults(reopened)[0]).toMatchObject({
    toolCallId: 'memory-call-1',
    toolName: 'lesson_memory_commit',
    isError: false,
  });
  expect(readPendingToolResult(root, reopened.getSessionId(), 'memory-call-1')).toBeNull();
  const object = readFileSync(join(root, 'memory/objects/obj-001.md'), 'utf8');
  expect(object.match(/Block `block-001`/g)).toHaveLength(1);
});

test('cleans a pending record when the Pi result already exists', async () => {
  const root = copyFixture();
  const manager = SessionManager.create(root, join(root, '.pi-sessions'));
  const input = commitInput();
  appendToolCall(manager, 'memory-call-2', input);
  const returned = await execute(
    createLessonMemoryTool(root, lessonPath, manager)!,
    'memory-call-2',
    input,
  );
  manager.appendMessage({
    role: 'toolResult',
    toolCallId: 'memory-call-2',
    toolName: 'lesson_memory_commit',
    content: returned.content,
    details: returned.details,
    isError: false,
    timestamp: Date.now(),
  });

  const reopened = SessionManager.open(manager.getSessionFile()!, undefined, root);
  reconcilePendingMemoryToolResults(root, reopened);

  expect(toolResults(reopened)).toHaveLength(1);
  expect(readPendingToolResult(root, reopened.getSessionId(), 'memory-call-2')).toBeNull();
});

test('rejects different arguments for the same persisted tool call', async () => {
  const root = copyFixture();
  const manager = SessionManager.create(root, join(root, '.pi-sessions'));
  const input = commitInput();
  appendToolCall(manager, 'memory-call-3', input);
  const before = readFileSync(join(root, 'memory/INDEX.md'), 'utf8');
  const changed = {
    ...input,
    objects: [{
      ...input.objects[0]!,
      currentJudgment: '这不是持久化调用中的参数。',
    }],
  };

  await expect(execute(
    createLessonMemoryTool(root, lessonPath, manager)!,
    'memory-call-3',
    changed,
  )).rejects.toThrow('MEMORY_TOOL_ARGUMENTS_MISMATCH');
  expect(readFileSync(join(root, 'memory/INDEX.md'), 'utf8')).toBe(before);
  expect(existsSync(join(root, 'memory/objects/obj-001.md'))).toBeFalse();
});
