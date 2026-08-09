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

export function createFreeLearningMemoryTool(root: string, sessionId: string) {
  if (!memoryEnabled(root)) return null;
  const successful = new Map<string, ReturnType<typeof toolResult>>();
  return defineTool({
    name: 'free_learning_memory_commit',
    label: '更新教师对象记忆',
    description: 'Append one meaningful cognitive change from the current native free-learning Session and patch only the object snapshot fields that actually changed.',
    executionMode: 'sequential',
    parameters: freeLearningMemoryCommitParameters,
    execute: async (toolCallId, input) => {
      const replay = successful.get(toolCallId);
      if (replay) return replay;
      const started = performance.now();
      const planned = planFreeLearningMemoryCommit(
        root,
        sessionId,
        input as FreeLearningMemoryCommitDraft,
        new Date().toISOString(),
      );
      const committed = commitDocumentCandidates(root, planned.candidates);
      const result = toolResult({
        ok: true,
        commitId: committed.commitId,
        objectIds: planned.objectIds,
        bucketIds: planned.bucketIds,
        changedPaths: committed.changedPaths,
        durationMs: performance.now() - started,
      }, 'free-learning-memory-commit');
      successful.set(toolCallId, result);
      return result;
    },
  });
}

export function memoryEnabled(root: string): boolean {
  const path = join(root, 'memory', 'INDEX.md');
  return existsSync(path) && lstatSync(path).isFile() && !lstatSync(path).isSymbolicLink();
}

export function createLessonMemoryTool(root: string, lessonPath: string) {
  if (!memoryEnabled(root)) return null;
  const successful = new Map<string, ReturnType<typeof toolResult>>();
  return defineTool({
    name: 'lesson_memory_commit',
    label: '固化本课教师记忆',
    description: 'Append current-Lesson object history, patch only changed existing snapshots, create complete new snapshots, and atomically commit explicit preferences and routing.',
    executionMode: 'sequential',
    parameters: lessonMemoryCommitParameters,
    execute: async (toolCallId, input) => {
      const replay = successful.get(toolCallId);
      if (replay) return replay;
      const started = performance.now();
      const planned = planLessonMemoryCommit(
        root,
        lessonPath,
        input as LessonMemoryCommitDraft,
        new Date().toISOString(),
      );
      const committed = commitDocumentCandidates(root, planned.candidates);
      const result = toolResult({
        ok: true,
        commitId: committed.commitId,
        objectIds: planned.objectIds,
        preferenceIds: planned.preferenceIds,
        bucketIds: planned.bucketIds,
        changedPaths: committed.changedPaths,
        durationMs: performance.now() - started,
      }, 'lesson-memory-commit');
      successful.set(toolCallId, result);
      return result;
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
