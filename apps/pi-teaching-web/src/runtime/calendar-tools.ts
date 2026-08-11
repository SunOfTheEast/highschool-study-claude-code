import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import { resolve } from 'node:path';
import type { createCalendarRepository } from '../calendar/appointments';
import type {
  CalendarAppointment,
  CalendarDestination,
  LearningContextReference,
} from '../shared/contracts';
import {
  readLearningNote,
  readProblemCard,
} from '../study/learning-assets';
import { readMaterialLocator, readMaterialRevision } from '../study/materials';
import { readLesson, readPlan } from '../study/markdown';
import {
  isFreeLearningScope,
  isMetaScope,
  isNodeSessionScope,
  type FreeLearningSessionScope,
  type NodeSessionScope,
  type StudySessionScope,
} from './session-scope';

export type CalendarRepository = ReturnType<typeof createCalendarRepository>;

const id = Type.String({ pattern: '^[A-Za-z0-9][A-Za-z0-9._-]*$' });
const title = Type.String({ minLength: 1, pattern: '^[^\\r\\n\\u0000]+$' });
const absoluteTime = Type.String({
  pattern: '^\\d{4}-\\d{2}-\\d{2}T\\d{2}:\\d{2}(?::\\d{2}(?:\\.\\d{1,9})?)?(?:Z|[+-]\\d{2}:\\d{2})$',
  description: 'One absolute RFC 3339 start time after the student has seen it in local time.',
});
const plannedMinutes = Type.Union([
  Type.Integer({ minimum: 1 }),
  Type.Null(),
]);
const contextAliases = Type.Array(Type.String({ pattern: '^source-[1-9][0-9]*$' }), {
  uniqueItems: true,
});

const commonCreate = {
  title,
  startsAt: absoluteTime,
  plannedMinutes,
};

function localDate(iso: string): string {
  const date = new Date(iso);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function publicAppointment(appointment: CalendarAppointment) {
  return {
    id: appointment.id,
    revision: appointment.revision,
    title: appointment.title,
    startsAt: appointment.startsAt,
    plannedMinutes: appointment.plannedMinutes,
    destination: appointment.destination.kind === 'plan'
      ? { kind: 'plan' as const, planId: appointment.destination.planId }
      : {
        kind: 'free-learning' as const,
        intent: appointment.destination.intent,
        contexts: appointment.destination.contexts.map((context) => ({ ...context })),
      },
    route: `/calendar?appointment=${encodeURIComponent(appointment.id)}`,
  };
}

function result(value: Record<string, unknown>, command: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind: 'calendar' as const, command },
  };
}

function planDestination(
  root: string,
  scope: NodeSessionScope,
): Extract<CalendarDestination, { kind: 'plan' }> {
  if (scope.nodeKind === 'plan') {
    const plan = readPlan(root, scope.nodePath);
    if (plan.id !== scope.nodeId || plan.status === 'completed') {
      throw new Error('CALENDAR_PLAN_DESTINATION_INVALID');
    }
    return { kind: 'plan', planId: scope.nodeId };
  }
  if (scope.nodeKind !== 'lesson' || !scope.parentId || !scope.parentPath) {
    throw new Error('CALENDAR_SCOPE_INELIGIBLE');
  }
  const lesson = readLesson(root, scope.nodePath);
  const plan = readPlan(root, scope.parentPath);
  if (
    lesson.id !== scope.nodeId
    || lesson.parentId !== scope.parentId
    || lesson.parentPath !== scope.parentPath
    || plan.id !== scope.parentId
    || plan.status === 'completed'
  ) throw new Error('CALENDAR_PLAN_DESTINATION_INVALID');
  return { kind: 'plan', planId: scope.parentId };
}

function selectedContexts(
  root: string,
  scope: FreeLearningSessionScope,
  aliases: readonly string[],
): LearningContextReference[] {
  const seen = new Set<string>();
  return aliases.map((alias) => {
    if (!/^source-[1-9][0-9]*$/.test(alias)) {
      throw new Error(`CALENDAR_CONTEXT_ALIAS_INVALID: ${alias}`);
    }
    if (seen.has(alias)) throw new Error(`CALENDAR_CONTEXT_ALIAS_DUPLICATE: ${alias}`);
    seen.add(alias);
    const index = Number.parseInt(alias.slice('source-'.length), 10) - 1;
    const context = scope.selectedAssets[index];
    if (!context) throw new Error(`CALENDAR_CONTEXT_ALIAS_UNKNOWN: ${alias}`);
    if (context.kind === 'material') {
      if (context.locator === null) readMaterialRevision(root, context.id, context.revision);
      else readMaterialLocator(root, context);
    } else if (context.kind === 'note') readLearningNote(root, context.id);
    else readProblemCard(root, context.id);
    return { ...context };
  });
}

function ownsAppointment(
  root: string,
  scope: NodeSessionScope | FreeLearningSessionScope,
  appointment: CalendarAppointment,
): void {
  if (appointment.learningSetPath !== resolve(root)) throw new Error('CALENDAR_APPOINTMENT_OUT_OF_SCOPE');
  if (isFreeLearningScope(scope)) {
    if (appointment.destination.kind !== 'free-learning') {
      throw new Error('CALENDAR_APPOINTMENT_OUT_OF_SCOPE');
    }
    return;
  }
  const destination = planDestination(root, scope);
  if (
    appointment.destination.kind !== 'plan'
    || appointment.destination.planId !== destination.planId
  ) throw new Error('CALENDAR_APPOINTMENT_OUT_OF_SCOPE');
}

