import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import type { Server } from 'bun';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { projectConversationEntries, projectLiveSessionEvent } from '../projection/conversation';
import { NodeLifecycleService } from '../runtime/node-lifecycle';
import type { WorkspaceRegistry } from '../runtime/workspace-registry';
import type { SessionKey } from '../shared/contracts';
import { parseHandoutBlockSegment } from '../shared/handout-route';
import { readKnowledge } from '../study/knowledge';
import { readLessonHandout } from '../study/lesson-handout';
import { StudyDocumentError } from '../study/markdown';
import { readWorkspace } from '../study/workspace';
import type { EventHub } from './event-hub';

type Lifecycle = Pick<
  NodeLifecycleService,
  'startPlan' | 'completePlan' | 'startLesson' | 'closeLesson'
>;

type Registry = Pick<
  WorkspaceRegistry,
  'readHistory' | 'send' | 'subscribe' | 'open' | 'abort' | 'release'
>;

export type AppDependencies = {
  root: string;
  registry: Registry;
  hub: EventHub;
  lifecycle?: Lifecycle;
  staticRoot?: string;
  readCourse?: typeof readWorkspace;
  readKnowledge?: typeof readKnowledge;
};

const json = (value: unknown, status = 200) => Response.json(value, { status });

function errorResponse(error: unknown): Response {
  if (error instanceof StudyDocumentError) {
    return json({ error: 'STUDY_DOCUMENT_INVALID', path: error.path, reason: error.reason }, 422);
  }
  const message = error instanceof Error ? error.message : String(error);
  const status = /NOT_FOUND/.test(message) ? 404 : /NOT_ACTIVE|NOT_ALLOWED|INVALID/.test(message) ? 409 : 500;
  return json({ error: message }, status);
}

function sessionKey(value: string): SessionKey | null {
  try {
    const decoded = decodeURIComponent(value);
    const id = '[A-Za-z0-9][A-Za-z0-9._-]*';
    return new RegExp(`^(?:(?:roadmap|plan):${id}|lesson:${id}:${id})$`).test(decoded)
      ? decoded as SessionKey
      : null;
  } catch {
    return null;
  }
}

function nodeId(value: string): string | null {
  try {
    const decoded = decodeURIComponent(value);
    return /^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(decoded) ? decoded : null;
  } catch {
    return null;
  }
}

function safeStaticPath(root: string, pathname: string): string | null {
  const requested = normalize(pathname.replace(/^\/+/, ''));
  if (requested.startsWith('..')) return null;
  const direct = join(root, requested);
  if (extname(direct) && existsSync(direct)) return direct;
  const index = join(root, 'index.html');
  return existsSync(index) ? index : null;
}

