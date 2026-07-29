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
import { readPlanWorkspace } from '../../src/study/read-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

test('builds student-safe Coach context without deleting raw Plan facts', () => {
  const root = mkdtempSync(join(tmpdir(), 'study-coach-safe-context-'));
  try {
    cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
    const path = join(root, 'plans/domain-integrity.md');
    writeFileSync(
      path,
      readFileSync(path, 'utf8')
        .replace(
          '- [mst_p0032_ex22]',
          '- LEAK_NEXT_CANDIDATE [mst_p0032_ex22]',
        )
        .replace(
          '两节课显示定义域意识',
          'LEAK_ACTIVE_SUMMARY 两节课显示定义域意识',
        ),
    );

    const context = readCoachContext(root, 'domain-integrity');
    expect(context.plan).toMatchObject({
      currentPosition: expect.stringContaining('阶段 `1a` 已通过'),
      progress: {
        closedLessons: 2,
        registeredLessons: 3,
        state: 'prepared',
      },
      nextLesson: {
        publicTitle: '下一节课堂',
        publicPurpose: '完成一次独立能力检验',
        blockCount: 5,
        sourceNumbers: expect.arrayContaining(['mst_p0032_ex22']),
      },
      learningReview: null,
    });
    expect(JSON.stringify(context)).not.toContain('LEAK_NEXT_CANDIDATE');
    expect(JSON.stringify(context)).not.toContain('LEAK_ACTIVE_SUMMARY');
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

    const raw = readPlanWorkspace(root, 'domain-integrity').plan;
    expect(raw.nextLessonCandidate).toContain('LEAK_NEXT_CANDIDATE');
    expect(raw.planSummary).toContain('LEAK_ACTIVE_SUMMARY');
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
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

    expect(readCoachContext(root, 'domain-integrity').plan.learningReview).toEqual(review);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
