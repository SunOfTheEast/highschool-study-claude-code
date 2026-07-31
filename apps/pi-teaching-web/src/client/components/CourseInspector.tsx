import type {
  CourseTreeNode,
  CourseViewProjection,
} from '../../shared/view-contracts';

export type LessonCourseAction =
  | 'start'
  | 'reprepare'
  | 'continue'
  | 'replay';

export function CourseInspector({
  value,
  selected,
  onLessonAction,
  onKnowledge,
  onMemory,
}: {
  value: CourseViewProjection;
  selected: CourseTreeNode;
  onLessonAction(action: LessonCourseAction): void;
  onKnowledge(): void;
  onMemory(): void;
}) {
  const lesson = selected.kind === 'lesson'
    && selected.nodeId === value.selectedLesson?.id
    ? value.selectedLesson
    : null;
  return (
    <aside className="course-inspector" aria-label="课程节点详情">
      <small>
        {selected.kind === 'roadmap'
          ? 'Roadmap'
          : selected.kind === 'plan'
            ? 'Plan'
            : 'Lesson'}
      </small>
      <h2>{selected.title}</h2>
      <p>{selected.publicPurpose}</p>
      {selected.status === 'candidate' && (
        <p>这一分支还在讨论中，尚未生成可开始的课程。</p>
      )}
      {lesson && (
        <>
          <dl>
            <div>
              <dt>课堂形态</dt>
              <dd>{lesson.blockKinds.join(' · ') || '待安排'}</dd>
            </div>
            <div>
              <dt>课堂环节</dt>
              <dd>{lesson.blockCount} 个</dd>
            </div>
          </dl>
          <div className="course-actions">
            {lesson.canStart && (
              <button type="button" onClick={() => onLessonAction('start')}>
                开始这节课
              </button>
            )}
            {lesson.canReprepare && (
              <button type="button" onClick={() => onLessonAction('reprepare')}>
                重新备课
              </button>
            )}
            {lesson.canContinue && (
              <button type="button" onClick={() => onLessonAction('continue')}>
                继续课堂
              </button>
            )}
            {lesson.canReplay && (
              <button type="button" onClick={() => onLessonAction('replay')}>
                查看课堂回放
              </button>
            )}
          </div>
        </>
      )}
      {(selected.kind === 'roadmap' || selected.kind === 'plan') && (
        <div className="coordinate-actions">
          <button type="button" onClick={onKnowledge}>查看知识山河</button>
          <button type="button" onClick={onMemory}>查看研习留痕</button>
        </div>
      )}
    </aside>
  );
}

export default CourseInspector;
