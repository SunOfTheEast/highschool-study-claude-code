import type { CourseSnapshot } from '../../shared/contracts';
import { planProgress, resolveContinueTarget } from '../course-navigation';
import { formatBrowserRoute, type BrowserRoute } from '../routes';
import { MarkdownView } from '../components/MarkdownView';

const statusLabel = {
  prepared: '待开始',
  active: '进行中',
  completed: '已完成',
  closed: '已结束',
} as const;

export function CourseOverviewPage({
  value,
  onNavigate,
}: {
  value: CourseSnapshot;
  onNavigate(route: BrowserRoute): void;
}) {
  const plans = value.tree.children.filter((node) => node.kind === 'plan');
  const target = resolveContinueTarget(value.tree);
  const parentPlan = target.parentPlanId === null
    ? null
    : plans.find((plan) => plan.id === target.parentPlanId) ?? null;

  const navigate = (route: BrowserRoute) => (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    onNavigate(route);
  };

  return (
    <main className="course-overview">
      <section className="overview-hero" aria-labelledby="course-overview-title">
        <p className="overview-eyebrow">学习路线 · ROADMAP</p>
        <h1 id="course-overview-title">{value.roadmap.title}</h1>
        <div className="overview-goal">
          <MarkdownView>{value.roadmap.longTermGoal}</MarkdownView>
        </div>
        <div className="overview-copy">
          <MarkdownView>{value.roadmap.overview}</MarkdownView>
        </div>

        <a
          className="overview-continue"
          href={formatBrowserRoute(target.route)}
          onClick={navigate(target.route)}
        >
          <span className="overview-continue-label">继续学习</span>
          <strong>{target.node.title}</strong>
          <small>{parentPlan?.title ?? '从长期方向继续讨论'}</small>
          <i aria-hidden="true">继</i>
        </a>

        <a
          className="overview-roadmap-link"
          href="/course/roadmap"
          onClick={navigate({ kind: 'course-roadmap' })}
        >
          与老师讨论路线 <span aria-hidden="true">↗</span>
        </a>
      </section>

      <section className="overview-cycle" aria-label="学习周期">
        <header>
          <p className="overview-eyebrow">学习周期 · PLANS</p>
          <h2>当前学习安排</h2>
        </header>
        {plans.length === 0 ? (
          <div className="overview-empty">
            <h3>尚未形成学习阶段</h3>
            <p>先和老师说说目标、时间和真实卡点，再一起确定第一个 Plan。</p>
          </div>
        ) : (
          <ol className="overview-plan-list">
            {plans.map((plan, index) => {
              const progress = planProgress(plan);
              return (
                <li key={plan.path} className="overview-plan-row" data-status={plan.status}>
                  <span className="overview-plan-index">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div>
                    <small>{statusLabel[plan.status]}</small>
                    <a
                      href={formatBrowserRoute({ kind: 'course-plan', planId: plan.id })}
                      onClick={navigate({ kind: 'course-plan', planId: plan.id })}
                    >
                      {plan.title}
                    </a>
                  </div>
                  <span className="overview-plan-progress">
                    {progress.settled} / {progress.total} 节
                  </span>
                </li>
              );
            })}
          </ol>
        )}
        <footer>
          <span>当前位置</span>
          <p>{value.roadmap.currentPosition}</p>
        </footer>
      </section>
    </main>
  );
}

export default CourseOverviewPage;
