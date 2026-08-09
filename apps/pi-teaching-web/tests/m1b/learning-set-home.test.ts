import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { readKnowledge } from '../../src/study/knowledge';
import { readLearningSetHome } from '../../src/study/learning-set-home';

const blank = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const course = join(import.meta.dir, '../fixtures/m0-learning-set');

test('opens a truly blank learning set without inventing a Roadmap', () => {
  const home = readLearningSetHome(blank);

  expect(home.guide.title).toBe('空白学习集');
  expect(home.hasCourse).toBe(false);
  expect(home.course).toBeNull();
  expect(home.assets).toEqual({ notes: 0, problemCards: 0, materials: 0 });
  expect(home.recentFreeLearning).toEqual([]);
});

test('keeps an existing Roadmap available as an optional home destination', () => {
  const home = readLearningSetHome(course);

  expect(home.hasCourse).toBe(true);
  expect(home.course).toEqual(expect.objectContaining({
    title: '导数结构学习路线',
    route: '/course',
  }));
  expect(home.assets.problemCards).toBe(1);
});

test('treats absent legacy graph, cards and materials as an empty asset library', () => {
  expect(readKnowledge(blank)).toEqual({ methods: [], cards: [], materials: [] });
});

