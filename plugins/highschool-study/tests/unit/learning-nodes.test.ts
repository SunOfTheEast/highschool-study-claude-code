import { expect, test } from 'bun:test';
import {
  applyCandidateChanges,
  nextCandidateHandle,
  parseChildTree,
  renderChildTree,
  type ChildTree,
} from '../../server/src/learning-nodes';

const lessonTree = `# Plan

## Lesson Tree

### Candidate lesson-candidate-001

- Public purpose: 比较两条路线的计算代价
- After:
- Depends on:
- Consider when: 学生能提出两条路线但仍无法稳定取舍
- Sources:
  - claim:lesson-002/handoff#learner-c1
- Private note: 保持题型不变，只改变路线成本差

### Child lesson-candidate-002

- Node: [陌生结构中的路线选择](../lessons/lesson-003.md)
- Public purpose: 在陌生外壳下先比较路线再计算
- After: lesson-candidate-001
- Depends on: lesson-candidate-001
- Consider when: 前一课已经完成同题型比较
- Sources:
  - claim:lesson-002/handoff#teaching-t1
- Private note: 不在课前公开候选方法名

## Current Position

正在比较路线。
`;

test('parses candidates and materialized children from the required tree section', () => {
  const tree = parseChildTree(
    lessonTree,
    'Lesson Tree',
    'lesson',
    'plans/plan-001.md',
  );

  expect(tree.entries[0]?.state).toBe('candidate');
  expect(tree.entries[1]).toMatchObject({
    state: 'materialized',
    handle: 'lesson-candidate-002',
    childId: 'lesson-003',
    childPath: 'lessons/lesson-003.md',
    title: '陌生结构中的路线选择',
  });
});

test('rejects legacy or missing tree sections instead of reading old structures', () => {
  const oldBody = `# Plan

## Lesson Index

- [Lesson 003](../lessons/lesson-003.md)
`;
  expect(() => parseChildTree(
    oldBody,
    'Lesson Tree',
    'lesson',
    'plans/plan-001.md',
  )).toThrow('NODE_TREE_SECTION_REQUIRED');

  const oldRoadmap = `# Roadmap

## Plan Graph

- [Plan 001](plans/plan-001.md)
`;
  expect(() => parseChildTree(
    oldRoadmap,
    'Plan Tree',
    'plan',
    'ROADMAP.md',
  )).toThrow('NODE_TREE_SECTION_REQUIRED');
});

test('rejects duplicate handles and invalid local references', () => {
  const duplicate = lessonTree.replace(
    '### Child lesson-candidate-002',
    '### Child lesson-candidate-001',
  );
  expect(() => parseChildTree(
    duplicate,
    'Lesson Tree',
    'lesson',
    'plans/plan-001.md',
  )).toThrow('NODE_TREE_HANDLE_DUPLICATE');

  for (const source of [
    lessonTree.replace(
      '- After: lesson-candidate-001',
      '- After: lesson-candidate-999',
    ),
    lessonTree.replace(
      '- Depends on: lesson-candidate-001',
      '- Depends on: lesson-candidate-999',
    ),
    lessonTree.replace(
      '- Depends on: lesson-candidate-001',
      '- Depends on: lesson-candidate-002',
    ),
  ]) {
    expect(() => parseChildTree(
      source,
      'Lesson Tree',
      'lesson',
      'plans/plan-001.md',
    )).toThrow('NODE_TREE_REFERENCE_INVALID');
  }
});

test('enforces candidate and child node boundaries', () => {
  const candidateWithNode = lessonTree.replace(
    '- Public purpose: 比较两条路线的计算代价',
    [
      '- Node: [不应存在](../lessons/lesson-999.md)',
      '- Public purpose: 比较两条路线的计算代价',
    ].join('\n'),
  );
  expect(() => parseChildTree(
    candidateWithNode,
    'Lesson Tree',
    'lesson',
    'plans/plan-001.md',
  )).toThrow('NODE_TREE_ENTRY_INVALID');

  for (const badNode of [
    '- Node: 陌生结构中的路线选择',
    '- Node: [陌生结构中的路线选择](https://example.com/lesson.md)',
    '- Node: [陌生结构中的路线选择](../../outside.md)',
    '- Node: [陌生结构中的路线选择](../lessons/not-markdown.txt)',
  ]) {
    const source = lessonTree.replace(
      '- Node: [陌生结构中的路线选择](../lessons/lesson-003.md)',
      badNode,
    );
    expect(() => parseChildTree(
      source,
      'Lesson Tree',
      'lesson',
      'plans/plan-001.md',
    )).toThrow('NODE_TREE_ENTRY_INVALID');
  }
});

