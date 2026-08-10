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
import { createLessonTools } from '../../src/runtime/lesson-tools';
import { readLesson } from '../../src/study/markdown';

const fixture = join(import.meta.dir, '../fixtures/m0-learning-set');
const lessonPath = 'plans/plan-001/lessons/lesson-001.md';
const roots: string[] = [];

function copyFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'studyforge-m0-lesson-tools-'));
  cpSync(fixture, root, { recursive: true });
  roots.push(root);
  return root;
}

afterEach(() => {
  while (roots.length > 0) rmSync(roots.pop()!, { recursive: true, force: true });
});

function draft(title = '补充分辨活动') {
  return {
    title,
    kind: 'dialogue' as const,
    required: false,
    dependsOn: ['block-001'],
    uses: ['cards/sample.card.yaml'],
    studentView: '比较两个入口，并说明选择依据。',
    teacherControl: '观察首次选路，不先提示方法名。',
  };
}

function setBlockStatus(root: string, blockId: string, status: string): void {
  const absolute = join(root, lessonPath);
  const source = readFileSync(absolute, 'utf8');
  const start = source.indexOf(`## Block ${blockId}：`);
  const end = source.indexOf('\n## Block ', start + 1);
  const boundary = end < 0 ? source.length : end;
  const block = source.slice(start, boundary).replace(
    /^- Status:.*$/m,
    `- Status: ${status}`,
  );
  writeFileSync(absolute, source.slice(0, start) + block + source.slice(boundary));
}

async function invoke(
  root: string,
  name: 'classroom_log_append' | 'classroom_update',
  input: unknown,
): Promise<Record<string, unknown>> {
  const tool = createLessonTools(root, lessonPath)
    .find((candidate) => candidate.name === name)!;
  const result = await tool.execute(
    `call-${name}`,
    input as never,
    undefined,
    undefined,
    {} as never,
  );
  return JSON.parse((result.content[0] as { text: string }).text) as Record<string, unknown>;
}

test('exposes two classroom tools plus the conditional M1 memory tool', () => {
  const root = copyFixture();
  const session = { getSessionId: () => 'lesson-session-001', getBranch: () => [] };
  const tools = createLessonTools(root, lessonPath, session);
  expect(tools.map((tool) => tool.name)).toEqual([
    'classroom_log_append',
    'classroom_update',
    'save_note',
    'save_problem_card',
    'lesson_memory_commit',
    'finish_lesson',
  ]);
  expect(tools.map((tool) => tool.executionMode)).toEqual([
    'sequential',
    'sequential',
    'sequential',
    'sequential',
    'sequential',
    'sequential',
  ]);
  const schemas = JSON.stringify(tools.map((tool) => tool.parameters));
  for (const forbidden of ['lessonPath', 'sessionId', 'timestamp', 'currentBlockId']) {
    expect(schemas).not.toContain(forbidden);
  }
  expect((tools[1]!.parameters as { type?: string }).type).toBe('object');
  expect(Check(tools[0]!.parameters, { note: '学生首次独立完成。' })).toBeTrue();
  expect(Check(tools[0]!.parameters, {
    note: '学生首次独立完成。',
    lessonPath,
  })).toBeFalse();

  const validChanges = [
    { command: 'start', blockId: 'block-002' },
    { command: 'advance', outcome: 'completed', nextBlockId: null },
    {
      command: 'insert',
      placement: { position: 'after', anchorBlockId: 'block-002' },
      block: draft(),
    },
    { command: 'revise', blockId: 'block-003', block: draft('修订活动') },
    {
      command: 'move',
      blockId: 'block-003',
      placement: { position: 'before', anchorBlockId: 'block-002' },
    },
    { command: 'skip_pending', blockId: 'block-003' },
  ];
  for (const change of validChanges) {
    expect(Check(tools[1]!.parameters, { change })).toBeTrue();
  }
  expect(Check(tools[1]!.parameters, {
    change: { command: 'advance', outcome: 'completed' },
  })).toBeFalse();
  expect(Check(tools[1]!.parameters, {
    change: { command: 'start', blockId: 'block-002', path: lessonPath },
  })).toBeFalse();

  const m0 = copyFixture();
  rmSync(join(m0, 'memory/INDEX.md'));
  expect(createLessonTools(m0, lessonPath, session).map((tool) => tool.name)).toEqual([
    'classroom_log_append',
    'classroom_update',
    'save_note',
    'save_problem_card',
    'finish_lesson',
  ]);
});

