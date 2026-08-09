import { createHash } from 'node:crypto';
import {
  existsSync,
  lstatSync,
  readFileSync,
  unlinkSync,
} from 'node:fs';
import type { ToolCall, ToolResultMessage } from '@earendil-works/pi-ai';
import type { SessionEntry, SessionManager } from '@earendil-works/pi-coding-agent';
import { resolveDocumentPath } from './atomic-document';
import type { DocumentCandidate } from './multi-document-transaction';

export type MemoryToolName = 'lesson_memory_commit' | 'free_learning_memory_commit';

export type StableMemoryToolResult = {
  ok: true;
  commitId: string;
  changedPaths: string[];
  objectIds: Record<string, string>;
  preferenceIds?: Record<string, string>;
  bucketIds: Record<string, string>;
};

export type PendingToolResult = {
  version: 1;
  toolName: MemoryToolName;
  toolCallId: string;
  requestDigest: string;
  commitId: string;
  result: StableMemoryToolResult;
};

export type RecoverableToolSession = {
  getSessionId(): string;
  getBranch(): readonly SessionEntry[];
};

const memoryToolNames = new Set<MemoryToolName>([
  'lesson_memory_commit',
  'free_learning_memory_commit',
]);

function safeKey(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function pendingPath(sessionId: string, toolCallId: string): string {
  return `.studyforge/pending-tool-results/${safeKey(sessionId)}/${safeKey(toolCallId)}.json`;
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => [key, canonicalJson(item)]));
  }
  return value;
}

export function stableToolInputDigest(input: unknown): string {
  const encoded = JSON.stringify({ version: 1, input: canonicalJson(input) });
  return createHash('sha256').update(encoded).digest('hex');
}

function isMemoryToolName(value: string): value is MemoryToolName {
  return memoryToolNames.has(value as MemoryToolName);
}

function toolCalls(entries: readonly SessionEntry[]): ToolCall[] {
  return entries.flatMap((entry) => (
    entry.type === 'message' && entry.message.role === 'assistant'
      ? entry.message.content.flatMap((item) => item.type === 'toolCall' ? [item] : [])
      : []
  ));
}

function toolResults(entries: readonly SessionEntry[]): ToolResultMessage[] {
  return entries.flatMap((entry) => (
    entry.type === 'message' && entry.message.role === 'toolResult'
      ? [entry.message]
      : []
  ));
}

export function inspectPersistedMemoryToolCall(
  session: RecoverableToolSession,
  toolName: MemoryToolName,
  toolCallId: string,
  input: unknown,
): { requestDigest: string; persistedResult: ToolResultMessage | null } {
  const branch = session.getBranch();
  const call = toolCalls(branch).find((item) => item.id === toolCallId);
  if (!call) throw new Error('MEMORY_TOOL_CALL_NOT_PERSISTED');
  if (call.name !== toolName) throw new Error('MEMORY_TOOL_CALL_NAME_MISMATCH');
  const requestDigest = stableToolInputDigest(input);
  if (stableToolInputDigest(call.arguments) !== requestDigest) {
    throw new Error('MEMORY_TOOL_ARGUMENTS_MISMATCH');
  }
  const persistedResult = toolResults(branch).find(
    (item) => item.toolCallId === toolCallId,
  ) ?? null;
  if (persistedResult && persistedResult.toolName !== toolName) {
    throw new Error('MEMORY_TOOL_RESULT_NAME_MISMATCH');
  }
  return { requestDigest, persistedResult };
}

function parsePending(source: string): PendingToolResult {
  const parsed = JSON.parse(source) as Partial<PendingToolResult>;
  if (
    parsed.version !== 1
    || !parsed.toolName
    || !isMemoryToolName(parsed.toolName)
    || typeof parsed.toolCallId !== 'string'
    || typeof parsed.requestDigest !== 'string'
    || typeof parsed.commitId !== 'string'
    || !parsed.result
    || parsed.result.ok !== true
    || parsed.result.commitId !== parsed.commitId
  ) {
    throw new Error('PENDING_TOOL_RESULT_INVALID');
  }
  return parsed as PendingToolResult;
}

