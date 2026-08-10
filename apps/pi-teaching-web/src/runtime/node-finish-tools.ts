import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { readLesson, readPlan, StudyDocumentError } from '../study/markdown';
import { transitionNode } from './node-lifecycle';

type FinishableNodeKind = 'plan' | 'lesson';

export function createNodeFinishTool(
  root: string,
  kind: FinishableNodeKind,
  path: string,
) {
  const terminal = kind === 'plan' ? 'completed' : 'closed';
  return defineTool({
    name: kind === 'plan' ? 'finish_plan' : 'finish_lesson',
    label: kind === 'plan' ? '完成当前阶段' : '结束当前课堂',
    description: kind === 'plan'
      ? 'After the current Plan closure is semantically complete, finish this runtime-bound Plan.'
      : 'After the current Lesson reflection and consolidation are complete, finish this runtime-bound Lesson.',
    executionMode: 'sequential',
    parameters: Type.Object({}, { additionalProperties: false }),
    execute: async () => {
      const document = kind === 'plan' ? readPlan(root, path) : readLesson(root, path);
      if (document.status !== 'active' && document.status !== terminal) {
        throw new StudyDocumentError(
          path,
          `${kind} finish expected active or ${terminal}, found ${document.status}`,
        );
      }
      if (document.status === 'active') {
        transitionNode(root, path, 'active', terminal);
      }
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: true, status: terminal }),
        }],
        details: { kind: 'node-finish', nodeKind: kind, status: terminal },
      };
    },
  });
}
