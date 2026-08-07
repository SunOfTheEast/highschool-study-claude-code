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
import {
  planLessonMemoryCommit,
  type DocumentCandidate,
  type TraceDraft,
} from '../../src/study/memory-mutations';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
const recordedAt = '2026-08-07T20:15:00.000Z';
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-memory-mutations-'));
  cpSync(fixture, root, { recursive: true });
  mkdirSync(join(root, 'memory/objects'), { recursive: true });
  mkdirSync(join(root, 'memory/indexes'), { recursive: true });
  mkdirSync(join(root, 'memory/preferences'), { recursive: true });
  roots.push(root);
  return root;
}

function writeExistingObject(root: string, id = 'obj-001', title = '同构结构识别'): void {
  writeFileSync(join(root, `memory/objects/${id}.md`), [
    `# ${id}：${title}`,
    '',
    '## Current Judgment',
    '',
    '只能在完整示范后跟做。',
    '',
    '## Evolution Overview',
    '',
    '首次接触时没有形成稳定入口。',
    '',
    '## Trace Timeline',
    '',
    '- 2026-08-01 [trace-old](../../plans/plan-001/lessons/lesson-000.md#trace-old)',
    '  — 首次接触。',
    '',
    '## Boundaries / Not Yet Demonstrated',
    '',
    '- 尚无独立完成证据。',
    '',
  ].join('\n'));
}

function writeExistingBucket(
  root: string,
  id = 'algebraic-structure',
  title = '代数结构',
): void {
  writeFileSync(join(root, `memory/indexes/${id}.md`), [
    `# ${id}：${title}`,
    '',
    '## Objects',
    '',
  ].join('\n'));
}

function candidate(
  planned: { candidates: DocumentCandidate[] },
  path: string,
): DocumentCandidate {
  const found = planned.candidates.find((item) => item.path === path);
  if (!found) throw new Error(`candidate not found: ${path}`);
  return found;
}

