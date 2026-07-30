import { expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { parseHandoff } from 'highschool-study-markdown/study-domain';
import { createLessonCloseTool } from '../../src/runtime/lesson-close';
import { readPreparedLessonBlocks } from '../../src/study/validate-prepared-lesson';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

type CloseCase = {
  name: string;
  handoff?: object;
  mode: 'claims' | 'source-only';
  rejected: string[];
};

const cases: CloseCase[] = [
  {
    name: 'seals valid claims',
    handoff: {
      learnerClaims: [{
        statement: '学生能说明本课停止点。',
        scope: '本节课。',
        sources: ['session:session-lesson-003#message:message-001'],
        boundary: '尚未形成跨题稳定结论。',
        nextUse: '下一课继续核验。',
      }],
      teachingClaims: [],
      openQuestions: [],
    },
    mode: 'claims',
    rejected: [],
  },
  {
    name: 'falls back when one claim source is invalid',
    handoff: {
      learnerClaims: [{
        statement: '不应封存。',
        scope: '本节课。',
        sources: ['trace:trace-fixture-001'],
        boundary: '来源属于另一节课。',
        nextUse: '不应使用。',
      }],
      teachingClaims: [],
      openQuestions: [],
    },
    mode: 'source-only',
    rejected: ['HANDOFF_SOURCE_FORBIDDEN: trace:trace-fixture-001'],
  },
  {
    name: 'falls back when claims are omitted',
    mode: 'source-only',
    rejected: ['HANDOFF_DRAFT_MISSING'],
  },
];

for (const item of cases) {
  test(`lesson close ${item.name} without changing Block states`, async () => {
    const root = mkdtempSync(join(tmpdir(), 'study-handoff-close-'));
    try {
      cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
      const lessonPath = join(root, 'lessons/lesson-003.md');
      writeFileSync(
        lessonPath,
        readFileSync(lessonPath, 'utf8').replace('status: prepared', 'status: active'),
      );
      const beforeBlocks = readPreparedLessonBlocks(
        readFileSync(lessonPath, 'utf8'),
      );
      const close = createLessonCloseTool(root, 'lessons/lesson-003.md', {
        sessionId: 'session-lesson-003',
        sessionEntries: () => [{ id: 'message-001' }],
        now: () => new Date('2026-08-05T10:00:00.000Z'),
      });

      const result = await close.execute('close', {
        summary: '学生在当前停止点结束课程。',
        ...(item.handoff === undefined ? {} : { handoff: item.handoff }),
      } as never, undefined, undefined, {} as never);
      const payload = JSON.parse((result.content[0] as { text: string }).text);
      const source = readFileSync(lessonPath, 'utf8');

      expect(source).toContain('status: closed');
      expect(readPreparedLessonBlocks(source)).toEqual(beforeBlocks);
      expect(parseHandoff(source).mode).toBe(item.mode);
      expect(payload).toMatchObject({
        ok: true,
        ownerPath: 'lessons/lesson-003.md',
        status: 'closed',
        handoff: {
          id: 'lesson-003/handoff',
          mode: item.mode,
          rejectedIssues: item.rejected,
        },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
