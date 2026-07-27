import { expect, test } from 'bun:test';
import type { LessonStatus, PlanWorkspaceSnapshot } from '../../src/shared/contracts';
import {
  initialClientState,
  preferLiveMessages,
  reduceClientState,
} from '../../src/client/state';

function workspaceWithLesson(status: LessonStatus): PlanWorkspaceSnapshot {
  const plan = {
    id: 'p1',
    title: 'Plan 1',
    path: 'plans/p1.md',
    status: 'active',
    goal: 'goal',
    capabilityStandard: 'standard',
    planningBasis: '当前测试 Plan 的公开安排依据。',
  };
  return {
    learningSet: {
      title: 'Set',
      overview: 'overview',
      learningPrinciples: '',
      goal: 'goal',
      plans: [plan],
    },
    plan,
    coach: { sessionKey: 'coach:p1', sessionId: 'coach-session' },
    lessons: [{
      id: 'l1',
      title: 'Lesson 1',
      path: 'lessons/l1.md',
      planId: 'p1',
      status,
      sessionKey: 'tutor:l1',
      tutorSessionId: 'tutor-session',
      blocks: [],
    }],
  };
}

test('keeps messages separated by Session key', () => {
  let state = initialClientState;
  state = reduceClientState(state, {
    type: 'message-delta',
    sessionKey: 'coach:p1',
    messageId: 'streaming',
    delta: '复盘',
  });
  state = reduceClientState(state, {
    type: 'message-delta',
    sessionKey: 'tutor:l1',
    messageId: 'streaming',
    delta: '题目',
  });
  expect(state.messages['coach:p1']?.[0]?.text).toBe('复盘');
  expect(state.messages['tutor:l1']?.[0]?.text).toBe('题目');
});

test('keeps workflow updates separated by parent Session key', () => {
  const workflow = {
    id: 'wf-1',
    goal: '会诊',
    mode: 'quick' as const,
    status: 'running' as const,
    maxConcurrency: 2,
    tokenLimit: 12_000,
    timeoutMs: 45_000,
    tasks: [],
  };
  let state = reduceClientState(initialClientState, {
    type: 'workflow',
    sessionKey: 'coach:p1',
    workflow,
  });
  state = reduceClientState(state, {
    type: 'workflow',
    sessionKey: 'tutor:l1',
    workflow: { ...workflow, id: 'wf-2', goal: '提示检查' },
  });
  state = reduceClientState(state, {
    type: 'workflow',
    sessionKey: 'coach:p1',
    workflow: { ...workflow, status: 'completed' },
  });
  expect(state.workflows['coach:p1']).toEqual([{ ...workflow, status: 'completed' }]);
  expect(state.workflows['tutor:l1']?.[0]?.id).toBe('wf-2');
});

test('tracks one running turn by Session key until it becomes idle', () => {
  let state = reduceClientState(initialClientState, {
    type: 'session-run',
    sessionKey: 'tutor:l1',
    status: 'running',
    label: 'Tutor 正在启动',
  });
  expect(state.busy['tutor:l1']).toBe('Tutor 正在启动');

  state = reduceClientState(state, {
    type: 'session-run',
    sessionKey: 'tutor:l1',
    status: 'idle',
    label: '',
  });
  expect(state.busy['tutor:l1']).toBe('');
});

test('does not overwrite a live kickoff message with an earlier empty history response', () => {
  const live = [{
    id: 'tutor:l1:live',
    role: 'tutor' as const,
    text: '第一道题',
    complete: true,
  }];

  expect(preferLiveMessages(live, [])).toEqual(live);
});

test('uses fetched history when no live message has arrived', () => {
  const fetched = [{
    id: 'tutor:l1:history',
    role: 'tutor' as const,
    text: '继续上次课堂',
    complete: true,
  }];

  expect(preferLiveMessages([], fetched)).toEqual(fetched);
});

test('keeps an already closed Replay selected when another snapshot arrives', () => {
  const workspace = workspaceWithLesson('closed');
  const state = reduceClientState({
    ...initialClientState,
    workspace,
    selected: 'tutor:l1',
  }, { type: 'snapshot', workspace: workspaceWithLesson('closed') });

  expect(state.selected).toBe('tutor:l1');
});

test('keeps Tutor replay selected when the current Lesson closes', () => {
  const state = reduceClientState({
    ...initialClientState,
    workspace: workspaceWithLesson('active'),
    selected: 'tutor:l1',
  }, { type: 'snapshot', workspace: workspaceWithLesson('closed') });

  expect(state.selected).toBe('tutor:l1');
});
