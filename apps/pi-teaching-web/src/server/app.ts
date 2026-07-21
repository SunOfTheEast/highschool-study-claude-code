import type { ImageContent } from '@earendil-works/pi-ai';
import type { Server } from 'bun';
import { randomUUID } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, extname } from 'node:path';
import { resolveInsideRoot } from 'highschool-study-markdown/study-domain';
import { projectSessionEvent } from '../projection/projector';
import type { WorkspaceRegistry } from '../runtime/workspace-registry';
import type { SessionKey } from '../shared/contracts';
import { readAbilityProjection, readEvidence } from '../study/ability';
import { readLearningSet } from '../study/read-workspace';
import { readStudentNotebook } from '../study/student-notebook';
import type { EventHub } from './event-hub';

export type AppDependencies = {
  root: string;
  authoring: boolean;
  registry: WorkspaceRegistry;
  hub: EventHub;
  readLearningSet?: typeof readLearningSet;
};

const json = (value: unknown, status = 200) => Response.json(value, { status });

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
    const learningSetReader = deps.readLearningSet ?? readLearningSet;
    const bind = (key: SessionKey) => {
      if (bound.has(key)) return;
      deps.registry.subscribe(key, (event) => {
        for (const projected of projectSessionEvent(key, event)) deps.hub.publish(projected);
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

    const notebook = /^\/api\/lessons\/([^/]+)\/notebook$/.exec(url.pathname);
    if (request.method === 'GET' && notebook) {
      return json(readStudentNotebook(
        deps.root,
        decodeURIComponent(notebook[1]!),
        deps.authoring,
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
      return json(deps.registry.history(decodeURIComponent(history[1]!) as SessionKey));
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
      if (lessonAction[2] === 'start') {
        await deps.registry.startLesson(lessonId);
        bind(`tutor:${lessonId}`);
      }
      if (lessonAction[2] === 'pause') await deps.registry.pauseLesson(lessonId);
      if (lessonAction[2] === 'reprepare') {
        await deps.registry.abandonForReprepare(lessonId);
      }
      const snapshot = deps.registry.snapshot();
      deps.hub.publish({ type: 'snapshot', workspace: snapshot });
      return json(snapshot);
    }

    if (url.pathname === '/events' && server?.upgrade(request)) return;
    return new Response('Not found', { status: 404 });
  };
}
