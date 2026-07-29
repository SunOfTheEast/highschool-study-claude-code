import { defineTool } from '@earendil-works/pi-coding-agent';
import {
  existsSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join } from 'node:path';
import {
  readMarkdownFile,
  resolveInsideRoot,
} from 'highschool-study-markdown/study-domain';
import { Type } from 'typebox';
import type {
  MemoryReviewApplyReceipt,
  MemoryReviewDecision,
  MemoryReviewItem,
} from './contracts';
import {
  parseProfileDocument,
  renderProfileDocument,
  type ProfileEntry,
  type ProfileOwner,
} from './profile-document';
import {
  appliedMemoryReview,
  type MemoryReviewStore,
} from './store';

export type ProfileFileOps = {
  read(path: string): string;
  write(path: string, source: string): void;
  rename(from: string, to: string): void;
  remove(path: string): void;
  exists(path: string): boolean;
};

const nodeFileOps: ProfileFileOps = {
  read: (path) => readFileSync(path, 'utf8'),
  write: (path, source) => writeFileSync(path, source),
  rename: renameSync,
  remove: (path) => rmSync(path, { force: true }),
  exists: existsSync,
};

const profilePaths = {
  student: 'memory/student-profile.md',
  teaching: 'memory/teaching-profile.md',
} as const;

function reviewDecisionMap(
  items: MemoryReviewItem[],
  decisions: MemoryReviewDecision[],
): Map<string, MemoryReviewDecision> {
  const expected = new Set(items.map((item) => item.id));
  const result = new Map<string, MemoryReviewDecision>();
  for (const decision of decisions) {
    if (
      result.has(decision.itemId)
      || !expected.has(decision.itemId)
      || !['accept', 'rewrite', 'reject'].includes(decision.action)
    ) {
      throw new Error('MEMORY_REVIEW_DECISIONS_INVALID');
    }
    if (decision.action === 'rewrite') {
      if (!decision.text?.trim()) throw new Error('MEMORY_REVIEW_REWRITE_REQUIRED');
    } else if (decision.text !== null) {
      throw new Error('MEMORY_REVIEW_DECISION_TEXT_INVALID');
    }
    result.set(decision.itemId, decision);
  }
  if (result.size !== items.length) throw new Error('MEMORY_REVIEW_DECISIONS_INCOMPLETE');
  return result;
}

function nextId(owner: ProfileOwner, entries: ProfileEntry[]): () => string {
  const prefix = owner === 'student' ? 'S' : 'T';
  let value = Math.max(
    0,
    ...entries.map((entry) => Number(entry.id.slice(1))),
  );
  return () => `${prefix}${value += 1}`;
}

function replacementEntry(
  id: string,
  content: string,
  item: MemoryReviewItem,
): ProfileEntry {
  return {
    id,
    content: content.trim(),
    scope: item.scope.trim(),
    sources: item.sources,
    rationale: item.rationale.trim(),
    counterEvidence: item.counterEvidence.trim(),
  };
}

function exactCurrent(entries: ProfileEntry[], item: MemoryReviewItem): number {
  const indexes = entries.flatMap((entry, index) => (
    entry.content === item.currentText?.trim() ? [index] : []
  ));
  if (indexes.length !== 1) {
    throw new Error(`MEMORY_REVIEW_CURRENT_TEXT_MISMATCH: ${item.id}`);
  }
  return indexes[0]!;
}

function applyItems(
  current: Record<ProfileOwner, ProfileEntry[]>,
  items: MemoryReviewItem[],
  decisions: MemoryReviewDecision[],
): {
  entries: Record<ProfileOwner, ProfileEntry[]>;
  appliedItems: string[];
  unchangedItems: string[];
} {
  const entries = {
    student: current.student.map((entry) => ({ ...entry, sources: [...entry.sources] })),
    teaching: current.teaching.map((entry) => ({ ...entry, sources: [...entry.sources] })),
  };
  const allocate = {
    student: nextId('student', entries.student),
    teaching: nextId('teaching', entries.teaching),
  };
  const decisionById = reviewDecisionMap(items, decisions);
  const appliedItems: string[] = [];
  const unchangedItems: string[] = [];

  for (const item of items) {
    const decision = decisionById.get(item.id)!;
    if (decision.action === 'reject') {
      unchangedItems.push(item.id);
      continue;
    }
    const ownerEntries = entries[item.owner];
    const content = decision.action === 'rewrite'
      ? decision.text!.trim()
      : item.proposedText?.trim() ?? '';

    if (item.operation === 'add') {
      if (!content) throw new Error(`MEMORY_REVIEW_ADD_INVALID: ${item.id}`);
      if (ownerEntries.some((entry) => entry.content === content)) {
        throw new Error(`MEMORY_REVIEW_CONTENT_DUPLICATE: ${item.id}`);
      }
      ownerEntries.push(replacementEntry(allocate[item.owner](), content, item));
    } else {
      const index = exactCurrent(ownerEntries, item);
      if (item.operation === 'delete' && decision.action === 'accept') {
        ownerEntries.splice(index, 1);
      } else {
        if (!content) throw new Error(`MEMORY_REVIEW_REPLACEMENT_INVALID: ${item.id}`);
        ownerEntries[index] = replacementEntry(ownerEntries[index]!.id, content, item);
      }
    }
    appliedItems.push(item.id);
  }
  return { entries, appliedItems, unchangedItems };
}

