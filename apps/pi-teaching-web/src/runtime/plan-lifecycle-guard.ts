import type {
  ExtensionAPI,
  ExtensionFactory,
} from '@earendil-works/pi-coding-agent';
import { readFileSync, realpathSync } from 'node:fs';
import { isAbsolute, resolve } from 'node:path';
import type { NodeSessionScope } from './session-scope';

export type PlanNativeWriteCall = {
  toolName: 'edit' | 'write';
  input: unknown;
};

const blocked = 'PLAN_LIFECYCLE_WRITE_BLOCKED: update Plan content with native tools, '
  + 'but finish the bound Plan only with finish_plan.';

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function targetsBoundPlan(root: string, scope: NodeSessionScope, input: unknown): boolean {
  const path = record(input)?.path;
  if (typeof path !== 'string') return false;
  try {
    const requested = realpathSync(isAbsolute(path) ? path : resolve(root, path));
    const boundPlan = realpathSync(resolve(root, scope.nodePath));
    return requested === boundPlan;
  } catch {
    return false;
  }
}

function lifecycleStatus(source: string): string | null {
  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(source)?.[1];
  if (!frontmatter) return null;
  const matches = [...frontmatter.matchAll(/^status:\s*([^\s#]+)\s*(?:#.*)?$/gm)];
  return matches.length === 1 ? matches[0]![1]! : null;
}

function editedSource(source: string, input: Record<string, unknown>): string | null {
  if (!Array.isArray(input.edits)) return null;
  const replacements: Array<{ start: number; end: number; text: string }> = [];
  for (const value of input.edits) {
    const edit = record(value);
    if (!edit || typeof edit.oldText !== 'string' || typeof edit.newText !== 'string') return null;
    const start = source.indexOf(edit.oldText);
    if (start < 0 || source.indexOf(edit.oldText, start + 1) >= 0) return null;
    replacements.push({ start, end: start + edit.oldText.length, text: edit.newText });
  }
  replacements.sort((left, right) => left.start - right.start);
  for (let index = 1; index < replacements.length; index += 1) {
    if (replacements[index]!.start < replacements[index - 1]!.end) return null;
  }
  let result = source;
  for (const replacement of replacements.reverse()) {
    result = `${result.slice(0, replacement.start)}${replacement.text}${result.slice(replacement.end)}`;
  }
  return result;
}

export function validatePlanLifecycleWrite(
  root: string,
  scope: NodeSessionScope,
  call: PlanNativeWriteCall,
): string | null {
  if (scope.nodeKind !== 'plan') return `${blocked} Guard requires a Plan scope.`;
  if (!targetsBoundPlan(root, scope, call.input)) return null;

  const input = record(call.input);
  if (!input) return blocked;
  const before = readFileSync(resolve(root, scope.nodePath), 'utf8');
  const after = call.toolName === 'write'
    ? typeof input.content === 'string' ? input.content : null
    : editedSource(before, input);
  if (after === null || lifecycleStatus(after) !== lifecycleStatus(before)) return blocked;
  return null;
}

export function planLifecycleGuard(
  root: string,
  scope: NodeSessionScope,
): ExtensionFactory {
  return (pi: ExtensionAPI): void => {
    pi.on('tool_call', (event) => {
      if (event.toolName !== 'edit' && event.toolName !== 'write') return undefined;
      const reason = validatePlanLifecycleWrite(root, scope, {
        toolName: event.toolName,
        input: event.input,
      });
      return reason ? { block: true, reason } : undefined;
    });
  };
}
