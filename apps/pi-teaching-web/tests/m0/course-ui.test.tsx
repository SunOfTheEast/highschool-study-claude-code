import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  ConversationItem,
  LessonHandoutConversationItem,
  LessonReviewConversationItem,
  MaterialSearchConversationItem,
} from '../../src/shared/contracts';
import { readWorkspace } from '../../src/study/workspace';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import { CoursePage } from '../../src/client/pages/CoursePage';
import { initialClientState, reduceClientState } from '../../src/client/state';
import { PrimaryViewNav } from '../../src/client/components/PrimaryViewNav';
import { LessonHandoutPage } from '../../src/client/pages/LessonHandoutPage';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');

const items: ConversationItem[] = [
  {
    id: 'student-1',
    kind: 'user',
    text: '我觉得恒成立问题比较棘手。',
    at: '2026-08-02T10:00:00.000Z',
  },
  {
    id: 'assistant-1',
    kind: 'assistant',
    text: '具体是哪一种结构让你最犹豫？',
    at: '2026-08-02T10:00:01.000Z',
  },
  {
    id: 'read-1',
    kind: 'tool',
    name: 'read',
    status: 'done',
    detail: { path: 'plans/plan-001/lessons/lesson-001.md' },
    at: '2026-08-02T10:00:02.000Z',
  },
];

test('renders the raw teacher reply once and summarizes native tools without raw detail', () => {
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="lesson:plan-001:lesson-001"
      items={items}
      running={false}
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );

  expect(markup.match(/具体是哪一种结构让你最犹豫？/g)).toHaveLength(1);
  expect(markup).toContain('我觉得恒成立问题比较棘手。');
  expect(markup).toContain('老师查看了相关内容');
  expect(markup).not.toContain('<pre>');
  expect(markup).not.toContain('plans/plan-001/lessons/lesson-001.md');
});

test('shows safe live material progress instead of the generic thinking indicator', () => {
  const search: MaterialSearchConversationItem = {
    id: 'scout-1',
    kind: 'material-search',
    status: 'running',
    phase: 'inspecting',
    completed: 1,
    total: 2,
    toolCount: 23,
    elapsedMs: 72_000,
    at: '2026-08-05T10:00:00.000Z',
    updatedAt: '2026-08-05T10:01:12.000Z',
  };
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="plan:plan-001"
      items={[search]}
      running
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );

  expect(markup).toContain('正在查看候选材料');
  expect(markup).toContain('1 / 2 个检索任务已返回');
  expect(markup).toContain('1分12秒');
  expect(markup).toContain('23 次操作');
  expect(markup).not.toContain('老师正在思考');
  expect(markup).not.toContain('<details');
  expect(markup).not.toContain('tokens');
});

test('shows a dedicated safe Lesson review status without duplicate thinking', () => {
  const statuses: Array<{
    item: LessonReviewConversationItem;
    label: string;
  }> = [
    {
      item: {
        id: 'review-running',
        kind: 'lesson-review',
        status: 'running',
        elapsedMs: 42_000,
        at: '2026-08-06T10:00:00.000Z',
        updatedAt: '2026-08-06T10:00:42.000Z',
      },
      label: '正在核验题目',
    },
    {
      item: {
        id: 'review-done',
        kind: 'lesson-review',
        status: 'done',
        elapsedMs: 42_000,
        at: '2026-08-06T10:00:00.000Z',
        updatedAt: '2026-08-06T10:00:42.000Z',
      },
      label: '题目核验完成',
    },
    {
      item: {
        id: 'review-error',
        kind: 'lesson-review',
        status: 'error',
        elapsedMs: 42_000,
        at: '2026-08-06T10:00:00.000Z',
        updatedAt: '2026-08-06T10:00:42.000Z',
      },
      label: '题目核验失败',
    },
  ];

  for (const { item, label } of statuses) {
    const markup = renderToStaticMarkup(
      <ChatPanel
        sessionKey="plan:plan-001"
        items={[item]}
        running={item.status === 'running'}
        error={null}
        enabled
        onSend={async () => {}}
      />,
    );
    expect(markup).toContain(label);
    expect(markup).toContain('42秒');
    expect(markup).not.toContain('老师正在思考');
    expect(markup).not.toContain('<details');
    expect(markup).not.toContain('private-reviewer');
  }
});

