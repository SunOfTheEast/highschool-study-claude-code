import { afterEach, expect, test } from 'bun:test';
import { existsSync, mkdtempSync, readFileSync, rmSync, unlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readAssetReviewHistory,
  recordAssetReviewEvent,
} from '../../src/study/asset-reviews';
import {
  ensureAssetReviewIndex,
  readAssetReviewIndex,
} from '../../src/study/asset-review-index';
import type { LearningAssetHandle } from '../../src/shared/contracts';

const roots: string[] = [];
const note: LearningAssetHandle = { kind: 'note', id: 'note-001' };

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function root(): string {
  const value = mkdtempSync(join(tmpdir(), 'studyforge-asset-review-'));
  roots.push(value);
  return value;
}

function authority(requestId: string, localDate: string) {
  return { requestId, at: `${localDate}T08:00:00.000Z`, localDate };
}

test('enrolls one bound asset and atomically projects its first due date', () => {
  const learningSet = root();
  const result = recordAssetReviewEvent(learningSet, note, {
    ...authority('request-enroll', '2026-08-12'),
    event: { kind: 'enrolled', assetRevision: 2, trigger: { kind: 'asset-saved' } },
  });

  expect(result.event).toMatchObject({
    eventId: 'event-001', kind: 'enrolled', policy: 'fixed-ladder-v1',
  });
  expect(result.projection).toEqual({
    asset: note, active: true, stage: 0, dueOn: '2026-08-13', lastResult: null,
  });
  expect(readFileSync(join(
    learningSet, 'activity/asset-reviews/notes/note-001.md',
  ), 'utf8')).toContain('# Asset Review: note:note-001');
  expect(readAssetReviewIndex(learningSet)).toEqual([result.projection]);
});

test('replays the fixed ladder from actual local review dates', () => {
  const learningSet = root();
  recordAssetReviewEvent(learningSet, note, {
    ...authority('enroll', '2026-08-01'),
    event: { kind: 'enrolled', assetRevision: 1, trigger: { kind: 'manual' } },
  });
  const fluent = recordAssetReviewEvent(learningSet, note, {
    ...authority('fluent', '2026-08-05'),
    event: {
      kind: 'reviewed', assetRevision: 1, result: 'fluent',
      evidence: { kind: 'self-report', problemAttemptId: null },
    },
  });
  expect(fluent.projection).toMatchObject({ stage: 1, dueOn: '2026-08-08', lastResult: 'fluent' });
  const effortful = recordAssetReviewEvent(learningSet, note, {
    ...authority('effortful', '2026-08-10'),
    event: {
      kind: 'reviewed', assetRevision: 1, result: 'effortful',
      evidence: { kind: 'session', sessionKey: 'free:review-001' },
    },
  });
  expect(effortful.projection).toMatchObject({ stage: 0, dueOn: '2026-08-11' });
  const forgot = recordAssetReviewEvent(learningSet, note, {
    ...authority('forgot', '2026-08-14'),
    event: {
      kind: 'reviewed', assetRevision: 2, result: 'forgot',
      evidence: { kind: 'session', sessionKey: 'lesson:plan-001:lesson-001' },
    },
  });
  expect(forgot.projection).toMatchObject({ stage: 0, dueOn: '2026-08-15', lastResult: 'forgot' });
});

test('caps fluent progress at the 120-day stage and does not change it merely because it is overdue', () => {
  const learningSet = root();
  recordAssetReviewEvent(learningSet, note, {
    ...authority('enroll', '2026-01-01'),
    event: { kind: 'enrolled', assetRevision: 1, trigger: { kind: 'manual' } },
  });
  for (let index = 0; index < 8; index += 1) {
    const day = String(index + 2).padStart(2, '0');
    recordAssetReviewEvent(learningSet, note, {
      ...authority(`fluent-${index}`, `2026-01-${day}`),
      event: {
        kind: 'reviewed', assetRevision: 1, result: 'fluent',
        evidence: { kind: 'self-report', problemAttemptId: null },
      },
    });
  }
  expect(readAssetReviewHistory(learningSet, note).projection).toMatchObject({
    stage: 6, dueOn: '2026-05-09', lastResult: 'fluent',
  });
});

