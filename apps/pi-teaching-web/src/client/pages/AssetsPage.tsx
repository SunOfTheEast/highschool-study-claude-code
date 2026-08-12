import { useState, type FormEvent } from 'react';
import type {
  LearningAssetLibrarySnapshot,
  LearningAssetReference,
  LearningAssetSummary,
  LearningMaterial,
} from '../../shared/contracts';
import { AssetSources, AssetTags } from '../components/AssetSources';
import { MarkdownView } from '../components/MarkdownView';
import { filterAssetLibrary } from '../asset-library-filter';
import { publicErrorText } from '../public-errors';

export type MaterialUploadInput = { title: string; file: File };

function AssetRow({
  asset,
  selected,
  onToggle,
  onOpen,
  onTag,
}: {
  asset: LearningAssetSummary;
  selected: boolean;
  onToggle(): void;
  onOpen(): void;
  onTag(tag: string): void;
}) {
  return (
    <article className="m1b-asset-row" data-selected={selected ? 'true' : 'false'}>
      <label>
        <input type="checkbox" checked={selected} onChange={onToggle} />
        <span className="sr-only">选择 <MarkdownView inline>{asset.title}</MarkdownView></span>
      </label>
      <button type="button" onClick={onOpen}>
        <small>{asset.kind === 'note' ? 'NOTE' : 'PROBLEM'}</small>
        <b><MarkdownView inline>{asset.title}</MarkdownView></b>
        <span>第 {asset.revision} 版</span>
      </button>
      <AssetTags value={asset.tags} onTag={onTag} />
      <AssetSources value={asset.sources} />
    </article>
  );
}

export function AssetsPage({
  value,
  materials = [],
  onOpen,
  onOpenMaterial,
  onAsk,
  onReview,
  onImport,
  onImportBook,
  onOpenFootprint,
  onOpenKnowledge,
  onShowSources,
}: {
  value: LearningAssetLibrarySnapshot;
  materials?: LearningMaterial[];
  onOpen(reference: LearningAssetReference): void;
  onOpenMaterial?(id: string): void;
  onAsk(references: LearningAssetReference[]): void;
  onReview?(references: LearningAssetReference[]): void;
  onImport?(input: MaterialUploadInput): Promise<void>;
  onImportBook?(title: string): Promise<void>;
  onOpenFootprint?(): void;
  onOpenKnowledge?(): void;
  onShowSources?(): void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [query, setQuery] = useState('');
  const [tag, setTag] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const all = [...value.notes, ...value.problemCards];
  const filtered = filterAssetLibrary(value, materials, { query, tag });
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
    setImportError(null);
    void onImport({ title: title.trim() || file.name, file }).then(() => {
      setTitle('');
      setFile(null);
    }).catch((error: unknown) => setImportError(materialImportErrorText(error)));
  };
  const chooseBook = () => {
    if (!onImportBook) return;
    setImportError(null);
    void onImportBook(title.trim()).then(() => setTitle(''))
      .catch((error: unknown) => setImportError(materialImportErrorText(error)));
  };
  return (
    <main className="m1b-assets">
      <header>
        <div><small>My learning assets</small><h1>我的学习资料</h1></div>
        <div className="asset-header-actions">
          <button
            className="action-solid"
            type="button"
            disabled={selectedReferences.length === 0}
            onClick={() => onAsk(selectedReferences)}
          >
            带着所选问老师 · {selectedReferences.length}
          </button>
          {onReview && (
            <button
              className="action-text"
              type="button"
              disabled={selectedReferences.length === 0}
              onClick={() => onReview(selectedReferences)}
            >
              复习所选
            </button>
          )}
        </div>
        <nav className="asset-header-links">
          <button type="button" className="action-text" onClick={onOpenKnowledge}>知识图谱</button>
          <button type="button" className="action-text" onClick={onOpenFootprint}>学习足迹</button>
        </nav>
      </header>
      {onShowSources && (
        <nav className="library-view-tabs" aria-label="学习资料视图">
          <button type="button" onClick={onShowSources}>沿书学习</button>
          <button type="button" aria-current="page">按类型查看</button>
          <button type="button" onClick={onOpenKnowledge}>知识之间</button>
        </nav>
      )}
      <section className="asset-library-filter" aria-label="查找学习资料">
        <label>
          <span className="sr-only">查找学习资料</span>
          <input
            type="search"
            value={query}
            placeholder="搜索标题、正文、来源或标签"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        {tag && (
          <button type="button" className="action-text" onClick={() => setTag(null)}>
            标签：{tag} · 清除
          </button>
        )}
      </section>
      <section>
        <header><span>Materials</span><h2>原始资料</h2><b>{filtered.materials.length}</b></header>
        <form className="m1c-material-upload" onSubmit={submitMaterial}>
          <label>资料标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          {onImportBook ? (
            <button type="button" onClick={chooseBook}>选择 PDF</button>
          ) : (
            <>
              <label>选择文件<input type="file" onChange={(event) => setFile(event.target.files?.[0] ?? null)} /></label>
              <button type="submit" disabled={!file || !onImport}>上传资料</button>
            </>
          )}
        </form>
        {importError && <p className="inline-error" role="alert">{importError}</p>}
        {filtered.materials.map((material) => {
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
        {filtered.materials.length === 0 && <p className="m1b-empty">没有符合当前条件的原始资料。</p>}
      </section>
      <section>
        <header><span>Notes</span><h2>笔记与闪卡</h2><b>{filtered.notes.length}</b></header>
        {filtered.notes.map((asset) => (
          <AssetRow
            key={`note:${asset.id}`}
            asset={asset}
            selected={selected.includes(`note:${asset.id}`)}
            onToggle={() => toggle(asset)}
            onOpen={() => onOpen({ kind: 'note', id: asset.id })}
            onTag={setTag}
          />
        ))}
        {filtered.notes.length === 0 && <p className="m1b-empty">没有符合当前条件的 Note。</p>}
      </section>
      <section>
        <header><span>Problems</span><h2>题卡</h2><b>{filtered.problemCards.length}</b></header>
        {filtered.problemCards.map((asset) => (
          <AssetRow
            key={`problem-card:${asset.id}`}
            asset={asset}
            selected={selected.includes(`problem-card:${asset.id}`)}
            onToggle={() => toggle(asset)}
            onOpen={() => onOpen({ kind: 'problem-card', id: asset.id })}
            onTag={setTag}
          />
        ))}
        {filtered.problemCards.length === 0 && <p className="m1b-empty">没有符合当前条件的题卡。</p>}
      </section>
    </main>
  );
}

export function materialImportErrorText(error: unknown): string {
  return publicErrorText(error, '资料暂时没有导入，请稍后再试。');
}

export default AssetsPage;
