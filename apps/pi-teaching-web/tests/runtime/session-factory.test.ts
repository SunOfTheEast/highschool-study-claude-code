import { expect, test } from 'bun:test';
import { Agent } from '@earendil-works/pi-agent-core';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { deepModeToolNames, roleToolNames } from '../../src/runtime/session-factory';

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

test('keeps Tutor zero mode student-controlled and Trace-grounded', () => {
  const tutorSkill = readFileSync(join(resources, 'skills/tutor-lesson/SKILL.md'), 'utf8');

  expect(tutorSkill).toContain('A request to think longer is not consent for a hint');
  expect(tutorSkill).toContain('Do not ask a leading question');
  expect(tutorSkill).toContain('A failed Trace write cannot support attainment');
  expect(tutorSkill).toContain('same-card unsupported completion is recall, not unseen transfer');
});

test('grounds Coach preparation and Plan review in qualifying evidence', () => {
  const coachSkill = readFileSync(join(resources, 'skills/coach-study/SKILL.md'), 'utf8');

  expect(coachSkill).toContain('same-card retry is practice, not unseen transfer');
  expect(coachSkill).toContain('consecutive means adjacent evidence-bearing attempts');
  expect(coachSkill).toContain('method structure is not a problem category');
  expect(coachSkill).toContain('missing active Trace blocks attainment');
  expect(coachSkill).toContain('usedCardPaths');
  expect(coachSkill).toContain('criterion | lesson/block | cardPath | problem category');
});
