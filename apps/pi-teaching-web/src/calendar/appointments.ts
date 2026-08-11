import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import type {
  CalendarAppointment,
  CalendarDestination,
  CalendarOpenedReceipt,
  LearningContextReference,
  SessionKey,
} from '../shared/contracts';

export type CalendarClock = {
  now(): Date;
  id(): string;
};

export type CalendarAppointmentDraft = Pick<
  CalendarAppointment,
  'title' | 'startsAt' | 'plannedMinutes' | 'learningSetPath' | 'destination'
>;

export type CalendarAppointmentPatch = Partial<CalendarAppointmentDraft>;

type CalendarStore = {
  version: 1;
  appointments: CalendarAppointment[];
};

const systemClock: CalendarClock = {
  now: () => new Date(),
  id: () => randomUUID(),
};

const idPattern = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const absoluteTimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,9})?)?(?:Z|[+-]\d{2}:\d{2})$/;

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function checkedId(value: unknown, code: string): string {
  if (typeof value !== 'string' || !idPattern.test(value)) throw new Error(code);
  return value;
}

function checkedSessionKey(value: unknown): SessionKey {
  if (
    typeof value !== 'string'
    || !/^(?:(?:roadmap|plan):[A-Za-z0-9][A-Za-z0-9._-]*|lesson:[A-Za-z0-9][A-Za-z0-9._-]*:[A-Za-z0-9][A-Za-z0-9._-]*|(?:free|meta):[A-Za-z0-9][A-Za-z0-9._-]*)$/.test(value)
  ) throw new Error('CALENDAR_APPOINTMENT_INVALID');
  return value as SessionKey;
}

function checkedTime(value: unknown): string {
  if (
    typeof value !== 'string'
    || !absoluteTimePattern.test(value)
    || Number.isNaN(Date.parse(value))
  ) throw new Error('CALENDAR_START_INVALID');
  return new Date(value).toISOString();
}

function checkedCreatedTime(value: unknown, code: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new Error(code);
  return new Date(value).toISOString();
}

function checkedTitle(value: unknown): string {
  if (typeof value !== 'string' || !value.trim() || /[\r\n\0]/.test(value)) {
    throw new Error('CALENDAR_TITLE_INVALID');
  }
  return value.trim();
}

function checkedMinutes(value: unknown): number | null {
  if (value === null) return null;
  if (!Number.isSafeInteger(value) || Number(value) <= 0) {
    throw new Error('CALENDAR_PLANNED_MINUTES_INVALID');
  }
  return Number(value);
}

function checkedLearningSetPath(value: unknown): string {
  if (typeof value !== 'string' || !isAbsolute(value) || value.includes('\0')) {
    throw new Error('CALENDAR_LEARNING_SET_PATH_INVALID');
  }
  return resolve(value);
}

function checkedContext(value: unknown): LearningContextReference {
  const source = record(value);
  if (!source) throw new Error('CALENDAR_CONTEXT_INVALID');
  const id = checkedId(source.id, 'CALENDAR_CONTEXT_INVALID');
  if (source.kind === 'note' || source.kind === 'problem-card') {
    if (Object.keys(source).length !== 2) throw new Error('CALENDAR_CONTEXT_INVALID');
    return { kind: source.kind, id };
  }
  if (
    source.kind !== 'material'
    || !Number.isSafeInteger(source.revision)
    || Number(source.revision) < 1
    || (source.locator !== null && (
      typeof source.locator !== 'string'
      || !source.locator.trim()
      || /[\r\n\t\0]/.test(source.locator)
    ))
    || Object.keys(source).length !== 4
  ) throw new Error('CALENDAR_CONTEXT_INVALID');
  return {
    kind: 'material',
    id,
    revision: Number(source.revision),
    locator: source.locator as string | null,
  };
}

function checkedDestination(value: unknown): CalendarDestination {
  const destination = record(value);
  if (!destination) throw new Error('CALENDAR_DESTINATION_INVALID');
  if (destination.kind === 'plan') {
    if (Object.keys(destination).length !== 2) throw new Error('CALENDAR_DESTINATION_INVALID');
    return { kind: 'plan', planId: checkedId(destination.planId, 'CALENDAR_DESTINATION_INVALID') };
  }
  if (
    destination.kind !== 'free-learning'
    || (destination.intent !== 'open' && destination.intent !== 'review')
    || !Array.isArray(destination.contexts)
    || Object.keys(destination).length !== 3
  ) throw new Error('CALENDAR_DESTINATION_INVALID');
  const contexts = destination.contexts.map(checkedContext);
  const keys = contexts.map((context) => JSON.stringify(context));
  if (new Set(keys).size !== keys.length) throw new Error('CALENDAR_CONTEXT_DUPLICATE');
  return { kind: 'free-learning', intent: destination.intent, contexts };
}

function checkedAppointment(value: unknown): CalendarAppointment {
  const appointment = record(value);
  if (!appointment) throw new Error('CALENDAR_APPOINTMENT_INVALID');
  const opened = appointment.opened === null ? null : record(appointment.opened);
  if (
    !Number.isSafeInteger(appointment.revision)
    || Number(appointment.revision) < 1
    || (appointment.opened !== null && !opened)
  ) throw new Error('CALENDAR_APPOINTMENT_INVALID');
  return {
    id: checkedId(appointment.id, 'CALENDAR_APPOINTMENT_INVALID'),
    revision: Number(appointment.revision),
    createdAt: checkedCreatedTime(appointment.createdAt, 'CALENDAR_APPOINTMENT_INVALID'),
    updatedAt: checkedCreatedTime(appointment.updatedAt, 'CALENDAR_APPOINTMENT_INVALID'),
    title: checkedTitle(appointment.title),
    startsAt: checkedTime(appointment.startsAt),
    plannedMinutes: checkedMinutes(appointment.plannedMinutes),
    learningSetPath: checkedLearningSetPath(appointment.learningSetPath),
    destination: checkedDestination(appointment.destination),
    opened: opened ? {
      at: checkedCreatedTime(opened.at, 'CALENDAR_APPOINTMENT_INVALID'),
      sessionKey: checkedSessionKey(opened.sessionKey),
    } : null,
  };
}

