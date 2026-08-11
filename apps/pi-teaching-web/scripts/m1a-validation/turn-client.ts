import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
} from 'node:fs';
import { dirname } from 'node:path';

export type ObservedTurn = {
  sessionKey: string;
  startedAt: number;
  firstVisibleAt: number | null;
  settledAt: number;
  events: unknown[];
  history: unknown[];
};

type SendObservedTurnOptions = {
  baseUrl: string;
  sessionKey: string;
  message: string;
  eventLogPath: string;
  token?: string;
};

type ProjectedEvent = {
  type?: unknown;
  sessionKey?: unknown;
  status?: unknown;
  item?: unknown;
  items?: unknown;
  message?: unknown;
};

function validatedBaseUrl(value: string): URL {
  const url = new URL(value);
  if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1' || url.port === '') {
    throw new Error('validation turn endpoint must be an explicit loopback http://127.0.0.1:<port> URL');
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('validation turn endpoint must not contain credentials, search, or fragment data');
  }
  url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url;
}

function prepareEventLog(path: string): void {
  mkdirSync(dirname(path), { recursive: true });
  if (!existsSync(path)) return;
  const metadata = lstatSync(path);
  if (metadata.isSymbolicLink() || !metadata.isFile()) {
    throw new Error(`event log must be a plain file: ${path}`);
  }
}

function eventObject(value: unknown): ProjectedEvent | null {
  return value !== null && typeof value === 'object' ? value as ProjectedEvent : null;
}

function visibleConversationItem(value: unknown): boolean {
  if (value === null || typeof value !== 'object') return false;
  const kind = (value as { kind?: unknown }).kind;
  return kind === 'assistant'
    || kind === 'tool'
    || kind === 'material-search'
    || kind === 'lesson-review'
    || kind === 'lesson-handout';
}

export function isStudentVisibleProgress(event: unknown, sessionKey: string): boolean {
  const projected = eventObject(event);
  if (!projected || projected.sessionKey !== sessionKey) return false;
  if (projected.type === 'assistant-delta') return true;
  if (projected.type === 'conversation-item') return visibleConversationItem(projected.item);
  if (projected.type === 'conversation-snapshot' && Array.isArray(projected.items)) {
    return projected.items.some(visibleConversationItem);
  }
  return false;
}

function waitForOpen(socket: WebSocket): Promise<void> {
  if (socket.readyState === WebSocket.OPEN) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const opened = (): void => {
      cleanup();
      resolve();
    };
    const failed = (): void => {
      cleanup();
      reject(new Error('validation event socket failed before opening'));
    };
    const cleanup = (): void => {
      socket.removeEventListener('open', opened);
      socket.removeEventListener('error', failed);
    };
    socket.addEventListener('open', opened, { once: true });
    socket.addEventListener('error', failed, { once: true });
  });
}

async function responseJsonArray(response: Response, description: string): Promise<unknown[]> {
  if (!response.ok) {
    throw new Error(`${description} failed with HTTP ${response.status}: ${await response.text()}`);
  }
  const value: unknown = await response.json();
  if (!Array.isArray(value)) throw new Error(`${description} did not return an array`);
  return value;
}

export async function sendObservedTurn(options: SendObservedTurnOptions): Promise<ObservedTurn> {
  const base = validatedBaseUrl(options.baseUrl);
  if (options.message.trim().length === 0) throw new Error('validation turn message must not be empty');
  prepareEventLog(options.eventLogPath);

  const socketUrl = new URL('events', base);
  socketUrl.protocol = 'ws:';
  const socket = options.token
    ? new WebSocket(socketUrl, `studyforge-token.${options.token}`)
    : new WebSocket(socketUrl);
  const events: unknown[] = [];
  const startedAt = Date.now();
  let firstVisibleAt: number | null = null;
  let requestBegun = false;
  let aborted = false;
  let completed = false;

  let resolveSettled!: (value: number) => void;
  let rejectSettled!: (reason: Error) => void;
  const settled = new Promise<number>((resolve, reject) => {
    resolveSettled = resolve;
    rejectSettled = reject;
  });

  socket.addEventListener('message', (message) => {
    const observedAt = Date.now();
    let event: unknown;
    try {
      event = JSON.parse(String(message.data));
    } catch {
      event = { type: 'unparseable-event', raw: String(message.data) };
    }
    events.push(event);
    appendFileSync(options.eventLogPath, `${JSON.stringify({
      observedAt: new Date(observedAt).toISOString(),
      observedAtMs: observedAt,
      event,
    })}\n`);

    if (firstVisibleAt === null && isStudentVisibleProgress(event, options.sessionKey)) {
      firstVisibleAt = observedAt;
    }

    const projected = eventObject(event);
    if (!requestBegun || projected?.sessionKey !== options.sessionKey) return;
    if (projected.type === 'session-error') {
      completed = true;
      rejectSettled(new Error(`Session ${options.sessionKey} failed: ${String(projected.message)}`));
    } else if (projected.type === 'session-run' && projected.status === 'idle') {
      completed = true;
      resolveSettled(observedAt);
    }
  });
  socket.addEventListener('close', () => {
    if (!completed && !aborted) {
      rejectSettled(new Error(`event socket closed before Session ${options.sessionKey} became idle`));
    }
  });

  try {
    await waitForOpen(socket);
    requestBegun = true;
    const messageUrl = new URL(
      `api/sessions/${encodeURIComponent(options.sessionKey)}/messages`,
      base,
    );
    const response = await fetch(messageUrl, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(options.token ? { authorization: `Bearer ${options.token}` } : {}),
      },
      body: JSON.stringify({ text: options.message.trim() }),
    });
    if (!response.ok) {
      throw new Error(`send turn failed with HTTP ${response.status}: ${await response.text()}`);
    }
    const accepted: unknown = await response.json();
    if (
      accepted === null
      || typeof accepted !== 'object'
      || (accepted as { accepted?: unknown }).accepted !== true
    ) {
      throw new Error('send turn response did not confirm acceptance');
    }

    const settledAt = await settled;
    const historyUrl = new URL(
      `api/sessions/${encodeURIComponent(options.sessionKey)}/history`,
      base,
    );
    const history = await responseJsonArray(await fetch(
      historyUrl,
      options.token ? { headers: { authorization: `Bearer ${options.token}` } } : undefined,
    ), 'history request');
    aborted = true;
    socket.close();
    return {
      sessionKey: options.sessionKey,
      startedAt,
      firstVisibleAt,
      settledAt,
      events,
      history,
    };
  } catch (error) {
    aborted = true;
    socket.close();
    throw error;
  }
}
