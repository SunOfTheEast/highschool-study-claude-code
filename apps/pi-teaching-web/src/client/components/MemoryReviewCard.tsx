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

  return (
    <article
      className="memory-review-card"
      data-status={review.status}
      data-focused={focused ? 'true' : 'false'}
    >
      <header>
        <span>{review.status === 'submitted' ? '长期记忆确认单' : '长期记忆待确认'}</span>
        <b>{review.items.length.toString().padStart(2, '0')}</b>
      </header>
      <h3>
        {review.status === 'submitted'
          ? '你的选择已提交给学习顾问'
          : '哪些内容值得陪你走到下一个学习周期？'}
      </h3>
      <p>
        {review.status === 'submitted'
          ? '学习顾问会按这份选择整理画像；最终结果以随后重读画像后的回复为准。'
          : '这些是从本周期课堂记录中整理出的候选，不会在你确认前写入长期画像。'}
      </p>
      <div className="memory-review-counts">
        <span>学习偏好 <strong>{studentCount}</strong></span>
        <span>教学方式 <strong>{teachingCount}</strong></span>
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
        ) : (
          <span className="memory-review-submitted">已提交</span>
        )}
      </footer>
    </article>
  );
}
