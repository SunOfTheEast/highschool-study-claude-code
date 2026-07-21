import type {
  AbilityProjection,
  ChatMessage,
  EvidenceView,
  LearningSetSnapshot,
  LessonReplay,
  PersonaPresentation,
  PlanWorkspaceSnapshot,
  SessionKey,
  StudentNotebook,
  WorkflowView,
} from '../shared/contracts';

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export const api = {
  learningSet: () => json<LearningSetSnapshot>('/api/learning-set'),
  abilities: () => json<AbilityProjection>('/api/abilities'),
  evidence: (source: string) => (
    json<EvidenceView>(`/api/evidence?source=${encodeURIComponent(source)}`)
  ),
  persona: (key: SessionKey) => (
    json<PersonaPresentation>(`/api/persona?sessionKey=${encodeURIComponent(key)}`)
  ),
  setPersona: (key: SessionKey, id: string) => (
    json<PersonaPresentation>(`/api/sessions/${encodeURIComponent(key)}/persona`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ id }),
    })
  ),
  workspace: (planId: string) => (
    json<PlanWorkspaceSnapshot>(`/api/workspaces/${encodeURIComponent(planId)}`)
  ),
  history: (key: SessionKey) => (
    json<ChatMessage[]>(`/api/sessions/${encodeURIComponent(key)}/history`)
  ),
  deep: (key: SessionKey) => (
    json<{ enabled: boolean; workflows: WorkflowView[] }>(
      `/api/sessions/${encodeURIComponent(key)}/deep`,
    )
  ),
  setDeep: (key: SessionKey, enabled: boolean) => (
    json<{ enabled: boolean; workflows: WorkflowView[] }>(
      `/api/sessions/${encodeURIComponent(key)}/deep`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ enabled }),
      },
    )
  ),
  workflowAction: (
    key: SessionKey,
    id: string,
    action: 'confirm' | 'cancel',
  ) => json<WorkflowView>(
    `/api/sessions/${encodeURIComponent(key)}/workflows/${encodeURIComponent(id)}/${action}`,
    { method: 'POST' },
  ),
  notebook: (lessonId: string) => (
    json<StudentNotebook>(`/api/lessons/${encodeURIComponent(lessonId)}/notebook`)
  ),
  replay: (lessonId: string) => (
    json<LessonReplay>(`/api/lessons/${encodeURIComponent(lessonId)}/replay`)
  ),
  uploadImage: async (lessonId: string, image: File) => {
    const body = new FormData();
    body.set('image', image);
    return json<{ path: string }>(`/api/lessons/${encodeURIComponent(lessonId)}/images`, {
      method: 'POST',
      body,
    });
  },
  message: (key: SessionKey, text: string, imagePaths: string[] = []) => (
    json<{ accepted: true }>(`/api/sessions/${encodeURIComponent(key)}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, imagePaths }),
    })
  ),
  lessonAction: (lessonId: string, action: 'start' | 'pause' | 'reprepare') => (
    json<PlanWorkspaceSnapshot>(`/api/lessons/${encodeURIComponent(lessonId)}/${action}`, {
      method: 'POST',
    })
  ),
};
