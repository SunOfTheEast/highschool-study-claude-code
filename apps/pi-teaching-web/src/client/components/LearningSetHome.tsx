import type { HomeSnapshot } from '../../shared/contracts';
import { LearningTree } from './LearningTree';
import { MarkdownView } from './MarkdownView';

export function LearningSetHome({
  value,
  continuePath,
  onContinue,
  onOpen,
  onLessonOpen,
  onRoadmapOpen,
}: {
  value: HomeSnapshot;
  continuePath: string;
  onContinue(path: string): void;
  onOpen(id: string): void;
  onLessonOpen(planId: string, lessonId: string): void;
  onRoadmapOpen(): void;
}) {
  const selectedKey = value.continueTarget.kind === 'lesson'
    ? `lesson:${value.continueTarget.lessonId}`
    : value.continueTarget.kind === 'coach'
      ? `plan:${value.continueTarget.planId}`
      : 'roadmap';
  return (
    <main className="home continue-home" data-theme="liubai-xinzhongshi">
      <header className="home-heading">
        <p className="eyebrow">StudyForge · Learning Set</p>
        <h1>{value.learningSet.title}</h1>
        <div className="home-overview">
          <MarkdownView>{value.learningSet.overview}</MarkdownView>
        </div>
      </header>

      <div className="home-continuation">
        <p className="section-label">从上次的位置继续</p>
        <button
          className="continue-entry"
          type="button"
          onClick={() => onContinue(continuePath)}
        >
          <small>
            继续学习{value.currentPlan ? ` · ${value.currentPlan.title}` : ''}
          </small>
          <strong>{value.continueTarget.title}</strong>
          <span>{value.continueTarget.detail}</span>
          <i aria-hidden="true">↗</i>
        </button>

        {value.currentPlan && (
          <section className="home-stage" aria-label="当前阶段">
            <header>
              <span>当前阶段</span>
              <b>
                {value.lessonProgress.completed}/{value.lessonProgress.total} 节
              </b>
            </header>
            <p>{value.studentPlan?.currentPosition}</p>
            {value.studentPlan?.nextLesson ? (
              <blockquote>
                <small>{value.studentPlan.nextLesson.publicTitle}</small>
                {value.studentPlan.nextLesson.publicPurpose && (
                  <MarkdownView>{value.studentPlan.nextLesson.publicPurpose}</MarkdownView>
                )}
                <p>
                  {value.studentPlan.nextLesson.blockCount} 个课堂环节
                  {value.studentPlan.nextLesson.blockKinds.length > 0
                    ? ` · ${value.studentPlan.nextLesson.blockKinds.length} 类活动`
                    : ''}
                </p>
                {value.studentPlan.nextLesson.sourceNumbers.length > 0 && (
                  <p>题号：{value.studentPlan.nextLesson.sourceNumbers.join('、')}</p>
                )}
              </blockquote>
            ) : <p>正在与学习顾问商议下一课。</p>}
          </section>
        )}

        {value.signals.length > 0 && (
          <section className="home-signals" aria-label="最近学习信号">
            <p className="section-label">最近变化</p>
            {value.signals.map((signal) => (
              <article key={`${signal.label}:${signal.source ?? signal.value}`}>
                <small>{signal.label}</small>
                <p>{signal.value}</p>
                {signal.source && <code>{signal.source}</code>}
              </article>
            ))}
          </section>
        )}

        {value.recentReplay && (
          <button
            type="button"
            className="recent-replay-entry"
            onClick={() => onContinue(value.recentReplay!.route)}
          >
            <span><small>最近课堂回放</small><b>{value.recentReplay.title}</b></span>
            <i aria-hidden="true">↗</i>
          </button>
        )}

        <section className="home-learning-tree" aria-labelledby="home-learning-tree-title">
          <p className="section-label" id="home-learning-tree-title">课程学习树</p>
          <LearningTree
            roadmapTitle={value.learningSet.title}
            planTree={value.learningSet.planTree}
            currentPlanId={value.currentPlan?.id ?? null}
            lessonTree={value.currentLessonTree}
            selectedKey={selectedKey}
            onRoadmap={onRoadmapOpen}
            onPlan={onOpen}
            onLesson={onLessonOpen}
          />
        </section>

        <section className="home-reference">
          <details>
            <summary>学习集概述</summary>
            <MarkdownView>{value.learningSet.goal}</MarkdownView>
          </details>
          {value.learningSet.learningPrinciples && (
            <details>
              <summary>研习要领</summary>
              <MarkdownView>{value.learningSet.learningPrinciples}</MarkdownView>
            </details>
          )}
        </section>
      </div>
    </main>
  );
}
