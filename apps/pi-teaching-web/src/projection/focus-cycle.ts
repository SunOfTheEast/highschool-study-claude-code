import type { FocusConversationItem, SessionKey } from '../shared/contracts';
import {
  FOCUS_ENDED_MESSAGE_TYPE,
  FOCUS_STARTED_MESSAGE_TYPE,
} from '../runtime/session-custom-messages';

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function validTarget(value: unknown): value is 900 | 1500 | 2700 {
  return value === 900 || value === 1500 || value === 2700;
}

export function focusConversationItem(
  id: string,
  customType: unknown,
  details: unknown,
  at: string,
  expectedSessionKey?: SessionKey,
): FocusConversationItem | null {
  const event = record(details);
  if (!event || !validTarget(event.targetSeconds)) return null;
  if (expectedSessionKey !== undefined && event.sessionKey !== expectedSessionKey) return null;
  const targetMinutes = event.targetSeconds / 60;
  if (customType === FOCUS_STARTED_MESSAGE_TYPE) {
    return {
      id,
      kind: 'focus-marker',
      phase: 'started',
      text: `开始了 ${targetMinutes} 分钟计时`,
      at,
    };
  }
  if (customType !== FOCUS_ENDED_MESSAGE_TYPE) return null;
  if (!Number.isSafeInteger(event.elapsedSeconds) || Number(event.elapsedSeconds) < 0) return null;
  const reason = event.reason;
  const elapsedMinutes = Math.max(1, Math.round(Number(event.elapsedSeconds) / 60));
  const text = reason === 'elapsed'
    ? `${targetMinutes} 分钟计时已到`
    : reason === 'session-ended'
      ? '计时随本次学习结束'
      : `本次计时已结束 · 约 ${elapsedMinutes} 分钟`;
  return {
    id,
    kind: 'focus-marker',
    phase: 'ended',
    text,
    at,
  };
}
