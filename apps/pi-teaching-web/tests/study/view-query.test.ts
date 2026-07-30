import { expect, test } from 'bun:test';
import {
  formatViewQuery,
  readViewQuery,
} from '../../src/study/views/view-query';

test('normalizes the shared cross-view selection', () => {
  const query = readViewQuery(new URLSearchParams({
    plan: ' route-choice ',
    lesson: ' lesson-004 ',
    method: '同构变形与换元法',
    card: 'cards/derivative/example.card.yaml',
    source: 'trace:trace-11111111-1111-4111-8111-111111111111',
    topic: 'derivative-methods',
    range: 'plan',
  }));
  expect(query).toEqual({
    planId: 'route-choice',
    lessonId: 'lesson-004',
    methodName: '同构变形与换元法',
    cardPath: 'cards/derivative/example.card.yaml',
    evidenceSource: 'trace:trace-11111111-1111-4111-8111-111111111111',
    topicId: 'derivative-methods',
    timeRange: 'plan',
  });
  const serialized = formatViewQuery(query);
  expect(readViewQuery(new URLSearchParams(serialized.slice(1)))).toEqual(query);
});

test('drops malformed ids, paths and source handles without widening scope', () => {
  const query = readViewQuery(new URLSearchParams({
    plan: '../outside',
    lesson: 'lesson/../../secret',
    card: '../answer.yaml',
    source: 'file:/tmp/private',
    range: 'forever',
  }));
  expect(query).toEqual({
    planId: null,
    lessonId: null,
    methodName: null,
    cardPath: null,
    evidenceSource: null,
    topicId: null,
    timeRange: 'all',
  });
});
