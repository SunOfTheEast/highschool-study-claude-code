import { expect, test } from 'bun:test';
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSet } from '../helpers/learning-set';
import { resolveInsideRoot } from '../../server/src/learning-set';
import { readMarkdownFile } from '../../server/src/markdown';

const requiredPlanSections = [
  'Goal',
  'Observable Capability Standard',
  'Test',
  'Planning Basis',
  'Lesson Index',
  'Current Position',
  'Next Lesson Candidate',
  'Plan Summary',
] as const;

function strictPlanSource(options: {
  kind?: string;
  status?: string;
  coachSession?: string;
  omit?: string;
  empty?: string;
  duplicate?: string;
  missingTitle?: boolean;
  duplicateTitle?: boolean;
  reverse?: boolean;
  extra?: string;
} = {}): string {
  const headings = options.reverse
    ? [...requiredPlanSections].reverse()
    : [...requiredPlanSections];
  const sections = headings
    .filter((heading) => heading !== options.omit)
    .map((heading) => [
      `## ${heading}`,
      '',
      heading === options.empty ? '   ' : `${heading} content.`,
      options.duplicate === heading
        ? `\n## ${heading}\n\nDuplicate content.`
        : '',
    ].join('\n'))
    .join('\n\n');
  const coachSession = options.coachSession === undefined
    ? ''
    : `coach_session: ${options.coachSession}\n`;
  return `---
id: strict-plan
kind: ${options.kind ?? 'plan'}
status: ${options.status ?? 'active'}
${coachSession}---
${options.missingTitle ? '' : '# Strict Plan'}
${options.duplicateTitle ? '\n# Duplicate title\n' : ''}
${sections}
${options.extra ?? ''}
`;
}

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

test('rejects every missing or empty required Plan section', () => {
  for (const heading of requiredPlanSections) {
    const root = makeLearningSet();
    writeFileSync(
      join(root, 'plans/strict-plan.md'),
      strictPlanSource({ omit: heading }),
    );
    expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
      `PLAN_SECTION_REQUIRED: plans/strict-plan.md#${heading.toLowerCase().replaceAll(' ', '-')}`,
    );

    writeFileSync(
      join(root, 'plans/strict-plan.md'),
      strictPlanSource({ empty: heading }),
    );
    expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
      `PLAN_SECTION_REQUIRED: plans/strict-plan.md#${heading.toLowerCase().replaceAll(' ', '-')}`,
    );
  }
});

test('rejects duplicate Plan structure and invalid frontmatter', () => {
  const root = makeLearningSet();
  const path = join(root, 'plans/strict-plan.md');

  writeFileSync(path, strictPlanSource({ duplicate: 'Planning Basis' }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'PLAN_SECTION_DUPLICATE: plans/strict-plan.md#planning-basis',
  );

  writeFileSync(path, strictPlanSource({ duplicateTitle: true }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'PLAN_TITLE_DUPLICATE: plans/strict-plan.md',
  );

  writeFileSync(path, strictPlanSource({ missingTitle: true }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'PLAN_TITLE_REQUIRED: plans/strict-plan.md',
  );

  writeFileSync(path, strictPlanSource({ kind: 'lesson' }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'INVALID_PLAN_KIND: plans/strict-plan.md',
  );

  writeFileSync(path, strictPlanSource({ status: 'prepared' }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'INVALID_PLAN_STATUS: plans/strict-plan.md',
  );

  writeFileSync(path, strictPlanSource({ coachSession: '[]' }));
  expect(() => readMarkdownFile(root, 'plans/strict-plan.md')).toThrow(
    'INVALID_PLAN_COACH_SESSION: plans/strict-plan.md',
  );
});

test('accepts extra Plan sections and ignores fenced fake headings', () => {
  const root = makeLearningSet();
  writeFileSync(
    join(root, 'plans/strict-plan.md'),
    strictPlanSource({
      reverse: true,
      extra: '\n## Optional Analysis\n\n```md\n## Planning Basis\n\nfake\n```\n',
    }),
  );
  expect(readMarkdownFile(root, 'plans/strict-plan.md')).toMatchObject({
    id: 'strict-plan',
    frontmatter: { kind: 'plan', status: 'active' },
  });
});
