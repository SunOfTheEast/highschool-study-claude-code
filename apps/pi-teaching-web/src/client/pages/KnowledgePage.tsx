import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import type {
  LearningAssetHandle,
  LearningAssetLibrarySnapshot,
  LearningMaterial,
  SemanticRelation,
} from '../../shared/contracts';
import { MarkdownView } from '../components/MarkdownView';
import {
  buildLocalSemanticGraph,
  searchSemanticGraphEntries,
  type SemanticGraphAssociation,
  type SemanticGraphNode,
} from '../semantic-graph';

type KnowledgePageProps = {
  relations: SemanticRelation[];
  assets: LearningAssetLibrarySnapshot;
  materials: LearningMaterial[];
  initialFocus?: string | null;
  onFocus(key: string): void;
  onOpenAsset(asset: LearningAssetHandle): void;
  onAskAsset(asset: LearningAssetHandle): void;
  onOpenAssets(): void;
  onOpenMaterial?(id: string): void;
};

function AssetTitle({ value }: { value: string }) {
  return <MarkdownView inline>{value}</MarkdownView>;
}

function NodeLabel({ node }: { node: SemanticGraphNode }) {
  return node.kind === 'asset' ? <AssetTitle value={node.label} /> : <>{node.label}</>;
}

function FolioRow({
  item,
  children,
}: {
  item: Pick<SemanticGraphAssociation, 'key' | 'role'>;
  children: ReactNode;
}) {
  return <li key={item.key} data-association-role={item.role}>{children}</li>;
}

