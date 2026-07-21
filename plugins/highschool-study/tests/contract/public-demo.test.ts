import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dir, '../../../..');
const demo = join(repo, 'examples/derivative-demo');
const read = (path: string) => readFileSync(join(demo, path), 'utf8');

test('ships an oriented derivative demo with a set-scoped persona', () => {
  for (const path of [
    'learning-set/CLAUDE.md',
    'learning-set/.gitignore',
    'learning-set/.claude/personas/.gitkeep',
  ]) expect(existsSync(join(demo, path))).toBe(true);

  const roadmap = read('learning-set/ROADMAP.md');
  const config = read('learning-set/CLAUDE.md');
  const rootInstructions = read('CLAUDE.md');
  const tutorial = read('README.md');

  expect(roadmap).toContain('## Learning Set Overview');
  expect(roadmap).toContain('定义域完整性');
  expect(config).toContain(
    '- Default presentation persona: `calm-senpai`',
  );
  expect(rootInstructions).toContain('learning-set/CLAUDE.md');
  expect(tutorial).toContain('这节课换成元气同桌');
  expect(tutorial).toContain('以后这个学习集都用冷静学姐');
  expect(tutorial).toContain('关闭人设');
});
