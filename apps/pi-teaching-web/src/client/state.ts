import type {
  ConversationItem,
  LessonReviewConversationItem,
  MaterialSearchConversationItem,
  PaperResearchConversationItem,
  SessionKey,
  StudyEvent,
} from '../shared/contracts';
import { mergeMaterialSearchItem } from '../projection/material-search';
import { mergeLessonReviewItem } from '../projection/lesson-review';
import { mergePaperResearchItem } from '../projection/paper-research';
import { publicErrorText, publicSessionErrorText } from './public-errors';

export type ClientState = {
  conversations: Partial<Record<SessionKey, ConversationItem[]>>;
  running: Partial<Record<SessionKey, boolean>>;
  errors: Partial<Record<SessionKey, string>>;
};

export const initialClientState: ClientState = {
  conversations: {},
  running: {},
  errors: {},
};

function upsert(items: ConversationItem[], incoming: ConversationItem): ConversationItem[] {
  const index = items.findIndex((item) => item.id === incoming.id);
  if (index < 0) return [...items, incoming];
  const next = [...items];
  const existing = items[index]!;
  if (existing.kind === 'material-search' && incoming.kind === 'material-search') {
    next[index] = mergeMaterialSearchItem(existing, incoming);
  } else if (existing.kind === 'paper-research' && incoming.kind === 'paper-research') {
    next[index] = mergePaperResearchItem(existing, incoming);
  } else if (existing.kind === 'lesson-review' && incoming.kind === 'lesson-review') {
    next[index] = mergeLessonReviewItem(existing, incoming);
  } else if (
    existing.kind === 'material-search'
    && incoming.kind === 'tool'
    && incoming.name === 'subagent'
    && incoming.status !== 'running'
  ) {
    const terminal: MaterialSearchConversationItem = {
      ...existing,
      status: incoming.status,
      phase: incoming.status === 'error' ? 'adjusting' : 'done',
      completed: incoming.status === 'done' ? existing.total : existing.completed,
      at: incoming.at,
      updatedAt: incoming.at,
    };
    next[index] = mergeMaterialSearchItem(existing, terminal);
  } else if (
    existing.kind === 'lesson-review'
    && incoming.kind === 'tool'
    && incoming.name === 'subagent'
    && incoming.status !== 'running'
  ) {
    const terminal: LessonReviewConversationItem = {
      ...existing,
      status: incoming.status,
      at: incoming.at,
      updatedAt: incoming.at,
    };
    next[index] = mergeLessonReviewItem(existing, terminal);
  } else if (existing.kind === 'peer' && incoming.kind === 'peer') {
    next[index] = { ...incoming, at: existing.at };
  } else {
    next[index] = incoming;
  }
  return next;
}

export function reduceClientState(state: ClientState, event: StudyEvent): ClientState {
  if (event.type === 'assistant-delta') {
    const current = state.conversations[event.sessionKey] ?? [];
    const existing = current.find((item) => item.id === event.messageId);
    const item: ConversationItem = {
      id: event.messageId,
      kind: 'assistant',
      text: existing?.kind === 'assistant' ? existing.text + event.delta : event.delta,
      at: existing?.at ?? '',
    };
    return {
      ...state,
      conversations: {
        ...state.conversations,
        [event.sessionKey]: upsert(current, item),
      },
    };
  }
  if (event.type === 'conversation-item') {
    const current = state.conversations[event.sessionKey] ?? [];
    return {
      ...state,
      conversations: {
        ...state.conversations,
        [event.sessionKey]: upsert(current, event.item),
      },
    };
  }
  if (event.type === 'conversation-snapshot') {
    return {
      ...state,
      conversations: {
        ...state.conversations,
        [event.sessionKey]: event.items,
      },
    };
  }
  if (event.type === 'session-run') {
    return {
      ...state,
      running: {
        ...state.running,
        [event.sessionKey]: event.status === 'running',
      },
      errors: event.status === 'running'
        ? { ...state.errors, [event.sessionKey]: undefined }
        : state.errors,
    };
  }
  if (event.type === 'session-error') {
    return {
      ...state,
      errors: {
        ...state.errors,
        [event.sessionKey]: publicErrorText(event.message, publicSessionErrorText()),
      },
    };
  }
  return state;
}
