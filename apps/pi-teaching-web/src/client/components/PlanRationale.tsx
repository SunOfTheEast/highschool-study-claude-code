import { MarkdownView } from './MarkdownView';

export function PlanRationale({ value }: { value: string }) {
  if (!value.trim()) return null;
  return (
    <section className="plan-rationale" aria-labelledby="plan-rationale-title">
      <span>Planning basis</span>
      <h3 id="plan-rationale-title">为什么这样安排</h3>
      <div className="plan-rationale-copy">
        <MarkdownView>{value}</MarkdownView>
      </div>
    </section>
  );
}
