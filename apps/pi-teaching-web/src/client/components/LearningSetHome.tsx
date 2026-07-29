import type { HomeSnapshot } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function LearningSetHome({
  value,
  continuePath,
  onContinue,
  onOpen,
  onRoadmapOpen,
}: {
  value: HomeSnapshot;
  continuePath: string;
  onContinue(path: string): void;
  onOpen(id: string): void;
  onRoadmapOpen(): void;
}) {
  const otherPlans = value.learningSet.plans.filter(
    (plan) => plan.id !== value.currentPlan?.id,
  );
  return (
    <main className="home continue-home" data-theme="liubai-xinzhongshi">
      <header className="home-heading">
        <p className="eyebrow">StudyForge · Learning Set</p>
        <h1>{value.learningSet.title}</h1>
        <div className="home-overview">
          <MarkdownView>{value.learningSet.overview}</MarkdownView>
        </div>
      </header>

      <div className="home-continuation">
        <p className="section-label">从上次的位置继续</p>
        <button
          className="continue-entry"
          type="button"
          onClick={() => onContinue(continuePath)}
        >
          <small>
            继续学习{value.currentPlan ? ` · ${value.currentPlan.title}` : ''}
          </small>
          <strong>{value.continueTarget.title}</strong>
          <span>{value.continueTarget.detail}</span>
          <i aria-hidden="true">↗</i>
        </button>

        {value.currentPlan && (
          <section className="home-stage" aria-label="当前阶段">
            <header>
              <span>当前阶段</span>
              <b>
                {value.lessonProgress.completed}/{value.lessonProgress.total} 节
              </b>
            </header>
            <p>{value.studentPlan?.currentPosition}</p>
            {value.studentPlan?.nextLesson ? (
              <blockquote>
                <small>{value.studentPlan.nextLesson.publicTitle}</small>
                {value.studentPlan.nextLesson.publicPurpose && (
                  <MarkdownView>{value.studentPlan.nextLesson.publicPurpose}</MarkdownView>
                )}
                <p>
                  {value.studentPlan.nextLesson.blockCount} 个课堂环节
                  {value.studentPlan.nextLesson.blockKinds.length > 0
                    ? ` · ${value.studentPlan.nextLesson.blockKinds.length} 类活动`
                    : ''}
                </p>
                {value.studentPlan.nextLesson.sourceNumbers.length > 0 && (
                  <p>题号：{value.studentPlan.nextLesson.sourceNumbers.join('、')}</p>
                )}
              </blockquote>
            ) : <p>正在与学习顾问商议下一课。</p>}
          </section>
        )}

        {value.signals.length > 0 && (
          <section className="home-signals" aria-label="最近学习信号">
            <p className="section-label">最近变化</p>
            {value.signals.map((signal) => (
              <article key={`${signal.label}:${signal.source ?? signal.value}`}>
                <small>{signal.label}</small>
                <p>{signal.value}</p>
                {signal.source && <code>{signal.source}</code>}
              </article>
            ))}
          </section>
        )}

        {value.recentReplay && (
          <button
            type="button"
            className="recent-replay-entry"
            onClick={() => onContinue(value.recentReplay!.route)}
          >
            <span><small>最近课堂回放</small><b>{value.recentReplay.title}</b></span>
            <i aria-hidden="true">↗</i>
          </button>
        )}

        {otherPlans.length > 0 && (
          <section className="plan-list secondary-plans" aria-label="其他学习周期">
            <p className="section-label">其他 Plan</p>
            {otherPlans.map((plan, index) => (
              <button key={plan.id} type="button" onClick={() => onOpen(plan.id)}>
                <span className="plan-number">{String(index + 1).padStart(2, '0')}</span>
                <span className="plan-copy">
                  <small>{plan.status}</small>
                  <strong>{plan.title}</strong>
                  <span>{plan.capabilityStandard}</span>
                </span>
                <span className="plan-arrow" aria-hidden="true">↗</span>
              </button>
            ))}
          </section>
        )}

        <button
          type="button"
          className="roadmap-entry quiet home-roadmap-entry"
          onClick={onRoadmapOpen}
        >
          <span className="plan-number">览</span>
          <span className="plan-copy">
            <small>学习集</small>
            <strong>学习总览</strong>
            <span>回看全局 · 讨论新的学习周期</span>
          </span>
          <span className="plan-arrow" aria-hidden="true">↗</span>
        </button>

        <section className="home-reference">
          <details>
            <summary>学习集概述</summary>
            <MarkdownView>{value.learningSet.goal}</MarkdownView>
          </details>
          {value.learningSet.learningPrinciples && (
            <details>
              <summary>研习要领</summary>
              <MarkdownView>{value.learningSet.learningPrinciples}</MarkdownView>
            </details>
          )}
        </section>
      </div>
    </main>
  );
}
