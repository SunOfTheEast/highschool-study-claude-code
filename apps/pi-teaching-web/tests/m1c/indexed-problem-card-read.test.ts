import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readProblemCard } from '../../src/study/learning-assets';

const roots: string[] = [];

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('uses the managed recall index for an exact card read', () => {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-indexed-card-read-'));
  roots.push(root);
  mkdirSync(join(root, 'cards/aaa'), { recursive: true });
  mkdirSync(join(root, 'cards/derivative'), { recursive: true });
  mkdirSync(join(root, 'semantics/indexes'), { recursive: true });
  writeFileSync(join(root, 'cards/aaa/broken.yaml'), 'this: [must not be parsed');
  writeFileSync(join(root, 'cards/derivative/card-001.card.yaml'), [
    'schema: highschool-study.problem-card.v1',
    'content_item_id: card-001',
    'stem: 用导数判断单调性。',
    'answer: 先求导。',
    '',
  ].join('\n'));
  writeFileSync(join(root, 'semantics/indexes/asset-recall.tsv'), [
    'path\tkind\tid\tcore\trelated\ttitle_or_stem',
    'cards/derivative/card-001.card.yaml\tproblem-card\tcard-001\t[]\t[]\t用导数判断单调性。',
    '',
  ].join('\n'));

  expect(readProblemCard(root, 'card-001')).toMatchObject({
    id: 'card-001',
    path: 'cards/derivative/card-001.card.yaml',
    stem: '用导数判断单调性。',
  });
});
