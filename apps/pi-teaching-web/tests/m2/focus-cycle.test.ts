import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  createFocusCycleRepository,
  type FocusClock,
} from '../../src/time/focus-cycle';
import type { StudySession } from '../../src/runtime/session-factory';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import {
  FOCUS_ENDED_MESSAGE_TYPE,
  FOCUS_STARTED_MESSAGE_TYPE,
} from '../../src/runtime/session-custom-messages';

const roots: string[] = [];

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-focus-'));
  roots.push(root);
  let current = Date.parse('2026-08-12T08:00:00.000Z');
  const clock: FocusClock = {
    now: () => new Date(current),
    id: () => 'cycle-001',
  };
  return {
    root,
    clock,
    advance(seconds: number) { current += seconds * 1000; },
  };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('persists one authoritative cycle and derives running time from the clock', () => {
  const { root, clock, advance } = fixture();
  const repository = createFocusCycleRepository(root, clock);
  const state = repository.start('free:free-001', 'free-001', 1500);

  expect(state).toMatchObject({
    cycleId: 'cycle-001',
    sessionKey: 'free:free-001',
    sessionId: 'free-001',
    targetSeconds: 1500,
    status: 'running',
    accumulatedSeconds: 0,
  });
  advance(602);
  expect(repository.snapshot()).toMatchObject({
    status: 'running',
    elapsedSeconds: 602,
    remainingSeconds: 898,
    expired: false,
  });
  expect(() => repository.start('free:free-001', 'free-001', 900))
    .toThrow('FOCUS_CYCLE_ALREADY_ACTIVE');
  expect(readdirSync(join(root, '.studyforge/time')).filter((name) => name.endsWith('.tmp')))
    .toEqual([]);
});

test('supports only 15, 25, and 45 minutes', () => {
  for (const target of [900, 1500, 2700] as const) {
    const { root, clock } = fixture();
    expect(createFocusCycleRepository(root, clock)
      .start('free:free-001', 'free-001', target).targetSeconds).toBe(target);
  }
  const { root, clock } = fixture();
  expect(() => createFocusCycleRepository(root, clock)
    .start('free:free-001', 'free-001', 60 as 900)).toThrow('FOCUS_TARGET_INVALID');
});

test('pause excludes wall time, resume continues, and manual end removes only after commit', () => {
  const { root, clock, advance } = fixture();
  const repository = createFocusCycleRepository(root, clock);
  repository.start('lesson:plan-001:lesson-001', 'lesson-session-001', 1500);
  advance(300);
  expect(repository.pause()).toMatchObject({ status: 'paused', accumulatedSeconds: 300 });
  advance(1200);
  expect(repository.snapshot()).toMatchObject({ elapsedSeconds: 300, remainingSeconds: 1200 });
  repository.resume();
  advance(180);
  const ended = repository.terminal('manual');
  expect(ended).toMatchObject({ reason: 'manual', elapsedSeconds: 480 });
  expect(repository.read()).not.toBeNull();
  repository.remove(ended.cycleId);
  expect(repository.read()).toBeNull();
});

test('elapsed recovery clamps at the target and records the exact expiry instant', () => {
  const { root, clock, advance } = fixture();
  const repository = createFocusCycleRepository(root, clock);
  repository.start('free:free-001', 'free-001', 900);
  advance(1200);

  expect(repository.snapshot()).toMatchObject({
    elapsedSeconds: 900,
    remainingSeconds: 0,
    expired: true,
  });
  expect(repository.terminal('elapsed')).toMatchObject({
    elapsedSeconds: 900,
    endedAt: '2026-08-12T08:15:00.000Z',
    reason: 'elapsed',
  });
});

test('registry limits focus to active learning sessions and closes it with the parent session', async () => {
  const { root, clock } = fixture();
  cpSync(join(import.meta.dir, '../fixtures/m1b-blank-learning-set'), root, { recursive: true });
  const entries: StudySession['entries'][number][] = [];
  const session: StudySession = {
    sessionId: 'free-001',
    sessionFile: '/sessions/free-001.jsonl',
    messages: [],
    entries,
    isStreaming: false,
    prompt: async () => {},
    abort: async () => {},
    subscribe: () => () => {},
    sendCustomMessage: async (customType, data) => {
      entries.push({
        type: 'custom_message',
        id: `${customType}-${entries.length + 1}`,
        parentId: entries.at(-1)?.id ?? null,
        timestamp: clock.now().toISOString(),
        customType,
        content: 'focus event',
        display: true,
        details: data,
      });
    },
    appendCustomEntry: (customType, data) => entries.push({
      type: 'custom',
      id: `${customType}-${entries.length + 1}`,
      parentId: entries.at(-1)?.id ?? null,
      timestamp: clock.now().toISOString(),
      customType,
      data,
    }),
    dispose: () => {},
  };
  const focus = createFocusCycleRepository(root, clock);
  const registry = new WorkspaceRegistry(
    root,
    async () => session,
    undefined,
    undefined,
    async () => null,
    async () => [],
    undefined,
    undefined,
    undefined,
    focus,
  );
  const free = await registry.createFreeLearning([]);

  await expect(registry.startFocus('plan:plan-001', 900)).rejects.toThrow(
    'FOCUS_SESSION_INELIGIBLE',
  );
  await registry.startFocus(free.sessionKey, 900);
  expect(entries.filter((entry) => (
    entry.type === 'custom_message' && entry.customType === FOCUS_STARTED_MESSAGE_TYPE
  ))).toHaveLength(1);
  await registry.endFreeLearning(free.sessionKey);
  expect(focus.read()).toBeNull();
  const endedEntry = entries.find((entry) => (
    entry.type === 'custom_message' && entry.customType === FOCUS_ENDED_MESSAGE_TYPE
  ));
  expect(endedEntry?.type === 'custom_message' ? endedEntry.details : null)
    .toMatchObject({ reason: 'session-ended' });
});
