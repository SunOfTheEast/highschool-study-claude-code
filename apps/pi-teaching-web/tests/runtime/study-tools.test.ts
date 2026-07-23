import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTraceRecords } from 'highschool-study-markdown/study-domain';
import { Check } from 'typebox/value';
import { createClassroomUpdateTool } from '../../src/runtime/classroom-update';
import { createCardAlternativeAppendTool } from '../../src/runtime/card-alternative-append';
import { createLessonCloseTool } from '../../src/runtime/lesson-close';
import { createPlanRegisterTool } from '../../src/runtime/plan-register';
import { createPlanUpdateTool } from '../../src/runtime/plan-update';
import * as studyToolModule from '../../src/runtime/study-tools';

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
    cardAlias: 'Q-DOMAIN-EX22',
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
    methods: { primary: string; secondary: string[] } | null;
    unresolvedMethods: string[];
  };
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
    'required when this is a later revision of the same card-and-Block attempt',
  );
  expect(traceProperties.supersedes?.description).toContain(
    'exact active incomplete or partially_correct event ID',
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
    cardAlias: 'Q-DOMAIN-EX22',
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
    cardAlias: 'Q-DOMAIN-EX22',
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
    cardAlias: 'Q-DOMAIN-EX22',
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

test('exposes one flat Coach plan_update contract without path authority', () => {
  const tool = createPlanUpdateTool(root, 'plans/domain-integrity.md');
  const properties = (tool.parameters as {
    properties: Record<string, unknown>;
  }).properties;
  expect(Object.keys(properties)).toEqual([
    'decision',
    'lessonIndex',
    'currentPosition',
    'nextLessonCandidate',
    'planSummary',
  ]);
  expect(JSON.stringify(tool.parameters)).not.toContain('planPath');
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
  expect(Object.keys(properties)).toEqual(['sourceTraceId', 'question', 'solution']);
  expect(properties.question?.description).toContain('exactly `整题`');
});
