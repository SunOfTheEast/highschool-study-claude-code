import { afterEach, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  parseSourceFirstValidationArguments,
  selectOffsetValidationNode,
} from '../../scripts/source-first-validation/cli';

const roots: string[] = [];

function temporaryRoot() {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-source-validation-'));
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('accepts one real large PDF and a bounded visual/table-of-contents sample', () => {
  const root = temporaryRoot();
  const pdf = join(root, 'owned-book.pdf');
  writeFileSync(pdf, '%PDF');
  truncateSync(pdf, 33 * 1024 * 1024);
  const appHome = join(root, 'StudyForge');
  mkdirSync(appHome);

  expect(parseSourceFirstValidationArguments([
    'run',
    '--pdf', pdf,
    '--output', join(root, 'evidence'),
    '--app-home', appHome,
    '--page', '25',
    '--toc-start', '10',
    '--toc-end', '12',
  ])).toMatchObject({
    pdf,
    page: 25,
    toc: { startPage: 10, endPage: 12 },
    title: 'owned-book',
  });
});

test('rejects small fixtures and unbounded visual scans', () => {
  const root = temporaryRoot();
  const pdf = join(root, 'tiny.pdf');
  writeFileSync(pdf, '%PDF');
  const common = [
    'run', '--pdf', pdf, '--output', join(root, 'evidence'), '--app-home', root,
    '--page', '1', '--toc-start', '1', '--toc-end', '2',
  ];
  expect(() => parseSourceFirstValidationArguments(common))
    .toThrow('SOURCE_FIRST_VALIDATION_PDF_TOO_SMALL');

  truncateSync(pdf, 33 * 1024 * 1024);
  expect(() => parseSourceFirstValidationArguments([
    ...common.slice(0, -1), '13',
  ])).toThrow('SOURCE_FIRST_VALIDATION_TOC_RANGE_INVALID');
});

test('validates a page-offset hint against a real navigation node instead of an arbitrary sampled page', () => {
  const selected = selectOffsetValidationNode({
    pageCount: 314,
    printedPageOffsetHint: 15,
    outline: [
      {
        id: 'book', title: '上册', level: 1, source: 'visual-toc', printedPage: '1',
        startPage: null, endPage: null, provenancePages: [10, 11, 12, 13, 14, 15, 16],
      },
      {
        id: 'chapter', title: '第1章 技能篇', level: 2, source: 'visual-toc', printedPage: '1',
        startPage: null, endPage: null, provenancePages: [10, 11, 12, 13, 14, 15, 16],
      },
      {
        id: 'section', title: '第一节 同构函数的基础应用', level: 3, source: 'visual-toc', printedPage: '1',
        startPage: null, endPage: null, provenancePages: [10, 11, 12, 13, 14, 15, 16],
      },
      {
        id: 'later', title: '第二节 切线函数的基本应用', level: 3, source: 'visual-toc', printedPage: '24',
        startPage: null, endPage: null, provenancePages: [10, 11, 12, 13, 14, 15, 16],
      },
    ],
  });

  expect(selected).toMatchObject({ id: 'section', printedPage: '1' });
});
