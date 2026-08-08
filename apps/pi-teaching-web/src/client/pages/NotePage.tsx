import { useEffect, useState } from 'react';
import type { LearningNote, LearningNoteBlock } from '../../shared/contracts';
import { MarkdownView } from '../components/MarkdownView';

export function NotePage({
  value,
  onSave,
}: {
  value: LearningNote;
  onSave(input: { expectedRevision: number; title: string; blocks: LearningNoteBlock[] }): Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(value.title);
  const [blocks, setBlocks] = useState(value.blocks);
  const [revealed, setRevealed] = useState<number[]>([]);
  useEffect(() => {
    setTitle(value.title);
    setBlocks(value.blocks);
    setEditing(false);
  }, [value.id, value.revision]);
  const update = (index: number, block: LearningNoteBlock) => {
    setBlocks((current) => current.map((item, position) => position === index ? block : item));
  };
  return (
    <main className="m1b-note-page">
      <header>
        <div><small>Note · revision {value.revision}</small><h1>{value.title}</h1></div>
        <button type="button" onClick={() => setEditing((current) => !current)}>
          {editing ? '取消编辑' : '编辑笔记'}
        </button>
      </header>
      {editing ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          void onSave({ expectedRevision: value.revision, title, blocks });
        }}>
          <label>标题<input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
          {blocks.map((block, index) => block.kind === 'markdown' ? (
            <label key={index}>正文<textarea value={block.body} onChange={(event) => update(index, {
              kind: 'markdown', body: event.target.value,
            })} /></label>
          ) : (
            <fieldset key={index}>
              <legend>回忆块</legend>
              <label>提示<textarea value={block.prompt} onChange={(event) => update(index, {
                ...block, prompt: event.target.value,
              })} /></label>
              <label>答案<textarea value={block.answer} onChange={(event) => update(index, {
                ...block, answer: event.target.value,
              })} /></label>
            </fieldset>
          ))}
          <button type="submit">保存修改</button>
        </form>
      ) : (
        <section className="m1b-note-blocks">
          {value.blocks.map((block, index) => block.kind === 'markdown' ? (
            <article key={index}><MarkdownView>{block.body}</MarkdownView></article>
          ) : (
            <article className="m1b-recall" key={index}>
              <small>回忆一下</small>
              <MarkdownView>{block.prompt}</MarkdownView>
              {revealed.includes(index)
                ? <div className="m1b-recall-answer"><MarkdownView>{block.answer}</MarkdownView></div>
                : <button type="button" onClick={() => setRevealed([...revealed, index])}>显示答案</button>}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default NotePage;

