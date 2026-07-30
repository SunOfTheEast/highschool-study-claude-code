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
import { readPlanWorkspace } from '../../src/study/read-workspace';
import {
  closeLesson,
  registerPlan,
  setBlockStatus,
  setFrontmatterField,
  updatePlan,
  writePreparedLesson,
} from '../../src/study/write-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'tree-write-workspace-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  return root;
}

test('updates runtime-owned frontmatter and Block state in place', () => {
  const root = fixture();
  setFrontmatterField(
    root,
    'lessons/lesson-003.md',
    'tutor_session',
    'session-003',
  );
  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'active');
  setBlockStatus(root, 'lessons/lesson-003.md', 'block-001', 'active');

  const lesson = readPlanWorkspace(root, 'domain-integrity').lessons[2]!;
  expect(lesson).toMatchObject({
    id: 'lesson-003',
    status: 'active',
    tutorSessionId: 'session-003',
  });
  expect(lesson.blocks[0]?.status).toBe('active');
});

test('never discovers or registers an orphan file outside the parent tree', () => {
  const root = fixture();
  const source = readFileSync(
    join(root, 'lessons/lesson-003.md'),
    'utf8',
  )
    .replace('id: lesson-003', 'id: lesson-orphan')
    .replace('# Lesson 003', '# Orphan Lesson');
  writeFileSync(join(root, 'lessons/lesson-orphan.md'), source);

  expect(readPlanWorkspace(root, 'domain-integrity').lessons.map((lesson) => (
    lesson.id
  ))).toEqual(['lesson-001', 'lesson-002', 'lesson-003']);
  expect(() => writePreparedLesson(root, 'plans/domain-integrity.md', {
    lessonId: 'lesson-orphan',
    lessonPath: 'lessons/lesson-orphan.md',
    lessonTitle: 'Orphan Lesson',
    source,
  })).toThrow('LESSON_CANDIDATE_REQUIRED');
});

test('treats the parent tree as the only Plan registration authority', () => {
  const root = fixture();
  expect(registerPlan(root, 'domain-integrity')).toMatchObject({
    id: 'domain-integrity',
    path: 'plans/domain-integrity.md',
  });
  expect(() => registerPlan(root, 'missing-plan'))
    .toThrow('PLAN_CANDIDATE_REQUIRED');
});

test('closes a prepared Lesson without rewriting its parent tree', () => {
  const root = fixture();
  const planBefore = readFileSync(
    join(root, 'plans/domain-integrity.md'),
    'utf8',
  );
  closeLesson(root, 'lessons/lesson-003.md', {
    summary: '学生完成本节课并确认结束。',
  });

  expect(readPlanWorkspace(root, 'domain-integrity').lessons[2]).toMatchObject({
    id: 'lesson-003',
    status: 'closed',
  });
  expect(readFileSync(
    join(root, 'lessons/lesson-003.md'),
    'utf8',
  )).toContain('学生完成本节课并确认结束。');
  expect(readFileSync(
    join(root, 'plans/domain-integrity.md'),
    'utf8',
  )).toBe(planBefore);
});

test('updates only canonical Plan fields and derives child status on read', () => {
  const root = fixture();
  const roadmapBefore = readFileSync(join(root, 'ROADMAP.md'), 'utf8');
  updatePlan(root, 'plans/domain-integrity.md', {
    decision: 'replan',
    currentPosition: '需要重新比较下一课的教学变量。',
    nextLessonCandidate: 'LEGACY_FIELD_MUST_NOT_BE_WRITTEN',
    planSummary: '当前保留两条有效课堂记录。',
  });
  const source = readFileSync(
    join(root, 'plans/domain-integrity.md'),
    'utf8',
  );
  expect(source).toContain('需要重新比较下一课的教学变量。');
  expect(source).toContain('当前保留两条有效课堂记录。');
  expect(source).not.toContain('LEGACY_FIELD_MUST_NOT_BE_WRITTEN');
  expect(readFileSync(join(root, 'ROADMAP.md'), 'utf8')).toBe(roadmapBefore);
  expect(readPlanWorkspace(root, 'domain-integrity').plan.status).toBe('active');
});
