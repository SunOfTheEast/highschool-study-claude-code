import { expect, test } from 'bun:test';
import { existsSync, readFileSync } from 'node:fs';
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
    'WebSearch',
    'WebFetch',
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

test('enters the learning set before routing and confines personas to presentation', () => {
  const enterPath = 'skills/enter-learning-set/SKILL.md';
  expect(existsSync(join(root, enterPath))).toBe(true);
  const enter = read(enterPath);
  const study = read('skills/study/SKILL.md');
  const coach = read('agents/study-coach.md');

  expect(frontmatter(enter)['user-invocable']).toBe(false);
  expect(toolList(enter, 'allowed-tools')).toEqual([
    'Read', 'Glob', 'Grep', 'Write', 'Edit',
  ]);
  expectInOrder(study, [
    'First invoke `highschool-study:enter-learning-set`',
    'Route an explicit correction request',
  ]);
  expectInOrder(enter, [
    'current Lesson Session',
    '`learning-set/CLAUDE.local.md`',
    '`learning-set/CLAUDE.md`',
    '`neutral-tutor`',
  ]);
  expect(enter).toContain('Read exactly one final persona file');
  expect(enter).toContain('Do not write a temporary choice');
  expect(enter).toContain('## Highschool Study Presentation');
  expect(enter).toContain('explicitly asks for the overview');
  expect(enter).toContain(
    'keep the overview context empty and continue through persona resolution',
  );
  expect(enter).toContain('let `study` route to Roadmap creation');
  expect(enter).toContain('update only the `Preferred persona` bullet');
  expect(enter).toContain('preserve every other line');
  expect(coach).toContain('presentation layer only');
  expect(coach).toContain('Keep `lesson-designer` persona-neutral');

  for (const id of [
    'neutral-tutor', 'calm-senpai', 'energetic-classmate',
  ]) {
    const persona = read(
      `skills/enter-learning-set/references/personas/${id}.md`,
    );
    expect(persona).toContain(`- ID: \`${id}\``);
    expect(persona).toContain('Presentation only');
  }
});

test('ships adaptive classroom templates and one shared reveal policy', () => {
  const templates = read(
    'skills/prepare-next-lesson/references/classroom-templates.md',
  );
  const reveal = read(
    'skills/prepare-next-lesson/references/reveal-policy.md',
  );

  for (const id of [
    'diagnostic',
    'concept',
    'deliberate-practice',
    'remediation',
    'assessment',
    'review',
  ]) expect(templates).toContain(`## ${id}`);

  expect(templates).toContain('Derive problem-role slots before card search');
  expect(templates).toContain('Do not stop after the first suitable card');
  expect(templates).toContain('Default counts are ranges, not quotas');
  expect(templates).toContain('A video is never decorative');

  for (const mode of ['zero', 'ladder', 'worked-example']) {
    expect(reveal).toContain(`## ${mode}`);
  }
  expect(reveal).toContain('### Student View');
  expect(reveal).toContain('### Teacher Control');
  expect(reveal).toContain('one level per student-approved turn');
  expect(reveal).toContain('method recognition is itself the evidence target');
});

