import type {
  EvidenceView,
} from '../../shared/contracts';
import { HandoffTree } from './HandoffTree';

const assessmentLabel: Record<string, string> = {
  correct: '正确',
  partially_correct: '部分正确',
  incorrect: '错误',
  incomplete: '未完成',
};

const supportLabel: Record<string, string> = {
  none: '独立完成',
  tutor: '课堂导师支持',
  external: '外部支持',
};

export function EvidenceLens({ value, onClose }: { value: EvidenceView; onClose(): void }) {
  if (value.kind === 'handoff') {
    return (
      <section className="evidence-lens" role="dialog" aria-modal="true" aria-label="阶段认识来源">
        <button type="button" className="lens-scrim" aria-label="关闭阶段认识来源" onClick={onClose} />
        <article>
          <header>
            <span>阶段认识来源</span>
            <button type="button" onClick={onClose}>关闭</button>
          </header>
          <p className="eyebrow">可逐层回到课堂记录</p>
          <HandoffTree value={value.node} />
        </article>
      </section>
    );
  }
  return (
    <section className="evidence-lens" role="dialog" aria-modal="true" aria-label="记录来源">
      <button type="button" className="lens-scrim" aria-label="关闭记录来源" onClick={onClose} />
      <article>
        <header>
          <span>记录来源</span>
          <button type="button" onClick={onClose}>关闭</button>
        </header>
        <p className="source-anchor">{value.source}</p>
        <h2>{value.trace.lessonId} · {value.trace.blockId}</h2>
        <div className="evidence-tags">
          <span>{assessmentLabel[value.trace.assessment] ?? value.trace.assessment}</span>
          <span>{supportLabel[value.trace.support] ?? value.trace.support}</span>
        </div>
        <blockquote>{value.trace.note}</blockquote>
        {value.card && (
          <section className="evidence-card-meta">
            <small>绑定题卡</small>
            <h3>{value.card.title}</h3>
            <p>{value.card.goal}</p>
            <ul>
              {value.card.methods.map((method) => (
                <li key={`${method.role}:${method.name}`}>
                  <span>{method.role === 'primary' ? '主方法' : '次方法'}</span>{method.name}
                </li>
              ))}
            </ul>
          </section>
        )}
      </article>
    </section>
  );
}
