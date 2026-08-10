import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  LearningAssetLibrarySnapshot,
  LearningNote,
  LearningSetHomeSnapshot,
  ProblemActivitySnapshot,
  StudentProblemCard,
} from '../../src/shared/contracts';
import { HomePage } from '../../src/client/pages/HomePage';
import { FreeLearningPage } from '../../src/client/pages/FreeLearningPage';
import { AssetsPage } from '../../src/client/pages/AssetsPage';
import { NotePage } from '../../src/client/pages/NotePage';
import { ProblemCardPage } from '../../src/client/pages/ProblemCardPage';
import { formatBrowserRoute, parseBrowserRoute } from '../../src/client/routes';

const blankHome: LearningSetHomeSnapshot = {
  guide: { title: '空白学习集', introduction: '从真实问题开始。', principles: '' },
  hasCourse: false,
  course: null,
  assets: { notes: 0, problemCards: 0, materials: 0 },
  recentFreeLearning: [],
  recentMeta: [],
};

test('round-trips every M1b browser route', () => {
  const routes = [
    { kind: 'home' as const },
    { kind: 'assets' as const },
    { kind: 'free-learning' as const, sessionId: 'free-session-001' },
    { kind: 'note' as const, id: 'note-001' },
    { kind: 'problem-card' as const, id: 'problem-001' },
  ];
  for (const route of routes) {
    expect(parseBrowserRoute(formatBrowserRoute(route))).toEqual(route);
  }
});

test('renders the blank home as three honest entry points without a fake course', () => {
  const markup = renderToStaticMarkup(
    <HomePage value={blankHome} onNavigate={() => {}} onStartFree={() => {}} />,
  );

  expect(markup).toContain('问老师');
  expect(markup).toContain('我的学习资料');
  expect(markup).toContain('最近的自由学习');
  expect(markup).toContain('还没有自由学习记录');
  expect(markup).not.toContain('进入正式课程');
  expect(markup).not.toContain('Roadmap');
});

test('adds a course destination only when a Roadmap really exists', () => {
  const markup = renderToStaticMarkup(
    <HomePage
      value={{
        ...blankHome,
        hasCourse: true,
        course: {
          title: '导数结构学习路线',
          route: '/course',
          activeLesson: null,
        },
      }}
      onNavigate={() => {}}
      onStartFree={() => {}}
    />,
  );

  expect(markup).toContain('进入正式课程');
  expect(markup).toContain('导数结构学习路线');
});

test('renders free learning as an open conversation with one explicit end action', () => {
  const markup = renderToStaticMarkup(
    <FreeLearningPage
      sessionKey="free:free-session-001"
      status="active"
      items={[]}
      running={false}
      error={null}
      onSend={async () => {}}
      onEnd={async () => {}}
    />,
  );

  expect(markup).toContain('自由学习');
  expect(markup).toContain('结束这次自由学习');
  expect(markup).toContain('<textarea');
  expect(markup).not.toContain('Block');
  expect(markup).not.toContain('结课总结');
});

test('renders one asset library with Notes and problem cards but no graph controls', () => {
  const value: LearningAssetLibrarySnapshot = {
    notes: [{
      kind: 'note', id: 'note-001', title: 'Ksp 边界', revision: 1,
      updatedAt: '2026-08-08T10:00:00.000Z',
      tags: { core: ['沉淀溶解平衡'], related: [] }, sources: [],
    }],
    problemCards: [{
      kind: 'problem-card', id: 'problem-001', title: '加入同离子', revision: 1,
      updatedAt: '2026-08-08T10:00:00.000Z',
      tags: { core: ['同离子效应'], related: [] }, sources: [],
    }],
  };
  const markup = renderToStaticMarkup(
    <AssetsPage value={value} onOpen={() => {}} onAsk={() => {}} />,
  );

  expect(markup).toContain('Ksp 边界');
  expect(markup).toContain('加入同离子');
  expect(markup).toContain('带着所选问老师 · 0');
  expect(markup).toContain('知识关系');
  expect(markup).not.toContain('方法图谱');
});

test('renders Markdown and recall blocks as one editable Note', () => {
  const note: LearningNote = {
    kind: 'note', id: 'note-001', path: 'notes/note-001.note.yaml', revision: 1,
    title: 'Ksp 边界', createdAt: '2026-08-08T10:00:00.000Z',
    updatedAt: '2026-08-08T10:00:00.000Z', createdSessionId: 'free-session-001',
    sources: [],
    blocks: [
      { kind: 'markdown', body: '纯固体活度并入常数。' },
      { kind: 'recall', prompt: '固体为什么不写？', answer: '活度视为常数。' },
    ],
  };
  const markup = renderToStaticMarkup(<NotePage value={note} onSave={async () => {}} />);

  expect(markup).toContain('纯固体活度并入常数');
  expect(markup).toContain('固体为什么不写？');
  expect(markup).toContain('显示答案');
  expect(markup).not.toContain('活度视为常数。');
  expect(markup).toContain('编辑笔记');
});

test('keeps a problem answer gated and never renders teacher rationale', () => {
  const activity: ProblemActivitySnapshot = {
    cardId: 'problem-001', events: [], latestAttempt: null,
    answerRevealedForLatestAttempt: false,
  };
  const value: StudentProblemCard & { activity: ProblemActivitySnapshot } = {
    kind: 'problem-card', id: 'problem-001', revision: 1, title: '同离子效应',
    stem: '加入 NaCl 后 Ksp 是否改变？', studentNote: '区分 Ksp 与离子积。',
    standardAnswer: null, sources: [], activity,
  };
  const markup = renderToStaticMarkup(
    <ProblemCardPage
      value={value}
      onAttempt={async () => {}}
      onReveal={async () => {}}
      onSaveNote={async () => {}}
      onAskTeacher={async () => {}}
    />,
  );

  expect(markup).toContain('加入 NaCl 后 Ksp 是否改变？');
  expect(markup).toContain('提交作答');
  expect(markup).toContain('不会，直接看答案');
  expect(markup).not.toContain('标准答案');
  expect(markup).not.toContain('teacherRationale');
  expect(markup).not.toContain('教师依据');
});

test('renders Markdown emphasis in asset and problem-card titles', () => {
  const assets: LearningAssetLibrarySnapshot = {
    notes: [],
    problemCards: [{
      kind: 'problem-card', id: 'problem-001', title: '**参数主元**', revision: 1,
      updatedAt: '2026-08-10T00:00:00.000Z', tags: null, sources: [],
    }],
  };
  const shelf = renderToStaticMarkup(
    <AssetsPage value={assets} onOpen={() => {}} onAsk={() => {}} />,
  );
  const card = renderToStaticMarkup(
    <ProblemCardPage
      value={{
        kind: 'problem-card', id: 'problem-001', revision: 1, title: '**参数主元**',
        stem: '题干', studentNote: '', standardAnswer: null, sources: [],
        activity: {
          cardId: 'problem-001', events: [], latestAttempt: null,
          answerRevealedForLatestAttempt: false,
        },
      }}
      onAttempt={async () => {}}
      onReveal={async () => {}}
      onSaveNote={async () => {}}
      onAskTeacher={async () => {}}
    />,
  );

  expect(shelf).toContain('<strong>参数主元</strong>');
  expect(card).toContain('<h1><strong>参数主元</strong></h1>');
  expect(`${shelf}${card}`).not.toContain('**参数主元**');
});
