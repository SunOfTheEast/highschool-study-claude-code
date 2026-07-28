import { expect, test } from 'bun:test';
import { readCoachContext } from '../../src/study/coach-context';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

test('builds Coach context from Plan review sections and closed Lesson summaries', () => {
  const context = readCoachContext(domainIntegrityFixtureRoot, 'domain-integrity');

  expect(context.currentPosition).toContain('阶段 `1a` 已通过');
  expect(context.nextLessonCandidate).toContain('mst_p0032_ex22');
  expect(context.planSummary).toContain('定义域意识');
  expect(context.plannerAttention).toContain('Method Signals');
  expect(context.priorLessons.map((lesson) => lesson.lessonId)).toEqual([
    'lesson-001',
    'lesson-002',
  ]);
  expect(context.priorLessons[0]).toMatchObject({
    title: 'Lesson 001：冷启动诊断',
    source: 'lessons/lesson-001.md#lesson-summary',
  });
  expect(context.priorLessons.every((lesson) => lesson.summary.length > 0)).toBe(true);
});
