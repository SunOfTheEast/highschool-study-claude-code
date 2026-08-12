import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { CalendarPage } from '../../src/client/pages/CalendarPage';
import { calendarActionErrorText } from '../../src/client/components/CalendarDayPanel';
import { formatBrowserRoute, parseBrowserRoute } from '../../src/client/routes';
import type { CalendarAppointment, SessionKey } from '../../src/shared/contracts';
import { createCalendarRepository } from '../../src/calendar/appointments';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';

const currentSet = '/Users/student/Documents/StudyForge/化学学习集';
const otherSet = '/Users/student/Documents/StudyForge/导数学习集';
const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function calendarFixture() {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-calendar-http-set-'));
  const appHome = mkdtempSync(join(tmpdir(), 'studyforge-calendar-http-app-'));
  cpSync(join(import.meta.dir, '../fixtures/m0-learning-set'), root, { recursive: true });
  roots.push(root, appHome);
  return {
    root,
    calendar: createCalendarRepository(appHome, {
      now: () => new Date('2026-08-12T08:00:00.000Z'),
      id: () => 'appointment-http-001',
    }),
  };
}

function fakeRegistry(opened: CalendarAppointment[]) {
  return {
    readHistory: async () => [], send: async () => {}, subscribe: async () => () => {},
    open: async () => ({}), abort: async () => {}, release: async () => {},
    createFreeLearning: async () => { throw new Error('not used'); },
    listFreeLearning: async () => [], endFreeLearning: async () => { throw new Error('not used'); },
    createMeta: async () => { throw new Error('not used'); }, listMeta: async () => [],
    listOwnedSessionFacts: async () => [], readFocus: async () => null,
    startFocus: async () => { throw new Error('not used'); }, pauseFocus: () => { throw new Error('not used'); },
    resumeFocus: () => { throw new Error('not used'); }, endFocus: async () => { throw new Error('not used'); },
    endFocusForSession: async () => null,
    openCalendarAppointment: async (appointment: CalendarAppointment) => {
      opened.push(appointment);
      return appointment.destination.kind === 'plan'
        ? `plan:${appointment.destination.planId}` as const
        : 'free:free-http-001' as const;
    },
  };
}

const appointments: CalendarAppointment[] = [
  {
    id: 'chem-plan', revision: 1,
    createdAt: '2026-08-12T08:00:00.000Z', updatedAt: '2026-08-12T08:00:00.000Z',
    title: '继续讨论溶度积', startsAt: '2026-08-14T12:00:00.000Z', plannedMinutes: 60,
    learningSetPath: currentSet,
    destination: { kind: 'plan', planId: 'plan-001' }, opened: null,
  },
  {
    id: 'math-review', revision: 3,
    createdAt: '2026-08-12T08:00:00.000Z', updatedAt: '2026-08-12T09:00:00.000Z',
    title: '再看参数分离', startsAt: '2026-08-14T13:30:00.000Z', plannedMinutes: 25,
    learningSetPath: otherSet,
    destination: {
      kind: 'free-learning', intent: 'review',
      contexts: [{ kind: 'problem-card', id: 'p0049' }],
    },
    opened: null,
  },
];

test('adds one calendar route without changing course routes', () => {
  expect(parseBrowserRoute('/calendar')).toEqual({ kind: 'calendar' });
  expect(formatBrowserRoute({ kind: 'calendar' })).toBe('/calendar');
  expect(formatBrowserRoute({ kind: 'course-plan', planId: 'plan-001' }))
    .toBe('/course/plan/plan-001');
});

test('turns calendar action failures into student-facing recovery copy', () => {
  const message = calendarActionErrorText(
    new Error('API_ERROR: ResolveMessage /private/tmp/calendar.jsonl'),
  );
  expect(message).toContain('暂时没有完成');
  expect(message).not.toMatch(/API_ERROR|ResolveMessage|private|jsonl/);
});

test('renders a month grid and one day panel with quiet cross-learning-set labels', () => {
  const markup = renderToStaticMarkup(
    <CalendarPage
      appointments={appointments}
      currentLearningSetPath={currentSet}
      reviewCandidates={[]}
      initialMonth="2026-08"
      initialDate="2026-08-14"
      onCreate={async () => {}}
      onUpdate={async () => {}}
      onDelete={async () => {}}
      onOpen={async () => {}}
    />,
  );

  expect(markup).toContain('2026 年 8 月');
  expect(markup).toContain('2026-08-14');
  expect(markup).toContain('继续讨论溶度积');
  expect(markup).toContain('导数学习集');
  expect(markup).toContain('现在开始');
  expect(markup).toContain('新建学习约定');
  expect(markup).not.toMatch(/completed|missed|已完成|缺席|掌握度/);
});

