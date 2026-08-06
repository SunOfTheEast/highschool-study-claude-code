import { expect, test } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { readKnowledge } from '../../src/study/knowledge';
import { readCourseTree, readRoadmap } from '../../src/study/markdown';

const root = join(import.meta.dir, '../../../../examples/derivative-m0/learning-set');

// Exclude this test together with examples/derivative-m0 during a clean public export.
test('validates the private beta derivative corpus in the private repository', () => {
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

  expect(existsSync(join(root, 'memory'))).toBe(false);
  expect(existsSync(join(root, 'traces'))).toBe(false);
});
