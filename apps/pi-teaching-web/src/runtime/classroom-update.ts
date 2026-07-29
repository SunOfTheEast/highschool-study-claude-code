import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  appendRouteChange,
  setBlockStatus,
  setFrontmatterField,
} from '../study/write-workspace';
import { lessonBlockIdSchema } from './lesson-tool-contracts';

const action = Type.Union([
  Type.Literal('activate'),
  Type.Literal('complete'),
  Type.Literal('skip'),
  Type.Literal('route'),
  Type.Literal('pause'),
], {
  description: 'activate opens one Block; complete or skip resolves one Block; route records an insertion, skip, move, or repeat decision; pause marks the Lesson paused.',
});

export function createClassroomUpdateTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'classroom_update',
    label: '推进课堂节点',
    description: 'Persist one classroom navigation change in the current Tutor Session-owned Lesson. Use ordinary Block actions for traversal, route for an explicit adaptive route decision, and pause for a student-requested pause. The runtime owns the Lesson path and returns the applied action.',
    parameters: Type.Object({
      action,
      blockId: Type.Optional(lessonBlockIdSchema(root, ownerPath)),
      routeAction: Type.Optional(Type.Union([
        Type.Literal('insert'),
        Type.Literal('skip'),
        Type.Literal('move'),
        Type.Literal('repeat'),
      ], {
        description: 'Kind of adaptive route change; required only when action is route.',
      })),
      before: Type.Optional(Type.String({
        description: 'Optional Block ID before which the route target is placed.',
      })),
      after: Type.Optional(Type.String({
        description: 'Optional Block ID after which the route target is placed.',
      })),
      reason: Type.Optional(Type.String({
        description: 'Student-facing instructional reason for a route change; required when action is route.',
      })),
      source: Type.Optional(Type.String({
        description: 'Evidence or student request that prompted the route change; required when action is route.',
      })),
    }),
    execute: async (_id, input) => {
      if (input.action === 'pause') {
        setFrontmatterField(root, ownerPath, 'status', 'paused');
      } else if (input.action === 'route') {
        if (!input.blockId || !input.routeAction || !input.reason || !input.source) {
          throw new Error('ROUTE_FIELDS_REQUIRED');
        }
        appendRouteChange(root, ownerPath, {
          action: input.routeAction,
          blockId: input.blockId,
          reason: input.reason,
          source: input.source,
          ...(input.before ? { before: input.before } : {}),
          ...(input.after ? { after: input.after } : {}),
        });
      } else {
        if (!input.blockId) throw new Error('BLOCK_ID_REQUIRED');
        const status = input.action === 'activate'
          ? 'active'
          : input.action === 'complete'
            ? 'completed'
            : 'skipped';
        setBlockStatus(root, ownerPath, input.blockId, status);
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
