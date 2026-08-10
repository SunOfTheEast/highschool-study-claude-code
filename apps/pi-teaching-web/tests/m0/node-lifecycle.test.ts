import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setFrontmatterField } from '../../src/runtime/frontmatter';
import {
  NodeLifecycleService,
  transitionNode,
} from '../../src/runtime/node-lifecycle';
import { readLesson, readPlan, StudyDocumentError } from '../../src/study/markdown';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m0-lifecycle-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function body(source: string): string {
  return source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, '');
}

test('applies only the minimal forward Plan and Lesson transitions', () => {
  const root = copyFixture();
  setFrontmatterField(root, 'plans/plan-001/PLAN.md', 'status', 'prepared', 'active');
  setFrontmatterField(root, 'plans/plan-001/lessons/lesson-001.md', 'status', 'prepared', 'active');

  transitionNode(root, 'plans/plan-001/PLAN.md', 'prepared', 'active');
  transitionNode(root, 'plans/plan-001/lessons/lesson-001.md', 'prepared', 'active');
  expect(readPlan(root, 'plans/plan-001/PLAN.md').status).toBe('active');
  expect(readLesson(root, 'plans/plan-001/lessons/lesson-001.md').status).toBe('active');

  transitionNode(root, 'plans/plan-001/lessons/lesson-001.md', 'active', 'closed');
  transitionNode(root, 'plans/plan-001/PLAN.md', 'active', 'completed');
  expect(readLesson(root, 'plans/plan-001/lessons/lesson-001.md').status).toBe('closed');
  expect(readPlan(root, 'plans/plan-001/PLAN.md').status).toBe('completed');
});

test('rejects reverse, skipped and mismatched transitions without changing the body', () => {
  const root = copyFixture();
  const planPath = 'plans/plan-001/PLAN.md';
  const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
  const originalPlan = readFileSync(join(root, planPath), 'utf8');
  const originalLesson = readFileSync(join(root, lessonPath), 'utf8');

  expect(() => transitionNode(root, planPath, 'active', 'prepared'))
    .toThrow(StudyDocumentError);
  expect(() => transitionNode(root, planPath, 'prepared', 'completed'))
    .toThrow(StudyDocumentError);
  expect(() => transitionNode(root, lessonPath, 'prepared', 'closed'))
    .toThrow(StudyDocumentError);

  transitionNode(root, lessonPath, 'active', 'closed');
  expect(body(readFileSync(join(root, lessonPath), 'utf8'))).toBe(body(originalLesson));
  expect(body(readFileSync(join(root, planPath), 'utf8'))).toBe(body(originalPlan));
});

test('validates the complete Lesson before any frontmatter replacement', () => {
  const root = copyFixture();
  const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
  const absolute = join(root, lessonPath);
  const malformed = readFileSync(absolute, 'utf8')
    .replace('## Block block-002', '## Missing block-002');
  writeFileSync(absolute, malformed);

  expect(() => setFrontmatterField(root, lessonPath, 'session_id', 'session-new', null))
    .toThrow(StudyDocumentError);
  expect(readFileSync(absolute, 'utf8')).toBe(malformed);
});

test('changes Lesson frontmatter without changing any Block source', () => {
  const root = copyFixture();
  const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
  const absolute = join(root, lessonPath);
  const before = readFileSync(absolute, 'utf8');

  setFrontmatterField(root, lessonPath, 'session_id', 'session-new', null);

  const after = readFileSync(absolute, 'utf8');
  expect(body(after)).toBe(body(before));
  expect(readLesson(root, lessonPath).sessionId).toBe('session-new');
});

test('student lifecycle starts nodes without allocating an empty session', async () => {
  const root = copyFixture();
  setFrontmatterField(root, 'plans/plan-001/PLAN.md', 'status', 'prepared', 'active');
  setFrontmatterField(root, 'plans/plan-001/lessons/lesson-001.md', 'status', 'prepared', 'active');
  const lifecycle = new NodeLifecycleService(root);

  expect(await lifecycle.startPlan('plan-001')).toEqual({
    route: '/course/plan/plan-001',
    sessionKey: 'plan:plan-001',
  });
  expect(await lifecycle.startLesson('plan-001', 'lesson-001')).toEqual({
    route: '/course/plan/plan-001/lesson/lesson-001',
    sessionKey: 'lesson:plan-001:lesson-001',
  });
  expect(readPlan(root, 'plans/plan-001/PLAN.md').sessionId).toBeNull();
  expect(readLesson(root, 'plans/plan-001/lessons/lesson-001.md').sessionId).toBeNull();
  expect('closeLesson' in lifecycle).toBeFalse();
  expect('completePlan' in lifecycle).toBeFalse();
});

test('a closed Lesson cannot be reopened; a new Lesson node is required', async () => {
  const root = copyFixture();
  transitionNode(root, 'plans/plan-001/lessons/lesson-001.md', 'active', 'closed');
  const lifecycle = new NodeLifecycleService(root);

  await expect(lifecycle.startLesson('plan-001', 'lesson-001'))
    .rejects.toThrow(StudyDocumentError);
});
