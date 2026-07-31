import { expect, test } from 'bun:test';
import {
  routeForPrimaryView,
  selectionFromRoute,
} from '../../src/client/view-selection';

test('derives the classroom return route from shared selection', () => {
  const selection = selectionFromRoute({
    kind: 'knowledge',
    query: {
      planId: 'p1',
      lessonId: 'l2',
      methodName: '冻结变量法',
      cardPath: null,
      evidenceSource: null,
      topicId: null,
      timeRange: 'all',
    },
  });
  expect(selection.courseReturnRoute).toBe('/course/plan/p1/lesson/l2');
  expect(routeForPrimaryView('memory', selection)).toMatchObject({
    kind: 'memory',
    query: {
      planId: 'p1',
      lessonId: 'l2',
      methodName: '冻结变量法',
    },
  });
});
