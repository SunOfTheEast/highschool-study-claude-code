import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import { setFrontmatterField } from '../../src/runtime/frontmatter';
import type { PiSessionFact } from '../../src/runtime/session-owner';
import type { StudySessionFactory } from '../../src/runtime/session-factory';
import { WorkspaceRegistry } from '../../src/runtime/workspace-registry';
import {
  planLearningNoteSave,
  planProblemCardSave,
  readLearningNote,
} from '../../src/study/learning-assets';
import {
  readLearningFootprint,
  type OwnedLearningSessionFact,
} from '../../src/study/learning-footprint';
import { importMaterial } from '../../src/study/materials';
import { recordProblemAttempt, revealProblemAnswer } from '../../src/study/problem-attempts';
import { recordAssetReviewEvent } from '../../src/study/asset-reviews';

const blankFixture = join(import.meta.dir, '../fixtures/m1b-blank-learning-set');
const courseFixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

function copyFixture(fixture = blankFixture): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m1c-footprint-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('projects existing sessions, assets, activity, materials, and learning history without judgments', async () => {
  const root = copyFixture();
  commitDocumentCandidates(root, planLearningNoteSave(root, 'free-001', {
    title: 'Ksp 中的纯固体',
    blocks: [{ kind: 'markdown', body: '纯固体的活度并入平衡常数。' }],
    sources: [],
    tags: { core: ['沉淀溶解平衡'], related: ['纯固体'] },
  }, '2026-08-09T10:00:00.000Z').candidates);
  const note = readLearningNote(root, 'note-001');
  commitDocumentCandidates(root, planLearningNoteSave(root, 'free-001', {
    target: { id: note.id, expectedRevision: note.revision },
    title: 'Ksp 中的纯固体与活度',
    blocks: [{ kind: 'markdown', body: '纯固体活度取定值，因此不写进浓度乘积。' }],
    sources: note.sources,
  }, '2026-08-09T12:00:00.000Z').candidates);

  commitDocumentCandidates(root, planProblemCardSave(root, 'free-001', {
    stem: '加入 NaCl 后，AgCl 沉淀会怎样变化？',
    standardAnswer: '离子积先增大，随后析出至重新平衡。',
    teacherRationale: '区分瞬时离子积和不变的 Ksp。',
    studentNote: '',
    sources: [],
    tags: { core: ['沉淀溶解平衡'], related: ['同离子效应'] },
  }, '2026-08-09T11:00:00.000Z').candidates);
  recordProblemAttempt(
    root,
    'problem-001',
    { kind: 'cannot' },
    'attempt-001',
    '2026-08-09T12:09:00.000Z',
  );
  revealProblemAnswer(root, 'problem-001', 'reveal-001', '2026-08-09T12:10:00.000Z');

  const noteReview = recordAssetReviewEvent(root, { kind: 'note', id: 'note-001' }, {
    requestId: 'note-review-001',
    at: '2026-08-10T08:00:00.000Z',
    localDate: '2026-08-10',
    event: {
      kind: 'reviewed', assetRevision: 2, result: 'forgot',
      evidence: { kind: 'self-report', problemAttemptId: null },
    },
  });
  recordAssetReviewEvent(root, { kind: 'note', id: 'note-001' }, {
    requestId: 'note-review-correction',
    at: '2026-08-10T08:05:00.000Z',
    localDate: '2026-08-10',
    event: {
      kind: 'corrected', targetEventId: noteReview.event.eventId, replacementResult: 'fluent',
    },
  });
  const cardReview = recordAssetReviewEvent(root, { kind: 'problem-card', id: 'problem-001' }, {
    requestId: 'card-review-001',
    at: '2026-08-10T09:00:00.000Z',
    localDate: '2026-08-10',
    event: {
      kind: 'reviewed', assetRevision: 1, result: 'effortful',
      evidence: { kind: 'self-report', problemAttemptId: 'attempt-001' },
    },
  });
  recordAssetReviewEvent(root, { kind: 'problem-card', id: 'problem-001' }, {
    requestId: 'card-review-correction',
    at: '2026-08-10T09:05:00.000Z',
    localDate: '2026-08-10',
    event: {
      kind: 'corrected', targetEventId: cardReview.event.eventId, replacementResult: null,
    },
  });

  const material = await importMaterial(root, {
    requestId: 'material-request-001',
    title: '化学反应原理摘录',
    filename: 'chapter.md',
    mediaType: 'text/markdown',
    bytes: new TextEncoder().encode('Ksp 与纯固体活度。'),
  }, '2026-08-09T09:30:00.000Z');
  await importMaterial(root, {
    requestId: 'material-request-002',
    target: { id: material.id, expectedRevision: 1 },
    title: '化学反应原理摘录（修订）',
    filename: 'chapter.md',
    mediaType: 'text/markdown',
    bytes: new TextEncoder().encode('补充平衡移动的边界。'),
  }, '2026-08-09T12:30:00.000Z');

  mkdirSync(join(root, 'cards/legacy'), { recursive: true });
  writeFileSync(join(root, 'cards/legacy/legacy.card.yaml'), stringifyYaml({
    schema: 'highschool-study.problem-card.v1',
    content_item_id: 'legacy-card恒成立',
    content_revision_id: 'legacy-card恒成立-r1',
    storage_uri: 'cards/legacy/legacy.card.yaml',
    stem: '一道没有可信创建时间的旧题。',
    answer: '旧答案。',
  }));

  mkdirSync(join(root, 'memory/objects'), { recursive: true });
  writeFileSync(join(root, 'memory/objects/obj-001.md'), [
    '# obj-001：沉淀溶解平衡',
    '',
    '## Current Judgment',
    '',
    '这是教师私有的当前判断，不得进入学生足迹。',
    '',
    '## Evolution Overview',
    '',
    '从只背公式到开始追问固体的地位。',
    '',
    '## Learning History',
    '',
    '- 2026-08-09T12:40:00.000Z — 学生主动把 Ksp 与纯固体活度联系起来。',
    '  - 来源：原生自由学习 Session `free-001`',
    '- 2026-08-09T13:00:00.000Z — 在陌生情境中重新解释了固体为何不写入浓度乘积。',
    '  - 来源：[lesson-001](../../plans/plan-001/lessons/lesson-001.md) — Block `block-002`',
    '',
    '## Boundaries / Not Yet Demonstrated',
    '',
    '- 尚未检验复杂离子共存情境。',
    '',
  ].join('\n'));

  const sessions: OwnedLearningSessionFact[] = [{
    id: 'free-001',
    title: '自由学习',
    createdAt: '2026-08-09T09:00:00.000Z',
    entryTimes: [
      '2026-08-09T09:00:10.000Z',
      '2026-08-09T09:05:00.000Z',
    ],
    owner: {
      sessionKind: 'free-learning',
      title: '自由学习',
      createdAt: '2026-08-09T09:00:00.000Z',
      selectedAssets: [],
    },
    status: 'ended',
  }];
  const footprint = readLearningFootprint(root, sessions);
  const serialized = JSON.stringify(footprint);

  expect(footprint.entries.filter((entry) => entry.activity === 'asset-review')).toEqual([
    expect.objectContaining({
      id: `asset-review:note:note-001:${noteReview.event.eventId}`,
      at: '2026-08-10T08:00:00.000Z',
      title: 'Ksp 中的纯固体与活度',
      summary: '复习结果：顺利想起',
      route: '/assets/notes/note-001',
      source: expect.objectContaining({
        kind: 'asset-review', result: 'fluent', eventId: noteReview.event.eventId,
      }),
    }),
  ]);
  expect(serialized).not.toMatch(/enrolled|removed|restarted|corrected/);

  expect(footprint.entries.find((entry) => entry.activity === 'learning-history')).toMatchObject({
    activity: 'learning-history',
    at: '2026-08-09T13:00:00.000Z',
    title: '沉淀溶解平衡',
    route: '/course/plan/plan-001/lesson/lesson-001',
    summary: '在陌生情境中重新解释了固体为何不写入浓度乘积。',
  });
  expect(footprint.entries).toContainEqual(expect.objectContaining({
    activity: 'asset-revised',
    at: '2026-08-09T12:00:00.000Z',
    route: '/assets/notes/note-001',
    source: expect.objectContaining({ kind: 'asset', revision: 2 }),
  }));
  expect(footprint.entries).toContainEqual(expect.objectContaining({
    activity: 'material-imported',
    at: '2026-08-09T12:30:00.000Z',
    route: '/assets/materials/material-001',
    source: expect.objectContaining({ kind: 'material', revision: 2 }),
  }));
  expect(footprint.entries).toContainEqual(expect.objectContaining({
    activity: 'problem-attempt',
    at: '2026-08-09T12:09:00.000Z',
  }));
  expect(footprint.entries).toContainEqual(expect.objectContaining({
    activity: 'answer-reveal',
    at: '2026-08-09T12:10:00.000Z',
  }));
  expect(footprint.entries).toContainEqual(expect.objectContaining({
    activity: 'session-start',
    at: '2026-08-09T09:00:00.000Z',
    route: '/learn/free-001',
  }));
  expect(footprint.entries).toContainEqual(expect.objectContaining({
    activity: 'session-continue',
    at: '2026-08-09T09:05:00.000Z',
    route: '/learn/free-001',
  }));
  expect(footprint.entries.at(-1)).toMatchObject({
    activity: 'asset-created',
    at: null,
    title: '一道没有可信创建时间的旧题。',
    route: '/assets/problem-cards/legacy-card%E6%81%92%E6%88%90%E7%AB%8B',
  });
  expect(serialized).not.toContain('教师私有的当前判断');
  expect(serialized).not.toContain('尚未检验复杂离子共存情境');
  expect(readdirSync(root).some((name) => name.startsWith('footprint.'))).toBeFalse();
  expect(existsSync(join(root, 'footprint.json'))).toBeFalse();
});

