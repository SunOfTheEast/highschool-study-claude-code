import { afterEach, expect, test } from 'bun:test';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTraceRecords } from 'highschool-study-markdown/study-domain';
import { Check } from 'typebox/value';
import { createClassroomUpdateTool } from '../../src/runtime/classroom-update';
import { createCardAlternativeAppendTool } from '../../src/runtime/card-alternative-append';
import { createLessonCloseTool } from '../../src/runtime/lesson-close';
import { createLessonPrepareTool } from '../../src/runtime/lesson-prepare';
import { createPlanRegisterTool } from '../../src/runtime/plan-register';
import { createPlanUpdateTool } from '../../src/runtime/plan-update';
import * as studyToolModule from '../../src/runtime/study-tools';
import { readEvidence } from '../../src/study/ability';
import { setBlockStatus } from '../../src/study/write-workspace';

const { createStudyTools } = studyToolModule;

const root = join(import.meta.dir, '../../../../examples/derivative-demo/learning-set');
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const temporaryRoot of temporaryRoots.splice(0)) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('registers the existing four domain contracts without renaming them', () => {
  expect(createStudyTools(root, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'coach',
    ownerId: 'domain-integrity',
    ownerPath: 'plans/domain-integrity.md',
  }).map((tool) => tool.name))
    .toEqual(['card_search', 'trace_search', 'trace_append', 'source_resolve']);
});

test('registers a Plan with a canonical receipt and clears a foreign Coach Session', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-plan-register-tool-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  writeFileSync(join(temporaryRoot, 'plans/isomorphic-transformation.md'), `---
id: isomorphic-transformation
kind: plan
status: active
coach_session: foreign-session
---
# Plan：同构变形
`);
  const tool = createPlanRegisterTool(temporaryRoot);

  const result = await tool.execute('register-1', {
    planId: 'isomorphic-transformation',
  }, undefined, undefined, {} as never);
  const payload = JSON.parse((result.content[0] as { text: string }).text) as {
    ok: boolean;
    ownerPath: string;
    factId: string;
    status: string;
  };

  expect(payload).toEqual(expect.objectContaining({
    ok: true,
    ownerPath: 'plans/isomorphic-transformation.md',
    factId: 'isomorphic-transformation',
    status: 'registered',
  }));
  expect(readFileSync(
    join(temporaryRoot, 'plans/isomorphic-transformation.md'),
    'utf8',
  )).toContain('coach_session: null');
});

test('prepares and rereads one Lesson with Plan authority bound by the Coach Session', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-lesson-prepare-tool-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const tool = createLessonPrepareTool(
    temporaryRoot,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  const parameters = JSON.stringify(tool.parameters);
  expect(parameters).not.toContain('planPath');
  expect(parameters).not.toContain('lessonPath');
  expect(parameters).not.toContain('status');
  expect(parameters).not.toContain('sessionId');

  const result = await tool.execute('prepare-1', {
    lessonId: 'lesson-blueprint-001',
    title: 'Blueprint 试验课',
    planContext: '核验定义域迁移。',
    capabilityTarget: '独立写全定义域并使用。',
    primaryTemplate: 'assessment',
    templateReason: '需要未见题证据。',
    adjustments: [],
    cards: [{
      alias: 'Q-EX22',
      cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      role: '连续性核验',
    }],
    sources: [],
    blocks: [
      {
        id: 'assessment-01',
        kind: 'problem',
        required: true,
        dependsOn: [],
        uses: ['Q-EX22'],
        studentView: '请独立完成 `Q-EX22`。',
        teacherControl: '首次采用 zero。',
      },
      {
        id: 'reflection',
        kind: 'reflection',
        required: true,
        dependsOn: ['assessment-01'],
        uses: [],
        studentView: '总结定义域的作用。',
        teacherControl: '只引用已产生证据。',
      },
    ],
  }, undefined, undefined, {} as never);
  const receipt = JSON.parse((result.content[0] as { text: string }).text);

  expect(receipt).toEqual({
    ok: true,
    ownerPath: 'plans/domain-integrity.md',
    factId: 'lesson-blueprint-001',
    status: 'prepared',
    lessonPath: 'lessons/lesson-blueprint-001.md',
    blockCount: 2,
  });
  expect(readFileSync(
    join(temporaryRoot, 'plans/domain-integrity.md'),
    'utf8',
  )).toContain('../lessons/lesson-blueprint-001.md');
});

