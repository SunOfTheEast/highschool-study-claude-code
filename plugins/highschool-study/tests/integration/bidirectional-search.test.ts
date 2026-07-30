import { expect, test } from 'bun:test';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { appendCardAlternative } from '../../server/src/alternatives';
import { createCardSearcher, searchCards } from '../../server/src/cards';
import { searchTraces } from '../../server/src/trace-search';
import { appendTrace, readActiveTraces } from '../../server/src/traces';

test('joins cards and active Trace in both directions', () => {
  const root = makeLearningSetWithHistory();
  const current = readActiveTraces(root).find((trace) => (
    trace.cardPath === 'cards/conics/freeze-variable-01.yaml'
    && trace.supersedes !== null
  ))!;
  const appended = appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-FREEZE-01',
    cardStepId: 'identify-freeze',
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: 'Completed a verified alternative route.',
    supersedes: current.traceId,
    methods: null,
  }, () => new Date('2026-07-21T03:00:00Z'), () => (
    '00000005-1111-4111-8111-111111111111'
  ));
  const alternative = appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: appended.traceId,
    question: '整题',
    solution: '先参数化，再消元。',
    method: '参数化与消元',
    support: 'none',
  }, () => new Date('2026-07-21T03:05:00Z'));
  const cards = searchCards(root, { query: 'freeze variable', limit: 3 }).cards;
  expect(cards).toHaveLength(2);
  expect(cards[0]?.traceHistory.map((trace) => trace.traceId)).toEqual([
    'trace-00000001-1111-4111-8111-111111111111',
    appended.traceId,
  ]);
  expect(cards[0]?.alternatives).toEqual([alternative]);
  expect(cards[0]?.title).toContain('椭圆');
  expect(cards[0]?.content).toContain('schema: highschool-study.problem-card.v1');
  expect(cards[1]?.traceHistory).toEqual([]);

  const traces = searchTraces(root, {
    query: 'domain',
    planId: 'max-value',
    lessonId: null,
    cardPath: null,
    occurredAfter: null,
    occurredBefore: null,
    limit: 20,
  });
  expect(Object.keys(traces.cardsByPath)).toEqual([
    'cards/conics/freeze-variable-01.yaml',
  ]);
  expect(traces.cardsByPath['cards/conics/freeze-variable-01.yaml']?.traceHistory.map((trace) => trace.traceId))
    .toEqual([
      'trace-00000001-1111-4111-8111-111111111111',
      appended.traceId,
    ]);
  expect(traces.cardsByPath['cards/conics/freeze-variable-01.yaml']?.alternatives)
    .toEqual([alternative]);
  expect(traces.traces.some((trace) => trace.cardPath === null)).toBe(true);

  expect(searchTraces(root, {
    query: null,
    planId: null,
    lessonId: null,
    cardPath: null,
    occurredAfter: '2026-07-21T02:30:00.000Z',
    occurredBefore: '2026-07-21T03:00:00.000Z',
    limit: 20,
  }).traces.map((trace) => trace.traceId)).toEqual([appended.traceId]);
});

test('scans active Trace once for three card hits', () => {
  const root = makeLearningSetWithHistory();
  copyFileSync(
    join(root, 'cards/conics/freeze-variable-transfer-02.yaml'),
    join(root, 'cards/conics/freeze-variable-transfer-03.yaml'),
  );
  let scans = 0;
  const search = createCardSearcher(() => {
    scans += 1;
    return [];
  });

  expect(search(root, { query: 'freeze variable', limit: 3 }).cards).toHaveLength(3);
  expect(scans).toBe(1);
});
