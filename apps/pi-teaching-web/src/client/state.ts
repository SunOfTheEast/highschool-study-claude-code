import type {
  ConversationItem,
  SessionKey,
  StudyEvent,
} from '../shared/contracts';

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
  next[index] = incoming;
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
    };
  }
  if (event.type === 'session-error') {
    return {
      ...state,
      errors: { ...state.errors, [event.sessionKey]: event.message },
    };
  }
  return state;
}