test('accepts only one effective review per local day until the first is corrected to null', () => {
  const learningSet = root();
  recordAssetReviewEvent(learningSet, note, {
    ...authority('enroll', '2026-08-01'),
    event: { kind: 'enrolled', assetRevision: 1, trigger: { kind: 'manual' } },
  });
  recordAssetReviewEvent(learningSet, note, {
    ...authority('first-review', '2026-08-02'),
    event: {
      kind: 'reviewed', assetRevision: 1, result: 'forgot',
      evidence: { kind: 'self-report', problemAttemptId: null },
    },
  });
  expect(() => recordAssetReviewEvent(learningSet, note, {
    ...authority('second-review', '2026-08-02'),
    event: {
      kind: 'reviewed', assetRevision: 1, result: 'fluent',
      evidence: { kind: 'self-report', problemAttemptId: null },
    },
  })).toThrow('ASSET_REVIEW_ALREADY_RECORDED_TODAY');

  recordAssetReviewEvent(learningSet, note, {
    ...authority('correction', '2026-08-02'),
    event: { kind: 'corrected', targetEventId: 'event-002', replacementResult: null },
  });
  const replacement = recordAssetReviewEvent(learningSet, note, {
    ...authority('replacement', '2026-08-02'),
    event: {
      kind: 'reviewed', assetRevision: 1, result: 'effortful',
      evidence: { kind: 'self-report', problemAttemptId: null },
    },
  });
  expect(replacement.projection).toMatchObject({ stage: 0, lastResult: 'effortful' });
});

test('preserves history across removal, re-enrollment, and restart', () => {
  const learningSet = root();
  recordAssetReviewEvent(learningSet, note, {
    ...authority('enroll', '2026-08-01'),
    event: { kind: 'enrolled', assetRevision: 1, trigger: { kind: 'manual' } },
  });
  const removed = recordAssetReviewEvent(learningSet, note, {
    ...authority('remove', '2026-08-02'), event: { kind: 'removed' },
  });
  expect(removed.projection).toMatchObject({ active: false, dueOn: null });
  recordAssetReviewEvent(learningSet, note, {
    ...authority('reenroll', '2026-08-03'),
    event: { kind: 'enrolled', assetRevision: 2, trigger: { kind: 'manual' } },
  });
  const restarted = recordAssetReviewEvent(learningSet, note, {
    ...authority('restart', '2026-08-10'),
    event: { kind: 'restarted', assetRevision: 3 },
  });
  expect(restarted.projection).toMatchObject({ active: true, stage: 0, dueOn: '2026-08-11' });
  expect(readAssetReviewHistory(learningSet, note).events).toHaveLength(4);
});

test('replays an identical request and rejects a conflicting payload', () => {
  const learningSet = root();
  const input = {
    ...authority('same-request', '2026-08-01'),
    event: { kind: 'enrolled' as const, assetRevision: 1, trigger: { kind: 'manual' as const } },
  };
  const first = recordAssetReviewEvent(learningSet, note, input);
  const replay = recordAssetReviewEvent(learningSet, note, input);
  expect(replay.replayed).toBe(true);
  expect(replay.event).toEqual(first.event);
  expect(readAssetReviewHistory(learningSet, note).events).toHaveLength(1);
  expect(() => recordAssetReviewEvent(learningSet, note, {
    ...input,
    event: { kind: 'enrolled', assetRevision: 2, trigger: { kind: 'manual' } },
  })).toThrow('REQUEST_ID_CONFLICT');
});

test('rejects unknown policy and repairs a deleted or corrupted projection index from logs', () => {
  const learningSet = root();
  recordAssetReviewEvent(learningSet, note, {
    ...authority('enroll', '2026-08-01'),
    event: { kind: 'enrolled', assetRevision: 1, trigger: { kind: 'manual' } },
  });
  const indexPath = join(learningSet, 'activity/asset-reviews/index.tsv');
  unlinkSync(indexPath);
  expect(existsSync(indexPath)).toBe(false);
  expect(ensureAssetReviewIndex(learningSet)).toEqual([
    expect.objectContaining({ asset: note, dueOn: '2026-08-02' }),
  ]);
  writeFileSync(indexPath, 'broken\n', 'utf8');
  expect(ensureAssetReviewIndex(learningSet)).toEqual([
    expect.objectContaining({ asset: note, dueOn: '2026-08-02' }),
  ]);

  const logPath = join(learningSet, 'activity/asset-reviews/notes/note-001.md');
  writeFileSync(logPath, readFileSync(logPath, 'utf8').replace(
    'fixed-ladder-v1', 'future-policy-v9',
  ), 'utf8');
  expect(() => readAssetReviewHistory(learningSet, note)).toThrow('ASSET_REVIEW_POLICY_UNSUPPORTED');
});
