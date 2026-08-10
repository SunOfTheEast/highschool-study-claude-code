import { expect, test } from 'bun:test';
import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChatPanel } from '../../src/client/components/ChatPanel';
import { initialClientState, reduceClientState } from '../../src/client/state';
import {
  projectConversationEntries,
  projectLiveSessionEvent,
} from '../../src/projection/conversation';
import type { ConversationItem, StudyEvent } from '../../src/shared/contracts';

const startedAt = '2026-08-10T10:00:00.000Z';
const endedAt = '2026-08-10T10:00:03.000Z';
const details = {
  kind: 'peer-message',
  version: 1,
  actorType: 'peer',
  actorId: 'peer-acheng',
  displayName: '阿澄',
};

function conversationItem(events: StudyEvent[]): ConversationItem {
  expect(events).toHaveLength(1);
  const event = events[0];
  if (event?.type !== 'conversation-item') throw new Error('CONVERSATION_ITEM_EXPECTED');
  return event.item;
}

function history(resultDetails: unknown = details, isError = false): SessionEntry[] {
  return [{
    type: 'message',
    id: 'assistant-peer',
    parentId: null,
    timestamp: startedAt,
    message: {
      role: 'assistant',
      content: [{
        type: 'toolCall',
        id: 'peer-call-1',
        name: 'ask_peer',
        arguments: { peerId: 'peer-acheng', intent: '质疑一下这个判断。' },
      }],
    },
  }, {
    type: 'message',
    id: 'result-peer',
    parentId: 'assistant-peer',
    timestamp: endedAt,
    message: {
      role: 'toolResult',
      toolCallId: 'peer-call-1',
      toolName: 'ask_peer',
      content: [{ type: 'text', text: '也许可以先找一个 **反例**。' }],
      details: resultDetails,
      isError,
    },
  }] as unknown as SessionEntry[];
}

test('restores one first-class Peer utterance from native history', () => {
  const items = projectConversationEntries('free:free-session-001', history());

  expect(items).toEqual([{
    id: 'peer-call-1',
    kind: 'peer',
    actorId: 'peer-acheng',
    displayName: '阿澄',
    status: 'done',
    text: '也许可以先找一个 **反例**。',
    at: startedAt,
  }]);
  expect(JSON.stringify(items).match(/也许可以先找一个/g)).toHaveLength(1);
});

test('reconciles live Peer start and success by native tool call id', () => {
  const start = conversationItem(projectLiveSessionEvent(
    'free:free-session-001',
    {
      type: 'tool_execution_start',
      toolCallId: 'peer-call-1',
      toolName: 'ask_peer',
      args: { peerId: 'peer-acheng', intent: '回应学生。' },
    } as AgentSessionEvent,
    startedAt,
  ));
  const done = conversationItem(projectLiveSessionEvent(
    'free:free-session-001',
    {
      type: 'tool_execution_end',
      toolCallId: 'peer-call-1',
      toolName: 'ask_peer',
      result: {
        content: [{ type: 'text', text: '我想到另一种解释。' }],
        details,
      },
      isError: false,
    } as AgentSessionEvent,
    endedAt,
  ));

  expect(start).toMatchObject({ id: 'peer-call-1', kind: 'peer', status: 'running' });
  expect(done).toMatchObject({
    id: 'peer-call-1', kind: 'peer', status: 'done', text: '我想到另一种解释。',
  });

  let state = reduceClientState(initialClientState, {
    type: 'conversation-item', sessionKey: 'free:free-session-001', item: start,
  });
  state = reduceClientState(state, {
    type: 'conversation-item', sessionKey: 'free:free-session-001', item: done,
  });
  expect(state.conversations['free:free-session-001']).toEqual([{
    ...done,
    at: startedAt,
  }]);
});

test('shows a quiet Peer failure and fails closed on forged success metadata', () => {
  const failed = conversationItem(projectLiveSessionEvent(
    'free:free-session-001',
    {
      type: 'tool_execution_end',
      toolCallId: 'peer-call-failed',
      toolName: 'ask_peer',
      result: { content: [{ type: 'text', text: 'PRIVATE_PROVIDER_ERROR' }] },
      isError: true,
    } as AgentSessionEvent,
    endedAt,
  ));
  expect(failed).toEqual({
    id: 'peer-call-failed',
    kind: 'peer',
    actorId: 'peer-acheng',
    displayName: '阿澄',
    status: 'error',
    text: null,
    at: endedAt,
  });
  expect(JSON.stringify(failed)).not.toContain('PRIVATE_PROVIDER_ERROR');

  const forged = projectConversationEntries('free:free-session-001', history({
    ...details,
    displayName: '伪造同学',
  }));
  expect(forged).toHaveLength(1);
  expect(forged[0]).toMatchObject({
    id: 'peer-call-1', kind: 'tool', name: 'ask_peer', status: 'done', detail: null,
  });
  expect(JSON.stringify(forged)).not.toContain('伪造同学');
});

test('renders Peer as a quiet AI classmate voice rather than a teacher tool receipt', () => {
  const items: ConversationItem[] = [{
    id: 'peer-running',
    kind: 'peer',
    actorId: 'peer-acheng',
    displayName: '阿澄',
    status: 'running',
    text: null,
    at: startedAt,
  }, {
    id: 'peer-done',
    kind: 'peer',
    actorId: 'peer-acheng',
    displayName: '阿澄',
    status: 'done',
    text: '也许先找一个 **反例**。',
    at: endedAt,
  }, {
    id: 'peer-error',
    kind: 'peer',
    actorId: 'peer-acheng',
    displayName: '阿澄',
    status: 'error',
    text: null,
    at: endedAt,
  }];
  const markup = renderToStaticMarkup(
    <ChatPanel
      sessionKey="free:free-session-001"
      items={items}
      running
      error={null}
      enabled
      onSend={async () => {}}
    />,
  );

  expect(markup.match(/阿澄/g)?.length).toBeGreaterThanOrEqual(3);
  expect(markup).toContain('AI 同学');
  expect(markup).toContain('阿澄正在想……');
  expect(markup).toContain('<strong>反例</strong>');
  expect(markup).toContain('阿澄暂时没接上');
  expect(markup).not.toContain('老师查看了相关内容');
  expect(markup).not.toContain('peer-message');
  expect(markup).not.toContain('>老师<');
});
