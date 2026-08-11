import { afterEach, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  createCalendarRepository,
  type CalendarClock,
} from '../../src/calendar/appointments';

const roots: string[] = [];

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function fixedClock(): CalendarClock & { set(value: string): void } {
  let current = '2026-08-12T08:00:00.000Z';
  let nextId = 1;
  return {
    now: () => new Date(current),
    id: () => `appointment-${String(nextId++).padStart(3, '0')}`,
    set: (value) => { current = value; },
  };
}

test('atomically creates, revises, and deletes one app-global appointment', () => {
  const appHome = temporaryRoot('studyforge-calendar-app-');
  const learningSet = resolve(temporaryRoot('studyforge-calendar-set-'));
  const clock = fixedClock();
  const repository = createCalendarRepository(appHome, clock);

  const created = repository.create({
    title: '继续当前阶段',
    startsAt: '2026-08-13T12:00:00.000Z',
    plannedMinutes: null,
    learningSetPath: learningSet,
    destination: { kind: 'plan', planId: 'plan-001' },
  });
  expect(created).toMatchObject({
    id: 'appointment-001', revision: 1, createdAt: '2026-08-12T08:00:00.000Z',
    updatedAt: '2026-08-12T08:00:00.000Z', plannedMinutes: null,
    learningSetPath: learningSet, opened: null,
  });
  expect(repository.path).toBe(join(appHome, 'calendar/appointments.json'));
  expect(JSON.parse(readFileSync(repository.path, 'utf8'))).toEqual({
    version: 1,
    appointments: [created],
  });

  clock.set('2026-08-12T09:00:00.000Z');
  const updated = repository.update(created.id, 1, {
    title: '改到晚上继续',
    startsAt: '2026-08-13T13:00:00.000Z',
    plannedMinutes: 60,
  });
  expect(updated).toMatchObject({
    revision: 2, title: '改到晚上继续', plannedMinutes: 60,
    createdAt: created.createdAt, updatedAt: '2026-08-12T09:00:00.000Z',
  });
  expect(() => repository.update(created.id, 1, { title: '旧版本覆盖' }))
    .toThrow('CALENDAR_APPOINTMENT_STALE');
  expect(repository.read(created.id)?.title).toBe('改到晚上继续');

  const opened = repository.markOpened(created.id, 2, {
    at: '2026-08-12T09:05:00.000Z',
    sessionKey: 'plan:plan-001',
  });
  expect(opened.opened).toEqual({
    at: '2026-08-12T09:05:00.000Z',
    sessionKey: 'plan:plan-001',
  });
  expect(opened.revision).toBe(2);
  expect(repository.markOpened(created.id, 2, {
    at: '2026-08-12T09:06:00.000Z',
    sessionKey: 'plan:plan-001',
  })).toEqual(opened);

  const repaired = repository.repairOpened(
    created.id,
    2,
    'plan:plan-001',
    { at: '2026-08-12T09:07:00.000Z', sessionKey: 'plan:plan-002' },
  );
  expect(repaired.opened).toEqual({
    at: '2026-08-12T09:07:00.000Z',
    sessionKey: 'plan:plan-002',
  });
  expect(() => repository.repairOpened(
    created.id,
    2,
    'plan:plan-001',
    { at: '2026-08-12T09:08:00.000Z', sessionKey: 'plan:plan-003' },
  )).toThrow('CALENDAR_OPENED_RECEIPT_STALE');

  expect(() => repository.remove(created.id, 1)).toThrow('CALENDAR_APPOINTMENT_STALE');
  repository.remove(created.id, 2);
  expect(repository.read(created.id)).toBeNull();
  expect(JSON.parse(readFileSync(repository.path, 'utf8'))).toEqual({
    version: 1,
    appointments: [],
  });
  expect(readdirSync(join(appHome, 'calendar')).filter((name) => name.includes('.tmp'))).toEqual([]);
});

test('requires absolute one-off times and preserves both free-learning intents', () => {
  const appHome = temporaryRoot('studyforge-calendar-validation-');
  const repository = createCalendarRepository(appHome, fixedClock());
  const learningSet = resolve(temporaryRoot('studyforge-calendar-set-'));
  const base = {
    title: '复习两份资料',
    startsAt: '2026-08-13T12:00:00+08:00',
    plannedMinutes: 25,
    learningSetPath: learningSet,
  };

  const open = repository.create({
    ...base,
    destination: { kind: 'free-learning', intent: 'open', contexts: [] },
  });
  const review = repository.create({
    ...base,
    destination: {
      kind: 'free-learning',
      intent: 'review',
      contexts: [
        { kind: 'note', id: 'note-001' },
        { kind: 'material', id: 'book-001', revision: 2, locator: 'page-0003' },
      ],
    },
  });
  expect(open.destination).toEqual({ kind: 'free-learning', intent: 'open', contexts: [] });
  expect(review.destination).toMatchObject({ kind: 'free-learning', intent: 'review' });
  expect(JSON.stringify(repository.list())).not.toMatch(/completed|missed|master/);

  expect(() => repository.create({ ...base, learningSetPath: 'relative/set', destination: open.destination }))
    .toThrow('CALENDAR_LEARNING_SET_PATH_INVALID');
  expect(() => repository.create({ ...base, startsAt: '明天晚上八点', destination: open.destination }))
    .toThrow('CALENDAR_START_INVALID');
  expect(() => repository.create({ ...base, plannedMinutes: 0, destination: open.destination }))
    .toThrow('CALENDAR_PLANNED_MINUTES_INVALID');
  expect(existsSync(join(learningSet, 'calendar/appointments.json'))).toBeFalse();
});
