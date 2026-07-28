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
import { appendTrace } from 'highschool-study-markdown/study-domain';
import type { MemoryReviewItem } from '../../src/memory-review/contracts';
import { validateMemoryReviewItems } from '../../src/memory-review/source-validation';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function completedFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'memory-review-source-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  const planPath = join(root, 'plans/domain-integrity.md');
  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace('status: active', 'status: completed'),
  );
  writeFileSync(
    join(root, 'memory/student-profile.md'),
    `${readFileSync(join(root, 'memory/student-profile.md'), 'utf8')}\n- 喜欢每一步都确认。\n`,
  );
  writeFileSync(
    join(root, 'memory/teaching-profile.md'),
    `${readFileSync(join(root, 'memory/teaching-profile.md'), 'utf8')}\n- 先给完整讲解。\n`,
  );
  return root;
}

function validItems(): MemoryReviewItem[] {
  return [
    {
      id: 'add-1',
      operation: 'add',
      owner: 'student',
      currentText: null,
      proposedText: '先独立尝试，再请求提示。',
      sources: [
        'lessons/lesson-001.md#trace-event-001',
        'lessons/lesson-001.md#block-step-02',
      ],
      rationale: '在课堂记录中反复出现。',
      counterEvidence: '目前没有相反记录。',
      scope: '独立练习题。',
    },
    {
      id: 'revise-1',
      operation: 'revise',
      owner: 'teaching',
      currentText: '先给完整讲解。',
      proposedText: '先等待学生完成第一轮尝试。',
      sources: ['lessons/lesson-001.md#lesson-summary'],
      rationale: '等待后作答更完整。',
      counterEvidence: '新概念示例课不适用。',
      scope: '训练和测评。',
    },
    {
      id: 'delete-1',
      operation: 'delete',
      owner: 'student',
      currentText: '喜欢每一步都确认。',
      proposedText: null,
      sources: ['plans/domain-integrity.md#plan-summary'],
      rationale: '本阶段记录已不再支持。',
      counterEvidence: '暂无。',
      scope: '导数专题。',
    },
  ];
}

test('accepts source-linked add, revise, and delete candidates in the owned Plan', () => {
  const root = completedFixture();

  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    validItems(),
  )).not.toThrow();
});

test('rejects missing, cross-Plan, duplicate, and stale Trace sources', () => {
  const root = completedFixture();
  const items = validItems();

  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [{ ...items[0]!, sources: ['lessons/missing.md#trace-event-404'] }],
  )).toThrow('MEMORY_REVIEW_SOURCE_INVALID');

  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [items[0]!, { ...items[0]! }],
  )).toThrow('MEMORY_REVIEW_ITEM_ID_DUPLICATE: add-1');

  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'step-02',
    cardAlias: 'Q-DOMAIN-EX11',
    cardStepId: 'step_4',
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: '后续独立更正。',
    supersedes: 'event-001',
    methods: null,
  }, () => new Date('2026-07-28T00:00:00.000Z'));

  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [{ ...items[0]!, sources: ['lessons/lesson-001.md#trace-event-001'] }],
  )).toThrow('MEMORY_REVIEW_SOURCE_INVALID');
});

test('rejects invalid operation shapes and profile text that is not current', () => {
  const root = completedFixture();
  const items = validItems();

  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [{ ...items[0]!, currentText: '不应存在' }],
  )).toThrow('MEMORY_REVIEW_ADD_INVALID');

  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [{ ...items[1]!, currentText: '不存在的旧画像条目' }],
  )).toThrow('MEMORY_REVIEW_CURRENT_TEXT_NOT_FOUND');
});