test('registry exposes only current, verified owners with canonical node status', async () => {
  const root = copyFixture(courseFixture);
  setFrontmatterField(
    root,
    'plans/plan-001/PLAN.md',
    'session_id',
    'plan-session',
    null,
  );
  const validPlanOwner = {
    nodeKind: 'plan' as const,
    nodeId: 'plan-001',
    nodePath: 'plans/plan-001/PLAN.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  };
  const raw: PiSessionFact[] = [
    {
      id: 'plan-session',
      title: 'untrusted header title',
      createdAt: '2026-08-09T08:00:00.000Z',
      entryTimes: ['2026-08-09T08:05:00.000Z'],
      owner: validPlanOwner,
      endedAt: null,
    },
    {
      id: 'stale-session',
      title: 'stale',
      createdAt: '2026-08-09T07:00:00.000Z',
      entryTimes: [],
      owner: { ...validPlanOwner, nodePath: 'plans/other/PLAN.md' },
      endedAt: null,
    },
    {
      id: 'free-session',
      title: '自由学习',
      createdAt: '2026-08-09T09:00:00.000Z',
      entryTimes: ['2026-08-09T09:03:00.000Z'],
      owner: {
        sessionKind: 'free-learning',
        title: '自由学习',
        createdAt: '2026-08-09T09:00:00.000Z',
        selectedAssets: [],
      },
      endedAt: '2026-08-09T09:04:00.000Z',
    },
  ];
  const factory: StudySessionFactory = async () => {
    throw new Error('factory should not be called');
  };
  const registry = new WorkspaceRegistry(
    root,
    factory,
    undefined,
    undefined,
    undefined,
    async () => [],
    undefined,
    async () => [],
    async () => raw,
  );

  expect(await registry.listOwnedSessionFacts()).toEqual([
    expect.objectContaining({
      id: 'plan-session',
      title: 'Plan 001：恒成立问题选路',
      owner: validPlanOwner,
      status: 'active',
      entryTimes: ['2026-08-09T08:05:00.000Z'],
    }),
    expect.objectContaining({
      id: 'free-session',
      title: '自由学习',
      status: 'ended',
    }),
  ]);
});
