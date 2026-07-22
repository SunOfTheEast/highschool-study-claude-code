import { expect, test } from 'bun:test';
import { Agent } from '@earendil-works/pi-agent-core';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  deepModeToolNames,
  roleToolNames,
  triggerAndWaitForAgentEnd,
} from '../../src/runtime/session-factory';

test('keeps the Pi coding-agent and agent-core constructor contract aligned', () => {
  const LegacyAgent = Agent as unknown as new (options: {
    streamFunction: () => never;
  }) => Agent;

  expect(() => new LegacyAgent({
    streamFunction: () => { throw new Error('not invoked during construction'); },
  })).not.toThrow();

  const codingAgentEntry = Bun.resolveSync('@earendil-works/pi-coding-agent', import.meta.dir);
  const coreEntry = Bun.resolveSync('@earendil-works/pi-agent-core', dirname(codingAgentEntry));
  const corePackage = JSON.parse(readFileSync(join(dirname(coreEntry), '../package.json'), 'utf8')) as {
    version: string;
  };
  expect(corePackage.version).toBe('0.81.0');
});

const resources = join(import.meta.dir, '../../resources');
const expectInOrder = (source: string, snippets: string[]) => {
  let previous = -1;
  for (const snippet of snippets) {
    const current = source.indexOf(snippet);
    expect(current).toBeGreaterThan(previous);
    previous = current;
  }
};

test('keeps Coach and Tutor tool boundaries distinct', () => {
  expect(roleToolNames('coach')).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'write',
    'edit',
    'card_search',
    'trace_search',
    'source_resolve',
    'plan_update',
  ]);
  expect(roleToolNames('tutor')).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'card_search',
    'trace_search',
    'trace_append',
    'source_resolve',
    'classroom_update',
    'lesson_close',
    'card_alternative_append',
  ]);
  expect(readFileSync(join(resources, 'agents/coach.md'), 'utf8')).toContain('one Plan');
  expect(readFileSync(join(resources, 'agents/tutor.md'), 'utf8')).toContain('one Lesson');
  for (const role of ['coach', 'tutor'] as const) {
    expect(roleToolNames(role)).not.toContain('subagent');
    expect(roleToolNames(role)).not.toContain('deep_workflow_propose');
  }
});

test('adds only the workflow proposal tool while deep mode is enabled', () => {
  const ordinary = ['read', 'card_search'];
  expect(deepModeToolNames(ordinary, true)).toEqual([
    'read',
    'card_search',
    'deep_workflow_propose',
  ]);
  expect(deepModeToolNames([...ordinary, 'deep_workflow_propose'], false)).toEqual(ordinary);
  expect(deepModeToolNames(ordinary, true)).not.toContain('subagent');
});

test('keeps lesson kickoff pending until the triggered agent emits agent_end', async () => {
  let emit: ((event: AgentSessionEvent) => void) | null = null;
  let unsubscribed = false;
  const order: string[] = [];
  const source = {
    subscribe(listener: (event: AgentSessionEvent) => void) {
      order.push('subscribe');
      emit = listener;
      return () => { unsubscribed = true; };
    },
  };
  let settled = false;
  const waiting = triggerAndWaitForAgentEnd(source, async () => {
    order.push('trigger');
  }).then(() => { settled = true; });

  await Promise.resolve();
  await Promise.resolve();
  expect(order).toEqual(['subscribe', 'trigger']);
  expect(settled).toBe(false);

  emit!({ type: 'agent_end', messages: [], willRetry: true });
  await Promise.resolve();
  expect(settled).toBe(false);
  expect(unsubscribed).toBe(false);

  emit!({ type: 'agent_end', messages: [], willRetry: false });
  await waiting;
  expect(settled).toBe(true);
  expect(unsubscribed).toBe(true);
});

test('unsubscribes and propagates a kickoff trigger error', async () => {
  let unsubscribed = false;
  const failure = new Error('kickoff failed');
  const source = {
    subscribe(_listener: (event: AgentSessionEvent) => void) {
      return () => { unsubscribed = true; };
    },
  };

  await expect(triggerAndWaitForAgentEnd(source, async () => {
    throw failure;
  })).rejects.toBe(failure);
  expect(unsubscribed).toBe(true);
});