test('round-trips canonical trees and allocates the next parent-local handle', () => {
  const tree = parseChildTree(
    lessonTree,
    'Lesson Tree',
    'lesson',
    'plans/plan-001.md',
  );
  const rendered = renderChildTree(
    'Lesson Tree',
    tree,
    'plans/plan-001.md',
  );

  expect(parseChildTree(
    rendered,
    'Lesson Tree',
    'lesson',
    'plans/plan-001.md',
  )).toEqual(tree);
  expect(nextCandidateHandle(tree)).toBe('lesson-candidate-003');
});

test('renders an empty tree with a non-empty canonical placeholder', () => {
  const tree: ChildTree = {
    kind: 'lesson',
    entries: [],
  };
  const rendered = renderChildTree(
    'Lesson Tree',
    tree,
    'plans/plan-001.md',
  );

  expect(rendered).toContain('（尚未编排 Lesson。）');
  expect(parseChildTree(
    rendered,
    'Lesson Tree',
    'lesson',
    'plans/plan-001.md',
  )).toEqual(tree);
});

test('patches candidates without mutating materialized children', () => {
  const original = parseChildTree(
    lessonTree,
    'Lesson Tree',
    'lesson',
    'plans/plan-001.md',
  );
  const added = applyCandidateChanges(original, [{
    action: 'add',
    candidate: {
      publicPurpose: '检查能否迁移到新题型',
      after: 'lesson-candidate-002',
      dependsOn: ['lesson-candidate-002'],
      considerWhen: '前两节课均已结束',
      sources: ['claim:lesson-003/handoff#learner-c1'],
      privateNote: '只改变题型外壳',
    },
  }]);
  expect(added.entries.at(-1)).toMatchObject({
    state: 'candidate',
    handle: 'lesson-candidate-003',
  });

  const revised = applyCandidateChanges(added, [{
    action: 'revise',
    handle: 'lesson-candidate-001',
    candidate: {
      publicPurpose: '比较三条路线的计算代价',
      after: null,
      dependsOn: [],
      considerWhen: '学生已经能稳定提出两条路线',
      sources: ['claim:lesson-002/handoff#learner-c1'],
      privateNote: '增加一条明显较差路线',
    },
  }]);
  expect(revised.entries[0]).toMatchObject({
    publicPurpose: '比较三条路线的计算代价',
  });

  const removed = applyCandidateChanges(revised, [{
    action: 'remove',
    handle: 'lesson-candidate-003',
  }]);
  expect(removed.entries.some(
    (entry) => entry.handle === 'lesson-candidate-003',
  )).toBe(false);
  expect(original.entries[0]).toMatchObject({
    publicPurpose: '比较两条路线的计算代价',
  });

  for (const change of [
    {
      action: 'revise' as const,
      handle: 'lesson-candidate-002',
      candidate: {
        publicPurpose: '越权改写',
        after: null,
        dependsOn: [],
        considerWhen: '不允许',
        sources: [],
        privateNote: '不允许',
      },
    },
    {
      action: 'remove' as const,
      handle: 'lesson-candidate-002',
    },
  ]) {
    expect(() => applyCandidateChanges(original, [change]))
      .toThrow('NODE_TREE_MATERIALIZED_IMMUTABLE');
  }
});

test('validates references after a candidate patch batch', () => {
  const tree: ChildTree = {
    kind: 'plan',
    entries: [],
  };
  expect(() => applyCandidateChanges(tree, [{
    action: 'add',
    candidate: {
      publicPurpose: '阶段目标',
      after: 'plan-candidate-999',
      dependsOn: [],
      considerWhen: '需要新阶段',
      sources: [],
      privateNote: '先问诊',
    },
  }])).toThrow('NODE_TREE_REFERENCE_INVALID');
});
