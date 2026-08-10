import { resolveSelectedAssetAliases } from '../study/learning-assets';
import type { FreeLearningSessionScope } from './session-scope';
import {
  createLearningAssetTools,
  type LearningAssetToolSession,
} from './learning-asset-tools';
import { createFreeLearningMemoryTool } from './memory-tools';

export function createFreeLearningTools(
  root: string,
  scope: FreeLearningSessionScope,
  session: LearningAssetToolSession,
) {
  const assets = createLearningAssetTools(root, {
    resolve: (aliases) => resolveSelectedAssetAliases(root, scope.selectedAssets, aliases),
  }, session);
  const memory = createFreeLearningMemoryTool(root, session);
  return memory ? [...assets, memory] : assets;
}
