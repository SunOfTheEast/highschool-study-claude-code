import type {
  ChatMessage,
  LearningSetSnapshot,
  PlanWorkspaceSnapshot,
  SessionKey,
  StudentNotebook,
} from '../shared/contracts';

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) throw new Error(await response.text());
  return response.json() as Promise<T>;
}

export const api = {
  learningSet: () => json<LearningSetSnapshot>('/api/learning-set'),
  workspace: (planId: string) => (
    json<PlanWorkspaceSnapshot>(`/api/workspaces/${encodeURIComponent(planId)}`)
  ),
  history: (key: SessionKey) => (
    json<ChatMessage[]>(`/api/sessions/${encodeURIComponent(key)}/history`)
  ),
  notebook: (lessonId: string) => (
    json<StudentNotebook>(`/api/lessons/${encodeURIComponent(lessonId)}/notebook`)
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
