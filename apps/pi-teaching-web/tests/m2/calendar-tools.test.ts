import { afterEach, expect, test } from 'bun:test';
import { Check } from 'typebox/value';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCalendarRepository } from '../../src/calendar/appointments';
import { createCalendarTools } from '../../src/runtime/calendar-tools';
import {
  modelToolsForFreeLearning,
  modelToolsForNode,
  type StudySessionScope,
} from '../../src/runtime/session-scope';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const roots: string[] = [];

function setup() {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-calendar-tools-set-'));
  const appHome = mkdtempSync(join(tmpdir(), 'studyforge-calendar-tools-app-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root, appHome);
  const repository = createCalendarRepository(appHome, {
    now: () => new Date('2026-08-12T08:00:00.000Z'),
    id: () => crypto.randomUUID(),
  });
  return { root, repository };
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

async function execute(
  tool: ReturnType<typeof createCalendarTools>[number],
  input: unknown,
) {
  const result = await tool!.execute('call-001', input as never, undefined, undefined, {} as never);
  return JSON.parse((result.content[0] as { text: string }).text) as Record<string, any>;
}

function named(tools: ReturnType<typeof createCalendarTools>, name: string) {
  const tool = tools.find((candidate) => candidate.name === name);
  if (!tool) throw new Error(`missing tool ${name}`);
  return tool;
}

const planScope = {
  nodeKind: 'plan' as const,
  nodeId: 'plan-001',
  nodePath: 'plans/plan-001/PLAN.md',
  parentId: 'roadmap',
  parentPath: 'ROADMAP.md',
};

const lessonScope = {
  nodeKind: 'lesson' as const,
  nodeId: 'lesson-001',
  nodePath: 'plans/plan-001/lessons/lesson-001.md',
  parentId: 'plan-001',
  parentPath: 'plans/plan-001/PLAN.md',
};

test('binds Plan and Lesson appointments to the owning Plan', async () => {
  const { root, repository } = setup();
  const input = {
    title: '下次继续练选路',
    startsAt: '2026-08-13T12:00:00.000Z',
    plannedMinutes: 60,
  };

  for (const scope of [planScope, lessonScope]) {
    const tool = named(createCalendarTools(repository, root, scope), 'calendar_create');
    const receipt = await execute(tool, input);
    expect(receipt).toMatchObject({
      ok: true,
      appointment: {
        revision: 1,
        title: input.title,
        startsAt: input.startsAt,
        plannedMinutes: 60,
        destination: { kind: 'plan', planId: 'plan-001' },
      },
    });
    expect(JSON.stringify(receipt)).not.toContain(root);
  }

  expect(repository.list().map((item) => item.destination)).toEqual([
    { kind: 'plan', planId: 'plan-001' },
    { kind: 'plan', planId: 'plan-001' },
  ]);
});

test('binds Free Learning review contexts through selected aliases', async () => {
  const { root, repository } = setup();
  const scope = {
    sessionKind: 'free-learning' as const,
    title: '自由学习',
    createdAt: '2026-08-12T08:00:00.000Z',
    selectedAssets: [{ kind: 'problem-card' as const, id: 'sample-card' }],
  };
  const tools = createCalendarTools(repository, root, scope);
  const create = named(tools, 'calendar_create');
  const input = {
    title: '再看这道导数题',
    startsAt: '2026-08-13T12:00:00.000Z',
    plannedMinutes: null,
    intent: 'review',
    contextAliases: ['source-1'],
  };
  expect(Check(create.parameters, input)).toBeTrue();
  for (const extra of [
    { learningSetPath: root },
    { destination: { kind: 'plan', planId: 'plan-999' } },
    { createdAt: '2026-08-12T08:00:00.000Z' },
    { confirmed: true },
  ]) expect(Check(create.parameters, { ...input, ...extra })).toBeFalse();

  await execute(create, input);
  expect(repository.list()[0]?.destination).toEqual({
    kind: 'free-learning',
    intent: 'review',
    contexts: [{ kind: 'problem-card', id: 'sample-card' }],
  });
  await expect(execute(create, { ...input, contextAliases: ['source-2'] }))
    .rejects.toThrow('CALENDAR_CONTEXT_ALIAS_UNKNOWN');
});

test('keeps calendar tools out of Roadmap and Meta while exposing them only when configured', () => {
  const { root, repository } = setup();
  const roadmap: StudySessionScope = {
    nodeKind: 'roadmap', nodeId: 'roadmap', nodePath: 'ROADMAP.md',
    parentId: null, parentPath: null,
  };
  const meta: StudySessionScope = {
    sessionKind: 'meta', title: '课程入口讨论',
    createdAt: '2026-08-12T08:00:00.000Z', selectedAssets: [],
  };
  expect(createCalendarTools(repository, root, roadmap)).toEqual([]);
  expect(createCalendarTools(repository, root, meta)).toEqual([]);
  expect(modelToolsForNode('roadmap', false, false, true)).not.toContain('calendar_create');
  expect(modelToolsForNode('plan', false, false, true)).toContain('calendar_create');
  expect(modelToolsForNode('lesson', false, false, true)).toContain('calendar_create');
  expect(modelToolsForFreeLearning(false, false, false, true)).toContain('calendar_create');
  expect(modelToolsForFreeLearning(false, false, false, false)).not.toContain('calendar_create');
});

test('requires current revision for update/delete and stays inside the current learning set', async () => {
  const { root, repository } = setup();
  const tools = createCalendarTools(repository, root, planScope);
  const created = await execute(named(tools, 'calendar_create'), {
    title: '第一次约课', startsAt: '2026-08-13T12:00:00.000Z', plannedMinutes: null,
  });
  const id = created.appointment.id as string;
  const updated = await execute(named(tools, 'calendar_update'), {
    id, expectedRevision: 1, title: '改期后的约课',
    startsAt: '2026-08-14T12:00:00.000Z', plannedMinutes: 45,
  });
  expect(updated.appointment).toMatchObject({ revision: 2, title: '改期后的约课' });
  await expect(execute(named(tools, 'calendar_delete'), { id, expectedRevision: 1 }))
    .rejects.toThrow('CALENDAR_APPOINTMENT_STALE');
  await execute(named(tools, 'calendar_delete'), { id, expectedRevision: 2 });
  expect(repository.list()).toEqual([]);
});

test('keeps natural appointment approval in each behavior Skill instead of Runtime', () => {
  const skills = join(import.meta.dir, '../../resources/skills');
  for (const path of [
    'free-learning/SKILL.md',
    'plan-dialogue/SKILL.md',
    'tutor-lesson/SKILL.md',
  ]) {
    const source = readFileSync(join(skills, path), 'utf8');
    expect(source).toContain('公开完整约定 → 学生自然确认 → calendar_create');
    expect(source).toContain('不要求固定口令');
  }
});
