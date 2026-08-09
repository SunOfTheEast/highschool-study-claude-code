import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  copyLearningSet,
  createBlankLearningSet,
  validateLearningSet,
} from '../../src/desktop/learning-sets';

const roots: string[] = [];

function temporaryRoot(prefix: string): string {
  const root = mkdtempSync(join(tmpdir(), prefix));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

const templateRoot = resolve(import.meta.dir, '../../resources/templates/blank-learning-set');
const derivativeRoot = resolve(import.meta.dir, '../../../../examples/derivative-m0/learning-set');

test('creates a genuinely blank learning set from the packaged template', () => {
  const documentsHome = temporaryRoot('studyforge-documents-');
  const result = createBlankLearningSet({ documentsHome, name: '化学反应原理', templateRoot });

  expect(result).toBe(join(documentsHome, '化学反应原理', 'learning-set'));
  expect(existsSync(join(result, 'LEARNING_GUIDE.md'))).toBe(true);
  expect(existsSync(join(result, 'memory', 'INDEX.md'))).toBe(true);
  expect(existsSync(join(result, 'ROADMAP.md'))).toBe(false);
  expect(validateLearningSet(result)).toEqual({ ok: true, root: result });
});

test('validates an existing learning set without modifying it', () => {
  const root = temporaryRoot('studyforge-existing-');
  mkdirSync(join(root, 'memory'));
  writeFileSync(join(root, 'LEARNING_GUIDE.md'), '# My set\n');
  writeFileSync(join(root, 'memory', 'INDEX.md'), '# Memory\n');
  const before = statSync(join(root, 'LEARNING_GUIDE.md')).mtimeMs;

  expect(validateLearningSet(root)).toEqual({ ok: true, root });
  expect(statSync(join(root, 'LEARNING_GUIDE.md')).mtimeMs).toBe(before);
  expect(validateLearningSet(join(root, 'missing'))).toEqual({
    ok: false,
    code: 'LEARNING_SET_DIRECTORY_NOT_FOUND',
  });
});

test('copies the derivative example into a user-owned directory and never overwrites it', () => {
  const documentsHome = temporaryRoot('studyforge-example-');
  const copy = copyLearningSet({
    sourceRoot: derivativeRoot,
    documentsHome,
    name: '导数示例',
  });

  expect(copy).toBe(join(documentsHome, '导数示例', 'learning-set'));
  expect(readFileSync(join(copy, 'ROADMAP.md'), 'utf8')).toContain('roadmap');
  expect(() => copyLearningSet({
    sourceRoot: derivativeRoot,
    documentsHome,
    name: '导数示例',
  })).toThrow('LEARNING_SET_DESTINATION_EXISTS');
});

test('rejects names that could escape the StudyForge documents directory', () => {
  const documentsHome = temporaryRoot('studyforge-name-');
  for (const name of ['', '.', '..', '../outside', 'a/b']) {
    expect(() => createBlankLearningSet({ documentsHome, name, templateRoot }))
      .toThrow('LEARNING_SET_NAME_INVALID');
  }
});
