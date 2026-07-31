import type {
  MemoryViewProjection,
  ViewQuery,
} from '../../shared/view-contracts';

function SourceButton({
  sources,
  onSelect,
}: {
  sources: string[];
  onSelect(source: string): void;
}) {
  const source = sources[0];
  return source ? (
    <button type="button" onClick={() => onSelect(source)}>查看来源</button>
  ) : null;
}

export function MemoryDirectory({
  value,
  onSelect,
  onFilter,
}: {
  value: MemoryViewProjection;
  onSelect(source: string): void;
  onFilter(patch: Partial<ViewQuery>): void;
}) {
  return (
    <aside className="memory-directory" aria-label="学习记忆目录">
      <label>
        查看范围
        <select
          value={value.filters.timeRange}
          onChange={(event) => onFilter({
            timeRange: event.currentTarget.value as ViewQuery['timeRange'],
          })}
        >
          <option value="all">全部学习阶段</option>
          <option value="plan">当前 Plan</option>
          <option value="lesson">当前 Lesson</option>
        </select>
      </label>
      <section>
        <h2>已确认长期记忆</h2>
        {value.confirmed.length === 0 ? (
          <p>尚未形成经你确认的长期记录。</p>
        ) : (
          <>
            <h3>我的学习特点</h3>
            <ul>
              {value.confirmed.filter((item) => item.owner === 'student').map((item) => (
                <li key={`${item.owner}:${item.id}`}>
                  <button
                    type="button"
                    aria-current={item.sources.includes(value.selectedSource ?? '') || undefined}
                    onClick={() => item.sources[0] && onSelect(item.sources[0])}
                  >
                    {item.content}
                  </button>
                  <small>{item.scope}</small>
                </li>
              ))}
            </ul>
            <h3>系统怎样配合我</h3>
            <ul>
              {value.confirmed.filter((item) => item.owner === 'teaching').map((item) => (
                <li key={`${item.owner}:${item.id}`}>
                  <button
                    type="button"
                    onClick={() => item.sources[0] && onSelect(item.sources[0])}
                  >
                    {item.content}
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
      <section>
        <h2>阶段性发现</h2>
        {value.stageFindings.length === 0 ? <p>当前范围内还没有阶段性发现。</p> : (
          <ul>
            {value.stageFindings.map((finding) => (
              <li key={finding.id} data-state={finding.state}>
                <strong>{finding.statement}</strong>
                <p>{finding.boundary}</p>
                <small>下一次使用：{finding.nextUse}</small>
                <SourceButton sources={finding.sources} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        )}
      </section>
      <section>
        <h2>还需要再看看</h2>
        {value.openQuestions.length === 0 ? <p>当前没有待验证问题。</p> : (
          <ul>
            {value.openQuestions.map((question) => (
              <li key={question.id} data-state={question.state}>
                <strong>{question.question}</strong>
                <p>{question.nextCheck}</p>
                <SourceButton sources={question.sources} onSelect={onSelect} />
              </li>
            ))}
          </ul>
        )}
      </section>
      {value.sourceIndexes.length > 0 && (
        <details className="source-only-indexes">
          <summary>仅有来源记录</summary>
          <ul>
            {value.sourceIndexes.map((index) => (
              <li key={index.id} data-state={index.state}>
                <button
                  type="button"
                  onClick={() => index.sources[0] && onSelect(index.sources[0])}
                >
                  {index.label}
                </button>
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

export default MemoryDirectory;
