import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readKnowledge } from '../../src/study/knowledge';
import { readLearningSetHome } from '../../src/study/learning-set-home';

const blank = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const course = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

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

test('projects only student-facing guide content and structural course facts', () => {
  const home = readLearningSetHome(course);

  expect(home.guide).toEqual({
    title: '导数结构学习集',
    introduction: '这个学习集帮助你识别导数综合题的结构，并逐步学会选择路线。',
    principles: '- 碰到新题时，先说清自己在哪一步犹豫。',
  });
  expect(JSON.stringify(home)).not.toContain('这句教师诊断绝不能出现在首页');
  expect(home.course).not.toHaveProperty('currentPosition');
});

test('treats absent legacy graph, cards and materials as an empty asset library', () => {
  expect(readKnowledge(blank)).toEqual({ methods: [], cards: [], materials: [] });
});

test('counts current card files without parsing the card corpus for Home', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-light-home-'));
  roots.push(root);
  mkdirSync(join(root, 'cards'), { recursive: true });
  writeFileSync(join(root, 'LEARNING_GUIDE.md'), [
    '---', 'id: light-home', 'title: 轻量首页', '---', '',
    '# 轻量首页', '', '先打开再说。', '',
  ].join('\n'));
  writeFileSync(join(root, 'cards', 'broken.card.yaml'), 'not: [valid yaml');

  expect(readLearningSetHome(root).assets.problemCards).toBe(1);
});
