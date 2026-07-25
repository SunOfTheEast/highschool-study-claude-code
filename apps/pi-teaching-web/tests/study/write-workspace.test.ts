import { afterEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readPlanWorkspace } from '../../src/study/read-workspace';
import {
  appendRouteChange,
  closeLesson,
  registerPlan,
  setBlockStatus,
  setFrontmatterField,
  updatePlan,
  writePreparedLesson,
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
status: active
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

## Lesson Summary

（课堂结束后填写）
`);
  return { root, path: 'lesson.md' };
}

function closureFixture(
  blocks: string,
  status: 'active' | 'closed' | 'abandoned' = 'active',
): { root: string; path: string } {
  const root = mkdtempSync(join(tmpdir(), 'study-close-'));
  roots.push(root);
  const path = 'lesson.md';
  writeFileSync(join(root, path), `---
id: lesson-close
kind: lesson
status: ${status}
---
# Lesson Close

${blocks}

## Lesson Summary

（课堂结束后填写）
`);
  return { root, path };
}

function planFixture(): { root: string; path: string; roadmapPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'study-plan-'));
  roots.push(root);
  const path = 'plans/p1.md';
  const absolute = join(root, path);
  const roadmapPath = join(root, 'ROADMAP.md');
  mkdirSync(join(root, 'plans'), { recursive: true });
  writeFileSync(roadmapPath, `---
id: roadmap
kind: roadmap
status: active
---
# 测试 Roadmap

## Plan Graph

- [测试 Plan](plans/p1.md) — active；保留人工说明。
`);
  writeFileSync(absolute, `---
id: p1
kind: plan
status: prepared
---
# Plan：测试 Plan

## Lesson Index

旧课程。

## Current Position

旧位置。

## Next Lesson Candidate

旧候选。

## Plan Summary

旧总结。
`);
  return { root, path, roadmapPath };
}

function registrationFixture(): { root: string; roadmapPath: string; planPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'study-register-plan-'));
  roots.push(root);
  mkdirSync(join(root, 'plans'), { recursive: true });
  const roadmapPath = join(root, 'ROADMAP.md');
  const planPath = join(root, 'plans/isomorphic-transformation.md');
  writeFileSync(roadmapPath, `---
id: roadmap
kind: roadmap
status: active
---
# 导数学习 Roadmap

## Plan Graph

- [原 Plan](plans/original.md) — active。

## Change Log

- 初始。
`);
  writeFileSync(planPath, `---
id: isomorphic-transformation
kind: plan
status: active
coach_session: null
---
# Plan：同构变形

## Goal

识别同构结构。
`);
  return { root, roadmapPath, planPath };
}

test('updates one frontmatter field and one block state', () => {
  const { root, path } = fixture();
  setFrontmatterField(root, path, 'tutor_session', 'session-1');
  setBlockStatus(root, path, 'orientation', 'active');
  const source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('tutor_session: session-1');
  expect(source).toContain('- Status: active');
});

test('appends a sourced route change and closes without completing a Block', () => {
  const { root, path } = fixture();
  appendRouteChange(root, path, {
    action: 'skip',
    blockId: 'orientation',
    reason: '学生已完成诊断。',
    source: '#trace-event-001',
  });
  closeLesson(root, path, { summary: '独立完成诊断。' });
  const source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('### Route change route-001');
  expect(source).toContain('- Source: #trace-event-001');
  expect(source).toContain('- Status: active');
  expect(source).toContain('status: closed');
  expect(source).toContain('独立完成诊断。');
  expect(source).not.toContain('## Reflection');
});

test('leaves a lesson byte-for-byte unchanged when a required close section is missing', () => {
  const { root, path } = fixture();
  const absolute = join(root, path);
  const before = readFileSync(absolute, 'utf8').replace('## Lesson Summary', '## Summary Missing');
  writeFileSync(absolute, before);

  expect(() => closeLesson(root, path, { summary: '不会写入。' }))
    .toThrow('SECTION_NOT_FOUND: Lesson Summary');
  expect(readFileSync(absolute, 'utf8')).toBe(before);
});

const closureScenarios = [
  ['active problem', `## Block problem-01

### Node State

- Kind: problem
- Required: true
- Status: active
- Depends on:
- Uses: Q-1`],
  ['completed reflection', `## Block reflection-01

### Node State

- Kind: reflection
- Required: true
- Status: completed
- Depends on:
- Uses:`],
  ['no reflection', `## Block dialogue-01

### Node State

- Kind: dialogue
- Required: true
- Status: active
- Depends on:
- Uses:`],
  ['multiple reflections', `## Block reflection-01

### Node State

- Kind: reflection
- Required: false
- Status: completed
- Depends on:
- Uses:

## Block reflection-02

### Node State

- Kind: reflection
- Required: false
- Status: active
- Depends on: reflection-01
- Uses:`],
] as const;

test.each(closureScenarios)(
  'closes from %s without changing any Block state',
  (_name, blocks) => {
    const { root, path } = closureFixture(blocks);
    const before = readFileSync(join(root, path), 'utf8')
      .match(/^- Status: .*$/gm);

    closeLesson(root, path, {
      summary: '关课时证据仍有空缺；来源见 #trace-event-001。',
    });

    const after = readFileSync(join(root, path), 'utf8');
    expect(after).toContain('status: closed');
    expect(after).toContain('关课时证据仍有空缺');
    expect(after.match(/^- Status: .*$/gm)).toEqual(before);
    expect(after).not.toContain('## Reflection');
  },
);

test.each(['closed', 'abandoned'] as const)(
  'rejects closing a terminal %s Lesson without changing the file',
  (status) => {
    const { root, path } = closureFixture('', status);
    const absolute = join(root, path);
    const before = readFileSync(absolute, 'utf8');

    expect(() => closeLesson(root, path, {
      summary: '不得覆盖旧快照。',
    })).toThrow(`LESSON_ALREADY_TERMINAL: ${status}`);
    expect(readFileSync(absolute, 'utf8')).toBe(before);
  },
);

test('updates all Plan audit sections in one write and maps the decision status', () => {
  const { root, path } = planFixture();
  updatePlan(root, path, {
    decision: 'replan',
    currentPosition: '- 已满足标准一。\n- 标准二仍缺证据。',
    nextLessonCandidate: '- 使用另一问题类别的真实题卡。',
    planSummary: '决定：继续，但重新安排下一课。',
  });
  let source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('status: active');
  expect(source).toContain('（暂无）');
  expect(source).toContain('标准二仍缺证据');
  expect(source).toContain('另一问题类别');
  expect(source).toContain('重新安排下一课');

  updatePlan(root, path, {
    decision: 'complete',
    currentPosition: '能力标准已满足。',
    nextLessonCandidate: '无。',
    planSummary: '决定：完成。',
  });
  source = readFileSync(join(root, path), 'utf8');
  expect(source).toContain('status: completed');
});

test('derives the Lesson Index from real same-Plan files in stable order', () => {
  const { root, path } = planFixture();
  mkdirSync(join(root, 'lessons'), { recursive: true });
  writeFileSync(join(root, 'lessons/lesson-001.md'), `---
id: lesson-001
kind: lesson
plan_id: p1
status: closed
---
# 第一课
`);
  writeFileSync(join(root, 'lessons/lesson-002.md'), `---
id: lesson-002
kind: lesson
plan_id: p1
status: prepared
---
# 第二课
`);
  writeFileSync(join(root, 'lessons/lesson-other.md'), `---
id: lesson-other
kind: lesson
plan_id: another-plan
status: prepared
---
# 其他 Plan 的课
`);
  writeFileSync(
    join(root, path),
    readFileSync(join(root, path), 'utf8').replace(
      '旧课程。',
      '1. [旧标题](../lessons/lesson-002.md) — pending。',
    ),
  );

  updatePlan(root, path, {
    decision: 'active',
    currentPosition: '继续诊断。',
    nextLessonCandidate: '准备下一课。',
    planSummary: '保留当前 Plan。',
  });

  const source = readFileSync(join(root, path), 'utf8');
  expect(source.indexOf('[第二课](../lessons/lesson-002.md) — prepared。'))
    .toBeLessThan(source.indexOf('[第一课](../lessons/lesson-001.md) — closed。'));
  expect(source).not.toContain('其他 Plan 的课');
  expect(readPlanWorkspace(root, 'p1').lessons.map(({ id, status }) => ({ id, status })))
    .toEqual([
      { id: 'lesson-002', status: 'prepared' },
      { id: 'lesson-001', status: 'closed' },
    ]);
});

test('synchronizes the Roadmap Plan status without dropping its human suffix', () => {
  const { root, path, roadmapPath } = planFixture();

  updatePlan(root, path, {
    decision: 'complete',
    currentPosition: '能力标准已满足。',
    nextLessonCandidate: '无。',
    planSummary: '决定：完成。',
  });

  expect(readFileSync(roadmapPath, 'utf8')).toContain(
    '- [测试 Plan](plans/p1.md) — completed；保留人工说明。',
  );
});

test('leaves a Plan byte-for-byte unchanged when an audit section is missing', () => {
  const { root, path, roadmapPath } = planFixture();
  const absolute = join(root, path);
  const before = readFileSync(absolute, 'utf8').replace('## Plan Summary', '## Summary Missing');
  const roadmapBefore = readFileSync(roadmapPath, 'utf8');
  writeFileSync(absolute, before);

  expect(() => updatePlan(root, path, {
    decision: 'active',
    currentPosition: '不会写入。',
    nextLessonCandidate: '不会写入。',
    planSummary: '不会写入。',
  })).toThrow('SECTION_NOT_FOUND: Plan Summary');
  expect(readFileSync(absolute, 'utf8')).toBe(before);
  expect(readFileSync(roadmapPath, 'utf8')).toBe(roadmapBefore);
});

test('registers a real Plan in the Roadmap exactly once', () => {
  const { root, roadmapPath } = registrationFixture();

  const registered = registerPlan(root, 'isomorphic-transformation');
  const afterFirst = readFileSync(roadmapPath, 'utf8');
  const repeated = registerPlan(root, 'isomorphic-transformation');

  expect(registered).toEqual({
    id: 'isomorphic-transformation',
    title: '同构变形',
    path: 'plans/isomorphic-transformation.md',
    coachSessionId: null,
  });
  expect(repeated).toEqual(registered);
  expect(afterFirst).toContain(
    '- [同构变形](plans/isomorphic-transformation.md)',
  );
  expect(readFileSync(roadmapPath, 'utf8')).toBe(afterFirst);
  expect(
    afterFirst.match(/\]\(plans\/isomorphic-transformation\.md\)/g),
  ).toHaveLength(1);
});

test('rejects invalid Plan registration without changing the Roadmap', () => {
  const { root, roadmapPath, planPath } = registrationFixture();
  const before = readFileSync(roadmapPath, 'utf8');

  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace('kind: plan', 'kind: lesson'),
  );
  expect(() => registerPlan(root, 'isomorphic-transformation')).toThrow(
    'INVALID_PLAN_KIND',
  );
  expect(readFileSync(roadmapPath, 'utf8')).toBe(before);

  writeFileSync(
    planPath,
    readFileSync(planPath, 'utf8').replace('id: isomorphic-transformation', 'id: wrong'),
  );
  expect(() => registerPlan(root, 'isomorphic-transformation')).toThrow();
  expect(readFileSync(roadmapPath, 'utf8')).toBe(before);
});

test('requires the existing Plan Graph section before registration', () => {
  const { root, roadmapPath } = registrationFixture();
  const before = readFileSync(roadmapPath, 'utf8').replace(
    '## Plan Graph',
    '## Plans Missing',
  );
  writeFileSync(roadmapPath, before);

  expect(() => registerPlan(root, 'isomorphic-transformation')).toThrow(
    'SECTION_NOT_FOUND: Plan Graph',
  );
  expect(readFileSync(roadmapPath, 'utf8')).toBe(before);
});

test('writes and indexes a prepared Lesson exactly once', () => {
  const { root, path: planPath } = planFixture();
  mkdirSync(join(root, 'lessons'), { recursive: true });
  const input = {
    lessonId: 'lesson-blueprint-001',
    lessonPath: 'lessons/lesson-blueprint-001.md',
    lessonTitle: 'Blueprint 试验课',
    source: `---
id: lesson-blueprint-001
kind: lesson
plan_id: p1
status: prepared
---
# Blueprint 试验课
`,
  };

  const first = writePreparedLesson(root, planPath, input);
  const afterFirst = readFileSync(join(root, planPath), 'utf8');
  const second = writePreparedLesson(root, planPath, input);

  expect(first).toEqual({
    id: 'lesson-blueprint-001',
    title: 'Blueprint 试验课',
    path: 'lessons/lesson-blueprint-001.md',
    status: 'prepared',
  });
  expect(second).toEqual(first);
  expect(afterFirst.match(/\]\(\.\.\/lessons\/lesson-blueprint-001\.md\)/g)).toHaveLength(1);
  expect(readFileSync(join(root, planPath), 'utf8')).toBe(afterFirst);
});

test('rejects Lesson preparation from a completed Plan before writing anything', () => {
  const { root, path: planPath } = planFixture();
  const absolutePlan = join(root, planPath);
  writeFileSync(
    absolutePlan,
    readFileSync(absolutePlan, 'utf8').replace('status: prepared', 'status: completed'),
  );
  const planBefore = readFileSync(absolutePlan, 'utf8');
  const lessonPath = 'lessons/lesson-after-completion.md';

  expect(() => writePreparedLesson(root, planPath, {
    lessonId: 'lesson-after-completion',
    lessonPath,
    lessonTitle: '不应写入',
    source: `---
id: lesson-after-completion
kind: lesson
plan_id: p1
status: prepared
---
# 不应写入
`,
  })).toThrow('PLAN_PREPARATION_REQUIRES_REACTIVATION');

  expect(existsSync(join(root, lessonPath))).toBeFalse();
  expect(readFileSync(absolutePlan, 'utf8')).toBe(planBefore);
});

test('never lets another Plan take ownership of an existing prepared Lesson', () => {
  const { root, path: firstPlanPath } = planFixture();
  const secondPlanPath = 'plans/p2.md';
  writeFileSync(join(root, secondPlanPath), `---
id: p2
kind: plan
status: active
---
# Plan：第二 Plan

## Lesson Index

（暂无）

## Current Position

尚未开始。

## Next Lesson Candidate

待定。

## Plan Summary

尚无。
`);
  const lessonPath = 'lessons/lesson-shared.md';
  writePreparedLesson(root, firstPlanPath, {
    lessonId: 'lesson-shared',
    lessonPath,
    lessonTitle: '第一 Plan 的课',
    source: `---
id: lesson-shared
kind: lesson
plan_id: p1
status: prepared
---
# 第一 Plan 的课
`,
  });
  const lessonBefore = readFileSync(join(root, lessonPath), 'utf8');
  const firstPlanBefore = readFileSync(join(root, firstPlanPath), 'utf8');
  const secondPlanBefore = readFileSync(join(root, secondPlanPath), 'utf8');

  expect(() => writePreparedLesson(root, secondPlanPath, {
    lessonId: 'lesson-shared',
    lessonPath,
    lessonTitle: '第二 Plan 试图抢占',
    source: `---
id: lesson-shared
kind: lesson
plan_id: p2
status: prepared
---
# 第二 Plan 试图抢占
`,
  })).toThrow(
    /LESSON_PLAN_OWNERSHIP_CONFLICT.*lesson-shared.*existing=p1.*requested=p2/s,
  );

  expect(readFileSync(join(root, lessonPath), 'utf8')).toBe(lessonBefore);
  expect(readFileSync(join(root, firstPlanPath), 'utf8')).toBe(firstPlanBefore);
  expect(readFileSync(join(root, secondPlanPath), 'utf8')).toBe(secondPlanBefore);
});

test('replaces prepared content but never overwrites a started Lesson', () => {
  const { root, path: planPath } = planFixture();
  mkdirSync(join(root, 'lessons'), { recursive: true });
  const lessonPath = 'lessons/lesson-blueprint-001.md';
  const prepared = `---
id: lesson-blueprint-001
kind: lesson
plan_id: p1
status: prepared
---
# First
`;
  writePreparedLesson(root, planPath, {
    lessonId: 'lesson-blueprint-001',
    lessonPath,
    lessonTitle: 'First',
    source: prepared,
  });
  writePreparedLesson(root, planPath, {
    lessonId: 'lesson-blueprint-001',
    lessonPath,
    lessonTitle: 'Reprepared',
    source: prepared.replace('# First', '# Reprepared'),
  });
  expect(readFileSync(join(root, lessonPath), 'utf8')).toContain('# Reprepared');

  writeFileSync(
    join(root, lessonPath),
    readFileSync(join(root, lessonPath), 'utf8').replace('status: prepared', 'status: active'),
  );
  expect(() => writePreparedLesson(root, planPath, {
    lessonId: 'lesson-blueprint-001',
    lessonPath,
    lessonTitle: 'Forbidden',
    source: prepared,
  })).toThrow('LESSON_REPREPARE_REQUIRES_NEW_ID');
  expect(readFileSync(join(root, lessonPath), 'utf8')).toContain('status: active');
});
