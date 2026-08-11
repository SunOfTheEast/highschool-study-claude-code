import { expect, test } from 'bun:test';
import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type { StudySession } from '../../src/runtime/session-factory';
import {
  ensureFocusEndedMessage,
  ensureFocusStartedMessage,
  FOCUS_ENDED_MESSAGE_TYPE,
  FOCUS_STARTED_MESSAGE_TYPE,
} from '../../src/runtime/session-custom-messages';
import type { FocusCycleState, FocusEnded } from '../../src/time/focus-cycle';

function fakeSession(streaming = false) {
  const entries: SessionEntry[] = [];
  const calls: Array<{ customType: string; data: unknown; options: unknown }> = [];
  const session: StudySession = {
    sessionId: 'free-001',
    sessionFile: '/sessions/free-001.jsonl',
    messages: [],
    entries,
    isStreaming: streaming,
    prompt: async () => {},
    abort: async () => {},
    subscribe: () => () => {},
    sendCustomMessage: async (customType, data, options) => {
      calls.push({ customType, data, options });
      entries.push({
        type: 'custom_message',
        id: `${customType}-${entries.length + 1}`,
        parentId: entries.at(-1)?.id ?? null,
        timestamp: '2026-08-12T08:00:00.000Z',
        customType,
        content: 'public protocol',
        display: true,
        details: data,
      });
    },
    dispose: () => {},
  };
  return { session, calls, entries };
}

const started: FocusCycleState = {
  cycleId: 'cycle-001',
  sessionKey: 'free:free-001',
  sessionId: 'free-001',
  targetSeconds: 1500,
  startedAt: '2026-08-12T08:00:00.000Z',
  status: 'running',
  runningSince: '2026-08-12T08:00:00.000Z',
  accumulatedSeconds: 0,
};

const ended: FocusEnded = {
  cycleId: 'cycle-001',
  sessionKey: 'free:free-001',
  sessionId: 'free-001',
  targetSeconds: 1500,
  elapsedSeconds: 420,
  endedAt: '2026-08-12T08:07:00.000Z',
  reason: 'manual',
};

test('persists focus start once without triggering a model turn', async () => {
  const { session, calls } = fakeSession();
  expect(await ensureFocusStartedMessage(session, started)).toBe(true);
  expect(await ensureFocusStartedMessage(session, started)).toBe(false);
  expect(calls).toEqual([{
    customType: FOCUS_STARTED_MESSAGE_TYPE,
    data: expect.objectContaining({ cycleId: 'cycle-001', targetSeconds: 1500 }),
    options: { triggerTurn: false },
  }]);
});

test('uses a follow-up for an ordinary end while the teacher is replying', async () => {
  const { session, calls } = fakeSession(true);
  expect(await ensureFocusEndedMessage(session, ended, true)).toBe(true);
  expect(await ensureFocusEndedMessage(session, ended, true)).toBe(false);
  expect(calls).toEqual([{
    customType: FOCUS_ENDED_MESSAGE_TYPE,
    data: ended,
    options: { triggerTurn: true, deliverAs: 'followUp' },
  }]);
});

test('parent-session end is recorded without asking the teacher to reply', async () => {
  const { session, calls } = fakeSession();
  const parentEnded = { ...ended, reason: 'session-ended' as const };
  await ensureFocusEndedMessage(session, parentEnded, false);
  expect(calls[0]).toEqual({
    customType: FOCUS_ENDED_MESSAGE_TYPE,
    data: parentEnded,
    options: { triggerTurn: false },
  });
});
