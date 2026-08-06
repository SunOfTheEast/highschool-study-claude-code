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
  const tools = createPlanTools(copyFixture(), scope);
  expect(tools.map((tool) => tool.name)).toEqual(['artifact_export']);
  const tool = tools[0]!;
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
