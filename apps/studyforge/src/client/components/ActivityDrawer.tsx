import type { LessonDocument } from '../../shared/contracts';
import { ProgressLine } from './ProgressLine';

const statusLabel = {
  pending: '待进行',
  active: '进行中',
  completed: '已完成',
  skipped: '已跳过',
} as const;

export function ActivityDrawer({ lesson }: { lesson: LessonDocument }) {
  const required = lesson.blocks.filter((block) => block.required);
  const settled = required.filter((block) => (
    block.status === 'completed' || block.status === 'skipped'
  )).length;

  return (
    <aside className="activities" aria-label="课堂节点">
      <header>
        <div>
          <span>Lesson blocks</span>
          <h2>课堂节点</h2>
        </div>
        <ProgressLine value={settled} max={required.length} label="必做进度" />
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
