import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse } from 'yaml';

const root = join(import.meta.dir, '../..');
const read = (path: string) => readFileSync(join(root, path), 'utf8');
const frontmatter = (source: string) => {
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(source);
  expect(match).not.toBeNull();
  return parse(match![1]!) as Record<string, unknown>;
};
const toolList = (source: string, field: 'tools' | 'allowed-tools') => {
  const value = frontmatter(source)[field];
  expect(typeof value).toBe('string');
  return (value as string).split(',').map((tool) => tool.trim());
};
const expectInOrder = (source: string, snippets: string[]) => {
  let previous = -1;
  for (const snippet of snippets) {
    const current = source.indexOf(snippet);
    expect(current).toBeGreaterThan(previous);
    previous = current;
  }
};

const mcp = {
  cardSearch: 'mcp__plugin_highschool-study_study-markdown__card_search',
  traceSearch: 'mcp__plugin_highschool-study_study-markdown__trace_search',
  traceAppend: 'mcp__plugin_highschool-study_study-markdown__trace_append',
  sourceResolve: 'mcp__plugin_highschool-study_study-markdown__source_resolve',
};

test('preserves recall and consolidation boundaries', () => {
  const recall = read('skills/recall-study-memory/SKILL.md');
  const consolidate = read('skills/consolidate-plan-memory/SKILL.md');
  expect(recall).toContain('Read both confirmed profiles in full');
  expect(recall).toContain('prior Lesson Summaries in the same Plan');
  expect(recall).toContain('relevant earlier Plan Summaries');
  expect(recall).not.toContain('study_context_get');
  expect(consolidate).toContain(
    'Never edit either profile before explicit student confirmation',
  );
  expect(consolidate).toContain('add / revise / delete');
  expect(consolidate).toContain('one owner only');
  expect(recall.match(/^\d\. /gm)?.map((line) => line.slice(0, 1))).toEqual([
    '1', '2', '3', '4', '5', '6', '7',
  ]);
  expectInOrder(recall, [
    'Locate the active `ROADMAP.md`',
    'prior Lesson Summaries in the same Plan',
    'relevant earlier Plan Summaries',
    'Read both confirmed profiles in full',
    'For preparation only, read `memory/planner-attention.md`',
    'Use `card_search`',
    'Use `source_resolve` only to drill down',
  ]);
});

test('declares exact role tool boundaries', () => {
  const coach = read('agents/study-coach.md');
  const designer = read('agents/lesson-designer.md');
  expect(toolList(coach, 'tools')).toEqual([
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
  expect(toolList(designer, 'tools')).toEqual([
    'Read',
    'Glob',
    'Grep',
    'Agent',
    mcp.cardSearch,
    mcp.traceSearch,
    mcp.sourceResolve,
  ]);
  expect(coach).toContain('only student-facing entry');
  expect(coach).toContain('Agent(highschool-study:lesson-designer)');
  expect(designer).toContain('preparation-only');
  expect(toolList(designer, 'tools')).not.toContain('Write');
  expect(toolList(designer, 'tools')).not.toContain('Edit');
  expect(toolList(designer, 'tools')).not.toContain(mcp.traceAppend);
  for (const role of [coach, designer]) {
    expect(role).toContain('Never ask the student to switch Agents');
    expect(role).toContain('Never invent cards, sources, or session IDs');
    expect(role).toContain('Never persist raw Workflow JSON');
  }
});

test('ships the Markdown-first learning loop skills', () => {
  const skills = [
    'study',
    'start-or-revise-roadmap',
    'prepare-next-lesson',
    'run-lesson',
    'close-lesson-reflection',
    'correct-learning-record',
    'inspect-progress',
  ].map((name) => read(`skills/${name}/SKILL.md`));
  const all = skills.join('\n');
  expect(all).not.toContain('study_context_get');
  expect(skills[2]).toContain('Every card_search candidate already includes its complete active traceHistory');
  expect(skills[3]).toContain('Task completion is not capability attainment');
  expect(skills[4]).toContain('continue / adjust / pause / close');
  expect(skills[5]).toContain('supersedes');
});

test('keeps planner attention preparation-only', () => {
  const recall = read('skills/recall-study-memory/SKILL.md');
  const run = read('skills/run-lesson/SKILL.md');
  const inspect = read('skills/inspect-progress/SKILL.md');
  expect(recall).toContain(
    'For preparation only, read `memory/planner-attention.md`',
  );
  expect(run).toContain('Do not read planner attention during teaching');
  expect(inspect).toContain(
    'Never read or rely on `memory/planner-attention.md`',
  );
  expect(inspect).not.toContain('method projections from planner attention');
  expect(inspect).not.toContain('Use `highschool-study:recall-study-memory`');
  expect(inspect).toContain('active Trace');
  expect(inspect).toContain('cardsByPath');
  expect(inspect).toContain('primary and secondary method roles');
  expect(toolList(inspect, 'allowed-tools')).toEqual([
    'Read',
    'Glob',
    'Grep',
    mcp.traceSearch,
    mcp.sourceResolve,
  ]);
});

test('requires paused-Lesson consent and routes pause or close to reflection', () => {
  const study = read('skills/study/SKILL.md');
  const run = read('skills/run-lesson/SKILL.md');
  const close = read('skills/close-lesson-reflection/SKILL.md');
  expect(study).not.toContain('If a Lesson is active or paused');
  expect(study).toContain('route it to the paused-Lesson consent checkpoint');
  expectInOrder(run, [
    'If the Lesson is paused',
    'fresh explicit `continue`, `adjust`, or `close` choice',
    'Before that choice, make no Task calls and do not teach',
    "project the Lesson's remaining ActivityBlocks",
  ]);
  expect(run).toContain(
    'Whenever the student asks to pause or close, call `highschool-study:close-lesson-reflection`',
  );
  expect(run).toContain('regardless of capability attainment');
  expect(run).toContain('This request-triggered reflection is separate from');
  expectInOrder(run, [
    'Whenever the student asks to pause or close',
    "project the Lesson's remaining ActivityBlocks",
  ]);
  expect(close).toContain(
    'An explicit pause or close request is already the student choice',
  );
});
