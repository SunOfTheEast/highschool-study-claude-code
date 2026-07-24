import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { closeLesson } from '../study/write-workspace';

export function createLessonCloseTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'lesson_close',
    label: '结束本节课',
    description: 'Atomically finish the current Tutor Session-owned Lesson after the student has explicitly chosen to close it. Call with a reflection and summary derived from existing active evidence; the tool completes the active reflection Block and closes the Lesson, then returns closed status.',
    parameters: Type.Object({
      reflection: Type.String({
        minLength: 1,
        description: 'Source-linked account of what the Lesson established, what remains uncertain, and what support was actually used.',
      }),
      summary: Type.String({
        minLength: 1,
        description: 'Compact Lesson handoff for the Coach, grounded in active Trace and direct sources.',
      }),
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