function pathsFor(target: string, reviewId: string): { temp: string; backup: string } {
  const stem = `.${basename(target)}.${reviewId}`;
  return {
    temp: join(dirname(target), `${stem}.tmp`),
    backup: join(dirname(target), `${stem}.bak`),
  };
}

function cleanup(fileOps: ProfileFileOps, paths: string[]): void {
  for (const path of paths) {
    try {
      if (fileOps.exists(path)) fileOps.remove(path);
    } catch {
      // Cleanup cannot replace the original operation error.
    }
  }
}

function installProfiles(
  fileOps: ProfileFileOps,
  targets: Record<ProfileOwner, string>,
  originals: Record<ProfileOwner, string>,
  rendered: Record<ProfileOwner, string>,
  reviewId: string,
): void {
  const staged = {
    student: pathsFor(targets.student, reviewId),
    teaching: pathsFor(targets.teaching, reviewId),
  };
  const cleanupPaths = [
    staged.student.temp,
    staged.student.backup,
    staged.teaching.temp,
    staged.teaching.backup,
  ];
  cleanup(fileOps, cleanupPaths);
  try {
    fileOps.write(staged.student.temp, rendered.student);
    fileOps.write(staged.teaching.temp, rendered.teaching);
    fileOps.rename(targets.student, staged.student.backup);
    fileOps.rename(targets.teaching, staged.teaching.backup);
    fileOps.rename(staged.student.temp, targets.student);
    fileOps.rename(staged.teaching.temp, targets.teaching);
    fileOps.remove(staged.student.backup);
    fileOps.remove(staged.teaching.backup);
  } catch (error) {
    for (const owner of ['student', 'teaching'] as const) {
      try {
        if (fileOps.exists(targets[owner])) fileOps.remove(targets[owner]);
        if (fileOps.exists(staged[owner].backup)) {
          fileOps.rename(staged[owner].backup, targets[owner]);
        } else {
          fileOps.write(targets[owner], originals[owner]);
        }
      } catch {
        try {
          fileOps.write(targets[owner], originals[owner]);
        } catch {
          // The original installation error remains the reported failure.
        }
      }
    }
    cleanup(fileOps, cleanupPaths);
    throw error;
  }
}

function toolReceipt(receipt: MemoryReviewApplyReceipt) {
  return {
    ok: true as const,
    reviewId: receipt.reviewId,
    appliedItems: receipt.appliedItems,
    unchangedItems: receipt.unchangedItems,
    profilePaths: receipt.profilePaths,
  };
}

export function createMemoryReviewApplyTool(
  root: string,
  planId: string,
  ownerPath: string,
  store: MemoryReviewStore,
  fileOps: ProfileFileOps = nodeFileOps,
) {
  return defineTool({
    name: 'memory_review_apply',
    label: '写入已确认长期画像',
    description: 'Atomically apply the latest submitted memory review for this Session-owned completed Plan. IDs and both profile files are runtime-owned; pass only the review ID returned by the confirmed review.',
    parameters: Type.Object({
      reviewId: Type.String({ minLength: 1 }),
    }, { additionalProperties: false }),
    execute: async (_toolCallId, input) => {
      const plan = readMarkdownFile(root, ownerPath);
      if (
        plan.id !== planId
        || plan.frontmatter.kind !== 'plan'
        || plan.frontmatter.status !== 'completed'
      ) {
        throw new Error('MEMORY_REVIEW_OWNER_MISMATCH');
      }
      const latest = store.latest();
      if (!latest || latest.id !== input.reviewId) {
        throw new Error('MEMORY_REVIEW_NOT_FOUND');
      }
      if (latest.status === 'applied') {
        const value = toolReceipt(latest.receipt);
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(value) }],
          details: { kind: 'memory-review-apply', value },
        };
      }
      if (latest.status !== 'submitted') throw new Error('MEMORY_REVIEW_NOT_SUBMITTED');
      if (latest.planId !== planId) throw new Error('MEMORY_REVIEW_OWNER_MISMATCH');

      const targets = {
        student: resolveInsideRoot(root, profilePaths.student),
        teaching: resolveInsideRoot(root, profilePaths.teaching),
      };
      const originals = {
        student: fileOps.read(targets.student),
        teaching: fileOps.read(targets.teaching),
      };
      const current = {
        student: parseProfileDocument(originals.student, 'student'),
        teaching: parseProfileDocument(originals.teaching, 'teaching'),
      };
      const applied = applyItems(current, latest.items, latest.decisions);
      const rendered = {
        student: renderProfileDocument(originals.student, 'student', applied.entries.student),
        teaching: renderProfileDocument(originals.teaching, 'teaching', applied.entries.teaching),
      };
      parseProfileDocument(rendered.student, 'student');
      parseProfileDocument(rendered.teaching, 'teaching');
      installProfiles(fileOps, targets, originals, rendered, latest.id);

      const receipt: MemoryReviewApplyReceipt = {
        reviewId: latest.id,
        appliedItems: applied.appliedItems,
        unchangedItems: applied.unchangedItems,
        profilePaths,
      };
      const snapshot = appliedMemoryReview(latest, latest.id, receipt);
      try {
        store.save(snapshot);
      } catch (error) {
        fileOps.write(targets.student, originals.student);
        fileOps.write(targets.teaching, originals.teaching);
        throw error;
      }
      const value = toolReceipt(receipt);
      return {
        content: [{ type: 'text' as const, text: JSON.stringify(value) }],
        details: { kind: 'memory-review-apply', value },
      };
    },
  });
}
