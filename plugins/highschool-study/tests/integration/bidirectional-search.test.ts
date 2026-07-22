import { expect, test } from 'bun:test';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { createCardSearcher, searchCards } from '../../server/src/cards';
import { searchTraces } from '../../server/src/trace-search';

test('joins cards and active Trace in both directions', () => {
  const root = makeLearningSetWithHistory();
  const cards = searchCards(root, { query: 'freeze variable', limit: 3 }).cards;
  expect(cards).toHaveLength(2);
  expect(cards[0]?.traceHistory.map((trace) => trace.eventId)).toEqual([
    'event-001',
    'event-003',
  ]);
  expect(cards[0]?.title).toContain('椭圆');
  expect(cards[0]?.content).toContain('schema: highschool-study.problem-card.v1');
  expect(cards[1]?.traceHistory).toEqual([]);

  const traces = searchTraces(root, {
    query: 'domain',
    planId: 'max-value',
    lessonId: null,
    cardPath: null,
    limit: 20,
  });
  expect(Object.keys(traces.cardsByPath)).toEqual([
    'cards/conics/freeze-variable-01.yaml',
  ]);
  expect(traces.cardsByPath['cards/conics/freeze-variable-01.yaml']?.traceHistory.map((trace) => trace.eventId))
    .toEqual(['event-001', 'event-003']);
  expect(traces.cardsByPath['cards/conics/freeze-variable-01.yaml']?.alternatives).toEqual([]);
  expect(traces.traces.some((trace) => trace.cardPath === null)).toBe(true);
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
