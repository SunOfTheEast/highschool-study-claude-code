import type { LessonReplay } from '../../shared/contracts';

const kindLabel = { message: '对话', trace: 'Trace', route: '路线', image: '图片' } as const;

export function ReplayTimeline({ replay }: { replay: LessonReplay }) {
  return (
    <section className="replay-timeline">
      <header>
        <span>Lesson replay</span>
        <b>{replay.mode === 'evidence-only' ? '仅证据回放' : '完整回放'}</b>
      </header>
      {replay.mode === 'evidence-only' && (
        <p>未加载到 Pi Session 历史；这里只呈现原始 Trace 与路线记录。</p>
      )}
      <ol>
        {replay.items.map((item) => (
          <li key={`${item.kind}:${item.id}`} data-kind={item.kind}>
            <span>{kindLabel[item.kind]}</span>
            <div>
              <b>{item.label}</b>
              <p>{item.detail}</p>
              {item.source && <code>{item.source}</code>}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