function trace(key = 'event'): TraceDraft {
  return {
    key,
    situation: '同构变形的独立识别检验',
    firstPerformance: '没有主动比较两个式子的共同结构',
    actualHelp: '提醒比较结构后继续',
    laterPerformance: '完成变形，但尚未证明能自主识别',
    capabilitySignal: '外观变化后未主动寻找不变量',
    evidenceBlockIds: ['block-001'],
  };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

test('updates an existing object without reconsidering its buckets', () => {
  const root = copyFixture();
  writeExistingObject(root);
  writeExistingBucket(root);

  const planned = planLessonMemoryCommit(root, lessonPath, {
    traces: [trace()],
    objects: [{
      target: { kind: 'existing', id: 'obj-001' },
      currentJudgment: '能在明确提示后完成；自主识别尚未证明。',
      evolutionOverview: '从首次停顿到提示后完成。',
      boundaries: ['外观改变后的独立识别尚未证明。'],
      traceEntries: [{ traceKey: 'event', meaning: '提示后完成。' }],
      routing: { kind: 'keep' },
      frontierSummary: '提示后可完成，自主识别待检验。',
    }],
    preferences: [],
  }, recordedAt);

  expect(candidate(planned, lessonPath).after)
    .toContain('### trace-plan-001-lesson-001-01');
  expect(candidate(planned, 'memory/objects/obj-001.md').after)
    .toContain('## Trace Timeline');
  expect(candidate(planned, 'memory/objects/obj-001.md').after)
    .toContain('trace-plan-001-lesson-001-01');
  expect(candidate(planned, 'memory/objects/obj-001.md').after)
    .toContain('- 2026-08-01 [trace-old]');
  expect(planned.objectIds).toEqual({});
  expect(planned.candidates.some((item) => item.path.includes('/indexes/'))).toBeFalse();
});

test('assigns stable IDs and only the explicitly named buckets to a new object', () => {
  const root = copyFixture();
  writeExistingBucket(root);

  const planned = planLessonMemoryCommit(root, lessonPath, {
    traces: [trace()],
    objects: [{
      target: { kind: 'new', key: 'isomorphic-entry', title: '同构结构识别' },
      currentJudgment: '能在提示后完成同构变形。',
      evolutionOverview: '由无法选路到提示后完成。',
      boundaries: ['自主识别尚未证明。'],
      traceEntries: [{ traceKey: 'event', meaning: '提示后完成。' }],
      routing: {
        kind: 'assign',
        buckets: [
          { kind: 'existing', id: 'algebraic-structure' },
          { kind: 'new', key: 'route-choice', title: '函数表示与目标选路' },
        ],
      },
      frontierSummary: '同构入口需要提示。',
    }],
    preferences: [],
  }, recordedAt);

  expect(planned.traceIds).toEqual({ event: 'trace-plan-001-lesson-001-01' });
  expect(planned.objectIds).toEqual({ 'isomorphic-entry': 'obj-001' });
  expect(planned.bucketIds).toEqual({ 'route-choice': 'bucket-001' });
  expect(candidate(planned, 'memory/objects/obj-001.md').after)
    .toStartWith('# obj-001：同构结构识别');
  expect(candidate(planned, 'memory/indexes/algebraic-structure.md').after)
    .toContain('../objects/obj-001.md');
  expect(candidate(planned, 'memory/indexes/bucket-001.md').after)
    .toContain('../objects/obj-001.md');
  expect(candidate(planned, 'memory/INDEX.md').after)
    .toContain('(indexes/bucket-001.md)');
  expect(planned.candidates.filter((item) => item.path.includes('/indexes/')))
    .toHaveLength(2);
});

test('keeps a genuinely ambiguous new object reachable without inventing a bucket', () => {
  const root = copyFixture();

  const planned = planLessonMemoryCommit(root, lessonPath, {
    traces: [trace()],
    objects: [{
      target: { kind: 'new', key: 'target-distance', title: '函数表示与目标之间的距离' },
      currentJudgment: '能看出目标与原式不完全同形。',
      evolutionOverview: '开始注意表示形式与目标之间的距离。',
      boundaries: ['尚不能判断这是参数方程选路还是一般的目标构造。'],
      traceEntries: [{ traceKey: 'event', meaning: '开始比较目标形式。' }],
      routing: {
        kind: 'defer',
        reason: '暂难判断应归入参数方程选路还是更一般的目标同构构造。',
      },
    }],
    preferences: [],
  }, recordedAt);

  const index = candidate(planned, 'memory/INDEX.md').after;
  expect(index).toContain('## Deferred Object Routing');
  expect(index).toContain('[obj-001：函数表示与目标之间的距离](objects/obj-001.md)');
  expect(index).toContain('暂难判断应归入参数方程选路还是更一般的目标同构构造。');
  expect(planned.candidates.some((item) => item.path.includes('/indexes/'))).toBeFalse();
  expect(planned.bucketIds).toEqual({});
});

test('stores one Trace body while linking it from two object timelines', () => {
  const root = copyFixture();
  writeExistingObject(root, 'obj-001', '同构结构识别');
  writeExistingObject(root, 'obj-002', '参数主元选择');

  const objects = ['obj-001', 'obj-002'].map((id) => ({
    target: { kind: 'existing' as const, id },
    currentJudgment: '本次都出现了新的可复述表现。',
    evolutionOverview: '本次事件同时更新两个对象。',
    boundaries: ['独立迁移仍待检验。'],
    traceEntries: [{ traceKey: 'event', meaning: `本事件更新 ${id}。` }],
    routing: { kind: 'keep' as const },
  }));
  const planned = planLessonMemoryCommit(root, lessonPath, {
    traces: [trace()],
    objects,
    preferences: [],
  }, recordedAt);

  const lesson = candidate(planned, lessonPath).after;
  expect(lesson.match(/^### trace-plan-001-lesson-001-01$/gm)).toHaveLength(1);
  expect(lesson).toContain('- 关联对象：obj-001、obj-002');
  for (const id of ['obj-001', 'obj-002']) {
    expect(candidate(planned, `memory/objects/${id}.md`).after)
      .toContain('lesson-001.md#trace-plan-001-lesson-001-01');
  }
});

test('rejects incomplete semantic topology before returning candidates', () => {
  const root = copyFixture();
  writeExistingObject(root);

  expect(() => planLessonMemoryCommit(root, lessonPath, {
    traces: [trace('orphan')],
    objects: [],
    preferences: [],
  }, recordedAt)).toThrow('Trace orphan must be referenced');

  expect(() => planLessonMemoryCommit(root, lessonPath, {
    traces: [trace()],
    objects: [{
      target: { kind: 'new', key: 'new-object', title: '新对象' },
      currentJudgment: '当前判断。',
      evolutionOverview: '流变概述。',
      boundaries: ['边界。'],
      traceEntries: [{ traceKey: 'event', meaning: '意义。' }],
      routing: { kind: 'assign', buckets: [] },
    }],
    preferences: [],
  }, recordedAt)).toThrow('assign requires at least one bucket');

  expect(() => planLessonMemoryCommit(root, lessonPath, {
    traces: [trace()],
    objects: [{
      target: { kind: 'new', key: 'new-object', title: '新对象' },
      currentJudgment: '当前判断。',
      evolutionOverview: '流变概述。',
      boundaries: ['边界。'],
      traceEntries: [{ traceKey: 'event', meaning: '意义。' }],
      routing: { kind: 'keep' },
    }],
    preferences: [],
  }, recordedAt)).toThrow('new object cannot keep routing');
});

test('resolves existing IDs only through bounded canonical memory paths', () => {
  const root = copyFixture();

  expect(() => planLessonMemoryCommit(root, lessonPath, {
    traces: [trace()],
    objects: [{
      target: { kind: 'existing', id: '../outside' },
      currentJudgment: '当前判断。',
      evolutionOverview: '流变概述。',
      boundaries: ['边界。'],
      traceEntries: [{ traceKey: 'event', meaning: '意义。' }],
      routing: { kind: 'keep' },
    }],
    preferences: [],
  }, recordedAt)).toThrow('invalid object id');
});
