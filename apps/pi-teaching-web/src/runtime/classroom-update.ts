import { defineTool } from '@earendil-works/pi-coding-agent';
import { readMarkdownFile } from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';
import {
  applyClassroomTransition,
  setFrontmatterField,
} from '../study/write-workspace';
import { lessonBlockIdSchema } from './lesson-tool-contracts';

export function createClassroomUpdateTool(root: string, ownerPath: string) {
  const blockId = lessonBlockIdSchema(root, ownerPath);
  const parameters = Type.Object({
    action: Type.Union([
      Type.Literal('activate'),
      Type.Literal('complete'),
      Type.Literal('skip'),
      Type.Literal('route'),
      Type.Literal('pause'),
    ], {
      description: 'activate opens one Block; complete or skip resolves the active Block; route records an adaptive decision and its deterministic Block state; pause marks the Lesson paused.',
    }),
    blockId: Type.Optional(blockId),
    routeAction: Type.Optional(Type.Union([
      Type.Literal('insert'),
      Type.Literal('skip'),
      Type.Literal('move'),
      Type.Literal('repeat'),
    ], {
      description: 'Adaptive route action; present only when action is route.',
    })),
    before: Type.Optional(blockId),
    after: Type.Optional(blockId),
    reason: Type.Optional(Type.String({
      minLength: 1,
      description: 'Student-facing instructional reason for a route change.',
    })),
    source: Type.Optional(Type.String({
      minLength: 1,
      description: 'Evidence or student request that prompted the route change.',
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
            { required: ['reason'] },
            { required: ['source'] },
          ],
        },
      },
      {
        properties: { action: { const: 'route' } },
        required: ['blockId', 'routeAction', 'reason', 'source'],
        not: { required: ['before', 'after'] },
      },
    ],
  });

  return defineTool({
    name: 'classroom_update',
    label: '推进课堂节点',
    description: 'Persist one classroom navigation change in the current Tutor Session-owned Lesson. Use ordinary Block actions for traversal, route for an explicit adaptive route decision, and pause for a student-requested pause. The runtime owns the Lesson path and returns the applied action.',
    parameters,
    execute: async (_id, input) => {
      if (input.action === 'pause') {
        const lesson = readMarkdownFile(root, ownerPath);
        if (lesson.frontmatter.status !== 'active') {
          throw new Error(`CLASSROOM_LESSON_NOT_ACTIVE: ${lesson.frontmatter.status}`);
        }
        setFrontmatterField(root, ownerPath, 'status', 'paused');
      } else if (input.action === 'route') {
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
          ...(input.after ? { after: input.after } : {}),
        });
      } else {
        if (!input.blockId) throw new Error('BLOCK_ID_REQUIRED');
        applyClassroomTransition(root, ownerPath, {
          action: input.action,
          blockId: input.blockId,
        });
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, action: input.action }) }],
        details: {
          kind: 'classroom-update',
          lessonPath: ownerPath,
          action: input.action,
        },
      };
    },
  });
}
