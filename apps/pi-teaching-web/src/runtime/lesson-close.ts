import { defineTool } from '@earendil-works/pi-coding-agent';
import { Type } from 'typebox';
import {
  createCurrentSessionEvidenceReader,
  handoffDraftSchema,
  scopeForNode,
  sealLessonHandoff,
} from '../study/handoff-seal';
import { closeLesson } from '../study/write-workspace';

export type LessonCloseOptions = {
  sessionId?: string | null;
  sessionEntries?: () => readonly unknown[];
  now?: () => Date;
};

export function createLessonCloseTool(
  root: string,
  ownerPath: string,
  options: LessonCloseOptions = {},
) {
  return defineTool({
    name: 'lesson_close',
    label: '结束本节课',
    description: 'Atomically finish the current Tutor Session-owned Lesson after the student has explicitly chosen to close it. Write one student-safe close-time summary and closed status without completing, skipping, or otherwise changing any classroom Block.',
    parameters: Type.Object({
      summary: Type.String({
        minLength: 1,
        description: 'Body content for the existing Lesson Summary section. Do not include any level-two (`##`) heading; use level-three (`###`) subheadings or plain paragraphs and lists. Use only student-visible content, active Trace, direct sources, and the actual stopping point.',
      }),
      handoff: Type.Optional(handoffDraftSchema),
    }, { additionalProperties: false }),
    execute: async (_id, input) => {
      const sessionId = options.sessionId;
      if (!sessionId) throw new Error('LESSON_SESSION_REQUIRED');
      const scope = scopeForNode(root, ownerPath);
      const sealed = sealLessonHandoff(root, ownerPath, input.handoff, {
        sessionId,
        sessions: createCurrentSessionEvidenceReader(
          scope,
          sessionId,
          options.sessionEntries ?? (() => []),
        ),
        now: options.now ?? (() => new Date()),
      });
      closeLesson(root, ownerPath, {
        summary: input.summary,
        handoffSource: sealed.source,
      });
      const value = {
        ok: true as const,
        ownerPath,
        status: 'closed' as const,
        handoff: {
          id: sealed.id,
          mode: sealed.mode,
          rejectedIssues: sealed.rejectedIssues,
        },
      };
      return {
        content: [{
          type: 'text' as const,
          text: JSON.stringify(value),
        }],
        details: { kind: 'lesson-close', lessonPath: ownerPath, value },
      };
    },
  });
}
