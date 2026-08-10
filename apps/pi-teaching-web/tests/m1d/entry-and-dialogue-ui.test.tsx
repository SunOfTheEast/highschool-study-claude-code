import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type {
  ConversationItem,
  LearningAssetLibrarySnapshot,
  LearningSetHomeSnapshot,
} from '../../src/shared/contracts';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import { AssetsPage } from '../../src/client/pages/AssetsPage';
import { FreeLearningPage } from '../../src/client/pages/FreeLearningPage';
import { HomePage } from '../../src/client/pages/HomePage';
import { MetaPage } from '../../src/client/pages/MetaPage';

const baseHome: LearningSetHomeSnapshot = {
  guide: { title: '化学学习集', introduction: '从真实问题开始。', principles: '' },
  hasCourse: false,
  course: null,
  assets: { notes: 1, problemCards: 1, materials: 0 },
  recentFreeLearning: [],
  recentMeta: [],
};

test('renders only the projected student guide on Home', () => {
  const value = {
    ...baseHome,
    guide: {
      title: '化学学习集',
      introduction: '从一个真实问题开始。',
      principles: '- 先说清楚自己卡在哪里。',
    },
  } satisfies LearningSetHomeSnapshot;

  const markup = renderToStaticMarkup(
    <HomePage value={value} onNavigate={() => {}} onStartFree={() => {}} />,
  );

  expect(markup).toContain('从一个真实问题开始。');
  expect(markup).toContain('这个学习集怎么学');
  expect(markup).toContain('先说清楚自己卡在哪里。');
  expect(markup).not.toContain('教师诊断');
});

