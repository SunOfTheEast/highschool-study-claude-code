import { expect, test } from 'bun:test';
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent';
import {
  STUDY_SUBAGENTS,
  studySubagentGuard,
  validateStudySubagentCall,
} from '../../src/runtime/study-subagent-guard';

const allowed = [
  { agent: 'study-material-scout', task: '召回两道题' },
  { agent: 'lesson-risk-reviewer', task: '核验定义域' },
  {
    tasks: [
      { agent: 'study-material-scout', task: '槽位一' },
      { agent: 'study-material-scout', task: '槽位二' },
    ],
    concurrency: 2,
  },
  {
    tasks: [
      { agent: 'study-material-scout', task: '召回' },
      { agent: 'lesson-risk-reviewer', task: '核验' },
    ],
    context: 'fresh',
  },
];

const blocked = [
  { agent: 'reviewer', task: '全面审查' },
  { agent: 'worker', task: '写一节课' },
  {
    tasks: [
      { agent: 'study-material-scout', task: '召回' },
      { agent: 'reviewer', task: '审查' },
    ],
  },
  { tasks: [] },
  { chain: [{ agent: 'study-material-scout', task: '召回' }] },
  { action: 'list' },
  { action: 'create', config: { name: 'another-agent' } },
  { action: 'update', agent: 'study-material-scout' },
  { action: 'eject', agent: 'study-material-scout' },
  { action: 'disable', agent: 'study-material-scout' },
  { task: '没有目标' },
  { agent: 42 },
  null,
  'study-material-scout',
];

test('allows only direct or parallel calls to the two StudyForge subagents', () => {
  expect([...STUDY_SUBAGENTS]).toEqual([
    'study-material-scout',
    'lesson-risk-reviewer',
  ]);
  for (const input of allowed) expect(validateStudySubagentCall(input)).toBeNull();
  for (const input of blocked) {
    expect(validateStudySubagentCall(input)).toContain('STUDY_SUBAGENT_NOT_ALLOWED');
  }
});

test('blocks a rejected subagent tool call before execution', async () => {
  let handler: ((event: {
    toolName: string;
    input: Record<string, unknown>;
  }) => unknown) | null = null;
  const api = {
    on(name: string, value: typeof handler) {
      if (name === 'tool_call') handler = value;
    },
  } as unknown as ExtensionAPI;

  studySubagentGuard(api);
  expect(handler).not.toBeNull();
  const invoke = handler!;
  expect(await invoke({
    toolName: 'subagent',
    input: { agent: 'reviewer', task: '审查' },
  })).toEqual({
    block: true,
    reason: expect.stringContaining('STUDY_SUBAGENT_NOT_ALLOWED'),
  });
  expect(await invoke({
    toolName: 'subagent',
    input: { agent: 'lesson-risk-reviewer', task: '核验' },
  })).toBeUndefined();
  expect(await invoke({
    toolName: 'read',
    input: { path: 'ROADMAP.md' },
  })).toBeUndefined();
});
