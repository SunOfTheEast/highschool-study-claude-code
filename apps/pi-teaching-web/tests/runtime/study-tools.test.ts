import { afterEach, expect, test } from 'bun:test';
import { cpSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readTraceRecords } from 'highschool-study-markdown/study-domain';
import { createClassroomUpdateTool } from '../../src/runtime/classroom-update';
import { createLessonCloseTool } from '../../src/runtime/lesson-close';
import { createPlanUpdateTool } from '../../src/runtime/plan-update';
import { createStudyTools } from '../../src/runtime/study-tools';

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

  await trace.execute('call-1', {
    blockId: 'assessment-01',
    cardAlias: 'Q-DOMAIN-EX22',
    assessment: 'partially_correct',
    support: 'tutor',
    note: 'Used one structural hint after an incomplete attempt.',
  } as never, undefined, undefined, {} as never);

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
