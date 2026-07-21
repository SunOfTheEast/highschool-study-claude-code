import type { LessonNode } from '../../shared/contracts';

const statusLabel = {
  pending: '待进行',
  active: '进行中',
  completed: '已完成',
  skipped: '已跳过',
} as const;

export function ActivityDrawer({ lesson }: { lesson: LessonNode | null }) {
  return (
    <aside className="activities">
      <header>
        <span>Lesson notebook</span>
        <h2>课堂节点</h2>
      </header>
      {lesson ? (
        <div className="activity-list">
          {lesson.blocks.map((block, index) => (
            <div key={block.id} className="activity-row" data-status={block.status}>
              <span className="activity-order">{String(index + 1).padStart(2, '0')}</span>
              <span className="activity-copy">
                <small>{statusLabel[block.status]}</small>
                <b>{block.title}</b>
              </span>
              {!block.required && <em>可选</em>}
            </div>
          ))}
        </div>
      ) : (
        <div className="coach-note">
          <span aria-hidden="true">✦</span>
          <p>Coach 模式用于讨论方向、备课和课后复盘。开始 Lesson 后，这里会变成实时课堂节点。</p>
        </div>
      )}
    </aside>
  );
}
