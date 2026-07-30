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
import {
  appendTrace,
  renderHandoff,
  renderSourceOnlyHandoff,
} from 'highschool-study-markdown/study-domain';
import type { MemoryReviewItem } from '../../src/memory-review/contracts';
import { renderProfileDocument } from '../../src/memory-review/profile-document';
import { validateMemoryReviewItems } from '../../src/memory-review/source-validation';
import type { SessionEvidenceReader } from '../../src/study/evidence-tree';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const roots: string[] = [];
const noSessions: SessionEvidenceReader = { read: () => null };

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function replaceHandoff(source: string, handoff: string): string {
  return `${source.replace(/\n## Handoff[\s\S]*$/, '').trimEnd()}\n\n${handoff}`;
}

function fixture(options: {
  planStatus?: 'active' | 'completed';
  planHandoff?: 'claims' | 'source-only';
} = {}): string {
  const root = mkdtempSync(join(tmpdir(), 'memory-review-source-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });

  const lessonPath = join(root, 'lessons/lesson-001.md');
  const lessonHandoff = renderHandoff({
    id: 'lesson-001/handoff',
    from: 'lesson:lesson-001',
    to: 'plan:domain-integrity',
    sealedAt: '2026-08-06T09:00:00.000Z',
  }, {
    learnerClaims: [{
      statement: '学生更适合先独立尝试。',
      scope: '本节独立训练。',
      sources: ['trace:trace-fixture-001'],
      boundary: '只在本节观察。',
      nextUse: '由 Plan 复盘是否跨课成立。',
    }],
    teachingClaims: [],
    openQuestions: [],
  });
  writeFileSync(
    lessonPath,
    replaceHandoff(readFileSync(lessonPath, 'utf8'), lessonHandoff),
  );

  const planPath = join(root, 'plans/domain-integrity.md');
  const planHandoff = options.planHandoff === 'source-only'
    ? renderSourceOnlyHandoff({
      id: 'domain-integrity/handoff',
      from: 'plan:domain-integrity',
      to: 'roadmap:roadmap',
      sealedAt: '2026-08-06T10:00:00.000Z',
    }, ['trace:trace-fixture-001'])
    : renderHandoff({
      id: 'domain-integrity/handoff',
      from: 'plan:domain-integrity',
      to: 'roadmap:roadmap',
      sealedAt: '2026-08-06T10:00:00.000Z',
    }, {
      learnerClaims: [{
        statement: '学生在本周期更适合先独立尝试。',
        scope: '当前 Roadmap 的训练课。',
        sources: ['claim:lesson-001/handoff#learner-c1'],
        boundary: '新概念首次接触时仍需另行观察。',
        nextUse: '作为学生偏好候选。',
      }],
      teachingClaims: [{
        statement: '训练课应先等待学生完成第一轮尝试。',
        scope: '当前 Roadmap 的训练课。',
        sources: ['trace:trace-fixture-002'],
        boundary: '讲授型新课不在此结论内。',
        nextUse: '作为教学偏好候选。',
      }],
      openQuestions: [],
    });
  const status = options.planStatus ?? 'completed';
  writeFileSync(
    planPath,
    replaceHandoff(
      readFileSync(planPath, 'utf8').replace('status: active', `status: ${status}`),
      planHandoff,
    ),
  );

  const studentPath = join(root, 'memory/student-profile.md');
  writeFileSync(studentPath, renderProfileDocument(
    readFileSync(studentPath, 'utf8'),
    'student',
    [{
      id: 'S1',
      content: '喜欢每一步都确认。',
      scope: '导数专题。',
      sources: ['plans/domain-integrity.md#plan-summary'],
      rationale: '旧阶段观察。',
      counterEvidence: '暂无。',
    }],
  ));
  const teachingPath = join(root, 'memory/teaching-profile.md');
  writeFileSync(teachingPath, renderProfileDocument(
    readFileSync(teachingPath, 'utf8'),
    'teaching',
    [{
      id: 'T1',
      content: '先给完整讲解。',
      scope: '训练和测评。',
      sources: ['plans/domain-integrity.md#plan-summary'],
      rationale: '旧阶段观察。',
      counterEvidence: '暂无。',
    }],
  ));
  return root;
}

function validItems(): MemoryReviewItem[] {
  return [
    {
      id: 'add-1',
      operation: 'add',
      owner: 'student',
      currentId: null,
      currentText: null,
      proposedText: '先独立尝试，再请求提示。',
      sources: ['claim:domain-integrity/handoff#learner-c1'],
      rationale: 'Plan 复盘确认该偏好跨课出现。',
      counterEvidence: '新概念课尚未核验。',
      scope: '当前 Roadmap 的训练课。',
    },
    {
      id: 'revise-1',
      operation: 'revise',
      owner: 'teaching',
      currentId: 'T1',
      currentText: '先给完整讲解。',
      proposedText: '先等待学生完成第一轮尝试。',
      sources: ['claim:domain-integrity/handoff#teaching-t1'],
      rationale: 'Plan 教学结论支持调整。',
      counterEvidence: '新概念示例课不适用。',
      scope: '训练和测评。',
    },
    {
      id: 'delete-1',
      operation: 'delete',
      owner: 'student',
      currentId: 'S1',
      currentText: '喜欢每一步都确认。',
      proposedText: null,
      sources: ['claim:domain-integrity/handoff#learner-c1'],
      rationale: '本周期结论不再支持逐步确认。',
      counterEvidence: '新概念课尚未核验。',
      scope: '导数专题。',
    },
  ];
}

test('accepts student and teaching candidates backed by matching completed Plan claims', () => {
  const root = fixture();
  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    validItems(),
    noSessions,
  )).not.toThrow();
});

