import { useEffect, useState, type ReactElement } from 'react';
import type { LessonReviewConversationItem } from '../../shared/contracts';
import { formatMaterialSearchElapsed } from './MaterialSearchActivity';

const statusCopy = {
  running: '正在核验题目',
  done: '题目核验完成',
  error: '题目核验失败',
} as const;

export function LessonReviewActivity({
  item,
}: {
  item: LessonReviewConversationItem;
}): ReactElement {
  const [elapsedMs, setElapsedMs] = useState(item.elapsedMs);

  useEffect(() => {
    setElapsedMs(item.elapsedMs);
    if (item.status !== 'running') return undefined;
    const base = item.elapsedMs;
    const started = Date.now();
    const interval = window.setInterval(() => {
      setElapsedMs(base + Date.now() - started);
    }, 1000);
    return () => window.clearInterval(interval);
  }, [item.elapsedMs, item.status, item.updatedAt]);

  return (
    <div className="lesson-review-activity" data-status={item.status} role="status">
      <span className="lesson-review-pulse" aria-hidden="true" />
      <span className="lesson-review-copy">
        <strong>{statusCopy[item.status]}</strong>
        <small>{formatMaterialSearchElapsed(elapsedMs)}</small>
      </span>
    </div>
  );
}

export default LessonReviewActivity;
