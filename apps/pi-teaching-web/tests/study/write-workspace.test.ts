import { afterEach, expect, test } from 'bun:test';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendRouteChange,
  closeLesson,
  setBlockStatus,
  setFrontmatterField,
  updatePlan,
} from '../../src/study/write-workspace';

const roots: string[] = [];
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

function fixture(): { root: string; path: string } {
  const root = mkdtempSync(join(tmpdir(), 'study-web-'));
  roots.push(root);
  const path = join(root, 'lesson.md');
  writeFileSync(path, `---
id: lesson
kind: lesson
status: prepared
---
# Lesson

## Block orientation

### Student View

开始。

## Block reflection（必做）

### Node State

- Kind: reflection
- Required: true
- Status: active
- Depends on: orientation
- Uses:

### Student View

复盘。

## Reflection

（课堂结束后填写）

## Lesson Summary

（课堂结束后填写）
`);
  return { root, path: 'lesson.md' };
}

function planFixture(): { root: string; path: string } {
  const root = mkdtempSync(join(tmpdir(), 'study-plan-'));
  roots.push(root);
  const path = 'plans/p1.md';
  const absolute = join(root, path);
  mkdirSync(join(root, 'plans'), { recursive: true });
  writeFileSync(absolute, `---
id: p1
kind: plan
status: prepared
---
# Plan

## Lesson Index

旧课程。

## Current Position

旧位置。

## Next Lesson Candidate

旧候选。

## Plan Summary

旧总结。
`);
  return { root, path };
}

test('updates one frontmatter field and one block state', () => {
  const { root, path } = fixture();
  setFrontmatterField(root, path, 'tutor_session', 'session-1');
  setBlockStatus(root, path, 'orientation', 'active');
  const source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('tutor_session: session-1');
  expect(source).toContain('- Status: active');
});

test('appends a sourced route change and closes the lesson', () => {
  const { root, path } = fixture();
  appendRouteChange(root, path, {
    action: 'skip',
    blockId: 'orientation',
    reason: '学生已完成诊断。',
    source: '#trace-event-001',
  });
  closeLesson(root, path, { reflection: '我会先检查定义域。', summary: '独立完成诊断。' });
  const source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('### Route change route-001');
  expect(source).toContain('- Source: #trace-event-001');
  expect(source).toContain('- Status: completed');
  expect(source).toContain('status: closed');
  expect(source).toContain('我会先检查定义域。');
  expect(source).toContain('独立完成诊断。');
});

test('leaves a lesson byte-for-byte unchanged when a required close section is missing', () => {
  const { root, path } = fixture();
  const absolute = join(root, path);
  const before = readFileSync(absolute, 'utf8').replace('## Lesson Summary', '## Summary Missing');
  writeFileSync(absolute, before);

  expect(() => closeLesson(root, path, {
    reflection: '不会写入。',
    summary: '不会写入。',
  })).toThrow('SECTION_NOT_FOUND: Lesson Summary');
  expect(readFileSync(absolute, 'utf8')).toBe(before);
});

test('updates all Plan audit sections in one write and maps the decision status', () => {
  const { root, path } = planFixture();
  updatePlan(root, path, {
    decision: 'replan',
    lessonIndex: '1. [Lesson 001](../lessons/lesson-001.md) — closed。',
    currentPosition: '- 已满足标准一。\n- 标准二仍缺证据。',
    nextLessonCandidate: '- 使用另一问题类别的真实题卡。',
    planSummary: '决定：继续，但重新安排下一课。',
  });
  let source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('status: active');
  expect(source).toContain('Lesson 001');
  expect(source).toContain('标准二仍缺证据');
  expect(source).toContain('另一问题类别');
  expect(source).toContain('重新安排下一课');

  updatePlan(root, path, {
    decision: 'complete',
    lessonIndex: '全部课程已完成。',
    currentPosition: '能力标准已满足。',
    nextLessonCandidate: '无。',
    planSummary: '决定：完成。',
  });
  source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('status: completed');
});

test('leaves a Plan byte-for-byte unchanged when an audit section is missing', () => {
  const { root, path } = planFixture();
  const absolute = join(root, path);
  const before = readFileSync(absolute, 'utf8').replace('## Plan Summary', '## Summary Missing');
  writeFileSync(absolute, before);

  expect(() => updatePlan(root, path, {
    decision: 'active',
    lessonIndex: '不会写入。',
    currentPosition: '不会写入。',
    nextLessonCandidate: '不会写入。',
    planSummary: '不会写入。',
  })).toThrow('SECTION_NOT_FOUND: Plan Summary');
  expect(readFileSync(absolute, 'utf8')).toBe(before);
});
