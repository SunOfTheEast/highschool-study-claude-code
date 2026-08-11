import type { BrowserRoute } from './routes';
import type { CalendarAppointment, SessionKey } from '../shared/contracts';

export type CalendarNotificationPhase = 'advance' | 'due';

export type CalendarNotificationRequest = {
  id: string;
  appointmentId: string;
  revision: number;
  fireAtEpochMs: number;
  title: string;
  body: string;
};

export type CalendarLaunchIntent = {
  appointmentId: string;
  revision: number;
};

export function notificationId(
  appointment: Pick<CalendarAppointment, 'id' | 'revision'>,
  phase: CalendarNotificationPhase,
): string {
  return `studyforge.calendar.${appointment.id}.${appointment.revision}.${phase}`;
}

export function notificationLaunchIntent(identifier: string): CalendarLaunchIntent | null {
  const match = /^studyforge\.calendar\.(.+)\.([1-9][0-9]*)\.(?:advance|due)$/.exec(identifier);
  if (!match) return null;
  return { appointmentId: match[1]!, revision: Number(match[2]) };
}

export function learningSetLabel(path: string): string {
  return path.replace(/[\\/]+$/, '').split(/[\\/]/).pop() || '学习集';
}

export function calendarNotificationRequests(
  appointments: readonly CalendarAppointment[],
  nowEpochMs = Date.now(),
): CalendarNotificationRequest[] {
  const requests: CalendarNotificationRequest[] = [];
  for (const appointment of appointments) {
    if (appointment.opened) continue;
    const due = Date.parse(appointment.startsAt);
    const copy = {
      appointmentId: appointment.id,
      revision: appointment.revision,
      title: 'StudyForge 学习提醒',
    };
    const advance = due - 10 * 60 * 1000;
    if (advance > nowEpochMs) {
      requests.push({
        ...copy,
        id: notificationId(appointment, 'advance'),
        fireAtEpochMs: advance,
        body: `还有 10 分钟：${appointment.title}`,
      });
    }
    if (due > nowEpochMs) {
      requests.push({
        ...copy,
        id: notificationId(appointment, 'due'),
        fireAtEpochMs: due,
        body: `约定时间到了：${appointment.title}`,
      });
    }
  }
  return requests;
}

export function routeForCalendarLaunch(
  appointment: Pick<CalendarAppointment, 'destination'>,
  sessionKey: SessionKey,
): BrowserRoute {
  if (appointment.destination.kind === 'plan') {
    const expected = `plan:${appointment.destination.planId}`;
    if (sessionKey !== expected) throw new Error('CALENDAR_LAUNCH_SESSION_MISMATCH');
    return { kind: 'course-plan', planId: appointment.destination.planId };
  }
  if (!sessionKey.startsWith('free:')) throw new Error('CALENDAR_LAUNCH_SESSION_MISMATCH');
  return { kind: 'free-learning', sessionId: sessionKey.slice('free:'.length) };
}