test('rejects a nonexistent card without writing or indexing a Lesson', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-lesson-prepare-invalid-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const tool = createLessonPrepareTool(
    temporaryRoot,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  const before = readFileSync(join(temporaryRoot, 'plans/domain-integrity.md'), 'utf8');
  await expect(tool.execute('prepare-invalid', {
    lessonId: 'lesson-blueprint-invalid',
    title: 'Invalid',
    planContext: 'Invalid',
    capabilityTarget: 'Invalid',
    primaryTemplate: 'assessment',
    templateReason: 'Invalid',
    adjustments: [],
    cards: [{ alias: 'FAKE', cardPath: 'cards/fake.card.yaml', role: 'fake' }],
    sources: [],
    blocks: [{
      id: 'reflection',
      kind: 'reflection',
      required: true,
      dependsOn: [],
      uses: ['FAKE'],
      studentView: '反思。',
      teacherControl: '反思。',
    }],
  } as never, undefined, undefined, {} as never)).rejects.toThrow('题卡不存在');
  expect(readFileSync(join(temporaryRoot, 'plans/domain-integrity.md'), 'utf8')).toBe(before);
  expect(existsSync(join(temporaryRoot, 'lessons/lesson-blueprint-invalid.md'))).toBe(false);
});

test('exposes only read-only study tools for isolated child sessions', () => {
  const factory = (studyToolModule as unknown as {
    createReadOnlyStudyTools?: (root: string) => Array<{ name: string }>;
  }).createReadOnlyStudyTools;
  if (!factory) {
    expect(factory).toBeFunction();
    return;
  }
  expect(factory(root).map((tool) => tool.name))
    .toEqual(['card_search', 'trace_search', 'source_resolve']);
});

test('registers the read-only tools through the child-only Pi extension', async () => {
  const extensionPath = join(
    import.meta.dir,
    '../../resources/subagents/tools/study-readonly-tools.ts',
  );
  let loaded: { default: (pi: { registerTool(tool: { name: string }): void }) => void } | null = null;
  try {
    loaded = await import(extensionPath);
  } catch {
    // The assertion below is the RED failure before the extension exists.
  }
  expect(loaded).not.toBeNull();
  if (!loaded) return;

  const names: string[] = [];
  loaded.default({
    registerTool(tool) {
      names.push(tool.name);
    },
  });
  expect(names).toEqual(['card_search', 'trace_search', 'source_resolve']);
});

test('keeps child card and Trace search payloads metadata-only', async () => {
  const factory = studyToolModule.createReadOnlyStudyTools as unknown as (
    root: string,
    options: { compactCardPayloads: boolean },
  ) => ReturnType<typeof studyToolModule.createReadOnlyStudyTools>;
  const tools = factory(root, { compactCardPayloads: true });
  const cardSearch = tools.find((tool) => tool.name === 'card_search')!;
  const traceSearch = tools.find((tool) => tool.name === 'trace_search')!;

  const cardResult = await cardSearch.execute('compact-card', {
    query: 'mst_p0019_ex11',
    limit: 2,
  } as never, undefined, undefined, {} as never);
  const cardPayload = JSON.parse((cardResult.content[0] as { text: string }).text) as {
    cards: Array<Record<string, unknown>>;
  };
  expect(Object.keys(cardPayload.cards[0]!).sort()).toEqual([
    'goal', 'methods', 'path', 'title', 'traceHistory',
  ]);

  const traceResult = await traceSearch.execute('compact-trace', {
    planId: 'domain-integrity',
    limit: 20,
  } as never, undefined, undefined, {} as never);
  const tracePayload = JSON.parse((traceResult.content[0] as { text: string }).text) as {
    cardsByPath: Record<string, Record<string, unknown>>;
  };
  for (const card of Object.values(tracePayload.cardsByPath)) {
    expect(Object.keys(card).sort()).toEqual([
      'goal', 'methods', 'path', 'title', 'traceHistory',
    ]);
  }
});

