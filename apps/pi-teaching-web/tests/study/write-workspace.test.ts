import { afterEach, expect, test } from 'bun:test';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  appendRouteChange,
  closeLesson,
  setBlockStatus,
  setFrontmatterField,
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
