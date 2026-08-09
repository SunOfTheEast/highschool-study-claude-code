import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  commitDocumentCandidates,
  recoverDocumentTransactions,
  type DocumentCandidate,
} from '../../src/runtime/multi-document-transaction';

const roots: string[] = [];

function createRoot(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-multi-document-'));
  mkdirSync(join(root, 'memory', 'objects'), { recursive: true });
  writeFileSync(join(root, 'memory', 'INDEX.md'), '# Index\n\nold\n');
  roots.push(root);
  return root;
}

function candidates(root: string): DocumentCandidate[] {
  return [
    {
      path: 'memory/INDEX.md',
      before: readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8'),
      after: '# Index\n\nnew\n',
    },
    {
      path: 'memory/objects/obj-001.md',
      before: null,
      after: '# obj-001：对象\n',
    },
  ];
}

function transactionDirectories(root: string): string[] {
  const path = join(root, '.studyforge', 'transactions');
  return existsSync(path) ? readdirSync(path) : [];
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('commits an exact existing and new file set', () => {
  const root = createRoot();
  const receipt = commitDocumentCandidates(root, candidates(root));

  expect(receipt.commitId).toMatch(/^[a-f0-9-]+$/);
  expect(receipt.changedPaths).toEqual([
    'memory/INDEX.md',
    'memory/objects/obj-001.md',
  ]);
  expect(readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8'))
    .toBe('# Index\n\nnew\n');
  expect(readFileSync(join(root, 'memory', 'objects', 'obj-001.md'), 'utf8'))
    .toBe('# obj-001：对象\n');
  expect(transactionDirectories(root)).toEqual([]);
});

test('uses one valid preallocated commit ID for the atomic transaction', () => {
  const root = createRoot();
  const commitId = '123e4567-e89b-42d3-a456-426614174000';

  expect(commitDocumentCandidates(root, candidates(root), { commitId }).commitId)
    .toBe(commitId);
});

test('rejects an invalid preallocated commit ID before changing documents', () => {
  const root = createRoot();
  const before = readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8');

  expect(() => commitDocumentCandidates(root, candidates(root), {
    commitId: '../escape',
  })).toThrow('COMMIT_ID_INVALID');
  expect(readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8')).toBe(before);
  expect(existsSync(join(root, 'memory', 'objects', 'obj-001.md'))).toBeFalse();
});

test('validates every candidate before replacing any target', () => {
  const root = createRoot();
  const before = readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8');
  const planned = candidates(root);
  planned[1]!.validate = () => {
    throw new Error('INVALID_OBJECT_CANDIDATE');
  };

  expect(() => commitDocumentCandidates(root, planned))
    .toThrow('INVALID_OBJECT_CANDIDATE');
  expect(readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8')).toBe(before);
  expect(existsSync(join(root, 'memory', 'objects', 'obj-001.md'))).toBeFalse();
});

test('fails before replacement when any source is stale', () => {
  const root = createRoot();
  const planned = candidates(root);
  writeFileSync(join(root, 'memory', 'INDEX.md'), '# Index\n\nexternal\n');

  expect(() => commitDocumentCandidates(root, planned)).toThrow('SOURCE_STALE');
  expect(readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8'))
    .toBe('# Index\n\nexternal\n');
  expect(existsSync(join(root, 'memory', 'objects', 'obj-001.md'))).toBeFalse();
});

test('rolls back every exact target after a mid-commit failure', () => {
  const root = createRoot();
  const before = readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8');

  expect(() => commitDocumentCandidates(root, candidates(root), {
    afterReplace: (_path, index) => {
      if (index === 0) throw new Error('INJECTED_REPLACE_FAILURE');
    },
  })).toThrow('INJECTED_REPLACE_FAILURE');
  expect(readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8')).toBe(before);
  expect(existsSync(join(root, 'memory', 'objects', 'obj-001.md'))).toBeFalse();
  expect(transactionDirectories(root)).toEqual([]);
});

test('recovers an interrupted prepared manifest on next open', () => {
  const root = createRoot();
  const before = readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8');

  expect(() => commitDocumentCandidates(root, candidates(root), {
    afterReplace: () => {
      throw new Error('SIMULATED_PROCESS_EXIT');
    },
    leavePreparedOnError: true,
  })).toThrow('SIMULATED_PROCESS_EXIT');
  expect(readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8'))
    .toBe('# Index\n\nnew\n');
  expect(transactionDirectories(root)).toHaveLength(1);

  expect(recoverDocumentTransactions(root)).toHaveLength(1);
  expect(readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8')).toBe(before);
  expect(existsSync(join(root, 'memory', 'objects', 'obj-001.md'))).toBeFalse();
  expect(transactionDirectories(root)).toEqual([]);
});

test('stops recovery rather than overwriting an external post-crash edit', () => {
  const root = createRoot();

  expect(() => commitDocumentCandidates(root, candidates(root), {
    afterReplace: () => {
      throw new Error('SIMULATED_PROCESS_EXIT');
    },
    leavePreparedOnError: true,
  })).toThrow('SIMULATED_PROCESS_EXIT');
  writeFileSync(join(root, 'memory', 'INDEX.md'), '# Index\n\nexternal-after-crash\n');

  expect(() => recoverDocumentTransactions(root))
    .toThrow('TRANSACTION_RECOVERY_CONFLICT:memory/INDEX.md');
  expect(readFileSync(join(root, 'memory', 'INDEX.md'), 'utf8'))
    .toBe('# Index\n\nexternal-after-crash\n');
  expect(transactionDirectories(root)).toHaveLength(1);
});

test('rejects empty, duplicate, escaped, and symbolic-link targets', () => {
  const root = createRoot();

  expect(() => commitDocumentCandidates(root, [])).toThrow('CANDIDATES_REQUIRED');
  const duplicate = candidates(root)[0]!;
  expect(() => commitDocumentCandidates(root, [duplicate, duplicate]))
    .toThrow('DUPLICATE_CANDIDATE_PATH');
  expect(() => commitDocumentCandidates(root, [{
    path: '../outside.md',
    before: null,
    after: '# Outside\n',
  }])).toThrow('path escapes');

  const outside = mkdtempSync(join(tmpdir(), 'studyforge-multi-document-outside-'));
  roots.push(outside);
  symlinkSync(outside, join(root, 'memory', 'linked'));
  expect(() => commitDocumentCandidates(root, [{
    path: 'memory/linked/outside.md',
    before: null,
    after: '# Outside\n',
  }])).toThrow('symbolic link');
});
