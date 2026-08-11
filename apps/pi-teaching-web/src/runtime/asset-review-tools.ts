import { createHash } from 'node:crypto';
import { Type } from '@earendil-works/pi-ai';
import { defineTool } from '@earendil-works/pi-coding-agent';
import type { ReviewResult, ReviewEvidence } from '../shared/contracts';
import {
  localDateAt,
  recordAssetReviewEvent,
} from '../study/asset-reviews';
import {
  currentReviewAsset,
  listDueAssetReviewCandidates,
  type AssetReviewBinding,
} from './asset-review-context';

const reviewResult = Type.Union([
  Type.Literal('forgot'),
  Type.Literal('effortful'),
  Type.Literal('fluent'),
]);

function result(value: Record<string, unknown>, kind: string) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value) }],
    details: { kind },
  };
}

function requestId(sessionKey: string, toolCallId: string): string {
  return `session-review-${createHash('sha256')
    .update(`${sessionKey}\0${toolCallId}`)
    .digest('hex')
    .slice(0, 24)}`;
}

export function createAssetReviewRecordTool(
  root: string,
  sessionKey: `free:${string}` | `lesson:${string}`,
  bindings: readonly AssetReviewBinding[],
  now: () => Date = () => new Date(),
) {
  const aliases = new Map(bindings.map((binding) => [binding.alias, binding.asset]));
  return defineTool({
    name: 'record_asset_review',
    label: '记录本次复习结果',
    description: 'Record the first cold-retrieval result for one asset already bound to this Session.',
    executionMode: 'sequential',
    parameters: Type.Object({
      alias: Type.String({ pattern: '^(?:source|review)-[1-9][0-9]*$' }),
      result: reviewResult,
    }, { additionalProperties: false }),
    execute: async (toolCallId, input) => {
      const asset = aliases.get(input.alias);
      if (!asset) throw new Error(`ASSET_REVIEW_ALIAS_UNKNOWN: ${input.alias}`);
      const current = currentReviewAsset(root, asset);
      const at = now().toISOString();
      const evidence: ReviewEvidence = { kind: 'session', sessionKey };
      const recorded = recordAssetReviewEvent(root, asset, {
        requestId: requestId(sessionKey, toolCallId),
        at,
        localDate: localDateAt(at),
        event: {
          kind: 'reviewed',
          assetRevision: current.revision,
          result: input.result as ReviewResult,
          evidence,
        },
      });
      return result({
        ok: true,
        asset: { alias: input.alias, ...asset, revision: current.revision },
        result: input.result,
        nextDueOn: recorded.projection.dueOn,
        stage: recorded.projection.stage,
        replayed: recorded.replayed,
      }, 'asset-review-record');
    },
  });
}

export function createAssetReviewCandidateQueryTool(
  root: string,
  now: () => Date = () => new Date(),
) {
  return defineTool({
    name: 'list_due_asset_reviews',
    label: '查看可纳入本课的复习候选',
    description: 'List a small read-only set of due asset summaries for approved-Lesson preparation.',
    executionMode: 'sequential',
    parameters: Type.Object({
      limit: Type.Optional(Type.Integer({ minimum: 1, maximum: 8 })),
    }, { additionalProperties: false }),
    execute: async (_toolCallId, input) => result(
      listDueAssetReviewCandidates(root, localDateAt(now()), input.limit ?? 6),
      'asset-review-query',
    ),
  });
}