test('renders printable handout publication as a dedicated safe card', () => {
  const items: LessonHandoutConversationItem[] = [
    {
      id: 'handout-running',
      kind: 'lesson-handout',
      status: 'running',
      title: null,
      url: null,
      at: '2026-08-06T11:00:00.000Z',
    },
    {
      id: 'handout-done',
      kind: 'lesson-handout',
      status: 'done',
      title: '参数选路练习讲义',
      url: '/course/plan/plan-001/lesson/lesson-001/handout/block-002,block-001',
      at: '2026-08-06T11:00:01.000Z',
    },
    {
      id: 'handout-error',
      kind: 'lesson-handout',
      status: 'error',
      title: null,
      url: null,
      at: '2026-08-06T11:00:02.000Z',
    },
  ];
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="plan:plan-001"
      items={items}
      running={false}
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );

  expect(markup).toContain('正在整理讲义');
  expect(markup).toContain('参数选路练习讲义');
  expect(markup).toContain('查看并打印讲义');
  expect(markup).toContain(items[1]!.url!);
  expect(markup).toContain('讲义暂时没有生成，课程仍可开始');
  expect(markup).not.toContain('<details');
  expect(markup).not.toContain('blockIds');
  expect(markup).not.toContain('Teacher Control');
});

test('never renders raw generic subagent details', () => {
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="plan:plan-001"
      items={[{
        id: 'subagent-list-1',
        kind: 'tool',
        name: 'subagent',
        status: 'done',
        detail: {
          task: '绝对值 + 三次函数',
          path: 'cards/private.card.yaml',
          output: 'candidate output',
        },
        at: '2026-08-05T10:00:00.000Z',
      }]}
      running={false}
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );

  expect(markup).toContain('后台任务');
  expect(markup).not.toContain('<details');
  expect(markup).not.toContain('绝对值 + 三次函数');
  expect(markup).not.toContain('cards/private.card.yaml');
  expect(markup).not.toContain('candidate output');
});

test('makes dialogue the central workspace and hides Teacher Control from class view', () => {
  const value = readWorkspace(fixture, 'plans/plan-001/lessons/lesson-001.md');
  const markup = renderToStaticMarkup(
    <CoursePage
      value={value}
      items={items}
      running={false}
      error={null}
      leftOpen
      rightOpen
      onNodeSelect={() => {}}
      onSend={async () => {}}
      onLifecycle={async () => {}}
      onToggleLeft={() => {}}
      onToggleRight={() => {}}
    />,
  );

  expect(markup).toContain('class="course-workspace"');
  expect(markup).toContain('data-node-kind="lesson"');
  expect(markup).toContain('class="workspace-breadcrumbs"');
  expect(markup).toContain('href="/course"');
  expect(markup).toContain('href="/course/plan/plan-001"');
  expect(markup).toContain('class="progress-line"');
  expect(markup).toContain('必做进度');
  expect(markup).toContain('aria-label="课程组织"');
  expect(markup).toContain('aria-label="课堂对话"');
  expect(markup).toContain('aria-label="课堂节点"');
  expect(markup).toContain('lesson:plan-001:lesson-001');
  expect(markup).toContain('先观察这道题的参数位置');
  expect(markup).toContain('katex-display');
  expect(markup).not.toContain('先听选路理由');
  expect(markup).not.toContain('Teacher Control');
  expect(markup).toContain('结束本课');

  const css = readFileSync(join(import.meta.dir, '../../src/client/styles/course.css'), 'utf8');
  expect(css).toContain('264px minmax(0, 1fr) 308px');
  expect(css).toContain('.workspace-breadcrumbs');
  expect(css).toContain('background: var(--paper-mid)');
});

test('keeps a closed Lesson transcript visible in an explicit read-only state', () => {
  const value = readWorkspace(fixture, 'plans/plan-001/lessons/lesson-001.md');
  const plan = value.tree.children[0]!;
  const lesson = plan.children[0]!;
  const closed = {
    ...value,
    selected: value.selected?.kind === 'lesson'
      ? { ...value.selected, status: 'closed' as const }
      : value.selected,
    tree: {
      ...value.tree,
      children: [{
        ...plan,
        children: [{ ...lesson, status: 'closed' as const }],
      }],
    },
  };
  const markup = renderToStaticMarkup(
    <CoursePage
      value={closed}
      items={items}
      running={false}
      error={null}
      leftOpen
      rightOpen
      onNodeSelect={() => {}}
      onSend={async () => {}}
      onLifecycle={async () => {}}
      onToggleLeft={() => {}}
      onToggleRight={() => {}}
    />,
  );

  expect(markup).toContain('已结束 · 只读');
  expect(markup).toContain('具体是哪一种结构让你最犹豫？');
  expect(markup).toContain('<textarea');
  expect(markup).toContain('disabled=""');
});

