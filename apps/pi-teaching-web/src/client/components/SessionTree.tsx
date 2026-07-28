import type { PlanWorkspaceSnapshot, SessionKey } from '../../shared/contracts';
import { PlanRationale } from './PlanRationale';

const statusLabel = {
  prepared: '待开始',
  active: '上课中',
  paused: '已暂停',
  closed: '已完成',
  abandoned: '已归档',
} as const;

export function SessionTree({
  workspace,
  selected,
  onSelect,
  onPlanSelect,
  onHome,
  explorerEnabled,
  onExplore,
}: {
  workspace: PlanWorkspaceSnapshot;
  selected: SessionKey;
  onSelect(key: SessionKey): void;
  onPlanSelect(planId: string): void;
  onHome(): void;
  explorerEnabled: boolean;
  onExplore(): void;
}) {
  const otherPlans = workspace.learningSet.plans
    .filter((plan) => plan.id !== workspace.plan.id);

  return (
    <nav className="session-tree" aria-label="Plan sessions">
      <button className="brand-button" type="button" onClick={onHome}>
        <span className="brand-mark">SF</span>
        <span><b>StudyForge</b><small>返回学习集</small></span>
      </button>

      <div className="tree-context">
        <span>当前 Plan</span>
        <h2>{workspace.plan.title}</h2>
      </div>

      <PlanRationale value={workspace.plan.planningBasis} />

      {explorerEnabled && (
        <button className="library-entry" type="button" onClick={onExplore}>
          <span aria-hidden="true">⌕</span>
          <span><b>研习资料</b><small>查找题卡、方法与学习记录</small></span>
        </button>
      )}

      <p className="tree-label">父会话</p>
      <button
        type="button"
        className={`session-node coach-node ${selected === workspace.coach.sessionKey ? 'selected' : ''}`}
        onClick={() => onSelect(workspace.coach.sessionKey)}
      >
        <span className="node-dot" aria-hidden="true" />
        <span><b>Coach</b><small>方向、备课与复盘</small></span>
      </button>

      <p className="tree-label lesson-label">Lesson 子会话</p>
      <div className="lesson-nodes">
        {workspace.lessons.map((lesson, index) => (
          <button
            key={lesson.id}
            type="button"
            className={`session-node ${selected === lesson.sessionKey ? 'selected' : ''}`}
            onClick={() => onSelect(lesson.sessionKey)}
          >
            <span className="lesson-index">{String(index + 1).padStart(2, '0')}</span>
            <span className="lesson-node-copy">
              <b>{lesson.title.replace(/^Lesson:\s*/i, '')}</b>
              <small data-status={lesson.status}>{statusLabel[lesson.status]}</small>
            </span>
          </button>
        ))}
      </div>

      {workspace.plan.status === 'completed' && otherPlans.length > 0 && (
        <div className="plan-continuation">
          <p className="tree-label">继续其他 Plan</p>
          <div className="plan-switch-nodes">
            {otherPlans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => onPlanSelect(plan.id)}
              >
                <span>
                  <b>{plan.title}</b>
                  <small>{plan.status} · 打开 Coach</small>
                </span>
                <i aria-hidden="true">↗</i>
              </button>
            ))}
          </div>
        </div>
      )}
    </nav>
  );
}
