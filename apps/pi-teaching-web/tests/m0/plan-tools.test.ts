import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Check } from 'typebox/value';
import { createPlanTools } from '../../src/runtime/plan-tools';
import { readPlan } from '../../src/study/markdown';
import {
  formatLessonHandoutApiPath,
  formatLessonHandoutPath,
  parseHandoutBlockSegment,
} from '../../src/shared/handout-route';
import type { NodeSessionScope } from '../../src/runtime/session-scope';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

const scope: NodeSessionScope = {
  nodeKind: 'plan',
  nodeId: 'plan-001',
  nodePath: 'plans/plan-001/PLAN.md',
  parentId: 'roadmap',
  parentPath: 'ROADMAP.md',
};

function copyFixture(prepared = true): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-plan-tools-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  if (prepared) {
    const lesson = join(root, 'plans/plan-001/lessons/lesson-001.md');
    writeFileSync(
      lesson,
      readFileSync(lesson, 'utf8').replace('status: active', 'status: prepared'),
    );
  }
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('formats and parses one canonical handout route with ordered Block IDs', () => {
  expect(formatLessonHandoutPath(
    'plan-001',
    'lesson-001',
    ['block-002', 'block-001'],
  )).toBe('/course/plan/plan-001/lesson/lesson-001/handout/block-002,block-001');
  expect(formatLessonHandoutApiPath(
    'plan-001',
    'lesson-001',
    ['block-002', 'block-001'],
  )).toBe('/api/plans/plan-001/lessons/lesson-001/handout/block-002,block-001');
  expect(parseHandoutBlockSegment('block-002,block-001')).toEqual([
    'block-002',
    'block-001',
  ]);
  for (const invalid of ['', 'block-001,block-001', 'block-001,,block-002', '../secret']) {
    expect(parseHandoutBlockSegment(invalid)).toBeNull();
  }
  expect(() => formatLessonHandoutPath('plan-001', 'lesson-001', []))
    .toThrow('HANDOUT_BLOCK_IDS_REQUIRED');
  expect(() => formatLessonHandoutPath(
    'plan-001',
    'lesson-001',
    ['block-001', 'block-001'],
  )).toThrow('HANDOUT_BLOCK_ID_DUPLICATE');
});

test('exposes one Plan-bound export schema without a model-supplied Plan ID', () => {
  const session = { getSessionId: () => 'plan-session-001', getBranch: () => [] };
  const tools = createPlanTools(copyFixture(), scope, session);
  expect(tools.map((tool) => tool.name)).toEqual([
    'artifact_export',
    'propose_problem_card',
    'save_prepared_problem_card',
    'memory_route_resolve',
    'finish_plan',
  ]);
  const tool = tools.find((candidate) => candidate.name === 'artifact_export')!;
  expect(tool.executionMode).toBe('sequential');
  expect(Check(tool.parameters, {
    kind: 'lesson-handout',
    lessonId: 'lesson-001',
    blockIds: ['block-002', 'block-001'],
  })).toBeTrue();
  expect(Check(tool.parameters, {
    kind: 'lesson-handout',
    planId: 'plan-002',
    lessonId: 'lesson-001',
    blockIds: ['block-001'],
  })).toBeFalse();
  expect(Check(tool.parameters, {
    kind: 'lesson-handout',
    lessonId: 'lesson-001',
    blockIds: [],
  })).toBeFalse();

  const m0 = copyFixture();
  rmSync(join(m0, 'memory/INDEX.md'));
  expect(createPlanTools(m0, scope, session).map((candidate) => candidate.name))
    .toEqual(['artifact_export', 'propose_problem_card', 'save_prepared_problem_card', 'finish_plan']);
});

test('finishes only the runtime-bound active Plan with no model authority fields', async () => {
  const root = copyFixture();
  const finish = createPlanTools(root, scope)
    .find((tool) => tool.name === 'finish_plan')!;

  expect(finish).toBeDefined();
  expect(Check(finish.parameters, {})).toBeTrue();
  expect(Check(finish.parameters, { planId: 'plan-001' })).toBeFalse();

  const first = await finish.execute('finish-plan-1', {}, undefined, undefined, {} as never);
  expect(JSON.parse((first.content[0] as { text: string }).text)).toEqual({
    ok: true,
    status: 'completed',
  });
  expect(readPlan(root, scope.nodePath).status).toBe('completed');

  await finish.execute('finish-plan-1', {}, undefined, undefined, {} as never);
  expect(readPlan(root, scope.nodePath).status).toBe('completed');

  const prepared = copyFixture();
  const absolute = join(prepared, scope.nodePath);
  writeFileSync(absolute, readFileSync(absolute, 'utf8').replace('status: active', 'status: prepared'));
  const preparedFinish = createPlanTools(prepared, scope)
    .find((tool) => tool.name === 'finish_plan')!;
  await expect(preparedFinish.execute(
    'finish-plan-prepared',
    {},
    undefined,
    undefined,
    {} as never,
  )).rejects.toThrow('expected active or completed');
  expect(readPlan(prepared, scope.nodePath).status).toBe('prepared');
});

test('returns only a safe URL receipt for a linked prepared Lesson', async () => {
  const root = copyFixture();
  const tool = createPlanTools(root, scope)[0]!;
  const result = await tool.execute(
    'export-1',
    {
      kind: 'lesson-handout',
      lessonId: 'lesson-001',
      blockIds: ['block-002', 'block-001'],
    },
    undefined,
    undefined,
    {} as never,
  );

  expect(result.details).toEqual({
    kind: 'lesson-handout',
    planId: 'plan-001',
    lessonId: 'lesson-001',
    blockIds: ['block-002', 'block-001'],
    title: 'Lesson 001：真实停点问诊',
    url: '/course/plan/plan-001/lesson/lesson-001/handout/block-002,block-001',
  });
  const serialized = JSON.stringify(result);
  expect(serialized).not.toContain('先观察这道题');
  expect(serialized).not.toContain('Teacher Control');
  expect(serialized).not.toContain('Classroom Log');
});

test('fails closed without changing course documents', async () => {
  const cases = [
    {
      root: copyFixture(false),
      input: {
        kind: 'lesson-handout',
        lessonId: 'lesson-001',
        blockIds: ['block-001'],
      },
      message: 'Lesson must be prepared',
    },
    {
      root: copyFixture(),
      input: {
        kind: 'lesson-handout',
        lessonId: 'lesson-404',
        blockIds: ['block-001'],
      },
      message: 'Lesson is not linked',
    },
    {
      root: copyFixture(),
      input: {
        kind: 'lesson-handout',
        lessonId: 'lesson-001',
        blockIds: ['block-404'],
      },
      message: 'handout Block not found',
    },
    {
      root: copyFixture(),
      input: {
        kind: 'lesson-handout',
        lessonId: 'lesson-001',
        blockIds: ['block-001', 'block-001'],
      },
      message: 'duplicate handout Block',
    },
  ];

  for (const item of cases) {
    const paths = [
      'ROADMAP.md',
      'plans/plan-001/PLAN.md',
      'plans/plan-001/lessons/lesson-001.md',
    ];
    const before = paths.map((path) => readFileSync(join(item.root, path), 'utf8'));
    const tool = createPlanTools(item.root, scope)[0]!;
    await expect(tool.execute(
      'export-failed',
      item.input as never,
      undefined,
      undefined,
      {} as never,
    )).rejects.toThrow(item.message);
    expect(paths.map((path) => readFileSync(join(item.root, path), 'utf8'))).toEqual(before);
  }
});
