import { useEffect, useState, type FormEvent } from 'react';
import type {
  AssetFormation,
  LearningAssetSemanticTags,
  ProblemActivitySnapshot,
  ProblemAttemptResponse,
  StudentProblemCard,
} from '../../shared/contracts';
import { AssetProvenance, AssetTags } from '../components/AssetSources';
import { MarkdownView } from '../components/MarkdownView';
import { publicErrorText } from '../public-errors';

export type ProblemCardView = StudentProblemCard & {
  activity: ProblemActivitySnapshot;
  semanticTags?: LearningAssetSemanticTags | null;
  formation?: AssetFormation | null;
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
}: {
  value: ProblemCardView;
  onAttempt(response: ProblemAttemptResponse): Promise<void>;
  onReveal(): Promise<void>;
  onSaveNote(input: { expectedRevision: number; studentNote: string }): Promise<void>;
  onAskTeacher(): Promise<void>;
}) {
  const [answer, setAnswer] = useState('');
  const [studentNote, setStudentNote] = useState(value.studentNote);
  const [attempting, setAttempting] = useState(false);
  const [revealing, setRevealing] = useState(false);
  const [savingNote, setSavingNote] = useState(false);
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [receipt, setReceipt] = useState<string | null>(null);
  useEffect(() => setStudentNote(value.studentNote), [value.id, value.revision]);

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
    void run(setAttempting, () => onAttempt({ kind: 'answer', text }), '作答已记录。');
  };
  const hasAttempt = value.activity.latestAttempt !== null;

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
      <AssetTags value={value.semanticTags} />
      <AssetProvenance formation={value.formation ?? null} sources={value.sources} />
      <section className="m1b-problem-stem"><MarkdownView>{value.stem}</MarkdownView></section>

      {value.standardAnswer === null ? (
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
              onClick={() => void run(setRevealing, onReveal)}
            >
              {revealing ? '正在打开…' : '查看标准答案'}
            </button>
          ) : (
            <button
              type="button"
              className="action-outline"
              disabled={attempting || revealing}
              onClick={() => void run(setRevealing, async () => {
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
          <MarkdownView>{value.standardAnswer}</MarkdownView>
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
    </main>
  );
}

export default ProblemCardPage;
