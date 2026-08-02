import type {
  ConversationItem,
  CourseSnapshot,
  KnowledgeSnapshot,
  SessionKey,
} from '../shared/contracts';

export class ApiError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(`API_ERROR: ${status}`);
    this.name = 'ApiError';
  }
}

async function json<T>(input: RequestInfo | URL, init?: RequestInit): Promise<T> {
  const response = await fetch(input, init);
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

export const api = {
  course: (selected?: string | null) => json<CourseSnapshot>(
    `/api/course${selected ? `?selected=${encodeURIComponent(selected)}` : ''}`,
  ),
  knowledge: () => json<KnowledgeSnapshot>('/api/knowledge'),
  history: (key: SessionKey) => json<ConversationItem[]>(
    `/api/sessions/${encodeURIComponent(key)}/history`,
  ),
  send: (key: SessionKey, text: string) => post<{ accepted: true }>(
    `/api/sessions/${encodeURIComponent(key)}/messages`,
    { text },
  ),
  startPlan: (id: string) => post<{ route: string; sessionKey: SessionKey }>(
    `/api/plans/${encodeURIComponent(id)}/start`,
  ),
  completePlan: (id: string) => post<{ route: string }>(
    `/api/plans/${encodeURIComponent(id)}/complete`,
  ),
  startLesson: (id: string) => post<{ route: string; sessionKey: SessionKey }>(
    `/api/lessons/${encodeURIComponent(id)}/start`,
  ),
  closeLesson: (id: string) => post<{ route: string }>(
    `/api/lessons/${encodeURIComponent(id)}/close`,
  ),
};
