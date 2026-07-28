import type { AbilityProjection } from '../../shared/contracts';

const stateLabel = {
  unobserved: '待观察',
  unstable: '不稳定',
  steady: '较稳',
} as const;

export function AbilityMap({
  value,
  onOpen,
  embedded = false,
}: {
  value: AbilityProjection | null;
  onOpen(source: string): void;
  embedded?: boolean;
}) {
  const Root = embedded ? 'div' : 'aside';
  return (
    <Root className={embedded ? 'ability-map embedded' : 'activities ability-map'}>
      {!embedded && <header>
        <span>Evidence map</span>
        <h2>方法证据</h2>
      </header>}
      {!value && <p className="notebook-loading">正在聚合 Trace…</p>}
      {value?.nodes.length === 0 && (
        <div className="coach-note"><span>○</span><p>还没有可聚合的题卡 Trace。课堂产生证据后，这里会出现方法节点。</p></div>
      )}
      <div className="ability-nodes">
        {value?.nodes.map((node) => (
          <button
            key={node.method}
            type="button"
            data-state={node.state}
            disabled={node.sources.length === 0}
            onClick={() => node.sources[0] && onOpen(node.sources[0])}
          >
            <span className="ability-halo" aria-hidden="true" />
            <span className="ability-copy">
              <small>{stateLabel[node.state]} · {node.evidenceCount} 条证据</small>
              <b>{node.method}</b>
            </span>
            <i>{Math.round(node.score * 100)}</i>
          </button>
        ))}
      </div>
      <p className="ability-footnote">分数只用于排序注意力；点击节点可回到原始 Trace。</p>
    </Root>
  );
}
