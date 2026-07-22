import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  appendRouteChange,
  setBlockStatus,
  setFrontmatterField,
} from '../study/write-workspace';

const action = Type.Union([
  Type.Literal('activate'),
  Type.Literal('complete'),
  Type.Literal('skip'),
  Type.Literal('route'),
  Type.Literal('pause'),
]);

export function createClassroomUpdateTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'classroom_update',
    label: '推进课堂节点',
    description: 'Update the current Lesson block, route, or pause state.',
    parameters: Type.Object({
      action,
      blockId: Type.Optional(Type.String()),
      routeAction: Type.Optional(Type.Union([
        Type.Literal('insert'),
        Type.Literal('skip'),
        Type.Literal('move'),
        Type.Literal('repeat'),
      ])),
      before: Type.Optional(Type.String()),
      after: Type.Optional(Type.String()),
      reason: Type.Optional(Type.String()),
      source: Type.Optional(Type.String()),
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
