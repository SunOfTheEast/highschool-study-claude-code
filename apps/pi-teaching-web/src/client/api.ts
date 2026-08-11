import type {
  ConversationItem,
  CalendarAppointment,
  CalendarLaunchReceipt,
  CalendarSnapshot,
  CourseSnapshot,
  FreeLearningSessionSummary,
  KnowledgeSnapshot,
  LearningAssetLibrarySnapshot,
  LearningAssetSemanticTags,
  LearningContextReference,
  LearningFootprintSnapshot,
  LearningMaterial,
  LearningMaterialView,
  LearningNote,
  LearningNoteBlock,
  LearningSetHomeSnapshot,
  LessonHandout,
  MaterialImportReceipt,
  MaterialLocatorSnapshot,
  MetaSessionSummary,
  ProblemActivitySnapshot,
  ProblemAnswerRevealEvent,
  ProblemAttemptEvent,
  ProblemAttemptResponse,
  AssetReviewProjection,
  ReviewEvent,
  ReviewResult,
  AssetFormation,
  SemanticRelation,
  StudentProblemCard,
  SessionKey,
  PeerExpression,
  PeerLive2DManifest,
  PublicFocusCycle,
} from '../shared/contracts';
import { formatLessonHandoutApiPath } from '../shared/handout-route';
import { transportFetch } from './transport';

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`API_ERROR: ${status}`);
    this.name = 'ApiError';
  }
}

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await transportFetch(input, init);
  if (!response.ok) {
    const text = await response.text();
    let body: unknown = text;
    try {
      body = JSON.parse(text);
    } catch {
      // Local server errors may be plain text.
    }
    throw new ApiError(response.status, body);
  }
  return response.json() as Promise<T>;
}

const post = <T>(path: string, body?: unknown) => json<T>(
  path,
  body === undefined
    ? { method: 'POST' }
    : {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body),
    },
);

