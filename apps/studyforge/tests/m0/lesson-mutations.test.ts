import { expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLessonSource } from '../../src/study/markdown';
import {
  appendClassroomLogSource,
  applyClassroomChange,
  type LessonBlockDraft,
} from '../../src/study/lesson-mutations';

const root = join(import.meta.dir, '../fixtures/m0-learning-set');
const lessonPath = 'plans/plan-001/lessons/lesson-001.md';

function fixtureSource(): string {
  return readFileSync(join(root, lessonPath), 'utf8');
}

function setBlockStatus(source: string, blockId: string, status: string): string {
  const start = source.indexOf(`## Block ${blockId}：`);
  if (start < 0) throw new Error(`missing ${blockId}`);
  const end = source.indexOf('\n## Block ', start + 1);
  const boundary = end < 0 ? source.length : end;
  const block = source.slice(start, boundary).replace(
    /^- Status:.*$/m,
    `- Status: ${status}`,
  );
  return source.slice(0, start) + block + source.slice(boundary);
}

function draft(overrides: Partial<LessonBlockDraft> = {}): LessonBlockDraft {
  return {
    title: '补充分辨活动',
    kind: 'dialogue',
    required: false,
    dependsOn: ['block-001'],
    uses: ['cards/sample.card.yaml'],
    studentView: '请比较两个入口，并说出你选择当前入口的依据。',
    teacherControl: '观察学生能否独立识别结构，不先给方法名。',
    ...overrides,
  };
}

function insertAfterBlockTwo(source = fixtureSource(), block = draft()): string {
  return applyClassroomChange(root, lessonPath, source, {
    command: 'insert',
    placement: { position: 'after', anchorBlockId: 'block-002' },
    block,
  }).source;
}

test('parses a candidate Lesson source without touching disk', () => {
  const source = fixtureSource();

  expect(parseLessonSource(lessonPath, source).blocks).toHaveLength(2);
});

test('appends multiline evidence inside one log item without swallowing the next Block', () => {
  const next = appendClassroomLogSource(lessonPath, fixtureSource(), [
    '学生首次没有识别结构。',
    '## Block injected',
    '- Status: completed',
  ].join('\n'));

  const lesson = parseLessonSource(lessonPath, next);
  expect(lesson.blocks.map((block) => block.id)).toEqual(['block-001', 'block-002']);
  expect(lesson.blocks[1]?.classroomLog).toEqual([
    '学生首次没有识别结构。 ## Block injected - Status: completed',
  ]);
  expect(next).toContain('  ## Block injected');
  expect(next).toContain('  - Status: completed');
});

test('rejects log writes outside one active Lesson Block', () => {
  const source = fixtureSource();
  expect(() => appendClassroomLogSource(
    lessonPath,
    source.replace('status: active', 'status: closed'),
    '不会写入',
  )).toThrow('Lesson must be active');
  expect(() => appendClassroomLogSource(
    lessonPath,
    setBlockStatus(source, 'block-002', 'pending'),
    '不会写入',
  )).toThrow('exactly one active Block');
  expect(() => appendClassroomLogSource(
    lessonPath,
    setBlockStatus(source, 'block-001', 'active'),
    '不会写入',
  )).toThrow('exactly one active Block');
  expect(() => appendClassroomLogSource(lessonPath, source, '  \n  '))
    .toThrow('cannot be empty');
});

test('starts only an eligible pending Block when no Block is active', () => {
  const source = setBlockStatus(fixtureSource(), 'block-002', 'pending');
  const started = applyClassroomChange(root, lessonPath, source, {
    command: 'start',
    blockId: 'block-002',
  });
  expect(started.activeBlockId).toBe('block-002');
  expect(parseLessonSource(lessonPath, started.source).blocks[1]?.status).toBe('active');

  const unresolved = setBlockStatus(source, 'block-001', 'pending');
  expect(() => applyClassroomChange(root, lessonPath, unresolved, {
    command: 'start',
    blockId: 'block-002',
  })).toThrow('unresolved');
  expect(() => applyClassroomChange(root, lessonPath, fixtureSource(), {
    command: 'start',
    blockId: 'block-002',
  })).toThrow('active Block already exists');

  const escapedUse = source.replace(
    '- Uses: cards/sample.card.yaml',
    '- Uses: ../outside.card.yaml',
  );
  expect(() => applyClassroomChange(root, lessonPath, escapedUse, {
    command: 'start',
    blockId: 'block-002',
  })).toThrow('Uses path');
});

test('advances the current Block and starts its chosen successor atomically', () => {
  const inserted = insertAfterBlockTwo();
  const evidenced = appendClassroomLogSource(
    lessonPath,
    inserted,
    '学生独立指出参数位置决定先分离参数。',
  );
  const advanced = applyClassroomChange(root, lessonPath, evidenced, {
    command: 'advance',
    outcome: 'completed',
    nextBlockId: 'block-003',
  });
  const lesson = parseLessonSource(lessonPath, advanced.source);
  expect(lesson.blocks.find((block) => block.id === 'block-002')?.status).toBe('completed');
  expect(lesson.blocks.find((block) => block.id === 'block-003')?.status).toBe('active');
  expect(advanced.activeBlockId).toBe('block-003');
});