export function KnowledgePage({
  relations,
  assets,
  materials,
  initialFocus = null,
  onFocus,
  onOpenAsset,
  onAskAsset,
  onOpenAssets,
  onOpenMaterial,
}: KnowledgePageProps) {
  const [query, setQuery] = useState('');
  const [focus, setFocus] = useState(initialFocus);
  const graph = useMemo(
    () => buildLocalSemanticGraph({ relations, assets, materials, focus }),
    [relations, assets, materials, focus],
  );
  const searchResults = useMemo(
    () => searchSemanticGraphEntries(relations, assets, query),
    [relations, assets, query],
  );
  const nodeByKey = new Map(graph.nodes.map((node) => [node.key, node]));
  const selectedAsset = graph.focus?.asset ?? null;
  const tagFocus = graph.focus?.kind === 'tag';
  const directAssets = graph.associations.filter((item) => item.kind === 'asset');
  const directRelations = graph.associations.filter((item) => item.kind !== 'asset');
  const tagResults = searchResults.filter((item) => item.kind === 'tag');
  const assetResults = searchResults.filter((item) => item.kind === 'asset');
  const selectFocus = (key: string) => {
    setFocus(key);
    setQuery('');
    onFocus(key);
  };

  if (!graph.focus) {
    return (
      <main className="knowledge-workspace knowledge-empty" aria-label="知识图谱">
        <section>
          <small>Knowledge atlas</small>
          <h1>知识图谱</h1>
          <p>这里还没有形成带标签的笔记或题卡。先回到资料架继续学习，关系会随资产自然出现。</p>
          <button type="button" className="action-outline" onClick={onOpenAssets}>回到学习资料</button>
        </section>
      </main>
    );
  }

  const renderNode = (node: SemanticGraphNode, index: number) => {
    const style = {
      '--node-x': `${node.x}%`,
      '--node-y': `${node.y}%`,
    } as CSSProperties;
    const contents = <><small>{node.detail}</small><strong><NodeLabel node={node} /></strong></>;
    if (index === 0) {
      return (
        <div
          key={node.key}
          className="semantic-node semantic-focus-slip"
          data-node-kind={node.kind}
          data-focus="true"
          style={style}
        >
          {contents}
        </div>
      );
    }
    if (node.kind === 'material') {
      return onOpenMaterial && node.materialId ? (
        <button
          type="button"
          key={node.key}
          className="semantic-node"
          data-node-kind="material"
          style={style}
          onClick={() => onOpenMaterial(node.materialId!)}
        >
          {contents}
        </button>
      ) : <span key={node.key} className="semantic-node" data-node-kind="material" style={style}>{contents}</span>;
    }
    return (
      <button
        type="button"
        key={node.key}
        className="semantic-node"
        data-node-kind={node.kind}
        style={style}
        onClick={() => selectFocus(node.key)}
      >
        {contents}
      </button>
    );
  };

  return (
    <main className="knowledge-workspace" aria-label="知识图谱">
      <header className="knowledge-page-head">
        <div>
          <small>Knowledge atlas</small>
          <h1>知识之间，怎么连起来</h1>
        </div>
        <div className="knowledge-head-actions">
          <label className="knowledge-search">
            <span className="sr-only">搜索知识点、题卡或笔记</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索知识点、题卡或笔记"
            />
            {query.trim() && (
              <div className="knowledge-search-results" aria-label="搜索结果">
                {tagResults.length > 0 && (
                  <section><small>知识点</small>{tagResults.map((item) => (
                    <button type="button" key={item.key} onClick={() => selectFocus(item.key)}>
                      <strong>{item.label}</strong><span>{item.detail}</span>
                    </button>
                  ))}</section>
                )}
                {assetResults.length > 0 && (
                  <section><small>学习内容</small>{assetResults.map((item) => (
                    <button type="button" key={item.key} onClick={() => selectFocus(item.key)}>
                      <strong><AssetTitle value={item.label} /></strong><span>{item.detail}</span>
                    </button>
                  ))}</section>
                )}
                {searchResults.length === 0 && <p>没有匹配的知识点、题卡或笔记。</p>}
              </div>
            )}
          </label>
          <button type="button" className="action-text" onClick={onOpenAssets}>回到学习资料</button>
        </div>
      </header>

      <div className="knowledge-atlas-layout">
        <section className="semantic-stage" aria-label="知识地图">
          <header>
            <div><small>当前聚焦</small><h2><NodeLabel node={graph.focus} /></h2></div>
            <span>显示 {graph.nodes.length} / 共 {graph.totalNodes}</span>
          </header>
          <div className="semantic-canvas">
            <svg viewBox="0 0 100 100" role="img" aria-label={`${graph.focus.label}的局部关系`}>
              {graph.edges.map((edge) => {
                const from = nodeByKey.get(edge.from);
                const to = nodeByKey.get(edge.to);
                if (!from || !to) return null;
                return (
                  <line
                    key={edge.key}
                    x1={from.x}
                    y1={from.y}
                    x2={to.x}
                    y2={to.y}
                    data-edge-role={edge.role}
                  >
                    <title>{edge.label}</title>
                  </line>
                );
              })}
            </svg>
            {graph.nodes.map(renderNode)}
          </div>
          <footer className="semantic-legend">
            {tagFocus ? (
              <span data-edge-role="co-occurrence">共同出现</span>
            ) : (
              <><span data-edge-role="core">核心标签</span><span data-edge-role="related">关联标签</span><span data-edge-role="source">内容来源</span></>
            )}
            <p>共同出现只表示两个标签出现在同一资产中，不表示先修、相似、因果或教学优先级。</p>
          </footer>
        </section>

        <aside className="knowledge-folio" aria-label="相关学习内容">
          <header>
            <small>{tagFocus ? '从这个知识点出发' : '沿着这份内容'}</small>
            <h2><NodeLabel node={graph.focus} /></h2>
            <p>{tagFocus ? '地图看联系，这一页打开相关题卡和笔记。' : '先看它位于哪里，再沿共享标签寻找邻近内容。'}</p>
            {selectedAsset && (
              <div className="semantic-actions">
                <button type="button" className="action-outline" onClick={() => onOpenAsset(selectedAsset)}>打开内容</button>
                <button type="button" className="action-solid" onClick={() => onAskAsset(selectedAsset)}>
                  {selectedAsset.kind === 'note' ? '带着这份笔记问老师' : '带着这道题问老师'}
                </button>
              </div>
            )}
          </header>

          {tagFocus ? (
            <>
              <section className="knowledge-folio-section">
                <h3>相关学习内容 · {directAssets.length}</h3>
                <ol>
                  {directAssets.map((item) => (
                    <FolioRow key={item.key} item={item}>
                      <div><small>{item.detail} · {item.role === 'core' ? '核心标签' : '关联标签'}</small><strong><AssetTitle value={item.label} /></strong></div>
                      <div className="folio-row-actions">
                        <button type="button" className="action-text" onClick={() => selectFocus(item.key)}>查看联系</button>
                        {item.asset && <button type="button" className="action-text" onClick={() => onOpenAsset(item.asset!)}>打开</button>}
                      </div>
                    </FolioRow>
                  ))}
                </ol>
              </section>
              {directRelations.length > 0 && (
                <section className="knowledge-folio-section">
                  <h3>概念联系 · {directRelations.length}</h3>
                  <ol>{directRelations.map((item) => (
                    <FolioRow key={item.key} item={item}>
                      <div><small>{item.detail}</small><strong>{item.label}</strong></div>
                      <button type="button" className="action-text" onClick={() => selectFocus(item.key)}>以此为中心</button>
                    </FolioRow>
                  ))}</ol>
                </section>
              )}
            </>
          ) : (
            <>
              <section className="knowledge-folio-section">
                <h3>直接关系 · {graph.associations.length}</h3>
                <ol>{graph.associations.map((item) => (
                  <FolioRow key={item.key} item={item}>
                    <div><small>{item.detail}</small><strong>{item.kind === 'asset' ? <AssetTitle value={item.label} /> : item.label}</strong></div>
                    {item.kind === 'material'
                      ? item.materialId && onOpenMaterial && <button type="button" className="action-text" onClick={() => onOpenMaterial(item.materialId!)}>打开资料</button>
                      : <button type="button" className="action-text" onClick={() => selectFocus(item.key)}>以此为中心</button>}
                  </FolioRow>
                ))}</ol>
              </section>
              <section className="knowledge-folio-section">
                <h3>共享标签的内容 · {graph.neighborAssets.length}</h3>
                <ol>{graph.neighborAssets.map((item) => (
                  <li key={item.key} data-neighbor-kind={item.relationLabel === '核心标签相同' ? 'same-core' : 'different-core'}>
                    <div><small>{item.relationLabel} · {item.detail}</small><strong><AssetTitle value={item.label} /></strong></div>
                    <div className="folio-row-actions">
                      <button type="button" className="action-text" onClick={() => selectFocus(item.key)}>查看联系</button>
                      <button type="button" className="action-text" onClick={() => onOpenAsset(item.asset)}>打开</button>
                    </div>
                  </li>
                ))}</ol>
                {graph.neighborAssets.length === 0 && <p>暂时没有共享标签的其他内容。</p>}
              </section>
            </>
          )}
        </aside>
      </div>
    </main>
  );
}

export default KnowledgePage;
