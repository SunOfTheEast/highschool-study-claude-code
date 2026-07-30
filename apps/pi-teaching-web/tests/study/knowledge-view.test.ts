import { afterEach, expect, test } from 'bun:test';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { readKnowledgeView } from '../../src/study/views/knowledge-view';
import {
  clearTracePool,
  copyViewLearningSet,
  installInvalidatedOnlyMethod,
  installObservedMethod,
  removeViewLearningSets,
} from '../support/view-learning-set';

const emptyQuery = {
  planId: null,
  lessonId: null,
  methodName: null,
  cardPath: null,
  evidenceSource: null,
  topicId: null,
  timeRange: 'all' as const,
};

afterEach(removeViewLearningSets);

test('keeps the complete formal method skeleton when no Trace exists', () => {
  const root = copyViewLearningSet();
  clearTracePool(root);
  const view = readKnowledgeView(root, emptyQuery);
  expect(view.nodes.length).toBeGreaterThan(1);
  expect(view.nodes.every((node) => node.state === 'unobserved')).toBe(true);
  expect(view.lessonPins).toEqual([]);
  expect(JSON.stringify(view)).not.toContain('"score"');
  expect(JSON.stringify(view)).not.toContain('"mastery"');
});

test('distinguishes observed evidence from repeated independent cards', () => {
  const root = copyViewLearningSet();
  const methodName = installObservedMethod(root);
  const view = readKnowledgeView(root, {
    ...emptyQuery,
    methodName,
  });
  const node = view.nodes.find((item) => item.label === methodName);
  expect(node?.evidenceCount).toBe(1);
  expect(node?.distinctCardCount).toBe(1);
  expect(node?.state).toBe('observed');
  expect(view.selectedMethod?.boundary).toContain('学习记录');
});

test('does not attach hidden prepared assessment cards or methods to the Lesson', () => {
  const view = readKnowledgeView(copyViewLearningSet(), {
    ...emptyQuery,
    planId: 'domain-integrity',
    lessonId: 'lesson-003',
  });
  expect(view.lessonPins.find((pin) => pin.lessonId === 'lesson-003')).toBeUndefined();
  expect(JSON.stringify(view)).not.toContain('Teacher Control');
  expect(JSON.stringify(view)).not.toContain('mst_p0032_ex22.card.yaml');
  expect(JSON.stringify(view)).not.toContain('mst_p0030_ex16.card.yaml');
});

test('marks only the selected visible Lesson methods as current', () => {
  const root = copyViewLearningSet();
  const path = join(root, 'lessons/lesson-003.md');
  writeFileSync(
    path,
    readFileSync(path, 'utf8')
      .replace('status: prepared', 'status: active')
      .replace(
        '- Status: pending\n- Depends on: block-001\n- Uses: Q-DOMAIN-EX22',
        '- Status: active\n- Depends on: block-001\n- Uses: Q-DOMAIN-EX22',
      ),
  );
  const view = readKnowledgeView(root, {
    ...emptyQuery,
    planId: 'domain-integrity',
    lessonId: 'lesson-003',
  });
  expect(view.lessonPins.find((pin) => pin.lessonId === 'lesson-003')?.methodIds)
    .toContain('isomorphic');
  expect(view.nodes.find((node) => node.id === 'isomorphic')?.currentLesson)
    .toBe(true);
  expect(view.nodes.find((node) => node.id === 'recurrence')?.currentLesson)
    .toBe(false);
});

test('keeps invalidated history visible without using it as active evidence', () => {
  const root = copyViewLearningSet();
  const methodName = installInvalidatedOnlyMethod(root);
  const view = readKnowledgeView(root, {
    ...emptyQuery,
    methodName,
  });
  const node = view.nodes.find((item) => item.label === methodName);
  expect(node?.state).toBe('invalidated');
  expect(node?.evidenceCount).toBe(0);
});

test('filters to a declared topic subtree and clears an unknown topic', () => {
  const root = copyViewLearningSet();
  const overview = readKnowledgeView(root, emptyQuery);
  const topic = overview.filters.availableTopics.find((item) => (
    overview.nodes.some((node) => node.id === item.id && node.parentId !== null)
  ))!;
  const filtered = readKnowledgeView(root, { ...emptyQuery, topicId: topic.id });
  expect(filtered.filters.topicId).toBe(topic.id);
  expect(filtered.nodes.some((node) => node.id === topic.id)).toBe(true);
  const parent = overview.nodes.find((node) => node.id === (
    overview.nodes.find((candidate) => candidate.id === topic.id)?.parentId
  ))!;
  expect(filtered.nodes.some((node) => node.id === parent.id)).toBe(false);
  expect(readKnowledgeView(root, {
    ...emptyQuery,
    topicId: topic.id,
    methodName: parent.label,
  }).selectedMethod).toBeNull();

  const cleared = readKnowledgeView(root, {
    ...emptyQuery,
    topicId: 'not-in-this-learning-set',
  });
  expect(cleared.filters.topicId).toBeNull();
  expect(cleared.nodes).toHaveLength(overview.nodes.length);
});
