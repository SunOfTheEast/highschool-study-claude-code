import { useState } from 'react';
import type {
  LearningAssetLibrarySnapshot,
  LearningAssetReference,
  LearningAssetSummary,
} from '../../shared/contracts';

function AssetRow({
  asset,
  selected,
  onToggle,
  onOpen,
}: {
  asset: LearningAssetSummary;
  selected: boolean;
  onToggle(): void;
  onOpen(): void;
}) {
  return (
    <article className="m1b-asset-row">
      <label>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <span className="sr-only">选择 {asset.title}</span>
      </label>
      <button type="button" onClick={onOpen}>
        <small>{asset.kind === 'note' ? 'NOTE' : 'PROBLEM'}</small>
        <strong>{asset.title}</strong>
        <span>revision {asset.revision}</span>
      </button>
    </article>
  );
}

export function AssetsPage({
  value,
  onOpen,
  onAsk,
}: {
  value: LearningAssetLibrarySnapshot;
  onOpen(reference: LearningAssetReference): void;
  onAsk(references: LearningAssetReference[]): void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const all = [...value.notes, ...value.problemCards];
  const toggle = (asset: LearningAssetSummary) => {
    const key = `${asset.kind}:${asset.id}`;
    setSelected((current) => current.includes(key)
      ? current.filter((item) => item !== key)
      : [...current, key]);
  };
  const selectedReferences = all.flatMap((asset) => (
    selected.includes(`${asset.kind}:${asset.id}`)
      ? [{ kind: asset.kind, id: asset.id }]
      : []
  ));
  return (
    <main className="m1b-assets">
      <header>
        <div><small>My learning assets</small><h1>我的学习资料</h1></div>
        <button
          type="button"
          disabled={selectedReferences.length === 0}
          onClick={() => onAsk(selectedReferences)}
        >
          带着所选内容问老师
        </button>
      </header>
      <section>
        <header><span>Notes</span><h2>笔记与闪卡</h2><b>{value.notes.length}</b></header>
        {value.notes.map((asset) => (
          <AssetRow
            key={`note:${asset.id}`}
            asset={asset}
            selected={selected.includes(`note:${asset.id}`)}
            onToggle={() => toggle(asset)}
            onOpen={() => onOpen({ kind: 'note', id: asset.id })}
          />
        ))}
        {value.notes.length === 0 && <p className="m1b-empty">还没有 Note。</p>}
      </section>
      <section>
        <header><span>Problems</span><h2>题卡</h2><b>{value.problemCards.length}</b></header>
        {value.problemCards.map((asset) => (
          <AssetRow
            key={`problem-card:${asset.id}`}
            asset={asset}
            selected={selected.includes(`problem-card:${asset.id}`)}
            onToggle={() => toggle(asset)}
            onOpen={() => onOpen({ kind: 'problem-card', id: asset.id })}
          />
        ))}
        {value.problemCards.length === 0 && <p className="m1b-empty">还没有题卡。</p>}
      </section>
    </main>
  );
}

export default AssetsPage;

