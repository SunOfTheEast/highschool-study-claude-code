import { afterEach, expect, test } from 'bun:test';
import { cpSync, existsSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import {
  planLearningNoteSave,
  planProblemCardSave,
} from '../../src/study/learning-assets';
import {
  readAssetReviewHistory,
} from '../../src/study/asset-reviews';
import {
  migrateHistoricalProblemReviews,
  recordProblemAttempt,
} from '../../src/study/problem-attempts';

const blank = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const legacy = join(import.meta.dir, '../fixtures/m0-learning-set');
const derivative = join(import.meta.dir, '../../../../examples/derivative-m0/learning-set');
const roots: string[] = [];

function copy(source = blank): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-review-enrollment-'));
  cpSync(source, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('creates each new Note and Problem Card with one enrollment in the same transaction', () => {
  const root = copy();
  const note = planLearningNoteSave(root, 'free-001', {
    title: 'Ksp 的边界', blocks: [{ kind: 'markdown', body: '纯固体活度并入常数。' }],
    sources: [], tags: { core: ['Ksp'], related: [] },
  }, '2026-08-12T08:00:00.000Z');
  expect(note.candidates.map((item) => item.path)).toContain(
    'activity/asset-reviews/notes/note-001.md',
  );
  expect(existsSync(join(root, note.note.path))).toBe(false);
  commitDocumentCandidates(root, note.candidates);
  expect(readAssetReviewHistory(root, { kind: 'note', id: 'note-001' }).events[0])
    .toMatchObject({ kind: 'enrolled', trigger: { kind: 'asset-saved' }, assetRevision: 1 });

  const card = planProblemCardSave(root, 'free-001', {
    stem: '解释同离子效应。', standardAnswer: '离子积先改变。',
    teacherRationale: '区分 Q 与 K。', studentNote: '', sources: [],
    tags: { core: ['同离子效应'], related: [] },
  }, '2026-08-12T08:10:00.000Z');
  expect(card.candidates.map((item) => item.path)).toContain(
    'activity/asset-reviews/problem-cards/problem-001.md',
  );
  commitDocumentCandidates(root, card.candidates);
  expect(readAssetReviewHistory(root, { kind: 'problem-card', id: 'problem-001' }).events[0])
    .toMatchObject({ kind: 'enrolled', trigger: { kind: 'asset-saved' }, assetRevision: 1 });
});

test('enrolls one legacy Problem Card on its first real attempt but not on reveal or read', () => {
  const root = copy(legacy);
  const asset = { kind: 'problem-card' as const, id: 'sample-card' };
  expect(readAssetReviewHistory(root, asset).projection).toBeNull();
  expect(() => readFileSync(join(root, 'cards/sample.card.yaml'), 'utf8')).not.toThrow();
  expect(readAssetReviewHistory(root, asset).projection).toBeNull();

  const attempt = recordProblemAttempt(
    root, 'sample-card', { kind: 'cannot' }, 'first-real-attempt',
    '2026-08-12T09:00:00.000Z',
  );
  expect(readAssetReviewHistory(root, asset).events[0]).toMatchObject({
    kind: 'enrolled',
    trigger: { kind: 'first-attempt', problemAttemptId: attempt.id },
  });
});

test('migrates only bounded historical attempt logs and leaves the untouched 519-card library absent', () => {
  const large = copy(derivative);
  expect(migrateHistoricalProblemReviews(large)).toEqual([]);
  expect(existsSync(join(large, 'activity/asset-reviews/problem-cards'))).toBe(false);

  const root = copy(legacy);
  const directory = join(root, 'activity/problem-attempts');
  mkdirSync(directory, { recursive: true });
  writeFileSync(join(directory, 'sample-card.md'), [
    '# Problem Activity: sample-card', '', '## event-001', '', '```yaml',
    'schema: studyforge.problem-activity-event.v1', 'kind: attempt',
    'event_id: event-001', 'request_id: old-attempt', 'at: 2026-08-01T08:00:00.000Z',
    'card_id: sample-card', 'card_revision: 1', 'answer_viewed_before: false',
    'response:', '  kind: cannot', '```', '',
  ].join('\n'), 'utf8');
  expect(migrateHistoricalProblemReviews(root, 1)).toEqual(['sample-card']);
  expect(readAssetReviewHistory(root, { kind: 'problem-card', id: 'sample-card' }).events[0])
    .toMatchObject({
      kind: 'enrolled',
      trigger: { kind: 'historical-attempt', problemAttemptId: 'event-001' },
    });
});
