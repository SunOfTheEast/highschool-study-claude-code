import { useEffect, useRef, useState } from 'react';
import type {
  LearningContextReference,
  LearningMaterialView,
  MaterialLocatorSnapshot,
} from '../../shared/contracts';
import { MarkdownView } from '../components/MarkdownView';
import { formatMaterialLocator } from '../material-locator';

type MaterialContext = Extract<LearningContextReference, { kind: 'material' }>;

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
  const [locator, setLocator] = useState(suggested ?? 'whole');
  const [source, setSource] = useState<MaterialLocatorSnapshot | null>(null);
  const [advanced, setAdvanced] = useState(false);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loadedKey = useRef<string | null>(null);
  const readRef = useRef(onRead);
  useEffect(() => { readRef.current = onRead; }, [onRead]);

  useEffect(() => {
    const key = `${value.material.id}@${value.current.revision}#${suggested ?? 'whole'}`;
    setLocator(suggested ?? 'whole');
    setSource(null);
    setAdvanced(false);
    setError(null);
    if (loadedKey.current === key) return;
    loadedKey.current = key;
    setReading(true);
    void readRef.current(suggested)
      .then(setSource)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setReading(false));
  }, [value.material.id, value.current.revision, suggested]);

  const selected = locator === 'whole' ? null : locator.trim();
  const readSelected = () => {
    setReading(true);
    setError(null);
    void onRead(selected)
      .then(setSource)
      .catch((reason: unknown) => {
        setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => setReading(false));
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
          <code>{resolved?.canonical ?? suggestedLabel.canonical}</code>
        </div>
        <button type="button" className="action-text" onClick={() => setAdvanced((open) => !open)}>
          高级定位
        </button>
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

      {advanced && (
        <section className="m1c-material-locator">
          <label>
            Canonical locator
            <input value={locator} onChange={(event) => setLocator(event.target.value)} />
          </label>
          <button type="button" className="action-wash" disabled={reading} onClick={readSelected}>
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
