import type { LearningSetSnapshot } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function LearningSetHome({
  value,
  onOpen,
}: {
  value: LearningSetSnapshot;
  onOpen(id: string): void;
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
        <p className="section-label">选择当前学习周期</p>
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
      </section>
    </main>
  );
}
