import { useEffect, useState, type FormEvent } from 'react';
import type {
  ProblemActivitySnapshot,
  ProblemAttemptResponse,
  StudentProblemCard,
} from '../../shared/contracts';
import { MarkdownView } from '../components/MarkdownView';

export type ProblemCardView = StudentProblemCard & { activity: ProblemActivitySnapshot };

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
  useEffect(() => setStudentNote(value.studentNote), [value.id, value.revision]);
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (answer.trim()) void onAttempt({ kind: 'answer', text: answer.trim() });
  };
  return (
    <main className="m1b-problem-page">
      <header><small>Problem card · revision {value.revision}</small><h1>{value.title}</h1></header>
      <section className="m1b-problem-stem"><MarkdownView>{value.stem}</MarkdownView></section>

      {value.standardAnswer === null ? (
        <section className="m1b-answer-gate">
          <form onSubmit={submit}>
            <label>你的作答<textarea value={answer} onChange={(event) => setAnswer(event.target.value)} /></label>
            <button type="submit" disabled={!answer.trim()}>提交作答</button>
          </form>
          {value.activity.latestAttempt ? (
            <button type="button" onClick={() => void onReveal()}>查看标准答案</button>
          ) : (
            <button type="button" onClick={() => void (async () => {
              await onAttempt({ kind: 'cannot' });
              await onReveal();
            })()}>不会，直接看答案</button>
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
        <button type="button" onClick={() => void onSaveNote({
          expectedRevision: value.revision,
          studentNote,
        })}>保存题内笔记</button>
      </section>
      <footer>
        <button type="button" className="m1b-ask-teacher" onClick={() => void onAskTeacher()}>
          带着这次作答问老师
        </button>
      </footer>
    </main>
  );
}

export default ProblemCardPage;

