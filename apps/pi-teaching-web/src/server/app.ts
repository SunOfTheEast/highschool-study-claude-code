import { existsSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import type { Server } from 'bun';
import type { AgentSessionEvent } from '@earendil-works/pi-coding-agent';
import { projectConversationEntries, projectLiveSessionEvent } from '../projection/conversation';
import { NodeLifecycleService } from '../runtime/node-lifecycle';
import type { WorkspaceRegistry } from '../runtime/workspace-registry';
import type {
  LearningAssetReference,
  LearningNoteBlock,
  ProblemAttemptResponse,
  SessionKey,
} from '../shared/contracts';
import { parseHandoutBlockSegment } from '../shared/handout-route';
import { readKnowledge } from '../study/knowledge';
import { readLessonHandout } from '../study/lesson-handout';
import { StudyDocumentError } from '../study/markdown';
import { readWorkspace } from '../study/workspace';
import { readLearningSetHome } from '../study/learning-set-home';
import {
  planLearningNoteSave,
  planProblemCardSave,
  readLearningAssetLibrary,
  readLearningNote,
  readProblemCard,
  readStudentProblemCard,
} from '../study/learning-assets';
import {
  readProblemActivity,
  recordProblemAttempt,
  revealProblemAnswer,
} from '../study/problem-attempts';
import { commitDocumentCandidates } from '../runtime/multi-document-transaction';
import type { EventHub } from './event-hub';

type Lifecycle = Pick<
  NodeLifecycleService,
  'startPlan' | 'completePlan' | 'startLesson' | 'closeLesson'
>;

type Registry = Pick<
  WorkspaceRegistry,
  | 'readHistory'
  | 'send'
  | 'subscribe'
  | 'open'
  | 'abort'
  | 'release'
  | 'createFreeLearning'
  | 'listFreeLearning'
  | 'endFreeLearning'
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
  const status = /NOT_FOUND|does not exist/.test(message)
    ? 404
    : /STALE|CONFLICT|ENDED|RUNNING|NOT_ACTIVE|NOT_ALLOWED|READ_ONLY/.test(message)
      ? 409
      : /INVALID|REQUIRED|LIMIT|DUPLICATE|must be|cannot/.test(message)
        ? 400
        : 500;
  return json({ error: message }, status);
}

function sessionKey(value: string): SessionKey | null {
  try {
    const decoded = decodeURIComponent(value);
    const id = '[A-Za-z0-9][A-Za-z0-9._-]*';
    return new RegExp(`^(?:(?:roadmap|plan):${id}|lesson:${id}:${id}|free:${id})$`).test(decoded)
      ? decoded as SessionKey
      : null;
  } catch {
    return null;
  }
}

function objectBody(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('REQUEST_BODY_INVALID');
  }
  return value as Record<string, unknown>;
}

function requiredBodyString(value: unknown, label: string, allowEmpty = false): string {
  if (typeof value !== 'string' || (!allowEmpty && value.trim().length === 0)) {
    throw new Error(`${label.toUpperCase()}_REQUIRED`);
  }
  return value.trim();
}

function positiveRevision(value: unknown): number {
  if (!Number.isSafeInteger(value) || Number(value) < 1) {
    throw new Error('EXPECTED_REVISION_INVALID');
  }
  return Number(value);
}

function learningAssetReferences(value: unknown): LearningAssetReference[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) throw new Error('SELECTED_ASSETS_INVALID');
  return value.map((item) => {
    const reference = objectBody(item);
    const kind = reference.kind;
    const id = reference.id;
    if ((kind !== 'note' && kind !== 'problem-card') || typeof id !== 'string') {
      throw new Error('SELECTED_ASSET_INVALID');
    }
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(id)) throw new Error('SELECTED_ASSET_INVALID');
    return { kind, id };
  });
}

