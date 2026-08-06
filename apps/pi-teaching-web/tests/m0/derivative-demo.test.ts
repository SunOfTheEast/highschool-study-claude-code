import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readKnowledge } from '../../src/study/knowledge';
import { readCourseTree, readRoadmap } from '../../src/study/markdown';

const root = join(import.meta.dir, '../../../../examples/derivative-m0/learning-set');

test('ships a clean M1-ready derivative learning set with reusable static assets', () => {
  const roadmap = readRoadmap(root);
  const course = readCourseTree(root);
  const knowledge = readKnowledge(root);

  expect(roadmap.plans).toEqual([]);
  expect(course.tree.children).toEqual([]);
  expect(readdirSync(join(root, 'plans')).filter((name) => name.endsWith('.md'))).toEqual([]);
  expect(readdirSync(join(root, 'lessons')).filter((name) => name.endsWith('.md'))).toEqual([]);
  expect(knowledge.cards).toHaveLength(519);
  expect(knowledge.methods.length).toBeGreaterThan(10);
  expect(knowledge.materials.length).toBeGreaterThan(0);

  expect(readdirSync(join(root, 'memory'))).toEqual(['INDEX.md']);
  expect(readFileSync(join(root, 'memory/INDEX.md'), 'utf8'))
    .toContain('尚无已固化课堂记忆');
  expect(existsSync(join(root, 'traces'))).toBe(false);
});
