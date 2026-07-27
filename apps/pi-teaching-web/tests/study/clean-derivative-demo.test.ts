import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { readLearningSet } from '../../src/study/read-workspace';

const root = resolve(
  import.meta.dir,
  '../../../../examples/derivative-demo/learning-set',
);

test('keeps the public derivative demo clean and asset-complete', () => {
  const learningSet = readLearningSet(root);
  expect(learningSet.title).toBe('高阶导数学习');
  expect(learningSet.plans).toEqual([]);

  expect(readdirSync(join(root, 'plans')).filter((name) => name.endsWith('.md')))
    .toEqual([]);
  expect(readdirSync(join(root, 'lessons')).filter((name) => name.endsWith('.md')))
    .toEqual([]);

  const cards = Array.from(
    new Bun.Glob('cards/**/*.card.yaml').scanSync({ cwd: root }),
  );
  expect(cards).toHaveLength(519);

  for (const path of [
    'graph/VOCABULARY.md',
    'materials/demo-notes.md',
    '.claude/personas/.gitkeep',
    'memory/student-profile.md',
    'memory/teaching-profile.md',
  ]) {
    expect(existsSync(join(root, path))).toBe(true);
  }

  const plannerAttention = readFileSync(
    join(root, 'memory/planner-attention.md'),
    'utf8',
  );
  expect(plannerAttention).not.toContain('lessons/lesson-');
  expect(plannerAttention).toContain('尚无课堂表现可供整理');
});