test('finishes only the runtime-bound active Lesson with no model authority fields', async () => {
  const root = copyFixture();
  const finish = createLessonTools(root, lessonPath)
    .find((tool) => tool.name === 'finish_lesson')!;

  expect(finish).toBeDefined();
  expect(Check(finish.parameters, {})).toBeTrue();
  expect(Check(finish.parameters, { lessonId: 'lesson-001' })).toBeFalse();

  const first = await finish.execute('finish-lesson-1', {}, undefined, undefined, {} as never);
  expect(JSON.parse((first.content[0] as { text: string }).text)).toEqual({
    ok: true,
    status: 'closed',
  });
  expect(readLesson(root, lessonPath).status).toBe('closed');

  await finish.execute('finish-lesson-1', {}, undefined, undefined, {} as never);
  expect(readLesson(root, lessonPath).status).toBe('closed');

  const prepared = copyFixture();
  const absolute = join(prepared, lessonPath);
  writeFileSync(absolute, readFileSync(absolute, 'utf8').replace('status: active', 'status: prepared'));
  const preparedFinish = createLessonTools(prepared, lessonPath)
    .find((tool) => tool.name === 'finish_lesson')!;
  await expect(preparedFinish.execute(
    'finish-lesson-prepared',
    {},
    undefined,
    undefined,
    {} as never,
  )).rejects.toThrow('expected active or closed');
  expect(readLesson(prepared, lessonPath).status).toBe('prepared');
});

test('appends one fact to the runtime-bound active Block and returns only a cursor', async () => {
  const root = copyFixture();
  const receipt = await invoke(root, 'classroom_log_append', {
    note: '学生首次没有识别结构。\n在一级方向提示后能继续。',
  });

  expect(receipt).toEqual({
    ok: true,
    activeBlockId: 'block-002',
    classroomLogCount: 1,
  });
  expect(JSON.stringify(receipt)).not.toContain('source');
  expect(readLesson(root, lessonPath).blocks[1]?.classroomLog).toEqual([
    '学生首次没有识别结构。 在一级方向提示后能继续。',
  ]);
});

test('executes every update branch and returns the latest runtime cursor', async () => {
  const startRoot = copyFixture();
  setBlockStatus(startRoot, 'block-002', 'pending');
  expect(await invoke(startRoot, 'classroom_update', {
    change: { command: 'start', blockId: 'block-002' },
  })).toMatchObject({ ok: true, command: 'start', activeBlockId: 'block-002' });

  const advanceRoot = copyFixture();
  await invoke(advanceRoot, 'classroom_log_append', { note: '当前活动已经产生证据。' });
  expect(await invoke(advanceRoot, 'classroom_update', {
    change: { command: 'advance', outcome: 'completed', nextBlockId: null },
  })).toMatchObject({ ok: true, command: 'advance', activeBlockId: null });

  const adaptRoot = copyFixture();
  const inserted = await invoke(adaptRoot, 'classroom_update', {
    change: {
      command: 'insert',
      placement: { position: 'after', anchorBlockId: 'block-002' },
      block: draft(),
    },
  });
  expect(inserted).toMatchObject({
    ok: true,
    command: 'insert',
    createdBlockId: 'block-003',
    activeBlockId: 'block-002',
  });
  expect(await invoke(adaptRoot, 'classroom_update', {
    change: { command: 'revise', blockId: 'block-003', block: draft('缩短活动') },
  })).toMatchObject({ ok: true, command: 'revise', activeBlockId: 'block-002' });
  expect(await invoke(adaptRoot, 'classroom_update', {
    change: {
      command: 'move',
      blockId: 'block-003',
      placement: { position: 'before', anchorBlockId: 'block-002' },
    },
  })).toMatchObject({ ok: true, command: 'move', activeBlockId: 'block-002' });
  await invoke(adaptRoot, 'classroom_log_append', {
    note: '学生已经直接表现出补充活动要观察的能力。',
  });
  expect(await invoke(adaptRoot, 'classroom_update', {
    change: { command: 'skip_pending', blockId: 'block-003' },
  })).toMatchObject({ ok: true, command: 'skip_pending', activeBlockId: 'block-002' });
});

test('leaves the Lesson byte-identical when an update fails', async () => {
  const root = copyFixture();
  const absolute = join(root, lessonPath);
  const before = readFileSync(absolute, 'utf8');

  await expect(invoke(root, 'classroom_update', {
    change: { command: 'advance', outcome: 'completed', nextBlockId: null },
  })).rejects.toThrow('Classroom Log');
  expect(readFileSync(absolute, 'utf8')).toBe(before);
});
