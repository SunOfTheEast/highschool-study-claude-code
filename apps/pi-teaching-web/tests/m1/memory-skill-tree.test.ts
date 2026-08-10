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
  expect(skill).toContain('lesson_memory_commit');
  expect(skill).toContain('finish_lesson');
  expect(skill).not.toContain('原生记忆写入');
  expect(skill).not.toContain('每轮读取 memory');
});

test('keeps Tutor recall progressive and subordinate to current evidence', () => {
  const recall = read('skills/tutor-lesson/references/memory-recall.md');

  expect(recall).toContain('当前课堂表现优先');
  expectInOrder(recall, [
    'memory/INDEX.md',
    '对象记忆',
    'Block ID',
    'Classroom Log',
  ]);
  expect(recall).toContain('不会改变眼前动作');
  expect(recall).toContain('不读取');
  expect(recall).toContain('不得枚举');
});

test('gives Tutor one bright-line reflection and minimal sufficient consolidation', () => {
  const consolidation = read('skills/tutor-lesson/references/memory-consolidation.md');

  // Observed no-guidance control: all five M1a closes first tried an absolute native edit;
  // each close used 9–14 tools, and one created a temporary Reflection Block to finish writing.

  expectInOrder(consolidation, [
    '自然短回顾',
    '先听学生',
    '有边界的判断',
    '静默固化',
    '自然总结',
    '学生纠正',
  ]);
  expectInOrder(consolidation, [
    '读取本次判断需要的记忆',
    '形成一次语义提交',
    'lesson_memory_commit',
    '不回读',
    'finish_lesson',
    '自然总结',
  ]);
  for (const required of ['keep', 'assign', 'defer']) {
    expect(consolidation).toContain(required);
  }
  expect(consolidation).toContain('Learning History');
  expect(consolidation).toContain('evidenceBlockIds');
  expect(consolidation).toContain('明确偏好');
  expect(consolidation).toContain('不创建或修改 `memory/capabilities/`');
  expect(consolidation).toContain('新建偏好');
  expect(consolidation).toContain('`upsert`');
  expect(consolidation).toContain('教学待办');
  expect(consolidation).toContain('不回读');
  expect(consolidation).toContain('没有类别配额');
  expect(consolidation).toContain('课末交流没有产生新的决定性表现');
  expect(consolidation).toContain('只确认已有描述');
  expect(consolidation).toContain('不插入 Reflection Block');
  expect(consolidation).toContain('课末交流真的产生了新的决定性表现');
  expect(consolidation).toContain('classroom_update');
  expect(consolidation).toContain('classroom_log_append');
  expect(consolidation).toContain('Reflection Block');
  expect(consolidation).not.toContain('closingFact');
  expect(consolidation).not.toContain('用原生 `edit`');
});

test('routes every Lesson write through bound teaching tools', () => {
  const role = read('agents/lesson-node.md');

  expect(role).toContain('Lesson Session 不使用通用 `edit/write`');
  expect(role).toContain('lesson_memory_commit');
  expect(role).toContain('finish_lesson');
  expect(role).toContain('不能写入 `memory/capabilities/`');
  expect(role).toContain('不得编辑父 Plan 或 Roadmap');
  expect(role).not.toContain('原生 `edit/write` 只在');
});

test('keeps live asset saving behind one student-visible approval gate', () => {
  const free = read('skills/free-learning/SKILL.md');
  const lesson = read('skills/tutor-lesson/SKILL.md');

  expectInOrder(free, ['展示', '明确确认', 'save_note']);
  expect(free).toContain('不为补标签');
  expect(free).toContain('不要把保存说成掌握');
  expectInOrder(lesson, ['展示', '明确确认', 'save_note']);
  expect(lesson).toContain('不为标签');
  expect(lesson).toContain('不等于已经掌握');
  expect(lesson).toContain('source-N');
  expect(lesson).toContain('保存资产也不自动写记忆');
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
    'memory/INDEX.md',
    '对象记忆',
    '能力假设',
    '偏好',
    'Block ID',
    'Classroom Log',
  ]);
  expect(review).toContain('缺失、冲突');
  expect(review).toContain('高影响判断');
  expect(review).not.toContain('哪里真的顺了、\n哪里还不踏实');
  expect(review).toContain('不重复进行整课反思');
  expect(review).toContain('重新读取 `memory/INDEX.md`');
  expect(review).toContain('Deferred Object Routing');
  expect(review).toContain('memory_route_resolve');
  expect(review).toContain('仍无法判断');
  expect(role).toContain('memory_route_resolve');
});

test('documents the atomic commit and deferred-route ownership boundary', () => {
  const contract = read('contracts/m1-memory-contract.md');

  expect(contract).toContain('lesson_memory_commit');
  expect(contract).toContain('keep');
  expect(contract).toContain('assign');
  expect(contract).toContain('defer');
  expect(contract).toContain('Deferred Object Routing');
  expect(contract).toContain('memory_route_resolve');
  expect(contract).toContain('Runtime 不判断');
  expect(contract).toContain('旧历史条目');
});

test('uses incremental object snapshots in both formal Lessons and free learning', () => {
  const contract = read('contracts/m1-memory-contract.md');
  const consolidation = read('skills/tutor-lesson/references/memory-consolidation.md');

  expect(contract).toContain('正式 Lesson 中，已有对象只提交实际变化的');
  expect(consolidation).toContain('已有对象只提交实际变化的');
  for (const source of [contract, consolidation]) {
    expect(source).toContain('省略的字段保持原样');
    expect(source).toContain('新对象仍需完整快照');
    expect(source).toContain('只有新证据改变了认知流变的解释时');
  }
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
  expectInOrder(closure, ['Current Position', 'finish_plan']);
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

test('keeps custom-card approval separate from the prepared Lesson delivery', () => {
  const skill = read('skills/prepare-approved-lesson/SKILL.md');
  expectInOrder(skill, [
    '交付可开始的 Lesson',
    '展示拟保存',
    '单独询问',
    '明确确认',
    'save_prepared_problem_card',
  ]);
  expect(skill).toContain('课程方案的批准不构成题卡');
  expect(skill).toContain('不改变 Lesson 已可开始的事实');
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
    'Block ID',
    'Classroom Log',
  ]);
  expect(nextPlan).toContain('高影响');
  expect(nextPlan).toContain('证据冲突');
  expect(nextPlan).toContain('不重做逐课提取');
  expect(nextPlan).toContain('重新读取 `memory/INDEX.md`');
});

test('calibrates one capability chain across Plans without erasing history', () => {
  const nextPlan = read('skills/roadmap-dialogue/references/next-plan.md');

  expect(nextPlan).toContain('同一个能力文件');
  expect(nextPlan).toContain('跨 Plan');
  expect(nextPlan).toContain('强化、改写、削弱或撤回');
  expect(nextPlan).toContain('Calibration History');
  expect(nextPlan).toContain('不改写旧历史条目');
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

test('keeps Meta at Roadmap creation without swallowing the first Plan', () => {
  const skill = read('skills/meta-dialogue/SKILL.md');
  const role = read('agents/meta-session.md');

  expectInOrder(skill, [
    '确认是否需要长期路径',
    '按需读取真实证据',
    '公开完整 Roadmap 级方案',
    '明确确认',
    'create_roadmap',
    'Roadmap Session',
  ]);
  expect(skill).toContain('不等于学生掌握');
  expect(skill).toContain('不在本 Session 继续制定第一个 Plan');
  expect(role).toContain('不得创建、设计或预演第一个 Plan');
  expect(role).toContain('学生拒绝长期路径时不劝服');
});
