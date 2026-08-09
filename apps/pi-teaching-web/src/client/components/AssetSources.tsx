import type {
  AssetFormation,
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
    return `旧${kind} ${source.id} · 版本尚未固定`;
  }
  if (source.kind === 'material') {
    return `资料 ${source.id} · 第 ${source.revision} 版${sourceLocation(source.locator)}`;
  }
  const kind = source.kind === 'note' ? '笔记' : '题卡';
  return `${kind} ${source.id} · 第 ${source.revision} 版`;
}

export function AssetTags({
  value,
  onTag,
}: {
  value: SemanticTagDraft | null | undefined;
  onTag?(tag: string): void;
}) {
  if (!value) return null;
  return (
    <p className="m1c-asset-tags">
      {value.core.map((tag) => onTag ? (
        <button type="button" data-tag-role="core" key={`core:${tag}`} onClick={() => onTag(tag)}>
          核心 · {tag}
        </button>
      ) : <span data-tag-role="core" key={`core:${tag}`}>核心 · {tag}</span>)}
      {value.related.map((tag) => onTag ? (
        <button type="button" data-tag-role="related" key={`related:${tag}`} onClick={() => onTag(tag)}>
          相关 · {tag}
        </button>
      ) : <span data-tag-role="related" key={`related:${tag}`}>相关 · {tag}</span>)}
    </p>
  );
}

export function AssetSources({ value }: { value: readonly ReadableLearningSourceReference[] }) {
  if (value.length === 0) return null;
  return (
    <div className="asset-source-group">
      <span className="asset-provenance-label">内容来源</span>
      <ul className="m1c-asset-sources">
        {value.map((source, index) => <li key={index}>{sourceLabel(source)}</li>)}
      </ul>
    </div>
  );
}

export function AssetProvenance({
  formation,
  sources,
}: {
  formation: AssetFormation | null;
  sources: readonly ReadableLearningSourceReference[];
}) {
  if (formation === null && sources.length === 0) return null;
  return (
    <section className="asset-provenance" aria-label="资产来历">
      {formation && (
        <p className="asset-formation">
          <span className="asset-provenance-label">形成于</span>
          <a href={formation.route}>{formation.title}</a>
        </p>
      )}
      <AssetSources value={sources} />
    </section>
  );
}
