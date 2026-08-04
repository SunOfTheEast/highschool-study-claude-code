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
  setFrontmatterField(root, 'plans/plan-001.md', 'status', 'prepared', 'active');
  setFrontmatterField(root, 'lessons/lesson-001.md', 'status', 'prepared', 'active');

  transitionNode(root, 'plans/plan-001.md', 'prepared', 'active');
  transitionNode(root, 'lessons/lesson-001.md', 'prepared', 'active');
  expect(readPlan(root, 'plans/plan-001.md').status).toBe('active');
  expect(readLesson(root, 'lessons/lesson-001.md').status).toBe('active');

  transitionNode(root, 'lessons/lesson-001.md', 'active', 'closed');
  transitionNode(root, 'plans/plan-001.md', 'active', 'completed');
  expect(readLesson(root, 'lessons/lesson-001.md').status).toBe('closed');
  expect(readPlan(root, 'plans/plan-001.md').status).toBe('completed');
});

test('rejects reverse, skipped and mismatched transitions without changing the body', () => {
  const root = copyFixture();
  const planPath = 'plans/plan-001.md';
  const lessonPath = 'lessons/lesson-001.md';
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
  const lessonPath = 'lessons/lesson-001.md';
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
  const lessonPath = 'lessons/lesson-001.md';
  const absolute = join(root, lessonPath);
  const before = readFileSync(absolute, 'utf8');

  setFrontmatterField(root, lessonPath, 'session_id', 'session-new', null);

  const after = readFileSync(absolute, 'utf8');
  expect(body(after)).toBe(body(before));
  expect(readLesson(root, lessonPath).sessionId).toBe('session-new');
});

test('student lifecycle opens sessions without synthesized turns and returns to the parent', async () => {
  const root = copyFixture();
  setFrontmatterField(root, 'plans/plan-001.md', 'status', 'prepared', 'active');
  setFrontmatterField(root, 'lessons/lesson-001.md', 'status', 'prepared', 'active');
  const opened: string[] = [];
  const aborted: string[] = [];
  const released: string[] = [];
  const lifecycle = new NodeLifecycleService(root, {
    open: async (key) => {
      opened.push(key);
      return {};
    },
    abort: async (key) => {
      aborted.push(key);
    },
    release: async (key) => {
      released.push(key);
    },
  });

  expect(await lifecycle.startPlan('plan-001')).toEqual({
    route: '/course/plan/plan-001',
    sessionKey: 'plan:plan-001',
  });
  expect(await lifecycle.startLesson('lesson-001')).toEqual({
    route: '/course/plan/plan-001/lesson/lesson-001',
    sessionKey: 'lesson:lesson-001',
  });
  expect(opened).toEqual(['plan:plan-001', 'lesson:lesson-001']);

  expect(await lifecycle.closeLesson('lesson-001')).toEqual({
    route: '/course/plan/plan-001',
  });
  expect(await lifecycle.completePlan('plan-001')).toEqual({ route: '/course' });
  expect(aborted).toEqual(['lesson:lesson-001', 'plan:plan-001']);
  expect(released).toEqual(['lesson:lesson-001', 'plan:plan-001']);
});

test('a closed Lesson cannot be reopened; a new Lesson node is required', async () => {
  const root = copyFixture();
  transitionNode(root, 'lessons/lesson-001.md', 'active', 'closed');
  const lifecycle = new NodeLifecycleService(root, {
    open: async () => ({}),
    abort: async () => {},
    release: async () => {},
  });

  await expect(lifecycle.startLesson('lesson-001')).rejects.toThrow(StudyDocumentError);
});
