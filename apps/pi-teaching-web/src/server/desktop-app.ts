import type {
  AuthEvent,
  AuthInteraction,
  AuthPrompt,
  AuthType,
} from '@earendil-works/pi-ai';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import {
  loadAppConfig,
  parseAppConfig,
  saveAppConfig,
} from '../desktop/app-config';
import type {
  DesktopModelSelection,
  StudyForgePaths,
} from '../desktop/contracts';
import {
  copyLearningSet,
  createBlankLearningSet,
  validateLearningSet,
} from '../desktop/learning-sets';
import type { DesktopModelService } from '../desktop/model-service';
import type { PeerMediaService } from '../desktop/peer-media';
import { writeDesktopPiSettings } from '../desktop/pi-settings';

type ModelService = Pick<DesktopModelService, 'catalog' | 'resolve' | 'login' | 'logout'>;

type DesktopRuntimeIssue = {
  code: 'PROVIDER_AUTH_REQUIRED' | 'MODEL_UNAVAILABLE' | 'LEARNING_SET_INVALID' | 'RUNTIME_FAILURE';
  detail: string;
};

export type DesktopRequestDependencies = {
  token: string;
  paths: StudyForgePaths;
  resourceRoot: string;
  derivativeExampleRoot: string;
  modelService: ModelService;
  peerMedia?: PeerMediaService;
  canChangeLearningSet?(): boolean | Promise<boolean>;
  shutdown(): void;
  runtimeIssue?: DesktopRuntimeIssue | null;
};

type WithoutSignal<T> = T extends unknown ? Omit<T, 'signal'> : never;
type PublicPrompt = WithoutSignal<AuthPrompt>;

type AuthFlow = {
  id: string;
  status: 'running' | 'waiting' | 'completed' | 'failed' | 'cancelled';
  events: AuthEvent[];
  prompt: PublicPrompt | null;
  answer: ((value: string) => void) | null;
  error: string | null;
  abort: AbortController;
  redactions: Set<string>;
};

const allowedOrigins = new Set(['tauri://localhost', 'http://tauri.localhost']);

function json(value: unknown, status = 200): Response {
  return Response.json(value, { status });
}

function offlineHelp(resourceRoot: string, id: 'macos-installation' | 'first-learning'): string {
  const markdown = readFileSync(join(resourceRoot, 'help', `${id}.md`), 'utf8');
  return markdown.replace(/\]\(images\/([a-z0-9-]+\.png)\)/g, (_match, name: string) => {
    const image = readFileSync(join(resourceRoot, 'help', 'images', name)).toString('base64');
    return `](data:image/png;base64,${image})`;
  });
}

function publicPrompt(prompt: AuthPrompt): PublicPrompt {
  if (prompt.type === 'select') {
    return {
      type: 'select',
      message: prompt.message,
      options: prompt.options.map((option) => ({ ...option })),
    };
  }
  return {
    type: prompt.type,
    message: prompt.message,
    ...(prompt.placeholder === undefined ? {} : { placeholder: prompt.placeholder }),
  } as PublicPrompt;
}

function redactText(value: string, redactions: ReadonlySet<string>): string {
  let result = value;
  for (const secret of redactions) {
    if (secret) result = result.split(secret).join('••••');
  }
  return result;
}

function publicEvent(event: AuthEvent, redactions: ReadonlySet<string>): AuthEvent {
  if (event.type === 'info') {
    return {
      ...event,
      message: redactText(event.message, redactions),
      ...(event.links ? { links: event.links.map((link) => ({ ...link })) } : {}),
    };
  }
  if (event.type === 'progress') {
    return { ...event, message: redactText(event.message, redactions) };
  }
  return { ...event };
}

class DesktopAuthFlows {
  private readonly flows = new Map<string, AuthFlow>();

  constructor(private readonly models: ModelService) {}

  start(provider: string, type: AuthType): string {
    const id = crypto.randomUUID();
    const flow: AuthFlow = {
      id,
      status: 'running',
      events: [],
      prompt: null,
      answer: null,
      error: null,
      abort: new AbortController(),
      redactions: new Set(),
    };
    this.flows.set(id, flow);
    const interaction: AuthInteraction = {
      signal: flow.abort.signal,
      notify: (event) => flow.events.push(publicEvent(event, flow.redactions)),
      prompt: (prompt) => new Promise<string>((resolve, reject) => {
        if (flow.abort.signal.aborted) {
          reject(new Error('AUTH_CANCELLED'));
          return;
        }
        flow.status = 'waiting';
        flow.prompt = publicPrompt(prompt);
        flow.answer = resolve;
        flow.abort.signal.addEventListener('abort', () => reject(new Error('AUTH_CANCELLED')), {
          once: true,
        });
      }),
    };
    void this.models.login(provider, type, interaction).then(() => {
      flow.status = 'completed';
      flow.prompt = null;
      flow.answer = null;
    }).catch((error) => {
      flow.status = flow.abort.signal.aborted ? 'cancelled' : 'failed';
      flow.prompt = null;
      flow.answer = null;
      flow.error = flow.status === 'cancelled'
        ? null
        : error instanceof Error ? error.message : 'AUTH_FAILED';
    });
    return id;
  }

