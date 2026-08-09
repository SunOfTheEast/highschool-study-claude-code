import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  LearningAssetLibrarySnapshot,
  LearningAssetSummary,
  LearningMaterial,
  SemanticRelation,
} from '../../src/shared/contracts';
import { buildLocalSemanticGraph } from '../../src/client/semantic-graph';
import { KnowledgePage } from '../../src/client/pages/KnowledgePage';

function asset(id: string, title = `题目 ${id}`): LearningAssetSummary {
  return {
    kind: 'problem-card',
    id,
    title,
    revision: 1,
    updatedAt: '2026-08-09T08:00:00.000Z',
    tags: { core: ['沉淀溶解平衡'], related: ['平衡常数'] },
    sources: [],
  };
}

const cards = Array.from({ length: 14 }, (_, index) => asset(`problem-${index + 1}`));
const note: LearningAssetSummary = {
  kind: 'note',
  id: 'note-ksp',
  title: 'Ksp 为什么不写固体',
  revision: 2,
  updatedAt: '2026-08-09T08:00:00.000Z',
  tags: { core: ['沉淀溶解平衡'], related: ['纯固体'] },
  sources: [{ kind: 'material', id: 'chemistry-book', revision: 1, locator: 'page-0062' }],
};
const assets: LearningAssetLibrarySnapshot = { notes: [note], problemCards: cards };
const materials: LearningMaterial[] = [{
  id: 'chemistry-book',
  path: 'materials/chemistry-book',
  currentRevision: 1,
  revisions: [{
    revision: 1,
    title: '化学反应原理教材',
    originalFilename: 'book.pdf',
    mediaType: 'application/pdf',
    sha256: 'a'.repeat(64),
    importedAt: '2026-08-09T08:00:00.000Z',
    originalPath: 'materials/chemistry-book/original/book.pdf',
    searchStatus: 'pdf-text',
    searchablePath: 'materials/chemistry-book/revisions/1/content.txt',
    locatorKind: 'page',
    requestId: 'request-1',
  }],
}];
const relations: SemanticRelation[] = [
  ...cards.flatMap((item) => ([
    { kind: 'asset-tag', asset: { kind: item.kind, id: item.id }, tag: '沉淀溶解平衡', role: 'core' },
    { kind: 'asset-tag', asset: { kind: item.kind, id: item.id }, tag: '平衡常数', role: 'related' },
  ] satisfies SemanticRelation[])),
  { kind: 'asset-tag', asset: { kind: 'note', id: note.id }, tag: '沉淀溶解平衡', role: 'core' },
  { kind: 'asset-tag', asset: { kind: 'note', id: note.id }, tag: '纯固体', role: 'related' },
  {
    kind: 'asset-source',
    asset: { kind: 'note', id: note.id },
    source: { kind: 'material', id: 'chemistry-book', revision: 1, locator: 'page-0062' },
  },
  { kind: 'tag-neighbor', left: '沉淀溶解平衡', right: '平衡常数', weight: 14 },
  { kind: 'tag-neighbor', left: '沉淀溶解平衡', right: '纯固体', weight: 1 },
  { kind: 'object-anchor', objectId: 'obj-ksp', title: '教师判断：Ksp', tag: '沉淀溶解平衡' },
  { kind: 'object-bucket', objectId: 'obj-ksp', bucketId: 'equilibrium', title: '能力假设' },
];

test('builds a deterministic capped local neighborhood and excludes teacher-memory relations', () => {
  const input = { relations, assets, materials, focus: 'tag:沉淀溶解平衡' };
  const first = buildLocalSemanticGraph(input);
  const second = buildLocalSemanticGraph(input);

  expect(first).toEqual(second);
  expect(first.nodes).toHaveLength(12);
  expect(first.totalNodes).toBe(18);
  expect(first.nodes[0]).toMatchObject({ key: 'tag:沉淀溶解平衡', x: 50, y: 50 });
  expect(first.associations).toHaveLength(17);
  expect(JSON.stringify(first)).not.toMatch(/obj-ksp|能力假设|教师判断/);
  expect(first.nodes.some((node) => node.kind === 'material')).toBe(false);
});

test('keeps complete inspector associations and only reveals a Material through its focused asset source', () => {
  const graph = buildLocalSemanticGraph({
    relations,
    assets,
    materials,
    focus: 'note:note-ksp',
  });

  expect(graph.nodes.map((node) => node.key)).toContain('material:chemistry-book@1');
  expect(graph.associations.map((item) => item.label)).toEqual([
    '沉淀溶解平衡',
    '纯固体',
    '化学反应原理教材',
  ]);
  expect(graph.edges).toContainEqual(expect.objectContaining({ role: 'core' }));
  expect(graph.edges).toContainEqual(expect.objectContaining({ role: 'related' }));
  expect(graph.edges).toContainEqual(expect.objectContaining({ role: 'source' }));
});

test('renders full tag inspector, explains co-occurrence, and offers actions only for assets', () => {
  const tagMarkup = renderToStaticMarkup(
    <KnowledgePage
      relations={relations}
      assets={assets}
      materials={materials}
      initialFocus="tag:沉淀溶解平衡"
      onFocus={() => {}}
      onOpenAsset={() => {}}
      onAskAsset={() => {}}
      onOpenAssets={() => {}}
    />,
  );
  expect(tagMarkup).toContain('显示 12 / 共 18');
  expect(tagMarkup).toContain('题目 problem-14');
  expect(tagMarkup).toContain('共同出现在 14 个资产中');
  expect(tagMarkup).toContain('data-edge-role="core"');
  expect(tagMarkup).toContain('data-edge-role="related"');
  expect(tagMarkup).not.toContain('问老师');
  expect(tagMarkup).not.toMatch(/能力假设|对象记忆|教师判断/);

  const assetMarkup = renderToStaticMarkup(
    <KnowledgePage
      relations={relations}
      assets={assets}
      materials={materials}
      initialFocus="note:note-ksp"
      onFocus={() => {}}
      onOpenAsset={() => {}}
      onAskAsset={() => {}}
      onOpenAssets={() => {}}
    />,
  );
  expect(assetMarkup).toContain('打开内容');
  expect(assetMarkup).toContain('带着这份笔记问老师');
  expect(assetMarkup).toContain('化学反应原理教材');
  expect(assetMarkup).toContain('第 62 页');
});
