import { expect, test } from 'bun:test';
import { formatSessionOwnerContext } from '../../src/runtime/session-scope';

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
