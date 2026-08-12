import type {
  LearningAssetSummary,
  SourceTreeAsset,
  SourceTreeBook,
  SourceTreeSnapshot,
} from '../shared/contracts';
import { parseMaterialLocator } from './material-locators';
import { readMaterialBookIndex } from './material-book-index';
import { readLearningAssetLibrary } from './learning-assets';
import { listMaterials } from './materials';
import { resolveMaterialSourceLabel } from './source-labels';

function outlineIntersects(
  node: { startPage: number | null; endPage: number | null },
  locator: ReturnType<typeof parseMaterialLocator>,
): boolean {
  if (node.startPage === null || node.endPage === null) return false;
  if (locator.kind === 'whole') return true;
  return locator.kind === 'pages'
    && node.startPage <= locator.end
    && node.endPage >= locator.start;
}

function sourceAsset(
  root: string,
  asset: LearningAssetSummary,
  source: Extract<LearningAssetSummary['sources'][number], { kind: 'material' }> | null,
): SourceTreeAsset {
  if (!source) {
    return {
      ...asset,
      sourceRevision: null,
      locator: null,
      sourceLabel: null,
      sourceRoute: null,
    };
  }
  const label = resolveMaterialSourceLabel(root, source);
  return {
    ...asset,
    sourceRevision: source.revision,
    locator: source.locator,
    sourceLabel: label.label,
    sourceRoute: label.route,
  };
}

function uniqueMaterialSources(assets: LearningAssetSummary[]) {
  const seen = new Set<string>();
  return assets.flatMap((asset) => asset.sources.flatMap((source) => {
    if (source.kind !== 'material') return [];
    const key = `${asset.kind}:${asset.id}:${source.id}@${source.revision}#${source.locator ?? ''}`;
    if (seen.has(key)) return [];
    seen.add(key);
    return [{ asset, source }];
  }));
}

export function readSourceTree(root: string): SourceTreeSnapshot {
  const library = readLearningAssetLibrary(root);
  const assets = [...library.notes, ...library.problemCards];
  const materialSources = uniqueMaterialSources(assets);
  const books: SourceTreeBook[] = [];
  for (const material of listMaterials(root)) {
    for (const revision of material.revisions) {
      const attached = materialSources.filter(({ source }) => (
        source.id === material.id && source.revision === revision.revision
      ));
      const index = readMaterialBookIndex(root, material.id, revision.revision);
      const chapters = (index?.outline ?? []).flatMap((node) => (
        node.startPage === null || node.endPage === null ? [] : [{
          id: node.id,
          title: node.title,
          level: node.level,
          startPage: node.startPage,
          endPage: node.endPage,
          assets: attached.flatMap(({ asset, source }) => {
            const locator = parseMaterialLocator(source.locator);
            return outlineIntersects(node, locator)
              ? [sourceAsset(root, asset, source)]
              : [];
          }),
        }]
      ));
      const mapped = new Set(chapters.flatMap((chapter) => (
        chapter.assets.map((asset) => `${asset.kind}:${asset.id}:${asset.locator}`)
      )));
      const unresolved = attached.flatMap(({ asset, source }) => (
        mapped.has(`${asset.kind}:${asset.id}:${source.locator}`)
          ? []
          : [sourceAsset(root, asset, source)]
      ));
      books.push({
        materialId: material.id,
        revision: revision.revision,
        title: revision.title,
        mediaType: revision.mediaType,
        current: revision.revision === material.currentRevision,
        pageCount: index?.pageCount ?? null,
        chapters,
        unresolved: { title: '暂未归入章节', assets: unresolved },
      });
    }
  }
  const outside = assets.filter((asset) => (
    !asset.sources.some((source) => source.kind === 'material')
  )).map((asset) => sourceAsset(root, asset, null));
  return { books, outside };
}
