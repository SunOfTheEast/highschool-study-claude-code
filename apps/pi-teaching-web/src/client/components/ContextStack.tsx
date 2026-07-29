import type {
  AbilityProjection,
  CoachContextView,
  LessonNode,
  LessonReplay,
  StudentNotebook,
  WorkflowView,
} from '../../shared/contracts';
import { AbilityMap } from './AbilityMap';
import { ContextSection } from './ContextSection';
import { LessonNotebook } from './LessonNotebook';
import { MarkdownView } from './MarkdownView';
import { ReplayTimeline } from './ReplayTimeline';
import { RouteMap } from './RouteMap';
import { TaskRail } from './TaskRail';

export function ContextStack({
  view,
  coachContext,
  lesson,
  notebook,
  replay,
  abilities,
  workflows,
  onEvidence,
  onWorkflowAction,
}: {
  view: 'coach' | 'tutor' | 'replay';
  coachContext: CoachContextView | null;
  lesson: LessonNode | null;
  notebook: StudentNotebook | null;
  replay: LessonReplay | null;
  abilities: AbilityProjection | null;
  workflows: WorkflowView[];
  onEvidence(source: string): void;
  onWorkflowAction(id: string, action: 'confirm' | 'cancel'): Promise<void>;
}) {
  if (view === 'coach') {
    return (
      <aside className="activities context-stack" aria-label="学习顾问情境">
        <header><span>学习情境</span><h2>本周期</h2></header>
        <ContextSection
          title="本阶段"
          summary={coachContext?.learningReview ? '阶段回顾已整理' : '当前位置与下一步'}
          open
        >
          {coachContext ? (
            coachContext.learningReview
              ? <p className="context-unavailable">阶段回顾已整理，请在对话区查看。</p>
              : (
                <div className="coach-context-copy">
                  <h3>当前位置</h3><MarkdownView>{coachContext.currentPosition}</MarkdownView>
                  <h3>下一课候选</h3><MarkdownView>{coachContext.nextLessonCandidate}</MarkdownView>
                  <h3>阶段摘要</h3><MarkdownView>{coachContext.planSummary}</MarkdownView>
                </div>
              )
          ) : <p className="context-unavailable">本阶段信息暂不可用。</p>}
        </ContextSection>
        <ContextSection title="备课提醒" summary="可重建的注意信号" open={false}>
          {coachContext?.plannerAttention
            ? <MarkdownView>{coachContext.plannerAttention}</MarkdownView>
            : <p className="context-unavailable">暂无备课提醒。</p>}
        </ContextSection>
        <ContextSection
          title="前课摘录"
          summary={`${coachContext?.priorLessons.length ?? 0} 节已关闭课堂`}
          open={false}
        >
          <ol className="prior-lessons">
            {coachContext?.priorLessons.map((item) => (
              <li key={item.lessonId}>
                <b>{item.title}</b>
                <MarkdownView>{item.summary}</MarkdownView>
                <code>{item.source}</code>
              </li>
            ))}
          </ol>
        </ContextSection>
        {workflows.length > 0 && (
          <ContextSection title="深入查找" summary={`${workflows.length} 个工作流`} open={false}>
            <TaskRail embedded workflows={workflows} onAction={onWorkflowAction} />
          </ContextSection>
        )}
      </aside>
    );
  }

  if (view === 'replay') {
    return (
      <aside className="activities context-stack" aria-label="课堂回放情境">
        <header><span>课堂回放</span><h2>{lesson?.title ?? '课堂记录'}</h2></header>
        <ContextSection title="回放定位" summary="结课时的课堂位置" open>
          {notebook?.lessonSummary
            ? <MarkdownView>{notebook.lessonSummary}</MarkdownView>
            : <p className="context-unavailable">没有结课摘要。</p>}
        </ContextSection>
        <ContextSection title="原定路线与实际路线" summary="节点推进变化" open={false}>
          {replay ? <RouteMap replay={replay} /> : <p className="context-unavailable">路线不可用。</p>}
        </ContextSection>
        <ContextSection title="方法进展变化" summary="当前方法投影" open={false}>
          <AbilityMap embedded value={abilities} onOpen={onEvidence} />
        </ContextSection>
        <ContextSection
          title="学习记录来源"
          summary={`${notebook?.recentRecords.length ?? 0} 条当前记录`}
          open={false}
        >
          {replay && <ReplayTimeline replay={replay} />}
        </ContextSection>
      </aside>
    );
  }

  return (
    <aside className="activities context-stack" aria-label="课堂导师情境">
      <header><span>课堂情境</span><h2>{lesson?.title ?? '当前课堂'}</h2></header>
      <ContextSection title="课堂脉络" summary="全部节点与当前停止点" open>
        <LessonNotebook
          embedded
          omitActiveBody
          showCards={false}
          lesson={lesson}
          notebook={notebook}
          replay={null}
        />
      </ContextSection>
      <ContextSection title="方法进展" summary="从当前有效记录聚合" open={false}>
        <AbilityMap embedded value={abilities} onOpen={onEvidence} />
      </ContextSection>
      <ContextSection
        title="近期学习记录"
        summary={`${notebook?.recentRecords.length ?? 0} 条`}
        open={false}
      >
        <ol className="recent-records">
          {notebook?.recentRecords.map((record) => (
            <li key={record.source}>
              <small>{record.assessment} · {record.support}</small>
              <p>{record.note}</p>
              <button type="button" onClick={() => onEvidence(record.source)}>
                {record.source}
              </button>
            </li>
          ))}
        </ol>
      </ContextSection>
      {workflows.length > 0 && (
        <ContextSection title="深入查找" summary={`${workflows.length} 个工作流`} open={false}>
          <TaskRail embedded workflows={workflows} onAction={onWorkflowAction} />
        </ContextSection>
      )}
    </aside>
  );
}
