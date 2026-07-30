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
import {
  appendTrace,
  readTraceRecords,
} from 'highschool-study-markdown/study-domain';
import { Check } from 'typebox/value';
import { createClassroomUpdateTool } from '../../src/runtime/classroom-update';
import { createCardAlternativeAppendTool } from '../../src/runtime/card-alternative-append';
import { createLessonCloseTool } from '../../src/runtime/lesson-close';
import { createLessonPrepareTool } from '../../src/runtime/lesson-prepare';
import { createPlanUpdateTool } from '../../src/runtime/plan-update';
import * as studyToolModule from '../../src/runtime/study-tools';
import { updateParentDocument } from '../../src/runtime/tree-mutations';
import { readEvidence } from '../../src/study/ability';
import { readPlanWorkspace } from '../../src/study/read-workspace';
import { readStudentLessonPreview } from '../../src/study/student-plan-projection';
import { domainIntegrityFixtureRoot } from '../support/fixture-paths';

const { createStudyTools } = studyToolModule;

const root = domainIntegrityFixtureRoot;
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const temporaryRoot of temporaryRoots.splice(0)) {
    rmSync(temporaryRoot, { recursive: true, force: true });
  }
});

test('registers the existing four domain contracts without renaming them', () => {
  expect(createStudyTools(root, () => new Date('2026-07-22T00:00:00Z'), {
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  }).map((tool) => tool.name))
    .toEqual(['card_search', 'trace_search', 'trace_append', 'source_resolve']);
});

function addLessonCandidate(learningSetRoot: string): void {
  updateParentDocument(learningSetRoot, {
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
    childKind: 'lesson',
    candidateChanges: [{
      action: 'add',
      candidate: {
        publicPurpose: '完成一次独立能力检验。',
        after: 'lesson-candidate-003',
        dependsOn: ['lesson-candidate-003'],
        considerWhen: '需要继续核验迁移表现。',
        sources: ['trace:trace-fixture-002'],
        privateNote: '只改变题型外壳。',
      },
    }],
    sections: {},
    frontmatter: {},
  });
}

function activation() {
  return {
    parentSources: ['trace:trace-fixture-002'],
    selectedMemory: [],
    contentBoundary: ['首次尝试前不提示方法。'],
    adaptation: {
      workingJudgment: '定义域连续性已有正证据，迁移尚未确认。',
      sources: ['trace:trace-fixture-002'],
      designConsequence: '只改变题型外壳。',
      reviseIf: '学生无法识别新题的合法域。',
    },
  };
}

function lessonPrepareInput() {
  return {
    candidateHandle: 'lesson-candidate-004',
    blueprint: {
      title: 'Blueprint 试验课',
      publicPurpose: '完成一次独立能力检验。',
      capabilityTarget: '独立写全定义域并使用。',
      primaryTemplate: 'assessment',
      templateReason: '需要未见题证据。',
      adjustments: [] as string[],
      activation: activation(),
      cards: [{
        alias: 'Q-EX22',
        cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
        role: '连续性核验',
      }],
      sources: [] as Array<{ label: string; target: string; note: string }>,
      blocks: [
        {
          localAlias: 'attempt',
          kind: 'problem',
          required: true,
          dependsOn: [] as string[],
          uses: ['Q-EX22'],
          studentView: '请独立完成 `Q-EX22`。',
          teacherControl: '首次采用 zero。',
        },
        {
          localAlias: 'reflection',
          kind: 'reflection',
          required: true,
          dependsOn: ['attempt'],
          uses: [] as string[],
          studentView: '总结定义域的作用。',
          teacherControl: '只引用已产生证据。',
        },
      ],
    },
  };
}

