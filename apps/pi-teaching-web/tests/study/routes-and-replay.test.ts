import { expect, test } from 'bun:test';
import { makeLearningSetWithHistory } from '../../../../plugins/highschool-study/tests/helpers/learning-set';
import type { LessonNode } from '../../src/shared/contracts';
import { buildReplay } from '../../src/study/replay';
import { applyRouteChanges } from '../../src/study/routes';

test('replays append-only route changes over the initial block order', () => {
  const route = applyRouteChanges(['a', 'b', 'c'], [
    { id: 'route-001', action: 'skip', blockId: 'b', before: null, after: null, reason: 'evidence', source: '#trace-1' },
    { id: 'route-002', action: 'repeat', blockId: 'a', before: null, after: 'c', reason: 'student request', source: '#trace-2' },
  ]);
  expect(route).toEqual(['a', 'c', 'a']);
});

test('labels replay without Pi history as evidence-only', () => {
  const root = makeLearningSetWithHistory();
  const lesson: LessonNode = {
    id: 'lesson-001',
    title: 'Lesson 001',
    path: 'lessons/lesson-001.md',
    planId: 'max-value',
    status: 'closed',
    sessionKey: 'tutor:lesson-001',
    tutorSessionId: null,
    blocks: [
      { id: 'step-01', title: 'step-01', kind: 'dialogue', required: true, status: 'completed', dependsOn: [], uses: [], studentView: '', evidence: [] },
      { id: 'step-02', title: 'step-02', kind: 'problem', required: true, status: 'completed', dependsOn: ['step-01'], uses: ['Q-FREEZE-01'], studentView: '', evidence: [] },
    ],
  };
  const replay = buildReplay(root, lesson, []);
  expect(replay.mode).toBe('evidence-only');
  expect(replay.items.some((item) => item.kind === 'trace')).toBe(true);
  expect(replay.route).toEqual({ initial: ['step-01', 'step-02'], effective: ['step-01', 'step-02'] });
});
