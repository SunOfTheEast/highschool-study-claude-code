import type { SessionEntry } from '@earendil-works/pi-coding-agent';
import {
  MEMORY_REVIEW_ENTRY,
  type MemoryReviewSnapshot,
} from '../memory-review/contracts';
import type { ConversationItem, SessionKey } from '../shared/contracts';
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

  const flush = () => {
    for (const reviewId of pending.splice(0)) {
      const review = latest.get(reviewId);
      if (review) items.push({ kind: 'memory-review', review });
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
    const message = projectStoredMessage(key, entry.message, index, mode);
    if (!message) return;
    items.push({ kind: 'message', message });
    if (message.role === 'coach' && pending.length > 0) flush();
  });

  flush();
  return items;
}
