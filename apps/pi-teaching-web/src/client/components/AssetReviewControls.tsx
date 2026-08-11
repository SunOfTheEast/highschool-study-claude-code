import type { AssetReviewProjection } from '../../shared/contracts';

const intervals = [1, 3, 7, 14, 30, 60, 120] as const;

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('zh-CN', { month: 'long', day: 'numeric' }).format(
    new Date(`${value}T12:00:00`),
  );
}

export function AssetReviewControls({
  review,
  direct,
  onStart,
  onTeacher,
  onManage,
}: {
  review: AssetReviewProjection | null;
  direct: boolean;
  onStart?(): void;
  onTeacher?(): void;
  onManage?(action: 'enroll' | 'remove' | 'restart'): Promise<void>;
}) {
  if (!onManage && !onStart && !onTeacher) return null;
  if (!review?.active) {
    return (
      <section className="asset-review-controls" aria-label="资产复习">
        <div><small>间隔复习</small><p>这份内容目前不在复习轨道中。</p></div>
        {onManage && (
          <button type="button" className="action-outline" onClick={() => void onManage('enroll')}>
            {review ? '重新加入复习' : '加入复习'}
          </button>
        )}
      </section>
    );
  }
  return (
    <section className="asset-review-controls" aria-label="资产复习">
      <div>
        <small>间隔复习</small>
        <p>下次复习：{review.dueOn ? dateLabel(review.dueOn) : '待安排'}</p>
        <p>当前间隔：{intervals[review.stage]} 天</p>
      </div>
      <div className="asset-review-actions">
        {direct && onStart && (
          <button type="button" className="action-solid" onClick={onStart}>现在复习</button>
        )}
        {!direct && onTeacher && (
          <button type="button" className="action-solid" onClick={onTeacher}>和老师复习</button>
        )}
        {onManage && (
          <>
            <button type="button" className="action-text" onClick={() => void onManage('remove')}>移出复习</button>
            <button type="button" className="action-text" onClick={() => void onManage('restart')}>重新开始</button>
          </>
        )}
      </div>
    </section>
  );
}
