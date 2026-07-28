import type { LearningSetSnapshot } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function LearningSetHome({
  value,
  onOpen,
  onRoadmapOpen,
}: {
  value: LearningSetSnapshot;
  onOpen(id: string): void;
  onRoadmapOpen(): void;
}) {
  return (
    <main className="home" data-theme="liubai-xinzhongshi">
      <header className="home-heading">
        <p className="eyebrow">StudyForge · Learning Set</p>
        <h1>{value.title}</h1>
        <div className="home-overview">
          <MarkdownView>{value.overview}</MarkdownView>
        </div>
        {value.learningPrinciples && (
          <section className="home-principles" aria-label="研习要领">
            <p className="section-label">研习要领</p>
            <MarkdownView>{value.learningPrinciples}</MarkdownView>
          </section>
        )}
      </header>

      <section className="plan-list" aria-label="学习计划">
        <p className="section-label">
          {value.plans.length === 0 ? '从这里开始' : '选择当前学习周期'}
        </p>
        {value.plans.map((plan, index) => (
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
        <button
          type="button"
          className={`roadmap-entry ${value.plans.length === 0 ? 'primary' : 'quiet'}`}
          onClick={onRoadmapOpen}
        >
          <span className="plan-number">{value.plans.length === 0 ? '始' : '策'}</span>
          <span className="plan-copy">
            <small>{value.plans.length === 0 ? '学习商议' : '学习集'}</small>
            <strong>
              {value.plans.length === 0 ? '建立第一个学习周期' : '总览与规划'}
            </strong>
            <span>
              {value.plans.length === 0
                ? '先说说你的目标、现状与时间安排。'
                : '回看全局 · 开启新的学习周期'}
            </span>
          </span>
          <span className="plan-arrow" aria-hidden="true">↗</span>
        </button>
      </section>
    </main>
  );
}
