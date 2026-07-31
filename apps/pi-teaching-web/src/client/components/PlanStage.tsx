import type { ReactNode } from 'react';
import type { CourseViewProjection } from '../../shared/view-contracts';

export function PlanStage({
  value,
  coachPanel,
}: {
  value: CourseViewProjection;
  coachPanel: ReactNode;
}) {
  const plan = value.selectedPlan;
  return (
    <section className="plan-stage" aria-label="当前学习阶段">
      {plan ? (
        <header>
          <small>当前 Plan</small>
          <h2>{plan.title}</h2>
          <p>{plan.goal}</p>
          <dl>
            <div>
              <dt>可观测能力标准</dt>
              <dd>{plan.capabilityStandard}</dd>
            </div>
            <div>
              <dt>当前位置</dt>
              <dd>{plan.currentPosition}</dd>
            </div>
            <div>
              <dt>课程进度</dt>
              <dd>{plan.closedLessons} / {plan.registeredLessons} 节已完成</dd>
            </div>
          </dl>
        </header>
      ) : (
        <header>
          <small>学习总览</small>
          <h2>{value.learningSet.title}</h2>
          <p>{value.learningSet.goal}</p>
        </header>
      )}
      <div className="coach-surface">{coachPanel}</div>
    </section>
  );
}

export default PlanStage;
