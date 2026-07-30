import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';
import { readCourseView } from '../../src/study/views/course-view';

const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

function fixtureWithCandidate(): string {
  const root = mkdtempSync(join(tmpdir(), 'study-course-view-'));
  roots.push(root);
  cpSync(domainIntegrityFixtureRoot, root, { recursive: true });
  const path = join(root, 'plans/domain-integrity.md');
  writeFileSync(path, readFileSync(path, 'utf8').replace(
    '\n## Current Position',
    `
### Candidate lesson-candidate-004

- Public purpose: 换一种题型检查路线迁移。
- After: lesson-candidate-003
- Depends on: lesson-candidate-003
- Consider when: PRIVATE_CONSIDER
- Sources:
  - trace:trace-fixture-002
- Private note: PRIVATE_NOTE

## Current Position`,
  ));
  return root;
}

test('projects Roadmap, Plan, materialized Lesson and Candidate without private fields', () => {
  const view = readCourseView(fixtureWithCandidate(), {
    planId: 'domain-integrity',
    lessonId: null,
  });
  expect(view.roadmap.kind).toBe('roadmap');
  expect(view.plans.some((node) => node.kind === 'plan')).toBe(true);
  const candidate = view.plans
    .flatMap((plan) => plan.children)
    .find((node) => node.status === 'candidate');
  expect(candidate).toMatchObject({
    nodeId: null,
    route: null,
    sessionKey: null,
    title: '可能的下一步',
  });
  expect(JSON.stringify(view)).not.toContain('PRIVATE_CONSIDER');
  expect(JSON.stringify(view)).not.toContain('PRIVATE_NOTE');
  expect(JSON.stringify(view)).not.toContain('Teacher Control');
  expect(JSON.stringify(view)).not.toContain('Adaptation Brief');
});

test('uses the safe prepared preview instead of the hidden Lesson title', () => {
  const view = readCourseView(domainIntegrityFixtureRoot, {
    planId: 'domain-integrity',
    lessonId: 'lesson-003',
  });
  expect(view.selectedLesson?.status).toBe('prepared');
  expect(view.selectedLesson?.publicTitle).toBe('待开始课程');
  expect(view.selectedLesson).toMatchObject({
    canStart: true,
    canReprepare: true,
    canContinue: false,
    canReplay: false,
  });
  expect(JSON.stringify(view)).not.toContain('冻结变量法绝密诊断');
});

test('derives terminal replay actions without reopening a Tutor session', () => {
  const view = readCourseView(domainIntegrityFixtureRoot, {
    planId: 'domain-integrity',
    lessonId: 'lesson-001',
  });
  expect(view.selectedLesson).toMatchObject({
    status: 'closed',
    canStart: false,
    canReprepare: false,
    canContinue: false,
    canReplay: true,
  });
  const node = view.plans[0]?.children.find((child) => (
    child.nodeId === 'lesson-001'
  ));
  expect(node?.route).toBe('/course/plan/domain-integrity/lesson/lesson-001');
});

test('drops a nonexistent selection and keeps the Roadmap projection usable', () => {
  const view = readCourseView(domainIntegrityFixtureRoot, {
    planId: 'missing-plan',
    lessonId: 'missing-lesson',
  });
  expect(view.selectedPlan).toBeNull();
  expect(view.selectedLesson).toBeNull();
  expect(view.roadmap.children.length).toBeGreaterThan(0);
});
