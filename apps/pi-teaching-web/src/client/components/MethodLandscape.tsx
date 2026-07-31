import { useMemo, useState } from 'react';
import type {
  KnowledgeGraphEdge,
  KnowledgeGraphNode,
} from '../../shared/view-contracts';
import { layoutMethodTree } from '../method-layout';

const stateLabel = {
  unobserved: '尚未观察',
  observed: '已有学习记录',
  'more-stable': '在不同题卡上更稳定',
  invalidated: '来源后来被修正',
} as const;

export function MethodLandscape({
  nodes,
  edges,
  onSelect,
}: {
  nodes: KnowledgeGraphNode[];
  edges: KnowledgeGraphEdge[];
  onSelect(node: KnowledgeGraphNode): void;
}) {
  const [scale, setScale] = useState(1);
  const positioned = useMemo(() => layoutMethodTree(nodes), [nodes]);
  const byId = new Map(positioned.map((node) => [node.id, node]));
  const width = Math.max(560, ...positioned.map((node) => node.x + 260));
  const height = Math.max(300, ...positioned.map((node) => node.y + 100));
  return (
    <section className="method-landscape" aria-label="方法骨架">
      <header>
        <span>正式方法树</span>
        <div className="landscape-zoom" aria-label="缩放方法骨架">
          <button
            type="button"
            onClick={() => setScale((value) => Math.max(.7, value - .1))}
          >
            缩小
          </button>
          <button type="button" onClick={() => setScale(1)}>复位</button>
          <button
            type="button"
            onClick={() => setScale((value) => Math.min(1.5, value + .1))}
          >
            放大
          </button>
        </div>
      </header>
      {nodes.length === 0 ? (
        <p>这个分区里暂时没有方法节点。</p>
      ) : (
        <>
          <div className="method-canvas-scroll">
            <div
              className="method-canvas"
              style={{
                width,
                height,
                transform: `scale(${scale})`,
                transformOrigin: 'left top',
              }}
            >
              <svg width={width} height={height} aria-hidden="true">
                {edges.map((edge) => {
                  const from = byId.get(edge.from);
                  const to = byId.get(edge.to);
                  return from && to ? (
                    <path
                      key={edge.id}
                      d={`M ${from.x + 180} ${from.y + 28} L ${to.x} ${to.y + 28}`}
                    />
                  ) : null;
                })}
              </svg>
              {positioned.map((node) => (
                <button
                  key={node.id}
                  type="button"
                  className="method-node"
                  data-state={node.state}
                  data-current-lesson={node.currentLesson || undefined}
                  aria-current={node.selected ? 'true' : undefined}
                  style={{ left: node.x, top: node.y }}
                  onClick={() => onSelect(node)}
                >
                  <strong>{node.label}</strong>
                  <small>{stateLabel[node.state]}</small>
                  {node.distinctCardCount > 0 && (
                    <span>{node.distinctCardCount} 张不同题卡</span>
                  )}
                  {node.currentLesson && <em>本课相关</em>}
                </button>
              ))}
            </div>
          </div>
          <ol className="method-list-fallback">
            {positioned.map((node) => (
              <li key={node.id} style={{ '--method-depth': node.depth } as React.CSSProperties}>
                <button type="button" onClick={() => onSelect(node)}>
                  <strong>{node.label}</strong>
                  <small>{stateLabel[node.state]}</small>
                </button>
              </li>
            ))}
          </ol>
        </>
      )}
    </section>
  );
}

export default MethodLandscape;
