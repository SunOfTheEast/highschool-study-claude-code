import { useEffect, useState } from 'react';
import type {
  AssetFormation,
  LearningAssetSemanticTags,
  LearningNote,
  LearningNoteBlock,
} from '../../shared/contracts';
import { ApiError } from '../api';
import { AssetProvenance, AssetTags } from '../components/AssetSources';
import { MarkdownView } from '../components/MarkdownView';
import { publicErrorText } from '../public-errors';

type NoteView = LearningNote & {
  semanticTags?: LearningAssetSemanticTags | null;
  formation?: AssetFormation | null;
};

export function NotePage({
  value,
  onSave,
  onAskTeacher,
  onReload,
}: {
  value: NoteView;
  onSave(input: { expectedRevision: number; title: string; blocks: LearningNoteBlock[] }): Promise<void>;
  onAskTeacher?(): void;
  onReload?(): void;
}) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(value.title);
  const [blocks, setBlocks] = useState(value.blocks);
  const [baseRevision, setBaseRevision] = useState(value.revision);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (editing) return;
    setTitle(value.title);
    setBlocks(value.blocks);
    setBaseRevision(value.revision);
  }, [value.id, value.revision, editing]);

  const beginEdit = () => {
    setTitle(value.title);
    setBlocks(value.blocks);
    setBaseRevision(value.revision);
    setSaveError(null);
    setSaved(false);
    setEditing(true);
  };
  const reloadDraft = () => {
    setTitle(value.title);
    setBlocks(value.blocks);
    setBaseRevision(value.revision);
    setSaveError(null);
    onReload?.();
  };
  const update = (index: number, block: LearningNoteBlock) => {
    setBlocks((current) => current.map((item, position) => position === index ? block : item));
  };
  const stale = editing && baseRevision !== value.revision;

  return (
    <main className="m1b-note-page asset-reading-page">
      <header>
        <div><small>Note · 第 {value.revision} 版</small><h1>{value.title}</h1></div>
        <div className="asset-detail-actions">
          {onAskTeacher && (
            <button type="button" className="action-solid" onClick={onAskTeacher}>
              带着这份笔记问老师
            </button>
          )}
          <button
            type="button"
            className="action-outline"
            onClick={() => editing ? setEditing(false) : beginEdit()}
          >
            {editing ? '取消编辑' : '编辑笔记'}
          </button>
        </div>
      </header>
      <AssetTags value={value.semanticTags} />
      <AssetProvenance formation={value.formation ?? null} sources={value.sources} />
      {editing ? (
        <form onSubmit={(event) => {
          event.preventDefault();
          setSaving(true);
          setSaveError(null);
          setSaved(false);
          void onSave({ expectedRevision: baseRevision, title, blocks })
            .then(() => {
              setSaved(true);
              setEditing(false);
            })
            .catch((error: unknown) => {
              setSaveError(error instanceof ApiError && error.status === 409
                ? '内容已被更新。你的草稿仍在，可以重载最新版本后再修改。'
                : publicErrorText(error, '笔记暂时没有保存，请稍后再试。'));
            })
            .finally(() => setSaving(false));
        }}>
          {(stale || saveError?.startsWith('内容已被更新')) && (
            <p className="revision-conflict" role="alert">
              内容已被更新。你的草稿仍在。
              <button type="button" className="action-text" onClick={reloadDraft}>重载最新版本</button>
            </p>
          )}
          {saveError && !saveError.startsWith('内容已被更新') && <p role="alert">{saveError}</p>}
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
          <button type="submit" className="action-wash" disabled={saving || stale}>
            {saving ? '正在保存…' : '保存修改'}
          </button>
        </form>
      ) : (
        <section className="m1b-note-blocks">
          {saved && <p className="inline-success" role="status">笔记已保存。</p>}
          {value.blocks.map((block, index) => block.kind === 'markdown' ? (
            <article key={index}><MarkdownView>{block.body}</MarkdownView></article>
          ) : (
            <article className="m1b-recall" key={index}>
              <small>回忆一下</small>
              <MarkdownView>{block.prompt}</MarkdownView>
              {revealed.includes(index)
                ? <div className="m1b-recall-answer"><MarkdownView>{block.answer}</MarkdownView></div>
                : <button type="button" className="action-outline" onClick={() => setRevealed([...revealed, index])}>显示答案</button>}
            </article>
          ))}
        </section>
      )}
    </main>
  );
}

export default NotePage;
