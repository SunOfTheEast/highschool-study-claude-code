import { expect, test } from 'bun:test';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { readKnowledge } from '../../src/study/knowledge';
import { readCourseTree, readLesson, readPlan, readRoadmap } from '../../src/study/markdown';

const root = join(import.meta.dir, '../../../../examples/derivative-m0/learning-set');

test('ships a clean M0 derivative learning set with reusable static assets', () => {
  const roadmap = readRoadmap(root);
  const plan = readPlan(root, 'plans/plan-001.md');
  const lesson = readLesson(root, 'lessons/lesson-001.md');
  const course = readCourseTree(root);
  const knowledge = readKnowledge(root);

  expect(roadmap.plans).toHaveLength(1);
  expect(plan.status).toBe('prepared');
  expect(lesson.status).toBe('prepared');
  expect(lesson.blocks.every((block) => block.status === 'pending')).toBe(true);
  expect(course.tree.children[0]?.children[0]?.id).toBe('lesson-001');
  expect(knowledge.cards).toHaveLength(519);
  expect(knowledge.methods.length).toBeGreaterThan(10);
  expect(knowledge.materials.length).toBeGreaterThan(0);

  expect(existsSync(join(root, 'memory'))).toBe(false);
  expect(existsSync(join(root, 'traces'))).toBe(false);
});
