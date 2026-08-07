import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import {
  appendClassroomLogSource,
  applyClassroomChange,
  type ClassroomChange,
} from '../study/lesson-mutations';
import { parseLessonSource } from '../study/markdown';
import { mutateDocumentAtomically } from './atomic-document';
import { createLessonMemoryTool } from './memory-tools';

const blockId = Type.String({
  pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
  description: 'One Block ID already visible in the current Lesson.',
});

const placement = Type.Object({
  position: Type.Union([Type.Literal('before'), Type.Literal('after')]),
  anchorBlockId: blockId,
}, { additionalProperties: false });

const blockDraft = Type.Object({
  title: Type.String({ minLength: 1 }),
  kind: Type.Union([
    Type.Literal('dialogue'),
    Type.Literal('problem'),
    Type.Literal('material'),
    Type.Literal('reflection'),
  ]),
  required: Type.Boolean(),
  dependsOn: Type.Array(blockId),
  uses: Type.Array(Type.String({
    pattern: '^(?:cards/.+\\.ya?ml|materials/.+)$',
    description: 'An exact source path already bound to the current evidence boundary.',
  })),
  studentView: Type.String({ minLength: 1 }),
  teacherControl: Type.String({ minLength: 1 }),
}, { additionalProperties: false });

const classroomUpdateParameters = Type.Object({
  change: Type.Union([
    Type.Object({
      command: Type.Literal('start'),
      blockId,
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('advance'),
      outcome: Type.Union([Type.Literal('completed'), Type.Literal('skipped')]),
      nextBlockId: Type.Union([blockId, Type.Null()]),
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('insert'),
      placement,
      block: blockDraft,
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('revise'),
      blockId,
      block: blockDraft,
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('move'),
      blockId,
      placement,
    }, { additionalProperties: false }),
    Type.Object({
      command: Type.Literal('skip_pending'),
      blockId,
    }, { additionalProperties: false }),
  ]),
}, { additionalProperties: false });

function toolResult(value: Record<string, unknown>, command: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind: 'lesson-write', command },
  };
}

export function createLessonTools(root: string, lessonPath: string) {
  const validate = (source: string) => parseLessonSource(lessonPath, source);
  const logTool = defineTool({
    name: 'classroom_log_append',
    label: '记录课堂事实',
    description: 'Append one decision-relevant classroom fact to the current active Block.',
    executionMode: 'sequential',
    parameters: Type.Object({
      note: Type.String({
        minLength: 1,
        description: 'One natural-language classroom fact; multiple sentences are allowed.',
      }),
    }, { additionalProperties: false }),
    execute: async (_toolCallId, { note }) => {
      const receipt = mutateDocumentAtomically(
        root,
        lessonPath,
        (source) => {
          const candidate = appendClassroomLogSource(lessonPath, source, note);
          const lesson = parseLessonSource(lessonPath, candidate);
          const active = lesson.blocks.find((block) => block.status === 'active')!;
          return {
            source: candidate,
            value: {
              ok: true,
              activeBlockId: active.id,
              classroomLogCount: active.classroomLog.length,
            },
          };
        },
        validate,
      );
      return toolResult(receipt, 'log_append');
    },
  });

  const updateTool = defineTool({
    name: 'classroom_update',
    label: '更新课堂活动',
    description: 'Apply one Block start, advance, or pending-route adaptation in the current Lesson.',
    executionMode: 'sequential',
    parameters: classroomUpdateParameters,
    execute: async (_toolCallId, { change }) => {
      const receipt = mutateDocumentAtomically(
        root,
        lessonPath,
        (source) => {
          const result = applyClassroomChange(
            root,
            lessonPath,
            source,
            change as ClassroomChange,
          );
          const { source: candidate, ...cursor } = result;
          return {
            source: candidate,
            value: { ok: true, ...cursor },
          };
        },
        validate,
      );
      return toolResult(receipt, change.command);
    },
  });

  const memoryTool = createLessonMemoryTool(root, lessonPath);
  return memoryTool ? [logTool, updateTool, memoryTool] : [logTool, updateTool];
}
