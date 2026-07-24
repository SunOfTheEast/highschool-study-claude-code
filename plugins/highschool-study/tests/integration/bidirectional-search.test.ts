import { expect, test } from 'bun:test';
import { copyFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { appendCardAlternative } from '../../server/src/alternatives';
import { createCardSearcher, searchCards } from '../../server/src/cards';
import { searchTraces } from '../../server/src/trace-search';
import { appendTrace } from '../../server/src/traces';

test('joins cards and active Trace in both directions', () => {
  const root = makeLearningSetWithHistory();
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-FREEZE-01',
    cardStepId: 'identify-freeze',
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: 'Completed a verified alternative route.',
    supersedes: 'event-003',
    methods: null,
  }, () => new Date('2026-07-21T03:00:00Z'));
  const alternative = appendCardAlternative(root, 'lessons/lesson-001.md', {
    sourceTraceId: 'event-005',
    question: '整题',
    solution: '先参数化，再消元。',
    method: '参数化与消元',
    support: 'none',
  }, () => new Date('2026-07-21T03:05:00Z'));
  const cards = searchCards(root, { query: 'freeze variable', limit: 3 }).cards;
  expect(cards).toHaveLength(2);
  expect(cards[0]?.traceHistory.map((trace) => trace.eventId)).toEqual([
    'event-001',
    'event-005',
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
    limit: 20,
  });
  expect(Object.keys(traces.cardsByPath)).toEqual([
    'cards/conics/freeze-variable-01.yaml',
  ]);
  expect(traces.cardsByPath['cards/conics/freeze-variable-01.yaml']?.traceHistory.map((trace) => trace.eventId))
    .toEqual(['event-001', 'event-005']);
  expect(traces.cardsByPath['cards/conics/freeze-variable-01.yaml']?.alternatives)
    .toEqual([alternative]);
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