test('prepares and rereads one Lesson with Plan authority bound by the Coach Session', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-lesson-prepare-tool-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const tool = createLessonPrepareTool(
    temporaryRoot,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  addLessonCandidate(temporaryRoot);
  const parameters = JSON.stringify(tool.parameters);
  expect(parameters).not.toContain('planPath');
  expect(parameters).not.toContain('lessonPath');
  expect(parameters).not.toContain('lessonId');
  expect(parameters).not.toContain('planContext');
  expect(parameters).not.toContain('status');
  expect(parameters).not.toContain('sessionId');

  const result = await tool.execute(
    'prepare-1',
    lessonPrepareInput() as never,
    undefined,
    undefined,
    {} as never,
  );
  const receipt = JSON.parse((result.content[0] as { text: string }).text);

  expect(receipt).toEqual({
    ok: true,
    ownerPath: 'plans/domain-integrity.md',
    factId: 'lesson-004',
    candidateHandle: 'lesson-candidate-004',
    status: 'prepared',
    lessonPath: 'lessons/lesson-004.md',
    publicTitle: '下一节课堂',
    publicPurpose: '完成一次独立能力检验',
    blockCount: 2,
    blockKinds: ['problem', 'reflection'],
    sourceNumbers: ['mst_p0032_ex22'],
  });
  const lesson = readPlanWorkspace(temporaryRoot, 'domain-integrity').lessons
    .find((candidate) => candidate.id === 'lesson-004');
  expect(lesson).toBeDefined();
  const preview = readStudentLessonPreview(temporaryRoot, lesson!);
  expect(receipt).toMatchObject({
    publicTitle: preview.publicTitle,
    publicPurpose: preview.publicPurpose,
    blockCount: preview.blockCount,
    blockKinds: preview.blockKinds,
    sourceNumbers: preview.sourceNumbers,
  });
  expect(readFileSync(
    join(temporaryRoot, 'plans/domain-integrity.md'),
    'utf8',
  )).toContain('../lessons/lesson-004.md');
});

test('defaults omitted lesson adjustments to an empty list', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-lesson-adjustments-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const tool = createLessonPrepareTool(
    temporaryRoot,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  addLessonCandidate(temporaryRoot);
  const input = lessonPrepareInput();
  delete (input.blueprint as { adjustments?: string[] }).adjustments;

  expect(Check(tool.parameters, input)).toBeTrue();
  await tool.execute(
    'prepare-no-adjustments',
    input as never,
    undefined,
    undefined,
    {} as never,
  );
  expect(readFileSync(
    join(temporaryRoot, 'lessons/lesson-004.md'),
    'utf8',
  )).toContain('- Adjustment: 无额外调整。');
});

test('keeps Lesson identity runtime-owned in the lesson_prepare contract', () => {
  const tool = createLessonPrepareTool(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  const input = lessonPrepareInput();
  expect(Check(tool.parameters, input)).toBeTrue();
  expect(Check(tool.parameters, {
    ...input,
    lessonId: 'lesson-manual',
  })).toBeFalse();
  expect(Object.keys((tool.parameters as {
    properties: Record<string, unknown>;
  }).properties)).toEqual(['candidateHandle', 'blueprint']);
});

test('accepts only the six canonical classroom template IDs', () => {
  const tool = createLessonPrepareTool(
    root,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  const input = lessonPrepareInput();
  const canonical = [
    'diagnostic',
    'concept',
    'deliberate-practice',
    'remediation',
    'assessment',
    'review',
  ] as const;

  for (const primaryTemplate of canonical) {
    expect(Check(tool.parameters, {
      ...input,
      blueprint: { ...input.blueprint, primaryTemplate },
    })).toBeTrue();
  }
  expect(Check(tool.parameters, {
    ...input,
    blueprint: { ...input.blueprint, primaryTemplate: 'practice' },
  })).toBeFalse();
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
  addLessonCandidate(temporaryRoot);
  const before = readFileSync(join(temporaryRoot, 'plans/domain-integrity.md'), 'utf8');
  const input = lessonPrepareInput();
  input.blueprint.cards = [{
    alias: 'FAKE',
    cardPath: 'cards/fake.card.yaml',
    role: 'fake',
  }];
  input.blueprint.blocks[0]!.uses = ['FAKE'];
  await expect(tool.execute('prepare-invalid', {
    ...input,
  } as never, undefined, undefined, {} as never)).rejects.toThrow('题卡不存在');
  expect(readFileSync(join(temporaryRoot, 'plans/domain-integrity.md'), 'utf8')).toBe(before);
  expect(existsSync(join(temporaryRoot, 'lessons/lesson-004.md'))).toBe(false);
});

test('rejects a missing Lesson source without writing or indexing a Lesson', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-lesson-source-invalid-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const tool = createLessonPrepareTool(
    temporaryRoot,
    'domain-integrity',
    'plans/domain-integrity.md',
  );
  addLessonCandidate(temporaryRoot);
  const planAbsolute = join(temporaryRoot, 'plans/domain-integrity.md');
  const planBefore = readFileSync(planAbsolute, 'utf8');
  const input = lessonPrepareInput();
  input.blueprint.sources = [{
    label: '不存在材料',
    target: 'materials/missing.md#missing',
    note: '不应写入。',
  }];
  await expect(tool.execute(
    'prepare-invalid-source',
    input as never,
    undefined,
    undefined,
    {} as never,
  ))
    .rejects.toThrow(/LESSON_BLUEPRINT_INVALID.*MISSING_FILE/);
  expect(existsSync(join(temporaryRoot, 'lessons/lesson-004.md')))
    .toBe(false);
  expect(readFileSync(planAbsolute, 'utf8')).toBe(planBefore);
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
    'goal', 'methods', 'path', 'source', 'title', 'traceHistory',
  ]);
  expect(cardPayload.cards[0]?.source)
    .toMatch(/^card:cards\/.+\.ya?ml$/);

  const traceResult = await traceSearch.execute('compact-trace', {
    planId: 'domain-integrity',
    limit: 20,
  } as never, undefined, undefined, {} as never);
  const tracePayload = JSON.parse((traceResult.content[0] as { text: string }).text) as {
    cardsByPath: Record<string, Record<string, unknown>>;
  };
  for (const card of Object.values(tracePayload.cardsByPath)) {
    expect(Object.keys(card).sort()).toEqual([
      'goal', 'methods', 'path', 'source', 'title', 'traceHistory',
    ]);
  }
});

