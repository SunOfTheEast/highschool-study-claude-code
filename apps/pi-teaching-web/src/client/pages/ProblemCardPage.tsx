import { useEffect, useState, type FormEvent } from 'react';
import type {
  AssetFormation,
  AssetReviewProjection,
  LearningAssetSemanticTags,
  ProblemActivitySnapshot,
  ProblemCardContentHistoryEntry,
  ProblemAttemptResponse,
  ProblemAttemptEvent,
  ReviewResult,
  StudentProblemCard,
  MaterialSourceLabel,
} from '../../shared/contracts';
import { AssetNeighbors, AssetProvenance, AssetTags } from '../components/AssetSources';
import type { SemanticAssetNeighbor } from '../semantic-graph';
import { MarkdownView } from '../components/MarkdownView';
import { publicErrorText } from '../public-errors';
import { AssetReviewControls } from '../components/AssetReviewControls';

export type ProblemCardView = StudentProblemCard & {
  contentHistory?: ProblemCardContentHistoryEntry[];
  activity: ProblemActivitySnapshot;
  semanticTags?: LearningAssetSemanticTags | null;
  formation?: AssetFormation | null;
  review?: AssetReviewProjection | null;
  sourceLabels?: MaterialSourceLabel[];
};

function failureText(error: unknown): string {
  return publicErrorText(error, '这一步暂时没有完成，请稍后再试。');
}

