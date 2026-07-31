import type { ReactNode } from 'react';
import type {
  LessonNode,
  LessonReplay,
  StudentNotebook,
} from '../../shared/contracts';
import { LessonNotebook } from '../components/LessonNotebook';

export type FocusedClassroomPageProps = {
  lesson: LessonNode;
  notebook: StudentNotebook | null;
  replay: LessonReplay | null;
  stage: ReactNode;
  chatPanel: ReactNode;
  onStart(): void;
  onPause(): void;
  onReprepare(): void;
};

export function FocusedClassroomPage({
  lesson,
  notebook,
  replay,
  stage,
  chatPanel,
  onStart,
  onPause,
  onReprepare,
}: FocusedClassroomPageProps) {
  return (
    <main
      className="focused-classroom"
      aria-label="专注课堂"
      data-lesson-status={lesson.status}
    >
      <aside className="classroom-navigation" aria-label="课堂节点">
        <header>
          <small>当前 Lesson</small>
          <strong
            data-testid="session-owner"
            data-session-key={lesson.sessionKey}
          >
            {lesson.title}
          </strong>
        </header>
        {stage}
        <div className="classroom-actions">
          {(lesson.status === 'prepared' || lesson.status === 'paused') && (
            <button type="button" onClick={onStart}>
              {lesson.status === 'paused' ? '继续上课' : '开始上课'}
            </button>
          )}
          {lesson.status === 'active' && (
            <button type="button" onClick={onPause}>暂停课堂</button>
          )}
          {lesson.status === 'prepared' && (
            <button type="button" onClick={onReprepare}>重新备课</button>
          )}
        </div>
      </aside>
      <section className="classroom-dialogue" aria-label="课堂对话">
        {chatPanel}
      </section>
      <aside className="classroom-notebook" aria-label="当前课堂本">
        <LessonNotebook
          lesson={lesson}
          notebook={notebook}
          replay={replay}
          embedded
          showCards
        />
      </aside>
    </main>
  );
}

export default FocusedClassroomPage;
