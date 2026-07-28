import { expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StudentNotebook } from '../../src/shared/contracts';
import { CurrentActivityStage } from '../../src/client/components/CurrentActivityStage';

const notebook = {
  lesson: {
    id: 'lesson-1',
    title: '课堂',
    path: 'lessons/lesson-1.md',
    planId: 'p1',
    status: 'active',
    sessionKey: 'tutor:lesson-1',
    tutorSessionId: 'session-1',
    blocks: [{
      id: 'active',
      title: '正在解决',
      kind: 'problem',
      required: true,
      status: 'active',
      dependsOn: [],
      uses: ['ACTIVE'],
      studentView: 'ACTIVE STUDENT VIEW',
      evidence: [],
    }, {
      id: 'pending',
      title: '稍后解决',
      kind: 'problem',
      required: true,
      status: 'pending',
      dependsOn: ['active'],
      uses: ['PENDING'],
      studentView: '',
      evidence: [],
    }],
  },
  cards: {
    ACTIVE: { path: 'cards/active.yaml', stem: 'active-card-stem', choices: [] },
    PENDING: { path: 'cards/pending.yaml', stem: 'pending-card-stem', choices: [] },
  },
  recentRecords: [],
  lessonSummary: null,
  authoring: { source: 'Teacher Control: SECRET' },
} satisfies StudentNotebook;

test('pins only the real active Block and its revealed cards', () => {
  const html = renderToStaticMarkup(
    <CurrentActivityStage notebook={notebook} paused={false} onResume={() => {}} />,
  );

  expect(html).toContain('当前课堂');
  expect(html).toContain('ACTIVE STUDENT VIEW');
  expect(html).toContain('active-card-stem');
  expect(html).not.toContain('pending-card-stem');
  expect(html).not.toContain('Teacher Control');
  expect(html).not.toContain('SECRET');
});

test('does not guess a pending Block when there is no active Block', () => {
  const value = {
    ...notebook,
    lesson: {
      ...notebook.lesson,
      blocks: notebook.lesson.blocks.map((block) => ({ ...block, status: 'pending' as const })),
    },
  };
  const html = renderToStaticMarkup(
    <CurrentActivityStage notebook={value} paused={false} onResume={() => {}} />,
  );

  expect(html).toContain('等待课堂导师推进');
  expect(html).not.toContain('pending-card-stem');
});
