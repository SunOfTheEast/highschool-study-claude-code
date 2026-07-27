import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readStudentNotebook } from '../../src/study/student-notebook';
import { setBlockStatus } from '../../src/study/write-workspace';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const sourceRoot = domainIntegrityFixtureRoot;
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'student-notebook-'));
  roots.push(root);
  cpSync(sourceRoot, root, { recursive: true });
  return root;
}

test('reveals cards only after their ActivityBlock becomes visible', () => {
  const root = fixture();
  expect(readStudentNotebook(root, 'lesson-003', false).cards).toEqual({});

  setBlockStatus(root, 'lessons/lesson-003.md', 'orientation', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'assessment-01', 'active');
  expect(Object.keys(readStudentNotebook(root, 'lesson-003', false).cards))
    .toEqual(['Q-DOMAIN-EX22']);
});

test('returns card stems without answer-bearing fields', () => {
  const root = fixture();
  setBlockStatus(root, 'lessons/lesson-003.md', 'assessment-01', 'active');
  const notebook = readStudentNotebook(root, 'lesson-003', false);
  const text = JSON.stringify(notebook);
  expect(text).toContain('mst_p0032_ex22');
  expect(text).toContain('关于 $x$ 的不等式');
  for (const forbidden of ['source_solution_summary', 'rubric', 'Teacher Control', 'answer']) {
    expect(text).not.toContain(forbidden);
  }
});