test('keeps Plan Coach card and Trace search payloads metadata-only', async () => {
  const tools = createStudyTools(root, () => new Date('2026-07-22T00:00:00Z'), {
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  });
  const cardSearch = tools.find((tool) => tool.name === 'card_search')!;
  const traceSearch = tools.find((tool) => tool.name === 'trace_search')!;

  const cardResult = await cardSearch.execute('coach-card', {
    query: 'mst_p0019_ex11',
    limit: 2,
  } as never, undefined, undefined, {} as never);
  const cardPayload = JSON.parse((cardResult.content[0] as { text: string }).text) as {
    cards: Array<Record<string, unknown>>;
  };
  expect(Object.keys(cardPayload.cards[0]!).sort()).toEqual([
    'goal', 'methods', 'path', 'source', 'title', 'traceHistory',
  ]);

  const traceResult = await traceSearch.execute('coach-trace', {
    planId: 'domain-integrity',
    limit: 20,
  } as never, undefined, undefined, {} as never);
  const tracePayload = JSON.parse((traceResult.content[0] as { text: string }).text) as {
    cardsByPath: Record<string, Record<string, unknown>>;
  };
  for (const card of Object.values(tracePayload.cardsByPath)) {
    expect(Object.keys(card).sort()).toEqual([
      'goal', 'methods', 'path', 'source', 'title', 'traceHistory',
    ]);
  }
});

test('binds source_resolve to one source and removes model-owned origin paths', () => {
  const plan = createStudyTools(root, () => new Date(), {
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  });
  const resolver = plan.find((tool) => tool.name === 'source_resolve')!;
  const properties = (resolver.parameters as {
    properties: Record<string, unknown>;
  }).properties;

  expect(Object.keys(properties)).toEqual(['source']);
  expect(JSON.stringify(resolver.parameters)).not.toContain('fromPath');
  expect(JSON.stringify(resolver.parameters)).not.toContain('target');
});

