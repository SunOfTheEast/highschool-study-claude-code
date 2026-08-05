import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import type {
  ConversationItem,
  MaterialSearchConversationItem,
  SessionKey,
  StudyEvent,
} from '../shared/contracts';
import {
  materialSearchEnd,
  materialSearchStart,
  materialSearchUpdate,
} from './material-search';

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
        const material = call.name === 'subagent'
          ? materialSearchStart(call.id, call.arguments, entry.timestamp)
          : null;
        items.push(material ?? {
          id: call.id,
          kind: 'tool',
          name: call.name,
          status: 'running',
          detail: call.name === 'subagent' ? null : call.arguments,
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
      const position = toolPositions.get(message.toolCallId);
      const previous = position === undefined ? undefined : items[position];
      const started = previous?.kind === 'material-search'
        ? previous as MaterialSearchConversationItem
        : undefined;
      const material = message.toolName === 'subagent'
        ? materialSearchEnd(
          message.toolCallId,
          { details: message.details },
          message.isError === true,
          entry.timestamp,
          started,
        )
        : null;
      const item: ConversationItem = material ?? {
        id: message.toolCallId,
        kind: 'tool',
        name: message.toolName,
        status: message.isError === true ? 'error' : 'done',
        detail: message.toolName === 'subagent'
          ? null
          : (message.details ?? contentText(message.content)),
        at: entry.timestamp,
      };
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
  at = new Date().toISOString(),
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
    const material = event.toolName === 'subagent'
      ? materialSearchStart(event.toolCallId, event.args, at)
      : null;
    return [{
      type: 'conversation-item',
      sessionKey,
      item: material ?? {
        id: event.toolCallId,
        kind: 'tool',
        name: event.toolName,
        status: 'running',
        detail: event.toolName === 'subagent' ? null : event.args,
        at,
      },
    }];
  }
  if (event.type === 'tool_execution_update') {
    if (event.toolName !== 'subagent') return [];
    const material = materialSearchUpdate(
      event.toolCallId,
      event.args,
      event.partialResult,
      at,
    );
    return material ? [{
      type: 'conversation-item',
      sessionKey,
      item: material,
    }] : [];
  }
  if (event.type === 'tool_execution_end') {
    const result = event.result as { details?: unknown } | null | undefined;
    const material = event.toolName === 'subagent'
      ? materialSearchEnd(event.toolCallId, event.result, event.isError, at)
      : null;
    return [{
      type: 'conversation-item',
      sessionKey,
      item: material ?? {
        id: event.toolCallId,
        kind: 'tool',
        name: event.toolName,
        status: event.isError ? 'error' : 'done',
        detail: event.toolName === 'subagent' ? null : (result?.details ?? result),
        at,
      },
    }];
  }
  return [];
}
