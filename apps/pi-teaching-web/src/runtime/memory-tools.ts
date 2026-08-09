import { randomUUID } from 'node:crypto';
import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import {
  planDeferredRouteResolution,
  planFreeLearningMemoryCommit,
  planLessonMemoryCommit,
  type BucketRef,
  type FreeLearningMemoryCommitDraft,
  type LessonMemoryCommitDraft,
} from '../study/memory-mutations';
import { commitDocumentCandidates } from './multi-document-transaction';
import {
  inspectPersistedMemoryToolCall,
  pendingToolResultCandidate,
  readPendingToolResult,
  renderStableMemoryToolResult,
  type MemoryToolName,
  type RecoverableToolSession,
  type StableMemoryToolResult,
} from './pending-tool-results';

const stableId = Type.String({
  pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
});

const objectId = Type.String({
  pattern: '^obj-[A-Za-z0-9][A-Za-z0-9._-]*$',
  description: 'One stable object ID already visible in the memory index or an object file.',
});

const preferenceId = Type.String({
  pattern: '^pref-[A-Za-z0-9][A-Za-z0-9._-]*$',
  description: 'One stable preference ID already visible in the memory index or a preference file.',
});

const localKey = Type.String({
  pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
  description: 'A call-local key used only to connect new items inside this submission.',
});

const newTarget = Type.Object({
  kind: Type.Literal('new'),
  key: localKey,
  title: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

const existingObjectTarget = Type.Object({
  kind: Type.Literal('existing'),
  id: objectId,
}, { additionalProperties: false });

const objectTarget = Type.Union([
  existingObjectTarget,
  newTarget,
]);

const preferenceTarget = Type.Union([
  Type.Object({
    kind: Type.Literal('existing'),
    id: preferenceId,
  }, { additionalProperties: false }),
  newTarget,
]);

const bucketRef = Type.Union([
  Type.Object({
    kind: Type.Literal('existing'),
    id: stableId,
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal('new'),
    key: localKey,
    title: Type.String({ minLength: 1 }),
  }, { additionalProperties: false }),
]);

const routing = Type.Union([
  Type.Object({ kind: Type.Literal('keep') }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal('assign'),
    buckets: Type.Array(bucketRef, { minItems: 1 }),
  }, { additionalProperties: false }),
  Type.Object({
    kind: Type.Literal('defer'),
    reason: Type.String({ minLength: 1 }),
  }, { additionalProperties: false }),
]);

const lessonLearningHistoryEntry = Type.Object({
  change: Type.String({ minLength: 1 }),
  evidenceBlockIds: Type.Array(stableId, { minItems: 1, uniqueItems: true }),
}, { additionalProperties: false });

const lessonObjectMutation = Type.Union([
  Type.Object({
    target: existingObjectTarget,
    currentJudgment: Type.Optional(Type.String({ minLength: 1 })),
    evolutionOverview: Type.Optional(Type.String({ minLength: 1 })),
    boundaries: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
    learningHistoryEntry: lessonLearningHistoryEntry,
    routing,
    frontierSummary: Type.Optional(Type.String({ minLength: 1 })),
  }, { additionalProperties: false }),
  Type.Object({
    target: newTarget,
    currentJudgment: Type.String({ minLength: 1 }),
    evolutionOverview: Type.String({ minLength: 1 }),
    boundaries: Type.Array(Type.String({ minLength: 1 })),
    learningHistoryEntry: lessonLearningHistoryEntry,
    routing,
    frontierSummary: Type.Optional(Type.String({ minLength: 1 })),
  }, { additionalProperties: false }),
]);

const lessonMemoryCommitParameters = Type.Object({
  objects: Type.Array(lessonObjectMutation),
  preferences: Type.Array(Type.Object({
    target: preferenceTarget,
    currentJudgment: Type.String({ minLength: 1 }),
    scope: Type.Array(Type.String({ minLength: 1 }), { minItems: 1 }),
    explicitStatements: Type.Array(Type.Object({
      text: Type.String({ minLength: 1 }),
      evidenceBlockId: stableId,
    }, { additionalProperties: false }), { minItems: 1 }),
    evolutionEntry: Type.String({ minLength: 1 }),
    cue: Type.Union([
      Type.Object({ kind: Type.Literal('keep') }, { additionalProperties: false }),
      Type.Object({
        kind: Type.Literal('upsert'),
        summary: Type.String({ minLength: 1 }),
      }, { additionalProperties: false }),
      Type.Object({ kind: Type.Literal('remove') }, { additionalProperties: false }),
    ]),
  }, { additionalProperties: false })),
}, { additionalProperties: false });

const routeResolveParameters = Type.Object({
  objectId,
  buckets: Type.Array(bucketRef, { minItems: 1 }),
}, { additionalProperties: false });

const freeLearningMemoryCommitParameters = Type.Object({
  objects: Type.Array(Type.Object({
    target: objectTarget,
    learningHistoryChange: Type.String({ minLength: 1 }),
    currentJudgment: Type.Optional(Type.String({ minLength: 1 })),
    evolutionOverview: Type.Optional(Type.String({ minLength: 1 })),
    boundaries: Type.Optional(Type.Array(Type.String({ minLength: 1 }), { minItems: 1 })),
    routing,
    frontierSummary: Type.Optional(Type.String({ minLength: 1 })),
  }, { additionalProperties: false }), { minItems: 1 }),
}, { additionalProperties: false });

function toolResult(
  value: Record<string, unknown>,
  kind: 'lesson-memory-commit' | 'memory-route-resolve' | 'free-learning-memory-commit',
) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind },
  };
}

