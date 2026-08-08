import { existsSync, lstatSync } from 'node:fs';
import { join } from 'node:path';
import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import {
  planDeferredRouteResolution,
  planLessonMemoryCommit,
  type BucketRef,
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

const objectTarget = Type.Union([
  Type.Object({
    kind: Type.Literal('existing'),
    id: objectId,
  }, { additionalProperties: false }),
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

const lessonMemoryCommitParameters = Type.Object({
  closingFact: Type.Optional(Type.Object({
    blockId: stableId,
    note: Type.String({ minLength: 1 }),
  }, { additionalProperties: false })),
  objects: Type.Array(Type.Object({
    target: objectTarget,
    currentJudgment: Type.String({ minLength: 1 }),
    evolutionOverview: Type.String({ minLength: 1 }),
    boundaries: Type.Array(Type.String({ minLength: 1 })),
    learningHistoryEntry: Type.Object({
      change: Type.String({ minLength: 1 }),
      evidenceBlockIds: Type.Array(stableId, { minItems: 1, uniqueItems: true }),
    }, { additionalProperties: false }),
    routing,
    frontierSummary: Type.Optional(Type.String({ minLength: 1 })),
  }, { additionalProperties: false })),
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

function toolResult(
  value: Record<string, unknown>,
  kind: 'lesson-memory-commit' | 'memory-route-resolve',
) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind },
  };
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
    description: 'Atomically commit the current Lesson closing fact, object learning history and judgments, explicit preferences, and model-declared routing.',
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
