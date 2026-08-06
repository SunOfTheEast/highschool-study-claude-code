import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readCourseTree,
  readLesson,
  readPlan,
  readRoadmap,
  StudyDocumentError,
} from '../../src/study/markdown';
import { readKnowledge } from '../../src/study/knowledge';
import { readWorkspace } from '../../src/study/workspace';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m0-domain-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

function arrangeTwoPlanDirectories(root: string): void {
  const firstDirectory = join(root, 'plans/plan-001');
  const firstPlanPath = 'plans/plan-001/PLAN.md';
  const firstLessonPath = 'plans/plan-001/lessons/lesson-001.md';
  writeFileSync(
    join(root, 'ROADMAP.md'),
    readFileSync(join(root, 'ROADMAP.md'), 'utf8')
      .replace(
        '## Current Position',
        '- [plan-002 | 主动换路](plans/plan-002/PLAN.md)\n'
        + '  - After: plan-001\n'
        + '  - Depends on: plan-001\n\n'
        + '## Current Position',
      ),
  );
  const firstPlan = readFileSync(join(firstDirectory, 'PLAN.md'), 'utf8');
  const firstLesson = readFileSync(join(root, firstLessonPath), 'utf8');

  const secondDirectory = join(root, 'plans/plan-002');
  mkdirSync(join(secondDirectory, 'lessons'), { recursive: true });
  writeFileSync(
    join(secondDirectory, 'PLAN.md'),
    firstPlan
      .replaceAll('plan-001', 'plan-002')
      .replaceAll('plans/plan-001', 'plans/plan-002')
      .replace('恒成立问题选路', '主动换路'),
  );
  writeFileSync(
    join(secondDirectory, 'lessons/lesson-001.md'),
    firstLesson
      .replace('parent_id: plan-001', 'parent_id: plan-002')
      .replaceAll('plans/plan-001', 'plans/plan-002')
      .replace('真实停点问诊', '复杂目标改写'),
  );
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('reads canonical Roadmap, Plan, Lesson and block-local classroom facts', () => {
  const root = copyFixture();
  const roadmap = readRoadmap(root);
  const plan = readPlan(root, 'plans/plan-001/PLAN.md');
  const lesson = readLesson(root, 'plans/plan-001/lessons/lesson-001.md');
  const course = readCourseTree(root);

  expect(roadmap.plans).toEqual([{
    id: 'plan-001',
    path: 'plans/plan-001/PLAN.md',
    title: '恒成立问题选路',
    after: null,
    dependsOn: [],
  }]);
  expect(plan.lessons[0]?.id).toBe('lesson-001');
  expect(lesson.blocks.map((block) => block.id)).toEqual(['block-001', 'block-002']);
  expect(lesson.blocks[0]?.classroomLog).toEqual([
    '10:03 学生：参数同时出现在指数和一次项里时，我不知道先分离参数还是直接求导。',
    '10:04 Tutor：请学生举出最近一次真正卡住的位置。',
  ]);
  expect(lesson.blocks[1]).toMatchObject({
    kind: 'problem',
    status: 'active',
    dependsOn: ['block-001'],
    uses: ['cards/sample.card.yaml'],
    classroomLog: [],
  });
  expect(course.tree.children[0]?.status).toBe('active');
  expect(course.tree.children[0]?.children[0]?.status).toBe('active');
});

test('scopes repeated Lesson IDs and Session keys to their parent Plan directory', () => {
  const root = copyFixture();
  arrangeTwoPlanDirectories(root);

  const course = readCourseTree(root);
  const [first, second] = course.tree.children;

  expect(first?.path).toBe('plans/plan-001/PLAN.md');
  expect(second?.path).toBe('plans/plan-002/PLAN.md');
  expect(first?.children[0]).toMatchObject({
    id: 'lesson-001',
    path: 'plans/plan-001/lessons/lesson-001.md',
    sessionKey: 'lesson:plan-001:lesson-001',
  });
  expect(second?.children[0]).toMatchObject({
    id: 'lesson-001',
    path: 'plans/plan-002/lessons/lesson-001.md',
    sessionKey: 'lesson:plan-002:lesson-001',
  });
});

test('selects a document without compiling it into another node', () => {
  const root = copyFixture();
  const workspace = readWorkspace(root, 'plans/plan-001/lessons/lesson-001.md');

  expect(workspace.selected?.kind).toBe('lesson');
  expect(workspace.selected?.path).toBe('plans/plan-001/lessons/lesson-001.md');
  expect(workspace.roadmap.raw).not.toContain('10:03 学生');
});

test('reads static method, card and material assets without personal evidence', () => {
  const root = copyFixture();
  const knowledge = readKnowledge(root);

  expect(knowledge.methods).toEqual([
    {
      id: 'derivative-methods',
      name: '导数方法体系',
      parentId: null,
      children: ['parameter', 'isomorphic'],
    },
    {
      id: 'parameter',
      name: '参变量分离',
      parentId: 'derivative-methods',
      children: [],
    },
    {
      id: 'isomorphic',
      name: '同构变形与换元法',
      parentId: 'derivative-methods',
      children: [],
    },
  ]);
  expect(knowledge.cards[0]).toMatchObject({
    path: 'cards/sample.card.yaml',
    id: 'sample-card',
    primaryMethod: '参变量分离',
    supportingMethods: ['同构变形与换元法'],
  });
  expect(knowledge.materials[0]?.path).toBe('materials/note.md');
  expect(JSON.stringify(knowledge)).not.toMatch(/trace|evidence|mastery|bkt/i);
});

test('reads child status only from child frontmatter', () => {
  const root = copyFixture();
  const lessonPath = join(root, 'plans/plan-001/lessons/lesson-001.md');
  const source = readFileSync(lessonPath, 'utf8');
  writeFileSync(lessonPath, source.replace('status: active', 'status: closed'));

  const course = readCourseTree(root);
  expect(course.tree.children[0]?.children[0]?.status).toBe('closed');
  expect(readPlan(root, 'plans/plan-001/PLAN.md').raw).not.toContain('closed');
});

test('allows a Roadmap or Plan to begin without materialized children', () => {
  const root = copyFixture();
  const roadmapPath = join(root, 'ROADMAP.md');
  const planPath = join(root, 'plans/plan-001/PLAN.md');
  writeFileSync(
    roadmapPath,
    readFileSync(roadmapPath, 'utf8').replace(
      /## Plan Tree\n\n[\s\S]*?\n## Current Position/,
      '## Plan Tree\n\n## Current Position',
    ),
  );
  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace(
      /## Lesson Tree\n\n[\s\S]*?\n## Current Position/,
      '## Lesson Tree\n\n## Current Position',
    ),
  );

  expect(readRoadmap(root).plans).toEqual([]);
  expect(readPlan(root, 'plans/plan-001/PLAN.md').lessons).toEqual([]);
});

