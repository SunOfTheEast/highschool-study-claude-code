import type {
  LearningAssetReference,
  SourceTreeAsset,
  SourceTreeSnapshot,
} from '../../shared/contracts';
import { MarkdownView } from '../components/MarkdownView';

function referenceFor(asset: SourceTreeAsset): LearningAssetReference {
  return { kind: asset.kind, id: asset.id };
}

function assetCount(value: SourceTreeSnapshot['books'][number]): number {
  return new Set(
    [...value.chapters.flatMap((chapter) => chapter.assets), ...value.unresolved.assets]
      .map((asset) => `${asset.kind}:${asset.id}`),
  ).size;
}

function TreeAsset({
  value,
  onOpen,
}: {
  value: SourceTreeAsset;
  onOpen(): void;
}) {
  return (
    <button type="button" className="tree-asset" onClick={onOpen}>
      <span className="kind">{value.kind === 'note' ? 'NOTE' : 'PROBLEM'}</span>
      <span className="title"><MarkdownView inline>{value.title}</MarkdownView></span>
      <span className="where">{value.sourceLabel ?? '原文位置待核验'}</span>
    </button>
  );
}

export function SourceTreePage({
  value,
  onOpenBook,
  onOpenAsset,
  onOpenSemantic,
  onShowTypes,
  onImportBook,
}: {
  value: SourceTreeSnapshot;
  onOpenBook(id: string, mediaType: string): void;
  onOpenAsset(reference: LearningAssetReference): void;
  onOpenSemantic(): void;
  onShowTypes(): void;
  onImportBook?(): Promise<void>;
}) {
  const semanticTags = Array.from(new Set(value.books.flatMap((book) => (
    [...book.chapters.flatMap((chapter) => chapter.assets), ...book.unresolved.assets]
      .flatMap((asset) => [...(asset.tags?.core ?? []), ...(asset.tags?.related ?? [])])
  )))).slice(0, 5);

  return (
    <main className="source-library">
      <header className="source-library-head">
        <div><small>My learning assets</small><h1>我的学习资料</h1></div>
        <p>同一份笔记或题卡可以沿原书位置找到，也可以顺着语义标签跨书联想；它始终只有一份内容。</p>
      </header>
      <nav className="library-view-tabs" aria-label="学习资料视图">
        <button type="button" aria-current="page">沿书学习</button>
        <button type="button" onClick={onShowTypes}>按类型查看</button>
        <button type="button" onClick={onOpenSemantic}>知识之间</button>
      </nav>
      <div className="source-library-grid">
        <section>
          {value.books.map((book) => (
            <article className="source-tree-book" key={`${book.materialId}@${book.revision}`}>
              <header>
                <span className="tree-book-mark" aria-hidden="true">原<br />书</span>
                <div>
                  <h2>{book.title}</h2>
                  <p>{assetCount(book)} 份学习资产 · {book.pageCount ?? '未知'} 个物理页</p>
                </div>
                <button type="button" onClick={() => onOpenBook(book.materialId, book.mediaType)}>
                  {book.mediaType === 'application/pdf' ? '打开这本书' : '打开这份资料'}
                </button>
              </header>
              {book.chapters.map((chapter) => (
                <section className="source-tree-chapter" key={chapter.id}>
                  <header>
                    <h3>{chapter.title}</h3>
                    <span>{chapter.assets.length > 0 ? `${chapter.assets.length} 份资产` : '尚未形成资产'}</span>
                  </header>
                  {chapter.assets.length > 0 && (
                    <div className="tree-assets">
                      {chapter.assets.map((asset) => (
                        <TreeAsset
                          key={`${asset.kind}:${asset.id}`}
                          value={asset}
                          onOpen={() => onOpenAsset(referenceFor(asset))}
                        />
                      ))}
                    </div>
                  )}
                </section>
              ))}
              {book.unresolved.assets.length > 0 && (
                <section className="source-tree-chapter source-tree-unresolved">
                  <header><h3>{book.unresolved.title}</h3><span>{book.unresolved.assets.length} 份资产</span></header>
                  <div className="tree-assets">
                    {book.unresolved.assets.map((asset) => (
                      <TreeAsset
                        key={`${asset.kind}:${asset.id}`}
                        value={asset}
                        onOpen={() => onOpenAsset(referenceFor(asset))}
                      />
                    ))}
                  </div>
                </section>
              )}
            </article>
          ))}
          {value.books.length === 0 && (
            <p className="m1b-empty">还没有原书。放入一本 PDF 后，目录和从中长出的内容会出现在这里。</p>
          )}
          <section className="source-outside">
            <h2>书外生长</h2>
            <p>自由讨论形成、但没有直接引用原书的内容会留在这里；它不是错误，也不会被强行挂到某一章。</p>
            {value.outside.map((asset) => (
              <TreeAsset
                key={`${asset.kind}:${asset.id}`}
                value={asset}
                onOpen={() => onOpenAsset(referenceFor(asset))}
              />
            ))}
          </section>
        </section>
        <aside className="source-library-side">
          <section>
            <small>Semantic view</small>
            <h2>换一个方向找</h2>
            <p>来源树回答“从哪本书长出来”；语义关系回答“还和什么有关”。二者互相跳转，不要求学生维护图。</p>
            {semanticTags.length > 0 && (
              <div className="semantic-jump">
                {semanticTags.map((tag) => (
                  <button type="button" key={tag} onClick={onOpenSemantic}>{tag}<span>查看联系 →</span></button>
                ))}
              </div>
            )}
          </section>
          <section>
            <h2>再放一本书</h2>
            <p>新资料保留自己的目录与原文。只有真实形成的资产和明确标签，才会把它与已有内容连起来。</p>
            {onImportBook && <button type="button" className="action-outline" onClick={() => void onImportBook()}>导入 PDF</button>}
          </section>
        </aside>
      </div>
    </main>
  );
}

export default SourceTreePage;
