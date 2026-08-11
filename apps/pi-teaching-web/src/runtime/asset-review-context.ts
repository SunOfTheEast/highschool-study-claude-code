import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type {
  AssetReviewProjection,
  LearningAssetHandle,
  LearningContextReference,
  ReviewResult,
} from '../shared/contracts';
import { readAssetReviewIndex } from '../study/asset-review-index';
import { readAssetReviewHistory } from '../study/asset-reviews';
import {
  readLearningNote,
  readProblemCard,
} from '../study/learning-assets';
import { readSemanticTags, semanticTagsPath } from '../study/semantic-tags';
import type { FreeLearningSessionScope } from './session-scope';

export type AssetReviewBinding = {
  alias: string;
  asset: LearningAssetHandle;
};

export type AssetReviewCandidateSummary = {
  alias: string;
  kind: LearningAssetHandle['kind'];
  id: string;
  title: string;
  tags: string[];
  path: string;
  dueOn: string;
  stage: AssetReviewProjection['stage'];
  lastResult: ReviewResult | null;
};

type RecallRow = {
  path: string;
  title: string;
  tags: string[];
};

function handleKey(asset: LearningAssetHandle): string {
  return `${asset.kind}:${asset.id}`;
}

function oneLine(value: string): string {
  return value.replace(/\s*\n\s*/g, ' ').trim().slice(0, 160);
}

function recallRows(root: string): Map<string, RecallRow> {
  const path = join(root, 'semantics/indexes/asset-recall.tsv');
  if (!existsSync(path)) return new Map();
  const lines = readFileSync(path, 'utf8').trimEnd().split('\n');
  if (lines.shift() !== 'path\tkind\tid\tcore\trelated\ttitle_or_stem') return new Map();
  const rows = new Map<string, RecallRow>();
  for (const line of lines) {
    if (!line) continue;
    const [assetPath, kind, id, coreText, relatedText, title] = line.split('\t');
    if ((kind !== 'note' && kind !== 'problem-card') || !assetPath || !id) continue;
    try {
      const core = JSON.parse(coreText ?? '[]');
      const related = JSON.parse(relatedText ?? '[]');
      if (!Array.isArray(core) || !Array.isArray(related)) continue;
      rows.set(`${kind}:${id}`, {
        path: assetPath,
        title: oneLine(title ?? id),
        tags: [...new Set([...core, ...related].filter((tag): tag is string => (
          typeof tag === 'string' && tag.length > 0
        )))],
      });
    } catch {
      // A malformed optional recall row is not authority for review state.
    }
  }
  return rows;
}

export function currentReviewAsset(
  root: string,
  asset: LearningAssetHandle,
): { revision: number; title: string; path: string } {
  if (asset.kind === 'note') {
    const note = readLearningNote(root, asset.id);
    return { revision: note.revision, title: note.title, path: note.path };
  }
  const card = readProblemCard(root, asset.id);
  return { revision: card.revision, title: card.title, path: card.path };
}

export function selectedAssetReviewBindings(
  references: readonly LearningContextReference[],
): AssetReviewBinding[] {
  return references.flatMap((reference, index) => (
    reference.kind === 'material'
      ? []
      : [{ alias: `source-${index + 1}`, asset: { kind: reference.kind, id: reference.id } }]
  ));
}

export function renderFreeLearningReviewBrief(
  root: string,
  scope: FreeLearningSessionScope,
): string {
  if ((scope.intent ?? 'open') !== 'review') return '';
  const rows = selectedAssetReviewBindings(scope.selectedAssets).map(({ alias, asset }) => {
    const projection = readAssetReviewHistory(root, asset).projection;
    return [
      `- alias: ${alias}`,
      `  kind: ${asset.kind}`,
      `  due_on: ${projection?.dueOn ?? 'unavailable'}`,
      `  stage: ${projection?.stage ?? 'unavailable'}`,
      `  last_result: ${projection?.lastResult ?? 'none'}`,
    ].join('\n');
  });
  return [
    '# Asset Review Brief',
    '',
    'Intent: review',
    '',
    ...(rows.length > 0 ? rows : ['- no reviewable selected assets']),
    '',
    'This is scheduling context, not a judgment of mastery or forgetting.',
  ].join('\n');
}

function fallbackSummary(root: string, asset: LearningAssetHandle): RecallRow {
  const current = currentReviewAsset(root, asset);
  const tagPath = join(root, semanticTagsPath(asset));
  const tags = existsSync(tagPath) ? readSemanticTags(root, asset) : null;
  return {
    path: current.path,
    title: oneLine(current.title),
    tags: tags ? [...tags.core, ...tags.related] : [],
  };
}

export function listDueAssetReviewCandidates(
  root: string,
  localDate: string,
  limit: number,
): { candidates: AssetReviewCandidateSummary[]; matched: number } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(localDate)) {
    throw new Error('ASSET_REVIEW_QUERY_DATE_INVALID');
  }
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 8) {
    throw new Error('ASSET_REVIEW_QUERY_LIMIT_INVALID');
  }
  const indexPath = join(root, 'activity/asset-reviews/index.tsv');
  if (!existsSync(indexPath)) return { candidates: [], matched: 0 };
  const due = readAssetReviewIndex(root)
    .filter((projection) => (
      projection.active && projection.dueOn !== null && projection.dueOn <= localDate
    ))
    .sort((left, right) => (
      left.dueOn!.localeCompare(right.dueOn!)
      || left.asset.kind.localeCompare(right.asset.kind)
      || left.asset.id.localeCompare(right.asset.id)
    ));
  const recall = recallRows(root);
  const candidates = due.slice(0, limit).map((projection, index) => {
    const summary = recall.get(handleKey(projection.asset))
      ?? fallbackSummary(root, projection.asset);
    return {
      alias: `review-${index + 1}`,
      kind: projection.asset.kind,
      id: projection.asset.id,
      title: summary.title,
      tags: summary.tags,
      path: summary.path,
      dueOn: projection.dueOn!,
      stage: projection.stage,
      lastResult: projection.lastResult,
    };
  });
  return { candidates, matched: due.length };
}