export function ProblemCardPage({
  value,
  onAttempt,
  onReveal,
  onSaveNote,
  onAskTeacher,
  onReview,
  onReviewAction,
  onTag,
  neighbors = [],
  onOpenNeighbor,
}: {
  value: ProblemCardView;
  onAttempt(response: ProblemAttemptResponse): Promise<void | ProblemAttemptEvent>;
  onReveal(): Promise<void>;
  onSaveNote(input: { expectedRevision: number; studentNote: string }): Promise<void>;
  onAskTeacher(): Promise<void>;
  onReview?(result: ReviewResult, problemAttemptId: string): Promise<void>;
  onReviewAction?(action: 'enroll' | 'remove' | 'restart'): Promise<void>;
  onTag?(tag: string): void;
  neighbors?: SemanticAssetNeighbor[];
  onOpenNeighbor?(asset: SemanticAssetNeighbor['asset']): void;
}) {
  const [answer, setAnswer] = useState('');
  const [studentNote, setStudentNote] = useState(value.studentNote);
  const [attempting, setAttempting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [reviewRevision, setReviewRevision] = useState(value.revision);
  const [reviewAttemptId, setReviewAttemptId] = useState<string | null>(null);
  const [reviewRevealed, setReviewRevealed] = useState(false);
  const [reviewBusy, setReviewBusy] = useState(false);
  useEffect(() => setStudentNote(value.studentNote), [value.id, value.revision]);
  useEffect(() => {
    if (!reviewing || reviewRevision === value.revision) return;
    setReviewing(false);
    setError('题卡刚刚更新了，请从最新版重新开始复习。');
  }, [reviewing, reviewRevision, value.revision]);

  const run = async (
    setBusy: (value: boolean) => void,
    action: () => Promise<void>,
    success?: string,
  ) => {
    setBusy(true);
    setError(null);
    setReceipt(null);
    try {
      await action();
      if (success) setReceipt(success);
    } catch (reason) {
      setError(failureText(reason));
    } finally {
      setBusy(false);
    }
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const text = answer.trim();
    if (!text) return;
    if (!reviewing) {
      void run(setAttempting, () => onAttempt({ kind: 'answer', text }).then(() => {}), '作答已记录。');
      return;
    }
    void (async () => {
      setAttempting(true);
      setError(null);
      try {
        const result = await onAttempt({ kind: 'answer', text });
        if (!result) throw new Error('本次作答没有返回可核验记录');
        setReviewAttemptId(result.id);
        setReceipt('本次作答已记录，现在可以查看答案。');
      } catch (reason) {
        setError(failureText(reason));
      } finally {
        setAttempting(false);
      }
    })();
  };
  const hasAttempt = reviewing ? reviewAttemptId !== null : value.activity.latestAttempt !== null;

  const startReview = () => {
    setReviewing(true);
    setReviewRevision(value.revision);
    setReviewAttemptId(null);
    setReviewRevealed(false);
    setAnswer('');
    setError(null);
    setReceipt(null);
  };

  const revealReviewAnswer = async () => {
    if (!reviewAttemptId) return;
    setRevealing(true);
    setError(null);
    try {
      await onReveal();
      setReviewRevealed(true);
    } catch (reason) {
      setError(failureText(reason));
    } finally {
      setRevealing(false);
    }
  };

  const cannotReview = async () => {
    setRevealing(true);
    setError(null);
    try {
      const attempt = await onAttempt({ kind: 'cannot' });
      if (!attempt) throw new Error('本次作答没有返回可核验记录');
      setReviewAttemptId(attempt.id);
      await onReveal();
      setReviewRevealed(true);
    } catch (reason) {
      setError(failureText(reason));
    } finally {
      setRevealing(false);
    }
  };

  const rateReview = async (result: ReviewResult) => {
    if (!onReview || !reviewAttemptId || !reviewRevealed || reviewRevision !== value.revision) return;
    setReviewBusy(true);
    setError(null);
    try {
      await onReview(result, reviewAttemptId);
      setReviewing(false);
      setReceipt('复习结果已保存。');
    } catch (reason) {
      setError(failureText(reason));
    } finally {
      setReviewBusy(false);
    }
  };

  return (
    <main className="m1b-problem-page asset-reading-page">
      <header>
        <div>
          <small>Problem card · 第 {value.revision} 版</small>
          <h1><MarkdownView inline>{value.title}</MarkdownView></h1>
        </div>
        <button
          type="button"
          className="action-solid"
          disabled={asking}
          onClick={() => void run(setAsking, onAskTeacher)}
        >
          {asking ? '正在打开对话…' : hasAttempt ? '带着这次作答问老师' : '带着这道题问老师'}
        </button>
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
        direct
        {...(onReview ? { onStart: startReview } : {})}
        {...(onReviewAction ? { onManage: onReviewAction } : {})}
      />
      <section className="m1b-problem-stem"><MarkdownView>{value.stem}</MarkdownView></section>

      {(reviewing ? !reviewRevealed : value.standardAnswer === null) ? (
        <section className="m1b-answer-gate">
          <form onSubmit={submit}>
            <label>你的作答<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} /></label>
            <button type="submit" className="action-wash" disabled={!answer.trim() || attempting}>
              {attempting ? '正在记录…' : '提交作答'}
            </button>
          </form>
          {hasAttempt ? (
            <button
              type="button"
              className="action-outline"
              disabled={revealing}
              onClick={() => reviewing
                ? void revealReviewAnswer()
                : void run(setRevealing, onReveal)}
            >
              {revealing ? '正在打开…' : '查看标准答案'}
            </button>
          ) : (
            <button
              type="button"
              className="action-outline"
              disabled={attempting || revealing}
              onClick={() => reviewing
                ? void cannotReview()
                : void run(setRevealing, async () => {
                  await onAttempt({ kind: 'cannot' });
                  await onReveal();
                })}
            >
              {revealing ? '正在打开…' : '不会，直接看答案'}
            </button>
          )}
        </section>
      ) : (
        <section className="m1b-standard-answer">
          <small>标准答案</small>
          <MarkdownView>{value.standardAnswer ?? '答案已打开，正在刷新…'}</MarkdownView>
          {reviewing && reviewRevealed && (
            <div className="asset-review-rating" aria-label="本次回忆结果">
              <button type="button" disabled={reviewBusy} className="action-outline" onClick={() => void rateReview('forgot')}>没想起来</button>
              <button type="button" disabled={reviewBusy} className="action-outline" onClick={() => void rateReview('effortful')}>想起来了，但比较吃力</button>
              <button type="button" disabled={reviewBusy} className="action-solid" onClick={() => void rateReview('fluent')}>顺利想起来</button>
            </div>
          )}
        </section>
      )}

      <section className="m1b-student-note">
        <label>我的题内笔记<textarea value={studentNote} onChange={(event) => setStudentNote(event.target.value)} /></label>
        <button
          type="button"
          className="action-wash"
          disabled={savingNote}
          onClick={() => void run(setSavingNote, () => onSaveNote({
            expectedRevision: value.revision,
            studentNote,
          }), '题内笔记已保存。')}
        >
          {savingNote ? '正在保存…' : '保存题内笔记'}
        </button>
      </section>
      {receipt && <p className="inline-success" role="status">{receipt}</p>}
      {error && <p className="inline-error" role="alert">{error}</p>}
      {(value.contentHistory?.length ?? 0) > 0 && (
        <details className="asset-content-history">
          <summary>内容历史 · {value.contentHistory!.length}</summary>
          {[...value.contentHistory!].reverse().map((entry) => (
            <article key={entry.revision}>
              <small>
                第 {entry.revision} 版
                {entry.updatedAt ? ` · ${new Date(entry.updatedAt).toLocaleString('zh-CN')}` : ''}
              </small>
              <h2><MarkdownView inline>{entry.title}</MarkdownView></h2>
              <MarkdownView>{entry.stem}</MarkdownView>
              {entry.studentNote && <p><b>当时的题内笔记：</b>{entry.studentNote}</p>}
            </article>
          ))}
        </details>
      )}
    </main>
  );
}

export default ProblemCardPage;