test('refuses to advance without classroom evidence or into an unresolved successor', () => {
  expect(() => applyClassroomChange(root, lessonPath, fixtureSource(), {
    command: 'advance',
    outcome: 'completed',
    nextBlockId: null,
  })).toThrow('Classroom Log');

  const blockThree = insertAfterBlockTwo(fixtureSource(), draft({ dependsOn: ['block-002'] }));
  const blockFour = applyClassroomChange(root, lessonPath, blockThree, {
    command: 'insert',
    placement: { position: 'after', anchorBlockId: 'block-003' },
    block: draft({ title: '后继活动', dependsOn: ['block-003'] }),
  }).source;
  const evidenced = appendClassroomLogSource(lessonPath, blockFour, '已记录当前活动结果。');
  expect(() => applyClassroomChange(root, lessonPath, evidenced, {
    command: 'advance',
    outcome: 'completed',
    nextBlockId: 'block-004',
  })).toThrow('unresolved');
});

test('inserts one pending Block with a runtime-generated ID at the exact placement', () => {
  const receipt = applyClassroomChange(root, lessonPath, fixtureSource(), {
    command: 'insert',
    placement: { position: 'before', anchorBlockId: 'block-002' },
    block: draft(),
  });
  const lesson = parseLessonSource(lessonPath, receipt.source);
  expect(receipt.createdBlockId).toBe('block-003');
  expect(lesson.blocks.map((block) => block.id)).toEqual([
    'block-001',
    'block-003',
    'block-002',
  ]);
  expect(lesson.blocks[1]).toMatchObject({
    title: '补充分辨活动',
    status: 'pending',
    classroomLog: [],
  });
});

test('revises a pending Block completely but never rewrites settled content', () => {
  const inserted = insertAfterBlockTwo();
  const revised = applyClassroomChange(root, lessonPath, inserted, {
    command: 'revise',
    blockId: 'block-003',
    block: draft({
      title: '缩短后的辨认',
      kind: 'reflection',
      required: true,
      studentView: '只说出决定入口的一个结构特征。',
      teacherControl: '只观察入口判断。',
    }),
  });
  expect(parseLessonSource(lessonPath, revised.source).blocks[2]).toMatchObject({
    id: 'block-003',
    title: '缩短后的辨认',
    kind: 'reflection',
    required: true,
    status: 'pending',
    classroomLog: [],
  });

  for (const blockId of ['block-001', 'block-002']) {
    expect(() => applyClassroomChange(root, lessonPath, inserted, {
      command: 'revise',
      blockId,
      block: draft(),
    })).toThrow('pending');
  }
});

test('moves only a pending Block and rejects cycles and self anchors', () => {
  const inserted = insertAfterBlockTwo();
  const moved = applyClassroomChange(root, lessonPath, inserted, {
    command: 'move',
    blockId: 'block-003',
    placement: { position: 'before', anchorBlockId: 'block-002' },
  });
  expect(parseLessonSource(lessonPath, moved.source).blocks.map((block) => block.id))
    .toEqual(['block-001', 'block-003', 'block-002']);
  expect(() => applyClassroomChange(root, lessonPath, inserted, {
    command: 'move',
    blockId: 'block-003',
    placement: { position: 'after', anchorBlockId: 'block-003' },
  })).toThrow('itself');

  const withFourth = applyClassroomChange(root, lessonPath, inserted, {
    command: 'insert',
    placement: { position: 'after', anchorBlockId: 'block-003' },
    block: draft({ title: '第四活动', dependsOn: ['block-003'] }),
  }).source;
  expect(() => applyClassroomChange(root, lessonPath, withFourth, {
    command: 'revise',
    blockId: 'block-003',
    block: draft({ dependsOn: ['block-004'] }),
  })).toThrow('dependency cycle');
});

test('skips a pending Block only after the active Block records the reason', () => {
  const inserted = insertAfterBlockTwo();
  expect(() => applyClassroomChange(root, lessonPath, inserted, {
    command: 'skip_pending',
    blockId: 'block-003',
  })).toThrow('reason');

  const evidenced = appendClassroomLogSource(
    lessonPath,
    inserted,
    '学生已直接表现出该辨认能力，因此不再走原补充活动。',
  );
  const skipped = applyClassroomChange(root, lessonPath, evidenced, {
    command: 'skip_pending',
    blockId: 'block-003',
  });
  expect(parseLessonSource(lessonPath, skipped.source).blocks[2]?.status).toBe('skipped');
});

test('keeps new Uses inside the current active Block evidence boundary', () => {
  expect(() => insertAfterBlockTwo(fixtureSource(), draft({
    uses: ['materials/note.md'],
  }))).toThrow('Uses');
  expect(() => insertAfterBlockTwo(fixtureSource(), draft({
    uses: ['cards/missing.card.yaml'],
  }))).toThrow('Uses');

  const noActive = applyClassroomChange(
    root,
    lessonPath,
    appendClassroomLogSource(lessonPath, fixtureSource(), '当前活动已有结果。'),
    { command: 'advance', outcome: 'completed', nextBlockId: null },
  ).source;
  expect(() => applyClassroomChange(root, lessonPath, noActive, {
    command: 'insert',
    placement: { position: 'after', anchorBlockId: 'block-002' },
    block: draft(),
  })).toThrow('Uses');
});
