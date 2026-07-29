import { useState } from 'react';
import type {
  MemoryReviewDecision,
  MemoryReviewItem,
  MemoryReviewSnapshot,
} from '../../memory-review/contracts';

export type MemoryReviewDrafts = Record<string, MemoryReviewDecision | null>;

export function memoryReviewComplete(
  items: MemoryReviewItem[],
  drafts: MemoryReviewDrafts,
): boolean {
  return items.every((item) => {
    const decision = drafts[item.id];
    if (!decision || decision.itemId !== item.id) return false;
    return decision.action !== 'rewrite' || Boolean(decision.text?.trim());
  });
}

const operationLabel = {
  add: '新增',
  revise: '修订',
  delete: '删除',
} as const;

const ownerLabel = {
  student: '学习偏好',
  teaching: '教学方式',
} as const;

function initialDrafts(review: MemoryReviewSnapshot): MemoryReviewDrafts {
  const decisions = new Map(review.decisions.map((decision) => [decision.itemId, decision]));
  return Object.fromEntries(review.items.map((item) => [
    item.id,
    review.status === 'proposed' ? null : decisions.get(item.id) ?? null,
  ]));
}

export function MemoryReviewPanel({
  review,
  submitting,
  onClose,
  onSource,
  onSubmit,
}: {
  review: MemoryReviewSnapshot;
  submitting: boolean;
  onClose(): void;
  onSource(source: string): void;
  onSubmit(decisions: MemoryReviewDecision[]): Promise<void>;
}) {
  const editable = review.status === 'proposed';
  const [drafts, setDrafts] = useState<MemoryReviewDrafts>(() => initialDrafts(review));
  const complete = memoryReviewComplete(review.items, drafts);

  const choose = (
    item: MemoryReviewItem,
    action: MemoryReviewDecision['action'],
  ) => {
    setDrafts((current) => ({
      ...current,
      [item.id]: {
        itemId: item.id,
        action,
        text: action === 'rewrite'
          ? current[item.id]?.action === 'rewrite' ? current[item.id]?.text ?? '' : ''
          : null,
      },
    }));
  };

  return (
    <div className="memory-review-overlay" role="presentation">
      <button
        type="button"
        className="memory-review-scrim"
        aria-label="关闭长期记忆确认"
        onClick={onClose}
      />
      <section
        className="memory-review-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="memory-review-title"
      >
        <header>
          <div>
            <span>Plan 完成复盘</span>
            <h2 id="memory-review-title">
              {review.status === 'applied' ? '已写入长期画像' : '确认长期记忆'}
            </h2>
          </div>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        <p className="memory-review-intro">
          {review.status === 'applied'
            ? `已写入 ${review.receipt.appliedItems.length} 条，未更改 ${review.receipt.unchangedItems.length} 条。你仍可查看每条记录的来源。`
            : review.status === 'submitted'
              ? '你的决定已经保存，学习顾问正在把它们写入长期画像。'
              : '每一条都来自本周期的原始记录。先逐项决定，再交给学习顾问整理画像。'}
        </p>
        <ol className="memory-review-items">
          {review.items.map((item, index) => {
            const draft = drafts[item.id];
            return (
              <li key={item.id}>
                <div className="memory-review-item-heading">
                  <span>{String(index + 1).padStart(2, '0')}</span>
                  <div>
                    <small>
                      {ownerLabel[item.owner]} · {operationLabel[item.operation]}
                    </small>
                    <h3>{item.proposedText ?? item.currentText}</h3>
                  </div>
                </div>
                <dl>
                  {item.currentText && (
                    <>
                      <dt>当前记录</dt>
                      <dd>{item.currentText}</dd>
                    </>
                  )}
                  {item.proposedText && (
                    <>
                      <dt>建议记录</dt>
                      <dd>{item.proposedText}</dd>
                    </>
                  )}
                  <dt>为什么值得保留</dt>
                  <dd>{item.rationale}</dd>
                  <dt>需要留意的反例</dt>
                  <dd>{item.counterEvidence}</dd>
                  <dt>适用范围</dt>
                  <dd>{item.scope}</dd>
                  <dt>记录来源</dt>
                  <dd className="memory-review-sources">
                    {item.sources.map((source) => (
                      /#trace-event-/.test(source) ? (
                        <button type="button" key={source} onClick={() => onSource(source)}>
                          {source}
                        </button>
                      ) : <code key={source}>{source}</code>
                    ))}
                  </dd>
                </dl>
                <fieldset>
                  <legend>你的决定</legend>
                  {([
                    ['accept', '采用'],
                    ['rewrite', '改写后采用'],
                    ['reject', '不采用'],
                  ] as const).map(([action, label]) => (
                    <label key={action}>
                      <input
                        type="radio"
                        name={`memory-review-${item.id}`}
                        checked={draft?.action === action}
                        disabled={!editable}
                        onChange={() => choose(item, action)}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>
                {draft?.action === 'rewrite' && (
                  <label className="memory-review-rewrite">
                    <span>写成你认可的表述</span>
                    <textarea
                      rows={3}
                      value={draft.text ?? ''}
                      disabled={!editable}
                      onChange={(event) => setDrafts((current) => ({
                        ...current,
                        [item.id]: {
                          itemId: item.id,
                          action: 'rewrite',
                          text: event.target.value,
                        },
                      }))}
                    />
                  </label>
                )}
              </li>
            );
          })}
        </ol>
        <footer>
          {editable ? (
            <>
              <span>{complete ? '全部条目已确认' : '请先处理全部条目'}</span>
              <button
                type="button"
                disabled={!complete || submitting}
                onClick={() => {
                  if (!complete) return;
                  const decisions = review.items.map((item) => drafts[item.id]!);
                  void onSubmit(decisions);
                }}
              >
                {submitting ? '正在提交…' : '提交给学习顾问'}
              </button>
            </>
          ) : (
            <span>
              {review.status === 'applied' ? '这份确认已经生效' : '已确认，待写入'}
            </span>
          )}
        </footer>
      </section>
    </div>
  );
}