test('forces Trace search to the current Plan or Lesson scope', async () => {
  const planTools = createStudyTools(root, () => new Date(), {
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  });
  const planSearch = planTools.find((tool) => tool.name === 'trace_search')!;
  const planProperties = (planSearch.parameters as {
    properties: Record<string, unknown>;
  }).properties;
  expect(Object.keys(planProperties)).not.toContain('planId');
  expect(Object.keys(planProperties)).toContain('lessonId');

  const lessonSearch = createStudyTools(root, () => new Date(), {
    nodeKind: 'lesson',
    nodeId: 'lesson-002',
    nodePath: 'lessons/lesson-002.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_search')!;
  const lessonProperties = (lessonSearch.parameters as {
    properties: Record<string, unknown>;
  }).properties;
  expect(Object.keys(lessonProperties)).not.toContain('planId');
  expect(Object.keys(lessonProperties)).not.toContain('lessonId');

  const result = await lessonSearch.execute('lesson-traces', {
    limit: 100,
  } as never, undefined, undefined, {} as never);
  const payload = JSON.parse((result.content[0] as { text: string }).text) as {
    traces: Array<{ lessonId: string }>;
  };
  expect(payload.traces).not.toHaveLength(0);
  expect(payload.traces.every((trace) => trace.lessonId === 'lesson-002')).toBe(true);
});

test('keeps card, Trace and source reads free of access facts', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-read-no-access-fact-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const before = readTraceRecords(temporaryRoot);
  const tools = createStudyTools(temporaryRoot, () => new Date(), {
    nodeKind: 'plan',
    nodeId: 'domain-integrity',
    nodePath: 'plans/domain-integrity.md',
    parentId: 'roadmap',
    parentPath: 'ROADMAP.md',
  });

  await tools.find((tool) => tool.name === 'card_search')!.execute(
    'read-card',
    { query: '定义域', limit: 5 },
    undefined,
    undefined,
    {} as never,
  );
  await tools.find((tool) => tool.name === 'trace_search')!.execute(
    'read-trace',
    { limit: 20 },
    undefined,
    undefined,
    {} as never,
  );
  await tools.find((tool) => tool.name === 'source_resolve')!.execute(
    'read-source',
    { source: 'trace:trace-fixture-002' },
    undefined,
    undefined,
    {} as never,
  );

  expect(readTraceRecords(temporaryRoot)).toEqual(before);
});

test('binds a Tutor Trace to its Lesson and refreshes planner attention', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const tools = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  });
  const trace = tools.find((tool) => tool.name === 'trace_append')!;
  const cardSearch = tools.find((tool) => tool.name === 'card_search')!;
  const traceSearch = tools.find((tool) => tool.name === 'trace_search')!;

  const appendResult = await trace.execute('call-1', {
    blockId: 'block-002',
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
    traceId: string;
    sourceRef: string;
    methods: { primary: string; secondary: string[] } | null;
    unresolvedMethods: string[];
  };
  expect(appended).toEqual(expect.objectContaining({
    ok: true,
    ownerPath: 'lessons/lesson-003.md',
    factId: appended.traceId,
  }));
  expect(appended.methods).toEqual({ primary: '参变量分离', secondary: ['同构变形与换元法'] });
  expect(appended.unresolvedMethods).toEqual([]);

  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']))
    .toEqual([expect.objectContaining({
      lessonPath: 'lessons/lesson-003.md',
      blockId: 'block-002',
      cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      cardStepId: null,
      support: 'tutor',
    })]);
  expect(readFileSync(join(temporaryRoot, 'memory/planner-attention.md'), 'utf8'))
    .toContain(appended.sourceRef);

  const cardResult = await cardSearch.execute('call-2', {
    query: 'mst_p0032_ex22',
    limit: 5,
  } as never, undefined, undefined, {} as never);
  const cardPayload = JSON.parse((cardResult.content[0] as { text: string }).text) as {
    cards: Array<{ path: string; traceHistory: Array<{ traceId: string }> }>;
  };
  expect(cardPayload.cards.find((card) => card.path === 'cards/derivative/mst_p0032_ex22.card.yaml')
    ?.traceHistory.map((record) => record.traceId)).toEqual([appended.traceId]);

  const traceResult = await traceSearch.execute('call-3', {
    lessonId: 'lesson-003',
    limit: 20,
  } as never, undefined, undefined, {} as never);
  const tracePayload = JSON.parse((traceResult.content[0] as { text: string }).text) as {
    traces: Array<{ traceId: string }>;
    cardsByPath: Record<string, unknown>;
  };
  expect(tracePayload.traces.map((record) => record.traceId)).toEqual([appended.traceId]);
  expect(Object.keys(tracePayload.cardsByPath))
    .toContain('cards/derivative/mst_p0032_ex22.card.yaml');
  expect(readEvidence(
    temporaryRoot,
    appended.sourceRef,
  ).card?.path).toBe('cards/derivative/mst_p0032_ex22.card.yaml');
});

