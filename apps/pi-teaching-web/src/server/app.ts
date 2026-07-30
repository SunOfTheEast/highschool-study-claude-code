import type { ImageContent } from '@earendil-works/pi-ai';
import type { Server } from 'bun';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { resolveInsideRoot } from 'highschool-study-markdown/study-domain';
import type { MemoryReviewDecision } from '../memory-review/contracts';
import { submittedMemoryReview } from '../memory-review/store';
import { createLiveSessionEventProjector } from '../projection/projector';
import type { MessageProjectionMode } from '../projection/message-policy';
import { projectWorkflow } from '../projection/workflow-projector';
import type { WorkspaceRegistry } from '../runtime/workspace-registry';
import {
  ROADMAP_COACH_SESSION_KEY,
  type SessionKey,
} from '../shared/contracts';
import { readAbilityProjection, readEvidence } from '../study/ability';
import { readLearningSet } from '../study/read-workspace';
import { buildReplay } from '../study/replay';
import { readStudentNotebook } from '../study/student-notebook';
import { readCoachContext } from '../study/coach-context';
import { searchStudentContent } from '../study/content-explorer';
import { readHomeSnapshot } from '../study/home';
import { personaChoices, personaPortraitPath } from '../study/persona';
import { PreparedLessonValidationError } from '../study/validate-prepared-lesson';
import type { EventHub } from './event-hub';

export type AppDependencies = {
  root: string;
  authoring: boolean;
  staticRoot?: string;
  registry: WorkspaceRegistry;
  hub: EventHub;
  readLearningSet?: typeof readLearningSet;
  readAbilityProjection?: typeof readAbilityProjection;
  messageProjection?: MessageProjectionMode;
};

const json = (value: unknown, status = 200) => Response.json(value, { status });
const abilityWriters = new Set(['trace_append', 'card_alternative_append']);

const imageTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
} as const;

function readImageContent(root: string, path: string): ImageContent {
  const mimeType = imageTypes[extname(path).toLowerCase() as keyof typeof imageTypes];
  if (!mimeType) throw new Error(`UNSUPPORTED_IMAGE: ${path}`);
  return {
    type: 'image',
    data: readFileSync(resolveInsideRoot(root, path)).toString('base64'),
    mimeType,
  };
}

