import type { ReactElement } from 'react';
import type { ActivityKind, LessonHandout } from '../../shared/contracts';
import { MarkdownView } from '../components/MarkdownView';

const kindLabel: Record<ActivityKind, string> = {
  dialogue: '思考与表达',
  problem: '独立完成',
  material: '阅读材料',
  reflection: '整理与回看',
};

export function LessonHandoutPage({
  value,
  error,
  loading = false,
  backHref,
  onPrint,
}: {
  value: LessonHandout | null;
  error: string | null;
  loading?: boolean;
  backHref?: string;
  onPrint(): void;
}): ReactElement {
  if (value === null && loading) {
    return (
      <main className="lesson-handout-page" data-state="loading">
        <section className="handout-loading" role="status">
          <span aria-hidden="true" />
          <strong>正在打开讲义</strong>
        </section>
      </main>
    );
  }
  if (value === null) {
    return (
      <main className="lesson-handout-page" data-state="error">
        <section className="handout-source-error" role="alert">
          <span>可打印讲义</span>
          <h1>讲义来源暂时无法读取</h1>
          <p>{error ?? '原 Lesson 不存在或已经无法通过当前课程树验证。'}</p>
          {backHref && <a href={backHref}>返回本课</a>}
        </section>
      </main>
    );
  }

  return (
    <main className="lesson-handout-page">
      <nav className="handout-actions" aria-label="讲义操作">
        {backHref && <a href={backHref}>返回本课</a>}
        <button type="button" onClick={onPrint}>打印 / 另存为 PDF</button>
      </nav>
      <article className="handout-paper">
        <header className="handout-heading">
          <span>StudyForge · Lesson Handout</span>
          <h1>{value.title}</h1>
          <div className="handout-student-fields" aria-label="学生信息">
            <label>姓名 <i /></label>
            <label>日期 <i /></label>
          </div>
        </header>

        <section className="handout-goal" aria-labelledby="handout-goal-title">
          <h2 id="handout-goal-title">本课目标</h2>
          <MarkdownView>{value.lessonGoal}</MarkdownView>
        </section>

        <div className="handout-blocks">
          {value.blocks.map((block, index) => (
            <section
              className="handout-block"
              data-kind={block.kind}
              key={block.id}
            >
              <header>
                <span>{String(index + 1).padStart(2, '0')}</span>
                <div>
                  <small>{kindLabel[block.kind]}</small>
                  <h2>{block.title}</h2>
                </div>
              </header>
              <div className="handout-student-view">
                <MarkdownView>{block.studentView}</MarkdownView>
              </div>
              <div className="handout-answer-space" aria-hidden="true" />
            </section>
          ))}
        </div>

        <footer className="handout-footer">
          <span>{value.planId} / {value.lessonId}</span>
          <span>StudyForge</span>
        </footer>
      </article>
    </main>
  );
}

export default LessonHandoutPage;