test('rejects a second independent active Trace in the same problem Block', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-attempt-boundary-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const firstAttempt = {
    blockId: 'block-002',
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成当前题问。',
    methodStatus: 'unmapped',
    methodRoute: '学生完成当前题问的推理链。',
  };

  const firstResult = await trace.execute(
    'first-attempt',
    firstAttempt as never,
    undefined,
    undefined,
    {} as never,
  );
  const firstTraceId = (
    JSON.parse((firstResult.content[0] as { text: string }).text) as {
      traceId: string;
    }
  ).traceId;
  await expect(trace.execute('second-independent-attempt', {
    ...firstAttempt,
    note: '学生又完成了同一题卡中的另一问。',
    methodRoute: '学生完成另一题问的独立推理链。',
  } as never, undefined, undefined, {} as never)).rejects.toThrow(
    new RegExp(
      `TRACE_ATTEMPT_ALREADY_ACTIVE.*block-002.*${firstTraceId}.*新的 problem Block`,
      's',
    ),
  );

  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']))
    .toHaveLength(1);

  await trace.execute('same-attempt-revision', {
    ...firstAttempt,
    note: '学生补全了当前题问。',
    supersedes: firstTraceId,
  } as never, undefined, undefined, {} as never);
  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']))
    .toHaveLength(2);
});

test('rejects a supersede target when the selected Block has no active attempt', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-cross-block-supersede-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-30T00:00:00Z'), {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const attempt = {
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成。',
    methodStatus: 'unmapped',
    methodRoute: '学生完成一条推理链。',
  };

  const first = await trace.execute('first', {
    ...attempt,
    blockId: 'block-002',
  } as never, undefined, undefined, {} as never);
  const firstTraceId = (
    JSON.parse((first.content[0] as { text: string }).text) as {
      traceId: string;
    }
  ).traceId;
  await expect(trace.execute('cross-block', {
    ...attempt,
    blockId: 'block-004',
    supersedes: firstTraceId,
  } as never, undefined, undefined, {} as never))
    .rejects.toThrow(/TRACE_SUPERSEDES_WITHOUT_ACTIVE_ATTEMPT.*block-004/);
  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md'])).toHaveLength(1);
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
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
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
    blockId: 'block-002',
  } as never, undefined, undefined, {} as never);
  await trace.execute('part-two', {
    ...attempt,
    blockId: 'block-004',
  } as never, undefined, undefined, {} as never);

  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']))
    .toEqual(expect.arrayContaining([
      expect.objectContaining({
        blockId: 'block-002',
        cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      }),
      expect.objectContaining({
        blockId: 'block-004',
        cardPath: 'cards/derivative/mst_p0032_ex22.card.yaml',
      }),
    ]));
});

