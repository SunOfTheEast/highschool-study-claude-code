import type { MouseEvent } from 'react';
import type { LearningSetHomeSnapshot } from '../../shared/contracts';
import { MarkdownView } from '../components/MarkdownView';
import type { BrowserRoute } from '../routes';

export function HomePage({
  value,
  onNavigate,
  onStartFree,
  onPlan,
  onOpenFootprint,
  onImportBook,
}: {
  value: LearningSetHomeSnapshot;
  onNavigate(route: BrowserRoute): void;
  onStartFree(): void;
  onPlan?(): void;
  onOpenFootprint?(): void;
  onImportBook?(): Promise<void>;
}) {
  const link = (route: BrowserRoute) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onNavigate(route);
  };
  const activeLesson = value.course?.activeLesson ?? null;
  const book = value.books[0] ?? null;
  return (
    <main className="m1b-home home-portal">
      <header className="m1b-home-heading">
        <small>StudyForge · 本地学习集</small>
        <h1>{value.guide.title}</h1>
        {value.guide.introduction && (
          <div className="home-guide-copy">
            <MarkdownView>{value.guide.introduction}</MarkdownView>
          </div>
        )}
      </header>

      <section className="home-action-stage" aria-label="现在开始">
        {activeLesson ? (
          <a
            className="home-primary home-continue"
            href={activeLesson.route}
            onClick={link({
              kind: 'course-lesson',
              planId: activeLesson.planId,
              lessonId: activeLesson.id,
            })}
          >
            <span className="home-action-copy">
              <small>正在进行 · {activeLesson.planTitle}</small>
              <strong>继续上课 · {activeLesson.title}</strong>
            </span>
            <i className="seal-mark" aria-hidden="true">继</i>
          </a>
        ) : book ? (
          <a
            className="home-primary home-book-entry"
            href={book.route}
            onClick={link({ kind: 'book', id: book.id })}
          >
            <span className="home-book-mark" aria-hidden="true">书</span>
            <span className="home-action-copy">
              <small>从真实章节开始</small>
              <strong>打开这本书 · {book.title}</strong>
              <em>
                {book.pageCount === null ? '目录等待整理' : `${book.pageCount} 个物理页`}
                {' · '}{book.outlineCount > 0 ? '目录已整理' : '目录可按需整理'}
                {' · '}正文按需读取
              </em>
            </span>
            <span className="home-book-open">打开 <b aria-hidden="true">→</b></span>
          </a>
        ) : (
          <button type="button" className="home-primary home-ask" onClick={onStartFree}>
            <span className="home-action-copy">
              <small>自由学习</small>
              <strong>问老师</strong>
              <em>把眼前的问题、猜想或困惑直接说出来。</em>
            </span>
            <i className="seal-mark" aria-hidden="true">问</i>
          </button>
        )}

        <nav className="home-quiet-actions" aria-label="其他学习入口">
          {(activeLesson || book) && (
            <button type="button" className="action-text" onClick={onStartFree}>
              {book && !activeLesson ? '也可以直接问老师' : '安静地问老师'}
            </button>
          )}
          {!book && onImportBook && (
            <button type="button" className="action-text" onClick={() => void onImportBook()}>
              放入一本 PDF 开始学习
            </button>
          )}
          {value.course ? (
            <a href="/course" onClick={link({ kind: 'course' })}>
              进入正式课程 · {value.course.title}
            </a>
          ) : (
            <button type="button" className="action-text" onClick={onPlan}>
              {value.recentMeta.length > 0 ? '继续长期规划' : '规划长期学习'}
            </button>
          )}
          <a href="/assets" onClick={link({ kind: 'assets' })}>
            我的学习资料 · {value.assets.notes} 份笔记 · {value.assets.problemCards} 张题卡
          </a>
          {book && (
            <a href="/assets?view=sources" onClick={link({ kind: 'assets', view: 'sources' })}>
              沿书查看学习资料
            </a>
          )}
          <button type="button" className="action-text" onClick={onOpenFootprint}>学习足迹</button>
        </nav>
      </section>

      {value.guide.principles && (
        <section className="home-learning-principles">
          <header><small>How to learn</small><h2>这个学习集怎么学</h2></header>
          <div className="home-guide-copy">
            <MarkdownView>{value.guide.principles}</MarkdownView>
          </div>
        </section>
      )}

      <section className="m1b-recent">
        <header><small>Recent conversations</small><h2>最近的自由学习</h2></header>
        {value.recentFreeLearning.length === 0 ? (
          <p className="m1b-empty">还没有自由学习记录。第一个问题可以很小，也可以很怪。</p>
        ) : (
          <ol>
            {value.recentFreeLearning.map((session) => (
              <li key={session.id}>
                <a
                  href={`/learn/${encodeURIComponent(session.id)}`}
                  onClick={link({ kind: 'free-learning', sessionId: session.id })}
                >
                  <span>{session.status === 'active' ? '进行中' : '已结束'}</span>
                  <strong>{session.title}</strong>
                  <time dateTime={session.updatedAt}>{new Date(session.updatedAt).toLocaleString()}</time>
                </a>
              </li>
            ))}
          </ol>
        )}
      </section>
    </main>
  );
}

export default HomePage;
