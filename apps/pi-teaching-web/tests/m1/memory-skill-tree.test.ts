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

test('makes Plan consume consolidated memory before drilling into classroom evidence', () => {
  const skill = read('skills/plan-dialogue/SKILL.md');
  const review = read('skills/plan-dialogue/references/post-lesson-review.md');
  const role = read('agents/plan-node.md');

  expect(skill).toContain('memory/INDEX.md');
  expect(skill).toContain('Lesson Tree');
  expect(role).toContain('跨 Session 记忆');
  expect(role).toContain('精确链接');
  expectInOrder(review, [
    'Consolidated Learning Traces',
    '对象记忆',
    '能力假设',
    '偏好',
    'Classroom Log',
  ]);
  expect(review).toContain('缺失、冲突');
  expect(review).toContain('高影响判断');
  expect(review).not.toContain('哪里真的顺了、\n哪里还不踏实');
  expect(review).toContain('不重复进行整课反思');
});

test('lets Plan form a working capability hypothesis only across different objects', () => {
  const review = read('skills/plan-dialogue/references/post-lesson-review.md');
  const closure = read('skills/plan-dialogue/references/plan-closure.md');

  expect(review).toContain('跨不同对象');
  expect(review).toContain('memory/capabilities/');
  expect(review).toContain('Current Hypothesis');
  expect(review).toContain('Calibration History');
  expect(review).toContain('单一对象');
  expect(review).toContain('不升级');
  expect(closure).toContain('Current Position');
  expect(closure).toContain('自包含');
  expect(closure).toContain('教学待办');
  expect(closure).toContain('不进入 memory');
});

test('keeps the Lesson approval gate unchanged after Plan memory review', () => {
  const skill = read('skills/plan-dialogue/SKILL.md');
  expectInOrder(skill, [
    '公开讨论',
    '明确确认',
    'Next Lesson Arrangement',
    'prepare-approved-lesson',
  ]);
  expect(skill).toContain('确认之前不得调用 `prepare-approved-lesson`');
});

test('makes Roadmap review one completed Plan through summaries and routed memory', () => {
  const skill = read('skills/roadmap-dialogue/SKILL.md');
  const nextPlan = read('skills/roadmap-dialogue/references/next-plan.md');
  const role = read('agents/roadmap-node.md');

  expect(skill).toContain('memory/INDEX.md');
  expect(skill).toContain('不得枚举 `memory/`');
  expect(role).toContain('memory/INDEX.md');
  expectInOrder(nextPlan, [
    'Plan 的阶段总结',
    'memory/INDEX.md',
    '对象记忆',
    '能力假设',
    '偏好',
    'Trace',
    'Classroom Log',
  ]);
  expect(nextPlan).toContain('高影响');
  expect(nextPlan).toContain('证据冲突');
  expect(nextPlan).toContain('不重做逐课提取');
});

test('calibrates one capability chain across Plans without erasing history', () => {
  const nextPlan = read('skills/roadmap-dialogue/references/next-plan.md');

  expect(nextPlan).toContain('同一个能力文件');
  expect(nextPlan).toContain('跨 Plan');
  expect(nextPlan).toContain('强化、改写、削弱或撤回');
  expect(nextPlan).toContain('Calibration History');
  expect(nextPlan).toContain('不改写旧 Trace');
  expect(nextPlan).toContain('教学待办');
  expect(nextPlan).toContain('不进入 memory');
});

test('keeps the Plan approval gate unchanged after Roadmap memory calibration', () => {
  const skill = read('skills/roadmap-dialogue/SKILL.md');
  expectInOrder(skill, [
    '公开设计',
    '明确确认',
    'ROADMAP.md',
    'prepare-approved-plan',
  ]);
  expect(skill).toContain('确认之前不得调用 `prepare-approved-plan`');
});
