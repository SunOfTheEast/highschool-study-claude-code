import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseChildTree } from '../../server/src/domain';

const root = join(import.meta.dir, '../..');

test('ships the minimal Markdown template', () => {
  for (const path of [
    '.claude-plugin/plugin.json',
    '.mcp.json',
    'skills/plan-next-cycle/SKILL.md',
    'learning-set-template/ROADMAP.md',
    'learning-set-template/LEARNING_GUIDE.md',
    'learning-set-template/plans/.gitkeep',
    'learning-set-template/lessons/.gitkeep',
    'learning-set-template/traces/.gitkeep',
    'learning-set-template/cards/.gitkeep',
    'learning-set-template/graph/.gitkeep',
    'learning-set-template/materials/.gitkeep',
    'learning-set-template/memory/student-profile.md',
    'learning-set-template/memory/teaching-profile.md',
    'learning-set-template/memory/planner-attention.md',
  ]) expect(existsSync(join(root, path))).toBe(true);
  const student = readFileSync(
    join(root, 'learning-set-template/memory/student-profile.md'), 'utf8',
  );
  expect(student).toContain('Only student-confirmed current preferences');
  expect(student).not.toContain('[student-stated]');
});

test('ships a bundled MCP entrypoint for marketplace installs', () => {
  const mcp = JSON.parse(readFileSync(join(root, '.mcp.json'), 'utf8'));
  expect(mcp.mcpServers['study-markdown']).toMatchObject({
    command: 'bun',
    args: ['run', '${CLAUDE_PLUGIN_ROOT}/dist/mcp-server.js'],
  });
  expect(existsSync(join(root, 'dist/mcp-server.js'))).toBe(true);
});

test('ships the learning-set orientation envelope', () => {
  for (const path of [
    'learning-set-template/CLAUDE.md',
    'learning-set-template/.gitignore',
    'learning-set-template/.claude/personas/.gitkeep',
  ]) expect(existsSync(join(root, path))).toBe(true);

  const roadmap = readFileSync(
    join(root, 'learning-set-template/ROADMAP.md'), 'utf8',
  );
  const instructions = readFileSync(
    join(root, 'learning-set-template/CLAUDE.md'), 'utf8',
  );
  const ignore = readFileSync(
    join(root, 'learning-set-template/.gitignore'), 'utf8',
  );

  expect(roadmap).toContain('## Learning Set Overview');
  expect(roadmap).toContain('## Plan Tree');
  expect(roadmap).not.toContain('## Plan Graph');
  expect(parseChildTree(roadmap, 'Plan Tree', 'plan', 'ROADMAP.md').entries)
    .toEqual([]);
  expect(roadmap).toContain('- What this teaches:');
  for (const heading of ['Goal', 'Observable Capability Standard', 'Test']) {
    expect(roadmap).toMatch(new RegExp(
      `## ${heading}\\n\\n（[^\\n]+）`,
    ));
  }
  expect(instructions).toContain(
    '- Default presentation persona: `neutral-tutor`',
  );
  expect(instructions).toContain('presentation only');
  expect(ignore.split(/\r?\n/)).toContain('CLAUDE.local.md');
});
