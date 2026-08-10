import { afterEach, expect, test } from 'bun:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  createEditTool,
  createWriteTool,
} from '@earendil-works/pi-coding-agent';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  planLifecycleGuard,
  validatePlanLifecycleWrite,
} from '../../src/runtime/plan-lifecycle-guard';
import type { NodeSessionScope } from '../../src/runtime/session-scope';
import { readPlan } from '../../src/study/markdown';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];
const scope = {
  nodeKind: 'plan',
  nodeId: 'plan-001',
  nodePath: 'plans/plan-001/PLAN.md',
  parentId: 'roadmap',
  parentPath: 'ROADMAP.md',
} as const satisfies NodeSessionScope;

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-plan-lifecycle-guard-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('allows Plan content work but blocks native lifecycle changes', () => {
  const root = copyFixture();
  const source = readFileSync(join(root, scope.nodePath), 'utf8');

  expect(validatePlanLifecycleWrite(root, scope, {
    toolName: 'edit',
    input: {
      path: scope.nodePath,
      edits: [{
        oldText: '第一节课正在进行。',
        newText: '第一节课结束后再更新当前位置。',
      }],
    },
  })).toBeNull();
  expect(validatePlanLifecycleWrite(root, scope, {
    toolName: 'edit',
    input: {
      path: scope.nodePath,
      edits: [{ oldText: 'active', newText: 'completed' }],
    },
  })).toContain('finish_plan');
  expect(validatePlanLifecycleWrite(root, scope, {
    toolName: 'write',
    input: { path: scope.nodePath, content: source.replace('status: active', 'status: completed') },
  })).toContain('finish_plan');
  expect(validatePlanLifecycleWrite(root, scope, {
    toolName: 'write',
    input: { path: scope.nodePath, content: source.replace('第一节课正在进行。', '已完成复盘。') },
  })).toBeNull();
});

test('guards the real native edit and write tools before they touch the bound Plan status', async () => {
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
  planLifecycleGuard(root, scope)(api);

  const edit = createEditTool(root);
  const bodyInput = {
    path: scope.nodePath,
    edits: [{ oldText: '第一节课正在进行。', newText: '第一节课已经完成课堂教学。' }],
  };
  expect(await handler!({ toolName: 'edit', input: bodyInput })).toBeUndefined();
  await edit.execute('edit-plan-body', bodyInput, undefined, undefined);
  expect(readFileSync(join(root, scope.nodePath), 'utf8'))
    .toContain('第一节课已经完成课堂教学。');

  const statusInput = {
    path: scope.nodePath,
    edits: [{ oldText: 'active', newText: 'completed' }],
  };
  expect(await handler!({ toolName: 'edit', input: statusInput })).toEqual({
    block: true,
    reason: expect.stringContaining('finish_plan'),
  });
  expect(readPlan(root, scope.nodePath).status).toBe('active');

  const write = createWriteTool(root);
  const replacement = readFileSync(join(root, scope.nodePath), 'utf8')
    .replace('status: active', 'status: completed');
  const writeInput = { path: scope.nodePath, content: replacement };
  expect(await handler!({ toolName: 'write', input: writeInput })).toEqual({
    block: true,
    reason: expect.stringContaining('finish_plan'),
  });
  expect(readPlan(root, scope.nodePath).status).toBe('active');

  // The native write tool remains available for other Plan-owned artifacts.
  const lessonInput = {
    path: 'plans/plan-001/lessons/lesson-new.md',
    content: '# New prepared Lesson\n',
  };
  expect(await handler!({ toolName: 'write', input: lessonInput })).toBeUndefined();
  await write.execute('write-prepared-lesson', lessonInput, undefined, undefined);
  expect(readFileSync(join(root, lessonInput.path), 'utf8')).toBe(lessonInput.content);
});
