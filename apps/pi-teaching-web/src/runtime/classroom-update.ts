import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  appendRouteChange,
  closeLesson,
  setBlockStatus,
  setFrontmatterField,
} from '../study/write-workspace';

const action = Type.Union([
  Type.Literal('activate'),
  Type.Literal('complete'),
  Type.Literal('skip'),
  Type.Literal('route'),
  Type.Literal('pause'),
  Type.Literal('close'),
]);

export function createClassroomUpdateTool(root: string) {
  return defineTool({
    name: 'classroom_update',
    label: '推进课堂节点',
    description: 'Update the current Lesson block, route, pause state, or student-confirmed closure.',
    parameters: Type.Object({
      action,
      lessonPath: Type.String(),
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
      reflection: Type.Optional(Type.String()),
      summary: Type.Optional(Type.String()),
    }),
    execute: async (_id, input) => {
      if (input.action === 'pause') {
        setFrontmatterField(root, input.lessonPath, 'status', 'paused');
      } else if (input.action === 'close') {
        if (!input.reflection || !input.summary) {
          throw new Error('CLOSE_REQUIRES_REFLECTION_AND_SUMMARY');
        }
        closeLesson(root, input.lessonPath, {
          reflection: input.reflection,
          summary: input.summary,
        });
      } else if (input.action === 'route') {
        if (!input.blockId || !input.routeAction || !input.reason || !input.source) {
          throw new Error('ROUTE_FIELDS_REQUIRED');
        }
        appendRouteChange(root, input.lessonPath, {
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
        setBlockStatus(root, input.lessonPath, input.blockId, status);
      }
      return {
        content: [{ type: 'text' as const, text: JSON.stringify({ ok: true, action: input.action }) }],
        details: {
          kind: 'classroom-update',
          lessonPath: input.lessonPath,
          action: input.action,
        },
      };
    },
  });
}
