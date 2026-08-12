import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type {
  LearningContextReference,
  LearningAssetReference,
  LearningMaterialView,
  MaterialBookIndex,
  MaterialPageReadReceipt,
  MaterialLocatorSnapshot,
  SourceTreeBook,
  SourceTreeAsset,
} from '../../shared/contracts';
import { MarkdownView } from '../components/MarkdownView';
import { formatMaterialLocator } from '../material-locator';
import { publicErrorText } from '../public-errors';

type MaterialContext = Extract<LearningContextReference, { kind: 'material' }>;
type LocatorKind = LearningMaterialView['current']['locatorKind'];
type MaterialLocatorInput = { page: number; start: number; end: number };

export function parseMaterialLocatorInput(
  kind: LocatorKind,
  locator: string | null,
): MaterialLocatorInput {
  if (kind === 'page') {
    const match = /^page-([0-9]{4})$/.exec(locator ?? '');
    return { page: match ? Number(match[1]) : 1, start: 1, end: 80 };
  }
  if (kind === 'lines') {
    const match = /^lines-([1-9][0-9]*)-([1-9][0-9]*)$/.exec(locator ?? '');
    return {
      page: 1,
      start: match ? Number(match[1]) : 1,
      end: match ? Number(match[2]) : 80,
    };
  }
  return { page: 1, start: 1, end: 80 };
}

export function buildMaterialLocator(
  kind: LocatorKind,
  input: MaterialLocatorInput,
): string | null {
  if (kind === 'page') {
    return Number.isSafeInteger(input.page) && input.page > 0 && input.page <= 9_999
      ? `page-${String(input.page).padStart(4, '0')}`
      : null;
  }
  if (kind === 'lines') {
    return Number.isSafeInteger(input.start)
      && Number.isSafeInteger(input.end)
      && input.start > 0
      && input.end >= input.start
      ? `lines-${input.start}-${input.end}`
      : null;
  }
  return null;
}

function publicStatus(value: LearningMaterialView['current']['searchStatus']): string {
  if (value === 'unavailable') return '资料暂不可搜索';
  if (value === 'image-readable') return '原图可阅读';
  return '正文可搜索';
}

