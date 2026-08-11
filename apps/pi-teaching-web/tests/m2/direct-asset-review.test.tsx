import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { renderToStaticMarkup } from 'react-dom/server';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import { planLearningNoteSave, planProblemCardSave } from '../../src/study/learning-assets';
import { readAssetReviewHistory } from '../../src/study/asset-reviews';
import { NotePage } from '../../src/client/pages/NotePage';
import { ProblemCardPage } from '../../src/client/pages/ProblemCardPage';

const blank = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-direct-review-'));
  cpSync(blank, root, { recursive: true });
  roots.push(root);
  commitDocumentCandidates(root, planLearningNoteSave(root, 'free-001', {
    title: '含回忆块的笔记',
    blocks: [{ kind: 'recall', prompt: 'Ksp 为什么不写固体？', answer: '纯固体活度并入常数。' }],
    sources: [], tags: { core: ['Ksp'], related: [] },
  }, '2026-08-11T08:00:00.000Z').candidates);
  commitDocumentCandidates(root, planLearningNoteSave(root, 'free-001', {
    title: '只有正文的笔记', blocks: [{ kind: 'markdown', body: '一段正文。' }],
    sources: [], tags: { core: ['正文'], related: [] },
  }, '2026-08-11T08:01:00.000Z').candidates);
  commitDocumentCandidates(root, planProblemCardSave(root, 'free-001', {
    stem: '解释同离子效应。', standardAnswer: '离子积先改变。',
    teacherRationale: '区分 Q 与 K。', studentNote: '', sources: [],
    tags: { core: ['同离子效应'], related: [] },
  }, '2026-08-11T08:02:00.000Z').candidates);
  const registry = {
    readHistory: async () => [], send: async () => {}, subscribe: async () => () => {},
    open: async () => ({}), abort: async () => {}, release: async () => {},
    createFreeLearning: async () => { throw new Error('not used'); },
    listFreeLearning: async () => [], endFreeLearning: async () => { throw new Error('not used'); },
    createMeta: async () => { throw new Error('not used'); }, listMeta: async () => [],
    listOwnedSessionFacts: async () => [], readFocus: async () => null,
    startFocus: async () => { throw new Error('not used'); }, pauseFocus: () => { throw new Error('not used'); },
    resumeFocus: () => { throw new Error('not used'); }, endFocus: async () => { throw new Error('not used'); },
    endFocusForSession: async () => null,
    openCalendarAppointment: async () => { throw new Error('not used'); },
  };
  return { root, handler: createRequestHandler({ root, registry: registry as never, hub: new EventHub() }) };
}

async function post(handler: ReturnType<typeof createRequestHandler>, path: string, body: unknown) {
  return handler(new Request(`http://local${path}`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  }));
}

test('accepts a Note rating only for the current revision with recall content', async () => {
  const { root, handler } = fixture();
  const accepted = await post(handler, '/api/assets/notes/note-001/review', {
    action: 'review', expectedRevision: 1, result: 'effortful', requestId: 'note-review-1',
  });
  expect(accepted?.status).toBe(201);
  expect(readAssetReviewHistory(root, { kind: 'note', id: 'note-001' }).events.at(-1))
    .toMatchObject({ kind: 'reviewed', result: 'effortful', evidence: { kind: 'self-report' } });

  const plain = await post(handler, '/api/assets/notes/note-002/review', {
    action: 'review', expectedRevision: 1, result: 'fluent', requestId: 'plain-review-1',
  });
  expect(plain?.status).toBe(409);
  const stale = await post(handler, '/api/assets/notes/note-001/review', {
    action: 'review', expectedRevision: 2, result: 'fluent', requestId: 'stale-review-1',
  });
  expect(stale?.status).toBe(409);
});

test('requires a new bound Problem Card attempt and reveal before rating', async () => {
  const { root, handler } = fixture();
  const premature = await post(handler, '/api/assets/problem-cards/problem-001/review', {
    action: 'review', expectedRevision: 1, result: 'forgot',
    problemAttemptId: 'event-001', requestId: 'problem-review-1',
  });
  expect(premature?.status).toBe(409);

  const attempt = await post(handler, '/api/problem-cards/problem-001/attempts', {
    requestId: 'problem-attempt-1', response: { kind: 'cannot' },
  });
  const attemptBody = await attempt!.json() as { event: { id: string } };
  await post(handler, '/api/problem-cards/problem-001/reveal', { requestId: 'problem-reveal-1' });
  const reviewed = await post(handler, '/api/assets/problem-cards/problem-001/review', {
    action: 'review', expectedRevision: 1, result: 'forgot',
    problemAttemptId: attemptBody.event.id, requestId: 'problem-review-2',
  });
  expect(reviewed?.status).toBe(201);
  expect(readAssetReviewHistory(root, { kind: 'problem-card', id: 'problem-001' }).events.at(-1))
    .toMatchObject({
      kind: 'reviewed', result: 'forgot',
      evidence: { kind: 'self-report', problemAttemptId: attemptBody.event.id },
    });
});

test('shows only transparent review controls and routes plain Notes through a teacher', () => {
  const review = {
    asset: { kind: 'note' as const, id: 'note-001' }, active: true as const,
    stage: 1 as const, dueOn: '2026-08-15', lastResult: 'effortful' as const,
  };
  const noteMarkup = renderToStaticMarkup(<NotePage value={{
    kind: 'note', id: 'note-001', path: 'notes/note-001.note.yaml', revision: 1,
    title: '回忆笔记', createdAt: '', updatedAt: '', createdSessionId: 'free-001', sources: [],
    blocks: [{ kind: 'recall', prompt: '提示', answer: '答案' }], review,
  }} onSave={async () => {}} onReview={async () => {}} />);
  expect(noteMarkup).toContain('下次复习');
  expect(noteMarkup).toContain('现在复习');
  expect(noteMarkup).not.toMatch(/掌握率|记忆强度|积分|连续/);

  const plainMarkup = renderToStaticMarkup(<NotePage value={{
    kind: 'note', id: 'note-002', path: 'notes/note-002.note.yaml', revision: 1,
    title: '正文笔记', createdAt: '', updatedAt: '', createdSessionId: 'free-001', sources: [],
    blocks: [{ kind: 'markdown', body: '正文' }], review: { ...review, asset: { kind: 'note', id: 'note-002' } },
  }} onSave={async () => {}} onAskTeacher={() => {}} />);
  expect(plainMarkup).toContain('和老师复习');

  const problemMarkup = renderToStaticMarkup(<ProblemCardPage value={{
    kind: 'problem-card', id: 'problem-001', revision: 1, title: '题目', stem: '题干',
    studentNote: '', standardAnswer: '答案', sources: [], review: {
      ...review, asset: { kind: 'problem-card', id: 'problem-001' },
    }, activity: {
      cardId: 'problem-001', events: [], latestAttempt: null, answerRevealedForLatestAttempt: false,
    },
  }} onAttempt={async () => {}} onReveal={async () => {}} onSaveNote={async () => {}}
  onAskTeacher={async () => {}} onReview={async () => {}} />);
  expect(problemMarkup).toContain('现在复习');
});
