import { useMemo, useState, type FormEvent } from 'react';
import type {
  ContentSearchHit,
  ContentSearchResult,
} from '../../shared/contracts';
import { StudentCard } from './StudentCard';

type Filter = 'all' | ContentSearchHit['kind'];

const filterLabel: Record<Filter, string> = {
  all: '全部',
  card: '题卡',
  method: '方法',
  material: '材料',
};

const kindLabel: Record<ContentSearchHit['kind'], string> = {
  card: '题卡',
  method: '方法',
  material: '材料',
};

export function ContentExplorer({
  initialResult = { query: '', hits: [] },
  onClose,
  onEvidence,
  onSearch,
}: {
  initialResult?: ContentSearchResult;
  onClose(): void;
  onEvidence(source: string): void;
  onSearch(query: string): Promise<ContentSearchResult>;
}) {
  const [query, setQuery] = useState(initialResult.query);
  const [result, setResult] = useState(initialResult);
  const [filter, setFilter] = useState<Filter>('all');
  const [selectedId, setSelectedId] = useState(initialResult.hits[0]?.id ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const filtered = useMemo(() => (
    filter === 'all' ? result.hits : result.hits.filter((hit) => hit.kind === filter)
  ), [filter, result]);
  const selected = filtered.find((hit) => hit.id === selectedId) ?? filtered[0] ?? null;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setError('');
    try {
      const next = await onSearch(query);
      setResult(next);
      setSelectedId(next.hits[0]?.id ?? '');
    } catch {
      setError('无法读取研习资料，请稍后重试。');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="content-explorer-overlay" role="presentation">
      <button
        type="button"
        className="content-explorer-scrim"
        aria-label="关闭研习资料"
        onClick={onClose}
      />
      <section
        className="content-explorer"
        role="dialog"
        aria-modal="true"
        aria-label="研习资料"
      >
        <header>
          <div><span>真实资产与学习记录</span><h2>研习资料</h2></div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        <form className="content-search" onSubmit={(event) => void submit(event)}>
          <input
            type="search"
            value={query}
            placeholder="搜索题卡、方法、材料或学习记录…"
            aria-label="搜索研习资料"
            onChange={(event) => setQuery(event.target.value)}
          />
          <button type="submit" disabled={loading}>{loading ? '查找中…' : '查找'}</button>
        </form>
        <div className="content-filters" aria-label="资料类型">
          {(Object.keys(filterLabel) as Filter[]).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {filterLabel[value]}
            </button>
          ))}
        </div>
        {error && <p className="content-search-error" role="alert">{error}</p>}
        <div className="content-explorer-body">
          <nav className="content-results" aria-label="研习资料结果">
            {filtered.map((hit) => (
              <button
                type="button"
                key={hit.id}
                data-selected={selected?.id === hit.id ? 'true' : 'false'}
                onClick={() => setSelectedId(hit.id)}
              >
                <small>{kindLabel[hit.kind]} · {hit.matchedBy === 'trace' ? '学习记录命中' : '资料命中'}</small>
                <b>{hit.title}</b>
                <span>{hit.subtitle}</span>
              </button>
            ))}
            {!loading && result.query && filtered.length === 0 && (
              <div className="content-empty">
                <b>没有找到真实资料</b>
                <p>可以缩短关键词，或返回学习顾问调整本节课的资料范围。</p>
              </div>
            )}
            {!result.query && filtered.length === 0 && (
              <div className="content-empty">
                <b>从一个关键词开始</b>
                <p>这里不会编造题卡或不存在的来源。</p>
              </div>
            )}
          </nav>
          <article className="content-detail">
            {selected ? (
              <>
                <header>
                  <small>{kindLabel[selected.kind]}</small>
                  <h3>{selected.title}</h3>
                  <p>{selected.matchReason}</p>
                </header>
                <code className="content-source">{selected.source}</code>
                {selected.card && (
                  <StudentCard alias={selected.id} card={selected.card} />
                )}
                {selected.preview && <blockquote>{selected.preview}</blockquote>}
                <section className="content-traces">
                  <h4>相关学习记录</h4>
                  {selected.traceHistory.length === 0 ? (
                    <p>这份资料还没有相关学习记录。</p>
                  ) : (
                    <ol>
                      {selected.traceHistory.map((trace) => (
                        <li key={trace.source}>
                          <small>{trace.assessment} · {trace.support}</small>
                          <p>{trace.note}</p>
                          <button type="button" onClick={() => onEvidence(trace.source)}>
                            {trace.source}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </section>
              </>
            ) : <p className="content-detail-empty">选择一条结果查看来源与学习记录。</p>}
          </article>
        </div>
      </section>
    </div>
  );
}