export function MaterialPage({
  value,
  onRead,
  onAsk,
}: {
  value: LearningMaterialView;
  onRead(locator: string | null): Promise<MaterialLocatorSnapshot>;
  onAsk(reference: MaterialContext): void;
}) {
  const suggested = value.suggestedLocator;
  const suggestedLabel = formatMaterialLocator(suggested);
  const initialInput = parseMaterialLocatorInput(value.current.locatorKind, suggested);
  const [page, setPage] = useState(initialInput.page);
  const [lineStart, setLineStart] = useState(initialInput.start);
  const [lineEnd, setLineEnd] = useState(initialInput.end);
  const [source, setSource] = useState<MaterialLocatorSnapshot | null>(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedKey = useRef<string | null>(null);
  const readRef = useRef(onRead);
  useEffect(() => { readRef.current = onRead; }, [onRead]);

  useEffect(() => {
    const key = `${value.material.id}@${value.current.revision}#${suggested ?? 'whole'}`;
    const next = parseMaterialLocatorInput(value.current.locatorKind, suggested);
    setPage(next.page);
    setLineStart(next.start);
    setLineEnd(next.end);
    setSource(null);
    setError(null);
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setReading(true);
    void readRef.current(suggested)
      .then(setSource)
      .catch((reason: unknown) => {
        setError(publicErrorText(reason, '资料暂时无法读取，请稍后再试。'));
      })
      .finally(() => setReading(false));
  }, [value.material.id, value.current.revision, value.current.locatorKind, suggested]);

  const readLocator = (locator: string | null) => {
    setReading(true);
    setError(null);
    void onRead(locator)
      .then(setSource)
      .catch((reason: unknown) => {
        setError(publicErrorText(reason, '资料暂时无法读取，请稍后再试。'));
      })
      .finally(() => setReading(false));
  };
  const input = { page, start: lineStart, end: lineEnd };
  const selected = buildMaterialLocator(value.current.locatorKind, input);
  const readSelected = () => {
    if (value.current.locatorKind !== null && selected === null) return;
    readLocator(selected);
  };
  const movePage = (delta: -1 | 1) => {
    const nextPage = Math.max(1, page + delta);
    setPage(nextPage);
    readLocator(buildMaterialLocator('page', { ...input, page: nextPage }));
  };
  const moveLines = (delta: -1 | 1) => {
    const width = Math.max(1, lineEnd - lineStart + 1);
    const nextStart = delta === 1 ? lineEnd + 1 : Math.max(1, lineStart - width);
    const nextEnd = nextStart + width - 1;
    setLineStart(nextStart);
    setLineEnd(nextEnd);
    readLocator(buildMaterialLocator('lines', { ...input, start: nextStart, end: nextEnd }));
  };
  const resolved = source ? formatMaterialLocator(source.locator) : null;

  return (
    <main className="m1c-material-page asset-reading-page">
      <header>
        <small>原始资料 · 第 {value.current.revision} 版</small>
        <h1>{value.current.title}</h1>
        <p>{value.current.originalFilename} · {publicStatus(value.current.searchStatus)}</p>
      </header>

      <section className="material-reading-location" aria-label="资料位置">
        <div>
          <small>{source ? '当前显示' : '建议位置'} · {resolved?.human ?? suggestedLabel.human}</small>
        </div>
        <button
          type="button"
          className="action-solid"
          disabled={!source}
          onClick={() => source && onAsk({
            kind: 'material',
            id: source.id,
            revision: source.revision,
            locator: source.locator,
          })}
        >
          {source ? '带着当前内容问老师' : '读取后可问老师'}
        </button>
      </section>

      {value.current.locatorKind !== null && (
        <section className="m1c-material-locator">
          {value.current.locatorKind === 'page' ? (
            <>
              <button type="button" className="action-text" disabled={reading || page <= 1} onClick={() => movePage(-1)}>上一页</button>
              <label>页码<input type="number" min="1" value={page} onChange={(event) => setPage(Number(event.target.value))} /></label>
              <button type="button" className="action-text" disabled={reading} onClick={() => movePage(1)}>下一页</button>
            </>
          ) : (
            <>
              <button type="button" className="action-text" disabled={reading || lineStart <= 1} onClick={() => moveLines(-1)}>上一段</button>
              <label>起始行<input type="number" min="1" value={lineStart} onChange={(event) => setLineStart(Number(event.target.value))} /></label>
              <label>结束行<input type="number" min={lineStart} value={lineEnd} onChange={(event) => setLineEnd(Number(event.target.value))} /></label>
              <button type="button" className="action-text" disabled={reading} onClick={() => moveLines(1)}>下一段</button>
            </>
          )}
          <button type="button" className="action-wash" disabled={reading || selected === null} onClick={readSelected}>
            {reading ? '正在读取…' : '读取这个位置'}
          </button>
        </section>
      )}
      {reading && !source && <p className="inline-progress" role="status">正在读取建议位置…</p>}
      {error && (
        <p className="inline-error" role="alert">
          {error}{source ? '；仍保留上一次成功显示的内容。' : ''}
        </p>
      )}
      {source?.text && (
        <article className="m1c-material-source"><MarkdownView>{source.text}</MarkdownView></article>
      )}
      {source && source.text === null && <p>老师会从这份原始资料本身读取内容。</p>}
    </main>
  );
}

export default MaterialPage;

function locatorPages(locator: string): { start: number; end: number } {
  const page = /^page-([0-9]{4})$/.exec(locator);
  if (page) return { start: Number(page[1]), end: Number(page[1]) };
  const range = /^pages-([0-9]{4})-([0-9]{4})$/.exec(locator);
  return range
    ? { start: Number(range[1]), end: Number(range[2]) }
    : { start: 1, end: 1 };
}

function pageLocator(page: number): string {
  return `page-${String(page).padStart(4, '0')}`;
}

function sourceAssets(book: SourceTreeBook | null): SourceTreeAsset[] {
  if (!book) return [];
  const seen = new Set<string>();
  return [...book.chapters.flatMap((chapter) => chapter.assets), ...book.unresolved.assets]
    .filter((asset) => {
      const key = `${asset.kind}:${asset.id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

function assetReference(asset: SourceTreeAsset): LearningAssetReference {
  return { kind: asset.kind, id: asset.id };
}

export function BookOverviewPage({
  value,
  index,
  sourceBook,
  onOpenPage,
  onLocateOutline,
  onScanOutline,
  onOpenAsset,
}: {
  value: LearningMaterialView;
  index: MaterialBookIndex;
  sourceBook: SourceTreeBook | null;
  onOpenPage(locator: string): void;
  onLocateOutline(id: string): Promise<void>;
  onScanOutline(startPage: number, endPage: number): Promise<void>;
  onOpenAsset?(reference: LearningAssetReference): void;
}) {
  const grown = sourceAssets(sourceBook);
  const processed = index.pages.filter((page) => (
    page.state === 'native-text' || page.state === 'visual-text'
  )).length;
  const firstResolved = index.outline.find((node) => node.startPage !== null);

  return (
    <main className="book-overview">
      <section className="book-hero">
        <div className="book-cover" aria-hidden="true">
          <span><small>本地原始资料</small><b>{value.current.title}</b><i>沿真实章节学习</i></span>
        </div>
        <div className="book-hero-copy">
          <small>Original material · 第 {value.current.revision} 版</small>
          <h1>{value.current.title}</h1>
          <p>沿书原有的次序学习，笔记和题卡会固定在真实页码上。老师可以跳过你已经会的地方，也会在需要时带你回到前文。</p>
          <div className="book-hero-meta">
            <span>{value.current.originalFilename}</span><span>·</span>
            <span>{index.pageCount} 个物理页</span><span>·</span>
            <span>{index.outline.length > 0 ? '目录已整理' : '目录等待整理'}</span><span>·</span>
            <span>正文按需读取{processed > 0 ? ` · 已整理 ${processed} 页正文` : ''}</span>
          </div>
        </div>
        <aside className="teacher-margin">
          <small>从哪里开始</small>
          <h2>跟着学校当前章节就可以</h2>
          <p>不确定从哪里接上时，也可以先打开眼前一节，再让老师用一个短问题帮你找断点。</p>
          <button
            type="button"
            className="action-outline"
            onClick={() => onOpenPage(pageLocator(firstResolved?.startPage ?? 1))}
          >
            {firstResolved ? `从“${firstResolved.title}”开始` : '从第一页开始'}
          </button>
        </aside>
      </section>

      <div className="book-overview-grid">
        <section>
          <header className="book-section-head">
            <h2>目录</h2>
            <span>印刷页码会在首次打开时核验到 PDF 原页</span>
          </header>
          {index.outline.length === 0 ? (
            <div className="book-outline-empty">
              <p>这份 PDF 没有可直接读取的书签。可以先扫描一小段目录页，不会处理整本书。</p>
              <button
                type="button"
                className="action-wash"
                onClick={() => void onScanOutline(1, Math.min(index.pageCount, 8))}
              >
                整理前 {Math.min(index.pageCount, 8)} 页目录
              </button>
            </div>
          ) : (
            <div className="book-toc">
              {index.outline.map((node, position) => (
                <article className="book-toc-row" key={node.id} style={{ '--outline-level': node.level } as CSSProperties}>
                  <span className="chapter-no">{String(position + 1).padStart(2, '0')}</span>
                  <button
                    type="button"
                    onClick={() => node.startPage === null
                      ? void onLocateOutline(node.id)
                      : onOpenPage(pageLocator(node.startPage))}
                  >
                    <b>{node.title}</b>
                    <small>{node.startPage === null
                      ? `印刷页 ${node.printedPage ?? '待核验'} · 核验位置`
                      : `PDF 第 ${node.startPage}${node.endPage && node.endPage !== node.startPage ? `–${node.endPage}` : ''} 页`}</small>
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>
        <aside className="book-side">
          <section>
            <header className="book-section-head"><h2>从这里长出的内容</h2><span>{grown.length}</span></header>
            {grown.length === 0 ? (
              <p className="m1b-empty">还没有从这本书形成笔记或题卡。真正学到某一页时，它们会自然长出来。</p>
            ) : (
              <ul className="grown-assets">
                {grown.map((asset) => (
                  <li key={`${asset.kind}:${asset.id}`}>
                    <small>{asset.kind === 'note' ? 'NOTE' : 'PROBLEM'} · 第 {asset.revision} 版</small>
                    <button type="button" onClick={() => onOpenAsset?.(assetReference(asset))}>
                      <MarkdownView inline>{asset.title}</MarkdownView>
                    </button>
                    <div>{asset.sourceLabel ?? '原文位置待核验'}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <header className="book-section-head"><h2>原文状态</h2><span>按需</span></header>
            <p className="source-fact">原 PDF 始终保留。目录只是导航，OCR 只是读取辅助；公式、图表和复杂版式都以当前原页为准。</p>
          </section>
        </aside>
      </div>
    </main>
  );
}

export function BookReaderPage({
  value,
  index,
  sourceBook,
  locator,
  pageImageUrl,
  pageText,
  reading,
  error,
  onOpenLocator,
  onReadPage,
  onReadVisually,
  onAsk,
  onOpenAsset,
}: {
  value: LearningMaterialView;
  index: MaterialBookIndex;
  sourceBook: SourceTreeBook | null;
  locator: string;
  pageImageUrl: string | null;
  pageText: string | null;
  reading: boolean;
  error: string | null;
  onOpenLocator(locator: string): void;
  onReadPage(page: number): Promise<MaterialPageReadReceipt | void>;
  onReadVisually(page: number): Promise<MaterialPageReadReceipt | void>;
  onAsk(reference: MaterialContext): void;
  onOpenAsset(reference: LearningAssetReference): void;
}) {
  const selected = locatorPages(locator);
  const currentPage = selected.start;
  const label = formatMaterialLocator(locator).human;
  const visibleAssets = sourceAssets(sourceBook).filter((asset) => {
    if (!asset.locator) return false;
    const position = locatorPages(asset.locator);
    return position.start <= selected.end && position.end >= selected.start;
  });
  const activeOutline = index.outline.find((node) => (
    node.startPage !== null && node.endPage !== null
    && currentPage >= node.startPage && currentPage <= node.endPage
  ));
  const resolvedOutline = index.outline.filter((node) => node.startPage !== null);
  const activeOutlinePosition = resolvedOutline.findIndex((node) => node.id === activeOutline?.id);
  const previousOutline = activeOutlinePosition > 0 ? resolvedOutline[activeOutlinePosition - 1] : null;
  const nextOutline = activeOutlinePosition >= 0
    ? resolvedOutline[activeOutlinePosition + 1] ?? null
    : resolvedOutline.find((node) => node.startPage! > currentPage) ?? null;
  const currentPageState = index.pages[currentPage - 1] ?? null;

  return (
    <main className="reader-workspace">
      <aside className="reader-toc">
        <header><small>Contents</small><h2>目录</h2></header>
        <nav>
          {index.outline.map((node) => (
            <button
              type="button"
              key={node.id}
              aria-current={node.id === activeOutline?.id ? 'page' : undefined}
              disabled={node.startPage === null}
              onClick={() => node.startPage && onOpenLocator(pageLocator(node.startPage))}
            >
              <span>{node.title}</span>
              <small>{node.startPage ?? node.printedPage ?? '—'}</small>
            </button>
          ))}
        </nav>
      </aside>
      <section className="reader-center">
        <header className="reader-toolbar">
          <span>原始 PDF · {label} · 共 {index.pageCount} 页</span>
          <div className="page-controls">
            <button
              type="button"
              disabled={currentPage <= 1}
              onClick={() => onOpenLocator(pageLocator(currentPage - 1))}
            >← 上一页</button>
            <span>{currentPage}</span>
            <button
              type="button"
              disabled={currentPage >= index.pageCount}
              onClick={() => onOpenLocator(pageLocator(currentPage + 1))}
            >下一页 →</button>
          </div>
        </header>
        <div className="page-stage">
          {pageImageUrl ? (
            <img className="book-page-image" src={pageImageUrl} alt={`${value.current.title} ${label}原页`} />
          ) : (
            <div className="book-page-placeholder" role="status">正在打开原书页面…</div>
          )}
        </div>
      </section>
      <aside className="reader-study">
        <small>正在读 · {activeOutline?.title ?? label}</small>
        <h2>从这一页开始学</h2>
        <p>老师只带入当前页段，需要上下文时再向前后读取，不会把整本书塞进对话。</p>
        <button
          type="button"
          className="action-solid reader-ask"
          onClick={() => onAsk({
            kind: 'material', id: value.material.id, revision: value.current.revision, locator,
          })}
        >
          <span className="seal-mark" aria-hidden="true">问</span>
          和老师学这里 · {label}
        </button>
        <div className="reader-read-actions">
          <button type="button" disabled={reading} onClick={() => void onReadPage(currentPage)}>
            {pageText ? '重新读取正文' : '读取这一页正文'}
          </button>
          <button type="button" disabled={reading} onClick={() => void onReadVisually(currentPage)}>
            {currentPageState?.method === 'vision' ? '重新视觉读取这一页' : '视觉读取这一页'}
          </button>
        </div>
        {reading && <p className="inline-progress" role="status">正在整理当前页…</p>}
        {error && <p className="inline-error" role="alert">{error}{pageText ? '；仍保留上一次成功读取的正文。' : ''}</p>}
        {pageText && (
          <details className="reader-page-text">
            <summary>查看用于查找与讨论的转写</summary>
            <p>{pageText}</p>
          </details>
        )}
        <section>
          <header><h3>这一页留下的内容</h3><span>{visibleAssets.length}</span></header>
          {visibleAssets.map((asset) => (
            <button
              type="button"
              className="reader-asset"
              key={`${asset.kind}:${asset.id}`}
              onClick={() => onOpenAsset(assetReference(asset))}
            >
              <small>{asset.kind === 'note' ? 'NOTE' : 'PROBLEM'} · 第 {asset.revision} 版</small>
              <span><MarkdownView inline>{asset.title}</MarkdownView></span>
            </button>
          ))}
          {visibleAssets.length === 0 && <p className="m1b-empty">还没有从当前页形成学习资产。</p>}
        </section>
        {(previousOutline || nextOutline) && (
          <section>
            <header><h3>相邻章节</h3><span>书序</span></header>
            {previousOutline?.startPage && (
              <button
                type="button"
                className="reader-asset"
                onClick={() => onOpenLocator(pageLocator(previousOutline.startPage!))}
              >
                <small>上一节</small><span>{previousOutline.title}</span>
              </button>
            )}
            {nextOutline?.startPage && (
              <button
                type="button"
                className="reader-asset"
                onClick={() => onOpenLocator(pageLocator(nextOutline.startPage!))}
              >
                <small>下一节</small><span>{nextOutline.title}</span>
              </button>
            )}
          </section>
        )}
        <p className="original-note">这里显示的是原书页面。模型转写只用于查找与讨论，遇到公式、图表或复杂版式时，以原页为准。</p>
      </aside>
    </main>
  );
}
