import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = join(import.meta.dir, '../..');

test('ships the minimal Markdown template', () => {
  for (const path of [
    '.claude-plugin/plugin.json',
    '.mcp.json',
    'learning-set-template/ROADMAP.md',
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
