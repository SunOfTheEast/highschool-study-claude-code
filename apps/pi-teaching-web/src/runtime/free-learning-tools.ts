import { resolveSelectedAssetAliases } from '../study/learning-assets';
import type { FreeLearningSessionScope } from './session-scope';
import {
  createLearningAssetTools,
  type LearningAssetToolSession,
} from './learning-asset-tools';
import { createFreeLearningMemoryTool } from './memory-tools';
import { createPeerTool } from './peer-tools';
import type { PeerResponder } from './peer-runner';

export function createFreeLearningTools(
  root: string,
  scope: FreeLearningSessionScope,
  session: LearningAssetToolSession,
  peerResponder?: PeerResponder,
) {
  const assets = createLearningAssetTools(root, {
    resolve: (aliases) => resolveSelectedAssetAliases(root, scope.selectedAssets, aliases),
  }, session);
  const memory = createFreeLearningMemoryTool(root, session);
  const peer = peerResponder ? createPeerTool(root, scope, session, peerResponder) : null;
  return [
    ...assets,
    ...(memory ? [memory] : []),
    ...(peer ? [peer] : []),
  ];
}
