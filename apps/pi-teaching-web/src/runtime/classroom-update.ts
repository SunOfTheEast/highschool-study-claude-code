import { defineTool } from '@earendil-works/pi-coding-agent';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';
import {
  applyClassroomTransition,
  setFrontmatterField,
} from '../study/write-workspace';
import { lessonBlockIdSchema } from './lesson-tool-contracts';
import type { NodeAccessPolicy } from './node-access';

export type ClassroomUpdateOptions = {
  accessPolicy?: NodeAccessPolicy;
};

export function createClassroomUpdateTool(
  root: string,
  ownerPath: string,
  options: ClassroomUpdateOptions = {},
) {
  const blockId = lessonBlockIdSchema(root, ownerPath);
  const commonBlockFields = {
    required: Type.Boolean({
      description: 'Whether the inserted Block is required for this Lesson.',
    }),
    dependsOn: Type.Array(blockId, {
      description: 'Existing Block IDs that must resolve before activation.',
    }),
    studentView: Type.String({
      minLength: 1,
      description: 'Student-visible activity instruction without private control notes.',
    }),
    teacherControl: Type.String({
      minLength: 1,
      description: 'Private Tutor control for this activity.',
    }),
  };
  const dynamicBlock = Type.Union([
    Type.Object({
      kind: Type.Literal('dialogue'),
      ...commonBlockFields,
    }, { additionalProperties: false }),
    Type.Object({
      kind: Type.Literal('material'),
      ...commonBlockFields,
    }, { additionalProperties: false }),
    Type.Object({
      kind: Type.Literal('reflection'),
      ...commonBlockFields,
    }, { additionalProperties: false }),
    Type.Object({
      kind: Type.Literal('problem'),
      ...commonBlockFields,
      cardSource: Type.String({
        pattern: '^card:cards/.+\\.ya?ml$',
        description: 'Exact card:<path> returned by card_search in this Session.',
      }),
    }, { additionalProperties: false }),
  ]);
  const parameters = Type.Object({
    action: Type.Union([
      Type.Literal('activate'),
      Type.Literal('complete'),
      Type.Literal('skip'),
      Type.Literal('route'),
      Type.Literal('insert'),
      Type.Literal('pause'),
    ], {
      description: 'Traverse one existing Block, adapt pending order, insert one new pending Block, or pause the Lesson.',
    }),
    blockId: Type.Optional(blockId),
    routeAction: Type.Optional(Type.Union([
      Type.Literal('skip'),
      Type.Literal('move'),
      Type.Literal('repeat'),
    ], {
      description: 'Adaptive action for one existing Block; present only for route.',
    })),
    before: Type.Optional(blockId),
    after: Type.Optional(Type.Union([blockId, Type.Null()])),
    block: Type.Optional(dynamicBlock),
    reason: Type.Optional(Type.String({
      minLength: 1,
      description: 'Student-facing instructional reason for the adaptation.',
    })),
    source: Type.Optional(Type.String({
      minLength: 1,
      description: 'Evidence or student request that prompted the adaptation.',
    })),
  }, {
    additionalProperties: false,
    oneOf: [
      {
        properties: { action: { const: 'pause' } },
        not: {
          anyOf: [
            { required: ['blockId'] },
            { required: ['routeAction'] },
            { required: ['before'] },
            { required: ['after'] },
            { required: ['block'] },
            { required: ['reason'] },
            { required: ['source'] },
          ],
        },
      },
      {
        properties: { action: { enum: ['activate', 'complete', 'skip'] } },
        required: ['blockId'],
        not: {
          anyOf: [
            { required: ['routeAction'] },
            { required: ['before'] },
            { required: ['after'] },
            { required: ['block'] },
            { required: ['reason'] },
            { required: ['source'] },
          ],
        },
      },
      {
        properties: { action: { const: 'route' } },
        required: ['blockId', 'routeAction', 'reason', 'source'],
        not: {
          anyOf: [
            { required: ['block'] },
            { required: ['after', 'before'] },
          ],
        },
      },
      {
        properties: { action: { const: 'insert' } },
        required: ['after', 'block', 'reason', 'source'],
        not: {
          anyOf: [
            { required: ['blockId'] },
            { required: ['routeAction'] },
            { required: ['before'] },
          ],
        },
      },
    ],
  });
  const response = (
    action: string,
    payload: object,
    factId: string | null = null,
  ) => ({
    content: [{
      type: 'text' as const,
      text: JSON.stringify(payload),
    }],
    details: {
      kind: 'classroom-update',
      lessonPath: ownerPath,
      action,
      factId,
    },
  });

  return defineTool({
    name: 'classroom_update',
    label: '推进课堂节点',
    description: 'Persist one classroom navigation change in the current Tutor Session-owned Lesson. Existing active or completed Block content is immutable. Pending Blocks may be skipped, moved or repeated, and one searched real card may become a new pending problem Block. The runtime owns the Lesson path, Block ID and card alias.',
    parameters,
    execute: async (_id, input) => {
      if (input.action === 'pause') {
        const lesson = readMarkdownFile(root, ownerPath);
        if (lesson.frontmatter.status !== 'active') {
          throw new Error(`CLASSROOM_LESSON_NOT_ACTIVE: ${lesson.frontmatter.status}`);
        }
        setFrontmatterField(root, ownerPath, 'status', 'paused');
        return response(input.action, { ok: true, action: input.action });
      }

      if (input.action === 'insert') {
        if (
          input.after === undefined
          || input.block === undefined
          || !input.reason
          || !input.source
        ) {
          throw new Error('INSERT_FIELDS_REQUIRED');
        }
        let cardPath: string | null = null;
        const block = {
          kind: input.block.kind,
          required: input.block.required,
          dependsOn: input.block.dependsOn,
          studentView: input.block.studentView,
          teacherControl: input.block.teacherControl,
        };
        if (input.block.kind === 'problem') {
          if (!options.accessPolicy?.wasGranted(input.block.cardSource)) {
            throw new Error(`DYNAMIC_CARD_NOT_SEARCHED: ${input.block.cardSource}`);
          }
          const resolved = options.accessPolicy.resolve(input.block.cardSource);
          if (!resolved.valid || resolved.kind !== 'card' || resolved.path === null) {
            throw new Error(`DYNAMIC_CARD_INVALID: ${input.block.cardSource}`);
          }
          cardPath = resolved.path;
        }
        const receipt = applyClassroomTransition(root, ownerPath, {
          action: 'insert',
          after: input.after,
          block,
          cardPath,
          reason: input.reason,
          source: input.source,
        });
        return response(input.action, {
          ok: true,
          action: input.action,
          factId: receipt.blockId,
          cardAlias: receipt.cardAlias,
        }, receipt.blockId);
      }

      if (input.action === 'route') {
        if (!input.blockId || !input.routeAction || !input.reason || !input.source) {
          throw new Error('ROUTE_FIELDS_REQUIRED');
        }
        applyClassroomTransition(root, ownerPath, {
          action: 'route',
          routeAction: input.routeAction,
          blockId: input.blockId,
          reason: input.reason,
          source: input.source,
          ...(input.before ? { before: input.before } : {}),
          ...(typeof input.after === 'string' ? { after: input.after } : {}),
        });
      } else {
        if (!input.blockId) throw new Error('BLOCK_ID_REQUIRED');
        applyClassroomTransition(root, ownerPath, {
          action: input.action,
          blockId: input.blockId,
        });
      }
      return response(input.action, { ok: true, action: input.action });
    },
  });
}
