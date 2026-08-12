import { useEffect, useState } from 'react';
import type {
  AssetFormation,
  AssetReviewProjection,
  LearningAssetSemanticTags,
  LearningNote,
  LearningNoteBlock,
  LearningNoteContentHistoryEntry,
  ReviewResult,
  MaterialSourceLabel,
} from '../../shared/contracts';
import { ApiError } from '../api';
import { AssetNeighbors, AssetProvenance, AssetTags } from '../components/AssetSources';
import type { SemanticAssetNeighbor } from '../semantic-graph';
import { MarkdownView } from '../components/MarkdownView';
import { publicErrorText } from '../public-errors';
import { AssetReviewControls } from '../components/AssetReviewControls';

type NoteView = LearningNote & {
  contentHistory?: LearningNoteContentHistoryEntry[];
  semanticTags?: LearningAssetSemanticTags | null;
  formation?: AssetFormation | null;
  review?: AssetReviewProjection | null;
  sourceLabels?: MaterialSourceLabel[];
};

export function NoteDraftPreview({
  title,
  blocks,
}: {
  title: string;
  blocks: LearningNoteBlock[];
}) {
  return (
    <section className="note-draft-preview" aria-label="未保存草稿预览">
      <small>未保存草稿预览</small>
      <h2><MarkdownView inline>{title || '未命名笔记'}</MarkdownView></h2>
      {blocks.map((block, index) => block.kind === 'markdown' ? (
        <article key={index}><MarkdownView>{block.body}</MarkdownView></article>
      ) : (
        <article className="m1b-recall" key={index}>
          <small>回忆提示</small>
          <MarkdownView>{block.prompt}</MarkdownView>
          <div className="m1b-recall-answer"><MarkdownView>{block.answer}</MarkdownView></div>
        </article>
      ))}
    </section>
  );
}

