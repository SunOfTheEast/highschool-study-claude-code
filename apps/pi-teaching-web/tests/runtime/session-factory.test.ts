import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { roleToolNames } from '../../src/runtime/session-factory';

const resources = join(import.meta.dir, '../../resources');

test('keeps Coach and Tutor tool boundaries distinct', () => {
  expect(roleToolNames('coach')).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'write',
    'edit',
    'card_search',
    'trace_search',
    'source_resolve',
  ]);
  expect(roleToolNames('tutor')).toEqual([
    'read',
    'grep',
    'find',
    'ls',
    'card_search',
    'trace_search',
    'trace_append',
    'source_resolve',
    'classroom_update',
  ]);
  expect(readFileSync(join(resources, 'agents/coach.md'), 'utf8')).toContain('one Plan');
  expect(readFileSync(join(resources, 'agents/tutor.md'), 'utf8')).toContain('one Lesson');
});