const put = <T>(path: string, body: unknown) => json<T>(path, {
  method: 'PUT',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

const remove = <T>(path: string, body: unknown) => json<T>(path, {
  method: 'DELETE',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(body),
});

export type LearningNoteView = LearningNote & {
  semanticTags: LearningAssetSemanticTags | null;
  formation: AssetFormation | null;
  review: AssetReviewProjection | null;
};

export type ProblemCardView = StudentProblemCard & {
  activity: ProblemActivitySnapshot;
  semanticTags: LearningAssetSemanticTags | null;
  formation: AssetFormation | null;
  review: AssetReviewProjection | null;
};

export type AssetReviewAction =
  | { action: 'enroll' | 'remove' | 'restart'; expectedRevision: number }
  | {
    action: 'review'; expectedRevision: number; result: ReviewResult;
    problemAttemptId?: string;
  };

export const api = {
  calendar: () => json<CalendarSnapshot>('/api/calendar'),
  createCalendarAppointment: (input: Pick<
    CalendarAppointment,
    'title' | 'startsAt' | 'plannedMinutes' | 'destination'
  > & { learningSetPath?: string }) => post<{ appointment: CalendarAppointment }>('/api/calendar', input),
  updateCalendarAppointment: (
    id: string,
    input: Pick<
      CalendarAppointment,
      'title' | 'startsAt' | 'plannedMinutes' | 'learningSetPath' | 'destination'
    > & {
      expectedRevision: number;
    },
  ) => put<{ appointment: CalendarAppointment }>(
    `/api/calendar/${encodeURIComponent(id)}`,
    input,
  ),
  deleteCalendarAppointment: (id: string, expectedRevision: number) => remove<{
    deleted: CalendarAppointment;
  }>(`/api/calendar/${encodeURIComponent(id)}`, { expectedRevision }),
  launchCalendarAppointment: (id: string, expectedRevision: number) => post<CalendarLaunchReceipt>(
    `/api/calendar/${encodeURIComponent(id)}/launch`,
    { expectedRevision },
  ),
  focus: () => json<PublicFocusCycle | null>('/api/focus'),
  startFocus: (sessionKey: SessionKey, targetSeconds: 900 | 1500 | 2700) => (
    post<PublicFocusCycle>('/api/focus/start', { sessionKey, targetSeconds })
  ),
  pauseFocus: () => post<PublicFocusCycle>('/api/focus/pause'),
  resumeFocus: () => post<PublicFocusCycle>('/api/focus/resume'),
  endFocus: () => post<{
    targetSeconds: 900 | 1500 | 2700;
    elapsedSeconds: number;
    endedAt: string;
    reason: 'elapsed' | 'manual' | 'session-ended';
  }>('/api/focus/end'),
  home: () => json<LearningSetHomeSnapshot>('/api/home'),
  assets: () => json<LearningAssetLibrarySnapshot>('/api/assets'),
  note: (id: string) => json<LearningNoteView>(`/api/assets/notes/${encodeURIComponent(id)}`),
  updateNote: (
    id: string,
    input: { expectedRevision: number; title: string; blocks: LearningNoteBlock[] },
  ) => put<LearningNoteView>(`/api/assets/notes/${encodeURIComponent(id)}`, input),
  problemCard: (id: string) => json<ProblemCardView>(
    `/api/assets/problem-cards/${encodeURIComponent(id)}`,
  ),
  assetReview: (
    kind: 'note' | 'problem-card',
    id: string,
    input: AssetReviewAction,
    requestId = crypto.randomUUID(),
  ) => post<{ event: ReviewEvent; review: AssetReviewProjection }>(
    `/api/assets/${kind === 'note' ? 'notes' : 'problem-cards'}/${encodeURIComponent(id)}/review`,
    { ...input, requestId },
  ),
  updateProblemNote: (
    id: string,
    input: { expectedRevision: number; studentNote: string },
  ) => put<StudentProblemCard>(
    `/api/assets/problem-cards/${encodeURIComponent(id)}/note`,
    input,
  ),
  materials: () => json<LearningMaterial[]>('/api/materials'),
  material: (id: string) => json<LearningMaterialView>(
    `/api/materials/${encodeURIComponent(id)}`,
  ),
  materialLocator: (id: string, revision: number, locator: string | null) => (
    json<MaterialLocatorSnapshot>(
      `/api/materials/${encodeURIComponent(id)}/revisions/${revision}/locators/${
        encodeURIComponent(locator ?? 'whole')
      }`,
    )
  ),
  importMaterial: (input: {
    title: string;
    file: File;
    requestId?: string;
    target?: { id: string; expectedRevision: number };
  }) => {
    const form = new FormData();
    form.set('requestId', input.requestId ?? crypto.randomUUID());
    form.set('title', input.title);
    form.set('file', input.file);
    if (input.target) {
      form.set('targetId', input.target.id);
      form.set('expectedRevision', String(input.target.expectedRevision));
    }
    return json<MaterialImportReceipt>('/api/materials', { method: 'POST', body: form });
  },
  semanticTags: (kind: 'note' | 'problem-card', id: string) => json<LearningAssetSemanticTags>(
    `/api/semantics/assets/${kind}/${encodeURIComponent(id)}`,
  ),
  updateSemanticTags: (
    kind: 'note' | 'problem-card',
    id: string,
    input: { expectedRevision?: number; core: string[]; related: string[] },
  ) => put<LearningAssetSemanticTags>(
    `/api/semantics/assets/${kind}/${encodeURIComponent(id)}`,
    input,
  ),
  querySemantics: (input: {
    terms: string[];
    limit: number;
    allowRelatedExpansion: boolean;
  }) => post<{
    candidates: Array<{
      path: string;
      kind: 'note' | 'problem-card';
      id: string;
      core: string[];
      related: string[];
      titleOrStem: string;
    }>;
    matched: number;
    relatedTerms: string[];
  }>('/api/semantics/query', input),
  semanticRelations: () => json<SemanticRelation[]>('/api/semantics/relations'),
  createFreeLearning: (
    selectedAssets: LearningContextReference[],
    intent: 'open' | 'review' = 'open',
  ) => post<{
    session: FreeLearningSessionSummary;
    route: string;
  }>('/api/free-learning', { selectedAssets, intent }),
  meta: () => json<MetaSessionSummary[]>('/api/meta'),
  createMeta: (selectedAssets: LearningContextReference[]) => post<{
    session: MetaSessionSummary;
    route: string;
  }>('/api/meta', { selectedAssets }),
  footprint: () => json<LearningFootprintSnapshot>('/api/footprint'),
  endFreeLearning: (id: string) => post<{ session: FreeLearningSessionSummary }>(
    `/api/free-learning/${encodeURIComponent(id)}/end`,
  ),
  attemptProblem: (
    id: string,
    response: ProblemAttemptResponse,
    requestId = crypto.randomUUID(),
  ) => post<{ event: ProblemAttemptEvent }>(
    `/api/problem-cards/${encodeURIComponent(id)}/attempts`,
    { requestId, response },
  ),
  revealProblem: (id: string, requestId = crypto.randomUUID()) => post<{
    event: ProblemAnswerRevealEvent;
    standardAnswer: string;
  }>(`/api/problem-cards/${encodeURIComponent(id)}/reveal`, { requestId }),
  askProblemTeacher: (id: string) => post<{
    session: FreeLearningSessionSummary;
    route: string;
  }>(`/api/problem-cards/${encodeURIComponent(id)}/ask-teacher`),
  course: (selected?: string | null) => json<CourseSnapshot>(
    `/api/course${selected ? `?selected=${encodeURIComponent(selected)}` : ''}`,
  ),
  knowledge: () => json<KnowledgeSnapshot>('/api/knowledge'),
  lessonHandout: (
    planId: string,
    lessonId: string,
    blockIds: readonly string[],
  ) => json<LessonHandout>(formatLessonHandoutApiPath(planId, lessonId, blockIds)),
  history: (key: SessionKey) => json<ConversationItem[]>(
    `/api/sessions/${encodeURIComponent(key)}/history`,
  ),
  peerPortrait: async (actorId: 'peer-axia', expression: PeerExpression) => {
    const response = await transportFetch(
      `/api/desktop/actors/${encodeURIComponent(actorId)}/${encodeURIComponent(expression)}`,
    );
    return response.ok ? response.blob() : null;
  },
  peerLive2DManifest: async (actorId: 'peer-axia') => {
    const response = await transportFetch(
      `/api/desktop/actors/${encodeURIComponent(actorId)}/live2d/manifest`,
    );
    return response.ok ? response.json() as Promise<PeerLive2DManifest> : null;
  },
  peerLive2DFile: async (
    actorId: 'peer-axia',
    relativePath: string,
    signal?: AbortSignal,
  ) => {
    const response = await transportFetch(
      `/api/desktop/actors/${encodeURIComponent(actorId)}/live2d/file?path=${
        encodeURIComponent(relativePath)
      }`,
      signal ? { signal } : undefined,
    );
    return response.ok ? response.blob() : null;
  },
  peerSpeech: async (actorId: 'peer-axia', text: string, signal?: AbortSignal) => {
    const response = await transportFetch('/api/desktop/peer-speech', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ actorId, text }),
      ...(signal ? { signal } : {}),
    });
    return response.ok ? response.blob() : null;
  },
  send: (key: SessionKey, text: string) => post<{ accepted: true }>(
    `/api/sessions/${encodeURIComponent(key)}/messages`,
    { text },
  ),
  startPlan: (id: string) => post<{ route: string; sessionKey: SessionKey }>(
    `/api/plans/${encodeURIComponent(id)}/start`,
  ),
  completePlan: (id: string) => post<{ accepted: true }>(
    `/api/plans/${encodeURIComponent(id)}/complete`,
  ),
  startLesson: (planId: string, id: string) => post<{ route: string; sessionKey: SessionKey }>(
    `/api/plans/${encodeURIComponent(planId)}/lessons/${encodeURIComponent(id)}/start`,
  ),
  closeLesson: (planId: string, id: string) => post<{ accepted: true }>(
    `/api/plans/${encodeURIComponent(planId)}/lessons/${encodeURIComponent(id)}/close`,
  ),
};
