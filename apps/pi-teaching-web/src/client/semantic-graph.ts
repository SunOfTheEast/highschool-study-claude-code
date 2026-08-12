import type {
  LearningAssetHandle,
  LearningAssetLibrarySnapshot,
  LearningAssetSummary,
  LearningMaterial,
  SemanticRelation,
} from '../shared/contracts';
import { formatMaterialLocator } from './material-locator';

export type SemanticGraphNodeKind = 'tag' | 'asset' | 'material';
export type SemanticGraphEdgeRole = 'core' | 'related' | 'co-occurrence' | 'source';

export type SemanticGraphNode = {
  key: string;
  kind: SemanticGraphNodeKind;
  label: string;
  detail: string;
  asset?: LearningAssetHandle;
  materialId?: string;
  x: number;
  y: number;
};

export type SemanticGraphAssociation = Omit<SemanticGraphNode, 'x' | 'y'> & {
  role: SemanticGraphEdgeRole;
};

export type SemanticAssetNeighbor = {
  key: string;
  asset: LearningAssetHandle;
  label: string;
  detail: string;
  sharedCoreTags: string[];
  sharedTags: string[];
  relationLabel: '核心标签相同' | '核心标签不同';
};

export type SemanticSearchEntry = {
  key: string;
  kind: 'tag' | 'asset';
  label: string;
  detail: string;
};

export type SemanticGraphEdge = {
  key: string;
  from: string;
  to: string;
  role: SemanticGraphEdgeRole;
  label: string;
};

export type LocalSemanticGraph = {
  focus: SemanticGraphNode | null;
  nodes: SemanticGraphNode[];
  edges: SemanticGraphEdge[];
  associations: SemanticGraphAssociation[];
  neighborAssets: SemanticAssetNeighbor[];
  totalNodes: number;
};

type BuildInput = {
  relations: SemanticRelation[];
  assets: LearningAssetLibrarySnapshot;
  materials: LearningMaterial[];
  focus: string | null;
};

function assetKey(asset: LearningAssetHandle): string {
  return `${asset.kind}:${asset.id}`;
}

function assetSummaryMap(value: LearningAssetLibrarySnapshot): Map<string, LearningAssetSummary> {
  return new Map([...value.notes, ...value.problemCards].map((asset) => [assetKey(asset), asset]));
}

function roleOrder(role: SemanticGraphEdgeRole): number {
  if (role === 'core') return 0;
  if (role === 'related') return 1;
  if (role === 'source') return 2;
  return 3;
}

const ATLAS_SLOTS = [
  { x: 50, y: 52 },
  { x: 25, y: 28 },
  { x: 72, y: 25 },
  { x: 82, y: 52 },
  { x: 72, y: 79 },
  { x: 26, y: 79 },
  { x: 14, y: 54 },
  { x: 14, y: 18 },
  { x: 86, y: 18 },
] as const;

function positioned(nodes: Array<Omit<SemanticGraphNode, 'x' | 'y'>>): SemanticGraphNode[] {
  return nodes.slice(0, ATLAS_SLOTS.length).map((node, index) => ({
    ...node,
    ...ATLAS_SLOTS[index]!,
  }));
}

function materialNode(
  material: LearningMaterial,
  revision: number,
  locator: string | null,
): Omit<SemanticGraphNode, 'x' | 'y'> | null {
  const value = material.revisions.find((candidate) => candidate.revision === revision);
  if (!value) return null;
  return {
    key: `material:${material.id}@${revision}`,
    kind: 'material',
    label: value.title,
    detail: `第 ${revision} 版 · ${formatMaterialLocator(locator).human}`,
    materialId: material.id,
  };
}

function uniqueAssociations(values: SemanticGraphAssociation[]): SemanticGraphAssociation[] {
  const byKey = new Map<string, SemanticGraphAssociation>();
  for (const value of values) {
    const previous = byKey.get(value.key);
    if (!previous || roleOrder(value.role) < roleOrder(previous.role)) byKey.set(value.key, value);
  }
  return [...byKey.values()].sort((left, right) => (
    roleOrder(left.role) - roleOrder(right.role)
      || left.label.localeCompare(right.label, 'zh-CN')
      || left.key.localeCompare(right.key)
  ));
}

export function listSemanticGraphTags(relations: SemanticRelation[]): string[] {
  const tags = new Set<string>();
  for (const relation of relations) {
    if (relation.kind === 'asset-tag') tags.add(relation.tag);
    if (relation.kind === 'tag-neighbor') {
      tags.add(relation.left);
      tags.add(relation.right);
    }
  }
  return [...tags].sort((left, right) => left.localeCompare(right, 'zh-CN'));
}