test('keeps Tutor zero mode student-controlled and Trace-grounded', () => {
  const tutorSkill = readFileSync(join(resources, 'skills/tutor-lesson/SKILL.md'), 'utf8');

  expect(tutorSkill).toContain('A request to think longer is not consent for a hint');
  expect(tutorSkill).toContain('Do not ask a leading question');
  expect(tutorSkill).toContain('A failed Trace write cannot support attainment');
  expect(tutorSkill).toContain('same-card unsupported completion is recall, not unseen transfer');
  expect(tutorSkill).toContain(
    'A first-attempt problem heading is exactly the Lesson alias',
  );
  expect(tutorSkill).toContain(
    'card title, graph.goal, graph.method, graph.structure, hint, solution, or Teacher Control',
  );
  expect(tutorSkill).toContain(
    '`zero` plus an explicit numbered hint request uses that requested ladder level for that one response',
  );
  expect(tutorSkill).toContain(
    'Do not refuse and then give an unlabelled structural cue',
  );
  expect(tutorSkill).toContain(
    "Before rejecting a non-reference route, reconstruct the student's complete chain and verify every decisive implication.",
  );
  expect(tutorSkill).toContain(
    'If the route is complete and correct, finish every required evidence write, then state only that it is correct and stop; do not automatically present, compare, or pivot to the reference solution.',
  );
  expect(tutorSkill).toContain(
    'Give a hint, compare methods, or show a complete reference solution only when the student explicitly requests that action.',
  );
});

test('defines the Tutor correction, hint ladder and tool-turn protocol literally', () => {
  const tutorAgent = readFileSync(join(resources, 'agents/tutor.md'), 'utf8');
  const tutorSkill = readFileSync(join(resources, 'skills/tutor-lesson/SKILL.md'), 'utf8');

  for (const source of [tutorAgent, tutorSkill]) {
    expect(source).toContain(
      "Before judging, freeze the evidence to mathematical claims the student explicitly supplied before this tool call",
    );
    expect(source).toContain(
      'Never use a derivation, implication or conclusion first supplied by the Tutor to upgrade that same attempt',
    );
  }
  expect(tutorSkill).toContain(
    'If a decisive proof obligation is still missing, record `assessment: incomplete`',
  );
  expect(tutorSkill).toContain(
    'Validate what is established, name the missing obligation without solving it',
  );
  expect(tutorSkill).toContain(
    'Method confirmation and alternative persistence begin only after the evidence-frozen active Trace is correct',
  );
  expect(tutorSkill).toContain(
    "When you accept a student's objection to an assessment, append a superseding Trace before Reflection or Lesson Summary",
  );
  for (const source of [tutorAgent, tutorSkill]) {
    expect(source).toContain(
      'When a later student turn completes or corrects the same card-and-Block attempt, the new Trace MUST set `supersedes` to the exact active incomplete or partially_correct event',
    );
    expect(source).toContain('Before every `trace_append`, run this provenance check');
    expect(source).toContain(
      'If the Tutor has sent any numbered hint since that active attempt began, `support` MUST be `tutor`; this remains true until the card or Block changes',
    );
  }
  expect(tutorSkill).toContain(
    "Level 1 points to one location or condition already present in the student's work",
  );
  expect(tutorSkill).toContain(
    'Level 2 may name one operation or method class, but gives no transformed expression or result',
  );
  expect(tutorSkill).toContain('Level 3 may give one key intermediate expression');
  expect(tutorSkill).toContain('Give the full solution only after an explicit student request');
  expect(tutorSkill).toContain(
    'A Level 1 reply is exactly one observation sentence and then stops',
  );
  expect(tutorSkill).toContain(
    '合并、构造、求导、换元、比较、代入、移项、放缩、拆分、通分',
  );
  for (const source of [tutorAgent, tutorSkill]) {
    expect(source).toContain(
      'A tool-use turn contains tool calls only. A dependent workflow may require consecutive tool-only turns',
    );
    expect(source).toContain('Do not announce, preview, or narrate a tool call');
    expect(source).toContain(
      'If any tool is still needed, the assistant content field is empty; emit only tool calls',
    );
  }
});