test('binds a Tutor Trace to its Lesson and refreshes planner attention', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const tools = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  });
  const trace = tools.find((tool) => tool.name === 'trace_append')!;
  const cardSearch = tools.find((tool) => tool.name === 'card_search')!;
  const traceSearch = tools.find((tool) => tool.name === 'trace_search')!;

  const appendResult = await trace.execute('call-1', {
    blockId: 'assessment-01',
    assessment: 'partially_correct',
    support: 'tutor',
    note: 'Used one structural hint after an incomplete attempt.',
    methodStatus: 'student_confirmed',
    methodRoute: '学生把参数与自变量分离后取上确界。',
    methodPrimary: '参变量分离',
    methodSecondary: ['同构变形与换元法'],
    methodDecisiveStep: '学生把参数与自变量分离后取上确界。',
    methodConfirmation: '学生确认“参变量分离”贴切。',
  } as never, undefined, undefined, {} as never);

  const appended = JSON.parse((appendResult.content[0] as { text: string }).text) as {
    ok: boolean;
    ownerPath: string;
    factId: string;
    eventId: string;
    methods: { primary: string; secondary: string[] } | null;
    unresolvedMethods: string[];
  };
  expect(appended).toEqual(expect.objectContaining({
    ok: true,
    ownerPath: 'lessons/lesson-003.md',
    factId: appended.eventId,
  }));
  expect(appended.methods).toEqual({ primary: '参变量分离', secondary: ['同构变形与换元法'] });
  expect(appended.unresolvedMethods).toEqual([]);

  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']))
    .toEqual([expect.objectContaining({
      lessonPath: 'lessons/lesson-003.md',
      blockId: 'assessment-01',
      cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      cardStepId: null,
      support: 'tutor',
    })]);
  expect(readFileSync(join(temporaryRoot, 'memory/planner-attention.md'), 'utf8'))
    .toContain('lessons/lesson-003.md#trace-event-001');

  const cardResult = await cardSearch.execute('call-2', {
    query: 'mst_p0032_ex22',
    limit: 5,
  } as never, undefined, undefined, {} as never);
  const cardPayload = JSON.parse((cardResult.content[0] as { text: string }).text) as {
    cards: Array<{ path: string; traceHistory: Array<{ eventId: string }> }>;
  };
  expect(cardPayload.cards.find((card) => card.path === 'cards/derivative/mst_p0032_ex22.card.yaml')
    ?.traceHistory.map((record) => record.eventId)).toEqual(['event-001']);

  const traceResult = await traceSearch.execute('call-3', {
    lessonId: 'lesson-003',
    limit: 20,
  } as never, undefined, undefined, {} as never);
  const tracePayload = JSON.parse((traceResult.content[0] as { text: string }).text) as {
    traces: Array<{ eventId: string }>;
    cardsByPath: Record<string, unknown>;
  };
  expect(tracePayload.traces.map((record) => record.eventId)).toEqual(['event-001']);
  expect(Object.keys(tracePayload.cardsByPath))
    .toContain('cards/derivative/mst_p0032_ex22.card.yaml');
  expect(readEvidence(
    temporaryRoot,
    'lessons/lesson-003.md#trace-event-001',
  ).card?.path).toBe('cards/derivative/mst_p0032_ex22.card.yaml');
});

test('rejects a second independent active Trace in the same problem Block', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-attempt-boundary-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const firstAttempt = {
    blockId: 'assessment-01',
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成当前题问。',
    methodStatus: 'unmapped',
    methodRoute: '学生完成当前题问的推理链。',
  };

  await trace.execute(
    'first-attempt',
    firstAttempt as never,
    undefined,
    undefined,
    {} as never,
  );
  await expect(trace.execute('second-independent-attempt', {
    ...firstAttempt,
    note: '学生又完成了同一题卡中的另一问。',
    methodRoute: '学生完成另一题问的独立推理链。',
  } as never, undefined, undefined, {} as never)).rejects.toThrow(
    /TRACE_ATTEMPT_ALREADY_ACTIVE.*assessment-01.*event-001.*新的 problem Block/s,
  );

  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']))
    .toHaveLength(1);

  await trace.execute('same-attempt-revision', {
    ...firstAttempt,
    note: '学生补全了当前题问。',
    supersedes: 'event-001',
  } as never, undefined, undefined, {} as never);
  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']))
    .toHaveLength(2);
});

test('allows separate problem Blocks to record independent parts from the same card', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-part-blocks-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const lessonPath = join(temporaryRoot, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8')
      .replace('- Uses: Q-DOMAIN-EX16', '- Uses: Q-DOMAIN-EX22'),
  );
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const attempt = {
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成当前题问。',
    methodStatus: 'unmapped',
    methodRoute: '学生完成当前题问的推理链。',
  };

  await trace.execute('part-one', {
    ...attempt,
    blockId: 'assessment-01',
  } as never, undefined, undefined, {} as never);
  await trace.execute('part-two', {
    ...attempt,
    blockId: 'assessment-02',
  } as never, undefined, undefined, {} as never);

  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']))
    .toEqual([
      expect.objectContaining({
        blockId: 'assessment-01',
        cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      }),
      expect.objectContaining({
        blockId: 'assessment-02',
        cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      }),
    ]);
});