export function searchSemanticGraphEntries(
  relations: SemanticRelation[],
  assets: LearningAssetLibrarySnapshot,
  query: string,
): SemanticSearchEntry[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [];
  const availableAssets = new Set(relations.flatMap((relation) => (
    relation.kind === 'asset-tag' ? [assetKey(relation.asset)] : []
  )));
  const tagEntries = listSemanticGraphTags(relations)
    .filter((tag) => tag.toLocaleLowerCase().includes(needle))
    .map((tag) => ({ key: `tag:${tag}`, kind: 'tag' as const, label: tag, detail: '知识点' }));
  const assetEntries = [...assets.notes, ...assets.problemCards]
    .filter((asset) => availableAssets.has(assetKey(asset)))
    .filter((asset) => asset.title.toLocaleLowerCase().includes(needle))
    .map((asset) => ({
      key: assetKey(asset),
      kind: 'asset' as const,
      label: asset.title,
      detail: asset.kind === 'note' ? '笔记' : '题卡',
    }));
  return [...tagEntries, ...assetEntries].sort((left, right) => (
    (left.kind === right.kind ? 0 : left.kind === 'tag' ? -1 : 1)
      || left.label.localeCompare(right.label, 'zh-CN')
      || left.key.localeCompare(right.key)
  ));
}

function sharedValues(left: string[], right: string[]): string[] {
  const candidates = new Set(right);
  return [...new Set(left)].filter((value) => candidates.has(value))
    .sort((a, b) => a.localeCompare(b, 'zh-CN'));
}

function deriveAssetNeighbors(
  focus: LearningAssetSummary | null,
  summaries: Map<string, LearningAssetSummary>,
  limit = 6,
): SemanticAssetNeighbor[] {
  if (!focus) return [];
  const focusCore = focus.tags?.core ?? [];
  const focusRelated = focus.tags?.related ?? [];
  const focusTags = [...new Set([...focusCore, ...focusRelated])];
  return [...summaries.values()]
    .filter((candidate) => assetKey(candidate) !== assetKey(focus))
    .map((candidate) => {
      const candidateCore = candidate.tags?.core ?? [];
      const candidateRelated = candidate.tags?.related ?? [];
      const candidateTags = [...new Set([...candidateCore, ...candidateRelated])];
      const sharedCoreTags = sharedValues(focusCore, candidateCore);
      const sharedTags = sharedValues(focusTags, candidateTags);
      return {
        key: assetKey(candidate),
        asset: { kind: candidate.kind, id: candidate.id },
        label: candidate.title,
        detail: `共享 ${sharedTags.join('、')} 标签`,
        sharedCoreTags,
        sharedTags,
        relationLabel: sharedCoreTags.length > 0 ? '核心标签相同' as const : '核心标签不同' as const,
      };
    })
    .filter((candidate) => candidate.sharedTags.length > 0)
    .sort((left, right) => (
      right.sharedCoreTags.length - left.sharedCoreTags.length
        || right.sharedTags.length - left.sharedTags.length
        || left.label.localeCompare(right.label, 'zh-CN')
        || left.key.localeCompare(right.key)
    ))
    .slice(0, Math.max(0, limit));
}

export function semanticAssetNeighbors(
  assets: LearningAssetLibrarySnapshot,
  focus: LearningAssetHandle,
  limit = 3,
): SemanticAssetNeighbor[] {
  const summaries = assetSummaryMap(assets);
  return deriveAssetNeighbors(summaries.get(assetKey(focus)) ?? null, summaries, limit);
}

