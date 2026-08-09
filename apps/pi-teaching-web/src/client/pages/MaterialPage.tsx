import { useEffect, useState } from 'react';
import type {
  LearningContextReference,
  LearningMaterialView,
  MaterialLocatorSnapshot,
} from '../../shared/contracts';
import { MarkdownView } from '../components/MarkdownView';

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
  const [locator, setLocator] = useState(value.suggestedLocator ?? 'whole');
  const [source, setSource] = useState<MaterialLocatorSnapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    setLocator(value.suggestedLocator ?? 'whole');
    setSource(null);
    setError(null);
  }, [value.material.id, value.current.revision, value.suggestedLocator]);
  const selected = locator === 'whole' ? null : locator.trim();
  return (
    <main className="m1c-material-page">
      <header>
        <small>原始资料 · 第 {value.current.revision} 版</small>
        <h1>{value.current.title}</h1>
        <p>{value.current.originalFilename} · {publicStatus(value.current.searchStatus)}</p>
      </header>
      <section className="m1c-material-locator">
        <label>
          来源位置
          <input value={locator} onChange={(event) => setLocator(event.target.value)} />
        </label>
        <button type="button" onClick={() => {
          setError(null);
          void onRead(selected).then(setSource).catch((reason) => {
            setError(reason instanceof Error ? reason.message : String(reason));
          });
        }}>读取来源</button>
        <button type="button" onClick={() => onAsk({
          kind: 'material',
          id: value.material.id,
          revision: value.current.revision,
          locator: selected,
        })}>带着这一段问老师</button>
      </section>
      {error && <p role="alert">{error}</p>}
      {source?.text && <article className="m1c-material-source"><MarkdownView>{source.text}</MarkdownView></article>}
      {source && source.text === null && <p>老师会从这份原始资料本身读取内容。</p>}
    </main>
  );
}

export default MaterialPage;
