import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  LearningAssetLibrarySnapshot,
  SemanticRelation,
} from '../../src/shared/contracts';
import { KnowledgePage } from '../../src/client/pages/KnowledgePage';

const assets: LearningAssetLibrarySnapshot = {
  notes: [{
    kind: 'note',
    id: 'note-001',
    title: '同构与共同结构',
    revision: 1,
    updatedAt: null,
    tags: { core: ['同构'], related: ['代数结构'] },
    sources: [],
  }],
  problemCards: [],
};
const relations: SemanticRelation[] = [
  { kind: 'asset-tag', asset: { kind: 'note', id: 'note-001' }, tag: '同构', role: 'core' },
  { kind: 'asset-tag', asset: { kind: 'note', id: 'note-001' }, tag: '代数结构', role: 'related' },
  { kind: 'tag-neighbor', left: '同构', right: '代数结构', weight: 1 },
  { kind: 'object-anchor', objectId: 'obj-001', title: '教师内部判断', tag: '同构' },
];

test('renders one student atlas and contextual folio instead of a relation debugger', () => {
  const markup = renderToStaticMarkup(
    <KnowledgePage
      relations={relations}
      assets={assets}
      materials={[]}
      initialFocus="tag:同构"
      onFocus={() => {}}
      onOpenAsset={() => {}}
      onAskAsset={() => {}}
      onOpenAssets={() => {}}
    />,
  );

  expect(markup).toContain('知识之间，怎么连起来');
  expect(markup).toContain('搜索知识点、题卡或笔记');
  expect(markup).toContain('同构与共同结构');
  expect(markup).toContain('class="knowledge-atlas-layout"');
  expect(markup).toContain('class="knowledge-folio"');
  expect(markup).not.toContain('knowledge-entry');
  expect(markup).not.toContain('关系检查器');
  expect(markup).not.toMatch(/方法骨架|Method graph|教师内部判断|个人掌握|能力评分/i);
});

test('renders a truthful empty relation state without inventing tags', () => {
  const markup = renderToStaticMarkup(
    <KnowledgePage
      relations={[]}
      assets={{ notes: [], problemCards: [] }}
      materials={[]}
      onFocus={() => {}}
      onOpenAsset={() => {}}
      onAskAsset={() => {}}
      onOpenAssets={() => {}}
    />,
  );

  expect(markup).toContain('知识图谱');
  expect(markup).toContain('还没有形成带标签的笔记或题卡');
  expect(markup).toContain('回到学习资料');
  expect(markup).not.toContain('自动打标签');
});
