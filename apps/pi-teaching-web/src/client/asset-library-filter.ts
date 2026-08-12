import type {
  LearningAssetLibrarySnapshot,
  LearningAssetSummary,
  LearningMaterial,
  ReadableLearningSourceReference,
} from '../shared/contracts';

type FilterInput = { query: string; tag: string | null };

function normalized(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('zh-CN').trim();
}

function assetKey(asset: { kind: 'note' | 'problem-card'; id: string }): string {
  return `${asset.kind}:${asset.id}`;
}

function sourceKey(source: ReadableLearningSourceReference): string | null {
  if (source.kind === 'material') return `material:${source.id}`;
  if (source.kind === 'legacy-unpinned') return `${source.assetKind}:${source.id}`;
  return `${source.kind}:${source.id}`;
}

export function filterAssetLibrary(
  library: LearningAssetLibrarySnapshot,
  materials: readonly LearningMaterial[],
  input: FilterInput,
): LearningAssetLibrarySnapshot & { materials: LearningMaterial[] } {
  const query = normalized(input.query);
  const names = new Map<string, string>();
  for (const asset of [...library.notes, ...library.problemCards]) {
    names.set(assetKey(asset), asset.title);
  }
  for (const material of materials) {
    const current = material.revisions.find((revision) => revision.revision === material.currentRevision);
    if (current) names.set(`material:${material.id}`, `${current.title}\n${current.originalFilename}`);
  }
  const matchesAsset = (asset: LearningAssetSummary) => {
    const tags = [...(asset.tags?.core ?? []), ...(asset.tags?.related ?? [])];
    if (input.tag && !tags.includes(input.tag)) return false;
    if (!query) return true;
    const sources = asset.sources.flatMap((source) => {
      const key = sourceKey(source);
      return key ? [names.get(key) ?? ''] : [];
    });
    return normalized([
      asset.title,
      asset.searchText ?? '',
      ...tags,
      ...sources,
    ].join('\n')).includes(query);
  };
  const matchedMaterials = input.tag ? [] : materials.filter((material) => {
    if (!query) return true;
    return normalized(names.get(`material:${material.id}`) ?? '').includes(query);
  });
  return {
    notes: library.notes.filter(matchesAsset),
    problemCards: library.problemCards.filter(matchesAsset),
    materials: [...matchedMaterials],
  };
}
