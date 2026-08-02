import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import type { ConversationItem, SessionKey, StudyEvent } from '../shared/contracts';

function contentText(content: unknown): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content.flatMap((item) => (
    item && typeof item === 'object'
    && (item as { type?: unknown }).type === 'text'
    && typeof (item as { text?: unknown }).text === 'string'
      ? [(item as { text: string }).text]
      : []
  )).join('');
}

function toolCalls(content: unknown): Array<{
  id: string;
  name: string;
  arguments: unknown;
}> {
  if (!Array.isArray(content)) return [];
  return content.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    return value.type === 'toolCall'
      && typeof value.id === 'string'
      && typeof value.name === 'string'
      ? [{ id: value.id, name: value.name, arguments: value.arguments }]
      : [];
  });
}

export function projectConversationEntries(
  _key: SessionKey,
  entries: readonly SessionEntry[],
): ConversationItem[] {
  const items: ConversationItem[] = [];
  const toolPositions = new Map<string, number>();
  for (const entry of entries) {
    if (entry.type !== 'message') continue;
    const message = entry.message as unknown as Record<string, unknown>;
    if (message.role === 'user') {
      const text = contentText(message.content);
      if (text) items.push({ id: entry.id, kind: 'user', text, at: entry.timestamp });
      continue;
    }
    if (message.role === 'assistant') {
      const text = contentText(message.content);
      if (text) items.push({ id: entry.id, kind: 'assistant', text, at: entry.timestamp });
      for (const call of toolCalls(message.content)) {
        toolPositions.set(call.id, items.length);
        items.push({
          id: call.id,
          kind: 'tool',
          name: call.name,
          status: 'running',
          detail: call.arguments,
          at: entry.timestamp,
        });
      }
      continue;
    }
    if (
      message.role === 'toolResult'
      && typeof message.toolCallId === 'string'
      && typeof message.toolName === 'string'
    ) {
      const item: ConversationItem = {
        id: message.toolCallId,
        kind: 'tool',
        name: message.toolName,
        status: message.isError === true ? 'error' : 'done',
        detail: message.details ?? contentText(message.content),
        at: entry.timestamp,
      };
      const position = toolPositions.get(message.toolCallId);
      if (position === undefined) {
        toolPositions.set(message.toolCallId, items.length);
        items.push(item);
      } else {
        items[position] = item;
      }
    }
  }
  return items;
}

export function projectLiveSessionEvent(
  sessionKey: SessionKey,
  event: AgentSessionEvent,
): StudyEvent[] {
  if (
    event.type === 'message_update'
    && event.assistantMessageEvent.type === 'text_delta'
  ) {
    return [{
      type: 'assistant-delta',
      sessionKey,
      messageId: `${sessionKey}:${event.message.timestamp}`,
      delta: event.assistantMessageEvent.delta,
    }];
  }
  if (event.type === 'message_end') {
    const message = event.message as unknown as Record<string, unknown>;
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    const text = contentText(message.content);
    if (!text) return [];
    return [{
      type: 'conversation-item',
      sessionKey,
      item: {
        id: `${sessionKey}:${message.timestamp}`,
        kind: message.role,
        text,
        at: new Date(Number(message.timestamp)).toISOString(),
      },
    }];
  }
  if (event.type === 'tool_execution_start') {
    return [{
      type: 'conversation-item',
      sessionKey,
      item: {
        id: event.toolCallId,
        kind: 'tool',
        name: event.toolName,
        status: 'running',
        detail: event.args,
        at: new Date().toISOString(),
      },
    }];
  }
  if (event.type === 'tool_execution_end') {
    const result = event.result as { details?: unknown } | null | undefined;
    return [{
      type: 'conversation-item',
      sessionKey,
      item: {
        id: event.toolCallId,
        kind: 'tool',
        name: event.toolName,
        status: event.isError ? 'error' : 'done',
        detail: result?.details ?? result,
        at: new Date().toISOString(),
      },
    }];
  }
  return [];
}
