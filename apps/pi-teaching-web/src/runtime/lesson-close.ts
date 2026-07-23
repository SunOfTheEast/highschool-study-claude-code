import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { closeLesson } from '../study/write-workspace';

export function createLessonCloseTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'lesson_close',
    label: '结束本节课',
    description: 'Close the current Lesson after student confirmation. Keep the reflection Block active and do not complete it first; this tool persists the final reflection and summary, completes that Block, and closes the Lesson atomically.',
    parameters: Type.Object({
      reflection: Type.String({ minLength: 1 }),
      summary: Type.String({ minLength: 1 }),
    }),
    execute: async (_id, input) => {
      closeLesson(root, ownerPath, input);
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify({ ok: true, ownerPath, status: 'closed' }),
        }],
        details: { kind: 'lesson-close', lessonPath: ownerPath },
      };
    },
  });
}
