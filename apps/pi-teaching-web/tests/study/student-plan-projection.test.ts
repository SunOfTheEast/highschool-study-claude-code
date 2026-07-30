import { afterEach, expect, test } from 'bun:test';
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
import {
  readStudentPlanProjection,
} from '../../src/study/student-plan-projection';
import { renderLearningReview } from '../../src/study/learning-review';
import { setFrontmatterField } from '../../src/study/write-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'student-plan-projection-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

function replaceSection(
  root: string,
  path: string,
  heading: string,
  value: string,
): void {
  const absolute = join(root, path);
  const source = readFileSync(absolute, 'utf8');
  const pattern = new RegExp(
    `(^## ${heading.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\\\$&')}\\s*$\\n)([\\s\\S]*?)(?=^## |$(?![\\s\\S]))`,
    'm',
  );
  writeFileSync(absolute, source.replace(pattern, `$1\n${value.trim()}\n\n`));
}

function setPrimaryTemplate(root: string, template: string): void {
  const lessonPath = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8').replace(
      /Primary template: `[^`]+`/,
      `Primary template: \`${template}\``,
    ),
  );
}

test('projects a prepared assessment from safe structural facts only', () => {
  const root = fixture();
  replaceSection(
    root,
    'plans/domain-integrity.md',
    'Next Lesson Candidate',
    'LEAK_NEXT_CANDIDATE：目标函数、方法和决定性变形。',
  );
  replaceSection(
    root,
    'plans/domain-integrity.md',
    'Plan Summary',
    'LEAK_ACTIVE_SUMMARY：完整解答路线。',
  );
  const lessonPath = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8')
      .replace('## Sources', '## Sources\n\nLEAK_SOURCES\n\n## Ignored Sources')
      .replace('Do not name the target method', 'LEAK_TEACHER_CONTROL. Do not name the target method')
      .replace('请独立完成题卡 `Q-DOMAIN-EX22`', 'LEAK_PENDING_STUDENT_VIEW 请独立完成题卡 `Q-DOMAIN-EX22`'),
  );

  const projection = readStudentPlanProjection(root, 'domain-integrity');

  expect(projection).toMatchObject({
    progress: {
      closedLessons: 2,
      registeredLessons: 3,
      state: 'prepared',
    },
    currentPosition: expect.stringContaining('阶段 `1a` 已通过'),
    nextLesson: {
      lessonId: 'lesson-003',
      status: 'prepared',
      publicTitle: '下一节课堂',
      publicPurpose: '完成一次独立能力检验',
      blockCount: 5,
      blockKinds: ['dialogue', 'problem', 'reflection'],
      sourceNumbers: [],
    },
    learningReview: null,
  });
  const serialized = JSON.stringify(projection);
  for (const marker of [
    'LEAK_NEXT_CANDIDATE',
    'LEAK_ACTIVE_SUMMARY',
    'LEAK_SOURCES',
    'LEAK_TEACHER_CONTROL',
    'LEAK_PENDING_STUDENT_VIEW',
  ]) {
    expect(serialized).not.toContain(marker);
  }
});

test('uses template-aware public purposes without filtering free text', () => {
  const root = fixture();
  const lessonPath = join(root, 'lessons/lesson-003.md');
  const original = readFileSync(lessonPath, 'utf8');
  writeFileSync(
    lessonPath,
    original
      .replace('Primary template: `assessment`', 'Primary template: `diagnostic`')
      .replace(
        /面对含参数对数和开区间边界的恒成立不等式，[^\n]+/,
        'PRIVATE_DIAGNOSTIC_TARGET',
      ),
  );
  expect(readStudentPlanProjection(root, 'domain-integrity').nextLesson)
    .toMatchObject({
      publicPurpose: '确认当前真实起点',
      sourceNumbers: [],
    });

  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8')
      .replace('Primary template: `diagnostic`', 'Primary template: `deliberate-practice`')
      .replace('PRIVATE_DIAGNOSTIC_TARGET', '练习公开的路线比较能力。'),
  );
  expect(
    readStudentPlanProjection(root, 'domain-integrity').nextLesson?.publicPurpose,
  ).toBe('练习公开的路线比较能力。');
});

test('omits a missing card content ID instead of guessing from its path', () => {
  const root = fixture();
  setPrimaryTemplate(root, 'deliberate-practice');
  const cardPath = join(
    root,
    'cards/derivative/mst_p0032_ex22.card.yaml',
  );
  writeFileSync(
    cardPath,
    readFileSync(cardPath, 'utf8').replace(/^content_item_id:.*\n/m, ''),
  );

  const projection = readStudentPlanProjection(root, 'domain-integrity');

  expect(projection.nextLesson?.sourceNumbers).toEqual([
    'mst_p0017_ex05',
    'mst_p0030_ex16',
  ]);
  expect(JSON.stringify(projection)).not.toContain('mst_p0032_ex22');
});

test('accepts source numbers only from authentic problem-card metadata', () => {
  const root = fixture();
  setPrimaryTemplate(root, 'deliberate-practice');
  const cardPath = join(
    root,
    'cards/derivative/mst_p0032_ex22.card.yaml',
  );
  writeFileSync(
    cardPath,
    readFileSync(cardPath, 'utf8')
      .replace(
        'schema: highschool-study.problem-card.v1',
        'schema: unrelated.material.v1',
      )
      .replace(
        'content_item_id: mst_p0032_ex22',
        'content_item_id: LEAK_NON_CARD_ID',
      ),
  );

  const projection = readStudentPlanProjection(root, 'domain-integrity');

  expect(projection.nextLesson?.sourceNumbers).not.toContain('LEAK_NON_CARD_ID');
});

test('projects discussing, active and paused states from real Lesson status', () => {
  const root = fixture();
  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'abandoned');
  expect(readStudentPlanProjection(root, 'domain-integrity')).toMatchObject({
    progress: { state: 'discussing' },
    nextLesson: null,
  });

  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'active');
  expect(readStudentPlanProjection(root, 'domain-integrity')).toMatchObject({
    progress: { state: 'active' },
    nextLesson: {
      status: 'active',
      publicTitle: 'Lesson 003：阶段 1b — 定义域连续性与跨结构迁移核验',
    },
  });

  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'paused');
  expect(readStudentPlanProjection(root, 'domain-integrity')).toMatchObject({
    progress: { state: 'paused' },
    nextLesson: {
      status: 'paused',
      publicTitle: 'Lesson 003：阶段 1b — 定义域连续性与跨结构迁移核验',
    },
  });
});

test('projects a completed Learning Review instead of active Plan prose', () => {
  const root = fixture();
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
  setFrontmatterField(root, 'plans/domain-integrity.md', 'status', 'completed');
  replaceSection(
    root,
    'plans/domain-integrity.md',
    'Plan Summary',
    renderLearningReview(review),
  );

  expect(readStudentPlanProjection(root, 'domain-integrity')).toMatchObject({
    progress: { state: 'completed' },
    nextLesson: null,
    learningReview: review,
  });
});
