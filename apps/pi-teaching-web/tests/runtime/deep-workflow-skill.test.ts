import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(
  join(import.meta.dir, '../../resources/skills/deep-workflow/SKILL.md'),
  'utf8',
);

test('gates delegation and preserves parent-only writes', () => {
  for (const required of [
    'two independent lenses',
    'could change the next teaching action',
    'card_search',
    'trace_search',
    'quick',
    'deep',
    'student confirmation',
    'parent remains the only writer',
  ]) expect(source).toContain(required);
  expect(source).toContain('return an empty result');
  expect(source).not.toContain('always delegate');
});