test('rejects a Lesson claim even when its recursive evidence is active', () => {
  const root = fixture();
  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [{
      ...validItems()[0]!,
      sources: ['claim:lesson-001/handoff#learner-c1'],
    }],
    noSessions,
  )).toThrow('MEMORY_REVIEW_SOURCE_INVALID');
});

test('rejects a source-only Plan Handoff and an active Plan', () => {
  const sourceOnly = fixture({ planHandoff: 'source-only' });
  expect(() => validateMemoryReviewItems(
    sourceOnly,
    'domain-integrity',
    'plans/domain-integrity.md',
    [validItems()[0]!],
    noSessions,
  )).toThrow('MEMORY_REVIEW_PLAN_HANDOFF_REQUIRED');

  const active = fixture({ planStatus: 'active' });
  expect(() => validateMemoryReviewItems(
    active,
    'domain-integrity',
    'plans/domain-integrity.md',
    [validItems()[0]!],
    noSessions,
  )).toThrow('MEMORY_REVIEW_PLAN_NOT_COMPLETED');
});

test('rejects a candidate whose Plan claim was invalidated upstream', () => {
  const root = fixture();
  appendTrace(root, {
    lessonPath: 'lessons/lesson-001.md',
    blockId: 'block-002',
    cardAlias: 'Q-DOMAIN-EX11',
    cardStepId: 'step_4',
    materialPath: null,
    assessment: 'correct',
    support: 'none',
    note: '后续重新核验。',
    supersedes: 'trace-fixture-001',
    methods: null,
  }, () => new Date('2026-08-06T11:00:00.000Z'), () => (
    '00000003-1111-4111-8111-111111111111'
  ));

  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [validItems()[0]!],
    noSessions,
  )).toThrow('MEMORY_REVIEW_SOURCE_INVALIDATED');
});

test('requires the current profile ID and Content to match one real entry', () => {
  const root = fixture();
  const revise = validItems()[1]!;
  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [{ ...revise, currentId: 'T404' }],
    noSessions,
  )).toThrow('MEMORY_REVIEW_CURRENT_ENTRY_MISMATCH');
  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [{ ...revise, currentText: '过期内容。' }],
    noSessions,
  )).toThrow('MEMORY_REVIEW_CURRENT_ENTRY_MISMATCH');
});

test('rejects owner/claim-kind mismatch, duplicate IDs and malformed operation shapes', () => {
  const root = fixture();
  const items = validItems();
  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [{
      ...items[0]!,
      sources: ['claim:domain-integrity/handoff#teaching-t1'],
    }],
    noSessions,
  )).toThrow('MEMORY_REVIEW_SOURCE_KIND_MISMATCH');
  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [items[0]!, { ...items[0]! }],
    noSessions,
  )).toThrow('MEMORY_REVIEW_ITEM_ID_DUPLICATE: add-1');
  expect(() => validateMemoryReviewItems(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
    [{ ...items[0]!, currentId: 'S1' }],
    noSessions,
  )).toThrow('MEMORY_REVIEW_ADD_INVALID');
});
