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
import { readLessonHandout } from '../../src/study/lesson-handout';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-handout-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('projects selected Student Views in requested order and nothing private', () => {
  const handout = readLessonHandout(
    copyFixture(),
    'plan-001',
    'lesson-001',
    ['block-002', 'block-001'],
  );

  expect(handout).toEqual({
    kind: 'lesson-handout',
    planId: 'plan-001',
    lessonId: 'lesson-001',
    title: 'Lesson 001：真实停点问诊',
    lessonGoal: '找出学生面对含参数恒成立问题时真正犹豫的结构与停点。',
    blocks: [
      {
        id: 'block-002',
        title: '入口练习',
        kind: 'problem',
        studentView: '先观察这道题的参数位置，说说你准备从哪里切入。',
      },
      {
        id: 'block-001',
        title: '具体问诊',
        kind: 'dialogue',
        studentView: '最近遇到哪一种恒成立问题时，你最容易不知道从哪里开始？',
      },
    ],
  });
  const serialized = JSON.stringify(handout);
  for (const privateValue of [
    'teacherControl',
    'classroomLog',
    '追问具体结构',
    '10:03 学生',
    'cards/sample.card.yaml',
    'sessionId',
    'raw',
  ]) {
    expect(serialized).not.toContain(privateValue);
  }
});

test('rejects empty, duplicate, or unknown Block selections', () => {
  const root = copyFixture();
  expect(() => readLessonHandout(root, 'plan-001', 'lesson-001', []))
    .toThrow('handout requires at least one Block');
  expect(() => readLessonHandout(
    root,
    'plan-001',
    'lesson-001',
    ['block-001', 'block-001'],
  )).toThrow('duplicate handout Block block-001');
  expect(() => readLessonHandout(root, 'plan-001', 'lesson-001', ['block-404']))
    .toThrow('handout Block not found: block-404');
});

test('only resolves a Lesson linked by the exact Roadmap and Plan tree', () => {
  const root = copyFixture();
  const sourcePath = join(root, 'plans/plan-001/lessons/lesson-001.md');
  const orphanPath = join(root, 'plans/plan-001/lessons/lesson-orphan.md');
  writeFileSync(
    orphanPath,
    readFileSync(sourcePath, 'utf8').replaceAll('lesson-001', 'lesson-orphan'),
  );

  expect(() => readLessonHandout(
    root,
    'plan-001',
    'lesson-orphan',
    ['block-001'],
  )).toThrow('Lesson is not linked by the current Plan');
  expect(() => readLessonHandout(
    root,
    'plan-404',
    'lesson-001',
    ['block-001'],
  )).toThrow('Plan is not linked by ROADMAP.md');

  writeFileSync(
    sourcePath,
    readFileSync(sourcePath, 'utf8').replace('parent_id: plan-001', 'parent_id: plan-002'),
  );
  expect(() => readLessonHandout(
    root,
    'plan-001',
    'lesson-001',
    ['block-001'],
  )).toThrow('Lesson parent does not match plans/plan-001/PLAN.md');
});

test('requires prepared status only when publishing a new URL', () => {
  const root = copyFixture();
  const path = join(root, 'plans/plan-001/lessons/lesson-001.md');
  expect(() => readLessonHandout(
    root,
    'plan-001',
    'lesson-001',
    ['block-001'],
    { requirePrepared: true },
  )).toThrow('Lesson must be prepared before handout publication');

  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace('status: active', 'status: prepared'),
  );
  expect(readLessonHandout(
    root,
    'plan-001',
    'lesson-001',
    ['block-001'],
    { requirePrepared: true },
  ).blocks).toHaveLength(1);

  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace('status: prepared', 'status: closed'),
  );
  expect(readLessonHandout(root, 'plan-001', 'lesson-001', ['block-001']).blocks)
    .toHaveLength(1);
  expect(() => readLessonHandout(
    root,
    'plan-001',
    'lesson-001',
    ['block-001'],
    { requirePrepared: true },
  )).toThrow('Lesson must be prepared before handout publication');
});
