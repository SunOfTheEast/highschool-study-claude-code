import { expect, test } from 'bun:test';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import {
  projectConversationEntries,
  projectLiveSessionEvent,
} from '../../src/projection/conversation';
import type { ConversationItem, StudyEvent } from '../../src/shared/contracts';

const startedAt = '2026-08-12T10:00:00.000Z';
const endedAt = '2026-08-12T10:00:04.000Z';

function item(events: StudyEvent[]): ConversationItem {
  expect(events).toHaveLength(1);
  const event = events[0];
  if (event?.type !== 'conversation-item') throw new Error('CONVERSATION_ITEM_EXPECTED');
  return event.item;
}

test('projects research phases without exposing query, provider, or result content', () => {
  const start = item(projectLiveSessionEvent('free:free-1', {
    type: 'tool_execution_start',
    toolCallId: 'paper-1',
    toolName: 'paper_research',
    args: {
      anchor: 'PRIVATE_ANCHOR',
      bridgeQuestion: 'PRIVATE_QUERY',
      studentLevel: '高中',
    },
  } as AgentSessionEvent, startedAt));
  const checking = item(projectLiveSessionEvent('free:free-1', {
    type: 'tool_execution_update',
    toolCallId: 'paper-1',
    toolName: 'paper_research',
    args: { anchor: 'PRIVATE_ANCHOR' },
    partialResult: {
      content: [],
      details: { kind: 'paper-research', version: 1, phase: 'checking' },
    },
  } as AgentSessionEvent, endedAt));
  const done = item(projectLiveSessionEvent('free:free-1', {
    type: 'tool_execution_end',
    toolCallId: 'paper-1',
    toolName: 'paper_research',
    result: {
      content: [{ type: 'text', text: 'PRIVATE_PAPER_RESULT' }],
      details: { kind: 'paper-research', version: 1, phase: 'done' },
    },
    isError: false,
  } as AgentSessionEvent, endedAt));

  expect(start).toMatchObject({ kind: 'paper-research', phase: 'searching', status: 'running' });
  expect(checking).toMatchObject({ kind: 'paper-research', phase: 'checking', status: 'running' });
  expect(done).toMatchObject({ kind: 'paper-research', phase: 'done', status: 'done' });
  expect(JSON.stringify([start, checking, done])).not.toMatch(
    /PRIVATE_|Semantic Scholar|paper_research|http/i,
  );
});

test('restores a quiet unavailable research activity from native history', () => {
  const entries = [{
    type: 'message',
    id: 'assistant-1',
    parentId: null,
    timestamp: startedAt,
    message: {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'paper-1',
        name: 'paper_research',
        arguments: { anchor: 'PRIVATE_ANCHOR', bridgeQuestion: 'PRIVATE_QUERY' },
      }],
    },
  }, {
    type: 'message',
    id: 'result-1',
    parentId: 'assistant-1',
    timestamp: endedAt,
    message: {
      role: 'toolResult',
      toolCallId: 'paper-1',
      toolName: 'paper_research',
      content: [{ type: 'text', text: 'PRIVATE_RATE_LIMIT_429' }],
      details: { kind: 'paper-research', version: 1, phase: 'unavailable' },
      isError: false,
    },
  }] as unknown as SessionEntry[];

  const items = projectConversationEntries('free:free-1', entries);
  expect(items).toEqual([{
    id: 'paper-1',
    kind: 'paper-research',
    status: 'done',
    phase: 'unavailable',
    at: startedAt,
    updatedAt: endedAt,
  }]);
  expect(JSON.stringify(items)).not.toContain('PRIVATE');

  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="free:free-1"
      items={items}
      running={false}
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );
  expect(markup).toContain('暂时没有找到合适的论文资料');
  expect(markup).not.toContain('429');
  expect(markup).not.toContain('paper_research');
});
