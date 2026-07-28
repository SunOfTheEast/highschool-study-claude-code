import type { StudentNotebook } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';
import { StudentCard } from './StudentCard';

const kindLabel = {
  dialogue: '互动',
  problem: '题目',
  material: '材料',
  reflection: '回顾',
} as const;

export function CurrentActivityStage({
  notebook,
  paused,
  onResume,
}: {
  notebook: StudentNotebook | null;
  paused: boolean;
  onResume(): void;
}) {
  const active = notebook?.lesson.blocks.find((block) => block.status === 'active') ?? null;

  return (
    <section className="current-activity-stage" aria-label="当前课堂">
      <header>
        <span>当前课堂</span>
        {active && <small>{kindLabel[active.kind]} · {active.id}</small>}
      </header>
      {!active ? (
        <div className="stage-orientation">
          <h2>等待课堂导师推进</h2>
          <p>当前没有已经激活的课堂节点，未开始的内容仍保持收起。</p>
        </div>
      ) : (
        <div className="stage-content">
          <h2>{active.title}</h2>
          {active.studentView && <MarkdownView>{active.studentView}</MarkdownView>}
          {active.uses.flatMap((alias) => {
            const card = notebook?.cards[alias];
            return card ? [<StudentCard key={alias} alias={alias} card={card} />] : [];
          })}
        </div>
      )}
      {paused && (
        <footer>
          <span>课堂已暂停，当前节点仍保留。</span>
          <button type="button" onClick={onResume}>继续上课</button>
        </footer>
      )}
    </section>
  );
}
