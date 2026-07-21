import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { createClassroomUpdateTool } from '../../src/runtime/classroom-update';
import { createStudyTools } from '../../src/runtime/study-tools';

const root = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');

test('registers the existing four domain contracts without renaming them', () => {
  expect(createStudyTools(root, () => new Date('2026-07-22T00:00:00Z')).map((tool) => tool.name))
    .toEqual(['card_search', 'trace_search', 'trace_append', 'source_resolve']);
});

test('registers classroom_update separately from the public study tools', () => {
  expect(createClassroomUpdateTool(root).name).toBe('classroom_update');
});