  read(id: string) {
    const flow = this.flows.get(id);
    if (!flow) throw new Error('AUTH_FLOW_NOT_FOUND');
    return {
      flowId: flow.id,
      status: flow.status,
      events: flow.events.map((event) => publicEvent(event, flow.redactions)),
      prompt: flow.prompt,
      error: flow.error,
    };
  }

  respond(id: string, value: string): void {
    const flow = this.flows.get(id);
    if (!flow) throw new Error('AUTH_FLOW_NOT_FOUND');
    if (flow.status !== 'waiting' || !flow.answer) throw new Error('AUTH_FLOW_NOT_WAITING');
    flow.redactions.add(value);
    flow.events = flow.events.map((event) => publicEvent(event, flow.redactions));
    const answer = flow.answer;
    flow.answer = null;
    flow.prompt = null;
    flow.status = 'running';
    answer(value);
  }

  cancel(id: string): void {
    const flow = this.flows.get(id);
    if (!flow) throw new Error('AUTH_FLOW_NOT_FOUND');
    flow.abort.abort();
    flow.status = 'cancelled';
    flow.prompt = null;
    flow.answer = null;
  }
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('DESKTOP_REQUEST_INVALID');
  }
  return value as Record<string, unknown>;
}

function bodyString(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0 || /[\r\n\0]/.test(value)) {
    throw new Error('DESKTOP_REQUEST_INVALID');
  }
  return value;
}

function peerSpeechBody(value: unknown): { actorId: 'peer-axia'; text: string } {
  const body = bodyObject(value);
  if (
    Object.keys(body).length !== 2
    || body.actorId !== 'peer-axia'
    || typeof body.text !== 'string'
    || body.text.trim().length === 0
    || body.text.length > 12_000
    || body.text.includes('\0')
  ) throw new Error('DESKTOP_REQUEST_INVALID');
  return { actorId: 'peer-axia', text: body.text };
}

function selection(value: unknown): DesktopModelSelection {
  const parsed = parseAppConfig({
    version: 1,
    onboardingComplete: false,
    currentLearningSet: null,
    recentLearningSets: [],
    teacher: value,
    scout: null,
  }).teacher;
  if (!parsed) throw new Error('DESKTOP_REQUEST_INVALID');
  return parsed;
}

function selectedConfig(paths: StudyForgePaths, root: string) {
  const current = loadAppConfig(paths.appConfigPath);
  const recentLearningSets = [
    root,
    ...current.recentLearningSets.filter((candidate) => candidate !== root),
  ].slice(0, 8);
  const next = {
    ...current,
    currentLearningSet: root,
    recentLearningSets,
    onboardingComplete: current.teacher !== null && current.scout !== null,
  };
  saveAppConfig(paths.appConfigPath, next);
  return next;
}

export function knownDesktopLearningSetRoots(paths: StudyForgePaths): string[] {
  const config = loadAppConfig(paths.appConfigPath);
  return [...new Set([
    config.currentLearningSet,
    ...config.recentLearningSets,
  ].flatMap((candidate) => candidate ? [resolve(candidate)] : []))];
}

function status(deps: DesktopRequestDependencies) {
  const config = loadAppConfig(deps.paths.appConfigPath);
  const validation = config.currentLearningSet === null
    ? null
    : validateLearningSet(config.currentLearningSet);
  const state = deps.runtimeIssue
    ? 'runtime-error'
    : config.currentLearningSet === null
      ? 'needs-learning-set'
      : validation && !validation.ok
        ? 'invalid-learning-set'
        : !config.teacher || !config.scout
          ? 'needs-models'
          : 'ready';
  return {
    state,
    onboardingComplete: config.onboardingComplete,
    currentLearningSet: config.currentLearningSet,
    recentLearningSets: config.recentLearningSets,
    teacher: config.teacher,
    scout: config.scout,
    issue: deps.runtimeIssue ?? (validation && !validation.ok
      ? { code: 'LEARNING_SET_INVALID', detail: validation.code }
      : null),
  };
}

