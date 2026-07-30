import type {
  CoachContextView,
  ConversationItem,
  PlanWorkspaceSnapshot,
  PublicContextPage,
  SessionKey,
  StudentNotebook,
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

export function buildPublicContextPages({
  view,
  workspace,
  coachContext,
  notebook,
}: {
  view: 'coach' | 'tutor' | 'replay';
  workspace: PlanWorkspaceSnapshot;
  coachContext: CoachContextView | null;
  notebook: StudentNotebook | null;
}): PublicContextPage[] {
  const lesson = notebook?.lesson ?? null;
  const residentSources = [
    '共享数学教学原则',
    '本学习集研习要领',
    '经学生确认的相关偏好',
  ];
  const frozenSources = [
    view === 'coach' ? 'Roadmap 交接快照' : 'Plan 交接快照',
  ];
  const currentSources = view === 'coach'
    ? [
      `当前学习周期 · ${workspace.plan.title}`,
      '当前学习顾问会话',
    ]
    : [
      lesson?.status === 'prepared'
        ? '准备好的下一课'
        : `当前课堂 · ${lesson?.title ?? '课堂记录'}`,
      ...(lesson?.tutorSessionId ? ['当前课堂会话'] : []),
    ];
  const onDemandSources = view === 'coach'
    ? (coachContext?.priorLessons ?? []).map(
      (item) => `前课摘录 · ${item.title}`,
    )
    : (notebook?.recentRecords ?? []).map(
      (record) => `课堂记录 ${record.lessonId} / ${record.blockId}`,
    );

  return [
    {
      kind: 'resident',
      label: '常驻基础',
      purpose: '每轮稳定使用的教学原则与已确认偏好。',
      sourceCount: residentSources.length,
      sources: residentSources,
    },
    {
      kind: 'frozen',
      label: '冻结交接',
      purpose: '节点激活时由父节点交付，当前 Session 中保持不变。',
      sourceCount: frozenSources.length,
      sources: frozenSources,
    },
    {
      kind: 'current',
      label: '当前节点',
      purpose: '只属于当前学习周期或课堂的工作内容。',
      sourceCount: currentSources.length,
      sources: currentSources,
    },
    {
      kind: 'on-demand',
      label: '按需来源',
      purpose: '需要核查时才回读的前课与课堂记录。',
      sourceCount: onDemandSources.length,
      sources: onDemandSources,
    },
  ];
}

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
