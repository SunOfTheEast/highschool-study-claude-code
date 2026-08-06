import type { ReactElement } from 'react';
import type { LessonHandoutConversationItem } from '../../shared/contracts';

export function LessonHandoutActivity({
  item,
}: {
  item: LessonHandoutConversationItem;
}): ReactElement {
  if (item.status === 'running') {
    return (
      <div className="lesson-handout-activity" data-status="running" role="status">
        <span className="lesson-handout-mark" aria-hidden="true" />
        <strong>正在整理讲义</strong>
      </div>
    );
  }
  if (item.status === 'error' || item.title === null || item.url === null) {
    return (
      <div className="lesson-handout-activity" data-status="error" role="status">
        <span className="lesson-handout-mark" aria-hidden="true" />
        <strong>讲义暂时没有生成，课程仍可开始</strong>
      </div>
    );
  }
  return (
    <div className="lesson-handout-activity" data-status="done">
      <span className="lesson-handout-copy">
        <small>可打印讲义</small>
        <strong>{item.title}</strong>
      </span>
      <a href={item.url}>查看并打印讲义</a>
    </div>
  );
}

export default LessonHandoutActivity;