test('ignores a stale cardAlias and binds the card owned by the selected Block', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-cross-binding-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;

  await trace.execute('stale-alias', {
    blockId: 'block-002',
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
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;

  await expect(trace.execute('invalid-card-count', {
    blockId: 'block-002',
    assessment: 'incomplete',
    support: 'none',
    note: '未完成。',
    methodStatus: 'unmapped',
    methodRoute: '尚未形成路线。',
  } as never, undefined, undefined, {} as never)).rejects
    .toThrow(/LESSON_PROBLEM_CARD_COUNT.*block-002/);
  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md'])).toEqual([]);
});

test('reports missing and invalid Lesson aliases as non-retryable structure errors', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-tools-alias-errors-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const trace = createStudyTools(temporaryRoot, () => new Date('2026-07-22T00:00:00Z'), {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const input = {
    blockId: 'block-002',
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
  const close = createLessonCloseTool(temporaryRoot, 'lessons/lesson-003.md');

  const result = await close.execute('close-1', {
    summary: '本节课完成；仍缺一次未见题迁移证据。',
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

test('constrains Tutor Block arguments to the current Lesson', () => {
  const trace = createStudyTools(root, () => new Date(), {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const classroom = createClassroomUpdateTool(root, 'lessons/lesson-003.md');
  const traceInput = {
    blockId: 'block-002',
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成。',
    methodStatus: 'unmapped',
    methodRoute: '学生使用一条未归类路线。',
  };

  expect(Check(trace.parameters, traceInput)).toBeTrue();
  expect(Check(trace.parameters, {
    ...traceInput,
    blockId: 'invented-block',
  })).toBeFalse();
  expect(Check(classroom.parameters, { action: 'pause' })).toBeTrue();
  expect(Check(classroom.parameters, {
    action: 'activate',
    blockId: 'block-002',
  })).toBeTrue();
  expect(Check(classroom.parameters, {
    action: 'activate',
    blockId: 'invented-block',
  })).toBeFalse();
  expect(Check(classroom.parameters, {
    action: 'route',
    routeAction: 'move',
    blockId: 'block-004',
    before: 'block-005',
    reason: '学生决定先做迁移。',
    source: '#trace-event-001',
  })).toBeTrue();
  expect(Check(classroom.parameters, {
    action: 'route',
    blockId: 'block-004',
  })).toBeFalse();
  expect(Check(classroom.parameters, {
    action: 'route',
    routeAction: 'move',
    blockId: 'block-004',
    before: 'invented-block',
    reason: '非法锚点。',
    source: '#trace-event-001',
  })).toBeFalse();
  expect(Check(classroom.parameters, {
    action: 'pause',
    blockId: 'block-001',
  })).toBeFalse();
});

test('leaves the Lesson unchanged when classroom transition validation fails', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-classroom-transition-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const lessonPath = join(temporaryRoot, 'lessons/lesson-003.md');
  writeFileSync(
    lessonPath,
    readFileSync(lessonPath, 'utf8').replace('status: prepared', 'status: active'),
  );
  const classroom = createClassroomUpdateTool(temporaryRoot, 'lessons/lesson-003.md');

  await classroom.execute('activate-first-block', {
    action: 'activate',
    blockId: 'block-001',
  } as never, undefined, undefined, {} as never);
  const before = readFileSync(lessonPath, 'utf8');
  await expect(classroom.execute('activate-second', {
    action: 'activate',
    blockId: 'block-002',
  } as never, undefined, undefined, {} as never))
    .rejects.toThrow(/CLASSROOM_ACTIVE_BLOCK_EXISTS.*block-001/);
  expect(readFileSync(lessonPath, 'utf8')).toBe(before);
});

test('keeps runtime authority out of Tutor tool schemas', () => {
  const context = {
    nodeKind: 'lesson' as const,
    nodeId: 'not-the-file-name',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  };
  const trace = createStudyTools(root, () => new Date('2026-07-22T00:00:00Z'), context)
    .find((tool) => tool.name === 'trace_append')!;
  const classroom = createClassroomUpdateTool(root, context.nodePath);
  const close = createLessonCloseTool(root, context.nodePath);

  expect(JSON.stringify(trace.parameters)).not.toContain('cardStepId');
  expect(JSON.stringify(trace.parameters)).not.toContain('lessonPath');
  expect(JSON.stringify(classroom.parameters)).not.toContain('lessonPath');
  expect(Object.keys((classroom.parameters as {
    properties: Record<string, unknown>;
  }).properties)).not.toContain('reflection');
  expect(JSON.stringify(classroom.parameters)).not.toContain('summary');
  expect(JSON.stringify(classroom.parameters)).not.toContain('"close"');
  const closeProperties = (close.parameters as {
    properties: Record<string, unknown>;
  }).properties;
  expect(Object.keys(closeProperties)).toEqual(['summary']);
  expect(JSON.stringify(close.parameters)).not.toContain('reflection');
  expect(JSON.stringify(close.parameters)).not.toContain('lessonPath');
  expect(JSON.stringify(close.parameters)).not.toContain('blockId');

  expect(JSON.stringify(trace.parameters)).toContain('methodStatus');
  expect(JSON.stringify(trace.parameters)).toContain('methodRoute');
  expect(JSON.stringify(trace.parameters)).not.toContain('cardAlias');
  expect(JSON.stringify(trace.parameters)).not.toContain('methodResolution');
  expect(JSON.stringify(trace.parameters)).not.toContain('"methods"');
});

test('requires an explicit student-confirmed or unmapped method decision', () => {
  const trace = createStudyTools(root, () => new Date('2026-07-22T00:00:00Z'), {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const base = {
    blockId: 'block-002',
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
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;

  expect(trace.execute('call-invalid-confirmation', {
    blockId: 'block-002',
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
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;

  const appendResult = await trace.execute('call-unmapped', {
    blockId: 'block-002',
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
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;

  await trace.execute('cardless-reflection', {
    blockId: 'block-005',
    assessment: 'correct',
    support: 'none',
    note: '学生完成课后反思。',
    methodStatus: 'unmapped',
    methodRoute: '比较两次作答。',
  } as never, undefined, undefined, {} as never);

  expect(readTraceRecords(temporaryRoot, ['lessons/lesson-003.md']).at(-1))
    .toEqual(expect.objectContaining({
      blockId: 'block-005',
      cardPath: null,
    }));
});

test('exposes plan_update through a provider-compatible object root', () => {
  const tool = createPlanUpdateTool(root, 'plans/domain-integrity.md');
  const schema = tool.parameters as {
    type?: string;
    properties?: Record<string, unknown>;
  };

  expect(schema.type).toBe('object');
  expect(Object.keys(schema.properties ?? {})).toEqual([
    'decision',
    'currentPosition',
    'planSummary',
    'candidateChanges',
  ]);
});

test('exposes only active and replan plan_update decisions without path authority', () => {
  const tool = createPlanUpdateTool(root, 'plans/domain-integrity.md');
  const common = {
    currentPosition: '本周期继续。',
    planSummary: '继续进行。',
    candidateChanges: [],
  };

  expect(Check(tool.parameters, {
    decision: 'active',
    ...common,
  })).toBeTrue();
  expect(Check(tool.parameters, {
    decision: 'replan',
    ...common,
  })).toBeTrue();
  expect(Check(tool.parameters, {
    decision: 'complete',
    ...common,
  })).toBeFalse();
  expect(Check(tool.parameters, {
    decision: 'active',
    ...common,
    nextLessonCandidate: '旧字段。',
  })).toBeFalse();
  expect(JSON.stringify(tool.parameters)).not.toContain('planPath');
  expect(JSON.stringify(tool.parameters)).not.toContain('learningReview');
  expect(JSON.stringify(tool.parameters)).not.toContain('nextLessonCandidate');
});

test('updates Plan summary and unmaterialized Lesson candidates in one call', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-plan-update-tree-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const roadmapBefore = readFileSync(join(temporaryRoot, 'ROADMAP.md'), 'utf8');
  const tool = createPlanUpdateTool(
    temporaryRoot,
    'plans/domain-integrity.md',
  );
  const result = await tool.execute('plan-replan', {
    decision: 'replan',
    currentPosition: '第三节之后需要检查跨题型迁移。',
    planSummary: '保留已有课堂，只增加一项迁移候选。',
    candidateChanges: [{
      action: 'add',
      candidate: {
        publicPurpose: '检查跨题型迁移。',
        after: 'lesson-candidate-003',
        dependsOn: ['lesson-candidate-003'],
        considerWhen: '当前连续性核验完成后。',
        sources: ['trace:trace-fixture-002'],
        privateNote: '只改变题型外壳。',
      },
    }],
  } as never, undefined, undefined, {} as never);
  const payload = JSON.parse(
    (result.content[0] as { text: string }).text,
  ) as { candidateHandles: string[] };

  expect(payload.candidateHandles).toContain('lesson-candidate-004');
  expect(readPlanWorkspace(temporaryRoot, 'domain-integrity')).toMatchObject({
    plan: {
      status: 'active',
      currentPosition: '第三节之后需要检查跨题型迁移。',
      planSummary: '保留已有课堂，只增加一项迁移候选。',
    },
    lessonTree: [
      {},
      {},
      {},
      {
        handle: 'lesson-candidate-004',
        status: 'candidate',
        path: null,
      },
    ],
  });
  expect(readFileSync(join(temporaryRoot, 'ROADMAP.md'), 'utf8'))
    .toBe(roadmapBefore);
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
    'solution',
    'method',
    'support',
  ]);
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
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const traceResult = await trace.execute('alternative-source', {
    blockId: 'block-002',
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成一条真实替代路线。',
    methodStatus: 'unmapped',
    methodRoute: '学生先分离参数，再确定函数的取值边界。',
  } as never, undefined, undefined, {} as never);
  const sourceTraceId = (
    JSON.parse((traceResult.content[0] as { text: string }).text) as {
      traceId: string;
    }
  ).traceId;

  const alternative = createCardAlternativeAppendTool(
    temporaryRoot,
    'lessons/lesson-003.md',
    () => new Date('2026-07-22T00:01:00Z'),
  );
  const result = await alternative.execute('alternative-append', {
    sourceTraceId,
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

test('offers real part labels but validates them against the selected Trace card', async () => {
  const temporaryRoot = mkdtempSync(join(tmpdir(), 'study-alternative-parts-'));
  temporaryRoots.push(temporaryRoot);
  cpSync(root, temporaryRoot, { recursive: true });
  const cardPath = join(
    temporaryRoot,
    'cards/derivative/mst_p0032_ex22.card.yaml',
  );
  writeFileSync(
    cardPath,
    readFileSync(cardPath, 'utf8').replace(
      'parts: &a1 []',
      [
        'parts: &a1',
        '  - part_id: 第（1）问',
        '  - part_id: 第（2）问',
      ].join('\n'),
    ),
  );
  const trace = createStudyTools(temporaryRoot, () => new Date(), {
    nodeKind: 'lesson',
    nodeId: 'lesson-003',
    nodePath: 'lessons/lesson-003.md',
    parentId: 'domain-integrity',
    parentPath: 'plans/domain-integrity.md',
  }).find((tool) => tool.name === 'trace_append')!;
  const partTraceResult = await trace.execute('part-source', {
    blockId: 'block-002',
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成第一问。',
    methodStatus: 'unmapped',
    methodRoute: '学生完成了第一问的不同路线。',
  } as never, undefined, undefined, {} as never);
  const partTraceId = (
    JSON.parse((partTraceResult.content[0] as { text: string }).text) as {
      traceId: string;
    }
  ).traceId;
  const alternative = createCardAlternativeAppendTool(
    temporaryRoot,
    'lessons/lesson-003.md',
    () => new Date(),
  );
  const valid = {
    sourceTraceId: partTraceId,
    question: '第（1）问',
    solution: '这是第一问的完整另解。',
    method: null,
    support: 'none',
  };

  expect(Check(alternative.parameters, valid)).toBeTrue();
  expect(Check(alternative.parameters, {
    ...valid,
    question: '随便一问',
  })).toBeFalse();
  expect(Check(alternative.parameters, {
    sourceTraceId: partTraceId,
    solution: '缺少分问。',
    method: null,
    support: 'none',
  })).toBeTrue();
  const stored = await alternative.execute(
    'valid-part',
    valid,
    undefined,
    undefined,
    {} as never,
  );
  expect(JSON.parse((stored.content[0] as { text: string }).text))
    .toMatchObject({ question: '第（1）问' });
  await expect(alternative.execute(
    'missing-part',
    {
      sourceTraceId: partTraceId,
      solution: '缺少分问。',
      method: null,
      support: 'none',
    } as never,
    undefined,
    undefined,
    {} as never,
  )).rejects.toThrow('ALTERNATIVE_QUESTION_REQUIRED');

  const wholeTraceResult = await trace.execute('whole-card-source', {
    blockId: 'block-004',
    assessment: 'correct',
    support: 'none',
    note: '学生独立完成整题。',
    methodStatus: 'unmapped',
    methodRoute: '学生完成了整题的不同路线。',
  } as never, undefined, undefined, {} as never);
  const wholeTraceId = (
    JSON.parse((wholeTraceResult.content[0] as { text: string }).text) as {
      traceId: string;
    }
  ).traceId;
  await expect(alternative.execute(
    'part-from-another-card',
    {
      sourceTraceId: wholeTraceId,
      question: '第（1）问',
      solution: '错误地借用了另一题的分问标签。',
      method: null,
      support: 'none',
    },
    undefined,
    undefined,
    {} as never,
  )).rejects.toThrow('ALTERNATIVE_QUESTION_MUST_BE_OMITTED');
});
