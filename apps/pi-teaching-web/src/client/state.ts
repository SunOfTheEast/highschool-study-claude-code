import type {
  ConversationItem,
  PlanWorkspaceSnapshot,
  SessionKey,
  StudyViewEvent,
  WorkflowView,
} from '../shared/contracts';
import type { MemoryReviewSnapshot } from '../memory-review/contracts';

export type ClientState = {
  workspace: PlanWorkspaceSnapshot | null;
  selected: SessionKey | null;
  conversations: Partial<Record<SessionKey, ConversationItem[]>>;
  work: Partial<Record<SessionKey, string>>;
  busy: Partial<Record<SessionKey, string>>;
  errors: Partial<Record<SessionKey, string>>;
  deepMode: Partial<Record<SessionKey, boolean>>;
  workflows: Partial<Record<SessionKey, WorkflowView[]>>;
};

export const initialClientState: ClientState = {
  workspace: null,
  selected: null,
  conversations: {},
  work: {},
  busy: {},
  errors: {},
  deepMode: {},
  workflows: {},
};

const memoryReviewRank = {
  proposed: 0,
  submitted: 1,
  applied: 2,
} as const;

export function laterMemoryReview(
  current: MemoryReviewSnapshot,
  incoming: MemoryReviewSnapshot,
): MemoryReviewSnapshot {
  if (current.id !== incoming.id) return incoming;
  return memoryReviewRank[incoming.status] >= memoryReviewRank[current.status]
    ? incoming
    : current;
}

export function preferLiveConversation(
  live: ConversationItem[] | undefined,
  fetched: ConversationItem[],
): ConversationItem[] {
  return live?.length ? live : fetched;
}

export function reduceClientState(state: ClientState, event: StudyViewEvent): ClientState {
  if (event.type === 'snapshot') {
    return {
      ...state,
      workspace: event.workspace,
      selected: state.selected,
    };
  }
  if (event.type === 'message-delta') {
    const conversation = [...(state.conversations[event.sessionKey] ?? [])];
    const index = conversation.findIndex((item) => (
      item.kind === 'message' && item.message.id === event.messageId
    ));
    if (index < 0) {
      conversation.push({
        kind: 'message',
        message: {
          id: event.messageId,
          role: event.sessionKey.startsWith('coach:') ? 'coach' : 'tutor',
          text: event.delta,
          complete: false,
        },
      });
    } else {
      const current = conversation[index]!;
      if (current.kind !== 'message') return state;
      conversation[index] = {
        kind: 'message',
        message: {
          ...current.message,
          text: current.message.text + event.delta,
        },
      };
    }
    return {
      ...state,
      conversations: {
        ...state.conversations,
        [event.sessionKey]: conversation,
      },
    };
  }
  if (event.type === 'message') {
    const current = state.conversations[event.sessionKey] ?? [];
    return {
      ...state,
      conversations: {
        ...state.conversations,
        [event.sessionKey]: current.some((item) => (
          item.kind === 'message' && item.message.id === event.message.id
        ))
          ? current.map((item) => (
            item.kind === 'message' && item.message.id === event.message.id
              ? { kind: 'message', message: event.message }
              : item
          ))
          : [...current, { kind: 'message', message: event.message }],
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
      busy: {
        ...state.busy,
        [event.sessionKey]: event.status === 'running' ? event.label : '',
      },
    };
  }
  if (event.type === 'work-status') {
    return {
      ...state,
      work: {
        ...state.work,
        [event.sessionKey]: event.status === 'running' ? event.label : '',
      },
    };
  }
  if (event.type === 'workflow') {
    const current = state.workflows[event.sessionKey] ?? [];
    return {
      ...state,
      workflows: {
        ...state.workflows,
        [event.sessionKey]: current.some((workflow) => workflow.id === event.workflow.id)
          ? current.map((workflow) => (
            workflow.id === event.workflow.id ? event.workflow : workflow
          ))
          : [...current, event.workflow],
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
