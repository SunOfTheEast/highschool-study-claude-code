import type {
  CourseViewProjection,
  KnowledgeViewProjection,
  MemoryViewProjection,
} from '../shared/view-contracts';

export type PrimaryView = 'course' | 'knowledge' | 'memory';

export type ViewSlot<T> = {
  value: T | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
};

export type ViewProjectionState = {
  course: ViewSlot<CourseViewProjection>;
  knowledge: ViewSlot<KnowledgeViewProjection>;
  memory: ViewSlot<MemoryViewProjection>;
};

export type ViewAction =
  | { type: 'loading'; view: PrimaryView }
  | { type: 'loaded'; view: 'course'; value: CourseViewProjection }
  | { type: 'loaded'; view: 'knowledge'; value: KnowledgeViewProjection }
  | { type: 'loaded'; view: 'memory'; value: MemoryViewProjection }
  | { type: 'failed'; view: PrimaryView; error: string }
  | { type: 'invalidated'; views: PrimaryView[] };

const emptySlot = {
  value: null,
  loading: false,
  stale: false,
  error: null,
};

export const initialViewState: ViewProjectionState = {
  course: { ...emptySlot },
  knowledge: { ...emptySlot },
  memory: { ...emptySlot },
};

export function reduceViewState(
  state: ViewProjectionState,
  action: ViewAction,
): ViewProjectionState {
  if (action.type === 'invalidated') {
    let next = state;
    for (const view of action.views) {
      next = {
        ...next,
        [view]: { ...next[view], stale: true },
      };
    }
    return next;
  }
  if (action.type === 'loading') {
    return {
      ...state,
      [action.view]: {
        ...state[action.view],
        loading: true,
        error: null,
      },
    };
  }
  if (action.type === 'failed') {
    return {
      ...state,
      [action.view]: {
        ...state[action.view],
        loading: false,
        error: action.error,
      },
    };
  }
  const loaded = <T,>(value: T): ViewSlot<T> => ({
    value,
    loading: false,
    stale: false,
    error: null,
  });
  if (action.view === 'course') {
    return { ...state, course: loaded(action.value) };
  }
  if (action.view === 'knowledge') {
    return { ...state, knowledge: loaded(action.value) };
  }
  return { ...state, memory: loaded(action.value) };
}
