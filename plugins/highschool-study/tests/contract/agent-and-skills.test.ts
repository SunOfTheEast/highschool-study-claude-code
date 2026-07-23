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
    'Every prepared Lesson ends with the exact top-level headings `## Reflection`, `## Lesson Summary`, and `## Traces`',
  );
  expect(prepare).toContain(
    'A Block named reflection does not replace these sections',
  );
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
  const reveal = read(
    'skills/prepare-next-lesson/references/reveal-policy.md',
  );

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
  for (const source of [run, reveal]) {
    expect(source).toContain(
      'A first-attempt problem heading is exactly the Lesson alias',
    );
    expect(source).toContain(
      'card title, graph.goal, graph.method, graph.structure, hint, solution, or Teacher Control',
    );
  }
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
    expect(source).toContain(
      '`zero` plus an explicit numbered hint request uses that requested ladder level for that one response',
    );
    expect(source).toContain(
      'Do not refuse and then give an unlabelled structural cue',
    );
  }
});

test('defines Tutor corrections, hint levels and tool turns literally', () => {
  const run = read('skills/run-lesson/SKILL.md');
  const reveal = read(
    'skills/prepare-next-lesson/references/reveal-policy.md',
  );

  expect(run).toContain(
    "Before judging, freeze the evidence to mathematical claims the student explicitly supplied before this tool call",
  );
  expect(run).toContain(
    'Never use a derivation, implication or conclusion first supplied by the Tutor to upgrade that same attempt',
  );
  expect(run).toContain(
    'If a decisive proof obligation is still missing, keep the attempt incomplete',
  );
  expect(run).toContain(
    'Tutor-provided work can change later support to tutor, but cannot become unsupported student evidence',
  );
  expect(run).toContain(
    "When you accept a student's objection to an assessment, append a superseding Trace before Reflection or Lesson Summary",
  );
  expect(run).toContain(
    'When a later student turn completes or corrects the same card-and-Block attempt, the new Trace MUST set `supersedes` to the exact active incomplete or partially_correct event',
  );
  expect(run).toContain('Treat `support` as actual dependence, not hint exposure');
  expect(run).toContain(
    'If the final solution uses decisive content first supplied by the Tutor, write `support: tutor`',
  );
  expect(run).toContain(
    'If the Tutor only repeats, locates or confirms content the student already produced, and the decisive content is student-produced, write `support: none`',
  );
  expect(run).toContain(
    'An explicit student statement such as `采用你提示的` is conclusive positive attribution when it names a decisive item',
  );
  expect(run).toContain(
    'A mixed chain with even one Tutor-origin decisive item is `support: tutor`',
  );
  expect(run).toContain(
    'Before emitting any requested hint after an evidence-bearing attempt, first append that attempt and retain its exact active Trace ID',
  );
  expect(run).toContain(
    'Put `supersedes` only in the top-level `trace_append` arguments, never in `note`, prose or tool-call markup',
  );
  expect(run).toContain(
    'If you cannot name that exact event ID from the prior tool result, do not issue the `trace_append` tool yet',
  );
  expect(run).toContain('刚才的提示是否对你最终使用的关键步骤起了作用？');
  expect(run).toContain(
    'Do not append the final correct Trace until the student answers this attribution question',
  );
  expect(run).not.toContain(
    'If the Tutor has sent any numbered hint since that active attempt began, `support` MUST be `tutor`',
  );
  expect(run).toContain(
    "Before rejecting a non-reference route, reconstruct the student's complete chain and verify every decisive implication.",
  );
  expect(run).toContain(
    'If the route is complete and correct, finish every required evidence write, then state only that it is correct and stop; do not automatically present, compare, or pivot to the reference solution.',
  );
  expect(run).toContain(
    'Give a hint, compare methods, or show a complete reference solution only when the student explicitly requests that action.',
  );
  expect(run).toContain(
    'Card-declared methods are candidates, not evidence that the student used them.',
  );
  expect(run).toContain('If `trace_append` returns any `unresolvedMethods`');
  expect(run).toContain('A closest valid label is still false evidence');
  expect(run).toContain(
    'When an initial correct Trace has no confirmed method, ask the student before advancing the next Task',
  );
  expect(run).toContain(
    'The student may confirm, replace, keep the route unbound, or defer',
  );
  expect(run).toContain(
    'If the student rejects or replaces the proposal, append a superseding Trace that records that response before advancing',
  );
  expect(run).toContain(
    '`含参数分类讨论` requires an actual split into parameter cases',
  );
  expect(run).toContain(
    '`局部逼近与找点` requires an actual local approximation or chosen test point',
  );
  expect(run).toContain(
    'MUST persist the trace-linked alternative before telling the student that it is an alternative',
  );
  expect(run).toContain(
    'This also applies when the route becomes verifiable only in a later comparison turn.',
  );
  expect(run).toContain(
    'A superseding Trace that changes the active assessment to correct must immediately re-run the alternative check',
  );
  expect(run).toContain(
    'The correct-and-stop rule applies only after all required evidence writes finish',
  );
  expect(run).toContain(
    'After `trace_append` returns the source Trace ID, call the alternative writer in the next tool-only turn',
  );
  expect(run).toContain(
    'A dependent workflow may require consecutive tool-only turns',
  );
  expect(run).toContain('For a card without parts, pass the question exactly as `整题`');
  expect(run).toContain(
    'A tool-use turn contains tool calls only. A dependent workflow may require consecutive tool-only turns',
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
  expect(run).toContain(
    'If any tool is still needed, the assistant content field is empty; emit only tool calls',
  );
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
  expect(coach).toContain(
    'If any tool is still needed, the assistant content field is empty; emit only tool calls',
  );
  expect(coach).toContain(
    'Do not send the temporary evidence matrix or any conclusion until all reads, writes, and rereads are finished',
  );
});
