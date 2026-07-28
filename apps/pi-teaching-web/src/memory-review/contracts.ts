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

export type MemoryReviewSnapshot = {
  id: string;
  planId: string;
  status: 'proposed' | 'submitted';
  items: MemoryReviewItem[];
  decisions: MemoryReviewDecision[];
};
