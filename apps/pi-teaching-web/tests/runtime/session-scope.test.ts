import { expect, test } from 'bun:test';
import {
  formatSessionOwnerContext,
  isRoadmapCoachScope,
  ROADMAP_COACH_SCOPE,
  roleForNode,
} from '../../src/runtime/session-scope';

test('derives the role and formats the canonical owner file for each node', () => {
  expect(roleForNode('roadmap')).toBe('coach');
  expect(roleForNode('plan')).toBe('coach');
  expect(roleForNode('lesson')).toBe('tutor');

  expect(formatSessionOwnerContext('/set', {
    nodeKind: 'lesson',
    nodeId: 'not-the-file-name',
    nodePath: 'lessons/unit-a/custom-name.md',
    parentId: 'plan-001',
    parentPath: 'plans/plan-001.md',
  })).toContain('Current Lesson file: lessons/unit-a/custom-name.md');

  expect(formatSessionOwnerContext('/set', {
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  })).toContain('Current Plan file: plans/domain-integrity.md');
});

test('recognizes the canonical Roadmap Coach owner only', () => {
  expect(ROADMAP_COACH_SCOPE).toEqual({
    nodeKind: 'roadmap',
    nodeId: 'roadmap',
    nodePath: 'ROADMAP.md',
    parentId: null,
    parentPath: null,
  });
  expect(isRoadmapCoachScope(ROADMAP_COACH_SCOPE)).toBe(true);
  expect(isRoadmapCoachScope({
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  })).toBe(false);
  expect(formatSessionOwnerContext('/set', ROADMAP_COACH_SCOPE))
    .toContain('Current Roadmap file: ROADMAP.md');
});
