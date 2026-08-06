import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';

export const STUDY_SUBAGENTS = new Set([
  'study-material-scout',
  'lesson-risk-reviewer',
]);

const blockedReason = [
  'STUDY_SUBAGENT_NOT_ALLOWED:',
  'Plan sessions may run only study-material-scout or lesson-risk-reviewer.',
].join(' ');

function object(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function allowedAgent(value: unknown): boolean {
  return typeof value === 'string' && STUDY_SUBAGENTS.has(value);
}

export function validateStudySubagentCall(input: unknown): string | null {
  const value = object(input);
  if (!value || 'action' in value || 'chain' in value) return blockedReason;

  if ('tasks' in value) {
    if ('agent' in value || !Array.isArray(value.tasks) || value.tasks.length === 0) {
      return blockedReason;
    }
    return value.tasks.every((task) => allowedAgent(object(task)?.agent))
      ? null
      : blockedReason;
  }

  return allowedAgent(value.agent) ? null : blockedReason;
}

export function studySubagentGuard(pi: ExtensionAPI): void {
  pi.on('tool_call', (event) => {
    if (event.toolName !== 'subagent') return undefined;
    const reason = validateStudySubagentCall(event.input);
    return reason ? { block: true, reason } : undefined;
  });
}
