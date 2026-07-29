import type { LearningReview } from '../../shared/contracts';

type Props = {
  value: LearningReview;
  onEvidence(source: string): void;
  onDisputePrefill(text: string): void;
};

function disputePrefill(source: string, claim: string): string {
  return [
    '我对这条学习回顾有不同看法。',
    `来源：${source}`,
    `当前判断：${claim}`,
    '我的补充：',
  ].join('\n');
}

function SourceActions({
  source,
  claim,
  onEvidence,
  onDisputePrefill,
}: {
  source: string;
  claim: string;
  onEvidence(source: string): void;
  onDisputePrefill(text: string): void;
}) {
  return (
    <div className="learning-review-actions">
      <button type="button" onClick={() => onEvidence(source)}>查看这次表现</button>
      <button
        type="button"
        onClick={() => onDisputePrefill(disputePrefill(source, claim))}
      >
        这和我的实际情况不一样
      </button>
    </div>
  );
}

export function PlanLearningReview({
  value,
  onEvidence,
  onDisputePrefill,
}: Props) {
  return (
    <section className="plan-learning-review" aria-label="阶段学习回顾">
      <header>
        <span>这一阶段，你带走了什么</span>
        <h2>{value.conclusion}</h2>
      </header>
      <p className="learning-review-boundary">
        这项判断目前适用于：{value.boundary}
      </p>
      <div className="learning-review-next">
        <small>接下来</small>
        <p>{value.nextStep}</p>
      </div>

      <details className="plan-learning-review-details">
        <summary>为什么这样判断</summary>
        <section>
          <h3>最能说明这一点</h3>
          {value.keyEvidence.map((item) => (
            <article key={item.source}>
              <p>{item.claim}</p>
              <SourceActions
                source={item.source}
                claim={item.claim}
                onEvidence={onEvidence}
                onDisputePrefill={onDisputePrefill}
              />
            </article>
          ))}
        </section>

        {value.supportingEvidence.length > 0 && (
          <section>
            <h3>可以作为参考</h3>
            {value.supportingEvidence.map((item) => (
              <article key={item.source}>
                <p>{item.claim}</p>
                <small>{item.limitation}</small>
                <SourceActions
                  source={item.source}
                  claim={item.claim}
                  onEvidence={onEvidence}
                  onDisputePrefill={onDisputePrefill}
                />
              </article>
            ))}
          </section>
        )}

        {value.openQuestions.length > 0 && (
          <section>
            <h3>还需要再看看</h3>
            {value.openQuestions.map((item) => (
              <article key={`${item.question}:${item.nextCheck}`}>
                <p>{item.question}</p>
                <small>下次会这样确认：{item.nextCheck}</small>
              </article>
            ))}
          </section>
        )}
      </details>
    </section>
  );
}