test('ignores a stale cardAlias and binds the card owned by the selected Block', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-cross-binding-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;

  await trace.execute('stale-alias', {
    blockId: 'assessment-01',
    cardAlias: 'Q-DOMAIN-EX16',
    assessment: 'correct',
    support: 'none',
    note: '独立完成。',
    methodStatus: 'unmapped',
    methodRoute: '独立完成当前题目。',
  } as never, undefined, undefined, {} as never);

  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md'])[0]?.cardPath)
    .toBe('cards/derivative/mst_p0032_ex22.card.yaml');
});

test.each([
  ['no card', '- Uses:'],
  ['multiple cards', '- Uses: Q-DOMAIN-EX22, Q-DOMAIN-EX16'],
] as const)('rejects a problem Block with %s before writing Trace', async (_name, usesLine) => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-card-count-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const lessonPath = join(temporaryRoot, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8').replace('- Uses: Q-DOMAIN-EX22', usesLine),
  );
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;

  await expect(trace.execute('invalid-card-count', {
    blockId: 'assessment-01',
    assessment: 'incomplete',
    support: 'none',
    note: '未完成。',
    methodStatus: 'unmapped',
    methodRoute: '尚未形成路线。',
  } as never, undefined, undefined, {} as never)).rejects
    .toThrow(/LESSON_PROBLEM_CARD_COUNT.*assessment-01/);
  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md'])).toEqual([]);
});

test('reports missing and invalid Lesson aliases as non-retryable structure errors', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-alias-errors-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const input = {
    blockId: 'assessment-01',
    assessment: 'incomplete',
    support: 'none',
    note: '未完成。',
    methodStatus: 'unmapped',
    methodRoute: '尚未形成路线。',
  };
  const lessonPath = join(temporaryRoot, 'lessons/lesson-003.md');
  const source = readFileSync(lessonPath, 'utf8');
  writeFileSync(
    lessonPath,
    source.replace(
      '- Uses: Q-DOMAIN-EX22',
      '- Uses: Q-MISSING',
    ),
  );

  await expect(trace.execute(
    'missing-alias',
    input as never,
    undefined,
    undefined,
    {} as never,
  )).rejects.toThrow(
    /LESSON_ALIAS_MISSING.*Q-MISSING.*Q-DOMAIN-EX05.*Q-DOMAIN-EX16.*Q-DOMAIN-EX22.*不要搜索、猜测或重试/s,
  );

  writeFileSync(
    lessonPath,
    source.replace(
      '- Q-DOMAIN-EX22: ../cards/derivative/mst_p0032_ex22.card.yaml',
      '- Q-DOMAIN-EX22: ../cards/derivative/does-not-exist.card.yaml',
    ),
  );
  await expect(trace.execute(
    'invalid-alias',
    input as never,
    undefined,
    undefined,
    {} as never,
  )).rejects.toThrow(
    /LESSON_ALIAS_INVALID.*Q-DOMAIN-EX22.*does-not-exist\.card\.yaml.*不要搜索、猜测或重试/s,
  );
});

test('returns an owner receipt only after lesson_close persists closure', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-close-receipt-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  setBlockStatus(temporaryRoot, 'lessons/lesson-003.md', 'reflection', 'active');
  const close = createLessonCloseTool(temporaryRoot, 'lessons/lesson-003.md');

  const result = await close.execute('close-1', {
    reflection: '我会先检查定义域。',
    summary: '本节课完成。',
  }, undefined, undefined, {} as never);
  const payload = JSON.parse((result.content[0] as { text: string }).text);

  expect(payload).toEqual({
    ok: true,
    ownerPath: 'lessons/lesson-003.md',
    status: 'closed',
  });
  expect(readFileSync(join(temporaryRoot, 'lessons/lesson-003.md'), 'utf8'))
    .toContain('status: closed');
});

test('registers classroom_update separately from the public study tools', () => {
  expect(createClassroomUpdateTool(root, 'lessons/lesson-003.md').name).toBe('classroom_update');
});

