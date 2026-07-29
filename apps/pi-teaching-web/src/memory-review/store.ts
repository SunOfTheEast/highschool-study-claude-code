import type {
  CustomEntry,
  SessionManager,
} from '@earendil-works/pi-coding-agent';
import {
  MEMORY_REVIEW_ENTRY,
  type MemoryReviewApplyReceipt,
  type MemoryReviewDecision,
  type MemoryReviewSnapshot,
} from './contracts';

export class MemoryReviewStore {
  constructor(private readonly manager: SessionManager) {}

  save(snapshot: MemoryReviewSnapshot): void {
    this.manager.appendCustomEntry(MEMORY_REVIEW_ENTRY, snapshot);
  }

  latest(): MemoryReviewSnapshot | null {
    const entries = this.manager.getBranch().filter(
      (entry): entry is CustomEntry<MemoryReviewSnapshot> => (
        entry.type === 'custom'
        && entry.customType === MEMORY_REVIEW_ENTRY
        && entry.data !== undefined
      ),
    );
    return entries.at(-1)?.data ?? null;
  }
}

export function appliedMemoryReview(
  current: MemoryReviewSnapshot | null,
  reviewId: string,
  receipt: MemoryReviewApplyReceipt,
): MemoryReviewSnapshot {
  if (!current || current.id !== reviewId) throw new Error('MEMORY_REVIEW_NOT_FOUND');
  if (current.status === 'applied') return current;
  if (current.status !== 'submitted') throw new Error('MEMORY_REVIEW_NOT_SUBMITTED');
  if (receipt.reviewId !== reviewId) throw new Error('MEMORY_REVIEW_RECEIPT_MISMATCH');
  return {
    ...current,
    status: 'applied',
    receipt,
  };
}

export function submittedMemoryReview(
  current: MemoryReviewSnapshot | null,
  reviewId: string,
  decisions: MemoryReviewDecision[],
): MemoryReviewSnapshot {
  if (!current || current.id !== reviewId) throw new Error('MEMORY_REVIEW_NOT_FOUND');
  if (current.status !== 'proposed') throw new Error('MEMORY_REVIEW_ALREADY_SUBMITTED');

  const expected = new Set(current.items.map((item) => item.id));
  const actual = new Set(decisions.map((decision) => decision.itemId));
  if (actual.size !== decisions.length) throw new Error('MEMORY_REVIEW_DECISION_DUPLICATE');
  if (
    actual.size !== expected.size
    || [...actual].some((id) => !expected.has(id))
  ) {
    throw new Error('MEMORY_REVIEW_DECISIONS_INCOMPLETE');
  }

  const normalized = decisions.map((decision) => {
    if (!['accept', 'rewrite', 'reject'].includes(decision.action)) {
      throw new Error(`MEMORY_REVIEW_DECISION_INVALID: ${decision.itemId}`);
    }
    if (decision.action === 'rewrite') {
      const text = decision.text?.trim();
      if (!text) throw new Error(`MEMORY_REVIEW_REWRITE_REQUIRED: ${decision.itemId}`);
      return { ...decision, text };
    }
    if (decision.text !== null) {
      throw new Error(`MEMORY_REVIEW_DECISION_TEXT_INVALID: ${decision.itemId}`);
    }
    return decision;
  });

  return {
    ...current,
    status: 'submitted',
    decisions: normalized,
  };
}
