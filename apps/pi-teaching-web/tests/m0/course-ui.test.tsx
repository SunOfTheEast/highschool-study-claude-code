import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import type { ConversationItem } from '../../src/shared/contracts';
import { readWorkspace } from '../../src/study/workspace';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import { CoursePage } from '../../src/client/pages/CoursePage';
import { initialClientState, reduceClientState } from '../../src/client/state';
import { PrimaryViewNav } from '../../src/client/components/PrimaryViewNav';

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
    detail: { path: 'lessons/lesson-001.md' },
    at: '2026-08-02T10:00:02.000Z',
  },
];

test('renders the raw teacher reply once and keeps native tools collapsed', () => {
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="lesson:lesson-001"
      items={items}
      running={false}
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );

  expect(markup.match(/具体是哪一种结构让你最犹豫？/g)).toHaveLength(1);
  expect(markup).toContain('我觉得恒成立问题比较棘手。');
  expect(markup).toContain('<details class="tool-activity"');
  expect(markup).not.toContain('<details class="tool-activity" open=""');
  expect(markup).toContain('lessons/lesson-001.md');
});

test('makes dialogue the central workspace and hides Teacher Control from class view', () => {
  const value = readWorkspace(fixture, 'lessons/lesson-001.md');
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
  expect(markup).toContain('aria-label="课程组织"');
  expect(markup).toContain('aria-label="课堂对话"');
  expect(markup).toContain('aria-label="课堂节点"');
  expect(markup).toContain('先观察这道题的参数位置');
  expect(markup).not.toContain('先听选路理由');
  expect(markup).not.toContain('Teacher Control');
  expect(markup).toContain('结束本课');

  const css = readFileSync(join(import.meta.dir, '../../src/client/styles/course.css'), 'utf8');
  expect(css).toContain('minmax(32rem, 1.9fr)');
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
      detail: { path: 'plans/plan-001.md' },
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
      detail: { path: 'plans/plan-001.md' },
      at: 'now',
    },
  ]);
});

test('offers only Course and Knowledge in the primary navigation', () => {
  const markup = renderToStaticMarkup(
    <PrimaryViewNav
      active="course"
      hrefs={{ course: '/course', knowledge: '/knowledge' }}
      onNavigate={() => {}}
    />,
  );
  expect(markup).toContain('课程脉络');
  expect(markup).toContain('知识山河');
  expect(markup).not.toContain('研习留痕');
});
