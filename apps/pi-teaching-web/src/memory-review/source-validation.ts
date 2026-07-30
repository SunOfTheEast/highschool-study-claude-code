import { readFileSync } from 'node:fs';
import {
  readActiveTraces,
  readMarkdownFile,
  resolveInsideRoot,
  sourceResolve,
} from 'highschool-study-markdown/study-domain';
import { readPlanWorkspace } from '../study/read-workspace';
import type { MemoryReviewItem } from './contracts';
import { parseProfileDocument } from './profile-document';

function invalidSource(source: string): never {
  throw new Error(`MEMORY_REVIEW_SOURCE_INVALID: ${source}`);
}

function validateShape(item: MemoryReviewItem): void {
  if (item.operation === 'add') {
    if (item.currentText !== null || !item.proposedText?.trim()) {
      throw new Error('MEMORY_REVIEW_ADD_INVALID');
    }
  } else if (item.operation === 'revise') {
    if (!item.currentText?.trim() || !item.proposedText?.trim()) {
      throw new Error('MEMORY_REVIEW_REVISE_INVALID');
    }
  } else if (item.operation === 'delete') {
    if (!item.currentText?.trim() || item.proposedText !== null) {
      throw new Error('MEMORY_REVIEW_DELETE_INVALID');
    }
  } else {
    throw new Error('MEMORY_REVIEW_OPERATION_INVALID');
  }
  if (!['student', 'teaching'].includes(item.owner)) {
    throw new Error('MEMORY_REVIEW_OWNER_INVALID');
  }
}

function validateCurrentText(root: string, item: MemoryReviewItem): void {
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
  if (!entries.some((entry) => entry.content === item.currentText?.trim())) {
    throw new Error(`MEMORY_REVIEW_CURRENT_TEXT_MISMATCH: ${item.id}`);
  }
}

export function validateMemoryReviewItems(
  root: string,
  planId: string,
  ownerPath: string,
  items: MemoryReviewItem[],
): void {
  if (items.length === 0) throw new Error('MEMORY_REVIEW_ITEMS_REQUIRED');
  const workspace = readPlanWorkspace(root, planId);
  if (workspace.plan.path !== ownerPath) throw new Error('MEMORY_REVIEW_OWNER_MISMATCH');

  const ids = new Set<string>();
  const allowedPaths = new Set([
    ownerPath,
    ...workspace.lessons.map((lesson) => lesson.path),
  ]);
  const activeTraceSources = new Set<string>(
    readActiveTraces(root, workspace.lessons.map((lesson) => lesson.path))
      .map((trace) => trace.sourceRef),
  );

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

    if (item.sources.length === 0) throw new Error(`MEMORY_REVIEW_SOURCE_REQUIRED: ${id}`);
    for (const source of item.sources) {
      if (
        source !== source.trim()
        || !/^(?:plans|lessons)\/[A-Za-z0-9][A-Za-z0-9._/-]*\.md(?:#[A-Za-z0-9][A-Za-z0-9._=-]*)?$/
          .test(source)
      ) {
        invalidSource(source);
      }
      const [path, fragment] = source.split('#', 2);
      if (!path || !allowedPaths.has(path)) invalidSource(source);
      const resolved = sourceResolve(root, { fromPath: 'ROADMAP.md', target: source });
      if (!resolved.valid || resolved.path !== path) invalidSource(source);
      if (fragment?.startsWith('trace-') && !activeTraceSources.has(source)) {
        invalidSource(source);
      }
    }
    validateCurrentText(root, item);
  }

  const owner = readMarkdownFile(root, ownerPath);
  if (owner.id !== planId || owner.frontmatter.kind !== 'plan') {
    throw new Error('MEMORY_REVIEW_OWNER_MISMATCH');
  }
}
