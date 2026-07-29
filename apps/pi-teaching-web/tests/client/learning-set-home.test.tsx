import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  HomeSnapshot,
  LearningSetSnapshot,
  PlanSummary,
} from '../../src/shared/contracts';
import { LearningSetHome } from '../../src/client/components/LearningSetHome';

const plan: PlanSummary = {
  id: 'p1',
  title: '现有周期',
  path: 'plans/p1.md',
  status: 'active',
  goal: '目标',
  capabilityStandard: '标准',
  planningBasis: '依据',
  currentPosition: '当前位置',
  nextLessonCandidate: '下一步',
  planSummary: '摘要',
  learningReview: null,
};

function learningSet(
  learningPrinciples: string,
  plans: LearningSetSnapshot['plans'] = [],
): LearningSetSnapshot {
  return {
    title: '测试学习集',
    overview: '学习集概述',
    learningPrinciples,
    goal: '学习目标',
    plans,
  };
}

function home(overrides: Partial<HomeSnapshot> = {}): HomeSnapshot {
  return {
    learningSet: learningSet('PUBLIC LEARNING PRINCIPLE', [plan]),
    currentPlan: plan,
    eligibleContinueRoutes: ['/plan/p1'],
    continueTarget: {
      route: '/plan/p1',
      kind: 'coach',
      planId: 'p1',
      lessonId: null,
      title: '继续当前周期',
      detail: '从上次的位置继续。',
    },
    lessonProgress: { completed: 1, total: 3 },
    studentPlan: {
      currentPosition: '当前位置',
      progress: {
        closedLessons: 1,
        registeredLessons: 3,
        state: 'prepared',
      },
      nextLesson: {
        lessonId: 'lesson-2',
        status: 'prepared',
        publicTitle: '下一节课堂',
        publicPurpose: '练习公开的路线比较能力。',
        blockCount: 4,
        blockKinds: ['dialogue', 'problem', 'reflection'],
        sourceNumbers: ['source-17', 'source-32'],
      },
      learningReview: null,
    },
    signals: [],
    recentReplay: null,
    ...overrides,
  };
}

function render(value: HomeSnapshot = home()): string {
  return renderToStaticMarkup(
    <LearningSetHome
      value={value}
      continuePath={value.continueTarget.route}
      onContinue={() => {}}
      onOpen={() => {}}
      onRoadmapOpen={() => {}}
    />,
  );
}

test('renders one dominant continuation with the safe Plan projection', () => {
  const html = render();
  expect(html.match(/class="continue-entry"/g)).toHaveLength(1);
  expect(html).toContain('当前位置');
  expect(html).toContain('练习公开的路线比较能力');
  expect(html).toContain('4 个课堂环节');
  expect(html).toContain('source-17');
  expect(html).toContain('1/3');
  expect(html).toContain('学习总览');
  expect(html).not.toContain('ability-nodes');
  expect(html).not.toContain('task-rail');
});

test('renders optional signals and Replay only when present', () => {
  const absent = render();
  expect(absent).not.toContain('最近变化');
  expect(absent).not.toContain('最近课堂回放');

  const present = render(home({
    signals: [{
      label: '最近记录',
      value: '独立完成',
      source: 'lessons/l1.md#trace-event-1',
    }],
    recentReplay: { lessonId: 'l0', title: '上一课', route: '/plan/p1/lesson/l0' },
  }));
  expect(present).toContain('独立完成');
  expect(present).toContain('上一课');
});

test('keeps overview and public principles as secondary reading', () => {
  const html = render();
  expect(html).toContain('学习集概述');
  expect(html).toContain('研习要领');
  expect(html).toContain('PUBLIC LEARNING PRINCIPLE');

  const withoutPrinciples = render(home({
    learningSet: learningSet('', [plan]),
  }));
  expect(withoutPrinciples).not.toContain('研习要领');
});

test('uses the Roadmap as the primary continuation before the first Plan', () => {
  const value = home({
    learningSet: learningSet(''),
    currentPlan: null,
    eligibleContinueRoutes: [],
    continueTarget: {
      route: '/roadmap',
      kind: 'roadmap',
      planId: null,
      lessonId: null,
      title: '建立第一个学习周期',
      detail: '先讨论目标。',
    },
    lessonProgress: { completed: 0, total: 0 },
    studentPlan: null,
  });
  const html = render(value);

  expect(html).toContain('建立第一个学习周期');
  expect(html.match(/class="continue-entry"/g)).toHaveLength(1);
  expect(html).not.toContain('当前阶段');
});

test('does not render raw future-facing Plan fields from the Home contract', () => {
  const unsafe = {
    ...home(),
    currentPlan: {
      ...plan,
      currentPosition: 'RAW_POSITION_SHOULD_NOT_RENDER',
      nextLessonCandidate: 'LEAK_NEXT_HOME_COMPONENT',
      planSummary: 'LEAK_SUMMARY_HOME_COMPONENT',
    },
  } as unknown as HomeSnapshot;
  const html = render(unsafe);

  expect(html).toContain('当前位置');
  expect(html).not.toContain('RAW_POSITION_SHOULD_NOT_RENDER');
  expect(html).not.toContain('LEAK_NEXT_HOME_COMPONENT');
  expect(html).not.toContain('LEAK_SUMMARY_HOME_COMPONENT');
});