test('keeps runtime authority out of Tutor tool schemas', () => {
  const context = {
    role: 'tutor' as const,
    ownerId: 'not-the-file-name',
    ownerPath: 'lessons/lesson-003.md',
  };
  const trace = createStudyTools(root, () => new Date('2026-07-22T00:00:00Z'), context)
    .find((tool) => tool.name === 'trace_append')!;
  const classroom = createClassroomUpdateTool(root, context.ownerPath);
  const close = createLessonCloseTool(root, context.ownerPath);

  expect(JSON.stringify(trace.parameters)).not.toContain('cardStepId');
  expect(JSON.stringify(trace.parameters)).not.toContain('lessonPath');
  expect(JSON.stringify(classroom.parameters)).not.toContain('lessonPath');
  expect(JSON.stringify(classroom.parameters)).not.toContain('reflection');
  expect(JSON.stringify(classroom.parameters)).not.toContain('summary');
  expect(JSON.stringify(classroom.parameters)).not.toContain('"close"');
  const closeProperties = (close.parameters as {
    properties: Record<string, unknown>;
  }).properties;
  expect(Object.keys(closeProperties)).toEqual(['reflection', 'summary']);

  expect(JSON.stringify(trace.parameters)).toContain('methodStatus');
  expect(JSON.stringify(trace.parameters)).toContain('methodRoute');
  expect(JSON.stringify(trace.parameters)).not.toContain('cardAlias');
  expect(JSON.stringify(trace.parameters)).not.toContain('methodResolution');
  expect(JSON.stringify(trace.parameters)).not.toContain('"methods"');
  const traceProperties = (trace.parameters as {
    properties: Record<string, { description?: string }>;
  }).properties;
  expect(traceProperties.assessment?.description).toContain(
    "the student's own work before this tool call",
  );
  expect(traceProperties.assessment?.description).toContain(
    'Tutor-generated completions never count as student evidence',
  );
  expect(traceProperties.support?.description).toContain(
    'actual dependence on help used in this completed attempt',
  );
  expect(traceProperties.support?.description).toContain(
    'not whether a hint merely appeared in the Session',
  );
  expect(traceProperties.support?.description).not.toContain(
    'any Tutor hint already given',
  );
  expect(traceProperties.supersedes?.description).toContain(
    'same card-and-Block attempt already has an active Trace',
  );
  expect(traceProperties.supersedes?.description).toContain(
    'exact active event ID',
  );
  expect(traceProperties.supersedes?.description).toContain(
    'different problem Block',
  );
});

test('requires an explicit student-confirmed or unmapped method decision', () => {
  const trace = createStudyTools(root, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const base = {
    blockId: 'assessment-01',
    assessment: 'correct',
    support: 'none',
    note: '学生实际采用参变量分离。',
  };

  expect(Check(trace.parameters, base)).toBeFalse();
  expect(Check(trace.parameters, {
    ...base,
    methodStatus: 'student_confirmed',
    methodRoute: '学生把参数分离到不等式一侧。',
    methodPrimary: '参变量分离',
    methodSecondary: ['同构变形与换元法'],
    methodDecisiveStep: '学生把参数分离到不等式一侧。',
    methodConfirmation: '学生确认该节点贴切。',
  })).toBeTrue();
  expect(Check(trace.parameters, {
    ...base,
    methodStatus: 'student_confirmed',
    methodRoute: '学生固定 x 后研究 a。',
    methodPrimary: '参数单调性+极限必要性+端点验证',
    methodSecondary: ['参变量分离未使用'],
    methodDecisiveStep: '学生固定 x 后研究 a。',
    methodConfirmation: '学生确认。',
  })).toBeFalse();
  expect(Check(trace.parameters, {
    ...base,
    methodStatus: 'mapped',
    methodRoute: '学生把参数分离到不等式一侧。',
    methodPrimary: '参变量分离',
    methodDecisiveStep: '学生把参数分离到不等式一侧。',
  })).toBeFalse();
  expect(Check(trace.parameters, {
    ...base,
    methodStatus: 'unmapped',
    methodRoute: '固定 x 后研究 F_x(a) 的参数单调性，并验证边界。',
  })).toBeTrue();
});

test('rejects a student-confirmed method without confirmation evidence', async () => {
  const trace = createStudyTools(root, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;

  expect(trace.execute('call-invalid-confirmation', {
    blockId: 'assessment-01',
    assessment: 'correct',
    support: 'none',
    note: '学生路线。',
    methodStatus: 'student_confirmed',
    methodRoute: '学生路线。',
    methodPrimary: '参变量分离',
    methodDecisiveStep: '学生把参数分离到一侧。',
  } as never, undefined, undefined, {} as never)).rejects
    .toThrow('INVALID_METHOD_CONFIRMATION');
});

test('persists no method evidence for an explicit unmapped decision', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-unmapped-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;

  const appendResult = await trace.execute('call-unmapped', {
    blockId: 'assessment-01',
    assessment: 'correct',
    support: 'none',
    note: '学生使用参数单调性和边界验证，当前词表没有精确节点。',
    methodStatus: 'unmapped',
    methodRoute: '固定 x 后研究 F_x(a) 的参数单调性，并验证边界。',
  } as never, undefined, undefined, {} as never);

  const appended = JSON.parse((appendResult.content[0] as { text: string }).text) as {
    methods: { primary: string; secondary: string[] } | null;
  };
  expect(appended.methods).toBeNull();
  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md'])[0]?.methods).toBeNull();
});

test('keeps non-problem Trace cardless', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-cardless-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;

  await trace.execute('cardless-reflection', {
    blockId: 'reflection',
    assessment: 'correct',
    support: 'none',
    note: '学生完成课后反思。',
    methodStatus: 'unmapped',
    methodRoute: '比较两次作答。',
  } as never, undefined, undefined, {} as never);

  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']).at(-1))
    .toEqual(expect.objectContaining({
      blockId: 'reflection',
      cardPath: null,
    }));
});