export function NotePage({
  value,
  onSave,
  onAskTeacher,
  onReload,
  onReview,
  onReviewAction,
  onTag,
  neighbors = [],
  onOpenNeighbor,
}: {
  value: NoteView;
  onSave(input: { expectedRevision: number; title: string; blocks: LearningNoteBlock[] }): Promise<void>;
  onAskTeacher?(): void;
  onReload?(): void;
  onReview?(result: ReviewResult): Promise<void>;
  onReviewAction?(action: 'enroll' | 'remove' | 'restart'): Promise<void>;
  onTag?(tag: string): void;
  neighbors?: SemanticAssetNeighbor[];
  onOpenNeighbor?(asset: SemanticAssetNeighbor['asset']): void;
}) {
  const [editing, setEditing] = useState(false);
  const [editorMode, setEditorMode] = useState<'edit' | 'preview'>('edit');
  const [title, setTitle] = useState(value.title);
  const [blocks, setBlocks] = useState(value.blocks);
  const [baseRevision, setBaseRevision] = useState(value.revision);
  const [revealed, setRevealed] = useState<number[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [reviewing, setReviewing] = useState(false);
  const [reviewRevision, setReviewRevision] = useState(value.revision);
  const [reviewBusy, setReviewBusy] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    if (editing) return;
    setTitle(value.title);
    setBlocks(value.blocks);
    setBaseRevision(value.revision);
  }, [value.id, value.revision, editing]);

  useEffect(() => {
    if (!reviewing || value.revision === reviewRevision) return;
    setReviewing(false);
    setReviewError('笔记刚刚更新了，请从最新版重新开始复习。');
  }, [reviewing, reviewRevision, value.revision]);

  const beginEdit = () => {
    setTitle(value.title);
    setBlocks(value.blocks);
    setBaseRevision(value.revision);
    setSaveError(null);
    setSaved(false);
    setEditorMode('edit');
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
  const recallBlocks = value.blocks.flatMap((block, index) => (
    block.kind === 'recall' ? [{ block, index }] : []
  ));
  const allReviewAnswersShown = recallBlocks.length > 0
    && recallBlocks.every(({ index }) => revealed.includes(index));

  const startReview = () => {
    setRevealed([]);
    setReviewRevision(value.revision);
    setReviewError(null);
    setReviewing(true);
  };

  const rateReview = async (result: ReviewResult) => {
    if (!onReview || !allReviewAnswersShown || reviewRevision !== value.revision) return;
    setReviewBusy(true);
    setReviewError(null);
    try {
      await onReview(result);
      setReviewing(false);
    } catch (error) {
      setReviewError(publicErrorText(error, '这次复习结果暂时没有保存，请稍后再试。'));
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <main className="m1b-note-page asset-reading-page">
      <header>
        <div>
          <small>Note · 第 {value.revision} 版</small>
          <h1><MarkdownView inline>{value.title}</MarkdownView></h1>
        </div>
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
      <AssetTags value={value.semanticTags} {...(onTag ? { onTag } : {})} />
      <AssetProvenance
        formation={value.formation ?? null}
        sources={value.sources}
        sourceLabels={value.sourceLabels ?? []}
      />
      <AssetNeighbors value={neighbors} {...(onOpenNeighbor ? { onOpen: onOpenNeighbor } : {})} />
      <AssetReviewControls
        review={value.review ?? null}
        direct={recallBlocks.length > 0}
        {...(onReview && recallBlocks.length > 0 ? { onStart: startReview } : {})}
        {...(onAskTeacher ? { onTeacher: onAskTeacher } : {})}
        {...(onReviewAction ? { onManage: onReviewAction } : {})}
      />
      {reviewError && <p className="inline-error" role="alert">{reviewError}</p>}
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
          <div className="note-editor-mode" aria-label="笔记编辑视图">
            <button type="button" className={editorMode === 'edit' ? 'action-wash' : 'action-text'} onClick={() => setEditorMode('edit')}>编辑</button>
            <button type="button" className={editorMode === 'preview' ? 'action-wash' : 'action-text'} onClick={() => setEditorMode('preview')}>预览</button>
          </div>
          {editorMode === 'preview' ? <NoteDraftPreview title={title} blocks={blocks} /> : <>
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
          </>}
          <button type="submit" className="action-wash" disabled={saving || stale}>
            {saving ? '正在保存…' : '保存修改'}
          </button>
        </form>
      ) : reviewing ? (
        <section className="m1b-note-blocks" aria-label="直接复习">
          {recallBlocks.map(({ block, index }) => (
            <article className="m1b-recall" key={index}>
              <small>先在心里回答</small>
              <MarkdownView>{block.prompt}</MarkdownView>
              {revealed.includes(index)
                ? <div className="m1b-recall-answer"><MarkdownView>{block.answer}</MarkdownView></div>
                : <button type="button" className="action-outline" onClick={() => setRevealed((current) => [...current, index])}>显示答案</button>}
            </article>
          ))}
          {allReviewAnswersShown && (
            <div className="asset-review-rating" aria-label="本次回忆结果">
              <button type="button" disabled={reviewBusy} className="action-outline" onClick={() => void rateReview('forgot')}>没想起来</button>
              <button type="button" disabled={reviewBusy} className="action-outline" onClick={() => void rateReview('effortful')}>想起来了，但比较吃力</button>
              <button type="button" disabled={reviewBusy} className="action-solid" onClick={() => void rateReview('fluent')}>顺利想起来</button>
            </div>
          )}
        </section>
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
      {(value.contentHistory?.length ?? 0) > 0 && (
        <details className="asset-content-history">
          <summary>内容历史 · {value.contentHistory!.length}</summary>
          {[...value.contentHistory!].reverse().map((entry) => (
            <article key={entry.revision}>
              <small>第 {entry.revision} 版 · {new Date(entry.updatedAt).toLocaleString('zh-CN')}</small>
              <h2><MarkdownView inline>{entry.title}</MarkdownView></h2>
              {entry.blocks.map((block, index) => block.kind === 'markdown' ? (
                <MarkdownView key={index}>{block.body}</MarkdownView>
              ) : (
                <div className="m1b-recall" key={index}>
                  <small>回忆提示</small>
                  <MarkdownView>{block.prompt}</MarkdownView>
                  <div className="m1b-recall-answer"><MarkdownView>{block.answer}</MarkdownView></div>
                </div>
              ))}
            </article>
          ))}
        </details>
      )}
    </main>
  );
}

export default NotePage;
