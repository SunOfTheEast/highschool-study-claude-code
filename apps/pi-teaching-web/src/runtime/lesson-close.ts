import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import { closeLesson } from '../study/write-workspace';

export function createLessonCloseTool(root: string, ownerPath: string) {
  return defineTool({
    name: 'lesson_close',
    label: '结束本节课',
    description: 'Atomically finish the current Tutor Session-owned Lesson after the student has explicitly chosen to close it. Write one student-safe close-time summary and closed status without completing, skipping, or otherwise changing any classroom Block.',
    parameters: Type.Object({
      summary: Type.String({
        minLength: 1,
        description: 'Body content for the existing Lesson Summary section, without a heading. Use only student-visible content, active Trace, direct sources, and the actual stopping point.',
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