function noteBlocks(value: unknown): LearningNoteBlock[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error('NOTE_BLOCKS_REQUIRED');
  return value.map((item) => {
    const block = objectBody(item);
    if (block.kind === 'markdown') {
      return { kind: 'markdown', body: requiredBodyString(block.body, 'note block body') };
    }
    if (block.kind === 'recall') {
      return {
        kind: 'recall',
        prompt: requiredBodyString(block.prompt, 'recall prompt'),
        answer: requiredBodyString(block.answer, 'recall answer'),
      };
    }
    throw new Error('NOTE_BLOCK_KIND_INVALID');
  });
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
      return json({ ok: true, runtime: 'pi-m1' });
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
          && (
            event.toolName === 'lesson_memory_commit'
            || event.toolName === 'memory_route_resolve'
          )
        ) {
          deps.hub.publish({ type: 'course-invalidated' });
          deps.hub.publish({ type: 'knowledge-invalidated' });
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && (event.toolName === 'save_note' || event.toolName === 'save_problem_card')
        ) {
          deps.hub.publish({ type: 'home-invalidated' });
          deps.hub.publish({ type: 'assets-invalidated' });
          deps.hub.publish({ type: 'knowledge-invalidated' });
        }
        if (
          event.type === 'tool_execution_end'
          && !event.isError
          && event.toolName === 'free_learning_memory_commit'
        ) {
          deps.hub.publish({ type: 'knowledge-invalidated' });
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
      if (request.method === 'GET' && url.pathname === '/api/home') {
        return json(readLearningSetHome(deps.root, await deps.registry.listFreeLearning()));
      }
      if (url.pathname === '/api/free-learning' && request.method === 'GET') {
        return json(await deps.registry.listFreeLearning());
      }
      if (url.pathname === '/api/free-learning' && request.method === 'POST') {
        const requestBody = objectBody(await request.json());
        const session = await deps.registry.createFreeLearning(
          learningAssetReferences(requestBody.selectedAssets),
        );
        deps.hub.publish({ type: 'home-invalidated' });
        return json({ session, route: `/learn/${encodeURIComponent(session.id)}` }, 201);
      }

      const freeEnd = /^\/api\/free-learning\/([^/]+)\/end$/.exec(url.pathname);
      if (request.method === 'POST' && freeEnd) {
        const id = nodeId(freeEnd[1]!);
        if (!id) return json({ error: 'FREE_LEARNING_SESSION_ID_INVALID' }, 400);
        const session = await deps.registry.endFreeLearning(`free:${id}`);
        deps.hub.publish({ type: 'home-invalidated' });
        return json({ session });
      }

      if (request.method === 'GET' && url.pathname === '/api/assets') {
        return json(readLearningAssetLibrary(deps.root));
      }

      const noteAsset = /^\/api\/assets\/notes\/([^/]+)$/.exec(url.pathname);
      if (noteAsset) {
        const id = nodeId(noteAsset[1]!);
        if (!id) return json({ error: 'NOTE_ID_INVALID' }, 400);
        if (request.method === 'GET') return json(readLearningNote(deps.root, id));
        if (request.method === 'PUT') {
          const requestBody = objectBody(await request.json());
          const current = readLearningNote(deps.root, id);
          const planned = planLearningNoteSave(deps.root, 'student-editor', {
            target: { id, expectedRevision: positiveRevision(requestBody.expectedRevision) },
            title: requiredBodyString(requestBody.title, 'note title'),
            blocks: noteBlocks(requestBody.blocks),
            sources: current.sources,
          }, new Date().toISOString());
          commitDocumentCandidates(deps.root, planned.candidates);
          deps.hub.publish({ type: 'home-invalidated' });
          deps.hub.publish({ type: 'assets-invalidated' });
          return json(planned.note);
        }
      }

      const problemAsset = /^\/api\/assets\/problem-cards\/([^/]+)$/.exec(url.pathname);
      if (request.method === 'GET' && problemAsset) {
        const id = nodeId(problemAsset[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        const card = readProblemCard(deps.root, id);
        const activity = readProblemActivity(deps.root, id);
        const revealed = activity.answerRevealedForLatestAttempt
          && activity.latestAttempt?.cardRevision === card.revision;
        return json({
          ...readStudentProblemCard(deps.root, id, revealed),
          activity,
        });
      }

      const problemNote = /^\/api\/assets\/problem-cards\/([^/]+)\/note$/.exec(url.pathname);
      if (request.method === 'PUT' && problemNote) {
        const id = nodeId(problemNote[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        const requestBody = objectBody(await request.json());
        const current = readProblemCard(deps.root, id);
        const planned = planProblemCardSave(deps.root, 'student-editor', {
          target: { id, expectedRevision: positiveRevision(requestBody.expectedRevision) },
          stem: current.stem,
          standardAnswer: current.standardAnswer,
          teacherRationale: current.teacherRationale,
          studentNote: requiredBodyString(requestBody.studentNote, 'student note', true),
          sources: current.sources,
        }, new Date().toISOString());
        commitDocumentCandidates(deps.root, planned.candidates);
        deps.hub.publish({ type: 'home-invalidated' });
        deps.hub.publish({ type: 'assets-invalidated' });
        deps.hub.publish({ type: 'knowledge-invalidated' });
        return json(readStudentProblemCard(deps.root, id, false));
      }

      const attempt = /^\/api\/problem-cards\/([^/]+)\/attempts$/.exec(url.pathname);
      if (request.method === 'POST' && attempt) {
        const id = nodeId(attempt[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        const requestBody = objectBody(await request.json());
        const response = objectBody(requestBody.response);
        let semantic: ProblemAttemptResponse;
        if (response.kind === 'cannot') semantic = { kind: 'cannot' };
        else if (response.kind === 'answer') {
          semantic = { kind: 'answer', text: requiredBodyString(response.text, 'answer text') };
        } else throw new Error('ATTEMPT_RESPONSE_INVALID');
        const event = recordProblemAttempt(
          deps.root,
          id,
          semantic,
          requiredBodyString(requestBody.requestId, 'request id'),
        );
        deps.hub.publish({ type: 'assets-invalidated' });
        return json({ event }, 201);
      }

      const reveal = /^\/api\/problem-cards\/([^/]+)\/reveal$/.exec(url.pathname);
      if (request.method === 'POST' && reveal) {
        const id = nodeId(reveal[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        const requestBody = objectBody(await request.json());
        const result = revealProblemAnswer(
          deps.root,
          id,
          requiredBodyString(requestBody.requestId, 'request id'),
        );
        deps.hub.publish({ type: 'assets-invalidated' });
        return json(result);
      }

      const askTeacher = /^\/api\/problem-cards\/([^/]+)\/ask-teacher$/.exec(url.pathname);
      if (request.method === 'POST' && askTeacher) {
        const id = nodeId(askTeacher[1]!);
        if (!id) return json({ error: 'PROBLEM_CARD_ID_INVALID' }, 400);
        readProblemCard(deps.root, id);
        const session = await deps.registry.createFreeLearning([{ kind: 'problem-card', id }]);
        deps.hub.publish({ type: 'home-invalidated' });
        return json({ session, route: `/learn/${encodeURIComponent(session.id)}` }, 201);
      }

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
