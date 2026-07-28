import type { ReactNode } from 'react';
import type { LearningSetSnapshot } from '../../shared/contracts';
import { MarkdownView } from './MarkdownView';

export function RoadmapCoachShell({
  learningSet,
  onHome,
  children,
}: {
  learningSet: LearningSetSnapshot;
  onHome(): void;
  children: ReactNode;
}) {
  return (
    <main className="roadmap-workspace">
      <aside className="roadmap-context">
        <button type="button" className="roadmap-home" onClick={onHome}>
          <span className="brand-mark">SF</span>
          <span><b>返回学习集</b><small>StudyForge</small></span>
        </button>
        <p className="section-label">学习总览</p>
        <h1>{learningSet.title}</h1>
        <div className="roadmap-goal">
          <MarkdownView>{learningSet.goal}</MarkdownView>
        </div>
        <p className="roadmap-cycle-count">
          {learningSet.plans.length === 0
            ? '尚未建立学习周期'
            : `已建立 ${learningSet.plans.length} 个学习周期`}
        </p>
      </aside>
      {children}
    </main>
  );
}
