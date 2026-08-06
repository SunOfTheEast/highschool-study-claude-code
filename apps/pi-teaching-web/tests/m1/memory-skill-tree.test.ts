import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const resources = join(import.meta.dir, '../../resources');

function read(path: string): string {
  return readFileSync(join(resources, path), 'utf8');
}

function expectInOrder(source: string, fragments: string[]): void {
  let cursor = -1;
  for (const fragment of fragments) {
    const next = source.indexOf(fragment, cursor + 1);
    expect(next, `missing or out of order: ${fragment}`).toBeGreaterThan(cursor);
    cursor = next;
  }
}

test('routes Tutor memory work only from observable classroom triggers', () => {
  const skill = read('skills/tutor-lesson/SKILL.md');

  expect(skill).toContain('references/memory-recall.md');
  expect(skill).toContain('references/memory-consolidation.md');
  expect(skill).toContain('预案外');
  expect(skill).toContain('唯一一次正式课末反思');
  expect(skill).not.toContain('每轮读取 memory');
});

test('keeps Tutor recall progressive and subordinate to current evidence', () => {
  const recall = read('skills/tutor-lesson/references/memory-recall.md');

  expect(recall).toContain('当前课堂表现优先');
  expectInOrder(recall, [
    'memory/INDEX.md',
    '对象记忆',
    'Lesson Trace',
    'Classroom Log',
  ]);
  expect(recall).toContain('不会改变眼前动作');
  expect(recall).toContain('不读取');
  expect(recall).toContain('不得枚举');
});

test('gives Tutor one bright-line reflection and minimal sufficient consolidation', () => {
  const consolidation = read('skills/tutor-lesson/references/memory-consolidation.md');

  expectInOrder(consolidation, [
    '自然短回顾',
    '先听学生',
    '有边界的判断',
    '静默固化',
    '自然总结',
    '学生纠正',
  ]);
  for (const required of [
    'Consolidated Learning Traces',
    'Current Judgment',
    'Evolution Overview',
    'Trace Timeline',
    'Boundaries / Not Yet Demonstrated',
    'memory/preferences/',
    'memory/INDEX.md',
  ]) expect(consolidation).toContain(required);
  expect(consolidation).toContain('能力信号只留在 Trace');
  expect(consolidation).toContain('教学待办');
  expect(consolidation).toContain('不回读');
  expect(consolidation).toContain('没有类别配额');
});

test('keeps Lesson native writes inside the runtime-guarded memory boundary', () => {
  const role = read('agents/lesson-node.md');

  expect(role).toContain('原生 `edit/write`');
  expect(role).toContain('Runtime 守卫');
  expect(role).toContain('memory/objects/');
  expect(role).toContain('memory/preferences/');
  expect(role).toContain('不能写入 `memory/capabilities/`');
  expect(role).toContain('不得编辑父 Plan 或 Roadmap');
  expect(role).not.toContain('Lesson Session 不使用通用 `edit/write`');
});
