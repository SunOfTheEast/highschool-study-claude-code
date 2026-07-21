import type {
  ChatMessage,
  LearningSetSnapshot,
  PlanWorkspaceSnapshot,
  SessionKey,
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
  message: (key: SessionKey, text: string) => (
    json<{ accepted: true }>(`/api/sessions/${encodeURIComponent(key)}/messages`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text }),
    })
  ),
  lessonAction: (lessonId: string, action: 'start' | 'pause' | 'reprepare') => (
    json<PlanWorkspaceSnapshot>(`/api/lessons/${encodeURIComponent(lessonId)}/${action}`, {
      method: 'POST',
    })
  ),
};
