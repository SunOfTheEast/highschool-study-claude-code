import { expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import type { LearningReview } from '../../src/shared/contracts';
import { readCoachContext } from '../../src/study/coach-context';
import { renderLearningReview } from '../../src/study/learning-review';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

test('builds Coach context from Plan review sections and closed Lesson summaries', () => {
  const context = readCoachContext(domainIntegrityFixtureRoot, 'domain-integrity');

  expect(context.currentPosition).toContain('阶段 `1a` 已通过');
  expect(context.nextLessonCandidate).toContain('mst_p0032_ex22');
  expect(context.planSummary).toContain('定义域意识');
  expect(context.learningReview).toBeNull();
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

test('forwards the structured Learning Review into Coach context', () => {
  const root = mkdtempSync(join(tmpdir(), 'study-coach-review-'));
  const review: LearningReview = {
    conclusion: '能独立比较路线。',
    boundary: '只在当前题型中验证。',
    nextStep: '检查迁移。',
    keyEvidence: [{
      claim: '无提示完成评估。',
      source: 'lessons/lesson-003.md#trace-event-001',
    }],
    supportingEvidence: [],
    openQuestions: [],
  };
  try {
    cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
    const path = join(root, 'plans/domain-integrity.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8').replace(
        /(^## Plan Summary\s*$\n)([\s\S]*?)(?=^## |$(?![\s\S]))/m,
        `$1\n${renderLearningReview(review)}`,
      ),
    );

    expect(readCoachContext(root, 'domain-integrity').learningReview).toEqual(review);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
