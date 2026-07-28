import { expect, test } from 'bun:test';
import {
  formatSessionOwnerContext,
  isRoadmapCoachScope,
  ROADMAP_COACH_SCOPE,
} from '../../src/runtime/session-scope';

test('formats the canonical owner file for each role', () => {
  expect(formatSessionOwnerContext('/set', {
    role: 'tutor',
    ownerId: 'not-the-file-name',
    ownerPath: 'lessons/unit-a/custom-name.md',
  })).toContain('Current Lesson file: lessons/unit-a/custom-name.md');

  expect(formatSessionOwnerContext('/set', {
    role: 'coach',
    ownerId: 'domain-integrity',
    ownerPath: 'plans/domain-integrity.md',
  })).toContain('Current Plan file: plans/domain-integrity.md');
});

test('recognizes the canonical Roadmap Coach owner only', () => {
  expect(ROADMAP_COACH_SCOPE).toEqual({
    role: 'coach',
    ownerId: '@roadmap',
    ownerPath: 'ROADMAP.md',
  });
  expect(isRoadmapCoachScope(ROADMAP_COACH_SCOPE)).toBe(true);
  expect(isRoadmapCoachScope({
    role: 'coach',
    ownerId: 'domain-integrity',
    ownerPath: 'plans/domain-integrity.md',
  })).toBe(false);
  expect(formatSessionOwnerContext('/set', ROADMAP_COACH_SCOPE))
    .toContain('Current Roadmap file: ROADMAP.md');
});
