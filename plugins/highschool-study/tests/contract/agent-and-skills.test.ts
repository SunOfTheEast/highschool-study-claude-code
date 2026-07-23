import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const root = join(import.meta.dir, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');

function frontmatter(path: string) {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(read(path));
  expect(match).not.toBeNull();
  return parse(match![1]!) as Record<string, unknown>;
}

function toolList(path: string, field: 'tools' | 'allowed-tools') {
  const value = frontmatter(path)[field];
  expect(typeof value).toBe('string');
  return (value as string).split(',').map((tool) => tool.trim());
}

const mcp = {
  cardSearch: 'mcp__plugin_highschool-study_study-markdown__card_search',
  traceSearch: 'mcp__plugin_highschool-study_study-markdown__trace_search',
  traceAppend: 'mcp__plugin_highschool-study_study-markdown__trace_append',
  sourceResolve: 'mcp__plugin_highschool-study_study-markdown__source_resolve',
};

test('declares exact Agent tool boundaries', () => {
  expect(toolList('agents/study-coach.md', 'tools')).toEqual([
    'Read',
    'Glob',
    'Grep',
    'Write',
    'Edit',
    'Skill',
    'Agent(highschool-study:lesson-designer)',
    'TaskCreate',
    'TaskUpdate',
    'TaskList',
    mcp.cardSearch,
    mcp.traceSearch,
    mcp.traceAppend,
    mcp.sourceResolve,
  ]);

  expect(toolList('agents/lesson-designer.md', 'tools')).toEqual([
    'Read',
    'Glob',
    'Grep',
    'WebSearch',
    'WebFetch',
    'Agent',
    mcp.cardSearch,
    mcp.traceSearch,
    mcp.sourceResolve,
  ]);
});

test('keeps evidence writers out of read-only and consolidation routes', () => {
  const designer = toolList('agents/lesson-designer.md', 'tools');
  const consolidate = toolList(
    'skills/consolidate-plan-memory/SKILL.md',
    'allowed-tools',
  );
  const correct = toolList(
    'skills/correct-learning-record/SKILL.md',
    'allowed-tools',
  );

  expect(designer).not.toContain('Write');
  expect(designer).not.toContain('Edit');
  expect(designer).not.toContain(mcp.traceAppend);
  expect(consolidate).not.toContain(mcp.traceAppend);
  expect(correct).toContain(mcp.traceAppend);
});
