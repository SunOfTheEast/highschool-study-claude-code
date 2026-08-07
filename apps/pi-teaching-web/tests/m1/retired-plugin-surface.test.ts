import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const repo = join(import.meta.dir, '../../../..');

test('removes the obsolete Claude Code plugin and its current-looking design surface', () => {
  for (const path of [
    'plugins/highschool-study',
    '.claude-plugin/marketplace.json',
    'docs/design/architecture.en.md',
    'docs/design/architecture.zh-CN.md',
    'docs/design/implementation-plan.en.md',
    'docs/design/implementation-plan.zh-CN.md',
    'docs/zh-CN/完整说明书.md',
    'docs/zh-CN/Pi教学前端设计说明.md',
    'docs/zh-CN/学习节点树与证据继承.md',
  ]) expect(existsSync(join(repo, path)), path).toBe(false);
});

test('documents only the Pi App and Markdown teacher memory as the supported product', () => {
  const rootReadme = readFileSync(join(repo, 'README.md'), 'utf8');
  const guide = readFileSync(join(repo, 'AGENTS.md'), 'utf8');
  const appReadme = readFileSync(join(repo, 'apps/pi-teaching-web/README.md'), 'utf8');
  const combined = `${rootReadme}\n${guide}\n${appReadme}`;

  expect(rootReadme).toContain('# StudyForge M1');
  expect(rootReadme).toContain('memory/INDEX.md');
  expect(guide).toContain('M1 memory');
  expect(guide).toContain('Consolidated Learning Traces');
  expect(appReadme).toContain('教师笔记记忆');
  expect(appReadme).toContain('原生 `Read` / `Grep`');
  expect(combined).not.toContain('plugins/highschool-study');
  expect(combined).not.toContain('旧 Claude Code 插件');
  expect(combined).not.toContain('recall-study-memory');
  expect(combined).not.toContain('student-profile.md');
});
