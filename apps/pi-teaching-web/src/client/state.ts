import type {
  ChatMessage,
  PlanWorkspaceSnapshot,
  SessionKey,
  StudyViewEvent,
  WorkflowView,
} from '../shared/contracts';

export type ClientState = {
  workspace: PlanWorkspaceSnapshot | null;
  selected: SessionKey | null;
  messages: Partial<Record<SessionKey, ChatMessage[]>>;
  work: Partial<Record<SessionKey, string>>;
  busy: Partial<Record<SessionKey, string>>;
  errors: Partial<Record<SessionKey, string>>;
  deepMode: Partial<Record<SessionKey, boolean>>;
  workflows: Partial<Record<SessionKey, WorkflowView[]>>;
};

export const initialClientState: ClientState = {
  workspace: null,
  selected: null,
  messages: {},
  work: {},
  busy: {},
  errors: {},
  deepMode: {},
  workflows: {},
};

export function preferLiveMessages(
  live: ChatMessage[] | undefined,
  fetched: ChatMessage[],
): ChatMessage[] {
  return live?.length ? live : fetched;
}

export function reduceClientState(state: ClientState, event: StudyViewEvent): ClientState {
  if (event.type === 'snapshot') {
    const previousLesson = state.selected?.startsWith('tutor:')
      ? state.workspace?.lessons.find((lesson) => lesson.sessionKey === state.selected)
      : null;
    const selectedLesson = state.selected?.startsWith('tutor:')
      ? event.workspace.lessons.find((lesson) => lesson.sessionKey === state.selected)
      : null;
    const selectedJustClosed = (
      previousLesson?.status === 'active'
      || previousLesson?.status === 'paused'
    ) && selectedLesson?.status === 'closed';
    return {
      ...state,
      workspace: event.workspace,
      selected: selectedJustClosed ? event.workspace.coach.sessionKey : state.selected,
    };
  }
  if (event.type === 'message-delta') {
    const messages = [...(state.messages[event.sessionKey] ?? [])];
    const index = messages.findIndex((message) => message.id === event.messageId);
    if (index < 0) {
      messages.push({
        id: event.messageId,
        role: event.sessionKey.startsWith('coach:') ? 'coach' : 'tutor',
        text: event.delta,
        complete: false,
      });
    } else {
      messages[index] = {
        ...messages[index]!,
        text: messages[index]!.text + event.delta,
      };
    }
    return {
      ...state,
      messages: { ...state.messages, [event.sessionKey]: messages },
    };
  }
  if (event.type === 'message') {
    const current = state.messages[event.sessionKey] ?? [];
    return {
      ...state,
      messages: {
        ...state.messages,
        [event.sessionKey]: current.some((message) => message.id === event.message.id)
          ? current.map((message) => (
            message.id === event.message.id ? event.message : message
          ))
          : [...current, event.message],
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