export function buildLocalSemanticGraph({
  relations,
  assets,
  materials,
  focus,
}: BuildInput): LocalSemanticGraph {
  const summaries = assetSummaryMap(assets);
  const tags = listSemanticGraphTags(relations);
  const requested = focus && !focus.includes(':') && tags.includes(focus) ? `tag:${focus}` : focus;
  const availableAssets = new Set(relations.flatMap((relation) => (
    relation.kind === 'asset-tag' ? [assetKey(relation.asset)] : []
  )));
  const fallback = tags[0] ? `tag:${tags[0]}` : null;
  const focusKey = requested?.startsWith('tag:') && tags.includes(requested.slice(4))
    ? requested
    : requested && availableAssets.has(requested)
      ? requested
      : fallback;
  if (!focusKey) {
    return { focus: null, nodes: [], edges: [], associations: [], neighborAssets: [], totalNodes: 0 };
  }

  const isTag = focusKey.startsWith('tag:');
  const focusTag = isTag ? focusKey.slice(4) : null;
  const focusAsset = !isTag ? summaries.get(focusKey) ?? null : null;
  if (!isTag && !focusAsset) {
    return { focus: null, nodes: [], edges: [], associations: [], neighborAssets: [], totalNodes: 0 };
  }

  const focusNode: Omit<SemanticGraphNode, 'x' | 'y'> = isTag
    ? { key: focusKey, kind: 'tag', label: focusTag!, detail: '语义标签' }
    : {
      key: focusKey,
      kind: 'asset',
      label: focusAsset!.title,
      detail: focusAsset!.kind === 'note' ? '笔记' : '题卡',
      asset: { kind: focusAsset!.kind, id: focusAsset!.id },
    };

  const associations: SemanticGraphAssociation[] = [];
  for (const relation of relations) {
    if (isTag && relation.kind === 'asset-tag' && relation.tag === focusTag) {
      const summary = summaries.get(assetKey(relation.asset));
      if (summary) associations.push({
        key: assetKey(relation.asset),
        kind: 'asset',
        label: summary.title,
        detail: summary.kind === 'note' ? '笔记' : '题卡',
        asset: relation.asset,
        role: relation.role,
      });
    }
    if (isTag && relation.kind === 'tag-neighbor') {
      const neighbor = relation.left === focusTag
        ? relation.right
        : relation.right === focusTag ? relation.left : null;
      if (neighbor) associations.push({
        key: `tag:${neighbor}`,
        kind: 'tag',
        label: neighbor,
        detail: `共同出现在 ${relation.weight} 个资产中`,
        role: 'co-occurrence',
      });
    }
    if (!isTag && relation.kind === 'asset-tag' && assetKey(relation.asset) === focusKey) {
      associations.push({
        key: `tag:${relation.tag}`,
        kind: 'tag',
        label: relation.tag,
        detail: relation.role === 'core' ? '核心标签' : '关联标签',
        role: relation.role,
      });
    }
    if (!isTag && relation.kind === 'asset-source' && assetKey(relation.asset) === focusKey) {
      if (relation.source.kind === 'material') {
        const material = materials.find((candidate) => candidate.id === relation.source.id);
        const node = material
          ? materialNode(material, relation.source.revision, relation.source.locator)
          : null;
        if (node) associations.push({ ...node, role: 'source' });
      } else if (relation.source.kind !== 'legacy-unpinned') {
        const sourceKey = assetKey(relation.source);
        const summary = summaries.get(sourceKey);
        if (summary) associations.push({
          key: sourceKey,
          kind: 'asset',
          label: summary.title,
          detail: `内容来源 · 第 ${relation.source.revision} 版`,
          asset: relation.source,
          role: 'source',
        });
      }
    }
  }

  const complete = uniqueAssociations(associations);
  const tagNeighborKeys = isTag ? relations.flatMap((relation) => {
    if (relation.kind !== 'tag-neighbor') return [];
    const neighbor = relation.left === focusTag
      ? relation.right
      : relation.right === focusTag ? relation.left : null;
    return neighbor ? [{ key: `tag:${neighbor}`, weight: relation.weight }] : [];
  }).sort((left, right) => (
    right.weight - left.weight || left.key.localeCompare(right.key, 'zh-CN')
  )).map((value) => value.key) : [];
  const associationByKey = new Map(complete.map((association) => [association.key, association]));
  const visibleAssociations = isTag
    ? (tagNeighborKeys.length > 0
      ? tagNeighborKeys.flatMap((key) => associationByKey.get(key) ?? []).slice(0, 8)
      : complete.filter((association) => association.kind === 'asset').slice(0, 8))
    : complete.slice(0, 8);
  const nodes = positioned([focusNode, ...visibleAssociations.map(({ role: _role, ...node }) => node)]);
  const visibleKeys = new Set(nodes.map((node) => node.key));
  const edges = visibleAssociations.flatMap((association) => (
    visibleKeys.has(association.key)
      ? [{
        key: `${focusKey}->${association.key}`,
        from: focusKey,
        to: association.key,
        role: association.role,
        label: association.detail,
      } satisfies SemanticGraphEdge]
      : []
  ));
  return {
    focus: nodes[0] ?? null,
    nodes,
    edges,
    associations: complete,
    neighborAssets: deriveAssetNeighbors(focusAsset, summaries),
    totalNodes: complete.length + 1,
  };
}
