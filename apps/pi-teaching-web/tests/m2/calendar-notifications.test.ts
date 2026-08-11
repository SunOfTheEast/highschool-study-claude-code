import { expect, test } from 'bun:test';
import {
  calendarNotificationRequests,
  notificationId,
  notificationLaunchIntent,
} from '../../src/client/calendar-navigation';
import type { CalendarAppointment } from '../../src/shared/contracts';

const appointment: CalendarAppointment = {
  id: 'appointment-001', revision: 4,
  createdAt: '2026-08-12T08:00:00.000Z', updatedAt: '2026-08-12T08:00:00.000Z',
  title: '继续当前阶段', startsAt: '2026-08-12T12:30:00.000Z', plannedMinutes: 60,
  learningSetPath: '/Users/student/Documents/StudyForge/导数学习集',
  destination: { kind: 'plan', planId: 'plan-001' }, opened: null,
};

test('derives deterministic advance and due notifications from current revisions', () => {
  expect(notificationId(appointment, 'advance'))
    .toBe('studyforge.calendar.appointment-001.4.advance');
  expect(notificationId(appointment, 'due'))
    .toBe('studyforge.calendar.appointment-001.4.due');

  expect(calendarNotificationRequests([appointment], Date.parse('2026-08-12T12:00:00.000Z')))
    .toEqual([
      expect.objectContaining({
        id: 'studyforge.calendar.appointment-001.4.advance',
        appointmentId: 'appointment-001', revision: 4,
        fireAtEpochMs: Date.parse('2026-08-12T12:20:00.000Z'),
      }),
      expect.objectContaining({
        id: 'studyforge.calendar.appointment-001.4.due',
        appointmentId: 'appointment-001', revision: 4,
        fireAtEpochMs: Date.parse('2026-08-12T12:30:00.000Z'),
      }),
    ]);
});

test('drops elapsed/opened requests and parses cold-click identifiers without hidden state', () => {
  expect(calendarNotificationRequests([
    { ...appointment, opened: { at: '2026-08-12T12:05:00.000Z', sessionKey: 'plan:plan-001' } },
  ], Date.parse('2026-08-12T12:00:00.000Z'))).toEqual([]);
  expect(calendarNotificationRequests([appointment], Date.parse('2026-08-12T12:25:00.000Z')))
    .toHaveLength(1);
  expect(notificationLaunchIntent('studyforge.calendar.appointment-001.4.due'))
    .toEqual({ appointmentId: 'appointment-001', revision: 4 });
  expect(notificationLaunchIntent('studyforge.calendar.appointment-001.3.due'))
    .toEqual({ appointmentId: 'appointment-001', revision: 3 });
  expect(notificationLaunchIntent('unrelated')).toBeNull();
  expect(JSON.stringify(appointment)).not.toMatch(/completed|missed/);
});