test('exposes one flat Coach plan_update contract without path authority', () => {
  const tool = createPlanUpdateTool(root, 'plans/domain-integrity.md');
  const properties = (tool.parameters as {
    properties: Record<string, unknown>;
  }).properties;
  expect(Object.keys(properties)).toEqual([
    'decision',
    'currentPosition',
    'nextLessonCandidate',
    'planSummary',
  ]);
  expect(JSON.stringify(tool.parameters)).not.toContain('planPath');
  expect(JSON.stringify(tool.parameters)).not.toContain('lessonIndex');
});

test('keeps alternative append Tutor-only and Session-bound', () => {
  const tool = createCardAlternativeAppendTool(root, 'lessons/lesson-003.md', () => new Date());
  expect(tool.name).toBe('card_alternative_append');
  expect(JSON.stringify(tool.parameters)).not.toContain('lessonPath');
  expect(JSON.stringify(tool.parameters)).not.toContain('cardPath');
  expect(JSON.stringify(tool.parameters)).not.toContain('graphPath');
  const properties = (tool.parameters as {
    properties: Record<string, { description?: string }>;
  }).properties;
  expect(Object.keys(properties)).toEqual([
    'sourceTraceId',
    'question',
    'solution',
    'method',
    'support',
  ]);
  expect(properties.question?.description).toContain('exactly `整题`');
  const schema = JSON.stringify(tool.parameters);
  expect(schema).toContain('参变量分离');
  expect(schema).toContain('"null"');
  expect(schema).toContain('"none"');
  expect(schema).toContain('"tutor"');
  expect(schema).toContain('"external"');
  expect(schema).not.toContain('"id"');
});

test('rebuilds planner attention after appending an independently bound alternative', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-alternative-projection-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    role: 'tutor',
    ownerId: 'lesson-003',
    ownerPath: 'lessons/lesson-003.md',
  }).find((tool) => tool.name === 'trace_append')!;
  await trace.execute('alternative-source', {
    blockId: 'assessment-01',
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成一条真实替代路线。',
    methodStatus: 'unmapped',
    methodRoute: '学生先分离参数，再确定函数的取值边界。',
  } as never, undefined, undefined, {} as never);

  const alternative = createCardAlternativeAppendTool(
    temporaryRoot,
    'lessons/lesson-003.md',
    () => new Date('2026-07-22T00:01:00Z'),
  );
  const result = await alternative.execute('alternative-append', {
    sourceTraceId: 'event-001',
    question: '整题',
    solution: '分离参数后研究函数值域。',
    method: '参变量分离',
    support: 'none',
  }, undefined, undefined, {} as never);
  const payload = JSON.parse((result.content[0] as { text: string }).text) as {
    id: string;
    method: string | null;
  };

  expect(payload).toMatchObject({ id: 'alt-001', method: '参变量分离' });
  expect(readFileSync(join(temporaryRoot, 'memory/planner-attention.md'), 'utf8'))
    .toContain('参变量分离');
});
