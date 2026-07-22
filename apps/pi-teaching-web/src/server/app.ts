import type { ImageContent } from '@earendil-works/pi-ai';
import type { Server } from 'bun';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname, join } from 'node:path';
import { resolveInsideRoot } from 'highschool-study-markdown/study-domain';
import { projectSessionEvent } from '../projection/projector';
import type { MessageProjectionMode } from '../projection/message-policy';
import { projectWorkflow } from '../projection/workflow-projector';
import type { WorkspaceRegistry } from '../runtime/workspace-registry';
import type { SessionKey } from '../shared/contracts';
import { readAbilityProjection, readEvidence } from '../study/ability';
import { readLearningSet } from '../study/read-workspace';
import { buildReplay } from '../study/replay';
import { readStudentNotebook } from '../study/student-notebook';
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

const imageTypes = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
} as const;

const personaChoices = [
  { id: 'neutral-tutor', name: '中性教师' },
  { id: 'calm-senpai', name: '冷静学姐' },
  { id: 'energetic-classmate', name: '元气同桌' },
];

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
    const bind = (key: SessionKey) => {
      if (bound.has(key)) return;
      deps.registry.subscribe(key, (event) => {
        for (const projected of projectSessionEvent(key, event, projectionMode)) {
          deps.hub.publish(projected);
        }
        if (
          event.type === 'tool_execution_end'
          && event.toolName === 'trace_append'
          && !event.isError
        ) {
          deps.hub.publish({
            type: 'ability-update',
            projection: abilityReader(deps.root),
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

    if (request.method === 'GET' && url.pathname === '/api/abilities') {
      return json(readAbilityProjection(deps.root));
    }

    if (request.method === 'GET' && url.pathname === '/api/evidence') {
      const source = url.searchParams.get('source');
      if (!source) return json({ error: 'SOURCE_REQUIRED' }, 400);
      return json(readEvidence(deps.root, source));
    }

    if (request.method === 'GET' && url.pathname === '/api/persona') {
      const key = url.searchParams.get('sessionKey') as SessionKey | null;
      if (!key) return json({ error: 'SESSION_KEY_REQUIRED' }, 400);
      return json({ id: deps.registry.personaId(key), choices: personaChoices });
    }

    const persona = /^\/api\/sessions\/([^/]+)\/persona$/.exec(url.pathname);
    if (request.method === 'POST' && persona) {
      const key = decodeURIComponent(persona[1]!) as SessionKey;
      const input = await request.json() as { id: string };
      await deps.registry.setPersona(key, input.id);
      return json({ id: deps.registry.personaId(key), choices: personaChoices });
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
        deps.registry.history(lesson.sessionKey, projectionMode),
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
      return json(deps.registry.history(
        decodeURIComponent(history[1]!) as SessionKey,
        projectionMode,
      ));
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
      const session = key.startsWith('coach:')
        ? await deps.registry.openCoach(key.slice(6))
        : await deps.registry.openTutor(key.slice(6));
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
      void deps.registry.send(key, input.text, images).then(() => {
        const planId = key.startsWith('coach:')
          ? key.slice(6)
          : deps.registry.snapshot().plan.id;
        deps.hub.publish({ type: 'snapshot', workspace: deps.registry.snapshot(planId) });
      }).catch(() => deps.hub.publish({
        type: 'session-error',
        sessionKey: key,
        message: '模型调用失败，请检查 Pi 的模型与凭据配置后重试。',
      }));
      return json({ accepted: true, sessionId: session.sessionId }, 202);
    }

    const lessonAction = /^\/api\/lessons\/([^/]+)\/(start|pause|reprepare)$/.exec(url.pathname);
    if (request.method === 'POST' && lessonAction) {
      const lessonId = decodeURIComponent(lessonAction[1]!);
      const startsLesson = lessonAction[2] === 'start';
      if (startsLesson) {
        await deps.registry.startLesson(lessonId);
        bind(`tutor:${lessonId}`);
      }
      if (lessonAction[2] === 'pause') await deps.registry.pauseLesson(lessonId);
      if (lessonAction[2] === 'reprepare') {
        await deps.registry.abandonForReprepare(lessonId);
      }
      const snapshot = deps.registry.snapshot();
      deps.hub.publish({ type: 'snapshot', workspace: snapshot });
      if (startsLesson) {
        void deps.registry.triggerLessonStart(lessonId)
          .then(() => deps.hub.publish({
            type: 'snapshot',
            workspace: deps.registry.snapshot(),
          }))
          .catch(() => deps.hub.publish({
            type: 'session-error',
            sessionKey: `tutor:${lessonId}`,
            message: '模型调用失败，请检查 Pi 的模型与凭据配置后重试。',
          }));
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
