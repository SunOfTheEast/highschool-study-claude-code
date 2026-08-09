import type { MouseEvent } from 'react';
import type { LearningSetHomeSnapshot } from '../../shared/contracts';
import type { BrowserRoute } from '../routes';

export function HomePage({
  value,
  onNavigate,
  onStartFree,
  onPlan,
  onOpenFootprint,
}: {
  value: LearningSetHomeSnapshot;
  onNavigate(route: BrowserRoute): void;
  onStartFree(): void;
  onPlan?(): void;
  onOpenFootprint?(): void;
}) {
  const link = (route: BrowserRoute) => (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onNavigate(route);
  };
  return (
    <main className="m1b-home">
      <header className="m1b-home-heading">
        <small>Study begins here</small>
        <h1>{value.guide.title}</h1>
        <p>{value.guide.body.replace(/^#\s+.+$/m, '').trim()}</p>
      </header>

      <section className="m1b-entry-grid" aria-label="学习入口">
        <button type="button" className="m1b-entry-primary" onClick={onStartFree}>
          <span>01</span>
          <strong>问老师</strong>
          <p>不用先想好目标。把眼前的问题、猜想或困惑直接说出来。</p>
          <i aria-hidden="true">问</i>
        </button>
        <a href="/assets" onClick={link({ kind: 'assets' })}>
          <span>02</span>
          <strong>我的学习资料</strong>
          <p>{value.assets.notes} 份 Note · {value.assets.problemCards} 张题卡</p>
          <i aria-hidden="true">阅</i>
        </a>
        {value.course && (
          <a href="/course" onClick={link({ kind: 'course' })}>
            <span>03</span>
            <strong>进入正式课程</strong>
            <p>{value.course.title} · {value.course.currentPosition}</p>
            <i aria-hidden="true">课</i>
          </a>
        )}
        {!value.course && (
          <button type="button" onClick={onPlan}>
            <span>03</span>
            <strong>{value.recentMeta.length > 0 ? '继续长期规划' : '规划长期学习'}</strong>
            <p>先把长期方向想清楚；具体阶段会留到长期路线中再讨论。</p>
            <i aria-hidden="true">路</i>
          </button>
        )}
        <button type="button" onClick={onOpenFootprint}>
          <span>04</span>
          <strong>学习足迹</strong>
          <p>回看真实发生过的对话、作答、资料与认知变化。</p>
          <i aria-hidden="true">迹</i>
        </button>
      </section>

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
