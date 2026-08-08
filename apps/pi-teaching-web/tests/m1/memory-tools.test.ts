import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Check } from 'typebox/value';
import {
  createLessonMemoryTool,
  createPlanMemoryTools,
  memoryEnabled,
} from '../../src/runtime/memory-tools';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
const roots: string[] = [];

function copyFixture(hasMemory = true): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-memory-tools-'));
  cpSync(fixture, root, { recursive: true });
  if (hasMemory) {
    mkdirSync(join(root, 'memory/objects'), { recursive: true });
    mkdirSync(join(root, 'memory/indexes'), { recursive: true });
    mkdirSync(join(root, 'memory/preferences'), { recursive: true });
  } else {
    rmSync(join(root, 'memory/INDEX.md'));
  }
  roots.push(root);
  return root;
}

function commitInput() {
  return {
    objects: [{
      target: { kind: 'new' as const, key: 'target-distance', title: '函数表示与目标之间的距离' },
      currentJudgment: '开始注意目标与原式的形式差异。',
      evolutionOverview: '由直接计算转向比较目标形式。',
      boundaries: ['尚未证明能独立选路。'],
      learningHistoryEntry: {
        change: '开始比较目标形式，但对象归属仍不明确。',
        evidenceBlockIds: ['block-001'],
      },
      routing: { kind: 'defer' as const, reason: '需要阶段视角判断应归入哪种选路对象。' },
    }],
    preferences: [],
  };
}

async function execute(tool: NonNullable<ReturnType<typeof createLessonMemoryTool>>, id: string, input: unknown) {
  const result = await tool.execute(id, input as never, undefined, undefined, {} as never);
  return JSON.parse((result.content[0] as { text: string }).text) as Record<string, unknown>;
}

async function executePlan(tool: ReturnType<typeof createPlanMemoryTools>[number], id: string, input: unknown) {
  const result = await tool.execute(id, input as never, undefined, undefined, {} as never);
  return JSON.parse((result.content[0] as { text: string }).text) as Record<string, unknown>;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('registers memory tools only when the learning set opts into M1', () => {
  const m1 = copyFixture();
  const m0 = copyFixture(false);

  expect(memoryEnabled(m1)).toBeTrue();
  expect(memoryEnabled(m0)).toBeFalse();
  expect(createLessonMemoryTool(m1, lessonPath)?.name).toBe('lesson_memory_commit');
  expect(createLessonMemoryTool(m0, lessonPath)).toBeNull();
  expect(createPlanMemoryTools(m1).map((tool) => tool.name)).toEqual(['memory_route_resolve']);
  expect(createPlanMemoryTools(m0)).toEqual([]);
});

test('keeps paths, stable output IDs, time, and approval state out of both schemas', () => {
  const root = copyFixture();
  const lesson = createLessonMemoryTool(root, lessonPath)!;
  const route = createPlanMemoryTools(root)[0]!;

  expect(Check(lesson.parameters, commitInput())).toBeTrue();
  for (const extra of [
    { root },
    { lessonPath },
    { lessonId: 'lesson-001' },
    { timestamp: '2026-08-07' },
    { historyTimestamp: '2026-08-07' },
    { confirmed: true },
  ]) {
    expect(Check(lesson.parameters, { ...commitInput(), ...extra })).toBeFalse();
  }
  const routeInput = {
    objectId: 'obj-001',
    buckets: [{ kind: 'new', key: 'route-choice', title: '目标选路' }],
  };
  expect(Check(route.parameters, routeInput)).toBeTrue();
  expect(Check(route.parameters, { ...routeInput, path: 'memory/INDEX.md' })).toBeFalse();
  expect(Check(route.parameters, { objectId: 'obj-001', buckets: [] })).toBeFalse();
});

test('commits one bound semantic bundle and replays a successful native call ID once', async () => {
  const root = copyFixture();
  const tool = createLessonMemoryTool(root, lessonPath)!;

  const first = await execute(tool, 'memory-call-1', commitInput());
  const replay = await execute(tool, 'memory-call-1', commitInput());

  expect(first).toEqual(replay);
  expect(typeof first.durationMs).toBe('number');
  expect(Number.isFinite(first.durationMs as number)).toBeTrue();
  expect((first.durationMs as number) >= 0).toBeTrue();
  expect(first).toMatchObject({
    ok: true,
    commitId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    objectIds: { 'target-distance': 'obj-001' },
    preferenceIds: {},
    bucketIds: {},
    changedPaths: [
      'memory/objects/obj-001.md',
      'memory/INDEX.md',
    ],
  });
  const object = readFileSync(join(root, 'memory/objects/obj-001.md'), 'utf8');
  expect(object).toContain('## Learning History');
  expect(object).toContain('[lesson-001](../../plans/plan-001/lessons/lesson-001.md)');
  expect(object).toContain('Block `block-001`');
});

test('resolves only the declared deferred edge and replays its receipt once', async () => {
  const root = copyFixture();
  await execute(createLessonMemoryTool(root, lessonPath)!, 'seed-deferred', commitInput());
  writeFileSync(join(root, 'memory/indexes/algebraic-structure.md'), [
    '# algebraic-structure：代数结构',
    '',
    '## Objects',
    '',
  ].join('\n'));
  const tool = createPlanMemoryTools(root)[0]!;
  const input = {
    objectId: 'obj-001',
    buckets: [{ kind: 'existing', id: 'algebraic-structure' }],
  };

  const first = await executePlan(tool, 'route-1', input);
  const replay = await executePlan(tool, 'route-1', input);

  expect(first).toEqual(replay);
  expect(first).toMatchObject({
    ok: true,
    bucketIds: {},
    changedPaths: [
      'memory/indexes/algebraic-structure.md',
      'memory/INDEX.md',
    ],
    durationMs: expect.any(Number),
  });
  expect(readFileSync(join(root, 'memory/indexes/algebraic-structure.md'), 'utf8'))
    .toContain('../objects/obj-001.md');
  expect(readFileSync(join(root, 'memory/INDEX.md'), 'utf8'))
    .not.toContain('(objects/obj-001.md)');
});

test('does not cache failed native call IDs', async () => {
  const root = copyFixture();
  const tool = createPlanMemoryTools(root)[0]!;
  const input = {
    objectId: 'obj-001',
    buckets: [{ kind: 'new', key: 'route-choice', title: '目标选路' }],
  };
  await expect(executePlan(tool, 'retryable-route', input)).rejects.toThrow();
  await execute(createLessonMemoryTool(root, lessonPath)!, 'seed-after-failure', commitInput());

  expect(await executePlan(tool, 'retryable-route', input)).toMatchObject({
    ok: true,
    bucketIds: { 'route-choice': 'bucket-001' },
  });
});
