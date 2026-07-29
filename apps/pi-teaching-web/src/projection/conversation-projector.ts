import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import {
  MEMORY_REVIEW_ENTRY,
  type MemoryReviewSnapshot,
} from '../memory-review/contracts';
import type {
  ActivityKind,
  ConversationItem,
  LessonReadyNotice,
  SessionKey,
} from '../shared/contracts';
import {
  projectStoredMessage,
  type MessageProjectionMode,
} from './message-policy';

function memoryReview(entry: SessionEntry): MemoryReviewSnapshot | null {
  if (
    entry.type !== 'custom'
    || entry.customType !== MEMORY_REVIEW_ENTRY
    || !entry.data
  ) {
    return null;
  }
  return entry.data as MemoryReviewSnapshot;
}

const activityKinds = new Set<ActivityKind>([
  'dialogue',
  'problem',
  'material',
  'reflection',
]);

export function lessonReadyNoticeFromToolResult(raw: unknown): LessonReadyNotice | null {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const message = raw as Record<string, unknown>;
  if (
    message.role !== 'toolResult'
    || message.toolName !== 'lesson_prepare'
    || message.isError !== false
  ) {
    return null;
  }
  const details = message.details;
  if (details === null || typeof details !== 'object' || Array.isArray(details)) return null;
  const detail = details as Record<string, unknown>;
  if (detail.kind !== 'lesson-prepare') return null;
  const value = detail.value;
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;
  const receipt = value as Record<string, unknown>;
  if (
    receipt.ok !== true
    || typeof receipt.factId !== 'string'
    || !receipt.factId
    || typeof receipt.lessonPath !== 'string'
    || !receipt.lessonPath
    || typeof receipt.blockCount !== 'number'
    || !Number.isInteger(receipt.blockCount)
    || receipt.blockCount < 0
    || !Array.isArray(receipt.blockKinds)
    || !receipt.blockKinds.every((kind) => (
      typeof kind === 'string' && activityKinds.has(kind as ActivityKind)
    ))
  ) {
    return null;
  }
  return {
    lessonId: receipt.factId,
    lessonPath: receipt.lessonPath,
    blockCount: receipt.blockCount,
    blockKinds: receipt.blockKinds as ActivityKind[],
  };
}

export function projectConversationEntries(
  key: SessionKey,
  entries: readonly SessionEntry[],
  mode: MessageProjectionMode,
): ConversationItem[] {
  const latest = new Map<string, MemoryReviewSnapshot>();
  for (const entry of entries) {
    const review = memoryReview(entry);
    if (review) latest.set(review.id, review);
  }

  const items: ConversationItem[] = [];
  const pending: string[] = [];
  const queued = new Set<string>();
  const pendingLessons: LessonReadyNotice[] = [];

  const flushReviews = () => {
    for (const reviewId of pending.splice(0)) {
      const review = latest.get(reviewId);
      if (review) items.push({ kind: 'memory-review', review });
    }
  };
  const flushLessons = () => {
    for (const lesson of pendingLessons.splice(0)) {
      items.push({ kind: 'lesson-ready', lesson });
    }
  };

  entries.forEach((entry, index) => {
    const review = memoryReview(entry);
    if (review?.status === 'proposed' && !queued.has(review.id)) {
      queued.add(review.id);
      pending.push(review.id);
      return;
    }

    if (entry.type !== 'message') return;
    if (mode === 'safe') {
      const lesson = lessonReadyNoticeFromToolResult(entry.message);
      if (lesson) {
        pendingLessons.push(lesson);
        return;
      }
    }
    const message = projectStoredMessage(key, entry.message, index, mode);
    if (!message) return;
    if (pendingLessons.length > 0) {
      if (message.role === 'coach') {
        flushLessons();
        if (pending.length > 0) flushReviews();
        return;
      }
      flushLessons();
    }
    items.push({ kind: 'message', message });
    if (message.role === 'coach' && pending.length > 0) flushReviews();
  });

  flushLessons();
  flushReviews();
  return items;
}
