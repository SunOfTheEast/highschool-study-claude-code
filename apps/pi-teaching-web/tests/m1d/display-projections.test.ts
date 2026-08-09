import { expect, test } from 'bun:test';
import { join } from 'node:path';
import type { ConversationItem, CourseTreeNode } from '../../src/shared/contracts';
import type { OwnedLearningSessionFact } from '../../src/study/learning-footprint';
import { readCourseTree } from '../../src/study/markdown';
import {
  deriveFreeLearningTitle,
  projectActiveLesson,
  projectAssetFormation,
} from '../../src/study/display-projections';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');

test('projects the exact active Lesson and its owning Plan from the real course tree', () => {
  const { tree } = readCourseTree(fixture);

  expect(projectActiveLesson(tree)).toEqual({
    id: 'lesson-001',
    title: '真实停点问诊',
    planId: 'plan-001',
    planTitle: '恒成立问题选路',
    route: '/course/plan/plan-001/lesson/lesson-001',
  });

  const withoutActiveLesson: CourseTreeNode = {
    ...tree,
    children: tree.children.map((plan) => ({
      ...plan,
      children: plan.children.map((lesson) => ({ ...lesson, status: 'prepared' as const })),
    })),
  };
  expect(projectActiveLesson(withoutActiveLesson)).toBeNull();
});

test('derives a bounded display title from the first real student message', () => {
  const items: ConversationItem[] = [
    { id: 'a', kind: 'assistant', text: '你好。', at: '2026-08-09T10:00:00.000Z' },
    {
      id: 'u',
      kind: 'user',
      text: '# Ksp 为什么只写离子浓度？\n\n我总觉得固体被漏掉了。',
      at: '2026-08-09T10:00:01.000Z',
    },
  ];

  expect(deriveFreeLearningTitle(items)).toBe('Ksp 为什么只写离子浓度？ 我总觉得固体被漏掉了。');
  expect(deriveFreeLearningTitle([])).toBe('自由学习');
  expect(deriveFreeLearningTitle([{
    id: 'long',
    kind: 'user',
    text: '一'.repeat(80),
    at: '2026-08-09T10:00:02.000Z',
  }])).toHaveLength(32);
});

test('resolves an asset formation route without turning it into a content source', () => {
  const sessions: OwnedLearningSessionFact[] = [
    {
      id: 'free-session-001',
      title: 'Ksp 为什么只写离子浓度？',
      createdAt: '2026-08-09T10:00:00.000Z',
      entryTimes: [],
      owner: {
        sessionKind: 'free-learning',
        title: '自由学习',
        createdAt: '2026-08-09T10:00:00.000Z',
        selectedAssets: [{ kind: 'note', id: 'note-000' }],
      },
      status: 'active',
    },
    {
      id: 'lesson-session-001',
      title: 'Lesson 001：真实停点问诊',
      createdAt: '2026-08-09T11:00:00.000Z',
      entryTimes: [],
      owner: {
        nodeKind: 'lesson',
        nodeId: 'lesson-001',
        nodePath: 'plans/plan-001/lessons/lesson-001.md',
        parentId: 'plan-001',
        parentPath: 'plans/plan-001/PLAN.md',
      },
      status: 'closed',
    },
  ];

  expect(projectAssetFormation(sessions, 'free-session-001')).toEqual({
    sessionId: 'free-session-001',
    kind: 'free-learning',
    title: 'Ksp 为什么只写离子浓度？',
    route: '/learn/free-session-001',
  });
  expect(projectAssetFormation(sessions, 'lesson-session-001')).toEqual({
    sessionId: 'lesson-session-001',
    kind: 'lesson',
    title: 'Lesson 001：真实停点问诊',
    route: '/course/plan/plan-001/lesson/lesson-001',
  });
  expect(projectAssetFormation(sessions, 'missing-session')).toBeNull();
});
