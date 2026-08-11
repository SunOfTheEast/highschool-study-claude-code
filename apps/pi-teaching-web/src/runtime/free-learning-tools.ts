import { resolveSelectedAssetAliases } from '../study/learning-assets';
import type { FreeLearningSessionScope } from './session-scope';
import {
  createLearningAssetTools,
  type LearningAssetToolSession,
} from './learning-asset-tools';
import { createFreeLearningMemoryTool } from './memory-tools';
import { createPeerTool } from './peer-tools';
import type { PeerResponder } from './peer-runner';
import type { PaperResearchResponder } from './paper-research-runner';
import { createPaperResearchTool } from './paper-research-tools';
import { createLearningAssetProposalTools } from './learning-asset-proposal-tools';
import { createCalendarTools, type CalendarRepository } from './calendar-tools';
import { createAssetReviewRecordTool } from './asset-review-tools';
import { selectedAssetReviewBindings } from './asset-review-context';
import { freeLearningSessionKey } from './session-scope';

export function createFreeLearningTools(
  root: string,
  scope: FreeLearningSessionScope,
  session: LearningAssetToolSession,
  peerResponder?: PeerResponder,
  paperResearchResponder?: PaperResearchResponder,
  calendar?: CalendarRepository,
) {
  const assets = createLearningAssetTools(root, {
    resolve: (aliases) => resolveSelectedAssetAliases(root, scope.selectedAssets, aliases),
  }, session);
  const proposals = createLearningAssetProposalTools();
  const memory = createFreeLearningMemoryTool(root, session);
  const peer = peerResponder ? createPeerTool(root, scope, session, peerResponder) : null;
  const paperResearch = paperResearchResponder
    ? createPaperResearchTool(paperResearchResponder)
    : null;
  const review = (scope.intent ?? 'open') === 'review'
    ? createAssetReviewRecordTool(
      root,
      freeLearningSessionKey(session.getSessionId()),
      selectedAssetReviewBindings(scope.selectedAssets),
    )
    : null;
  return [
    ...assets,
    ...proposals,
    ...(memory ? [memory] : []),
    ...(peer ? [peer] : []),
    ...(paperResearch ? [paperResearch] : []),
    ...(calendar ? createCalendarTools(calendar, root, scope) : []),
    ...(review ? [review] : []),
  ];
}
