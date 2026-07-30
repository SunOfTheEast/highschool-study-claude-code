import { readFileSync } from 'node:fs';
import {
  parseHandoff,
  parseSourceHandle,
  readMarkdownFile,
  resolveInsideRoot,
} from 'highschool-study-markdown/study-domain';
import type { NodeSessionScope, SessionEvidenceReader } from '../study/evidence-tree';
import { resolveEvidenceTree } from '../study/evidence-tree';
import type { MemoryReviewItem } from './contracts';
import { parseProfileDocument } from './profile-document';

function invalidSource(source: string): never {
  throw new Error(`MEMORY_REVIEW_SOURCE_INVALID: ${source}`);
}

function validateShape(item: MemoryReviewItem): void {
  if (item.operation === 'add') {
    if (
      item.currentId !== null
      || item.currentText !== null
      || !item.proposedText?.trim()
    ) {
      throw new Error('MEMORY_REVIEW_ADD_INVALID');
    }
  } else if (item.operation === 'revise') {
    if (
      !item.currentId?.trim()
      || !item.currentText?.trim()
      || !item.proposedText?.trim()
    ) {
      throw new Error('MEMORY_REVIEW_REVISE_INVALID');
    }
  } else if (item.operation === 'delete') {
    if (
      !item.currentId?.trim()
      || !item.currentText?.trim()
      || item.proposedText !== null
    ) {
      throw new Error('MEMORY_REVIEW_DELETE_INVALID');
    }
  } else {
    throw new Error('MEMORY_REVIEW_OPERATION_INVALID');
  }
  if (!['student', 'teaching'].includes(item.owner)) {
    throw new Error('MEMORY_REVIEW_OWNER_INVALID');
  }
  if (
    item.currentId !== null
    && !new RegExp(`^${item.owner === 'student' ? 'S' : 'T'}[1-9]\\d*$`)
      .test(item.currentId)
  ) {
    throw new Error(`MEMORY_REVIEW_CURRENT_ENTRY_MISMATCH: ${item.id}`);
  }
}

function validateCurrentEntry(root: string, item: MemoryReviewItem): void {
  const path = item.owner === 'student'
    ? 'memory/student-profile.md'
    : 'memory/teaching-profile.md';
  const source = readFileSync(resolveInsideRoot(root, path), 'utf8');
  const entries = parseProfileDocument(source, item.owner);
  if (item.operation === 'add') {
    if (entries.some((entry) => entry.content === item.proposedText?.trim())) {
      throw new Error(`MEMORY_REVIEW_CONTENT_DUPLICATE: ${item.id}`);
    }
    return;
  }
  const matches = entries.filter((entry) => (
    entry.id === item.currentId
    && entry.content === item.currentText?.trim()
  ));
  if (matches.length !== 1) {
    throw new Error(`MEMORY_REVIEW_CURRENT_ENTRY_MISMATCH: ${item.id}`);
  }
}

function planScope(
  planId: string,
  ownerPath: string,
  frontmatter: Record<string, unknown>,
): NodeSessionScope {
  const parentId = typeof frontmatter.parent_id === 'string'
    ? frontmatter.parent_id
    : null;
  const parentPath = typeof frontmatter.parent_path === 'string'
    ? frontmatter.parent_path
    : null;
  if (parentId === null || parentPath === null) {
    throw new Error('MEMORY_REVIEW_OWNER_MISMATCH');
  }
  return {
    nodeKind: 'plan',
    nodeId: planId,
    nodePath: ownerPath,
    parentId,
    parentPath,
  };
}

export function validateMemoryReviewItems(
  root: string,
  planId: string,
  ownerPath: string,
  items: MemoryReviewItem[],
  sessions: SessionEvidenceReader,
): void {
  if (items.length === 0) throw new Error('MEMORY_REVIEW_ITEMS_REQUIRED');
  const owner = readMarkdownFile(root, ownerPath);
  if (owner.id !== planId || owner.frontmatter.kind !== 'plan') {
    throw new Error('MEMORY_REVIEW_OWNER_MISMATCH');
  }
  if (owner.frontmatter.status !== 'completed') {
    throw new Error('MEMORY_REVIEW_PLAN_NOT_COMPLETED');
  }

  let handoff;
  try {
    handoff = parseHandoff(owner.body);
  } catch {
    throw new Error('MEMORY_REVIEW_PLAN_HANDOFF_REQUIRED');
  }
  const scope = planScope(planId, ownerPath, owner.frontmatter);
  if (
    handoff.mode !== 'claims'
    || handoff.identity.id !== `${planId}/handoff`
    || handoff.identity.from !== `plan:${planId}`
    || handoff.identity.to !== `roadmap:${scope.parentId}`
  ) {
    throw new Error('MEMORY_REVIEW_PLAN_HANDOFF_REQUIRED');
  }

  const ids = new Set<string>();
  for (const item of items) {
    const id = item.id.trim();
    if (!id) throw new Error('MEMORY_REVIEW_ITEM_ID_REQUIRED');
    if (ids.has(id)) throw new Error(`MEMORY_REVIEW_ITEM_ID_DUPLICATE: ${id}`);
    ids.add(id);
    validateShape(item);

    for (const [name, value] of [
      ['RATIONALE', item.rationale],
      ['COUNTER_EVIDENCE', item.counterEvidence],
      ['SCOPE', item.scope],
    ] as const) {
      if (!value.trim()) throw new Error(`MEMORY_REVIEW_${name}_REQUIRED: ${id}`);
    }

    if (
      item.sources.length === 0
      || new Set(item.sources).size !== item.sources.length
    ) {
      throw new Error(`MEMORY_REVIEW_SOURCE_REQUIRED: ${id}`);
    }
    for (const source of item.sources) {
      let handle;
      try {
        handle = parseSourceHandle(source);
      } catch {
        invalidSource(source);
      }
      if (
        handle.kind !== 'claim'
        || handle.handoffId !== handoff.identity.id
      ) {
        invalidSource(source);
      }
      const expectedKind = item.owner === 'student' ? 'learner' : 'teaching';
      if (handle.claimKind !== expectedKind) {
        throw new Error(`MEMORY_REVIEW_SOURCE_KIND_MISMATCH: ${source}`);
      }
      const claims = expectedKind === 'learner'
        ? handoff.learnerClaims
        : handoff.teachingClaims;
      if (!claims.some((claim) => claim.sourceRef === source)) {
        invalidSource(source);
      }
      const evidence = resolveEvidenceTree(root, source, scope, sessions);
      if (evidence.state !== 'active') {
        throw new Error(
          `MEMORY_REVIEW_SOURCE_${evidence.state.toUpperCase()}: ${source}`,
        );
      }
    }
    validateCurrentEntry(root, item);
  }
}
