import { useMemo, useState, type CSSProperties } from 'react';
import type {
  LearningAssetHandle,
  LearningAssetLibrarySnapshot,
  LearningMaterial,
  SemanticRelation,
} from '../../shared/contracts';
import {
  buildLocalSemanticGraph,
  listSemanticGraphTags,
  type SemanticGraphAssociation,
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

function associationAction(
  item: SemanticGraphAssociation,
  selectFocus: (key: string) => void,
  onOpenMaterial?: (id: string) => void,
) {
  if (item.kind === 'material') {
    return item.materialId && onOpenMaterial
      ? <button type="button" className="action-text" onClick={() => onOpenMaterial(item.materialId!)}>打开资料</button>
      : null;
  }
  return (
    <button type="button" className="action-text" onClick={() => selectFocus(item.key)}>
      {item.kind === 'tag' ? '以此为中心' : '查看关系'}
    </button>
  );
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
  const tags = useMemo(() => listSemanticGraphTags(relations), [relations]);
  const visibleTags = tags.filter((tag) => (
    !query.trim() || tag.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())
  ));
  const nodeByKey = new Map(graph.nodes.map((node) => [node.key, node]));
  const selectedAsset = graph.focus?.asset ?? null;
  const selectFocus = (key: string) => {
    setFocus(key);
    onFocus(key);
  };

  if (!graph.focus) {
    return (
      <main className="knowledge-workspace knowledge-empty" aria-label="知识关系">
        <section>
          <small>Knowledge relations</small>
          <h1>知识关系</h1>
          <p>这里还没有形成带标签的笔记或题卡。先回到资料架继续学习，关系会随资产自然出现。</p>
          <button type="button" className="action-outline" onClick={onOpenAssets}>回到学习资料</button>
        </section>
      </main>
    );
  }

  return (
    <main className="knowledge-workspace" aria-label="知识关系">
      <aside className="knowledge-entry" aria-label="标签入口">
        <header>
          <small>Knowledge relations</small>
          <h1>知识关系</h1>
          <p>从一个词出发，只看它附近的学习内容。</p>
        </header>
        <label className="knowledge-search">
          <span>查找标签</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="例如：沉淀溶解平衡"
          />
        </label>
        <nav aria-label="入口词">
          {visibleTags.map((tag) => (
            <button
              type="button"
              key={tag}
              aria-current={graph.focus?.key === `tag:${tag}` ? 'true' : undefined}
              onClick={() => selectFocus(`tag:${tag}`)}
            >
              {tag}
            </button>
          ))}
          {visibleTags.length === 0 && <p>没有匹配的标签。</p>}
        </nav>
        <button type="button" className="action-text knowledge-back" onClick={onOpenAssets}>回到学习资料</button>
      </aside>

      <section className="semantic-stage" aria-label="局部关系图">
        <header>
          <div><small>Local view</small><h2>{graph.focus.label}</h2></div>
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
          {graph.nodes.map((node, index) => {
            const style = {
              '--node-x': `${node.x}%`,
              '--node-y': `${node.y}%`,
            } as CSSProperties;
            const contents = <><small>{node.detail}</small><strong>{node.label}</strong></>;
            if (node.kind === 'material') {
              return <span key={node.key} className="semantic-node" data-node-kind="material" style={style}>{contents}</span>;
            }
            return (
              <button
                type="button"
                key={node.key}
                className="semantic-node"
                data-node-kind={node.kind}
                data-focus={index === 0 ? 'true' : undefined}
                style={style}
                onClick={() => selectFocus(node.key)}
              >
                {contents}
              </button>
            );
          })}
        </div>
        <footer className="semantic-legend">
          <span data-edge-role="core">核心标签</span>
          <span data-edge-role="related">关联标签</span>
          <span data-edge-role="co-occurrence">共同出现</span>
          <p>共同出现只表示两个标签出现在同一资产中，不表示先修、相似或因果。</p>
        </footer>
      </section>

      <aside className="semantic-inspector" aria-label="关系检查器">
        <header>
          <small>{graph.focus.detail}</small>
          <h2>{graph.focus.label}</h2>
          {selectedAsset && (
            <div className="semantic-actions">
              <button type="button" className="action-outline" onClick={() => onOpenAsset(selectedAsset)}>打开内容</button>
              <button type="button" className="action-solid" onClick={() => onAskAsset(selectedAsset)}>
                {selectedAsset.kind === 'note' ? '带着这份笔记问老师' : '带着这道题问老师'}
              </button>
            </div>
          )}
        </header>
        <h3>全部关联 · {graph.associations.length}</h3>
        <ol>
          {graph.associations.map((item) => (
            <li key={item.key} data-association-role={item.role}>
              <div><small>{item.detail}</small><strong>{item.label}</strong></div>
              {associationAction(item, selectFocus, onOpenMaterial)}
            </li>
          ))}
        </ol>
      </aside>
    </main>
  );
}

export default KnowledgePage;
