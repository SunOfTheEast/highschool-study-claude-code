import { expect, test } from 'bun:test';
import {
  initialViewState,
  reduceViewState,
} from '../../src/client/view-state';

test('invalidates only named projections and preserves loaded values', () => {
  const loaded = reduceViewState(initialViewState, {
    type: 'loaded',
    view: 'course',
    value: { learningSet: { title: '导数', overview: '', goal: '' } } as never,
  });
  const invalidated = reduceViewState(loaded, {
    type: 'invalidated',
    views: ['course', 'memory'],
  });
  expect(invalidated.course.stale).toBe(true);
  expect(invalidated.course.value).not.toBeNull();
  expect(invalidated.knowledge.stale).toBe(false);
  expect(invalidated.memory.stale).toBe(true);
});
