import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { formatLessonHandoutPath } from '../shared/handout-route';
import { readLessonHandout } from '../study/lesson-handout';
import type { NodeSessionScope } from './session-scope';
import { createPlanMemoryTools } from './memory-tools';

const nodeId = Type.String({
  pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$',
});

export function createPlanTools(root: string, scope: NodeSessionScope) {
  const exportTool = defineTool({
    name: 'artifact_export',
    label: '整理可打印讲义',
    description: 'Publish selected Student View Blocks from one prepared Lesson owned by this Plan.',
    executionMode: 'sequential',
    parameters: Type.Object({
      kind: Type.Literal('lesson-handout'),
      lessonId: nodeId,
      blockIds: Type.Array(nodeId, {
        minItems: 1,
        uniqueItems: true,
      }),
    }, { additionalProperties: false }),
    execute: async (_toolCallId, { lessonId, blockIds }) => {
      const handout = readLessonHandout(
        root,
        scope.nodeId,
        lessonId,
        blockIds,
        { requirePrepared: true },
      );
      const details = {
        kind: 'lesson-handout' as const,
        planId: scope.nodeId,
        lessonId,
        blockIds: [...blockIds],
        title: handout.title,
        url: formatLessonHandoutPath(scope.nodeId, lessonId, blockIds),
      };
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: true, title: details.title, url: details.url }),
        }],
        details,
      };
    },
  });

  return [exportTool, ...createPlanMemoryTools(root)];
}