function authorized(request: Request, token: string): boolean {
  if (request.headers.get('authorization') === `Bearer ${token}`) return true;
  if (new URL(request.url).pathname !== '/events') return false;
  return (request.headers.get('sec-websocket-protocol') ?? '')
    .split(',')
    .map((value) => value.trim())
    .includes(`studyforge-token.${token}`);
}

function errorResponse(error: unknown): Response {
  const message = error instanceof Error ? error.message : 'RUNTIME_FAILURE';
  if (message.startsWith('STUDYFORGE_MODEL_UNAVAILABLE: ')) {
    return json({
      error: 'STUDYFORGE_MODEL_UNAVAILABLE',
      detail: message.slice('STUDYFORGE_MODEL_UNAVAILABLE: '.length),
    }, 409);
  }
  if (message.startsWith('STUDYFORGE_THINKING_UNAVAILABLE: ')) {
    return json({
      error: 'STUDYFORGE_THINKING_UNAVAILABLE',
      detail: message.slice('STUDYFORGE_THINKING_UNAVAILABLE: '.length),
    }, 409);
  }
  if (message.startsWith('LEARNING_SET_')) {
    const statusCode = message === 'LEARNING_SET_DESTINATION_EXISTS' ? 409 : 422;
    return json({ error: message }, statusCode);
  }
  if (message === 'FOCUS_CYCLE_ACTIVE') return json({ error: message }, 409);
  if (message === 'AUTH_FLOW_NOT_FOUND') return json({ error: message }, 404);
  if (message.startsWith('AUTH_FLOW_') || message === 'DESKTOP_REQUEST_INVALID') {
    return json({ error: message }, 400);
  }
  return json({ error: 'RUNTIME_FAILURE' }, 500);
}