test('prepares from a template and role slots before searching cards', () => {
  const study = read('skills/study/SKILL.md');
  const prepare = read('skills/prepare-next-lesson/SKILL.md');
  const designer = read('agents/lesson-designer.md');

  expectInOrder(study, [
    'If the student explicitly asks to prepare directly',
    'If a prepared next Lesson exists',
  ]);
  expect(study).toContain(
    'route to `highschool-study:prepare-next-lesson` even when a prepared Lesson exists',
  );
  expectInOrder(prepare, [
    'Read `references/classroom-templates.md`',
    'Choose one primary template',
    'Derive the problem-role slots before the first `card_search`',
    'Search separately for the required slots',
    'Draft every problem-bearing block with `### Student View`',
  ]);
  expect(prepare).toContain('Do not stop at the first suitable card');
  expect(prepare).toContain(
    'title, URL, segment, purpose, follow-up question, and fallback',
  );
  expect(prepare).toContain('External URLs remain ordinary links');

  expect(toolList(designer, 'tools')).toEqual([
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
  expect(designer).toContain('Keep `lesson-designer` persona-neutral');
  expect(designer).toContain('Verify every external video');
  expect(designer).toContain(
    'Never use an external video to solve the target before its first attempt',
  );
});

test('projects only Student View and enforces reveal modes', () => {
  const run = read('skills/run-lesson/SKILL.md');

  expectInOrder(run, [
    'Read the shared `reveal-policy.md`',
    "project only the current block's `### Student View`",
    'For `zero`',
    'For `ladder`',
    'For `worked-example`',
    'call `trace_append`',
  ]);
  expect(run).toContain('Never dump the whole Lesson');
  expect(run).toContain('never quote or paraphrase `### Teacher Control`');
  expect(run).toContain('one level in one student-approved turn');
  expect(run).toContain('use a different unseen card');
  expect(run).toContain('Task completion is not capability attainment');
  expect(toolList(run, 'allowed-tools')).not.toContain('WebSearch');
  expect(toolList(run, 'allowed-tools')).not.toContain('WebFetch');
});

test('keeps zero-mode teaching student-controlled and Trace-grounded', () => {
  const run = read('skills/run-lesson/SKILL.md');
  const reveal = read(
    'skills/prepare-next-lesson/references/reveal-policy.md',
  );

  for (const source of [run, reveal]) {
    expect(source).toContain('A request to think longer is not consent for a hint');
    expect(source).toContain('Do not ask a leading question');
    expect(source).toContain('A failed Trace write cannot support attainment');
    expect(source).toContain('same-card unsupported completion is recall, not unseen transfer');
  }
});

test('defines Tutor corrections, hint levels and tool turns literally', () => {
  const run = read('skills/run-lesson/SKILL.md');
  const reveal = read(
    'skills/prepare-next-lesson/references/reveal-policy.md',
  );

  expect(run).toContain(
    "When you accept a student's objection to an assessment, append a superseding Trace before Reflection or Lesson Summary",
  );
  expect(run).toContain(
    'A tool-use turn contains tool calls only. After the tool results arrive, send a separate Chinese student-facing message',
  );
  for (const source of [run, reveal]) {
    expect(source).toContain(
      "Level 1 points to one location or condition already present in the student's work",
    );
    expect(source).toContain(
      'Level 2 may name one operation or method class, but gives no transformed expression or result',
    );
    expect(source).toContain('Level 3 may give one key intermediate expression');
    expect(source).toContain('Give the full solution only after an explicit student request');
    expect(source).toContain(
      'A Level 1 reply is exactly one observation sentence and then stops',
    );
    expect(source).toContain(
      '合并、构造、求导、换元、比较、代入、移项、放缩、拆分、通分',
    );
  }
  expect(run).toContain('Do not announce, preview, or narrate a tool call');
});

test('grounds preparation and Plan review in qualifying evidence', () => {
  const prepare = read('skills/prepare-next-lesson/SKILL.md');
  const close = read('skills/close-lesson-reflection/SKILL.md');

  for (const source of [prepare, close]) {
    expect(source).toContain('same-card retry is practice, not unseen transfer');
    expect(source).toContain('consecutive means adjacent evidence-bearing attempts');
    expect(source).toContain('method structure is not a problem category');
    expect(source).toContain('missing active Trace blocks attainment');
  }
  expect(prepare).toContain('usedCardPaths');
  expect(prepare).toContain('criterion | lesson/block | cardPath | problem category');
});

test('maps card dimensions and persists every final Plan audit before replying', () => {
  const coach = read('agents/study-coach.md');
  const prepare = read('skills/prepare-next-lesson/SKILL.md');
  const close = read('skills/close-lesson-reflection/SKILL.md');
  const consolidate = read('skills/consolidate-plan-memory/SKILL.md');

  for (const source of [prepare, close]) {
    expect(source).toContain('problem category = card_search.goal (graph.goal.primary)');
    expect(source).toContain('method shell = card_search.methods (graph.method)');
    expect(source).toContain('problem category (graph.goal.primary) | method shell (graph.method)');
    expect(source).toContain(
      'copy every non-empty category cell from `cardsByPath[cardPath].goal.primary`',
    );
    expect(source).toContain(
      'two different method shells with one goal value still count as one problem category',
    );
  }
  expect(close).toContain(
    'call `trace_search` once with the current `planId` and `limit: 100`',
  );
  expect(prepare).toContain(
    'exclude already covered goal values before selecting another authentic card',
  );
  expect(close).toContain(
    'Map `complete` to `status: completed`; map `active` and `replan` to `status: active`',
  );
  expect(consolidate).toContain('Set Plan frontmatter to `status: completed`');
  for (const source of [close, consolidate]) {
    expectInOrder(source, [
      'Update `## Lesson Index`',
      'Update `## Current Position`',
      'Update `## Next Lesson Candidate`',
      'Update `## Plan Summary`',
      'Reread the Plan',
      'Only then send',
    ]);
  }
  expect(coach).toContain(
    'A tool-use turn contains tool calls only. After the tool results arrive, send a separate Chinese student-facing message',
  );
  expect(coach).toContain('Do not announce, preview, or narrate a tool call');
});
