import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  CoachContextView,
  LessonNode,
  LessonReplay,
  StudentNotebook,
} from '../../src/shared/contracts';
import { ContextStack } from '../../src/client/components/ContextStack';

const context: CoachContextView = {
  currentPosition: '当前位置',
  nextLessonCandidate: '下一课',
  planSummary: '阶段摘要',
  plannerAttention: '备课提醒',
  priorLessons: [{
    lessonId: 'lesson-1',
    title: '前课',
    summary: '前课摘要',
    source: 'lessons/lesson-1.md#lesson-summary',
  }],
};
const lesson: LessonNode = {
  id: 'lesson-1',
  title: '课堂',
  path: 'lessons/lesson-1.md',
  planId: 'p1',
  status: 'active',
  sessionKey: 'tutor:lesson-1',
  tutorSessionId: 'session-1',
  blocks: [],
};
const notebook: StudentNotebook = {
  lesson: { ...lesson, blocks: [] },
  cards: {},
  recentRecords: [],
  lessonSummary: null,
};
const replay: LessonReplay = {
  mode: 'full',
  items: [],
  route: { initial: [], effective: [] },
};

function html(view: 'coach' | 'tutor' | 'replay') {
  return renderToStaticMarkup(
    <ContextStack
      view={view}
      coachContext={view === 'coach' ? context : null}
      lesson={view === 'coach' ? null : lesson}
      notebook={view === 'coach' ? null : notebook}
      replay={view === 'replay' ? replay : null}
      abilities={{ nodes: [] }}
      workflows={[]}
      onEvidence={() => {}}
      onWorkflowAction={async () => {}}
    />,
  );
}

test('composes distinct ordered context sections for Coach, Tutor, and Replay', () => {
  const coach = html('coach');
  expect(coach).toContain('本阶段');
  expect(coach).toContain('备课提醒');
  expect(coach).toContain('前课摘录');
  expect(coach).not.toContain('课堂脉络');

  const tutor = html('tutor');
  expect(tutor).toContain('课堂脉络');
  expect(tutor).toContain('方法进展');
  expect(tutor).toContain('近期学习记录');
  expect(tutor).not.toContain('备课提醒');

  const replayHtml = html('replay');
  expect(replayHtml).toContain('回放定位');
  expect(replayHtml).toContain('原定路线与实际路线');
  expect(replayHtml).toContain('学习记录来源');
  expect(replayHtml).not.toContain('前课摘录');

  for (const value of [coach, tutor, replayHtml]) {
    expect(value.match(/open=""/g)?.length).toBe(1);
  }
});