export function createRequestHandler(deps?: AppDependencies) {
  const bound = new Set<SessionKey>();

  return async (request: Request, server?: Server<undefined>): Promise<Response | undefined> => {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/api/health') {
      return json({ ok: true, runtime: 'pi' });
    }
    if (!deps) return new Response('Not found', { status: 404 });
    const projectionMode = deps.messageProjection ?? 'safe';
    const learningSetReader = deps.readLearningSet ?? readLearningSet;
    const abilityReader = deps.readAbilityProjection ?? readAbilityProjection;
    const runSession = (
      key: SessionKey,
      label: string,
      task: () => Promise<void>,
      onSuccess?: () => void,
    ) => {
      deps.hub.publish({
        type: 'session-run',
        sessionKey: key,
        status: 'running',
        label,
      });
      void task()
        .then(onSuccess)
        .catch(() => deps.hub.publish({
          type: 'session-error',
          sessionKey: key,
          message: '模型调用失败，请检查 Pi 的模型与凭据配置后重试。',
        }))
        .finally(() => deps.hub.publish({
          type: 'session-run',
          sessionKey: key,
          status: 'idle',
          label: '',
        }));
    };
    const bind = (key: SessionKey) => {
      if (bound.has(key)) return;
      const projectEvent = createLiveSessionEventProjector(key, projectionMode);
      deps.registry.subscribe(key, (event) => {
        for (const projected of projectEvent(event)) {
          deps.hub.publish(projected);
        }
        if (
          event.type === 'tool_execution_end'
          && abilityWriters.has(event.toolName)
          && !event.isError
        ) {
          deps.hub.publish({
            type: 'ability-update',
            projection: abilityReader(deps.root),
          });
        }
        if (event.type === 'agent_end' && !event.willRetry) {
          deps.hub.publish({
            type: 'conversation-snapshot',
            sessionKey: key,
            items: deps.registry.history(key, projectionMode),
          });
        }
      });
      deps.registry.subscribeWorkflows(key, (workflow) => {
        deps.hub.publish({
          type: 'workflow',
          sessionKey: key,
          workflow: projectWorkflow(workflow),
        });
      });
      bound.add(key);
    };

    if (request.method === 'GET' && url.pathname === '/api/learning-set') {
      return json(learningSetReader(deps.root));
    }

    if (request.method === 'GET' && url.pathname === '/api/home') {
      return json(readHomeSnapshot(deps.root));
    }

    if (request.method === 'GET' && url.pathname === '/api/workspaces/roadmap') {
      return json(deps.registry.roadmapSnapshot());
    }

    if (request.method === 'GET' && url.pathname === '/api/abilities') {
      return json(readAbilityProjection(deps.root));
    }

    if (request.method === 'GET' && url.pathname === '/api/content-search') {
      const query = url.searchParams.get('query') ?? '';
      const key = url.searchParams.get('sessionKey') as SessionKey | null;
      if (!key) return json({ error: 'CONTENT_SEARCH_SESSION_REQUIRED' }, 400);
      const requestedLimit = Number(url.searchParams.get('limit') ?? 20);
      const limit = Number.isFinite(requestedLimit) ? requestedLimit : 20;
      try {
        return json(searchStudentContent(deps.root, {
          query,
          sessionKey: key,
          limit,
        }));
      } catch (error) {
        const code = error instanceof Error ? error.message : 'CONTENT_SEARCH_FAILED';
        if (code === 'CONTENT_SEARCH_ROADMAP_UNAVAILABLE') {
          return json({ error: code }, 403);
        }
        if (code === 'CONTENT_SEARCH_TUTOR_NOT_STARTED') {
          return json({ error: code }, 409);
        }
        if (code === 'CONTENT_SEARCH_SESSION_NOT_FOUND' || code.startsWith('PLAN_NOT_FOUND')) {
          return json({ error: code }, 404);
        }
        throw error;
      }
    }

    const planContext = /^\/api\/plans\/([^/]+)\/context$/.exec(url.pathname);
    if (request.method === 'GET' && planContext) {
      return json(readCoachContext(deps.root, decodeURIComponent(planContext[1]!)));
    }

    if (request.method === 'GET' && url.pathname === '/api/evidence') {
      const source = url.searchParams.get('source');
      if (!source) return json({ error: 'SOURCE_REQUIRED' }, 400);
      return json(readEvidence(deps.root, source));
    }

    if (request.method === 'GET' && url.pathname === '/api/persona') {
      const key = url.searchParams.get('sessionKey') as SessionKey | null;
      if (!key) return json({ error: 'SESSION_KEY_REQUIRED' }, 400);
      return json({ id: deps.registry.personaId(key), choices: personaChoices(deps.root) });
    }

    const personaPortrait = /^\/api\/personas\/([^/]+)\/portrait$/.exec(url.pathname);
    if (request.method === 'GET' && personaPortrait) {
      const path = personaPortraitPath(deps.root, decodeURIComponent(personaPortrait[1]!));
      if (!path) return new Response('Not found', { status: 404 });
      return new Response(Bun.file(path), {
        headers: {
          'content-type': imageTypes[extname(path).toLowerCase() as keyof typeof imageTypes],
        },
      });
    }

    const persona = /^\/api\/sessions\/([^/]+)\/persona$/.exec(url.pathname);
    if (request.method === 'POST' && persona) {
      const key = decodeURIComponent(persona[1]!) as SessionKey;
      const input = await request.json() as { id: string };
      await deps.registry.setPersona(key, input.id);
      return json({ id: deps.registry.personaId(key), choices: personaChoices(deps.root) });
    }

    const notebook = /^\/api\/lessons\/([^/]+)\/notebook$/.exec(url.pathname);
    if (request.method === 'GET' && notebook) {
      return json(readStudentNotebook(
        deps.root,
        decodeURIComponent(notebook[1]!),
        deps.authoring,
      ));
    }

    const replay = /^\/api\/lessons\/([^/]+)\/replay$/.exec(url.pathname);
    if (request.method === 'GET' && replay) {
      const lessonId = decodeURIComponent(replay[1]!);
      const lesson = deps.registry.snapshot().lessons.find((item) => item.id === lessonId);
      if (!lesson) return json({ error: 'LESSON_NOT_FOUND' }, 404);
      return json(buildReplay(
        deps.root,
        lesson,
        deps.registry.history(lesson.sessionKey, projectionMode).flatMap((item) => (
          item.kind === 'message' ? [item.message] : []
        )),
      ));
    }

    const imageUpload = /^\/api\/lessons\/([^/]+)\/images$/.exec(url.pathname);
    if (request.method === 'POST' && imageUpload) {
      const lessonId = decodeURIComponent(imageUpload[1]!);
      const form = await request.formData();
      const image = form.get('image');
      if (!(image instanceof File)) return json({ error: 'IMAGE_REQUIRED' }, 400);
      const extension = {
        'image/png': '.png',
        'image/jpeg': '.jpg',
        'image/webp': '.webp',
      }[image.type];
      if (!extension) return json({ error: 'UNSUPPORTED_IMAGE' }, 415);
      const path = `materials/classroom/${lessonId}/${randomUUID()}${extension}`;
      const absolute = resolveInsideRoot(deps.root, path);
      mkdirSync(dirname(absolute), { recursive: true });
      writeFileSync(absolute, Buffer.from(await image.arrayBuffer()));
      return json({ path });
    }

    const workspace = /^\/api\/workspaces\/([^/]+)$/.exec(url.pathname);
    if (request.method === 'GET' && workspace) {
      return json(deps.registry.snapshot(decodeURIComponent(workspace[1]!)));
    }

    const history = /^\/api\/sessions\/([^/]+)\/history$/.exec(url.pathname);
    if (request.method === 'GET' && history) {
      const key = decodeURIComponent(history[1]!) as SessionKey;
      if (!key.startsWith('coach:') && !key.startsWith('tutor:')) {
        return json({ error: 'SESSION_NOT_FOUND' }, 404);
      }
      await deps.registry.openSession(key);
      bind(key);
      return json(deps.registry.history(key, projectionMode));
    }

    const memoryReview = /^\/api\/sessions\/([^/]+)\/memory-review$/.exec(url.pathname);
    if (request.method === 'GET' && memoryReview) {
      const key = decodeURIComponent(memoryReview[1]!) as SessionKey;
      if (!key.startsWith('coach:') || key === ROADMAP_COACH_SESSION_KEY) {
        return json({ error: 'MEMORY_REVIEW_PLAN_COACH_ONLY' }, 403);
      }
      try {
        return json(await deps.registry.memoryReview(key));
      } catch (error) {
        const code = error instanceof Error ? error.message : 'MEMORY_REVIEW_FAILED';
        if (code === 'MEMORY_REVIEW_PLAN_COACH_ONLY') return json({ error: code }, 403);
        throw error;
      }
    }

    const memoryReviewSubmit = (
      /^\/api\/sessions\/([^/]+)\/memory-review\/([^/]+)\/submit$/.exec(url.pathname)
    );
    if (request.method === 'POST' && memoryReviewSubmit) {
      const key = decodeURIComponent(memoryReviewSubmit[1]!) as SessionKey;
      const reviewId = decodeURIComponent(memoryReviewSubmit[2]!);
      if (!key.startsWith('coach:') || key === ROADMAP_COACH_SESSION_KEY) {
        return json({ error: 'MEMORY_REVIEW_PLAN_COACH_ONLY' }, 403);
      }
      const input = await request.json() as { decisions?: unknown };
      if (!Array.isArray(input.decisions)) {
        return json({ error: 'MEMORY_REVIEW_DECISIONS_REQUIRED' }, 400);
      }
      const decisions = input.decisions as MemoryReviewDecision[];
      let submitted;
      try {
        submitted = submittedMemoryReview(
          await deps.registry.memoryReview(key),
          reviewId,
          decisions,
        );
      } catch (error) {
        const code = error instanceof Error ? error.message : 'MEMORY_REVIEW_FAILED';
        if (code === 'MEMORY_REVIEW_PLAN_COACH_ONLY') return json({ error: code }, 403);
        if (code === 'MEMORY_REVIEW_NOT_FOUND') return json({ error: code }, 404);
        if (code.startsWith('MEMORY_REVIEW_')) return json({ error: code }, 400);
        throw error;
      }
      bind(key);
      runSession(
        key,
        '学习顾问正在整理长期记忆',
        async () => {
          await deps.registry.submitMemoryReview(key, reviewId, decisions);
        },
        () => deps.hub.publish({
          type: 'snapshot',
          workspace: deps.registry.snapshot(key.slice(6)),
        }),
      );
      return json(submitted, 202);
    }

    const deep = /^\/api\/sessions\/([^/]+)\/deep$/.exec(url.pathname);
    if (deep) {
      const key = decodeURIComponent(deep[1]!) as SessionKey;
      if (request.method === 'POST') {
        const input = await request.json() as { enabled: boolean };
        await deps.registry.setDeepMode(key, input.enabled);
      } else if (request.method !== 'GET') {
        return new Response('Method not allowed', { status: 405 });
      }
      const enabled = await deps.registry.deepMode(key);
      const workflows = await deps.registry.workflows(key);
      bind(key);
      return json({ enabled, workflows: workflows.map(projectWorkflow) });
    }

    const workflowAction = /^\/api\/sessions\/([^/]+)\/workflows\/([^/]+)\/(confirm|cancel)$/.exec(
      url.pathname,
    );
    if (request.method === 'POST' && workflowAction) {
      const key = decodeURIComponent(workflowAction[1]!) as SessionKey;
      const workflowId = decodeURIComponent(workflowAction[2]!);
      await deps.registry.workflows(key);
      bind(key);
      if (workflowAction[3] === 'confirm') {
        return json(projectWorkflow(await deps.registry.confirmWorkflow(key, workflowId)));
      }
      await deps.registry.cancelWorkflow(key, workflowId);
      const snapshot = (await deps.registry.workflows(key))
        .find((workflow) => workflow.id === workflowId);
      if (!snapshot) return json({ error: 'WORKFLOW_NOT_FOUND' }, 404);
      return json(projectWorkflow(snapshot));
    }

    const messages = /^\/api\/sessions\/([^/]+)\/messages$/.exec(url.pathname);
    if (request.method === 'POST' && messages) {
      const key = decodeURIComponent(messages[1]!) as SessionKey;
      const input = await request.json() as { text: string; imagePaths?: string[] };
      const images = (input.imagePaths ?? []).map((path) => readImageContent(deps.root, path));
      const session = await deps.registry.openSession(key);
      bind(key);
      deps.hub.publish({
        type: 'message',
        sessionKey: key,
        message: {
          id: `${key}:student:${Date.now()}`,
          role: 'student',
          text: input.text,
          complete: true,
        },
      });
      runSession(
        key,
        key.startsWith('coach:') ? '学习顾问正在回应' : '课堂导师正在回应',
        () => deps.registry.send(key, input.text, images),
        () => {
          if (key === ROADMAP_COACH_SESSION_KEY) {
            deps.hub.publish({ type: 'learning-set', value: learningSetReader(deps.root) });
            return;
          }
          const planId = key.startsWith('coach:')
            ? key.slice(6)
            : deps.registry.snapshot().plan.id;
          deps.hub.publish({ type: 'snapshot', workspace: deps.registry.snapshot(planId) });
        },
      );
      return json({ accepted: true, sessionId: session.sessionId }, 202);
    }

    const lessonAction = /^\/api\/lessons\/([^/]+)\/(start|pause|reprepare)$/.exec(url.pathname);
    if (request.method === 'POST' && lessonAction) {
      const lessonId = decodeURIComponent(lessonAction[1]!);
      const startsLesson = lessonAction[2] === 'start';
      let shouldKickoff = false;
      if (startsLesson) {
        try {
          ({ shouldKickoff } = await deps.registry.startLesson(lessonId));
        } catch (error) {
          if (error instanceof PreparedLessonValidationError) {
            return json({ error: error.code, issues: error.issues }, 422);
          }
          throw error;
        }
        bind(`tutor:${lessonId}`);
      }
      if (lessonAction[2] === 'pause') await deps.registry.pauseLesson(lessonId);
      if (lessonAction[2] === 'reprepare') {
        await deps.registry.abandonForReprepare(lessonId);
      }
      const snapshot = deps.registry.snapshot();
      deps.hub.publish({ type: 'snapshot', workspace: snapshot });
      if (startsLesson && shouldKickoff) {
        runSession(
          `tutor:${lessonId}`,
          '课堂导师正在启动',
          () => deps.registry.triggerLessonStart(lessonId),
          () => deps.hub.publish({
            type: 'snapshot',
            workspace: deps.registry.snapshot(),
          }),
        );
      }
      return json(snapshot);
    }

    if (url.pathname === '/events' && server?.upgrade(request)) return;
    if (deps.staticRoot && request.method === 'GET') {
      const asset = url.pathname.startsWith('/assets/') ? url.pathname.slice(1) : null;
      const shell = url.pathname === '/'
        || (!url.pathname.startsWith('/api/') && !url.pathname.includes('.'));
      const path = asset ?? (shell ? 'index.html' : null);
      if (path) {
        const file = Bun.file(join(deps.staticRoot, path));
        if (await file.exists()) return new Response(file);
      }
    }
    return new Response('Not found', { status: 404 });
  };
}
