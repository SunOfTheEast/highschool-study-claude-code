import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mutateDocumentAtomically } from '../../src/runtime/atomic-document';
import { parseLessonSource } from '../../src/study/markdown';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m0-atomic-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('does not replace a document when candidate validation fails', () => {
  const root = copyFixture();
  const absolute = join(root, lessonPath);
  const before = readFileSync(absolute, 'utf8');

  expect(() => mutateDocumentAtomically(
    root,
    lessonPath,
    (source) => ({
      source: source.replace('## Block block-002', '## Missing block-002'),
      value: undefined,
    }),
    (candidate) => parseLessonSource(lessonPath, candidate),
  )).toThrow();
  expect(readFileSync(absolute, 'utf8')).toBe(before);
});

test('does not overwrite a source changed during the mutation', () => {
  const root = copyFixture();
  const absolute = join(root, lessonPath);

  expect(() => mutateDocumentAtomically(
    root,
    lessonPath,
    (before) => {
      writeFileSync(absolute, before.replace('真实停点问诊', '外部新版本'));
      return {
        source: before.replace('真实停点问诊', '候选版本'),
        value: undefined,
      };
    },
    (candidate) => parseLessonSource(lessonPath, candidate),
  )).toThrow('SOURCE_STALE');
  expect(readFileSync(absolute, 'utf8')).toContain('外部新版本');
  expect(readdirSync(join(root, 'lessons')).filter((name) => name.endsWith('.tmp')))
    .toEqual([]);
});

test('atomically commits one validated candidate and returns its transient value', () => {
  const root = copyFixture();
  const value = mutateDocumentAtomically(
    root,
    lessonPath,
    (before) => ({
      source: before.replace('真实停点问诊', '原子写入版本'),
      value: { activeBlockId: 'block-002' },
    }),
    (candidate) => parseLessonSource(lessonPath, candidate),
  );

  expect(value).toEqual({ activeBlockId: 'block-002' });
  expect(readFileSync(join(root, lessonPath), 'utf8')).toContain('原子写入版本');
});

test('rejects writes outside the learning-set root', () => {
  const root = copyFixture();
  expect(() => mutateDocumentAtomically(
    root,
    '../outside.md',
    (source) => ({ source, value: undefined }),
  )).toThrow('path escapes');
});
