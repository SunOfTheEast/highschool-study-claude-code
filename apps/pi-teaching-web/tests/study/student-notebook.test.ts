import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readStudentNotebook } from '../../src/study/student-notebook';
import { setBlockStatus, setFrontmatterField } from '../../src/study/write-workspace';

const sourceRoot = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');
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

test('withholds a shared assessment card until every related problem Block is visible', () => {
  const root = fixture();
  const lessonPath = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8')
      .replace('- Uses: Q-DOMAIN-EX16', '- Uses: Q-DOMAIN-EX22'),
  );

  setBlockStatus(root, 'lessons/lesson-003.md', 'orientation', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'assessment-01', 'active');
  expect(readStudentNotebook(root, 'lesson-003', false).cards).toEqual({});

  setBlockStatus(root, 'lessons/lesson-003.md', 'assessment-01', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'assessment-02', 'active');
  expect(Object.keys(readStudentNotebook(root, 'lesson-003', false).cards))
    .toEqual(['Q-DOMAIN-EX22']);
});

test('reveals only active and completed Student Views during an assessment', () => {
  const root = fixture();
  expect(readStudentNotebook(root, 'lesson-003', false).lesson.blocks
    .map((block) => block.studentView))
    .toEqual(['', '', '', '', '']);

  setBlockStatus(root, 'lessons/lesson-003.md', 'orientation', 'completed');
  setBlockStatus(root, 'lessons/lesson-003.md', 'assessment-01', 'active');
  const blocks = readStudentNotebook(root, 'lesson-003', false).lesson.blocks;

  expect(blocks[0]?.studentView).toContain('两道不同结构的未见题');
  expect(blocks[1]?.studentView).toContain('Q-DOMAIN-EX22');
  expect(blocks.slice(2).map((block) => block.studentView)).toEqual(['', '', '']);
});

test('restores all assessment Student Views after closure', () => {
  const root = fixture();
  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'closed');

  expect(readStudentNotebook(root, 'lesson-003', false).lesson.blocks
    .every((block) => block.studentView.length > 0))
    .toBe(true);
});

test('projects the close-time Lesson Summary only for a closed Lesson', () => {
  const root = fixture();
  const path = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace(
      /(^## Lesson Summary\s*$\n)([\s\S]*?)(?=^## |$(?![\s\S]))/m,
      '$1\n完成一题；另一题尚未进行。来源：#trace-event-001。\n\n',
    ),
  );

  expect(readStudentNotebook(root, 'lesson-003', false).lessonSummary).toBeNull();

  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'closed');
  expect(readStudentNotebook(root, 'lesson-003', false).lessonSummary)
    .toBe('完成一题；另一题尚未进行。来源：#trace-event-001。');
});

test('keeps level-two headings inside a close-time Lesson Summary body', () => {
  const root = fixture();
  const path = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    path,
    readFileSync(path, 'utf8').replace(
      /(^## Lesson Summary\s*$\n)([\s\S]*?)(?=^## |$(?![\s\S]))/m,
      '$1\n## 完成情况\n\n完成一题；来源：#trace-event-001。\n\n',
    ),
  );
  setFrontmatterField(root, 'lessons/lesson-003.md', 'status', 'closed');

  expect(readStudentNotebook(root, 'lesson-003', false).lessonSummary)
    .toBe('## 完成情况\n\n完成一题；来源：#trace-event-001。');
});

test('keeps pending Student Views available for non-assessment previews', () => {
  const root = fixture();
  const lessonPath = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8')
      .replace('- Primary template: `assessment`', '- Primary template: `deliberate-practice`'),
  );

  expect(readStudentNotebook(root, 'lesson-003', false).lesson.blocks[1]?.studentView)
    .toContain('Q-DOMAIN-EX22');
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
