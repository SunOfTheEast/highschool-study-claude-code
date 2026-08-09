import { useState, type FormEvent } from 'react';
import type {
  LearningAssetLibrarySnapshot,
  LearningAssetReference,
  LearningAssetSummary,
  LearningMaterial,
} from '../../shared/contracts';
import { AssetSources, AssetTags } from '../components/AssetSources';

export type MaterialUploadInput = { title: string; file: File };

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
    <article className="m1b-asset-row" data-selected={selected ? 'true' : 'false'}>
      <label>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <span className="sr-only">选择 {asset.title}</span>
      </label>
      <button type="button" onClick={onOpen}>
        <small>{asset.kind === 'note' ? 'NOTE' : 'PROBLEM'}</small>
        <strong>{asset.title}</strong>
        <span>第 {asset.revision} 版</span>
        <AssetTags value={asset.tags} />
        <AssetSources value={asset.sources} />
      </button>
    </article>
  );
}

export function AssetsPage({
  value,
  materials = [],
  onOpen,
  onOpenMaterial,
  onAsk,
  onImport,
  onOpenFootprint,
  onOpenKnowledge,
}: {
  value: LearningAssetLibrarySnapshot;
  materials?: LearningMaterial[];
  onOpen(reference: LearningAssetReference): void;
  onOpenMaterial?(id: string): void;
  onAsk(references: LearningAssetReference[]): void;
  onImport?(input: MaterialUploadInput): Promise<void>;
  onOpenFootprint?(): void;
  onOpenKnowledge?(): void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
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
  const submitMaterial = (event: FormEvent) => {
    event.preventDefault();
    if (!file || !onImport) return;
    void onImport({ title: title.trim() || file.name, file }).then(() => {
      setTitle('');
      setFile(null);
    });
  };
  return (
    <main className="m1b-assets">
      <header>
        <div><small>My learning assets</small><h1>我的学习资料</h1></div>
        <button
          className="action-solid"
          type="button"
          disabled={selectedReferences.length === 0}
          onClick={() => onAsk(selectedReferences)}
        >
          带着所选问老师 · {selectedReferences.length}
        </button>
        <nav className="asset-header-links">
          <button type="button" className="action-text" onClick={onOpenKnowledge}>知识关系</button>
          <button type="button" className="action-text" onClick={onOpenFootprint}>学习足迹</button>
        </nav>
      </header>
      <section>
        <header><span>Materials</span><h2>原始资料</h2><b>{materials.length}</b></header>
        <form className="m1c-material-upload" onSubmit={submitMaterial}>
          <label>资料标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          <label>选择文件<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
          <button type="submit" disabled={!file || !onImport}>上传资料</button>
        </form>
        {materials.map((material) => {
          const current = material.revisions.find((revision) => (
            revision.revision === material.currentRevision
          ))!;
          const status = current.searchStatus === 'unavailable'
            ? '资料暂不可搜索'
            : current.searchStatus === 'image-readable'
              ? '原图可阅读'
              : '正文可搜索';
          return (
            <article className="m1b-asset-row m1c-material-row" key={material.id}>
              <button type="button" onClick={() => onOpenMaterial?.(material.id)}>
                <small>MATERIAL</small>
                <strong>{current.title}</strong>
                <span>第 {current.revision} 版 · {status}</span>
              </button>
            </article>
          );
        })}
        {materials.length === 0 && <p className="m1b-empty">还没有原始资料。</p>}
      </section>
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