test('reconciles streaming text, final messages and tool status by id', () => {
  let state = initialClientState;
  state = reduceClientState(state, {
    type: 'assistant-delta',
    sessionKey: 'plan:plan-001',
    messageId: 'assistant-live',
    delta: '先说说',
  });
  state = reduceClientState(state, {
    type: 'assistant-delta',
    sessionKey: 'plan:plan-001',
    messageId: 'assistant-live',
    delta: '具体题型。',
  });
  state = reduceClientState(state, {
    type: 'conversation-item',
    sessionKey: 'plan:plan-001',
    item: {
      id: 'tool-1',
      kind: 'tool',
      name: 'read',
      status: 'running',
      detail: {},
      at: 'now',
    },
  });
  state = reduceClientState(state, {
    type: 'conversation-item',
    sessionKey: 'plan:plan-001',
    item: {
      id: 'tool-1',
      kind: 'tool',
      name: 'read',
      status: 'done',
      detail: { path: 'plans/plan-001/PLAN.md' },
      at: 'now',
    },
  });

  expect(state.conversations['plan:plan-001']).toEqual([
    {
      id: 'assistant-live',
      kind: 'assistant',
      text: '先说说具体题型。',
      at: '',
    },
    {
      id: 'tool-1',
      kind: 'tool',
      name: 'read',
      status: 'done',
      detail: { path: 'plans/plan-001/PLAN.md' },
      at: 'now',
    },
  ]);
});

test('offers Home and Assets with Course as an optional primary destination', () => {
  const markup = renderToStaticMarkup(
    <PrimaryViewNav
      active="home"
      hrefs={{ home: '/home', assets: '/assets', course: '/course' }}
      hasCourse={false}
      onNavigate={() => {}}
    />,
  );
  expect(markup).toContain('学习首页');
  expect(markup).toContain('学习资料');
  expect(markup).not.toContain('课程脉络');
  expect(markup).not.toContain('知识山河');
});

test('renders a standalone public A4 Lesson handout without application chrome', () => {
  const markup = renderToStaticMarkup(
    <LessonHandoutPage
      value={{
        kind: 'lesson-handout',
        planId: 'plan-001',
        lessonId: 'lesson-001',
        title: '参数选路练习讲义',
        lessonGoal: '判断 $f(x)$ 中参数应从哪里切入。',
        blocks: [
          {
            id: 'block-002',
            title: '独立练习',
            kind: 'problem',
            studentView: '完成 $f(x)=x^2+a$ 的选路说明。\n\n\\[x^2+a=0\\]',
          },
          {
            id: 'block-001',
            title: '方法复述',
            kind: 'reflection',
            studentView: '用一句话说明判断依据。',
          },
        ],
      }}
      error={null}
      onPrint={() => {}}
    />,
  );

  expect(markup).toContain('class="lesson-handout-page"');
  expect(markup).toContain('class="handout-paper"');
  expect(markup).toContain('StudyForge · Lesson Handout');
  expect(markup).toContain('参数选路练习讲义');
  expect(markup).toContain('判断');
  expect(markup).toContain('姓名');
  expect(markup).toContain('日期');
  expect(markup.indexOf('独立练习')).toBeLessThan(markup.indexOf('方法复述'));
  expect(markup).toContain('katex');
  expect(markup).toContain('katex-display');
  expect(markup).toContain('打印 / 另存为 PDF');
  expect(markup).not.toContain('课程组织');
  expect(markup).not.toContain('课堂对话');
  expect(markup).not.toContain('Teacher Control');
  expect(markup).not.toContain('AppShell');
});

test('shows a source-invalid handout state without substituting content', () => {
  const markup = renderToStaticMarkup(
    <LessonHandoutPage
      value={null}
      error="来源已经失效"
      onPrint={() => {}}
    />,
  );
  expect(markup).toContain('讲义来源暂时无法读取');
  expect(markup).toContain('来源已经失效');
  expect(markup).not.toContain('打印 / 另存为 PDF');
});

test('keeps handout loading distinct from a missing source', () => {
  const markup = renderToStaticMarkup(
    <LessonHandoutPage
      value={null}
      error={null}
      loading
      onPrint={() => {}}
    />,
  );
  expect(markup).toContain('正在打开讲义');
  expect(markup).not.toContain('讲义来源暂时无法读取');
});
