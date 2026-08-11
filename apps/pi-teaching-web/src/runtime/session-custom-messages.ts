import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import type { StudySession } from './session-factory';
import type { FocusCycleState, FocusEnded } from '../time/focus-cycle';

export const FOCUS_STARTED_MESSAGE_TYPE = 'studyforge.m2.focus-started.v1';
export const FOCUS_ENDED_MESSAGE_TYPE = 'studyforge.m2.focus-ended.v1';
export const APPOINTMENT_OPENED_MESSAGE_TYPE = 'studyforge.m2.appointment-opened.v1';

export type AppointmentOpened = {
  appointmentId: string;
  appointmentRevision: number;
  scheduledAt: string;
  openedAt: string;
  plannedMinutes: number | null;
  title: string;
  intent: 'course' | 'open' | 'review';
};

function hasCycleMessage(
  entries: readonly SessionEntry[],
  customType: string,
  cycleId: string,
): boolean {
  return entries.some((entry) => {
    if (entry.type !== 'custom_message' || entry.customType !== customType) return false;
    const details = entry.details;
    return Boolean(details && typeof details === 'object'
      && !Array.isArray(details)
      && (details as { cycleId?: unknown }).cycleId === cycleId);
  });
}

export function sessionCustomMessageContent(customType: string, data: unknown): string {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('FOCUS_MESSAGE_DATA_INVALID');
  }
  const event = data as Record<string, unknown>;
  const targetMinutes = Number(event.targetSeconds) / 60;
  if (customType === FOCUS_STARTED_MESSAGE_TYPE) {
    return `专注计时已开始。目标 ${targetMinutes} 分钟，开始时间由 Runtime 记录。本事件不要求回复。`;
  }
  if (customType === FOCUS_ENDED_MESSAGE_TYPE) {
    const elapsedMinutes = Math.max(0, Math.round(Number(event.elapsedSeconds) / 60));
    return [
      `专注计时已经结束：目标 ${targetMinutes} 分钟，计时运行约 ${elapsedMinutes} 分钟。`,
      '这只是计时事实，不证明学生始终专注或已经完成目标。',
      '请先简短询问学生实际完成了什么、哪里卡住，等待回答后再讨论休息、继续或另开一轮；不要自动写记忆或结束课程。',
    ].join('\n');
  }
  if (customType === APPOINTMENT_OPENED_MESSAGE_TYPE) {
    const scheduled = new Date(String(event.scheduledAt));
    const opened = new Date(String(event.openedAt));
    if (Number.isNaN(scheduled.getTime()) || Number.isNaN(opened.getTime())) {
      throw new Error('APPOINTMENT_OPENED_MESSAGE_DATA_INVALID');
    }
    const duration = event.plannedMinutes === null
      ? '没有预先限定时长'
      : `原计划约 ${Number(event.plannedMinutes)} 分钟`;
    return [
      `学生从“${String(event.title)}”这条学习约定进入；原定时间为 ${scheduled.toLocaleString('zh-CN')}，实际打开时间为 ${opened.toLocaleString('zh-CN')}，${duration}。`,
      '这只表示学生打开了入口，不证明学习已经开始。本事件不要求回复。',
    ].join('\n');
  }
  throw new Error(`CUSTOM_MESSAGE_TYPE_UNSUPPORTED: ${customType}`);
}

export async function ensureAppointmentOpenedMessage(
  session: StudySession,
  event: AppointmentOpened,
): Promise<boolean> {
  const present = session.entries.some((entry) => {
    if (entry.type !== 'custom_message' || entry.customType !== APPOINTMENT_OPENED_MESSAGE_TYPE) {
      return false;
    }
    const details = entry.details;
    return Boolean(details && typeof details === 'object' && !Array.isArray(details)
      && (details as { appointmentId?: unknown }).appointmentId === event.appointmentId
      && (details as { appointmentRevision?: unknown }).appointmentRevision === event.appointmentRevision);
  });
  if (present) return false;
  await session.sendCustomMessage(APPOINTMENT_OPENED_MESSAGE_TYPE, event, { triggerTurn: false });
  return true;
}

export async function ensureFocusStartedMessage(
  session: StudySession,
  state: FocusCycleState,
): Promise<boolean> {
  if (hasCycleMessage(session.entries, FOCUS_STARTED_MESSAGE_TYPE, state.cycleId)) return false;
  await session.sendCustomMessage(FOCUS_STARTED_MESSAGE_TYPE, {
    cycleId: state.cycleId,
    sessionKey: state.sessionKey,
    sessionId: state.sessionId,
    targetSeconds: state.targetSeconds,
    startedAt: state.startedAt,
  }, { triggerTurn: false });
  return true;
}

export async function ensureFocusEndedMessage(
  session: StudySession,
  event: FocusEnded,
  triggerTurn: boolean,
): Promise<boolean> {
  if (hasCycleMessage(session.entries, FOCUS_ENDED_MESSAGE_TYPE, event.cycleId)) return false;
  await session.sendCustomMessage(FOCUS_ENDED_MESSAGE_TYPE, event, {
    triggerTurn,
    ...(triggerTurn && session.isStreaming ? { deliverAs: 'followUp' as const } : {}),
  });
  return true;
}

export function hasFocusStartedMessage(entries: readonly SessionEntry[], cycleId: string): boolean {
  return hasCycleMessage(entries, FOCUS_STARTED_MESSAGE_TYPE, cycleId);
}

export function hasFocusEndedMessage(entries: readonly SessionEntry[], cycleId: string): boolean {
  return hasCycleMessage(entries, FOCUS_ENDED_MESSAGE_TYPE, cycleId);
}
