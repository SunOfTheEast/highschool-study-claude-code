import type { CourseSnapshot, KnowledgeSnapshot } from '../shared/contracts';

export const PRIMARY_VIEWS = ['home', 'assets', 'calendar', 'course'] as const;
export type PrimaryView = typeof PRIMARY_VIEWS[number];
export type ProjectionView = 'course' | 'knowledge';

export type ViewSlot<T> = {
  value: T | null;
  loading: boolean;
  stale: boolean;
  error: string | null;
};

export type ViewProjectionState = {
  course: ViewSlot<CourseSnapshot>;
  knowledge: ViewSlot<KnowledgeSnapshot>;
};

export type ViewAction =
  | { type: 'loading'; view: ProjectionView }
  | { type: 'loaded'; view: 'course'; value: CourseSnapshot }
  | { type: 'loaded'; view: 'knowledge'; value: KnowledgeSnapshot }
  | { type: 'failed'; view: ProjectionView; error: string }
  | { type: 'invalidated'; views: ProjectionView[] };

const emptySlot = {
  value: null,
  loading: false,
  stale: false,
  error: null,
};

export const initialViewState: ViewProjectionState = {
  course: { ...emptySlot },
  knowledge: { ...emptySlot },
};

export function reduceViewState(
  state: ViewProjectionState,
  action: ViewAction,
): ViewProjectionState {
  if (action.type === 'invalidated') {
    let next = state;
    for (const view of action.views) {
      next = { ...next, [view]: { ...next[view], stale: true } };
    }
    return next;
  }
  if (action.type === 'loading' || action.type === 'failed') {
    const slot = state[action.view];
    return {
      ...state,
      [action.view]: {
        ...slot,
        loading: action.type === 'loading',
        error: action.type === 'failed' ? action.error : null,
      },
    };
  }
  const loaded = <T,>(value: T): ViewSlot<T> => ({
    value,
    loading: false,
    stale: false,
    error: null,
  });
  return action.view === 'course'
    ? { ...state, course: loaded(action.value) }
    : { ...state, knowledge: loaded(action.value) };
}
