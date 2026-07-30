import { expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { cpSync, mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { createStudyMcpServer } from '../../server/src/mcp/create-server';
import { parseChildTree, parseHandoff } from '../../server/src/domain';

const fixture = join(import.meta.dir, '../fixtures/learning-set');
const readFixture = (path: string) => readFileSync(join(fixture, path), 'utf8');

function body(result: unknown): Record<string, unknown> {
  const value = result as {
    content: Array<{ type: string; text?: string }>;
    structuredContent?: Record<string, unknown>;
  };
  const first = value.content[0];
  if (first?.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('Tool did not return JSON text');
  }
  const parsed = JSON.parse(first.text) as Record<string, unknown>;
  expect(parsed).toEqual(value.structuredContent as Record<string, unknown>);
  return parsed;
}

function persistenceFiles(root: string): string[] {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name.endsWith('.db') || entry.name.endsWith('-wal') || entry.name.endsWith('-shm')) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files;
}

test('proves the Markdown-only bidirectional learning loop', async () => {
  const root = mkdtempSync(join(tmpdir(), 'markdown-learning-loop-'));
  cpSync(fixture, root, { recursive: true });
  const server = createStudyMcpServer({
    learningSetRoot: root,
    now: () => new Date('2026-07-21T02:00:00Z'),
  });
  const client = new Client({ name: 'e2e', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const initial = body(await client.callTool({
      name: 'card_search',
      arguments: { query: '冻结变量', limit: 3 },
    })) as { cards: Array<{ path: string; traceHistory: Array<{ traceId: string }> }> };
    expect(initial.cards).toHaveLength(2);
    expect(initial.cards.map((card) => card.traceHistory)).toEqual([[], []]);

    const firstAppend = body(await client.callTool({
      name: 'trace_append',
      arguments: {
        lessonPath: 'lessons/lesson-001.md',
        blockId: 'step-02',
        cardAlias: 'Q-FREEZE-01',
        cardStepId: 'identify-freeze',
        materialPath: null,
        assessment: 'partially_correct',
        support: 'none',
        methods: { primary: '冻结变量法', secondary: ['参数化与消元'] },
        note: 'Identified the frozen quantity but needed a domain recheck.',
        supersedes: null,
      },
    })) as { factId: string; sourceRef: string };
    expect(firstAppend.factId).toMatch(/^trace-[0-9a-f-]+$/);
    expect(firstAppend.sourceRef).toMatch(/^trace:trace-[0-9a-f-]+$/);
    expect(firstAppend.sourceRef).toBe(`trace:${firstAppend.factId}`);

    const afterFirst = body(await client.callTool({
      name: 'card_search',
      arguments: { query: '冻结变量', limit: 3 },
    })) as { cards: Array<{ path: string; traceHistory: Array<{ traceId: string }> }> };
    expect(afterFirst.cards.map((card) => card.traceHistory.map((trace) => trace.traceId)))
      .toEqual([[firstAppend.factId], []]);
    const firstReverse = body(await client.callTool({
      name: 'trace_search',
      arguments: {
        cardPath: 'cards/conics/freeze-variable-01.yaml',
        limit: 20,
      },
    })) as { traces: Array<{ traceId: string }>; cardsByPath: Record<string, unknown> };
    expect(firstReverse.traces.map((trace) => trace.traceId)).toEqual([
      firstAppend.factId,
    ]);
    expect(Object.keys(firstReverse.cardsByPath)).toEqual([
      'cards/conics/freeze-variable-01.yaml',
    ]);

    const secondAppend = body(await client.callTool({
      name: 'trace_append',
      arguments: {
        lessonPath: 'lessons/lesson-001.md',
        blockId: 'step-02',
        cardAlias: 'Q-FREEZE-01',
        cardStepId: 'identify-freeze',
        materialPath: null,
        assessment: 'correct',
        support: 'none',
        methods: { primary: '冻结变量法', secondary: ['参数化与消元'] },
        note: 'Corrected the domain and equality condition independently.',
        supersedes: firstAppend.factId,
      },
    })) as { factId: string; sourceRef: string };
    expect(secondAppend.sourceRef).toBe(`trace:${secondAppend.factId}`);

    const finalCards = body(await client.callTool({
      name: 'card_search',
      arguments: { query: '冻结变量', limit: 3 },
    })) as { cards: Array<{ traceHistory: Array<{ traceId: string }> }> };
    expect(finalCards.cards.map((card) => card.traceHistory.map((trace) => trace.traceId)))
      .toEqual([[secondAppend.factId], []]);
    const finalReverse = body(await client.callTool({
      name: 'trace_search',
      arguments: {
        cardPath: 'cards/conics/freeze-variable-01.yaml',
        limit: 20,
      },
    })) as { traces: Array<{ traceId: string }> };
    expect(finalReverse.traces.map((trace) => trace.traceId)).toEqual([
      secondAppend.factId,
    ]);

    const attention = readFileSync(join(root, 'memory/planner-attention.md'), 'utf8');
    expect(attention).toContain(`../traces/${secondAppend.factId}.md`);
    expect(attention).not.toContain(`../traces/${firstAppend.factId}.md`);
    expect(persistenceFiles(root)).toEqual([]);
  } finally {
    await client.close();
    await server.close();
  }
});

test('fixes Plan consolidation inputs, confirmation, and profile ownership', () => {
  const roadmap = readFixture('ROADMAP.md');
  const plan = readFixture('plans/max-value.md');
  const student = readFixture('memory/student-profile.md');
  const teaching = readFixture('memory/teaching-profile.md');
  const nextPlan = readFixture('plans/transfer.md');

  expect(parseChildTree(roadmap, 'Plan Tree', 'plan', 'ROADMAP.md').entries)
    .toHaveLength(2);
  expect(parseChildTree(
    plan,
    'Lesson Tree',
    'lesson',
    'plans/max-value.md',
  ).entries).toHaveLength(3);
  expect(parseChildTree(
    nextPlan,
    'Lesson Tree',
    'lesson',
    'plans/transfer.md',
  ).entries).toHaveLength(1);
  expect(parseHandoff(plan).identity.id).toBe('max-value/handoff');

  expect(roadmap).toContain('## Plan Tree');
  expect(roadmap).not.toContain('## Plan Graph');
  expect(plan).toContain('## Lesson Tree');
  expect(plan).not.toContain('## Lesson Index');
  expect(plan).not.toContain('## Next Lesson Candidate');

  for (const id of ['001', '002', '003']) {
    const lesson = readFixture(`lessons/lesson-${id}.md`);
    expect(parseHandoff(lesson).identity.id).toBe(`lesson-${id}/handoff`);
    expect(lesson).toContain('status: closed');
    expect(lesson).toContain('## Block step-');
    expect(lesson).toContain('## Lesson Summary');
    expect(lesson).toContain('## Handoff');
    expect(lesson).not.toContain('## Traces');
  }
  expect(readFixture('lessons/lesson-001.md'))
    .toContain('block:lesson-001/step-02');
  expect(readFixture('lessons/lesson-002.md'))
    .toContain('block:lesson-002/step-02');
  expect(readFixture('traces/.gitkeep').trim()).toBe('');
  const candidates = plan.split('\n').filter((line) => /^\| (add|revise|delete) \|/.test(line));
  expect(candidates.map((line) => line.split('|')[1]?.trim())).toEqual([
    'add',
    'revise',
    'delete',
    'add',
  ]);
  for (const row of candidates) {
    expect(row).toMatch(/\(\.\.\/lessons\/lesson-00[123]\.md#block-step-\d{2}\)/);
  }

  const learnerPreference = 'Short checkpoints before independent transfer';
  const tutorRequirement = 'Ask for the domain before boundary evaluation';
  const deletedPreference = 'Long uninterrupted lectures';
  const rejectedRequirement = 'Always start with a video';
  expect(student).toContain(learnerPreference);
  expect(student).not.toContain(tutorRequirement);
  expect(teaching).toContain(tutorRequirement);
  expect(teaching).not.toContain(learnerPreference);
  for (const profile of [student, teaching]) {
    expect(profile).not.toContain(deletedPreference);
    expect(profile).not.toContain(rejectedRequirement);
  }
  expect(nextPlan).toContain('memory:student/S1');
  expect(nextPlan).toContain('memory:teaching/T1');
  expect(nextPlan).toContain('claim:max-value/handoff#learner-c1');
  expect(nextPlan).not.toContain('../lessons/lesson-');
  expect(persistenceFiles(fixture)).toEqual([]);
});