test('chooses exactly one strongest home action from the real active Lesson', () => {
  const active = renderToStaticMarkup(
    <HomePage
      value={{
        ...baseHome,
        hasCourse: true,
        course: {
          title: '化学反应原理',
          route: '/course',
          activeLesson: {
            id: 'lesson-002',
            title: 'Ksp 的表达边界',
            planId: 'plan-001',
            planTitle: '化学平衡',
            route: '/course/plan/plan-001/lesson/lesson-002',
          },
        },
      }}
      onNavigate={() => {}}
      onStartFree={() => {}}
    />,
  );
  expect(active.match(/class="home-primary/g)).toHaveLength(1);
  expect(active).toContain('href="/course/plan/plan-001/lesson/lesson-002"');
  expect(active).toContain('>继</');
  expect(active).toContain('继续上课');
  expect(active).toContain('安静地问老师');

  const blank = renderToStaticMarkup(
    <HomePage value={baseHome} onNavigate={() => {}} onStartFree={() => {}} />,
  );
  expect(blank.match(/class="home-primary/g)).toHaveLength(1);
  expect(blank).toContain('>问</');
  expect(blank).toContain('规划长期学习');
});

test('renders the student guide projection through the shared Markdown and math path', () => {
  const markup = renderToStaticMarkup(
    <HomePage
      value={{
        ...baseHome,
        guide: {
          title: '化学学习集',
          introduction: '从真实问题开始。',
          principles: '- 先说明自己卡在哪里。\n\n$K_{sp}$',
        },
      }}
      onNavigate={() => {}}
      onStartFree={() => {}}
    />,
  );

  expect(markup).toContain('<h2>这个学习集怎么学</h2>');
  expect(markup).toContain('<li>先说明自己卡在哪里。</li>');
  expect(markup).toContain('class="katex"');
  expect(markup).not.toContain('Internal Teaching Notes');
});

test('renders free learning as a titled letter with immutable carried context', () => {
  const markup = renderToStaticMarkup(
    <FreeLearningPage
      sessionKey="free:free-session-001"
      title="Ksp 为什么只写离子浓度？"
      contexts={[
        { key: 'note:note-001', kind: '笔记', title: 'Ksp 边界', detail: '第 2 版' },
        { key: 'problem:problem-001', kind: '题卡', title: '同离子效应', detail: '已有作答' },
      ]}
      connected
      status="active"
      items={[]}
      running={false}
      error={null}
      onSend={async () => {}}
      onEnd={async () => {}}
    />,
  );
  expect(markup).toContain('Ksp 为什么只写离子浓度？');
  expect(markup).toContain('随身带入');
  expect(markup).toContain('Ksp 边界 · 第 2 版');
  expect(markup).toContain('同离子效应 · 已有作答');
  expect(markup).toContain('结束这次自由学习');
});

test('keeps an ended letter readable and closes only its composer', () => {
  const markup = renderToStaticMarkup(
    <FreeLearningPage
      sessionKey="free:free-session-001"
      title="已经结束的讨论"
      contexts={[]}
      connected
      status="ended"
      items={[{
        id: 'assistant-1', kind: 'assistant', text: '这段讨论仍然可以回看。',
        at: '2026-08-09T10:00:00.000Z',
      }]}
      running={false}
      error={null}
      onSend={async () => {}}
      onEnd={async () => {}}
    />,
  );
  expect(markup).toContain('这段讨论仍然可以回看。');
  expect(markup).toContain('这个线程已经结束');
  expect(markup).toContain('<textarea');
  expect(markup).toContain('disabled=""');
});

test('keeps drafts editable while reconnecting and never shows generic tool JSON', () => {
  const items: ConversationItem[] = [{
    id: 'read-1',
    kind: 'tool',
    name: 'read',
    status: 'done',
    detail: { path: 'memory/objects/private.md', raw: 'internal' },
    at: '2026-08-09T10:00:00.000Z',
  }];
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="free:free-session-001"
      items={items}
      running={false}
      error={null}
      enabled
      connected={false}
      onSend={async () => {}}
    />,
  );
  expect(markup).toContain('老师查看了相关内容');
  expect(markup).not.toContain('private.md');
  expect(markup).not.toContain('internal');
  expect(markup).not.toContain('<pre>');
  expect(markup).toMatch(/<textarea(?![^>]*disabled)/);
  expect(markup).toMatch(/<button type="submit" disabled/);
});

test('hides transient tool failures and internal Session identifiers from students', () => {
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="plan:plan-001"
      items={[{
        id: 'read-missing-plan',
        kind: 'tool',
        name: 'read',
        status: 'error',
        detail: { error: 'ENOENT', path: 'plans/plan-001/PLAN.md' },
        at: '2026-08-10T00:00:00.000Z',
      }]}
      running
      error="ResolveMessage: meta:019fe747-private"
      enabled
      onSend={async () => {}}
    />,
  );

  expect(markup).toContain('老师正在准备这一阶段的课堂');
  expect(markup).not.toContain('这一步没有完成');
  expect(markup).not.toContain('plan:plan-001');
  expect(markup).not.toContain('ResolveMessage');
  expect(markup).not.toContain('019fe747');
  expect(markup).not.toContain('ENOENT');
});

test('keeps Meta at Roadmap scope and exposes the course handoff only after creation', () => {
  const markup = renderToStaticMarkup(
    <MetaPage
      sessionKey="meta:meta-session-001"
      items={[]}
      running={false}
      error={null}
      hasCourse
      connected
      onSend={async () => {}}
      onEnterCourse={() => {}}
    />,
  );
  expect(markup).toContain('进入正式课程');
  expect(markup).not.toContain('进入 Roadmap');
  expect(markup).toContain('disabled=""');
});

test('shows relation navigation and an honest selected count on the asset shelf', () => {
  const assets: LearningAssetLibrarySnapshot = {
    notes: [{
      kind: 'note', id: 'note-001', title: 'Ksp 边界', revision: 1,
      updatedAt: '2026-08-09T10:00:00.000Z', tags: null, sources: [],
    }],
    problemCards: [],
  };
  const markup = renderToStaticMarkup(
    <AssetsPage
      value={assets}
      onOpen={() => {}}
      onAsk={() => {}}
      onOpenKnowledge={() => {}}
    />,
  );
  expect(markup).toContain('知识图谱');
  expect(markup).toContain('带着所选问老师 · 0');
  expect(markup).toContain('data-selected="false"');
});
