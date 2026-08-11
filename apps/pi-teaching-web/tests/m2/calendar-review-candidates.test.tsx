import { afterEach, expect, test } from 'bun:test';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  cpSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  calendarReviewSelection,
  readCalendarReviewCandidates,
} from '../../src/calendar/review-candidates';
import { createCalendarRepository } from '../../src/calendar/appointments';
import { CalendarPage } from '../../src/client/pages/CalendarPage';
import { AssetsPage } from '../../src/client/pages/AssetsPage';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import { createRequestHandler } from '../../src/server/app';
import { EventHub } from '../../src/server/event-hub';
import {
  planLearningNoteSave,
  planProblemCardSave,
  readLearningAssetLibrary,
} from '../../src/study/learning-assets';
import {
  readAssetReviewHistory,
  recordAssetReviewEvent,
} from '../../src/study/asset-reviews';
import { refreshSemanticRecallIndex } from '../../src/study/semantic-index';

const blank = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const roots: string[] = [];

function temporary(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

function learningSet(title: string): string {
  const root = temporary('studyforge-calendar-review-set-');
  cpSync(blank, root, { recursive: true });
  writeFileSync(join(root, 'LEARNING_GUIDE.md'), [
    '---', 'id: test-set', `title: ${title}`, '---', '', `# ${title}`, '', '测试学习集。', '',
  ].join('\n'));
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function saveNote(root: string, title: string, at: string) {
  const planned = planLearningNoteSave(root, 'seed-session', {
    title,
    blocks: [{ kind: 'markdown', body: `${title} 的正文。` }],
    sources: [], tags: { core: [title], related: [] },
  }, at);
  commitDocumentCandidates(root, planned.candidates);
  return planned.note;
}

function saveCard(root: string, title: string, at: string) {
  const planned = planProblemCardSave(root, 'seed-session', {
    stem: title, standardAnswer: '答案', teacherRationale: '教师依据', studentNote: '',
    sources: [], tags: { core: [title], related: [] },
  }, at);
  commitDocumentCandidates(root, planned.candidates);
  return planned.card;
}

function registry(created: Array<{ assets: unknown[]; intent: string }>) {
  return {
    readHistory: async () => [], send: async () => {}, subscribe: async () => () => {},
    open: async () => ({}), abort: async () => {}, release: async () => {},
    createFreeLearning: async (assets: unknown[], intent = 'open') => {
      created.push({ assets, intent });
      return {
        id: 'review-free-001', sessionKey: 'free:review-free-001', title: '自由学习',
        createdAt: '2026-08-12T08:00:00.000Z', updatedAt: '2026-08-12T08:00:00.000Z',
        status: 'active', selectedAssets: assets,
      };
    },
    listFreeLearning: async () => [], endFreeLearning: async () => { throw new Error('unused'); },
    createMeta: async () => { throw new Error('unused'); }, listMeta: async () => [],
    listOwnedSessionFacts: async () => [], readFocus: async () => null,
    startFocus: async () => { throw new Error('unused'); }, pauseFocus: () => { throw new Error('unused'); },
    resumeFocus: () => { throw new Error('unused'); }, endFocus: async () => { throw new Error('unused'); },
    endFocusForSession: async () => null,
    openCalendarAppointment: async () => { throw new Error('unused'); },
  };
}

test('aggregates only explicit learning-set roots and keeps missing assets visible but unavailable', () => {
  const chemistry = learningSet('化学反应原理');
  const mathematics = learningSet('导数结构');
  const unlisted = learningSet('不应被扫描');
  const note = saveNote(chemistry, 'Ksp 的边界', '2026-08-01T08:00:00.000Z');
  saveCard(mathematics, '参数分离', '2026-08-04T08:00:00.000Z');
  const missing = saveNote(mathematics, '即将缺失的笔记', '2026-08-02T08:00:00.000Z');
  refreshSemanticRecallIndex(mathematics);
  rmSync(join(mathematics, missing.path));
  saveNote(unlisted, '目录邻居不应出现', '2026-07-01T08:00:00.000Z');

  const candidates = readCalendarReviewCandidates([mathematics, chemistry, chemistry]);
  expect(candidates.map((candidate) => candidate.title)).toEqual([
    'Ksp 的边界', '即将缺失的笔记', '参数分离',
  ]);
  expect(candidates[0]).toMatchObject({
    learningSetPath: chemistry,
    learningSetName: '化学反应原理',
    asset: { kind: 'note', id: note.id },
    dueOn: '2026-08-02', stage: 0, lastResult: null, unavailable: false,
  });
  expect(candidates.find((candidate) => (
    candidate.learningSetPath === mathematics && candidate.asset.id === missing.id
  )))
    .toMatchObject({ title: '即将缺失的笔记', unavailable: true });
  expect(JSON.stringify(candidates)).not.toContain('目录邻居不应出现');
  expect(JSON.stringify(candidates)).not.toContain('event-001');
  expect(JSON.stringify(candidates)).not.toContain('教师依据');
});

test('projects overdue reviews onto today, future reviews onto their date, and forms one-set batches', () => {
  const chemistry = learningSet('化学反应原理');
  const first = saveNote(chemistry, '今天补看', '2026-08-01T08:00:00.000Z');
  const second = saveCard(chemistry, '三天后再做', '2026-08-14T08:00:00.000Z');
  const candidates = readCalendarReviewCandidates([chemistry]);
  const markup = renderToStaticMarkup(
    <CalendarPage
      appointments={[]}
      currentLearningSetPath={chemistry}
      reviewCandidates={candidates}
      today="2026-08-12"
      initialMonth="2026-08"
      initialDate="2026-08-12"
      onCreate={async () => {}}
      onUpdate={async () => {}}
      onDelete={async () => {}}
      onOpen={async () => {}}
      onReview={async () => {}}
    />,
  );
  expect(markup).toContain('今天补看');
  expect(markup).toContain('2026-08-15');
  expect(markup).toContain('待复习 1');
  expect(markup).toContain('现在开始复习');
  expect(markup).toContain('安排到时间');

  expect(calendarReviewSelection(candidates.filter((candidate) => (
    candidate.asset.id === first.id || candidate.asset.id === second.id
  )))).toEqual({
    learningSetPath: chemistry,
    contexts: [
      { kind: 'note', id: first.id },
      { kind: 'problem-card', id: second.id },
    ],
  });
  const other = learningSet('另一学习集');
  saveNote(other, '另一候选', '2026-08-03T08:00:00.000Z');
  const otherCandidate = readCalendarReviewCandidates([
    other,
  ]);
  expect(() => calendarReviewSelection([...candidates.slice(0, 1), ...otherCandidate]))
    .toThrow('CALENDAR_REVIEW_SELECTION_MIXED_SETS');
});

test('serves refreshed candidates, starts review intent, and never consumes a saved appointment', async () => {
  const chemistry = learningSet('化学反应原理');
  const mathematics = learningSet('导数结构');
  const note = saveNote(chemistry, 'Ksp 复习', '2026-08-01T08:00:00.000Z');
  const card = saveCard(mathematics, '参数分离复习', '2026-08-01T09:00:00.000Z');
  const appHome = temporary('studyforge-calendar-review-app-');
  const calendar = createCalendarRepository(appHome, {
    now: () => new Date('2026-08-12T08:00:00.000Z'),
    id: () => 'review-appointment-001',
  });
  const created: Array<{ assets: unknown[]; intent: string }> = [];
  const handler = createRequestHandler({
    root: chemistry,
    registry: registry(created) as never,
    hub: new EventHub(),
    calendar,
    knownLearningSetRoots: () => [chemistry, mathematics],
    reviewCandidates: () => readCalendarReviewCandidates([chemistry, mathematics]),
  });

  const initial = await (await handler(new Request('http://local/api/calendar')))!.json() as any;
  expect(initial.reviewCandidates).toHaveLength(2);
  const appointmentResponse = await handler(new Request('http://local/api/calendar', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: '周末复习参数分离',
      startsAt: '2026-08-16T10:00:00+08:00',
      plannedMinutes: 25,
      learningSetPath: mathematics,
      destination: {
        kind: 'free-learning', intent: 'review',
        contexts: [{ kind: 'problem-card', id: card.id }],
      },
    }),
  }));
  expect((await appointmentResponse!.json() as any).appointment)
    .toMatchObject({ learningSetPath: mathematics });

  const freeResponse = await handler(new Request('http://local/api/free-learning', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      selectedAssets: [{ kind: 'note', id: note.id }], intent: 'review',
    }),
  }));
  expect(freeResponse?.status).toBe(201);
  expect(created).toEqual([{
    assets: [{ kind: 'note', id: note.id }], intent: 'review',
  }]);

  recordAssetReviewEvent(chemistry, { kind: 'note', id: note.id }, {
    requestId: 'early-review', at: '2026-08-12T09:00:00.000Z', localDate: '2026-08-12',
    event: {
      kind: 'reviewed', assetRevision: note.revision, result: 'fluent',
      evidence: { kind: 'session', sessionKey: 'free:review-free-001' },
    },
  });
  const refreshed = await (await handler(new Request('http://local/api/calendar')))!.json() as any;
  expect(refreshed.reviewCandidates.find((candidate: any) => candidate.asset.id === note.id))
    .toMatchObject({ dueOn: '2026-08-15', stage: 1, lastResult: 'fluent' });
  expect(refreshed.appointments).toHaveLength(1);
  expect(calendar.list()[0]).toMatchObject({ id: 'review-appointment-001' });
  expect(readAssetReviewHistory(chemistry, { kind: 'note', id: note.id }).events)
    .toHaveLength(2);
});

test('adds a separate review action to the asset library without turning it into a due queue', () => {
  const root = learningSet('化学反应原理');
  saveNote(root, '一份笔记', '2026-08-01T08:00:00.000Z');
  const markup = renderToStaticMarkup(
    <AssetsPage
      value={readLearningAssetLibrary(root)}
      onOpen={() => {}}
      onAsk={() => {}}
      onReview={() => {}}
    />,
  );
  expect(markup).toContain('带着所选问老师');
  expect(markup).toContain('复习所选');
  expect(markup).not.toContain('待复习队列');
  expect(markup).not.toContain('掌握度');
});