export function withDesktopCors(request: Request, response: Response): Response {
  const origin = request.headers.get('origin');
  if (!origin || !allowedOrigins.has(origin)) return response;
  const headers = new Headers(response.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('vary', 'origin');
  return new Response(response.body, { status: response.status, headers });
}

export function createDesktopRequestHandler(deps: DesktopRequestDependencies) {
  const authFlows = new DesktopAuthFlows(deps.modelService);
  const requireLearningSetChangeAllowed = async () => {
    if (deps.canChangeLearningSet && !await deps.canChangeLearningSet()) {
      throw new Error('FOCUS_CYCLE_ACTIVE');
    }
  };
  return async (request: Request): Promise<Response | null> => {
    const origin = request.headers.get('origin');
    if (request.method === 'OPTIONS') {
      if (!origin || !allowedOrigins.has(origin)) return json({ error: 'DESKTOP_ORIGIN_FORBIDDEN' }, 403);
      return withDesktopCors(request, new Response(null, {
        status: 204,
        headers: {
          'access-control-allow-headers': 'authorization, content-type',
          'access-control-allow-methods': 'GET, POST, PUT, DELETE, OPTIONS',
        },
      }));
    }
    if (!authorized(request, deps.token)) {
      return withDesktopCors(request, json({ error: 'DESKTOP_UNAUTHORIZED' }, 401));
    }
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/desktop/') && url.pathname !== '/events') return null;
    if (url.pathname === '/events') return null;
    try {
      let response: Response;
      if (request.method === 'GET' && url.pathname === '/api/desktop/status') {
        response = json(status(deps));
      } else if (request.method === 'GET' && url.pathname === '/api/desktop/models') {
        response = json(await deps.modelService.catalog());
      } else if (request.method === 'GET' && url.pathname.startsWith('/api/desktop/help/')) {
        const id = url.pathname.slice('/api/desktop/help/'.length);
        if (id !== 'macos-installation' && id !== 'first-learning') {
          response = json({ error: 'NOT_FOUND' }, 404);
        } else {
          response = new Response(offlineHelp(deps.resourceRoot, id), {
            headers: { 'content-type': 'text/markdown; charset=utf-8' },
          });
        }
      } else if (
        request.method === 'GET'
        && /^\/api\/desktop\/actors\/[^/]+\/live2d\/manifest$/.test(url.pathname)
      ) {
        const match = /^\/api\/desktop\/actors\/([^/]+)\/live2d\/manifest$/.exec(url.pathname);
        response = match && deps.peerMedia
          ? deps.peerMedia.live2dManifest(match[1]!)
          : json({ error: 'NOT_FOUND' }, 404);
      } else if (
        request.method === 'GET'
        && /^\/api\/desktop\/actors\/[^/]+\/live2d\/file$/.test(url.pathname)
      ) {
        const match = /^\/api\/desktop\/actors\/([^/]+)\/live2d\/file$/.exec(url.pathname);
        response = match && deps.peerMedia
          ? deps.peerMedia.live2dFile(match[1]!, url.searchParams.get('path') ?? '')
          : json({ error: 'NOT_FOUND' }, 404);
      } else if (request.method === 'GET' && url.pathname.startsWith('/api/desktop/actors/')) {
        const match = /^\/api\/desktop\/actors\/([^/]+)\/([^/]+)$/.exec(url.pathname);
        response = match && deps.peerMedia
          ? deps.peerMedia.portrait(match[1]!, match[2]!)
          : json({ error: 'NOT_FOUND' }, 404);
      } else if (request.method === 'POST' && url.pathname === '/api/desktop/peer-speech') {
        const body = peerSpeechBody(await request.json());
        response = deps.peerMedia
          ? await deps.peerMedia.speech(body.actorId, body.text, request.signal)
          : json({ error: 'PEER_SPEECH_UNAVAILABLE' }, 503);
      } else if (request.method === 'POST' && url.pathname === '/api/desktop/learning-sets/blank') {
        await requireLearningSetChangeAllowed();
        const body = bodyObject(await request.json());
        const root = createBlankLearningSet({
          documentsHome: deps.paths.documentsHome,
          name: bodyString(body.name),
          templateRoot: `${deps.resourceRoot}/templates/blank-learning-set`,
        });
        selectedConfig(deps.paths, root);
        response = json({ learningSet: root, restartRequired: true }, 201);
      } else if (request.method === 'POST' && url.pathname === '/api/desktop/learning-sets/example') {
        await requireLearningSetChangeAllowed();
        const body = bodyObject(await request.json());
        const root = copyLearningSet({
          sourceRoot: deps.derivativeExampleRoot,
          documentsHome: deps.paths.documentsHome,
          name: bodyString(body.name),
        });
        selectedConfig(deps.paths, root);
        response = json({ learningSet: root, restartRequired: true }, 201);
      } else if (request.method === 'POST' && url.pathname === '/api/desktop/learning-sets/select') {
        await requireLearningSetChangeAllowed();
        const body = bodyObject(await request.json());
        const validation = validateLearningSet(bodyString(body.path));
        if (!validation.ok) throw new Error(validation.code);
        selectedConfig(deps.paths, validation.root);
        response = json({ learningSet: validation.root, restartRequired: true });
      } else if (request.method === 'PUT' && url.pathname === '/api/desktop/models') {
        const body = bodyObject(await request.json());
        const teacher = selection(body.teacher);
        const scout = selection(body.scout);
        await Promise.all([deps.modelService.resolve(teacher), deps.modelService.resolve(scout)]);
        const current = loadAppConfig(deps.paths.appConfigPath);
        writeDesktopPiSettings(deps.paths.settingsPath, {
          sessionsDir: deps.paths.sessionsDir,
          teacher,
          scout,
        });
        const onboardingComplete = current.currentLearningSet !== null;
        saveAppConfig(deps.paths.appConfigPath, {
          ...current,
          teacher,
          scout,
          onboardingComplete,
        });
        response = json({ onboardingComplete, restartRequired: true });
      } else if (request.method === 'POST' && url.pathname === '/api/desktop/auth') {
        const body = bodyObject(await request.json());
        const provider = bodyString(body.provider);
        if (body.type !== 'api_key' && body.type !== 'oauth') {
          throw new Error('DESKTOP_REQUEST_INVALID');
        }
        response = json({ flowId: authFlows.start(provider, body.type) }, 202);
      } else {
        const authResponse = /^\/api\/desktop\/auth\/([^/]+)\/respond$/.exec(url.pathname);
        const authFlow = /^\/api\/desktop\/auth\/([^/]+)$/.exec(url.pathname);
        if (request.method === 'POST' && authResponse) {
          const body = bodyObject(await request.json());
          authFlows.respond(authResponse[1]!, bodyString(body.value));
          response = new Response(null, { status: 204 });
        } else if (request.method === 'GET' && authFlow) {
          response = json(authFlows.read(authFlow[1]!));
        } else if (request.method === 'DELETE' && authFlow) {
          authFlows.cancel(authFlow[1]!);
          response = new Response(null, { status: 204 });
        } else if (request.method === 'POST' && url.pathname === '/api/desktop/shutdown') {
          setTimeout(deps.shutdown, 0);
          response = new Response(null, { status: 202 });
        } else {
          response = json({ error: 'NOT_FOUND' }, 404);
        }
      }
      return withDesktopCors(request, response);
    } catch (error) {
      return withDesktopCors(request, errorResponse(error));
    }
  };
}