export function createCalendarTools(
  repository: CalendarRepository,
  root: string,
  scope: StudySessionScope,
) {
  if (isMetaScope(scope) || (isNodeSessionScope(scope) && scope.nodeKind === 'roadmap')) return [];
  const owner = scope as NodeSessionScope | FreeLearningSessionScope;
  const list = defineTool({
    name: 'calendar_list',
    label: '查看学习约定',
    description: 'List a bounded day of current-learning-set appointments before proposing a change. The receipt includes the current authoritative time and device time zone.',
    executionMode: 'sequential',
    parameters: Type.Object({
      date: Type.String({ pattern: '^\\d{4}-\\d{2}-\\d{2}$' }),
    }, { additionalProperties: false }),
    execute: async (_toolCallId, input) => result({
      ok: true,
      now: repository.now(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      appointments: repository.list()
        .filter((appointment) => (
          appointment.learningSetPath === resolve(root)
          && localDate(appointment.startsAt) === input.date
        ))
        .slice(0, 20)
        .map(publicAppointment),
    }, 'list'),
  });

  const free = isFreeLearningScope(owner);
  const create = defineTool({
    name: 'calendar_create',
    label: '保存学习约定',
    description: 'Persist one fully specified appointment only after the student has seen and naturally confirmed the full local date, weekday, time, optional duration, topic, and destination.',
    executionMode: 'sequential',
    parameters: free
      ? Type.Object({
        ...commonCreate,
        intent: Type.Union([Type.Literal('open'), Type.Literal('review')]),
        contextAliases,
      }, { additionalProperties: false })
      : Type.Object(commonCreate, { additionalProperties: false }),
    execute: async (_toolCallId, input) => {
      const freeInput = input as typeof input & {
        intent: 'open' | 'review';
        contextAliases: string[];
      };
      const appointment = repository.create({
        title: input.title,
        startsAt: input.startsAt,
        plannedMinutes: input.plannedMinutes,
        learningSetPath: root,
        destination: free
          ? {
            kind: 'free-learning',
            intent: freeInput.intent,
            contexts: selectedContexts(root, owner, freeInput.contextAliases),
          }
          : planDestination(root, owner),
      });
      return result({ ok: true, appointment: publicAppointment(appointment) }, 'create');
    },
  });

  const update = defineTool({
    name: 'calendar_update',
    label: '修改学习约定',
    description: 'Update one currently listed appointment only after the student has seen and naturally confirmed the complete replacement details. expectedRevision must come from calendar_list.',
    executionMode: 'sequential',
    parameters: free
      ? Type.Object({
        id,
        expectedRevision: Type.Integer({ minimum: 1 }),
        ...commonCreate,
        intent: Type.Optional(Type.Union([Type.Literal('open'), Type.Literal('review')])),
        contextAliases: Type.Optional(contextAliases),
      }, { additionalProperties: false })
      : Type.Object({
        id,
        expectedRevision: Type.Integer({ minimum: 1 }),
        ...commonCreate,
      }, { additionalProperties: false }),
    execute: async (_toolCallId, input) => {
      const freeInput = input as typeof input & {
        intent?: 'open' | 'review';
        contextAliases?: string[];
      };
      const before = repository.read(input.id);
      if (!before) throw new Error('CALENDAR_APPOINTMENT_NOT_FOUND');
      ownsAppointment(root, owner, before);
      let destination: CalendarDestination | undefined;
      if (free && (freeInput.intent !== undefined || freeInput.contextAliases !== undefined)) {
        if (before.destination.kind !== 'free-learning') {
          throw new Error('CALENDAR_APPOINTMENT_OUT_OF_SCOPE');
        }
        destination = {
          kind: 'free-learning',
          intent: freeInput.intent ?? before.destination.intent,
          contexts: freeInput.contextAliases === undefined
            ? before.destination.contexts
            : selectedContexts(root, owner, freeInput.contextAliases),
        };
      }
      const appointment = repository.update(input.id, input.expectedRevision, {
        title: input.title,
        startsAt: input.startsAt,
        plannedMinutes: input.plannedMinutes,
        ...(destination ? { destination } : {}),
      });
      return result({ ok: true, appointment: publicAppointment(appointment) }, 'update');
    },
  });

  const remove = defineTool({
    name: 'calendar_delete',
    label: '删除学习约定',
    description: 'Delete one currently listed appointment only after the student has naturally confirmed the deletion. expectedRevision must come from calendar_list.',
    executionMode: 'sequential',
    parameters: Type.Object({
      id,
      expectedRevision: Type.Integer({ minimum: 1 }),
    }, { additionalProperties: false }),
    execute: async (_toolCallId, input) => {
      const before = repository.read(input.id);
      if (!before) throw new Error('CALENDAR_APPOINTMENT_NOT_FOUND');
      ownsAppointment(root, owner, before);
      repository.remove(input.id, input.expectedRevision);
      return result({ ok: true, deleted: { id: input.id, revision: input.expectedRevision } }, 'delete');
    },
  });

  return [list, create, update, remove];
}
