import { expect, test } from 'bun:test';
import type { LessonStatus, PlanWorkspaceSnapshot } from '../../src/shared/contracts';
import {
  initialClientState,
  buildPublicContextPages,
  laterMemoryReview,
  preferLiveConversation,
  reduceClientState,
} from '../../src/client/state';
import type { MemoryReviewSnapshot } from '../../src/memory-review/contracts';

function workspaceWithLesson(status: LessonStatus): PlanWorkspaceSnapshot {
  const plan = {
    id: 'p1',
    title: 'Plan 1',
    path: 'plans/p1.md',
    status: 'active',
    goal: 'goal',
    capabilityStandard: 'standard',
    planningBasis: '当前测试 Plan 的公开安排依据。',
    currentPosition: '当前位置',
    planSummary: '阶段摘要',
    learningReview: null,
  };
  return {
    learningSet: {
      title: 'Set',
      overview: 'overview',
      learningPrinciples: '',
      goal: 'goal',
      planTree: [],
      plans: [plan],
    },
    plan,
    lessonTree: [],
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

test('keeps conversation messages separated by Session key', () => {
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
  expect(state.conversations['coach:p1']?.[0]).toMatchObject({
    kind: 'message',
    message: { text: '复盘' },
  });
  expect(state.conversations['tutor:l1']?.[0]).toMatchObject({
    kind: 'message',
    message: { text: '题目' },
  });
});

test('reconciles one Session conversation without removing cards from other Sessions', () => {
  const review = {
    id: 'review-1',
    planId: 'p1',
    status: 'proposed' as const,
    items: [],
    decisions: [],
  };
  const coachItems = [{ kind: 'memory-review' as const, review }];
  const tutorItems = [{
    kind: 'message' as const,
    message: {
      id: 'tutor:l1:1',
      role: 'tutor' as const,
      text: '保留',
      complete: true,
    },
  }];
  const next = reduceClientState({
    ...initialClientState,
    conversations: { 'tutor:l1': tutorItems },
  }, {
    type: 'conversation-snapshot',
    sessionKey: 'coach:p1',
    items: coachItems,
  });

  expect(next.conversations['coach:p1']).toEqual(coachItems);
  expect(next.conversations['tutor:l1']).toEqual(tutorItems);
});

test('live message updates preserve an existing memory review card', () => {
  const reviewItem = {
    kind: 'memory-review' as const,
    review: {
      id: 'review-1',
      planId: 'p1',
      status: 'proposed' as const,
      items: [],
      decisions: [],
    },
  };
  const next = reduceClientState({
    ...initialClientState,
    conversations: { 'coach:p1': [reviewItem] },
  }, {
    type: 'message',
    sessionKey: 'coach:p1',
    message: {
      id: 'coach:p1:2',
      role: 'coach',
      text: '继续',
      complete: true,
    },
  });

  expect(next.conversations['coach:p1']).toEqual([
    reviewItem,
    expect.objectContaining({ kind: 'message' }),
  ]);
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

  expect(preferLiveConversation(
    live.map((message) => ({ kind: 'message' as const, message })),
    [],
  )).toEqual(live.map((message) => ({ kind: 'message', message })));
});

test('uses fetched history when no live message has arrived', () => {
  const fetched = [{
    id: 'tutor:l1:history',
    role: 'tutor' as const,
    text: '继续上次课堂',
    complete: true,
  }];

  expect(preferLiveConversation(
    [],
    fetched.map((message) => ({ kind: 'message' as const, message })),
  )).toEqual(fetched.map((message) => ({ kind: 'message', message })));
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

test('builds four public context page classes without raw private content', () => {
  const workspace = workspaceWithLesson('active');
  const pages = buildPublicContextPages({
    view: 'tutor',
    workspace,
    coachContext: null,
    notebook: {
      lesson: workspace.lessons[0]!,
      cards: {
        SECRET: {
          path: 'cards/private/secret.card.yaml',
          stem: 'PRIVATE_STEM',
          choices: [],
        },
      },
      recentRecords: [{
        source: 'trace:trace-1',
        lessonId: 'l1',
        blockId: 'problem-1',
        assessment: 'correct',
        support: 'none',
        note: '公开课堂观察。',
      }],
      lessonSummary: null,
    },
  });

  expect(pages.map((page) => page.kind)).toEqual([
    'resident',
    'frozen',
    'current',
    'on-demand',
  ]);
  expect(JSON.stringify(pages)).toContain('课堂记录 l1 / problem-1');
  expect(JSON.stringify(pages)).not.toContain('cards/private/secret.card.yaml');
  expect(JSON.stringify(pages)).not.toContain('PRIVATE_STEM');
});

test('never lets a late HTTP submitted response overwrite an applied review', () => {
  const proposed = {
    id: 'review-1',
    planId: 'p1',
    status: 'proposed',
    items: [],
    decisions: [],
  } satisfies MemoryReviewSnapshot;
  const submitted = {
    ...proposed,
    status: 'submitted',
  } satisfies MemoryReviewSnapshot;
  const applied = {
    ...submitted,
    status: 'applied',
    receipt: {
      reviewId: 'review-1',
      appliedItems: [],
      unchangedItems: [],
      profilePaths: {
        student: 'memory/student-profile.md',
        teaching: 'memory/teaching-profile.md',
      },
    },
  } satisfies MemoryReviewSnapshot;

  expect(laterMemoryReview(proposed, submitted)).toEqual(submitted);
  expect(laterMemoryReview(applied, submitted)).toEqual(applied);
  expect(laterMemoryReview(submitted, applied)).toEqual(applied);
  expect(laterMemoryReview(applied, { ...proposed, id: 'review-2' })).toEqual({
    ...proposed,
    id: 'review-2',
  });
});
