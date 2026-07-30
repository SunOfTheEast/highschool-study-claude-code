import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  CoachContextView,
  LearningReview,
  LessonNode,
  LessonReplay,
  StudentNotebook,
} from '../../src/shared/contracts';
import { ContextStack } from '../../src/client/components/ContextStack';

const context: CoachContextView = {
  plan: {
    currentPosition: '当前位置',
    progress: {
      closedLessons: 2,
      registeredLessons: 3,
      state: 'prepared',
    },
    nextLesson: {
      lessonId: 'lesson-2',
      status: 'prepared',
      publicTitle: '下一节课堂',
      publicPurpose: '完成一次独立能力检验',
      blockCount: 4,
      blockKinds: ['dialogue', 'problem', 'reflection'],
      sourceNumbers: ['source-17', 'source-32'],
    },
    learningReview: null,
  },
  plannerAttention: '备课提醒',
  priorLessons: [{
    lessonId: 'lesson-1',
    title: '前课',
    summary: '前课摘要',
    source: 'lessons/lesson-1.md#lesson-summary',
  }],
};
const learningReview: LearningReview = {
  conclusion: '已经形成阶段结论。',
  boundary: '只覆盖当前题型。',
  nextStep: '下一步检查迁移。',
  keyEvidence: [{
    claim: '不应在右栏重复出现的关键判断。',
    source: 'lessons/lesson-1.md#trace-event-001',
  }],
  supportingEvidence: [],
  openQuestions: [],
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
  expect(coach).toContain('当前位置');
  expect(coach).toContain('2/3');
  expect(coach).toContain('完成一次独立能力检验');
  expect(coach).toContain('4 个课堂环节');
  expect(coach).toContain('source-17');
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
  expect(replayHtml).toContain('原定路线与调整后路线');
  expect(replayHtml).toContain('初始');
  expect(replayHtml).toContain('调整后');
  expect(replayHtml).not.toContain('实际路线');
  expect(replayHtml).toContain('学习记录来源');
  expect(replayHtml).not.toContain('前课摘录');

  for (const value of [coach, tutor, replayHtml]) {
    expect(value.match(/open=""/g)?.length).toBe(1);
  }
});

test('does not repeat a completed structured review in the Coach context stack', () => {
  const completed = renderToStaticMarkup(
    <ContextStack
      view="coach"
      coachContext={{
        ...context,
        plan: {
          ...context.plan,
          currentPosition: '不应重复出现的原始位置。',
          learningReview,
        },
      }}
      lesson={null}
      notebook={null}
      replay={null}
      abilities={{ nodes: [] }}
      workflows={[]}
      onEvidence={() => {}}
      onWorkflowAction={async () => {}}
    />,
  );

  expect(completed).toContain('阶段回顾已整理，请在对话区查看。');
  expect(completed).not.toContain('不应重复出现的原始位置。');
  expect(completed).not.toContain('不应在右栏重复出现的关键判断。');
});

test('renders only safe next-Lesson fields from Coach context', () => {
  const rendered = html('coach');

  expect(rendered).toContain('下一节课堂');
  expect(rendered).toContain('讨论');
  expect(rendered).toContain('尝试');
  expect(rendered).toContain('小结');
  expect(rendered).not.toContain('LEAK_NEXT_CANDIDATE');
  expect(rendered).not.toContain('LEAK_ACTIVE_SUMMARY');
});
