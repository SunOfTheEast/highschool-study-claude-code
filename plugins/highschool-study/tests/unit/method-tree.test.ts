import { expect, test } from 'bun:test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSetWithLesson } from '../helpers/learning-set';
import { readMethodTree } from '../../server/src/method-tree';
import { listCards } from '../../server/src/cards';

function writeTree(root: string, body: string): void {
  mkdirSync(join(root, 'graph'), { recursive: true });
  writeFileSync(join(root, 'graph/method_tree.yaml'), body);
}

test('derives root and order while resolving non-root canonical methods', () => {
  const root = makeLearningSetWithLesson();
  writeTree(root, `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 圆锥曲线方法体系, parent_id: null }
  - { id: freeze, method: 冻结变量法, parent_id: methods }
  - { id: eliminate, method: 参数化与消元, parent_id: methods }
`);

  expect(readMethodTree(root)).toEqual({
    rootId: 'methods',
    nodes: [
      { id: 'methods', name: '圆锥曲线方法体系', parentId: null, order: 0 },
      { id: 'freeze', name: '冻结变量法', parentId: 'methods', order: 1 },
      { id: 'eliminate', name: '参数化与消元', parentId: 'methods', order: 2 },
    ],
  });
});

test('rejects duplicates, missing methods, missing parents and cycles', () => {
  const invalidTrees = [
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: methods, method: 冻结变量法, parent_id: methods }`,
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: a, method: 冻结变量法, parent_id: methods }
  - { id: b, method: 冻结变量法, parent_id: methods }`,
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: a, method: 冻结变量法, parent_id: methods }`,
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: a, method: 冻结变量法, parent_id: missing }`,
    `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: a, method: 冻结变量法, parent_id: b }
  - { id: b, method: 参数化与消元, parent_id: a }`,
  ];
  for (const body of invalidTrees) {
    const root = makeLearningSetWithLesson();
    writeTree(root, body);
    expect(() => readMethodTree(root)).toThrow('METHOD_TREE_INVALID');
  }
});

test('does not promote card-local subroutes into formal nodes', () => {
  const root = makeLearningSetWithLesson();
  writeTree(root, `schema: studyforge.method_tree.v1
nodes:
  - { id: methods, root_label: 根, parent_id: null }
  - { id: freeze, method: 冻结变量法, parent_id: methods }
  - { id: eliminate, method: 参数化与消元, parent_id: methods }
`);
  expect(readMethodTree(root).nodes.map((node) => node.name))
    .not.toContain('先冻结目标量再检查定义域');
});

test('normalizes card-linked materials without exposing card internals', () => {
  const root = makeLearningSetWithLesson();
  writeFileSync(join(root, 'cards/conics/material-ref.card.yaml'), `schema: highschool-study.problem-card.v1
content_item_id: material-ref
stem: 材料引用测试
graph:
  goal: { primary: 极值最值 }
  method:
    primary: 冻结变量法
    secondary: []
source_evidence:
  source_refs:
    - materials/math/conics/page_001.md:12-18
    - { path: materials/math/conics/page_001.md, role: local_context }
  source_images:
    - { path: materials/math/conics/page_001.png }
`);
  const card = listCards(root).find((item) => (
    item.path.endsWith('material-ref.card.yaml')
  ))!;
  expect(card.materials).toEqual([
    {
      path: 'materials/math/conics/page_001.md',
      label: 'page_001.md',
      kind: 'text',
    },
    {
      path: 'materials/math/conics/page_001.png',
      label: 'page_001.png',
      kind: 'image',
    },
  ]);
  expect(JSON.stringify(card.materials)).not.toContain('answer');
});
