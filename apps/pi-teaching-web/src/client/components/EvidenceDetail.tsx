import type {
  PublicEvidenceDetail,
  PublicObjectionTarget,
} from '../../shared/view-contracts';

const stateLabel = {
  active: '当前有效',
  invalidated: '来源后来被修正',
  missing: '来源暂时不可读',
  forbidden: '不属于当前学习分支',
} as const;

export function EvidenceDetail({
  value,
  onCourse,
  onKnowledge,
  onObject,
}: {
  value: PublicEvidenceDetail | null;
  onCourse(planId: string | null, lessonId: string | null): void;
  onKnowledge(methodName: string | null, cardPath: string | null): void;
  onObject(target: PublicObjectionTarget): void;
}) {
  return (
    <aside className="evidence-detail" aria-label="来源详情">
      <small>来源详情</small>
      {!value ? (
        <p>从左侧选择一条记录，再沿中间的来源链查看原始依据。</p>
      ) : (
        <>
          <h2>{value.title}</h2>
          <p className="evidence-state">{stateLabel[value.state]}</p>
          <p>{value.summary}</p>
          {value.studentQuote && <blockquote>{value.studentQuote}</blockquote>}
          {value.boundary && <p>适用边界：{value.boundary}</p>}
          <div className="evidence-detail-actions">
            {(value.planId || value.lessonId) && (
              <button
                type="button"
                onClick={() => onCourse(value.planId, value.lessonId)}
              >
                回到相关课程
              </button>
            )}
            {(value.methods[0] || value.cardPath) && (
              <button
                type="button"
                onClick={() => onKnowledge(value.methods[0] ?? null, value.cardPath)}
              >
                查看相关方法
              </button>
            )}
            {value.objection && (
              <button type="button" onClick={() => onObject(value.objection!)}>
                提出异议
              </button>
            )}
          </div>
          <details>
            <summary>技术来源信息</summary>
            <dl>
              <div><dt>来源</dt><dd><code>{value.source}</code></dd></div>
              {value.occurredAt && <div><dt>时间</dt><dd>{value.occurredAt}</dd></div>}
              {value.planId && <div><dt>Plan</dt><dd>{value.planId}</dd></div>}
              {value.lessonId && <div><dt>Lesson</dt><dd>{value.lessonId}</dd></div>}
              {value.blockId && <div><dt>Block</dt><dd>{value.blockId}</dd></div>}
              {value.cardPath && <div><dt>题卡</dt><dd><code>{value.cardPath}</code></dd></div>}
              {value.materialPath && <div><dt>材料</dt><dd><code>{value.materialPath}</code></dd></div>}
              {value.assessment && <div><dt>判断</dt><dd>{value.assessment}</dd></div>}
              {value.support && <div><dt>支持</dt><dd>{value.support}</dd></div>}
              {value.methods.length > 0 && (
                <div><dt>方法</dt><dd>{value.methods.join('、')}</dd></div>
              )}
            </dl>
          </details>
        </>
      )}
    </aside>
  );
}

export default EvidenceDetail;
