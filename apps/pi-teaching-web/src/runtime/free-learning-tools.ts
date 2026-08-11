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

export function createFreeLearningTools(
  root: string,
  scope: FreeLearningSessionScope,
  session: LearningAssetToolSession,
  peerResponder?: PeerResponder,
  paperResearchResponder?: PaperResearchResponder,
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
  return [
    ...proposals,
    ...assets,
    ...(memory ? [memory] : []),
    ...(peer ? [peer] : []),
    ...(paperResearch ? [paperResearch] : []),
  ];
}