function checkedDraft(value: CalendarAppointmentDraft): CalendarAppointmentDraft {
  return {
    title: checkedTitle(value.title),
    startsAt: checkedTime(value.startsAt),
    plannedMinutes: checkedMinutes(value.plannedMinutes),
    learningSetPath: checkedLearningSetPath(value.learningSetPath),
    destination: checkedDestination(value.destination),
  };
}

function writeStore(path: string, store: CalendarStore): void {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  try {
    writeFileSync(temporary, `${JSON.stringify(store, null, 2)}\n`, {
      encoding: 'utf8', flag: 'wx', mode: 0o600,
    });
    renameSync(temporary, path);
  } finally {
    if (existsSync(temporary)) rmSync(temporary);
  }
}

export function createCalendarRepository(appHome: string, clock: CalendarClock = systemClock) {
  const path = join(resolve(appHome), 'calendar/appointments.json');

  const store = (): CalendarStore => {
    if (!existsSync(path)) return { version: 1, appointments: [] };
    const value = record(JSON.parse(readFileSync(path, 'utf8')));
    if (!value || value.version !== 1 || !Array.isArray(value.appointments)) {
      throw new Error('CALENDAR_STORE_INVALID');
    }
    const appointments = value.appointments.map(checkedAppointment);
    if (new Set(appointments.map((item) => item.id)).size !== appointments.length) {
      throw new Error('CALENDAR_STORE_INVALID');
    }
    return { version: 1, appointments };
  };

  const persist = (appointments: CalendarAppointment[]) => {
    writeStore(path, { version: 1, appointments });
  };

  const read = (id: string): CalendarAppointment | null => (
    store().appointments.find((appointment) => appointment.id === id) ?? null
  );

  return {
    path,
    now(): string {
      return clock.now().toISOString();
    },
    list(): CalendarAppointment[] {
      return store().appointments.sort((left, right) => (
        left.startsAt.localeCompare(right.startsAt) || left.id.localeCompare(right.id)
      ));
    },
    read,
    create(input: CalendarAppointmentDraft): CalendarAppointment {
      const current = store();
      const draft = checkedDraft(input);
      const now = clock.now().toISOString();
      const id = checkedId(clock.id(), 'CALENDAR_APPOINTMENT_ID_INVALID');
      if (current.appointments.some((appointment) => appointment.id === id)) {
        throw new Error('CALENDAR_APPOINTMENT_ID_CONFLICT');
      }
      const appointment: CalendarAppointment = {
        id,
        revision: 1,
        createdAt: now,
        updatedAt: now,
        ...draft,
        opened: null,
      };
      persist([...current.appointments, appointment]);
      return appointment;
    },
    update(
      id: string,
      expectedRevision: number,
      patch: CalendarAppointmentPatch,
    ): CalendarAppointment {
      const current = store();
      const index = current.appointments.findIndex((appointment) => appointment.id === id);
      if (index < 0) throw new Error('CALENDAR_APPOINTMENT_NOT_FOUND');
      const before = current.appointments[index]!;
      if (before.revision !== expectedRevision) throw new Error('CALENDAR_APPOINTMENT_STALE');
      const draft = checkedDraft({
        title: patch.title ?? before.title,
        startsAt: patch.startsAt ?? before.startsAt,
        plannedMinutes: patch.plannedMinutes === undefined
          ? before.plannedMinutes
          : patch.plannedMinutes,
        learningSetPath: patch.learningSetPath ?? before.learningSetPath,
        destination: patch.destination ?? before.destination,
      });
      const appointment: CalendarAppointment = {
        ...before,
        ...draft,
        revision: before.revision + 1,
        updatedAt: clock.now().toISOString(),
        opened: null,
      };
      const appointments = [...current.appointments];
      appointments[index] = appointment;
      persist(appointments);
      return appointment;
    },
    markOpened(
      id: string,
      expectedRevision: number,
      receipt: CalendarOpenedReceipt,
    ): CalendarAppointment {
      const current = store();
      const index = current.appointments.findIndex((appointment) => appointment.id === id);
      if (index < 0) throw new Error('CALENDAR_APPOINTMENT_NOT_FOUND');
      const before = current.appointments[index]!;
      if (before.revision !== expectedRevision) throw new Error('CALENDAR_APPOINTMENT_STALE');
      if (before.opened) return before;
      const appointment: CalendarAppointment = {
        ...before,
        opened: {
          at: checkedCreatedTime(receipt.at, 'CALENDAR_OPENED_RECEIPT_INVALID'),
          sessionKey: checkedSessionKey(receipt.sessionKey),
        },
      };
      const appointments = [...current.appointments];
      appointments[index] = appointment;
      persist(appointments);
      return appointment;
    },
    remove(id: string, expectedRevision: number): CalendarAppointment {
      const current = store();
      const appointment = current.appointments.find((item) => item.id === id);
      if (!appointment) throw new Error('CALENDAR_APPOINTMENT_NOT_FOUND');
      if (appointment.revision !== expectedRevision) throw new Error('CALENDAR_APPOINTMENT_STALE');
      persist(current.appointments.filter((item) => item.id !== id));
      return appointment;
    },
  };
}