export function createRequestHandler(deps?: AppDependencies) {
  const bound = new Map<SessionKey, () => void>();

  return async (
    request: Request,
    server?: Server<undefined>,
  ): Promise<Response | undefined> => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, runtime: 'pi-m0' });
    }
    if (!deps) return new Response('Not found', { status: 404 });
    const lifecycle = deps.lifecycle ?? new NodeLifecycleService(deps.root, deps.registry);
    const courseReader = deps.readCourse ?? readWorkspace;
    const knowledgeReader = deps.readKnowledge ?? readKnowledge;

    const bind = async (key: SessionKey) => {
      if (bound.has(key)) return;
      const unsubscribe = await deps.registry.subscribe(key, (event: AgentSessionEvent) => {
        for (const projected of projectLiveSessionEvent(key, event)) {
          deps.hub.publish(projected);
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && (event.toolName === 'edit' || event.toolName === 'write')
        ) {
          deps.hub.publish({ type: 'course-invalidated' });
          deps.hub.publish({ type: 'knowledge-invalidated' });
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && (
            event.toolName === 'classroom_log_append'
            || event.toolName === 'classroom_update'
          )
        ) {
          deps.hub.publish({ type: 'course-invalidated' });
        }
        if (event.type === 'agent_end' && !event.willRetry) {
          void deps.registry.readHistory(key).then((entries) => {
            deps.hub.publish({
              type: 'conversation-snapshot',
              sessionKey: key,
              items: projectConversationEntries(key, entries),
            });
          });
        }
      });
      bound.set(key, unsubscribe);
    };

    try {
      if (request.method === 'GET' && url.pathname === '/api/course') {
        return json(courseReader(deps.root, url.searchParams.get('selected')));
      }
      if (request.method === 'GET' && url.pathname === '/api/knowledge') {
        return json(knowledgeReader(deps.root));
      }
      if (request.method === 'GET' && url.pathname === '/events') {
        if (!server || !server.upgrade(request)) return json({ error: 'WEBSOCKET_UPGRADE_REQUIRED' }, 426);
        return undefined;
      }

      const history = /^\/api\/sessions\/([^/]+)\/history$/.exec(url.pathname);
      if (request.method === 'GET' && history) {
        const key = sessionKey(history[1]!);
        if (!key) return json({ error: 'SESSION_KEY_INVALID' }, 400);
        return json(projectConversationEntries(key, await deps.registry.readHistory(key)));
      }

      const messages = /^\/api\/sessions\/([^/]+)\/messages$/.exec(url.pathname);
      if (request.method === 'POST' && messages) {
        const key = sessionKey(messages[1]!);
        if (!key) return json({ error: 'SESSION_KEY_INVALID' }, 400);
        const body = await request.json() as { text?: unknown };
        if (typeof body.text !== 'string' || body.text.trim().length === 0) {
          return json({ error: 'MESSAGE_TEXT_REQUIRED' }, 400);
        }
        await bind(key);
        deps.hub.publish({ type: 'session-run', sessionKey: key, status: 'running' });
        void deps.registry.send(key, body.text.trim())
          .catch((error) => deps.hub.publish({
            type: 'session-error',
            sessionKey: key,
            message: error instanceof Error ? error.message : String(error),
          }))
          .finally(() => deps.hub.publish({
            type: 'session-run',
            sessionKey: key,
            status: 'idle',
          }));
        return json({ accepted: true }, 202);
      }

      const handout = /^\/api\/plans\/([^/]+)\/lessons\/([^/]+)\/handout\/([^/]+)$/.exec(
        url.pathname,
      );
      if (request.method === 'GET' && handout) {
        const planId = nodeId(handout[1]!);
        const lessonId = nodeId(handout[2]!);
        const blockIds = parseHandoutBlockSegment(handout[3]!);
        if (!planId || !lessonId || !blockIds) {
          return json({ error: 'HANDOUT_ROUTE_INVALID' }, 400);
        }
        return json(readLessonHandout(deps.root, planId, lessonId, blockIds));
      }

      const lessonAction = /^\/api\/plans\/([^/]+)\/lessons\/([^/]+)\/(start|close)$/.exec(
        url.pathname,
      );
      if (request.method === 'POST' && lessonAction) {
        const planId = nodeId(lessonAction[1]!);
        const lessonId = nodeId(lessonAction[2]!);
        if (!planId || !lessonId) return json({ error: 'NODE_ID_INVALID' }, 400);
        const result = lessonAction[3] === 'start'
          ? await lifecycle.startLesson(planId, lessonId)
          : await lifecycle.closeLesson(planId, lessonId);
        deps.hub.publish({ type: 'course-invalidated' });
        return json(result);
      }

      const planAction = /^\/api\/plans\/([^/]+)\/(start|complete)$/.exec(url.pathname);
      if (request.method === 'POST' && planAction) {
        const id = nodeId(planAction[1]!);
        if (!id) return json({ error: 'NODE_ID_INVALID' }, 400);
        const result = planAction[2] === 'start'
          ? await lifecycle.startPlan(id)
          : await lifecycle.completePlan(id);
        deps.hub.publish({ type: 'course-invalidated' });
        return json(result);
      }

      if (url.pathname.startsWith('/api/')) return json({ error: 'NOT_FOUND' }, 404);
      if (request.method === 'GET' && deps.staticRoot) {
        const path = safeStaticPath(deps.staticRoot, url.pathname);
        if (path) return new Response(Bun.file(path));
      }
      return new Response('Not found', { status: 404 });
    } catch (error) {
      return errorResponse(error);
    }
  };
}
