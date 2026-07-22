import { expect, test } from 'bun:test';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { makeLearningSet } from '../helpers/learning-set';
import {
  listCanonicalMethodNames,
  resolveTraceMethods,
} from '../../server/src/method-vocabulary';

function writeNodeVocabulary(root: string): void {
  writeFileSync(join(root, 'graph/vocabulary.yaml'), `schema: highschool-study.taxonomy.v1
taxonomy_revision_id: taxonomy-conics-v1
nodes:
  - node_id: method.freeze-variable
    facet: method_cluster
    canonical_name: 冻结变量法
    aliases: [冻元法]
  - node_id: subroute.domain-check
    facet: method_subroute
    canonical_name: 定义域与可行域检查
    aliases: [定义域检查]
`);
}

function writeDerivativeVocabulary(root: string): void {
  writeFileSync(join(root, 'graph/vocabulary.yaml'), `schema: studyforge.learning_graph_vocabulary.derivative.v2
method_clusters:
  - 参变量分离
  - 同构变形与换元法
`);
  writeFileSync(join(root, 'graph/aliases.yaml'), `schema: studyforge.problem_aliases.v1
alias_groups:
  - id: parameter-separation
    aliases: [参数分离]
    maps_to:
      - layer: method
        value: 参变量分离
  - id: ambiguous-route
    aliases: [双路]
    maps_to:
      - layer: method
        value: 参变量分离
      - layer: method
        value: 同构变形与换元法
`);
}

test('resolves canonical names and node aliases across the taxonomy format', () => {
  const root = makeLearningSet();
  writeNodeVocabulary(root);

  expect(resolveTraceMethods(root, {
    primary: '冻元法',
    secondary: ['定义域检查', '冻结变量法'],
  })).toEqual({
    methods: {
      primary: '冻结变量法',
      secondary: ['定义域与可行域检查'],
    },
    unresolved: [],
  });
});

test('lists only canonical method names for the current learning set', () => {
  const root = makeLearningSet();
  writeDerivativeVocabulary(root);

  expect(new Set(listCanonicalMethodNames(root))).toEqual(new Set([
    '参变量分离',
    '同构变形与换元法',
  ]));
});

test('resolves unique derivative aliases and rejects ambiguous or unknown names', () => {
  const root = makeLearningSet();
  writeDerivativeVocabulary(root);

  expect(resolveTraceMethods(root, {
    primary: '参数分离',
    secondary: ['参变量分离'],
  })).toEqual({
    methods: { primary: '参变量分离', secondary: [] },
    unresolved: [],
  });

  expect(resolveTraceMethods(root, {
    primary: '双路',
  })).toEqual({ methods: null, unresolved: ['双路'] });

  expect(resolveTraceMethods(root, {
    primary: '不存在的方法',
  })).toEqual({ methods: null, unresolved: ['不存在的方法'] });
});

test('preserves a valid primary and valid secondary when another secondary is unresolved', () => {
  const root = makeLearningSet();
  writeDerivativeVocabulary(root);

  expect(resolveTraceMethods(root, {
    primary: '参数分离',
    secondary: ['同构变形与换元法', '定义域 a > 0'],
  })).toEqual({
    methods: {
      primary: '参变量分离',
      secondary: ['同构变形与换元法'],
    },
    unresolved: ['定义域 a > 0'],
  });
});
