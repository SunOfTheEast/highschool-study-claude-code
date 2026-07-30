import { expect, test } from 'bun:test';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import {
  listCanonicalMethodNames,
  listCards,
  parseChildTree,
  readMethodTree,
} from '../../server/src/domain';

const repo = join(import.meta.dir, '../../../..');
const demo = join(repo, 'examples/derivative-demo');
const read = (path: string) => readFileSync(join(demo, path), 'utf8');

test('ships an oriented derivative demo with a set-scoped persona', () => {
  for (const path of [
    'learning-set/CLAUDE.md',
    'learning-set/LEARNING_GUIDE.md',
    'learning-set/.gitignore',
    'learning-set/.claude/personas/.gitkeep',
  ]) expect(existsSync(join(demo, path))).toBe(true);

  const roadmap = read('learning-set/ROADMAP.md');
  const config = read('learning-set/CLAUDE.md');
  const rootInstructions = read('CLAUDE.md');
  const tutorial = read('README.md');

  expect(roadmap).toContain('## Learning Set Overview');
  expect(roadmap).toContain('## Plan Tree');
  expect(roadmap).not.toContain('## Plan Graph');
  expect(parseChildTree(roadmap, 'Plan Tree', 'plan', 'ROADMAP.md').entries)
    .toEqual([]);
  expect(roadmap).toContain('（尚未创建学习阶段）');
  expect(config).toContain(
    '- Default presentation persona: `calm-senpai`',
  );
  expect(rootInstructions).toContain('learning-set/CLAUDE.md');
  expect(tutorial).toContain('这节课换成元气同桌');
  expect(tutorial).toContain('以后这个学习集都用冷静学姐');
  expect(tutorial).toContain('关闭人设');
  expect(readdirSync(join(demo, 'learning-set/plans'))).toEqual(['.gitkeep']);
  expect(readdirSync(join(demo, 'learning-set/lessons'))).toEqual(['.gitkeep']);
  expect(readdirSync(join(demo, 'learning-set/traces'))).toEqual(['.gitkeep']);
  expect(readdirSync(join(demo, 'learning-set/cards/derivative')))
    .toHaveLength(519);

  const learningSet = join(demo, 'learning-set');
  const treeMethods = new Set(
    readMethodTree(learningSet).nodes.slice(1).map((node) => node.name),
  );
  expect(treeMethods).toEqual(new Set(listCanonicalMethodNames(learningSet)));
  for (const card of listCards(learningSet)) {
    for (const method of card.methods) {
      expect(treeMethods.has(method.name)).toBe(true);
    }
  }
});