export function pendingToolResultCandidate(
  root: string,
  sessionId: string,
  toolName: MemoryToolName,
  toolCallId: string,
  requestDigest: string,
  commitId: string,
  result: StableMemoryToolResult,
): DocumentCandidate {
  const path = pendingPath(sessionId, toolCallId);
  const absolute = resolveDocumentPath(root, path);
  if (existsSync(absolute)) throw new Error('PENDING_TOOL_RESULT_EXISTS');
  const pending: PendingToolResult = {
    version: 1,
    toolName,
    toolCallId,
    requestDigest,
    commitId,
    result,
  };
  const after = `${JSON.stringify(pending, null, 2)}\n`;
  return {
    path,
    before: null,
    after,
    validate: (source) => { parsePending(source); },
  };
}

export function readPendingToolResult(
  root: string,
  sessionId: string,
  toolCallId: string,
): PendingToolResult | null {
  const absolute = resolveDocumentPath(root, pendingPath(sessionId, toolCallId));
  if (!existsSync(absolute)) return null;
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('PENDING_TOOL_RESULT_INVALID');
  return parsePending(readFileSync(absolute, 'utf8'));
}

export function clearPersistedPendingResult(
  root: string,
  sessionId: string,
  toolCallId: string,
): void {
  const absolute = resolveDocumentPath(root, pendingPath(sessionId, toolCallId));
  if (!existsSync(absolute)) return;
  const stat = lstatSync(absolute);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('PENDING_TOOL_RESULT_INVALID');
  unlinkSync(absolute);
}

function pendingMatchesCall(pending: PendingToolResult, call: ToolCall): boolean {
  return pending.toolName === call.name
    && pending.toolCallId === call.id
    && pending.requestDigest === stableToolInputDigest(call.arguments);
}

function resultDetails(toolName: MemoryToolName): Record<string, string> {
  return {
    kind: toolName === 'lesson_memory_commit'
      ? 'lesson-memory-commit'
      : 'free-learning-memory-commit',
  };
}

export function renderStableMemoryToolResult(
  toolName: MemoryToolName,
  result: StableMemoryToolResult,
) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(result) }],
    details: resultDetails(toolName),
  };
}

function persistedResultMatches(
  persisted: ToolResultMessage,
  pending: PendingToolResult,
): boolean {
  return !persisted.isError
    && persisted.toolName === pending.toolName
    && persisted.toolCallId === pending.toolCallId
    && persisted.content.length === 1
    && persisted.content[0]?.type === 'text'
    && persisted.content[0].text === JSON.stringify(pending.result);
}

export function clearSettledPendingMemoryToolResults(
  root: string,
  session: RecoverableToolSession,
): void {
  const branch = session.getBranch();
  const results = toolResults(branch);
  for (const call of toolCalls(branch)) {
    if (!isMemoryToolName(call.name)) continue;
    const pending = readPendingToolResult(root, session.getSessionId(), call.id);
    if (!pending || !pendingMatchesCall(pending, call)) continue;
    const result = results.find((item) => item.toolCallId === call.id);
    if (result && persistedResultMatches(result, pending)) {
      clearPersistedPendingResult(root, session.getSessionId(), call.id);
    }
  }
}

export function reconcilePendingMemoryToolResults(
  root: string,
  manager: Pick<SessionManager, 'getSessionId' | 'getBranch' | 'appendMessage'>,
): void {
  const branch = manager.getBranch();
  const results = toolResults(branch);
  for (const call of toolCalls(branch)) {
    if (!isMemoryToolName(call.name)) continue;
    const pending = readPendingToolResult(root, manager.getSessionId(), call.id);
    const persisted = results.find((item) => item.toolCallId === call.id);
    if (persisted) {
      if (pending && pendingMatchesCall(pending, call) && persistedResultMatches(persisted, pending)) {
        clearPersistedPendingResult(root, manager.getSessionId(), call.id);
      }
      continue;
    }
    if (!pending) {
      manager.appendMessage({
        role: 'toolResult',
        toolCallId: call.id,
        toolName: call.name,
        content: [{ type: 'text', text: 'INTERRUPTED_BEFORE_COMMIT' }],
        isError: true,
        timestamp: Date.now(),
      });
      continue;
    }
    if (!pendingMatchesCall(pending, call)) continue;
    const rendered = renderStableMemoryToolResult(pending.toolName, pending.result);
    manager.appendMessage({
      role: 'toolResult',
      toolCallId: call.id,
      toolName: call.name,
      content: rendered.content,
      details: rendered.details,
      isError: false,
      timestamp: Date.now(),
    });
    clearSettledPendingMemoryToolResults(root, manager);
  }
}
