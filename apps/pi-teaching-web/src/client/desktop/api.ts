import type { AuthEvent, AuthPrompt, AuthType } from '@earendil-works/pi-ai';
import type { DesktopModelSelection } from '../../desktop/contracts';
import type { DesktopModelCatalog } from './ModelSettings';
import { transportFetch } from '../transport';

export type DesktopStatus = {
  state: 'needs-learning-set' | 'needs-models' | 'invalid-learning-set' | 'runtime-error' | 'ready';
  onboardingComplete: boolean;
  currentLearningSet: string | null;
  recentLearningSets: string[];
  teacher: DesktopModelSelection | null;
  scout: DesktopModelSelection | null;
  issue: { code: string; detail: string } | null;
};

type WithoutSignal<T> = T extends unknown ? Omit<T, 'signal'> : never;

export type DesktopAuthFlow = {
  flowId: string;
  status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  events: AuthEvent[];
  prompt: WithoutSignal<AuthPrompt> | null;
  error: string | null;
};

class DesktopApiError extends Error {
  constructor(readonly status: number, readonly body: unknown) {
    super(typeof body === 'object' && body && 'error' in body
      ? String((body as { error: unknown }).error)
      : `DESKTOP_API_ERROR: ${status}`);
  }
}

async function responseJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await transportFetch(path, init);
  if (!response.ok) {
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      body = await response.text();
    }
    throw new DesktopApiError(response.status, body);
  }
  return response.json() as Promise<T>;
}

function jsonRequest(method: string, value: unknown): RequestInit {
  return {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(value),
  };
}

export const desktopApi = {
  status: () => responseJson<DesktopStatus>('/api/desktop/status'),
  models: () => responseJson<DesktopModelCatalog>('/api/desktop/models'),
  createBlank: (name: string) => responseJson<{ learningSet: string; restartRequired: true }>(
    '/api/desktop/learning-sets/blank',
    jsonRequest('POST', { name }),
  ),
  createExample: (name: string) => responseJson<{ learningSet: string; restartRequired: true }>(
    '/api/desktop/learning-sets/example',
    jsonRequest('POST', { name }),
  ),
  selectExisting: (path: string) => responseJson<{ learningSet: string; restartRequired: true }>(
    '/api/desktop/learning-sets/select',
    jsonRequest('POST', { path }),
  ),
  saveModels: (teacher: DesktopModelSelection, scout: DesktopModelSelection) => (
    responseJson<{ onboardingComplete: boolean; restartRequired: true }>(
      '/api/desktop/models',
      jsonRequest('PUT', { teacher, scout }),
    )
  ),
  startAuth: (provider: string, type: AuthType) => responseJson<{ flowId: string }>(
    '/api/desktop/auth',
    jsonRequest('POST', { provider, type }),
  ),
  auth: (id: string) => responseJson<DesktopAuthFlow>(
    `/api/desktop/auth/${encodeURIComponent(id)}`,
  ),
  respondAuth: (id: string, value: string) => transportFetch(
    `/api/desktop/auth/${encodeURIComponent(id)}/respond`,
    jsonRequest('POST', { value }),
  ).then((response) => {
    if (!response.ok) throw new DesktopApiError(response.status, null);
  }),
  help: async (id: 'macos-installation' | 'first-learning') => {
    const response = await transportFetch(`/api/desktop/help/${id}`);
    if (!response.ok) throw new DesktopApiError(response.status, null);
    return response.text();
  },
};
