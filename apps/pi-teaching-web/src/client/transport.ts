export type StudyForgeTransport = {
  apiBase: string;
  token: string;
};

let current: StudyForgeTransport | null = null;

export function configureTransport(transport: StudyForgeTransport): void {
  current = {
    apiBase: transport.apiBase.replace(/\/+$/, ''),
    token: transport.token,
  };
}

export function resetTransport(): void {
  current = null;
}

export function prepareTransportRequest(
  input: RequestInfo | URL,
  init: RequestInit = {},
): { input: RequestInfo | URL; init: RequestInit } {
  if (!current || typeof input !== 'string' || !input.startsWith('/')) return { input, init };
  const headers = new Headers(init.headers);
  headers.set('authorization', `Bearer ${current.token}`);
  return {
    input: `${current.apiBase}${input}`,
    init: { ...init, headers },
  };
}

export function transportFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const prepared = prepareTransportRequest(input, init);
  return fetch(prepared.input, prepared.init);
}

export function eventTransport(location: Pick<Location, 'protocol' | 'host'>): {
  url: string;
  protocols: string[];
} {
  if (current) {
    const url = new URL(current.apiBase);
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.pathname = '/events';
    return {
      url: url.toString(),
      protocols: ['studyforge', `studyforge-token.${current.token}`],
    };
  }
  return {
    url: `${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/events`,
    protocols: [],
  };
}
