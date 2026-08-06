import { afterEach, expect, test } from 'bun:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  lessonMemoryGuard,
  validateLessonMemoryWrite,
} from '../../src/runtime/lesson-memory-guard';
import type { NodeSessionScope } from '../../src/runtime/session-scope';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

const scope = {
  nodeKind: 'lesson',
  nodeId: 'lesson-001',
  nodePath: 'plans/plan-001/lessons/lesson-001.md',
  parentId: 'plan-001',
  parentPath: 'plans/plan-001/PLAN.md',
} as const satisfies NodeSessionScope;

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1-guard-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('allows one valid trace append to the current Lesson', () => {
  const root = copyFixture();
  const source = readFileSync(join(root, scope.nodePath), 'utf8');
  const trace = [
    '',
    '',
    '## Consolidated Learning Traces',
    '',
    '### trace-plan-001-lesson-001-01',
    '',
    '- 时间：2026-08-07 20:15',
    '- 情境：同构变形的独立识别检验',
    '- 首次表现：没有主动比较共同结构',
    '- 实际帮助：提醒比较结构后继续',
    '- 后续表现：完成变形，但尚未证明能自主识别',
    '- 关联对象：obj-001',
    '- 来源证据：本课 Classroom Log 中的对应记录',
    '',
  ].join('\n');
  const oldText = '### Classroom Log\n';

  expect(validateLessonMemoryWrite(root, scope, {
    toolName: 'edit',
    input: {
      path: scope.nodePath,
      edits: [{ oldText, newText: oldText + trace }],
    },
  })).toBeNull();
});

test('allows only Tutor-owned Markdown memory paths', () => {
  const root = copyFixture();
  const allowed = [
    'memory/objects/obj-001-isomorphic-recognition.md',
    'memory/preferences/pref-001-workload.md',
    'memory/indexes/algebraic-structure.md',
  ];
  for (const path of allowed) {
    expect(validateLessonMemoryWrite(root, scope, {
      toolName: 'write',
      input: { path, content: '# Memory\n' },
    })).toBeNull();
  }
  expect(validateLessonMemoryWrite(root, scope, {
    toolName: 'edit',
    input: {
      path: 'memory/INDEX.md',
      edits: [{
        oldText: '- 尚无已固化课堂记忆。',
        newText: '- 当前前沿：同构识别。',
      }],
    },
  })).toBeNull();
});

test('blocks lifecycle, evidence, capability, sibling, and escaped writes', () => {
  const root = copyFixture();
  const blocked = [
    {
      toolName: 'edit' as const,
      input: {
        path: scope.nodePath,
        edits: [{ oldText: 'status: active', newText: 'status: closed' }],
      },
    },
    {
      toolName: 'write' as const,
      input: { path: scope.nodePath, content: '# replacement' },
    },
    {
      toolName: 'write' as const,
      input: { path: 'memory/capabilities/cap-001.md', content: '# Capability' },
    },
    {
      toolName: 'write' as const,
      input: { path: 'plans/plan-001/PLAN.md', content: '# Plan' },
    },
    {
      toolName: 'edit' as const,
      input: {
        path: 'plans/plan-001/lessons/lesson-002.md',
        edits: [{ oldText: 'old', newText: 'new' }],
      },
    },
    {
      toolName: 'write' as const,
      input: { path: '../outside.md', content: '# Outside' },
    },
    {
      toolName: 'write' as const,
      input: { path: join(root, 'memory/objects/obj-001.md'), content: '# Absolute' },
    },
  ];

  for (const call of blocked) {
    expect(validateLessonMemoryWrite(root, scope, call))
      .toContain('LESSON_MEMORY_WRITE_BLOCKED');
  }
});

test('blocks rejected native writes before execution', async () => {
  const root = copyFixture();
  let handler: ((event: {
    toolName: string;
    input: Record<string, unknown>;
  }) => unknown) | null = null;
  const api = {
    on(name: string, value: typeof handler) {
      if (name === 'tool_call') handler = value;
    },
  } as unknown as ExtensionAPI;

  lessonMemoryGuard(root, scope)(api);
  expect(handler).not.toBeNull();
  expect(await handler!({
    toolName: 'write',
    input: { path: 'ROADMAP.md', content: '# Replacement' },
  })).toEqual({
    block: true,
    reason: expect.stringContaining('LESSON_MEMORY_WRITE_BLOCKED'),
  });
  expect(await handler!({
    toolName: 'read',
    input: { path: 'memory/INDEX.md' },
  })).toBeUndefined();
});
