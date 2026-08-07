import type {
  ExtensionAPI,
  ExtensionFactory,
} from '@earendil-works/pi-coding-agent';
import type { NodeSessionScope } from './session-scope';

export type LessonMemoryWriteCall = {
  toolName: 'edit' | 'write';
  input: unknown;
};

const blockedPrefix = 'LESSON_MEMORY_WRITE_BLOCKED:';

export function validateLessonMemoryWrite(
  _root: string,
  scope: NodeSessionScope,
  call: LessonMemoryWriteCall,
): string | null {
  if (scope.nodeKind !== 'lesson') {
    return `${blockedPrefix} guard requires a Lesson scope`;
  }
  return `${blockedPrefix} Lesson Session does not use native ${call.toolName}; `
    + 'use classroom_log_append, classroom_update, or lesson_memory_commit.';
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
