import type { LessonDocument } from '../../shared/contracts';

const statusLabel = {
  pending: '待进行',
  active: '进行中',
  completed: '已完成',
  skipped: '已跳过',
} as const;

export function ActivityDrawer({ lesson }: { lesson: LessonDocument }) {
  return (
    <aside className="activities" aria-label="课堂节点">
      <header>
        <span>Lesson blocks</span>
        <h2>课堂节点</h2>
      </header>
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
    </aside>
  );
}
