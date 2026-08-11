import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import type { SessionKey } from '../shared/contracts';

export const FOCUS_TARGET_SECONDS = [900, 1500, 2700] as const;
export type FocusTargetSeconds = typeof FOCUS_TARGET_SECONDS[number];

export type FocusCycleState = {
  cycleId: string;
  sessionKey: SessionKey;
  sessionId: string;
  targetSeconds: FocusTargetSeconds;
  startedAt: string;
  status: 'running' | 'paused';
  runningSince: string | null;
  accumulatedSeconds: number;
};

export type FocusCycleSnapshot = FocusCycleState & {
  elapsedSeconds: number;
  remainingSeconds: number;
  expiresAt: string | null;
  expired: boolean;
};

export type FocusEnded = {
  cycleId: string;
  sessionKey: SessionKey;
  sessionId: string;
  targetSeconds: FocusTargetSeconds;
  elapsedSeconds: number;
  endedAt: string;
  reason: 'elapsed' | 'manual' | 'session-ended';
};

export type FocusClock = {
  now(): Date;
  id(): string;
};

export type FocusCycleRepository = ReturnType<typeof createFocusCycleRepository>;

const systemClock: FocusClock = {
  now: () => new Date(),
  id: () => randomUUID(),
};

function statePath(root: string): string {
  return join(root, '.studyforge/time/focus.json');
}

function iso(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function validSessionKey(value: unknown): value is SessionKey {
  return typeof value === 'string' && (
    /^free:[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
    || /^lesson:[A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*$/.test(value)
  );
}

function parseState(value: unknown): FocusCycleState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('FOCUS_STATE_INVALID');
  }
  const state = value as Record<string, unknown>;
  if (
    typeof state.cycleId !== 'string'
    || !state.cycleId
    || !validSessionKey(state.sessionKey)
    || typeof state.sessionId !== 'string'
    || !state.sessionId
    || !FOCUS_TARGET_SECONDS.includes(state.targetSeconds as FocusTargetSeconds)
    || !iso(state.startedAt)
    || (state.status !== 'running' && state.status !== 'paused')
    || (state.runningSince !== null && !iso(state.runningSince))
    || !Number.isSafeInteger(state.accumulatedSeconds)
    || Number(state.accumulatedSeconds) < 0
    || (state.status === 'running') !== (state.runningSince !== null)
  ) throw new Error('FOCUS_STATE_INVALID');
  return {
    cycleId: state.cycleId,
    sessionKey: state.sessionKey,
    sessionId: state.sessionId,
    targetSeconds: state.targetSeconds as FocusTargetSeconds,
    startedAt: state.startedAt,
    status: state.status,
    runningSince: state.runningSince,
    accumulatedSeconds: Number(state.accumulatedSeconds),
  };
}

function elapsedAt(state: FocusCycleState, now: Date): number {
  const running = state.runningSince === null
    ? 0
    : Math.max(0, Math.floor((now.getTime() - Date.parse(state.runningSince)) / 1000));
  return Math.min(state.targetSeconds, state.accumulatedSeconds + running);
}

function expiry(state: FocusCycleState): string | null {
  if (state.runningSince === null) return null;
  return new Date(
    Date.parse(state.runningSince)
      + Math.max(0, state.targetSeconds - state.accumulatedSeconds) * 1000,
  ).toISOString();
}

function writeState(path: string, state: FocusCycleState): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      flag: 'wx',
      mode: 0o600,
    });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
}

export function createFocusCycleRepository(root: string, clock: FocusClock = systemClock) {
  const path = statePath(root);

  const read = (): FocusCycleState | null => {
    if (!existsSync(path)) return null;
    return parseState(JSON.parse(readFileSync(path, 'utf8')));
  };

  const persist = (state: FocusCycleState): FocusCycleState => {
    writeState(path, state);
    return state;
  };

  return {
    path,
    read,
    start(
      sessionKey: SessionKey,
      sessionId: string,
      targetSeconds: FocusTargetSeconds,
    ): FocusCycleState {
      if (read()) throw new Error('FOCUS_CYCLE_ALREADY_ACTIVE');
      if (!validSessionKey(sessionKey)) throw new Error('FOCUS_SESSION_INELIGIBLE');
      if (!FOCUS_TARGET_SECONDS.includes(targetSeconds)) throw new Error('FOCUS_TARGET_INVALID');
      const now = clock.now().toISOString();
      return persist({
        cycleId: clock.id(),
        sessionKey,
        sessionId,
        targetSeconds,
        startedAt: now,
        status: 'running',
        runningSince: now,
        accumulatedSeconds: 0,
      });
    },
    snapshot(): FocusCycleSnapshot | null {
      const state = read();
      if (!state) return null;
      const elapsedSeconds = elapsedAt(state, clock.now());
      return {
        ...state,
        elapsedSeconds,
        remainingSeconds: Math.max(0, state.targetSeconds - elapsedSeconds),
        expiresAt: expiry(state),
        expired: state.status === 'running' && elapsedSeconds >= state.targetSeconds,
      };
    },
    pause(): FocusCycleState {
      const state = read();
      if (!state) throw new Error('FOCUS_CYCLE_NOT_ACTIVE');
      if (state.status !== 'running') throw new Error('FOCUS_CYCLE_NOT_RUNNING');
      const accumulatedSeconds = elapsedAt(state, clock.now());
      if (accumulatedSeconds >= state.targetSeconds) throw new Error('FOCUS_CYCLE_ELAPSED');
      return persist({
        ...state,
        status: 'paused',
        runningSince: null,
        accumulatedSeconds,
      });
    },
    resume(): FocusCycleState {
      const state = read();
      if (!state) throw new Error('FOCUS_CYCLE_NOT_ACTIVE');
      if (state.status !== 'paused') throw new Error('FOCUS_CYCLE_NOT_PAUSED');
      return persist({
        ...state,
        status: 'running',
        runningSince: clock.now().toISOString(),
      });
    },
    terminal(reason: FocusEnded['reason']): FocusEnded {
      const state = read();
      if (!state) throw new Error('FOCUS_CYCLE_NOT_ACTIVE');
      const now = clock.now();
      const elapsedSeconds = reason === 'elapsed'
        ? state.targetSeconds
        : elapsedAt(state, now);
      const endedAt = reason === 'elapsed'
        ? expiry(state)
        : now.toISOString();
      if (!endedAt || (reason === 'elapsed' && elapsedAt(state, now) < state.targetSeconds)) {
        throw new Error('FOCUS_CYCLE_NOT_ELAPSED');
      }
      return {
        cycleId: state.cycleId,
        sessionKey: state.sessionKey,
        sessionId: state.sessionId,
        targetSeconds: state.targetSeconds,
        elapsedSeconds,
        endedAt,
        reason,
      };
    },
    remove(cycleId: string): void {
      const state = read();
      if (!state) return;
      if (state.cycleId !== cycleId) throw new Error('FOCUS_CYCLE_ID_MISMATCH');
      rmSync(path);
    },
  };
}
