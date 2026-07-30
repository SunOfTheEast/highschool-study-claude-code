import { expect, test } from 'bun:test';
import { disclosureForLesson } from '../../src/study/views/view-disclosure';

test('keeps prepared bindings private and reveals only occurred classroom blocks', () => {
  expect(disclosureForLesson('prepared')).toEqual({
    mayExposeLessonBindings: false,
    visibleBlockStatuses: [],
    mayExposeHistoricalLineage: false,
    mayExposeTeachingClaimText: false,
  });
  expect(disclosureForLesson('active')).toEqual({
    mayExposeLessonBindings: true,
    visibleBlockStatuses: ['active', 'completed'],
    mayExposeHistoricalLineage: true,
    mayExposeTeachingClaimText: false,
  });
  expect(disclosureForLesson('closed')).toEqual({
    mayExposeLessonBindings: true,
    visibleBlockStatuses: ['completed'],
    mayExposeHistoricalLineage: true,
    mayExposeTeachingClaimText: false,
  });
});
