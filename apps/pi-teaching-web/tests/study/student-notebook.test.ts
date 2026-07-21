import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { readStudentNotebook } from '../../src/study/student-notebook';

const root = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');

test('returns card stems without answer-bearing fields', () => {
  const notebook = readStudentNotebook(root, 'lesson-003', false);
  const text = JSON.stringify(notebook);
  expect(text).toContain('mst_p0032_ex22');
  expect(text).toContain('关于 $x$ 的不等式');
  for (const forbidden of ['source_solution_summary', 'rubric', 'Teacher Control', 'answer']) {
    expect(text).not.toContain(forbidden);
  }
});
