import type {
  LessonNode,
  LessonReplay,
  StudentNotebook as StudentNotebookValue,
} from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';
import { ReplayTimeline } from './ReplayTimeline';
import { RouteMap } from './RouteMap';
import { StudentCard } from './StudentCard';

const statusLabel = {
  pending: '待进行',
  active: '进行中',
  completed: '已完成',
  skipped: '已跳过',
} as const;

function blockStatusLabel(
  lessonStatus: LessonNode['status'],
  blockStatus: keyof typeof statusLabel,
): string {
  return lessonStatus === 'closed' && blockStatus === 'active'
    ? '结束时所在节点'
    : statusLabel[blockStatus];
}

export function LessonNotebook({
  lesson,
  notebook,
  replay,
  embedded = false,
  omitActiveBody = false,
  showCards = true,
}: {
  lesson: LessonNode | null;
  notebook: StudentNotebookValue | null;
  replay: LessonReplay | null;
  embedded?: boolean;
  omitActiveBody?: boolean;
  showCards?: boolean;
}) {
  const Root = embedded ? 'div' : 'aside';
  return (
    <Root className={embedded ? 'lesson-notebook embedded' : 'activities lesson-notebook'}>
      {!embedded && <header>
        <span>Lesson notebook</span>
        <h2>{lesson ? '课堂节点' : '学习工作台'}</h2>
      </header>}
      {!lesson && (
        <div className="coach-note">
          <span aria-hidden="true">✦</span>
          <p>Coach 模式用于讨论方向、备课和课后复盘。开始 Lesson 后，这里会变成安全的学生课堂本。</p>
        </div>
      )}
      {lesson && !notebook && <p className="notebook-loading">正在展开课堂节点…</p>}
      {notebook && (
        <>
          <div className="activity-list">
            {notebook.lesson.blocks.map((block, index) => (
              <details
                key={block.id}
                className="activity-row"
                data-status={block.status}
                open={block.status === 'active'}
              >
                <summary>
                  <span className="activity-order">{String(index + 1).padStart(2, '0')}</span>
                  <span className="activity-copy">
                    <small>{blockStatusLabel(notebook.lesson.status, block.status)}</small>
                    <b>{block.title}</b>
                  </span>
                  {!block.required && <em>可选</em>}
                </summary>
                {block.studentView && !(omitActiveBody && block.status === 'active') && (
                  <div className="student-view"><MarkdownView>{block.studentView}</MarkdownView></div>
                )}
              </details>
            ))}
          </div>
          {notebook.lessonSummary && (
            <section className="lesson-close-summary">
              <span>结课时记录</span>
              <MarkdownView>{notebook.lessonSummary}</MarkdownView>
            </section>
          )}
          {showCards && Object.keys(notebook.cards).length > 0 && (
            <section className="notebook-cards">
              <span>题目卡片</span>
              {Object.entries(notebook.cards).map(([alias, card]) => (
                <StudentCard key={alias} alias={alias} card={card} />
              ))}
            </section>
          )}
          {notebook.authoring && (
            <details className="authoring-source">
              <summary>Authoring source</summary>
              <pre>{notebook.authoring.source}</pre>
            </details>
          )}
          {replay && (
            <>
              <RouteMap replay={replay} />
              <ReplayTimeline replay={replay} />
            </>
          )}
        </>
      )}
    </Root>
  );
}
