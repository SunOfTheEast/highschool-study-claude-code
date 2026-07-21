import { expect, test } from 'bun:test';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSet } from '../helpers/learning-set';
import { resolveInsideRoot } from '../../server/src/learning-set';
import { readMarkdownFile } from '../../server/src/markdown';

test('keeps lexical traversal and symlink targets outside the learning set', () => {
  const root = makeLearningSet();
  const outside = makeLearningSet();
  mkdirSync(join(root, 'materials/linked'), { recursive: true });
  symlinkSync(outside, join(root, 'materials/linked/outside'));

  expect(() => resolveInsideRoot(root, '../outside.md')).toThrow(/OUTSIDE_LEARNING_SET/);
  expect(() => resolveInsideRoot(root, 'materials/linked/outside/ROADMAP.md')).toThrow(
    /OUTSIDE_LEARNING_SET/,
  );
});

test('reads real headings and rejects a Plan or Lesson id that differs from its filename', () => {
  const root = makeLearningSet();
  const document = readMarkdownFile(root, 'lessons/lesson-001.md');
  expect(document).toMatchObject({ id: 'lesson-001' });
  expect(document.headings.get('freeze-the-variable')).toBe('Freeze the Variable');

  writeFileSync(join(root, 'lessons/mismatch.md'), '---\nid: another-id\n---\n# Mismatch\n');
  expect(() => readMarkdownFile(root, 'lessons/mismatch.md')).toThrow(/INVALID_DOCUMENT_ID/);
});

test('uses rendered heading text and GitHub-compatible anchor suffixes', () => {
  const root = makeLearningSet();
  writeFileSync(join(root, 'materials/headings.md'), [
    '## A & B',
    '## [Read this](guide.md)',
    '## Duplicate',
    '## Duplicate',
    '',
    'Setext Heading',
    '--------------',
    '',
  ].join('\n'));

  const headings = readMarkdownFile(root, 'materials/headings.md').headings;
  expect(headings.get('a--b')).toBe('A & B');
  expect(headings.get('read-this')).toBe('Read this');
  expect(headings.get('duplicate')).toBe('Duplicate');
  expect(headings.get('duplicate-1')).toBe('Duplicate');
  expect(headings.get('setext-heading')).toBe('Setext Heading');
});

test('validates a Plan or Lesson id through an in-root symlink alias', () => {
  const root = makeLearningSet();
  writeFileSync(join(root, 'plans/mismatch.md'), '---\nid: another-id\n---\n# Mismatch\n');
  symlinkSync('../plans/mismatch.md', join(root, 'materials/plan-alias.md'));

  expect(() => readMarkdownFile(root, 'materials/plan-alias.md')).toThrow(/INVALID_DOCUMENT_ID/);
});
