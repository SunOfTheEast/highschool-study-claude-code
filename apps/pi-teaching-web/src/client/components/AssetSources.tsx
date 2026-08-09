import type {
  ReadableLearningSourceReference,
  SemanticTagDraft,
} from '../../shared/contracts';

function sourceLocation(locator: string | null): string {
  if (locator === null) return '';
  const lines = /^lines-([1-9][0-9]*)-([1-9][0-9]*)$/.exec(locator);
  if (lines) return ` · 第 ${lines[1]}–${lines[2]} 行`;
  const page = /^page-([0-9]{4})$/.exec(locator);
  if (page) return ` · 第 ${Number(page[1])} 页`;
  return '';
}

function sourceLabel(source: ReadableLearningSourceReference): string {
  if (source.kind === 'legacy-unpinned') {
    const kind = source.assetKind === 'note' ? '笔记' : '题卡';
    return `来源：旧${kind} ${source.id} · 版本尚未固定`;
  }
  if (source.kind === 'material') {
    return `来源：资料 ${source.id} · 第 ${source.revision} 版${sourceLocation(source.locator)}`;
  }
  const kind = source.kind === 'note' ? '笔记' : '题卡';
  return `来源：${kind} ${source.id} · 第 ${source.revision} 版`;
}

export function AssetTags({ value }: { value: SemanticTagDraft | null | undefined }) {
  if (!value) return null;
  return (
    <p className="m1c-asset-tags">
      {[...value.core, ...value.related].map((tag, index) => (
        <span key={`${tag}-${index}`}>{tag}</span>
      ))}
    </p>
  );
}

export function AssetSources({ value }: { value: readonly ReadableLearningSourceReference[] }) {
  if (value.length === 0) return null;
  return (
    <ul className="m1c-asset-sources">
      {value.map((source, index) => <li key={index}>{sourceLabel(source)}</li>)}
    </ul>
  );
}
