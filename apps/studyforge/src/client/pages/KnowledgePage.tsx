import { useMemo, useState } from 'react';
import type {
  KnowledgeMethodNode,
  KnowledgeSnapshot,
} from '../../shared/contracts';

export function filterKnowledge(
  value: KnowledgeSnapshot,
  query: string,
): KnowledgeSnapshot {
  const term = query.trim().toLowerCase();
  if (!term) return value;
  return {
    methods: value.methods.filter((method) => (
      `${method.id}\n${method.name}`.toLowerCase().includes(term)
    )),
    cards: value.cards.filter((card) => (
      [
        card.id,
        card.path,
        card.title,
        card.primaryMethod ?? '',
        ...card.supportingMethods,
      ].join('\n').toLowerCase().includes(term)
    )),
    materials: value.materials.filter((material) => (
      `${material.path}\n${material.title}\n${material.kind}`.toLowerCase().includes(term)
    )),
  };
}

function MethodBranch({
  node,
  byId,
  selected,
  onSelect,
}: {
  node: KnowledgeMethodNode;
  byId: Map<string, KnowledgeMethodNode>;
  selected: string;
  onSelect(id: string): void;
}) {
  return (
    <li>
      <button
        type="button"
        aria-current={node.id === selected ? 'true' : undefined}
        onClick={() => onSelect(node.id)}
      >
        <span>{node.name}</span>
        <small>{node.children.length}</small>
      </button>
      {node.children.length > 0 && (
        <ol>
          {node.children.flatMap((id) => {
            const child = byId.get(id);
            return child ? [
              <MethodBranch
                key={child.id}
                node={child}
                byId={byId}
                selected={selected}
                onSelect={onSelect}
              />,
            ] : [];
          })}
        </ol>
      )}
    </li>
  );
}

export function KnowledgePage({ value }: { value: KnowledgeSnapshot }) {
  const [query, setQuery] = useState('');
  const root = value.methods.find((method) => method.parentId === null) ?? value.methods[0];
  const [selectedId, setSelectedId] = useState(root?.id ?? '');
  const byId = useMemo(
    () => new Map(value.methods.map((method) => [method.id, method])),
    [value.methods],
  );
  const filtered = filterKnowledge(value, query);
  const selected = byId.get(selectedId) ?? root ?? null;
  const relatedCards = selected
    ? value.cards.filter((card) => (
      card.primaryMethod === selected.name || card.supportingMethods.includes(selected.name)
    ))
    : [];
  const cards = query ? filtered.cards : relatedCards.length > 0 ? relatedCards : value.cards;
  const empty = value.methods.length === 0
    && value.cards.length === 0
    && value.materials.length === 0;

  if (empty) {
    return (
      <main
        className="knowledge-workspace knowledge-workspace-empty"
        aria-label="知识山河"
      >
        <header className="knowledge-heading">
          <div>
            <small>Static learning assets</small>
            <h1>知识山河</h1>
            <p>这里展示学习集本身的方法骨架、题卡与材料，不叠加个人能力判断。</p>
          </div>
        </header>
        <section className="knowledge-empty-state">
          <small>Course remains available</small>
          <h2>当前学习集没有预置静态资产</h2>
          <p>课程仍可使用你提供的材料，以及老师为当前目标准备的任务。</p>
        </section>
      </main>
    );
  }

  return (
    <main className="knowledge-workspace" aria-label="知识山河">
      <header className="knowledge-heading">
        <div>
          <small>Static learning assets</small>
          <h1>知识山河</h1>
          <p>这里展示学习集本身的方法骨架、题卡与材料，不叠加个人能力判断。</p>
        </div>
        <label className="knowledge-search">
          <span>查找资产</span>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="方法、题卡编号或材料名"
          />
        </label>
      </header>

      <section className="method-column" aria-label="方法图谱">
        <header><span>Method graph</span><h2>方法骨架</h2></header>
        {root ? (
          <ol className="method-tree">
            <MethodBranch
              node={root}
              byId={byId}
              selected={selectedId}
              onSelect={setSelectedId}
            />
          </ol>
        ) : <p>当前学习集还没有方法图谱。</p>}
      </section>

      <section className="asset-column" aria-label="题卡资产">
        <header>
          <span>{query ? `搜索 · ${query}` : selected?.name ?? '全部题卡'}</span>
          <h2>题卡</h2>
          <b>{cards.length}</b>
        </header>
        <div className="asset-list">
          {cards.map((card) => (
            <article key={card.path}>
              <small>{card.id}</small>
              <h3>{card.title}</h3>
              <p>
                {card.primaryMethod && <span>主方法 · {card.primaryMethod}</span>}
                {card.supportingMethods.length > 0 && (
                  <span>辅助 · {card.supportingMethods.join('、')}</span>
                )}
              </p>
              <code>{card.path}</code>
            </article>
          ))}
          {cards.length === 0 && <p className="asset-empty">没有匹配的题卡。</p>}
        </div>
      </section>

      <aside className="material-column" aria-label="学习材料">
        <header><span>Materials</span><h2>材料</h2></header>
        <div className="material-list">
          {(query ? filtered.materials : value.materials).map((material) => (
            <article key={material.path}>
              <small>{material.kind}</small>
              <strong>{material.title}</strong>
              <code>{material.path}</code>
            </article>
          ))}
          {(query ? filtered.materials : value.materials).length === 0 && (
            <p className="asset-empty">没有匹配的材料。</p>
          )}
        </div>
      </aside>
    </main>
  );
}

export default KnowledgePage;