test('requires canonical actual-method recovery and durable alternative recording', () => {
  const tutorAgent = readFileSync(join(resources, 'agents/tutor.md'), 'utf8');
  const tutorSkill = readFileSync(join(resources, 'skills/tutor-lesson/SKILL.md'), 'utf8');

  expect(tutorSkill).toContain(
    'Card-declared methods are candidates, not evidence that the student used them.',
  );
  expect(tutorSkill).toContain('If `trace_append` returns any `unresolvedMethods`');
  expect(tutorSkill).toContain('append one superseding Trace with exact canonical names');
  expect(tutorSkill).toContain('A closest valid label is still false evidence');
  for (const source of [tutorAgent, tutorSkill]) {
    expect(source).toContain('Use `methodStatus: unmapped`');
    expect(source).toContain(
      'Use `methodStatus: student_confirmed` only after the student explicitly confirms the proposed canonical node',
    );
    expect(source).toContain('An unconfirmed proposal contributes no method evidence');
    expect(source).toContain(
      'When an initial correct Trace uses `methodStatus: unmapped`, ask the student before activating the next Block',
    );
    expect(source).toContain(
      'The student may confirm, replace, keep the route unmapped, or defer',
    );
    expect(source).toContain(
      'If the student rejects or replaces the proposal, append a superseding Trace that records that response before advancing',
    );
    expect(source).toContain(
      'Re-append an existing verified alternative against the new active Trace before replying',
    );
    expect(source).toContain(
      'A superseding Trace that changes the active assessment to correct must immediately re-run the alternative check',
    );
  }
  expect(tutorSkill).toContain(
    '`含参数分类讨论` requires an actual split into parameter cases',
  );
  expect(tutorSkill).toContain(
    '`局部逼近与找点` requires an actual local approximation or chosen test point',
  );
  for (const source of [tutorAgent, tutorSkill]) {
    expect(source).toContain(
      'MUST call `card_alternative_append` before telling the student that it is an alternative',
    );
    expect(source).toContain(
      'This also applies when the route becomes verifiable only in a later comparison turn.',
    );
    expect(source).toContain(
      'The correct-and-stop rule applies only after all required evidence writes finish',
    );
    expect(source).toContain(
      'After `trace_append` returns the source Trace ID, call `card_alternative_append` in the next tool-only turn',
    );
    expect(source).toContain(
      'A dependent workflow may require consecutive tool-only turns',
    );
    expect(source).toContain('For a card without parts, pass `question` exactly as `整题`');
  }
});

test('grounds Coach preparation and Plan review in qualifying evidence', () => {
  const coachSkill = readFileSync(join(resources, 'skills/coach-study/SKILL.md'), 'utf8');

  expect(coachSkill).toContain('same-card retry is practice, not unseen transfer');
  expect(coachSkill).toContain('consecutive means adjacent evidence-bearing attempts');
  expect(coachSkill).toContain('method structure is not a problem category');
  expect(coachSkill).toContain('missing active Trace blocks attainment');
  expect(coachSkill).toContain('usedCardPaths');
  expect(coachSkill).toContain('criterion | lesson/block | cardPath | problem category');
  expect(coachSkill).toContain(
    'Every prepared Lesson ends with the exact top-level headings `## Reflection`, `## Lesson Summary`, and `## Traces`',
  );
  expect(coachSkill).toContain(
    'A Block named reflection does not replace these sections',
  );
});

test('maps Coach card dimensions and persists the final Plan audit before replying', () => {
  const coachAgent = readFileSync(join(resources, 'agents/coach.md'), 'utf8');
  const coachSkill = readFileSync(join(resources, 'skills/coach-study/SKILL.md'), 'utf8');

  expect(coachSkill).toContain('problem category = card_search.goal (graph.goal.primary)');
  expect(coachSkill).toContain('method shell = card_search.methods (graph.method)');
  expect(coachSkill).toContain('problem category (graph.goal.primary) | method shell (graph.method)');
  expect(coachSkill).toContain(
    'call `trace_search` once with the current `planId` and `limit: 100`',
  );
  expect(coachSkill).toContain(
    'copy every non-empty category cell from `cardsByPath[cardPath].goal.primary`',
  );
  expect(coachSkill).toContain(
    'two different method shells with one goal value still count as one problem category',
  );
  expect(coachSkill).toContain(
    'exclude already covered goal values before selecting another authentic card',
  );
  expect(coachSkill).toContain(
    'Map `complete` to `status: completed`; map `active` and `replan` to `status: active`',
  );
  expect(coachSkill).toContain('Trace methods are the only student-method evidence');
  expectInOrder(coachSkill, [
    'Update `## Lesson Index`',
    'Update `## Current Position`',
    'Update `## Next Lesson Candidate`',
    'Update `## Plan Summary`',
    'Reread the Plan',
    'Only then send',
  ]);
  for (const source of [coachAgent, coachSkill]) {
    expect(source).toContain(
      'A tool-use turn contains tool calls only. After the tool results arrive, send a separate Chinese student-facing message',
    );
    expect(source).toContain('Do not announce, preview, or narrate a tool call');
    expect(source).toContain(
      'If any tool is still needed, the assistant content field is empty; emit only tool calls',
    );
    expect(source).toContain(
      'Do not send the temporary evidence matrix or any conclusion until all reads, writes, and rereads are finished',
    );
  }
});
