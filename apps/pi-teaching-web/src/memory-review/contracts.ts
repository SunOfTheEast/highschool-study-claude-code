export const MEMORY_REVIEW_ENTRY = 'studyforge.memory-review.v1';

export type MemoryReviewItem = {
  id: string;
  operation: 'add' | 'revise' | 'delete';
  owner: 'student' | 'teaching';
  currentText: string | null;
  proposedText: string | null;
  sources: string[];
  rationale: string;
  counterEvidence: string;
  scope: string;
};

export type MemoryReviewDecision = {
  itemId: string;
  action: 'accept' | 'rewrite' | 'reject';
  text: string | null;
};

export type MemoryReviewApplyReceipt = {
  reviewId: string;
  appliedItems: string[];
  unchangedItems: string[];
  profilePaths: {
    student: 'memory/student-profile.md';
    teaching: 'memory/teaching-profile.md';
  };
};

type MemoryReviewSnapshotBase = {
  id: string;
  planId: string;
  items: MemoryReviewItem[];
  decisions: MemoryReviewDecision[];
};

export type MemoryReviewSnapshot =
  | (MemoryReviewSnapshotBase & { status: 'proposed' | 'submitted' })
  | (MemoryReviewSnapshotBase & {
    status: 'applied';
    receipt: MemoryReviewApplyReceipt;
  });
