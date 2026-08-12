import { useEffect, useRef, useState } from 'react';
import type {
  LearningContextReference,
  LearningMaterialView,
  MaterialLocatorSnapshot,
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
