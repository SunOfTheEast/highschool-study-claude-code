import type { AgentSessionEvent, SessionEntry } from '@earendil-works/pi-coding-agent';
import type {
  ConversationItem,
  LessonReviewConversationItem,
  LearningAssetSavedConversationItem,
  MaterialSearchConversationItem,
  PaperResearchConversationItem,
  PeerConversationItem,
  SessionKey,
  StudyEvent,
} from '../shared/contracts';
import {
  materialSearchEnd,
  materialSearchStart,
  materialSearchUpdate,
} from './material-search';
import { lessonReviewEnd, lessonReviewStart } from './lesson-review';
import { lessonHandoutEnd, lessonHandoutStart } from './lesson-handout';
import { publicSessionErrorText } from '../client/public-errors';
import { peerMessageEnd, peerMessageStart } from './peer-message';
import {
  paperResearchEnd,
  paperResearchStart,
  paperResearchUpdate,
} from './paper-research';
import {
  fallbackTool,
  isLearningAssetProposalTool,
  isLearningAssetSaveTool,
  learningAssetProposalStart,
  learningAssetSaveEnd,
  learningAssetSaveStart,
} from './learning-asset-proposal';
import { focusConversationItem } from './focus-cycle';

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
    if (entry.type === 'custom_message') {
      const focus = focusConversationItem(
        entry.id,
        entry.customType,
        entry.details,
        entry.timestamp,
        _key,
      );
      if (focus) items.push(focus);
      continue;
    }
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
        if (isLearningAssetProposalTool(call.name)) {
          items.push(learningAssetProposalStart(
            call.id,
            call.name,
            call.arguments,
            entry.timestamp,
          ) ?? fallbackTool(call.id, call.name, 'running', entry.timestamp));
          continue;
        }
        if (isLearningAssetSaveTool(call.name)) {
          items.push(learningAssetSaveStart(call.id, call.name, entry.timestamp)
            ?? fallbackTool(call.id, call.name, 'running', entry.timestamp));
          continue;
        }
        if (call.name === 'ask_peer') {
          items.push(peerMessageStart(call.id, call.arguments, entry.timestamp, 'history') ?? {
            id: call.id,
            kind: 'tool',
            name: call.name,
            status: 'running',
            detail: null,
            at: entry.timestamp,
          });
          continue;
        }
        if (call.name === 'artifact_export') {
          items.push(lessonHandoutStart(call.id, entry.timestamp));
          continue;
        }
        if (call.name === 'paper_research') {
          items.push(paperResearchStart(call.id, entry.timestamp));
          continue;
        }
        const material = call.name === 'subagent'
          ? materialSearchStart(call.id, call.arguments, entry.timestamp)
          : null;
        const review = call.name === 'subagent'
          ? lessonReviewStart(call.id, call.arguments, entry.timestamp)
          : null;
        items.push(material ?? review ?? {
          id: call.id,
          kind: 'tool',
          name: call.name,
          status: 'running',
          detail: null,
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
      if (isLearningAssetProposalTool(message.toolName)) {
        continue;
      }
      if (isLearningAssetSaveTool(message.toolName)) {
        const started = previous?.kind === 'learning-asset-saved'
          ? previous as LearningAssetSavedConversationItem
          : undefined;
        const saved = learningAssetSaveEnd(
          message.toolCallId,
          message.toolName,
          { details: message.details },
          message.isError === true,
          entry.timestamp,
          started,
        );
        const item = saved ?? fallbackTool(
          message.toolCallId,
          message.toolName,
          message.isError === true ? 'error' : 'done',
          entry.timestamp,
        );
        if (position === undefined) {
          toolPositions.set(message.toolCallId, items.length);
          items.push(item);
        } else {
          items[position] = item;
        }
        continue;
      }
      if (message.toolName === 'ask_peer') {
        const started = previous?.kind === 'peer'
          ? previous as PeerConversationItem
          : undefined;
        const peer = peerMessageEnd(
          message.toolCallId,
          { content: message.content, details: message.details },
          message.isError === true,
          entry.timestamp,
          'history',
          started,
        );
        const item: ConversationItem = peer ?? {
          id: message.toolCallId,
          kind: 'tool',
          name: message.toolName,
          status: message.isError === true ? 'error' : 'done',
          detail: null,
          at: entry.timestamp,
        };
        if (position === undefined) {
          toolPositions.set(message.toolCallId, items.length);
          items.push(item);
        } else {
          items[position] = item;
        }
        continue;
      }
      if (message.toolName === 'artifact_export') {
        const item = lessonHandoutEnd(
          message.toolCallId,
          { details: message.details },
          message.isError === true,
          entry.timestamp,
        );
        if (position === undefined) {
          toolPositions.set(message.toolCallId, items.length);
          items.push(item);
        } else {
          items[position] = item;
        }
        continue;
      }
      if (message.toolName === 'paper_research') {
        const started = previous?.kind === 'paper-research'
          ? previous as PaperResearchConversationItem
          : undefined;
        const projected = paperResearchEnd(
          message.toolCallId,
          { details: message.details },
          message.isError === true,
          entry.timestamp,
          started,
        );
        const item: ConversationItem = projected ?? {
          id: message.toolCallId,
          kind: 'tool',
          name: message.toolName,
          status: message.isError === true ? 'error' : 'done',
          detail: null,
          at: entry.timestamp,
        };
        if (position === undefined) {
          toolPositions.set(message.toolCallId, items.length);
          items.push(item);
        } else {
          items[position] = item;
        }
        continue;
      }
      const started = previous?.kind === 'material-search'
        ? previous as MaterialSearchConversationItem
        : undefined;
      const reviewStarted = previous?.kind === 'lesson-review'
        ? previous as LessonReviewConversationItem
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
      const review = message.toolName === 'subagent'
        ? lessonReviewEnd(
          message.toolCallId,
          { details: message.details },
          message.isError === true,
          entry.timestamp,
          reviewStarted,
        )
        : null;
      const item: ConversationItem = material ?? review ?? {
        id: message.toolCallId,
        kind: 'tool',
        name: message.toolName,
        status: message.isError === true ? 'error' : 'done',
        detail: null,
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
    if (message.role === 'custom') {
      const focus = focusConversationItem(
        `${sessionKey}:${message.timestamp}`,
        message.customType,
        message.details,
        new Date(Number(message.timestamp)).toISOString(),
        sessionKey,
      );
      return focus ? [{ type: 'conversation-item', sessionKey, item: focus }] : [];
    }
    if (message.role !== 'user' && message.role !== 'assistant') return [];
    if (message.role === 'assistant' && message.stopReason === 'error') {
      return [{
        type: 'session-error',
        sessionKey,
        message: publicSessionErrorText(),
      }];
    }
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
    if (isLearningAssetProposalTool(event.toolName)) {
      return [{
        type: 'conversation-item',
        sessionKey,
        item: learningAssetProposalStart(
          event.toolCallId,
          event.toolName,
          event.args,
          at,
        ) ?? fallbackTool(event.toolCallId, event.toolName, 'running', at),
      }];
    }
    if (isLearningAssetSaveTool(event.toolName)) {
      return [{
        type: 'conversation-item',
        sessionKey,
        item: learningAssetSaveStart(event.toolCallId, event.toolName, at)
          ?? fallbackTool(event.toolCallId, event.toolName, 'running', at),
      }];
    }
    if (event.toolName === 'ask_peer') {
      const peer = peerMessageStart(event.toolCallId, event.args, at, 'live');
      return [{
        type: 'conversation-item',
        sessionKey,
        item: peer ?? {
          id: event.toolCallId,
          kind: 'tool',
          name: event.toolName,
          status: 'running',
          detail: null,
          at,
        },
      }];
    }
    if (event.toolName === 'artifact_export') {
      return [{
        type: 'conversation-item',
        sessionKey,
        item: lessonHandoutStart(event.toolCallId, at),
      }];
    }
    if (event.toolName === 'paper_research') {
      return [{
        type: 'conversation-item',
        sessionKey,
        item: paperResearchStart(event.toolCallId, at),
      }];
    }
    const material = event.toolName === 'subagent'
      ? materialSearchStart(event.toolCallId, event.args, at)
      : null;
    const review = event.toolName === 'subagent'
      ? lessonReviewStart(event.toolCallId, event.args, at)
      : null;
    return [{
      type: 'conversation-item',
      sessionKey,
      item: material ?? review ?? {
        id: event.toolCallId,
        kind: 'tool',
        name: event.toolName,
        status: 'running',
        detail: null,
        at,
      },
    }];
  }
  if (event.type === 'tool_execution_update') {
    if (event.toolName === 'paper_research') {
      const paper = paperResearchUpdate(
        event.toolCallId,
        event.partialResult,
        at,
      );
      return paper ? [{ type: 'conversation-item', sessionKey, item: paper }] : [];
    }
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
    if (isLearningAssetProposalTool(event.toolName)) return [];
    if (isLearningAssetSaveTool(event.toolName)) {
      return [{
        type: 'conversation-item',
        sessionKey,
        item: learningAssetSaveEnd(
          event.toolCallId,
          event.toolName,
          event.result,
          event.isError,
          at,
        ) ?? fallbackTool(
          event.toolCallId,
          event.toolName,
          event.isError ? 'error' : 'done',
          at,
        ),
      }];
    }
    if (event.toolName === 'ask_peer') {
      const peer = peerMessageEnd(
        event.toolCallId,
        event.result,
        event.isError,
        at,
        'live',
      );
      return [{
        type: 'conversation-item',
        sessionKey,
        item: peer ?? {
          id: event.toolCallId,
          kind: 'tool',
          name: event.toolName,
          status: event.isError ? 'error' : 'done',
          detail: null,
          at,
        },
      }];
    }
    if (event.toolName === 'artifact_export') {
      return [{
        type: 'conversation-item',
        sessionKey,
        item: lessonHandoutEnd(
          event.toolCallId,
          event.result,
          event.isError,
          at,
        ),
      }];
    }
    if (event.toolName === 'paper_research') {
      const paper = paperResearchEnd(
        event.toolCallId,
        event.result,
        event.isError,
        at,
      );
      return [{
        type: 'conversation-item',
        sessionKey,
        item: paper ?? {
          id: event.toolCallId,
          kind: 'tool',
          name: event.toolName,
          status: event.isError ? 'error' : 'done',
          detail: null,
          at,
        },
      }];
    }
    const material = event.toolName === 'subagent'
      ? materialSearchEnd(event.toolCallId, event.result, event.isError, at)
      : null;
    const review = event.toolName === 'subagent'
      ? lessonReviewEnd(event.toolCallId, event.result, event.isError, at)
      : null;
    return [{
      type: 'conversation-item',
      sessionKey,
      item: material ?? review ?? {
        id: event.toolCallId,
        kind: 'tool',
        name: event.toolName,
        status: event.isError ? 'error' : 'done',
        detail: null,
        at,
      },
    }];
  }
  return [];
}