test('reports the source file and reason for malformed or legacy documents', () => {
  const cases = [
    ['missing section', (source: string) => source.replace('## Lesson Goal', '## Goal')],
    ['invalid status', (source: string) => source.replace('status: active', 'status: paused')],
    ['unsupported section', (source: string) => `${source}\n## Retired Section\n\nOld summary.\n`],
  ] as const;

  for (const [label, mutate] of cases) {
    const root = copyFixture();
    const relative = 'plans/plan-001/lessons/lesson-001.md';
    const path = join(root, relative);
    writeFileSync(path, mutate(readFileSync(path, 'utf8')));
    try {
      readLesson(root, relative);
      throw new Error(`expected ${label} to fail`);
    } catch (error) {
      expect(error).toBeInstanceOf(StudyDocumentError);
      expect((error as StudyDocumentError).path).toBe(relative);
      expect((error as StudyDocumentError).reason.length).toBeGreaterThan(3);
    }
  }
});

test('rejects path escape, duplicate tree ids and mismatched child identity', () => {
  const escaped = copyFixture();
  expect(() => readPlan(escaped, '../outside.md')).toThrow(StudyDocumentError);

  const duplicated = copyFixture();
  const roadmapPath = join(duplicated, 'ROADMAP.md');
  const roadmap = readFileSync(roadmapPath, 'utf8');
  writeFileSync(
    roadmapPath,
    roadmap.replace(
      '## Current Position',
      '- [plan-001 | Duplicate](plans/plan-001/PLAN.md)\n  - After:\n  - Depends on:\n\n## Current Position',
    ),
  );
  expect(() => readRoadmap(duplicated)).toThrow(StudyDocumentError);

  const mismatch = copyFixture();
  const planPath = join(mismatch, 'plans/plan-001/PLAN.md');
  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace('id: plan-001', 'id: wrong-plan'),
  );
  expect(() => readCourseTree(mismatch)).toThrow(StudyDocumentError);
});