test('keeps Plan appointments on the Plan route and Free appointments on their opened session', async () => {
  const { routeForCalendarLaunch } = await import('../../src/client/calendar-navigation');
  expect(routeForCalendarLaunch(appointments[0]!, 'plan:plan-001'))
    .toEqual({ kind: 'course-plan', planId: 'plan-001' });
  expect(routeForCalendarLaunch(appointments[1]!, 'free:free-001'))
    .toEqual({ kind: 'free-learning', sessionId: 'free-001' });
  expect(() => routeForCalendarLaunch(appointments[0]!, 'lesson:plan-001:lesson-001'))
    .toThrow('CALENDAR_LAUNCH_SESSION_MISMATCH');
});

test('serves direct calendar CRUD and launches one appointment idempotently', async () => {
  const { root, calendar } = calendarFixture();
  const opened: CalendarAppointment[] = [];
  const handler = createRequestHandler({
    root,
    calendar,
    registry: fakeRegistry(opened) as never,
    hub: new EventHub(),
  });
  const createdResponse = await handler(new Request('http://local/api/calendar', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: '继续当前阶段', startsAt: '2026-08-13T12:00:00.000Z', plannedMinutes: 60,
      destination: { kind: 'plan', planId: 'plan-001' },
    }),
  }));
  expect(createdResponse?.status).toBe(201);
  const created = await createdResponse!.json() as { appointment: CalendarAppointment };
  expect(created.appointment.learningSetPath).toBe(root);

  const snapshot = await (await handler(new Request('http://local/api/calendar')))!.json() as any;
  expect(snapshot).toMatchObject({
    currentLearningSetPath: root,
    reviewCandidates: [],
    plans: [{ id: 'plan-001' }],
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await handler(new Request(
      `http://local/api/calendar/${created.appointment.id}/launch`,
      {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ expectedRevision: 1 }),
      },
    ));
    expect(await response!.json()).toMatchObject({
      route: '/course/plan/plan-001',
      sessionKey: 'plan:plan-001',
      appointment: { opened: { sessionKey: 'plan:plan-001' } },
    });
  }
  expect(opened).toHaveLength(1);

  const deleted = await handler(new Request(
    `http://local/api/calendar/${created.appointment.id}`,
    {
      method: 'DELETE', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 1 }),
    },
  ));
  expect(deleted?.status).toBe(200);
  expect(calendar.list()).toEqual([]);
});

test('repairs a calendar receipt whose untouched Free session never reached disk', async () => {
  const { root, calendar } = calendarFixture();
  const appointment = calendar.create({
    title: '复习旧笔记',
    startsAt: '2026-08-13T12:00:00.000Z',
    plannedMinutes: 25,
    learningSetPath: root,
    destination: { kind: 'free-learning', intent: 'review', contexts: [] },
  });
  calendar.markOpened(appointment.id, 1, {
    at: '2026-08-12T08:05:00.000Z',
    sessionKey: 'free:missing-session',
  });
  const opened: CalendarAppointment[] = [];
  const registry = {
    ...fakeRegistry(opened),
    readHistory: async (key: SessionKey) => {
      if (key === 'free:missing-session') {
        throw new Error('FREE_LEARNING_SESSION_NOT_FOUND: missing-session');
      }
      return [];
    },
    openCalendarAppointment: async (value: CalendarAppointment) => {
      opened.push(value);
      return 'free:replacement-session' as const;
    },
  };
  const handler = createRequestHandler({
    root,
    calendar,
    registry: registry as never,
    hub: new EventHub(),
  });

  const response = await handler(new Request(
    `http://local/api/calendar/${appointment.id}/launch`,
    {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 1 }),
    },
  ));

  expect(response?.status).toBe(200);
  expect(await response!.json()).toMatchObject({
    route: '/learn/replacement-session',
    sessionKey: 'free:replacement-session',
    appointment: { opened: { sessionKey: 'free:replacement-session' } },
  });
  expect(opened).toHaveLength(1);
  expect(calendar.read(appointment.id)?.opened?.sessionKey).toBe('free:replacement-session');
});

test('returns a stale calendar launch as a recoverable conflict', async () => {
  const { root, calendar } = calendarFixture();
  const handler = createRequestHandler({
    root,
    calendar,
    registry: fakeRegistry([]) as never,
    hub: new EventHub(),
  });
  const createdResponse = await handler(new Request('http://local/api/calendar', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: '复习旧笔记', startsAt: '2026-08-13T12:00:00.000Z', plannedMinutes: 25,
      destination: { kind: 'free-learning', intent: 'review', contexts: [] },
    }),
  }));
  const created = await createdResponse!.json() as { appointment: CalendarAppointment };

  const response = await handler(new Request(
    `http://local/api/calendar/${created.appointment.id}/launch`,
    {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ expectedRevision: 2 }),
    },
  ));

  expect(response?.status).toBe(409);
  expect(await response!.json()).toEqual({ error: 'CALENDAR_APPOINTMENT_STALE' });
  await Bun.sleep(0);
});
