import { afterEach, expect, test } from 'bun:test';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { stringify as stringifyYaml } from 'yaml';
import { commitDocumentCandidates } from '../../src/runtime/multi-document-transaction';
import {
  planLearningNoteSave,
  planProblemCardSave,
} from '../../src/study/learning-assets';
import {
  buildSemanticRecallIndex,
  projectSemanticRelations,
  querySemanticRecall,
  readSemanticRecallRows,
} from '../../src/study/semantic-index';

const roots: string[] = [];

function learningSet(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-semantic-index-'));
  mkdirSync(join(root, 'cards/legacy'), { recursive: true });
  mkdirSync(join(root, 'memory/objects'), { recursive: true });
  mkdirSync(join(root, 'memory/indexes'), { recursive: true });
  roots.push(root);
  return root;
}

function writeLegacyCard(root: string): void {
  writeFileSync(join(root, 'cards/legacy/legacy-001.card.yaml'), stringifyYaml({
    schema: 'highschool-study.problem-card.v1',
    content_item_id: 'legacy-恒成立',
    content_revision_id: 'legacy-恒成立-r1',
    storage_uri: 'cards/legacy/legacy-001.card.yaml',
    stem: '含绝对值的三次函数参数题。',
    answer: '不应进入召回索引的答案。',
    teacher_rationale: '不应进入召回索引的教师依据。',
    graph: {
      goal: {
        primary: '求参数范围',
        part_level: [{ part_id: '1', goal: '不等式证明' }],
      },
      method: {
        primary: '自由度与主元',
        secondary: ['参变量分离'],
        subroute: ['参数主元'],
      },
      structure: {
        primary: '三次/高次函数结构',
        secondary: ['Max/Min 与绝对值结构'],
      },
    },
  }, { lineWidth: 0 }));
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('projects new flat tags and legacy graph metadata into one safe recall surface', () => {
  const root = learningSet();
  writeLegacyCard(root);

  const card = planProblemCardSave(root, 'session-001', {
    stem: '解释 Ksp 表达式中为什么不写纯固体。',
    standardAnswer: '纯固体活度并入平衡常数。',
    teacherRationale: '教师依据秘密。',
    studentNote: '学生笔记秘密。',
    sources: [],
    tags: { core: ['沉淀溶解平衡'], related: ['固体活度'] },
  }, '2026-08-09T08:00:00.000Z');
  commitDocumentCandidates(root, card.candidates);

  const note = planLearningNoteSave(root, 'session-001', {
    title: 'Ksp 中纯固体的位置',
    blocks: [{ kind: 'markdown', body: '笔记正文秘密。' }],
    sources: [{ kind: 'problem-card', id: card.card.id, revision: 1 }],
    tags: { core: ['平衡常数'], related: ['固体活度'] },
  }, '2026-08-09T08:10:00.000Z');
  commitDocumentCandidates(root, note.candidates);

  const rows = readSemanticRecallRows(root);
  expect(rows).toHaveLength(3);
  expect(rows.find((row) => row.id === 'legacy-恒成立')).toMatchObject({
    core: ['求参数范围', '自由度与主元', '三次/高次函数结构'],
    related: ['不等式证明', '参变量分离', '参数主元', 'Max/Min 与绝对值结构'],
  });
  expect(rows.find((row) => row.id === 'problem-001')).toMatchObject({
    core: ['沉淀溶解平衡'],
    related: ['固体活度'],
  });
  expect(rows.find((row) => row.id === 'note-001')?.titleOrStem)
    .toBe('Ksp 中纯固体的位置');

  const tsv = buildSemanticRecallIndex(root);
  expect(tsv).not.toContain('不应进入召回索引的答案');
  expect(tsv).not.toContain('教师依据秘密');
  expect(tsv).not.toContain('学生笔记秘密');
  expect(tsv).not.toContain('笔记正文秘密');
  expect(buildSemanticRecallIndex(root)).toBe(tsv);
});

test('keeps method-only legacy cards readable by the student relation projection', () => {
  const root = learningSet();
  writeFileSync(join(root, 'cards/legacy/method-only.card.yaml'), stringifyYaml({
    schema: 'highschool-study.problem-card.v1',
    content_item_id: 'method-only',
    storage_uri: 'cards/legacy/method-only.card.yaml',
    stem: '设函数 f(x)=e^x-ax，讨论其最小值。',
    graph: {
      method: {
        primary: '参变量分离',
        secondary: ['同构变形与换元法'],
      },
    },
  }, { lineWidth: 0 }));

  expect(readSemanticRecallRows(root)).toEqual([expect.objectContaining({
    id: 'method-only',
    core: ['参变量分离'],
    related: ['同构变形与换元法'],
  })]);
  expect(projectSemanticRelations(root)).toContainEqual({
    kind: 'asset-tag',
    asset: { kind: 'problem-card', id: 'method-only' },
    tag: '参变量分离',
    role: 'core',
  });
});

test('projects legacy card relations from the recall index without reopening the card shelf', () => {
  const root = learningSet();
  writeLegacyCard(root);
  mkdirSync(join(root, 'semantics/indexes'), { recursive: true });
  writeFileSync(
    join(root, 'semantics/indexes/asset-recall.tsv'),
    buildSemanticRecallIndex(root),
  );
  writeFileSync(join(root, 'cards/legacy/legacy-001.card.yaml'), 'not: [valid');

  expect(projectSemanticRelations(root)).toContainEqual({
    kind: 'asset-tag',
    asset: { kind: 'problem-card', id: 'legacy-恒成立' },
    tag: '自由度与主元',
    role: 'core',
  });
});

test('returns only the requested quantity and derives relations from canonical facts', () => {
  const root = learningSet();
  const first = planProblemCardSave(root, 'session-001', {
    stem: '题目一。',
    standardAnswer: '答案一。',
    teacherRationale: '依据一。',
    studentNote: '',
    sources: [],
    tags: { core: ['沉淀溶解平衡'], related: ['平衡常数'] },
  }, '2026-08-09T08:00:00.000Z');
  commitDocumentCandidates(root, first.candidates);
  const second = planProblemCardSave(root, 'session-001', {
    stem: '题目二。',
    standardAnswer: '答案二。',
    teacherRationale: '依据二。',
    studentNote: '',
    sources: [{ kind: 'problem-card', id: first.card.id, revision: 1 }],
    tags: { core: ['沉淀溶解平衡'], related: ['固体活度'] },
  }, '2026-08-09T08:10:00.000Z');
  commitDocumentCandidates(root, second.candidates);

  writeFileSync(join(root, 'memory/objects/obj-001.md'), [
    '# obj-001：沉淀溶解平衡',
    '',
    '## Current Judgment',
    '',
    '只用于教师判断，不进入召回行。',
    '',
  ].join('\n'));
  writeFileSync(join(root, 'memory/indexes/chemical-equilibrium.md'), [
    '# chemical-equilibrium：化学平衡',
    '',
    '## Objects',
    '',
    '- [obj-001](../objects/obj-001.md)',
    '',
  ].join('\n'));

  const result = querySemanticRecall(root, {
    terms: ['沉淀溶解平衡'],
    limit: 1,
    allowRelatedExpansion: false,
  });
  expect(result.candidates).toHaveLength(1);
  expect(result.matched).toBe(2);

  const relations = projectSemanticRelations(root);
  expect(relations).toContainEqual({
    kind: 'asset-source',
    asset: { kind: 'problem-card', id: 'problem-002' },
    source: { kind: 'problem-card', id: 'problem-001', revision: 1 },
  });
  expect(relations).toContainEqual({
    kind: 'tag-neighbor',
    left: '平衡常数',
    right: '沉淀溶解平衡',
    weight: 1,
  });
  expect(relations).toContainEqual({
    kind: 'object-anchor',
    objectId: 'obj-001',
    title: '沉淀溶解平衡',
    tag: '沉淀溶解平衡',
  });
  expect(relations).toContainEqual({
    kind: 'object-bucket',
    objectId: 'obj-001',
    bucketId: 'chemical-equilibrium',
    title: '化学平衡',
  });

  const index = buildSemanticRecallIndex(root);
  mkdirSync(join(root, 'semantics/indexes'), { recursive: true });
  writeFileSync(join(root, 'semantics/indexes/asset-recall.tsv'), 'stale');
  rmSync(join(root, 'semantics/indexes'), { recursive: true });
  expect(buildSemanticRecallIndex(root)).toBe(index);
  expect(readFileSync(join(root, 'cards/m1b/problem-002.card.yaml'), 'utf8'))
    .toContain('problem-001');
});
