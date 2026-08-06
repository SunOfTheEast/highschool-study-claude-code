import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve, sep } from 'node:path';
import type {
  EditToolInput,
  ExtensionAPI,
  ExtensionFactory,
  WriteToolInput,
} from '@earendil-works/pi-coding-agent';
import { parseLessonSource } from '../study/markdown';
import type { NodeSessionScope } from './session-scope';

export type LessonMemoryWriteCall = {
  toolName: 'edit' | 'write';
  input: unknown;
};

const blockedPrefix = 'LESSON_MEMORY_WRITE_BLOCKED:';

function blocked(detail: string): string {
  return `${blockedPrefix} ${detail}`;
}

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function normalizedPath(root: string, value: unknown): string | null {
  if (
    typeof value !== 'string'
    || value.length === 0
    || isAbsolute(value)
    || value.includes('\\')
  ) return null;
  const absoluteRoot = resolve(root);
  const absolutePath = resolve(absoluteRoot, value);
  if (
    absolutePath !== absoluteRoot
    && !absolutePath.startsWith(`${absoluteRoot}${sep}`)
  ) return null;
  const result = relative(absoluteRoot, absolutePath).split(sep).join('/');
  return result.length > 0 ? result : null;
}

function tutorOwnedMemoryPath(path: string): boolean {
  if (path === 'memory/INDEX.md') return true;
  return /^memory\/(?:indexes|objects|preferences)\/[A-Za-z0-9][A-Za-z0-9._/-]*\.md$/
    .test(path);
}

function editInput(value: unknown): EditToolInput | null {
  const input = object(value);
  if (
    !input
    || typeof input.path !== 'string'
    || !Array.isArray(input.edits)
    || input.edits.length === 0
  ) return null;
  for (const edit of input.edits) {
    const item = object(edit);
    if (!item || typeof item.oldText !== 'string' || typeof item.newText !== 'string') {
      return null;
    }
  }
  return input as EditToolInput;
}

function writeInput(value: unknown): WriteToolInput | null {
  const input = object(value);
  return input && typeof input.path === 'string' && typeof input.content === 'string'
    ? input as WriteToolInput
    : null;
}

function validateCurrentLessonAppend(
  root: string,
  scope: NodeSessionScope,
  input: EditToolInput,
): string | null {
  if (input.edits.length !== 1) {
    return blocked('the current Lesson accepts exactly one append edit');
  }
  const edit = input.edits[0]!;
  if (
    edit.oldText.length === 0
    || !edit.newText.startsWith(edit.oldText)
    || edit.newText.length === edit.oldText.length
  ) return blocked('the current Lesson edit must only append content');

  const source = readFileSync(resolve(root, scope.nodePath), 'utf8');
  if (!source.endsWith(edit.oldText)) {
    return blocked('the current Lesson edit must target its exact end');
  }
  const before = parseLessonSource(scope.nodePath, source);
  if (before.status !== 'active') {
    return blocked('learning traces can be consolidated only while the Lesson is active');
  }
  const suffix = edit.newText.slice(edit.oldText.length);
  const expectedStart = before.consolidatedLearningTraces === null
    ? /^(?:\r?\n){1,2}## Consolidated Learning Traces\r?\n/
    : /^(?:\r?\n){1,2}### trace-[A-Za-z0-9][A-Za-z0-9._-]*\r?\n/;
  if (!expectedStart.test(suffix)) {
    return blocked('the current Lesson accepts only a consolidated trace append');
  }

  const candidate = source.slice(0, source.length - edit.oldText.length) + edit.newText;
  try {
    parseLessonSource(scope.nodePath, candidate);
  } catch (error) {
    const detail = error instanceof Error ? error.message : 'invalid Lesson candidate';
    return blocked(detail);
  }
  return null;
}

export function validateLessonMemoryWrite(
  root: string,
  scope: NodeSessionScope,
  call: LessonMemoryWriteCall,
): string | null {
  if (scope.nodeKind !== 'lesson') return blocked('guard requires a Lesson scope');
  const input = call.toolName === 'edit' ? editInput(call.input) : writeInput(call.input);
  if (!input) return blocked(`invalid ${call.toolName} input`);
  const path = normalizedPath(root, input.path);
  if (!path) return blocked('path must stay relative to the learning set');

  if (path === scope.nodePath) {
    return call.toolName === 'edit'
      ? validateCurrentLessonAppend(root, scope, input as EditToolInput)
      : blocked('write cannot replace the current Lesson');
  }

  if (!tutorOwnedMemoryPath(path)) {
    return blocked('Tutor may write only its current Lesson traces and Tutor-owned memory');
  }
  if (call.toolName === 'write' && existsSync(resolve(root, path))) {
    return blocked('write may create a memory file but cannot replace an existing one; use edit');
  }
  return null;
}

export function lessonMemoryGuard(
  root: string,
  scope: NodeSessionScope,
): ExtensionFactory {
  return (pi: ExtensionAPI): void => {
    pi.on('tool_call', (event) => {
      if (event.toolName !== 'edit' && event.toolName !== 'write') return undefined;
      const reason = validateLessonMemoryWrite(root, scope, {
        toolName: event.toolName,
        input: event.input,
      });
      return reason ? { block: true, reason } : undefined;
    });
  };
}
