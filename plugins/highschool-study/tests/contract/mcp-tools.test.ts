import { expect, test } from 'bun:test';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { makeLearningSetWithHistory } from '../helpers/learning-set';
import { createStudyMcpServer } from '../../server/src/mcp/create-server';

function body(result: unknown): Record<string, unknown> {
  const value = result as {
    content: Array<{ type: string; text?: string }>;
    structuredContent?: Record<string, unknown>;
  };
  const first = value.content[0];
  expect(first?.type).toBe('text');
  if (first?.type !== 'text' || typeof first.text !== 'string') {
    throw new Error('Tool did not return JSON text');
  }
  const parsed = JSON.parse(first.text) as Record<string, unknown>;
  expect(parsed).toEqual(value.structuredContent as Record<string, unknown>);
  return parsed;
}

test('publishes and exercises exactly four study tools', async () => {
  const root = makeLearningSetWithHistory();
  const server = createStudyMcpServer({
    learningSetRoot: root,
    now: () => new Date('2026-07-21T10:00:00+08:00'),
  });
  const client = new Client({ name: 'test', version: '1.0.0' });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  try {
    const tools = await client.listTools();
    expect(tools.tools.map((item) => item.name).sort()).toEqual([
      'card_search',
      'source_resolve',
      'trace_append',
      'trace_search',
    ]);

    const initialCards = body(await client.callTool({
      name: 'card_search',
      arguments: { query: '冻结变量', limit: 3 },
    })) as { cards: Array<{ traceHistory: Array<{ eventId: string }> }> };
    expect(initialCards.cards[0]?.traceHistory).toBeArray();

    const appended = body(await client.callTool({
      name: 'trace_append',
      arguments: {
        lessonPath: 'lessons/lesson-001.md',
        blockId: 'step-02',
        cardAlias: 'Q-FREEZE-01',
        cardStepId: 'identify-freeze',
        materialPath: null,
        assessment: 'correct',
        support: 'none',
        note: 'MCP appended domain evidence.',
        supersedes: null,
      },
    })) as { eventId: string };
    expect(appended.eventId).toBe('event-005');

    const refreshedCards = body(await client.callTool({
      name: 'card_search',
      arguments: { query: '冻结变量', limit: 3 },
    })) as { cards: Array<{ traceHistory: Array<{ eventId: string }> }> };
    expect(refreshedCards.cards[0]?.traceHistory.map((trace) => trace.eventId))
      .toContain('event-005');

    const reverse = body(await client.callTool({
      name: 'trace_search',
      arguments: { query: 'MCP appended', planId: 'max-value', limit: 20 },
    })) as { cardsByPath: Record<string, unknown> };
    expect(Object.keys(reverse.cardsByPath)).toEqual([
      'cards/conics/freeze-variable-01.yaml',
    ]);

    body(await client.callTool({
      name: 'trace_append',
      arguments: {
        lessonPath: 'lessons/lesson-001.md',
        blockId: 'step-02',
        cardAlias: null,
        cardStepId: null,
        materialPath: null,
        assessment: 'incomplete',
        support: 'external',
        note: 'Cardless MCP reflection keyword.',
        supersedes: null,
      },
    }));
    const cardless = body(await client.callTool({
      name: 'trace_search',
      arguments: { query: 'cardless MCP reflection', limit: 20 },
    })) as { traces: Array<{ eventId: string; cardPath: string | null }>; cardsByPath: Record<string, unknown> };
    expect(cardless.traces).toEqual([
      expect.objectContaining({ eventId: 'event-006', cardPath: null }),
    ]);
    expect(cardless.cardsByPath).toEqual({});

    const resolved = body(await client.callTool({
      name: 'source_resolve',
      arguments: {
        fromPath: 'lessons/lesson-001.md',
        target: '../cards/conics/freeze-variable-01.yaml#step=identify-freeze',
      },
    }));
    expect(resolved).toMatchObject({
      valid: true,
      path: 'cards/conics/freeze-variable-01.yaml',
      fragment: 'step=identify-freeze',
    });
  } finally {
    await client.close();
    await server.close();
  }
});