function recoverableCall(
  root: string,
  session: RecoverableToolSession,
  toolName: MemoryToolName,
  toolCallId: string,
  input: unknown,
): { requestDigest: string; replay: ReturnType<typeof renderStableMemoryToolResult> | null } {
  const inspected = inspectPersistedMemoryToolCall(
    session,
    toolName,
    toolCallId,
    input,
  );
  if (inspected.persistedResult) {
    if (inspected.persistedResult.isError) throw new Error('MEMORY_TOOL_CALL_ALREADY_FAILED');
    const content = inspected.persistedResult.content;
    if (content.length !== 1 || content[0]?.type !== 'text') {
      throw new Error('MEMORY_TOOL_RESULT_INVALID');
    }
    return {
      requestDigest: inspected.requestDigest,
      replay: {
        content: [{ type: 'text', text: content[0].text }],
        details: inspected.persistedResult.details as Record<string, string>,
      },
    };
  }
  const pending = readPendingToolResult(root, session.getSessionId(), toolCallId);
  if (!pending) return { requestDigest: inspected.requestDigest, replay: null };
  if (
    pending.toolName !== toolName
    || pending.toolCallId !== toolCallId
    || pending.requestDigest !== inspected.requestDigest
  ) {
    throw new Error('PENDING_TOOL_RESULT_MISMATCH');
  }
  return {
    requestDigest: inspected.requestDigest,
    replay: renderStableMemoryToolResult(toolName, pending.result),
  };
}

export function createFreeLearningMemoryTool(root: string, session: RecoverableToolSession) {
  if (!memoryEnabled(root)) return null;
  return defineTool({
    name: 'free_learning_memory_commit',
    label: '更新教师对象记忆',
    description: 'Append one meaningful cognitive change from the current native free-learning Session and patch only the object snapshot fields that actually changed.',
    executionMode: 'sequential',
    parameters: freeLearningMemoryCommitParameters,
    execute: async (toolCallId, input) => {
      const call = recoverableCall(
        root,
        session,
        'free_learning_memory_commit',
        toolCallId,
        input,
      );
      if (call.replay) return call.replay;
      const commitId = randomUUID();
      const planned = planFreeLearningMemoryCommit(
        root,
        session.getSessionId(),
        input as FreeLearningMemoryCommitDraft,
        new Date().toISOString(),
      );
      const stable: StableMemoryToolResult = {
        ok: true,
        commitId,
        objectIds: planned.objectIds,
        bucketIds: planned.bucketIds,
        changedPaths: planned.candidates.map((candidate) => candidate.path),
      };
      const pending = pendingToolResultCandidate(
        root,
        session.getSessionId(),
        'free_learning_memory_commit',
        toolCallId,
        call.requestDigest,
        commitId,
        stable,
      );
      commitDocumentCandidates(root, [...planned.candidates, pending], { commitId });
      return renderStableMemoryToolResult('free_learning_memory_commit', stable);
    },
  });
}

export function memoryEnabled(root: string): boolean {
  const path = join(root, 'memory', 'INDEX.md');
  return existsSync(path) && lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink();
}

export function createLessonMemoryTool(
  root: string,
  lessonPath: string,
  session: RecoverableToolSession,
) {
  if (!memoryEnabled(root)) return null;
  return defineTool({
    name: 'lesson_memory_commit',
    label: '固化本课教师记忆',
    description: 'Append current-Lesson object history, patch only changed existing snapshots, create complete new snapshots, and atomically commit explicit preferences and routing.',
    executionMode: 'sequential',
    parameters: lessonMemoryCommitParameters,
    execute: async (toolCallId, input) => {
      const call = recoverableCall(
        root,
        session,
        'lesson_memory_commit',
        toolCallId,
        input,
      );
      if (call.replay) return call.replay;
      const commitId = randomUUID();
      const planned = planLessonMemoryCommit(
        root,
        lessonPath,
        input as LessonMemoryCommitDraft,
        new Date().toISOString(),
      );
      const stable: StableMemoryToolResult = {
        ok: true,
        commitId,
        objectIds: planned.objectIds,
        preferenceIds: planned.preferenceIds,
        bucketIds: planned.bucketIds,
        changedPaths: planned.candidates.map((candidate) => candidate.path),
      };
      const pending = pendingToolResultCandidate(
        root,
        session.getSessionId(),
        'lesson_memory_commit',
        toolCallId,
        call.requestDigest,
        commitId,
        stable,
      );
      commitDocumentCandidates(root, [...planned.candidates, pending], { commitId });
      return renderStableMemoryToolResult('lesson_memory_commit', stable);
    },
  });
}

export function createPlanMemoryTools(root: string) {
  if (!memoryEnabled(root)) return [];
  const successful = new Map<string, ReturnType<typeof toolResult>>();
  return [defineTool({
    name: 'memory_route_resolve',
    label: '确认待分桶对象入口',
    description: 'Resolve one object already listed under Deferred Object Routing into only the Coach-declared buckets.',
    executionMode: 'sequential',
    parameters: routeResolveParameters,
    execute: async (toolCallId, input) => {
      const replay = successful.get(toolCallId);
      if (replay) return replay;
      const started = performance.now();
      const planned = planDeferredRouteResolution(
        root,
        input.objectId,
        input.buckets as BucketRef[],
      );
      const committed = commitDocumentCandidates(root, planned.candidates);
      const result = toolResult({
        ok: true,
        commitId: committed.commitId,
        bucketIds: planned.bucketIds,
        changedPaths: committed.changedPaths,
        durationMs: performance.now() - started,
      }, 'memory-route-resolve');
      successful.set(toolCallId, result);
      return result;
    },
  })];
}
