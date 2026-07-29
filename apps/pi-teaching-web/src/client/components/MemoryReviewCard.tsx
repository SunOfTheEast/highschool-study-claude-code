import { useState } from 'react';
import type { MemoryReviewSnapshot } from '../../memory-review/contracts';

export function MemoryReviewCard({
  review,
  onOpen,
}: {
  review: MemoryReviewSnapshot;
  onOpen(): void;
}) {
  const [focused, setFocused] = useState(true);
  const studentCount = review.items.filter((item) => item.owner === 'student').length;
  const teachingCount = review.items.length - studentCount;
  const applied = review.status === 'applied';
  const submitted = review.status === 'submitted';

  return (
    <article
      className="memory-review-card"
      data-status={review.status}
      data-focused={focused ? 'true' : 'false'}
    >
      <header>
        <span>
          {applied
            ? '长期记忆回执'
            : submitted ? '长期记忆确认单' : '长期记忆待确认'}
        </span>
        <b>{review.items.length.toString().padStart(2, '0')}</b>
      </header>
      <h3>
        {applied
          ? '已写入长期画像'
          : submitted
            ? '你的选择已确认，正在等待写入'
            : '哪些内容值得陪你走到下一个学习周期？'}
      </h3>
      <p>
        {applied
          ? '学习顾问已经按你的决定更新画像；后续规划会读取这份确认后的记录。'
          : submitted
            ? '决定已经保存。若写入未完成，可直接在当前学习顾问对话中请它重试。'
            : '这些是从本周期课堂记录中整理出的候选，不会在你确认前写入长期画像。'}
      </p>
      <div className="memory-review-counts">
        {applied ? (
          <>
            <span>写入 <strong>{review.receipt.appliedItems.length}</strong></span>
            <span>未更改 <strong>{review.receipt.unchangedItems.length}</strong></span>
          </>
        ) : (
          <>
            <span>学习偏好 <strong>{studentCount}</strong></span>
            <span>教学方式 <strong>{teachingCount}</strong></span>
          </>
        )}
      </div>
      <footer>
        {review.status === 'proposed' ? (
          <>
            <button type="button" className="memory-review-primary" onClick={onOpen}>
              逐条确认 <i aria-hidden="true">↗</i>
            </button>
            <button type="button" onClick={() => setFocused(false)}>
              稍后处理
            </button>
          </>
        ) : applied ? (
          <span className="memory-review-submitted">写入完成</span>
        ) : (
          <span className="memory-review-submitted">已确认，待写入</span>
        )}
      </footer>
    </article>
  );
}
