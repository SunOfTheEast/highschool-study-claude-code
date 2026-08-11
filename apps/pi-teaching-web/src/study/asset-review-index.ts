import { existsSync, lstatSync, readFileSync } from 'node:fs';
import type { AssetReviewProjection, LearningAssetKind, ReviewResult } from '../shared/contracts';
import { resolveDocumentPath } from '../runtime/atomic-document';
import { commitDocumentCandidates } from '../runtime/multi-document-transaction';
import { StudyDocumentError } from './markdown';
import {
  ASSET_REVIEW_INDEX_PATH,
  canonicalAssetReviewIndex,
  listAssetReviewHistories,
} from './asset-reviews';

const datePattern = /^\d{4}-\d{2}-\d{2}$/;

export function parseAssetReviewIndex(source: string): AssetReviewProjection[] {
  const lines = source.trimEnd().split('\n');
  if (lines.shift() !== 'kind\tid\tactive\tstage\tdue_on\tlast_result') {
    throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'invalid index header');
  }
  return lines.filter(Boolean).map((line) => {
    const fields = line.split('\t');
    if (fields.length !== 6) throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'invalid index row');
    const [kind, id, activeText, stageText, dueText, resultText] = fields;
    if (kind !== 'note' && kind !== 'problem-card') {
      throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'invalid asset kind');
    }
    if (!id || !/^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u.test(id)) {
      throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'invalid asset id');
    }
    if (activeText !== 'true' && activeText !== 'false') {
      throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'invalid active flag');
    }
    const stage = Number(stageText);
    if (!Number.isInteger(stage) || stage < 0 || stage > 6) {
      throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'invalid review stage');
    }
    const dueOn = dueText === '-' ? null : dueText!;
    if (dueOn !== null && !datePattern.test(dueOn)) {
      throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'invalid due date');
    }
    const lastResult = resultText === '-' ? null : resultText as ReviewResult;
    if (lastResult !== null && !['forgot', 'effortful', 'fluent'].includes(lastResult)) {
      throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'invalid review result');
    }
    return {
      asset: { kind: kind as LearningAssetKind, id },
      active: activeText === 'true',
      stage: stage as AssetReviewProjection['stage'],
      dueOn,
      lastResult,
    };
  });
}

export function readAssetReviewIndex(root: string): AssetReviewProjection[] {
  const absolute = resolveDocumentPath(root, ASSET_REVIEW_INDEX_PATH);
  if (!existsSync(absolute)) throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'index does not exist');
  if (lstatSync(absolute).isSymbolicLink()) {
    throw new StudyDocumentError(ASSET_REVIEW_INDEX_PATH, 'index cannot be a symbolic link');
  }
  return parseAssetReviewIndex(readFileSync(absolute, 'utf8'));
}

export function ensureAssetReviewIndex(root: string): AssetReviewProjection[] {
  const projections = listAssetReviewHistories(root).flatMap((history) => (
    history.projection ? [history.projection] : []
  ));
  const after = canonicalAssetReviewIndex(projections);
  const absolute = resolveDocumentPath(root, ASSET_REVIEW_INDEX_PATH);
  const before = existsSync(absolute) ? readFileSync(absolute, 'utf8') : null;
  if (before !== after) {
    commitDocumentCandidates(root, [{
      path: ASSET_REVIEW_INDEX_PATH,
      before,
      after,
      validate: (source) => { parseAssetReviewIndex(source); },
    }]);
  }
  return projections;
}
